#!/usr/bin/env node
/**
 * Prove a real Supabase (or Neon, or any Postgres) endpoint works end to end.
 *
 * Run this where the database is reachable — a laptop or the deploy shell. The
 * sandbox this was built in cannot route to *.supabase.co, so this is the first
 * thing to run on a live project:
 *
 *   SUPABASE_DB_URL='postgresql://postgres.abcdefgh:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres' npm run db:smoke
 *
 * It checks the connection, TLS, the schema, row-level-security exposure, and a
 * write/read/delete, printing timings. It creates and removes one `app_meta` row,
 * so it is safe against live data.
 */
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

// A local `.env` is convenient on a laptop; real environment variables still win.
const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) {
  try { process.loadEnvFile(envFile) } catch (cause) { console.warn(`ignoring .env: ${cause.message}`) }
}

const url = (process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? process.env.NEON_DATABASE_URL ?? '').trim()

const checkFlag = process.argv.indexOf('--check')
if (checkFlag !== -1) {
  const candidate = (process.argv[checkFlag + 1] ?? url ?? '').trim()
  process.exit(checkConnectionString(candidate) === 0 ? 0 : 1)
}

if (!url) {
  console.error('\nNo database URL. Set SUPABASE_DB_URL (or DATABASE_URL), or check one with:\n')
  console.error("  npm run db:smoke -- --check 'postgresql://postgres.<ref>:<password>@<host>:<port>/postgres?sslmode=require'\n")
  process.exit(1)
}
let failures = 0
const warn = (label) => console.log(`  ! ${label}`)
const ok = (label, pass, detail = '') => {
  console.log(`  ${pass ? '✓' : '✗'} ${label}${pass || !detail ? '' : ` — ${detail}`}`)
  if (!pass) failures += 1
}

const expectations = [
  'players', 'sessions', 'companies', 'classes', 'class_students',
  'classroom_records', 'npcs', 'idempotency', 'city_state',
  'marketplace_state', 'lti_keys', 'app_meta',
]

let parsed
try {
  parsed = new URL(url)
} catch {
  console.error('\nThat does not parse as a URL. It should look like postgresql://user:pass@host:port/db?sslmode=require\n')
  process.exit(1)
}

const isSupabase = /supabase\.(co|com|net)$/.test(parsed.hostname)
const isPooler = /pooler\.supabase\.com$/.test(parsed.hostname)
const port = Number(parsed.port || 5432)
console.log('\nDatabase smoke test\n')
console.log(`      host: ${parsed.hostname}:${port}${isSupabase ? ' (Supabase)' : ''}`)
console.log(`      user: ${decodeURIComponent(parsed.username)}`)
console.log(`      database: ${parsed.pathname.replace(/^\//, '') || 'postgres'}`)
const directUrl = (process.env.DIRECT_URL ?? '').trim()
if (directUrl && directUrl !== url) {
  const directPort = new URL(directUrl).port || '5432'
  console.log(`      DIRECT_URL is set too (:${directPort}) — db:migrate will use that one, the app uses this one`)
}

if (isSupabase) {
  const mode = isPooler ? (port === 6543 ? 'Supavisor, transaction mode' : port === 5432 ? 'Supavisor, session mode' : `pooler on port ${port}`) : 'direct connection'
  console.log(`      mode: ${mode}`)
  if (!/sslmode=require|sslmode=verify-full|sslmode=verify-ca/.test(url) && !/sslmode=disable/.test(url)) {
    warn('no sslmode in the URL — it is assumed, but spell it out: ?sslmode=require')
  }
  if (!isPooler && port === 5432) {
    warn('direct connections are IPv6-only on new Supabase projects; use the pooler host if your network is IPv4')
  }
  if (port === 6543) {
    console.log('      note: transaction mode cannot hold session state — the app sets timeouts with `set local` only')
  }
}

/** node_modules missing is a first-run failure; say so instead of throwing a resolver stack. */
async function loadPg() {
  try {
    return await import('pg')
  } catch (cause) {
    if (/Cannot find package 'pg'|ERR_MODULE_NOT_FOUND/.test(String(cause?.message ?? cause))) {
      console.error('\nThe Postgres driver is not installed — node_modules is missing or incomplete.\n')
      console.error('  npm install\n')
      console.error('Then re-run: npm run db:smoke\n')
      process.exit(1)
    }
    throw cause
  }
}

const timed = async (run) => {
  const started = Date.now()
  const value = await run()
  return { value, ms: Date.now() - started }
}

