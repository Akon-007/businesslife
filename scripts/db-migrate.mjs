#!/usr/bin/env node
/**
 * Apply backend/db/schema.sql to a Postgres database.
 *
 * The schema is written to be idempotent (`create table if not exists`), so this
 * can run on every deploy. Point it at Supabase with SUPABASE_DB_URL (or
 * DATABASE_URL):
 *
 *   SUPABASE_DB_URL='postgresql://postgres.abcdefgh:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require' npm run db:migrate
 *
 * It prints what it found afterwards, so a silent no-op is visible.
 */
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// A local `.env` is convenient on a laptop; real environment variables still win.
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) {
  try { process.loadEnvFile(envFile) } catch (cause) { console.warn(`ignoring .env: ${cause.message}`) }
}

/**
 * The migration runs one multi-statement transaction, which is exactly what
 * Supavisor's transaction mode (6543) is worst at. Templates that ship both URLs
 * call the session-mode one DIRECT_URL; honour it. Otherwise use the same URL
 * the app uses.
 */
const appUrl = (process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? process.env.NEON_DATABASE_URL ?? '').trim()
const directUrl = (process.env.DIRECT_URL ?? '').trim()
const usingDirect = Boolean(directUrl) && directUrl !== appUrl
const url = usingDirect ? directUrl : appUrl

if (!url) {
  console.error('\nNo database URL. Set SUPABASE_DB_URL (or DATABASE_URL) with ?sslmode=require and retry.')
  console.error('Nothing was changed.\n')
  process.exit(1)
}
if (usingDirect) console.log('\nusing DIRECT_URL for the migration (session pooler / direct connection)')

const schema = readFileSync(fileURLToPath(new URL('../backend/db/schema.sql', import.meta.url)), 'utf8')

// Keep in sync with pgConnectionString()/sslFor() in backend/db/postgres.ts:
// Supabase copies `?sslmode=require`; pg honours it as verify-full but warns
// loudly, so normalise it before connecting.
function normalise(raw) {
  try {
    const parsed = new URL(raw)
    const mode = parsed.searchParams.get('sslmode')
    if (mode && mode !== 'disable' && mode !== 'verify-full') {
      parsed.searchParams.set('sslmode', 'verify-full')
      parsed.searchParams.delete('uselibpqcompat')
      return parsed.toString()
    }
  } catch { /* leave it to pg to complain */ }
  return raw
}
const ssl = /(^|[?&])sslmode=disable(&|$)/.test(url) ? undefined : { rejectUnauthorized: process.env.DB_SSL_INSECURE !== 'true' }

const HINTS = `Common causes, in order of likelihood:
  · wrong password            — reset it in Project Settings -> Database, and URL-encode special characters (@ -> %40, # -> %23, : -> %3A)
  · direct host db.<ref>.supabase.co is IPv6-only on new projects — use the pooler host (aws-0-<region>.pooler.supabase.com) and user postgres.<ref>
  · project paused            — free projects pause when idle; open the dashboard and restore it
  · wrong region in the host  — copy the URI from Project Settings -> Database -> Connection string instead of editing ours`

function describe(error) {
  const code = error && error.code ? ` (${error.code})` : ''
  return `${error instanceof Error ? error.message : String(error)}${code}`
}

const isTransactionPooler = /pooler\.supabase\.com$/.test(new URL(url).hostname) && new URL(url).port === '6543'
if (isTransactionPooler) {
  console.warn('\nNote: port 6543 is the transaction pooler. A multi-statement migration is safer on the session pooler (5432) or the direct connection.\n')
}

const { default: pg } = await import('pg')
const client = new pg.Client({ connectionString: normalise(url), ssl })
let connected = false
try {
  await client.connect()
  connected = true
  console.log('\nApplying backend/db/schema.sql\n')
  await client.query(schema)
  const { rows } = await client.query(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  )
  for (const row of rows) console.log(`  · ${row.table_name}`)
  const version = await client.query(`select value from app_meta where key = 'schema_version'`)
  console.log(`\nSchema version: ${JSON.stringify(version.rows[0]?.value ?? null)}`)
  console.log(`${rows.length} table(s) present. Migration complete.\n`)
} catch (error) {
  console.error(`\nMigration failed: ${describe(error)}\n`)
  console.error(`${HINTS}\n`)
  process.exitCode = 1
} finally {
  if (connected) await client.end().catch(() => {})
}
