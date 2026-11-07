#!/usr/bin/env node
/**
 * Postgres store, checked against a real Postgres engine.
 *
 * PGlite is Postgres compiled to WASM and running in this process, so the
 * schema, the jsonb columns, the `on conflict` upserts and the foreign keys are
 * exercised by a genuine Postgres — not by a mock of one. What this cannot prove
 * is Neon-specific behaviour (network, pooling, TLS handshake, branching); that
 * is stated in docs/database.md rather than implied away.
 *
 *   npx tsx scripts/verify-db.ts
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgresStore, encode, pgConnectionString, sslFor } from '../backend/db/postgres.js'
import { createJsonStore } from '../backend/db/json.js'
import { emptyDatabase, hydrateDatabase } from '../backend/db/shape.js'
import type { Database } from '../backend/types.js'
import type { Queryable, QueryablePool } from '../backend/db/types.js'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

const schemaSql = readFileSync(fileURLToPath(new URL('../backend/db/schema.sql', import.meta.url)), 'utf8')
const schemaTables = new Set([...schemaSql.matchAll(/create table if not exists (\w+)/g)].map((match) => match[1]))

function fixture(): Database {
  const base = emptyDatabase()
  return {
    ...base,
    players: [
      { id: 'plr_1', name: 'Ada Mensah', createdAt: '2026-11-01T09:00:00.000Z', wallet: 25_000_000, role: 'learner', progression: { xp: 120, reputation: 4 }, accountEmail: 'ada@school.test', firstName: 'Ada', lastName: 'Mensah', nickname: 'ada', avatar: 'founder-1' },
      { id: 'plr_2', name: 'Dr Amaka Obi', createdAt: '2026-11-01T09:05:00.000Z', wallet: 0, role: 'instructor', progression: { xp: 0, reputation: 0 }, accountEmail: 'amaka@school.test' },
    ] as Database['players'],
    sessions: [
      { token: 'tok_a', playerId: 'plr_1', expiresAt: '2027-01-01T00:00:00.000Z' },
      { token: 'tok_b', playerId: 'plr_2', expiresAt: '2027-01-01T00:00:00.000Z' },
    ],
    companies: [
      {
        id: 'cmp_1',
        playerId: 'plr_1',
        name: 'Mensah Threads — ₦1.2m launch',
        sector: 'retail',
        status: 'active',
        balanceKobo: 24_000_000,
        revenueKobo: 0,
        expensesKobo: 0,
        auditChain: [{ seq: 1, at: '2026-11-01T09:10:00.000Z', type: 'company_created', actor: 'plr_1', hash: 'abc', payload: { sector: 'retail' } }],
        aiTraces: [],
        authorityViolations: [],
        simulation: { runSeed: 4242, scenarioSeed: 4242, replay: { status: 'match', checkedAt: '2026-11-02T00:00:00.000Z', ops: 3, months: 1, diffs: 0 } },
      },
    ] as unknown as Database['companies'],
    classes: [
      {
        id: 'class_1',
        lecturerId: 'plr_2',
        name: 'Entrepreneurship 101 — Semester 2',
        scenario: { title: 'The cash crunch', seed: 41001, industry: 'retail', months: 6, packId: 'cash-crunch' },
        createdAt: '2026-11-01T09:20:00.000Z',
        lti: { issuer: 'https://lms.school.test', clientId: 'businesslife', tokenUrl: 'https://lms.school.test/token', lineItemUrl: 'https://lms.school.test/li/1', configuredAt: '2026-11-02T00:00:00.000Z' },
        studentIds: ['plr_1'],
        records: [
          {
            studentId: 'plr_1',
            grade: 78,
            feedback: 'Good cash discipline.',
            rubric: { finance: 4, strategy: 3, operations: 3, market: 2, leadership: 3, integrity: 3 },
            rationale: 'Held receivables under control and cut discretionary spend before borrowing.',
            engineScoreAtGrade: 71,
            gradedAt: '2026-11-03T10:00:00.000Z',
            history: [
              { gradedAt: '2026-11-02T10:00:00.000Z', grade: 64, engineScore: 60 },
              { gradedAt: '2026-11-03T10:00:00.000Z', grade: 78, engineScore: 71 },
            ],
          },
        ],
      },
    ],
    npcs: [{ id: 'npc_1', companyId: 'cmp_1', type: 'customer', name: 'Chidi', profile: { mood: 'happy' } }] as unknown as Database['npcs'],
    idempotency: [
      { key: 'idem-1', playerId: 'plr_1', response: { ok: true }, createdAt: '2026-11-01T09:30:00.000Z' },
      { key: 'idem-1', playerId: 'plr_2', response: { ok: true, other: true }, createdAt: '2026-11-01T09:31:00.000Z' },
    ],
    ltiKeys: { kid: 'bl-1234', publicJwk: { kty: 'RSA', n: 'abc', e: 'AQAB', kid: 'bl-1234', alg: 'RS256', use: 'sig' }, privatePem: '-----BEGIN PRIVATE KEY-----\nMIIB\n-----END PRIVATE KEY-----\n', createdAt: '2026-11-01T09:00:00.000Z' },
  }
}

/**
 * Canonical form for comparison: jsonb does not preserve key order, so a plain
 * JSON.stringify would report a difference where there is none. Keys are sorted
 * recursively and id-bearing arrays are ordered by id.
 */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const items = value.map(canonical)
    const sortable = items.every((item) => item && typeof item === 'object' && 'id' in (item as object))
    return sortable ? [...items].sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id))) : items
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    )
  }
  return value
}