const { default: pg } = await loadPg()
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
/**
 * `--check '<string>'` validates a connection string without touching the network.
 * Useful straight after copying it out of the dashboard, before the first connect.
 */
function checkConnectionString(candidate) {
  console.log('\nConnection string check\n')
  let problems = 0
  const bad = (label, hint = '') => {
    problems += 1
    console.log(`  ✗ ${label}`)
    if (hint) console.log(`    ${hint}`)
  }
  const good = (label) => console.log(`  ✓ ${label}`)
  const soft = (label) => console.log(`  ! ${label}`)

  if (!candidate) {
    console.log("  ✗ nothing passed. Try: npm run db:smoke -- --check 'postgresql://…'\n")
    process.exit(1)
  }
  if (/^https?:\/\//i.test(candidate)) {
    bad('that is the project URL (https://<ref>.supabase.co), not a database connection string.',
      'Settings -> Database -> Connection string -> URI is the one the app needs.')
    return problems
  }
  if (/^sb_(publishable|secret)_/i.test(candidate) || /^eyJ[\w-]{10,}\./.test(candidate)) {
    bad('that is an API key (anon / publishable / service role).',
      'This app talks to Postgres directly and never uses an API key. You need the postgresql:// URI.')
    return problems
  }
  if (!/^postgres(ql)?:\/\//i.test(candidate)) {
    bad('a connection string starts with postgresql://')
    return problems
  }
  if (/\[?YOUR[-_ ]?PASSWORD\]?/i.test(candidate)) {
    bad('the password is still the placeholder.',
      'Replace it with the database password (Settings -> Database -> Reset database password if you never saved it).')
  }

  let parts
  try {
    parts = new URL(candidate)
  } catch {
    bad('that does not parse as a URL — a stray space or an unencoded character will do it.',
      'Percent-encode the password: @ -> %40, # -> %23, : -> %3A, / -> %2F, ? -> %3F')
    return problems
  }

  const host = parts.hostname
  const port = Number(parts.port || 5432)
  const user = decodeURIComponent(parts.username)
  const pooler = /pooler\.supabase\.com$/.test(host)
  const direct = /^db\.[a-z0-9]+\.supabase\.co$/i.test(host)

  if (parts.password === '') bad('no password in the URL.', 'postgresql://postgres.<ref>:<password>@<host>:<port>/postgres')
  else if (/%[0-9a-f]{0,1}$|%[^0-9a-f]/i.test(parts.password)) bad('the password has a broken percent-escape.', 'Write a literal % as %25.')

  if (pooler && !user.includes('.')) {
    bad(`pooler user "${user}" is missing the project ref.`, 'Through the pooler the user is postgres.<project-ref>, e.g. postgres.abcdefghijklmnop.')
  }
  if (direct && port === 5432) soft('direct connection: IPv6-only on new projects. If it hangs or refuses, switch to the pooler host.')
  if (!pooler && !direct && /supabase/i.test(host)) soft(`unrecognised Supabase host "${host}" — copy it from the dashboard instead of typing it.`)
  if (port !== 5432 && port !== 6543) soft(`port ${port} is unusual; Supabase uses 5432 (session/direct) or 6543 (transaction).`)
  if (port === 6543) soft('transaction mode: fine for the app, but run db:migrate on 5432.')

  const sslmode = parts.searchParams.get('sslmode')
  if (!sslmode) soft('no ?sslmode=require — it is implied, but say it.')
  else if (sslmode === 'disable') soft('sslmode=disable turns TLS off. Supabase requires TLS.')
  else good(`TLS: sslmode=${sslmode}`)
  if (parts.searchParams.get('pgbouncer') === 'true' && port !== 6543) soft('pgbouncer=true is only needed for the transaction pooler.')

  if (problems === 0) {
    good(`host ${host}:${port}${pooler ? ' (Supavisor)' : direct ? ' (direct)' : ''}`)
    good(`user ${user}`)
    good(`database ${parts.pathname.replace(/^\//, '') || 'postgres'}`)
    console.log('\n  Looks usable. Next:\n')
    console.log('    npm run db:migrate')
    console.log('    npm run db:smoke\n')
  }
  return problems
}



const client = new pg.Client({ connectionString: normalise(url), ssl, connectionTimeoutMillis: 20_000, application_name: 'businesslife-smoke' })

