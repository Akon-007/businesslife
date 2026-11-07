#!/usr/bin/env node
/**
 * Apply backend/db/schema.sql to a Postgres database.
 *
 * The schema is written to be idempotent (`create table if not exists`), so this
 * can run on every deploy. Point it at Neon with DATABASE_URL:
 *
 *   DATABASE_URL='postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require' npm run db:migrate
 *
 * It prints what it found afterwards, so a silent no-op is visible.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const url = (process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? process.env.NEON_DATABASE_URL ?? '').trim()
if (!url) {
  console.error('\nNo database URL. Set SUPABASE_DB_URL (or DATABASE_URL) with ?sslmode=require and retry.')
  console.error('Nothing was changed.\n')
  process.exit(1)
}

const schema = readFileSync(fileURLToPath(new URL('../backend/db/schema.sql', import.meta.url)), 'utf8')
const ssl = /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: process.env.DB_SSL_INSECURE !== 'true' }
const isTransactionPooler = /pooler\.supabase\.com$/.test(new URL(url).hostname) && new URL(url).port === '6543'
if (isTransactionPooler) {
  console.warn('\nNote: port 6543 is the transaction pooler. A multi-statement migration is safer on the session pooler (5432) or the direct connection.\n')
}

const { default: pg } = await import('pg')
const client = new pg.Client({ connectionString: url, ssl })
await client.connect()
try {
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
  console.error('\nMigration failed:', error instanceof Error ? error.message : error, '\n')
  process.exitCode = 1
} finally {
  await client.end()
}