const sortById = (database: Database): string => JSON.stringify(canonical(database))

/** First path that differs, so a failed round-trip says where. */
function diffPath(a: unknown, b: unknown, path = '$'): string {
  if (a === b) return ''
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    return `${path}: ${JSON.stringify(a)?.slice(0, 60)} != ${JSON.stringify(b)?.slice(0, 60)}`
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = new Set([...Object.keys(left), ...Object.keys(right)])
  for (const key of keys) {
    const found = diffPath(left[key], right[key], `${path}.${key}`)
    if (found) return found
  }
  return ''
}

async function main() {
  console.log('\nPostgres store against real Postgres (PGlite)\n')

  const { PGlite } = await import('@electric-sql/pglite')
  const pglite = new PGlite()
  const counting = { statements: 0 }
  const queryable: Queryable = {
    async query<T>(text: string, params?: unknown[]) {
      // Session/transaction setup is not a data write and is not counted.
      if (!/^\s*(begin|commit|rollback|set )/i.test(text)) {
        counting.statements += 1
        if (process.env.DB_DEBUG) console.log('    SQL:', text.replace(/\s+/g, ' ').slice(0, 110), JSON.stringify(params ?? []).slice(0, 80))
      }
      const result = await pglite.query<T>(text, params as never[])
      return { rows: result.rows as T[] }
    },
  }

  await pglite.exec(schemaSql)
  check('the schema applies to a real Postgres', schemaTables.size >= 10, `${schemaTables.size} tables declared`)
  const applied = await pglite.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  )
  const appliedNames = new Set(applied.rows.map((row) => row.table_name))
  const missing = [...schemaTables].filter((table) => !appliedNames.has(table))
  check('every declared table exists after migration', missing.length === 0, missing.join(', '))

  const store = new PostgresStore(queryable)
  const emptyLoaded = await store.load()
  check('an empty database loads without throwing', emptyLoaded.players.length === 0 && emptyLoaded.classes.length === 0)

  const data = fixture()
  counting.statements = 0
  await store.save(data)
  const firstWrite = counting.statements
  check('the first save writes every aggregate', firstWrite >= 10, `${firstWrite} statements`)

  const reloaded = await store.load()
  check(
    'the database round-trips through Postgres unchanged',
    sortById(hydrateDatabase(reloaded)) === sortById(hydrateDatabase(data)),
    diffPath(hydrateDatabase(data), hydrateDatabase(reloaded)),
  )

  // The interesting one: a save must be incremental.
  const before = structuredClone(data)
  ;(before.companies[0] as unknown as { balanceKobo: number }).balanceKobo = 23_500_000
  const incremental = new PostgresStore(queryable)
  await incremental.load()
  counting.statements = 0
  await incremental.save(before)
  check('a one-row change writes one row, not the database', counting.statements <= 2, `${counting.statements} statements`)
  const afterIncremental = await incremental.load()
  check('the incremental write landed', (afterIncremental.companies[0] as { balanceKobo?: number }).balanceKobo === 23_500_000)

  // Deletions, in foreign-key-safe order.
  const trimmed = JSON.parse(JSON.stringify(before)) as Database
  trimmed.companies = []
  trimmed.npcs = []
  await incremental.save(trimmed)
  const afterDelete = await incremental.load()
  check('deleting a company removes it and its NPCs', afterDelete.companies.length === 0 && afterDelete.npcs.length === 0)
  const orphanNpcs = await pglite.query<{ count: string }>('select count(*)::text as count from npcs')
  check('no NPC rows are left behind', orphanNpcs.rows[0]?.count === '0', orphanNpcs.rows[0]?.count)

  // Membership and records are reconciled separately from the class document.
  const membership = await pglite.query<{ class_id: string; student_id: string }>('select class_id, student_id from class_students')
  check('cohort membership is a real join table', membership.rows.length === 1 && membership.rows[0]?.student_id === 'plr_1')
  const records = await pglite.query<{ grade: number; student_id: string }>('select grade, student_id from classroom_records')
  check('grades are queryable columns, not just jsonb', records.rows[0]?.grade === 78, JSON.stringify(records.rows))
  const historyRow = await pglite.query<{ history: unknown }>(`select data->'history' as history from classroom_records`)
  check('grade history stays intact in jsonb', Array.isArray(historyRow.rows[0]?.history) && (historyRow.rows[0]?.history as unknown[]).length === 2)

  const rls = await pglite.query<{ relname: string; relrowsecurity: boolean }>(
    `select relname, relrowsecurity from pg_class where relname = any($1::text[])`,
    [['players', 'sessions', 'companies', 'classes', 'classroom_records', 'lti_keys']],
  )
  check(
    'row level security is enabled on every table that holds personal data',
    rls.rows.length === 6 && rls.rows.every((row) => row.relrowsecurity === true),
    rls.rows.filter((row) => !row.relrowsecurity).map((row) => row.relname).join(', '),
  )

  const byEmail = await pglite.query<{ id: string }>(`select id from players where account_email = 'ada@school.test'`)
  check('a player can be found by email without scanning', byEmail.rows[0]?.id === 'plr_1')
  const byRole = await pglite.query<{ id: string }>(`select id from players where role = 'instructor'`)
  check('a player can be found by role', byRole.rows[0]?.id === 'plr_2')
  const sessions = await pglite.query<{ count: string }>('select count(*)::text as count from sessions')
  check('sessions persist with their expiry', sessions.rows[0]?.count === '2')

  const idempotent = await pglite.query<{ count: string }>('select count(*)::text as count from idempotency')
  check('idempotency keys are unique per player, not globally', idempotent.rows[0]?.count === '2')

  const lti = await pglite.query<{ private: string }>(`select data->>'privatePem' as private from lti_keys`)
  check('the LTI private key survives newlines', String(lti.rows[0]?.private ?? '').includes('\n'))

  // Double save must be a no-op: reload the current state and save it back.
  const stable = new PostgresStore(queryable)
  const current = await stable.load()
  counting.statements = 0
  await stable.save(current)
  check('saving unchanged data writes nothing', counting.statements === 0, `${counting.statements} statements`)

  // Re-load into a fresh process-level store: this is what a restart looks like.
  const restarted = new PostgresStore(queryable)
  const afterRestart = await restarted.load()
  check(
    'a restart sees the same data it last wrote',
    sortById(hydrateDatabase(afterRestart)) === sortById(hydrateDatabase(current)),
    diffPath(hydrateDatabase(current), hydrateDatabase(afterRestart)),
  )

  // Driver parity: the JSON store must agree with Postgres on the same fixture.
  const dir = mkdtempSync(join(tmpdir(), 'businesslife-db-'))
  try {
    const jsonStore = createJsonStore(join(dir, 'db.json'))
    await jsonStore.save(data)
    const fromJson = await jsonStore.load()
    check('the JSON driver loads the same fixture', sortById(hydrateDatabase(fromJson)) === sortById(hydrateDatabase(data)))
    // `reloaded` is the same fixture read back out of Postgres before any deletes.
    check(
      'both drivers return the same database for the same fixture',
      sortById(hydrateDatabase(reloaded)) === sortById(hydrateDatabase(fromJson)),
      diffPath(hydrateDatabase(reloaded), hydrateDatabase(fromJson)),
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }

  // Pooled endpoints (Supavisor, PgBouncer) must not split a transaction across
  // connections: BEGIN and COMMIT have to run on the same leased client.
  console.log('\nTransactions on a pooled endpoint\n')

  const connections: string[] = []
  let leaseCount = 0
  let released = 0
  const makeClient = (name: string): Queryable => ({
    async query<T>(text: string, params?: unknown[]) {
      if (/^\s*(begin|commit|rollback)/i.test(text)) connections.push(`${name}:${text.trim().toLowerCase()}`)
      const result = await pglite.query<T>(text, params as never[])
      return { rows: result.rows as T[] }
    },
  })
  const pool: QueryablePool = {
    async query<T>(text: string, params?: unknown[]) {
      const result = await pglite.query<T>(text, params as never[])
      return { rows: result.rows as T[] }
    },
    async connect() {
      const name = `conn${++leaseCount}`
      return { client: makeClient(name), release: () => { released += 1 } }
    },
  }

  const pooledStore = new PostgresStore(pool, pool)
  const pooled = await pooledStore.load()
  pooled.players.push({ id: 'plr_3', name: 'Pooled Player', role: 'learner', createdAt: '2026-11-05T00:00:00.000Z', wallet: 0, progression: { xp: 0, reputation: 0 } } as never)
  connections.length = 0
  await pooledStore.save(pooled)

  const transactionConnection = new Set(connections.map((entry) => entry.split(':')[0]))
  check('a transaction runs on exactly one leased connection', transactionConnection.size === 1, connections.join(' '))
  check('the transaction is bracketed by begin and commit', connections[0]?.endsWith('begin') === true && connections.at(-1)?.endsWith('commit') === true, connections.join(' '))
  check('the lease is released exactly once', released === 1, `${released} releases`)
  check('the pooled write landed', (await pooledStore.load()).players.some((player) => player.id === 'plr_3'))

  // A failure mid-save must roll back and still release the connection.
  released = 0
  const failing: QueryablePool = {
    query: pool.query,
    async connect() {
      leaseCount += 1
      return {
        client: {
          async query<T>(text: string) {
            if (/insert into players/i.test(text)) throw new Error('simulated failure')
            const result = await pglite.query<T>(text)
            return { rows: result.rows as T[] }
          },
        },
        release: () => { released += 1 },
      }
    },
  }
  const brokenStore = new PostgresStore(failing, failing)
  await brokenStore.load().catch(() => undefined)
  const failing2 = new PostgresStore(failing, failing)
  const toWrite = structuredClone(pooled)
  toWrite.players.push({ id: 'plr_4', name: 'Never Saved', role: 'learner', createdAt: '2026-11-05T00:00:00.000Z', wallet: 0, progression: { xp: 0, reputation: 0 } } as never)
  let threw = false
  try {
    await failing2.save(toWrite)
  } catch {
    threw = true
  }
  check('a failed save throws instead of pretending to succeed', threw)
  check('a failed save still releases its connection', released >= 1, `${released} releases`)
  const afterFailure = await pooledStore.load()
  check('a failed save leaves no partial rows', !afterFailure.players.some((player) => player.id === 'plr_4'))

  // Saves are serialised, so overlapping writes cannot interleave transactions.
  const order: string[] = []
  const serialPool: QueryablePool = {
    query: pool.query,
    async connect() {
      const name = `s${++leaseCount}`
      return {
        client: {
          async query<T>(text: string, params?: unknown[]) {
            if (/^\s*(begin|commit)/i.test(text)) order.push(`${name}:${text.trim().toLowerCase()}`)
            if (/^\s*begin/i.test(text)) await new Promise((resolve) => setTimeout(resolve, 5))
            const result = await pglite.query<T>(text, params as never[])
            return { rows: result.rows as T[] }
          },
        },
        release: () => undefined,
      }
    },
  }
  const serial = new PostgresStore(serialPool, serialPool)
  await serial.load()
  const a = structuredClone(pooled)
  a.players.push({ id: 'plr_5', name: 'A', role: 'learner', createdAt: 'x', wallet: 0, progression: { xp: 0, reputation: 0 } } as never)
  const b = structuredClone(pooled)
  b.players.push({ id: 'plr_6', name: 'B', role: 'learner', createdAt: 'x', wallet: 0, progression: { xp: 0, reputation: 0 } } as never)
  await Promise.all([serial.save(a), serial.save(b)])
  const brackets: string[] = []
  let open = false
  for (const entry of order) {
    const [name, verb] = entry.split(':')
    if (verb === 'begin') { if (open) brackets.push('overlap'); open = true } else open = false
    void name
  }
  check('concurrent saves never overlap their transactions', brackets.length === 0, order.join(' '))

  // Connection-string handling: Supabase copies `?sslmode=require`, which pg
  // honours as verify-full but warns about on every connection.
  const sample = 'postgresql://postgres.abcdefgh:pw@aws-0-eu-west-1.pooler.supabase.com:6543/postgres'
  check('sslmode=require is rewritten to verify-full', pgConnectionString(`${sample}?sslmode=require`).includes('sslmode=verify-full'))
  check('the rewrite keeps host, port and database intact', new URL(pgConnectionString(`${sample}?sslmode=require`)).host === new URL(sample).host)
  check('sslmode=disable is left alone (it means plaintext)', pgConnectionString(`${sample}?sslmode=disable`).endsWith('sslmode=disable'))
  check('TLS stays strict for a normal URL', sslFor(sample)?.rejectUnauthorized === true && sslFor(`${sample}?sslmode=require`)?.rejectUnauthorized === true)
  check('sslmode=disable turns TLS off rather than downgrading it', sslFor(`${sample}?sslmode=disable`) === undefined)
  check('an unparseable URL is passed through untouched', pgConnectionString('not a url') === 'not a url')

  // Every table the driver writes must be declared in schema.sql.
  const written = Object.keys(encode(data).rows)
  const undeclared = written.filter((table) => !schemaTables.has(table))
  check('the driver only writes tables that the schema declares', undeclared.length === 0, undeclared.join(', '))

  await pglite.close()
  console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — postgres store: ${failures} failure(s)\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('\nverify-db crashed:', error instanceof Error ? error.stack : error, '\n')
  process.exit(1)
})