try {
  const connect = await timed(() => client.connect())
  ok(`connected in ${connect.ms} ms`, true)

  const info = await client.query('select version() as version, current_database() as database, current_user as "user"')
  console.log(`      ${String(info.rows[0].version).split(' on ')[0]}`)

  const tls = await client.query('select ssl, version from pg_stat_ssl where pid = pg_backend_pid()')
  ok('the connection is TLS-encrypted', tls.rows[0]?.ssl === true, `ssl = ${tls.rows[0]?.ssl}`)

  const tables = await client.query(`select table_name from information_schema.tables where table_schema = 'public'`)
  const present = new Set(tables.rows.map((row) => row.table_name))
  const missing = expectations.filter((table) => !present.has(table))
  ok(`${expectations.length} expected tables exist`, missing.length === 0, `missing ${missing.join(', ')} — run npm run db:migrate`)

  const version = await client.query(`select value from app_meta where key = 'schema_version'`)
  ok('the schema version is recorded', Boolean(version.rows[0]?.value), JSON.stringify(version.rows[0]?.value))

  // The Supabase-specific risk: `public` is served over PostgREST, so anything
  // without RLS is readable by anyone holding the anon key.
  const exposure = await client.query(`
    select c.relname as table, c.relrowsecurity as rls,
           has_table_privilege('anon', c.oid, 'SELECT') as anon_can_select
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relname = any($1::text[])
    order by c.relname
  `, [expectations])
  const openToAnon = exposure.rows.filter((row) => row.anon_can_select === true)
  const withoutRls = exposure.rows.filter((row) => row.rls !== true)
  ok('no table is readable by the anon role', openToAnon.length === 0, openToAnon.map((row) => row.table).join(', '))
  ok('row level security is enabled on every table', withoutRls.length === 0, withoutRls.map((row) => row.table).join(', '))

  const effective = await client.query(
    `select (select count(*)::int from players) as players, (select count(*)::int from companies) as companies, (select count(*)::int from classes) as classes`,
  )
  console.log(`      current data: ${JSON.stringify(effective.rows[0])}`)

  const probe = `smoke-${Date.now()}`
  const write = await timed(() =>
    client.query(
      `insert into app_meta (key, value) values ($1, $2::jsonb) on conflict (key) do update set value = excluded.value`,
      [probe, JSON.stringify({ at: new Date().toISOString(), from: 'db:smoke' })],
    ),
  )
  ok(`wrote a probe row in ${write.ms} ms`, true)

  const read = await client.query('select value from app_meta where key = $1', [probe])
  ok('read the probe row back', read.rows[0]?.value?.from === 'db:smoke', JSON.stringify(read.rows[0]?.value))

  await client.query('delete from app_meta where key = $1', [probe])
  const gone = await client.query('select 1 from app_meta where key = $1', [probe])
  ok('deleted the probe row', gone.rows.length === 0)

  // Transactions must survive the pooler: BEGIN and COMMIT on one connection.
  await client.query('begin')
  await client.query('set local statement_timeout = \'20s\'')
  const inTx = await client.query('select txid_current()::text as id, pg_backend_pid() as pid')
  await client.query('rollback')
  ok('a transaction with a local statement timeout works', Boolean(inTx.rows[0]?.id))
  console.log(`      backend pid during the transaction: ${inTx.rows[0]?.pid}`)
} catch (error) {
  failures += 1
  console.error(`\n  ✗ ${describe(error)}`)
  const text = String(error)
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN/i.test(text)) {
    console.error('    Host unreachable from here — check the hostname, the port, and whether this network is IPv4-only.')
  }
  if (/self.signed|unable to verify|certificate/i.test(text)) {
    console.error('    TLS failure: use ?sslmode=require with the pooler host, or DB_SSL_INSECURE=true for a proxy you control.')
  }
  if (/relation .* does not exist/i.test(text)) {
    console.error('    Tables are missing: run `npm run db:migrate` against this database first.')
  }
  if (/password authentication failed/i.test(text)) {
    console.error('    Wrong password, or the user is not the project database user (postgres.<project-ref> through the pooler).')
  }
  if (/prepared statement|bind message/i.test(text)) {
    console.error('    Named prepared statements do not survive transaction-mode pooling; the app does not use them.')
  }
  console.error(`\n  ${HINTS.replace(/\n/g, '\n  ')}`)
} finally {
  await client.end().catch(() => {})
}

console.log(failures === 0 ? '\nPASS — the endpoint is usable.\n' : `\nFAIL — ${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
