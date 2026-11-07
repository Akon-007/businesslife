#!/usr/bin/env node
/**
 * Prove a real Neon (or any Postgres) endpoint works end to end.
 *
 * Run this where the database is reachable — a laptop or the deploy shell. The
 * agent sandbox this code was built in cannot route to *.neon.tech, so this is
 * the first thing to run on a live endpoint:
 *
 *   DATABASE_URL='postgresql://…-pooler…/neondb?sslmode=require' npm run db:smoke
 *
 * It checks the connection, the TLS handshake, the schema, a write, a read and a
 * delete, and prints how long each took. It creates and removes one key in
 * `app_meta`, so it is safe to run against a live branch.
 */
const url = (process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? '').trim()
let failures = 0
const ok = (label, pass, detail = '') => {
  console.log(`  ${pass ? '✓' : '✗'} ${label}${pass || !detail ? '' : ` — ${detail}`}`)
  if (!pass) failures += 1
}

if (!url) {
  console.error('\nDATABASE_URL is not set. Export the Neon connection string and retry.\n')
  process.exit(1)
}

const expectations = [
  'players', 'sessions', 'companies', 'classes', 'class_students',
  'classroom_records', 'npcs', 'idempotency', 'city_state',
  'marketplace_state', 'lti_keys', 'app_meta',
]

const timed = async (label, run) => {
  const started = Date.now()
  const value = await run()
  return { value, ms: Date.now() - started, label }
}

const { default: pg } = await import('pg')
const ssl = /sslmode=disable/.test(url) ? undefined : { rejectUnauthorized: true }
const client = new pg.Client({ connectionString: url, ssl, connectionTimeoutMillis: 15_000, statement_timeout: 15_000 })

console.log('\nNeon / Postgres smoke test\n')
try {
  const connect = await timed('connect', () => client.connect())
  ok(`connected in ${connect.ms} ms`, true)

  const version = await client.query('select version() as version, current_database() as database, current_user as user')
  console.log(`      ${version.rows[0].database} as ${version.rows[0].user}`)
  console.log(`      ${String(version.rows[0].version).split(' on ')[0]}`)

  const tls = await client.query("select ssl from pg_stat_ssl where pid = pg_backend_pid()")
  ok('the connection is TLS-encrypted', tls.rows[0]?.ssl === true, `ssl = ${tls.rows[0]?.ssl}`)

  const tables = await client.query(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  )
  const present = new Set(tables.rows.map((row) => row.table_name))
  const missing = expectations.filter((table) => !present.has(table))
  ok(`${expectations.length} expected tables exist`, missing.length === 0, `missing ${missing.join(', ')} — run npm run db:migrate`)

  const schemaVersion = await client.query(`select value from app_meta where key = 'schema_version'`)
  ok('the schema version is recorded', Boolean(schemaVersion.rows[0]?.value), JSON.stringify(schemaVersion.rows[0]?.value))

  const probe = `smoke-${Date.now()}`
  const write = await timed('write', () =>
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

  const counts = await client.query(
    `select (select count(*) from players)::int as players, (select count(*) from companies)::int as companies, (select count(*) from classes)::int as classes`,
  )
  console.log(`      current data: ${JSON.stringify(counts.rows[0])}`)
} catch (error) {
  failures += 1
  console.error(`\n  ✗ ${error instanceof Error ? error.message : error}`)
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(String(error))) {
    console.error('    The host is not reachable from here — check the hostname and network.')
  }
  if (/self.signed|unable to verify|certificate/i.test(String(error))) {
    console.error('    TLS failure: Neon needs ?sslmode=require, and the pooled host for app traffic.')
  }
  if (/relation .* does not exist/i.test(String(error))) {
    console.error('    The tables are missing: run `npm run db:migrate` against this branch first.')
  }
} finally {
  await client.end().catch(() => {})
}

console.log(failures === 0 ? '\nPASS — the endpoint is usable.\n' : `\nFAIL — ${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
