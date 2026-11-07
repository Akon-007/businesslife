/**
 * Postgres store (Neon in production, WASM Postgres in `verify:db`).
 *
 * The domain is one big object graph, so the honest mapping is:
 *   - one row per aggregate, the object in `jsonb`
 *   - the fields that are actually queried (`account_email`, `role`,
 *     `player_id`, `sector`, `status`, class membership, grades) lifted into
 *     real columns with indexes
 *
 * Writes are incremental on purpose: the driver remembers the serialised form of
 * every row it has written, and a save only touches rows whose bytes changed,
 * plus deletes for rows that disappeared. A month commit that changes one
 * company therefore writes one row, not the whole database.
 *
 * Everything runs in a single transaction in dependency order, so a failure
 * halfway through cannot leave a company without its owner.
 */
import type { ClassRoom, ClassroomRecord, Database, Id, Player, Session } from '../types.js'
import type { ClientLease, DatabaseStore, Queryable, QueryablePool, Rows } from './types.js'

const TABLES = [
  'players',
  'sessions',
  'companies',
  'npcs',
  'classes',
  'class_students',
  'classroom_records',
  'idempotency',
  'city_state',
  'marketplace_state',
  'lti_keys',
] as const

export type Table = (typeof TABLES)[number]

/** Dependency order: parents before children on insert, reverse on delete. */
const INSERT_ORDER: Table[] = [
  'players',
  'companies',
  'npcs',
  'classes',
  'class_students',
  'classroom_records',
  'sessions',
  'idempotency',
  'city_state',
  'marketplace_state',
  'lti_keys',
]

const singleton = 'default'

/**
 * A single save must never hang a pooled connection indefinitely. Read per call,
 * not at import time, so a `.env` loaded later still applies.
 */
const statementTimeoutMs = () => Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 20_000)

/**
 * Flatten the in-memory database into rows. `classRecords` and `classStudents`
 * are carried alongside because they have compound keys and are reconciled
 * separately from the class document.
 */
export function encode(database: Database): {
  rows: Rows
  classStudents: Record<string, string[]>
  classRecords: Record<string, ClassroomRecord[]>
} {
  const rows: Rows = {
    players: database.players.map((player: Player) => ({
      id: player.id,
      role: player.role,
      data: player,
    })),
    sessions: database.sessions.map((session: Session) => ({
      token: session.token,
      player_id: session.playerId,
      expires_at: session.expiresAt,
      data: session,
    })),
    companies: database.companies.map((company) => ({
      id: company.id,
      player_id: company.playerId,
      sector: company.sector ?? '',
      status: company.status ?? 'active',
      data: company,
    })),
    npcs: database.npcs.map((npc) => ({
      id: npc.id,
      company_id: npc.companyId,
      data: npc,
    })),
    classes: database.classes.map((classroom) => {
      const { records: _records, studentIds: _studentIds, ...rest } = classroom
      return {
        id: classroom.id,
        lecturer_id: classroom.lecturerId,
        name: classroom.name,
        data: rest,
      }
    }),
    class_students: [],
    classroom_records: [],
    idempotency: database.idempotency.map((entry) => ({
      player_id: entry.playerId,
      key: entry.key,
      data: entry,
    })),
    city_state: [{ id: singleton, data: database.city }],
    marketplace_state: [{ id: singleton, data: database.marketplace }],
    lti_keys: database.ltiKeys ? [{ kid: database.ltiKeys.kid, data: database.ltiKeys }] : [],
  }

  const classStudents: Record<string, string[]> = {}
  const classRecords: Record<string, ClassroomRecord[]> = {}
  for (const classroom of database.classes) {
    classStudents[classroom.id] = classroom.studentIds
    classRecords[classroom.id] = classroom.records ?? []
  }
  return { rows, classStudents, classRecords }
}

/** Stable key for a row, used for dirty tracking and for deletions. */
export function rowKey(table: Table, row: Record<string, unknown>): string {
  switch (table) {
    case 'sessions':
      return String(row.token)
    case 'idempotency':
      return `${row.player_id}\u0000${row.key}`
    case 'class_students':
      return `${row.class_id}\u0000${row.student_id}`
    case 'classroom_records':
      return `${row.class_id}\u0000${row.student_id}`
    case 'city_state':
    case 'marketplace_state':
      return singleton
    case 'lti_keys':
      return String(row.kid)
    default:
      return String(row.id)
  }
}

/**
 * Canonical JSON for dirty tracking.
 *
 * jsonb does not preserve key order, so comparing raw `JSON.stringify` output
 * would rewrite every row once after each restart. Sorting keys recursively
 * compares the value, not its spelling.
 */
export const canonicalJson = (value: unknown): string => {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === 'object') {
      return Object.fromEntries(
        Object.keys(node as Record<string, unknown>)
          .sort()
          .map((key) => [key, walk((node as Record<string, unknown>)[key])]),
      )
    }
    return node
  }
  return JSON.stringify(walk(value))
}

const serialise = (row: Record<string, unknown>) => canonicalJson(row)

export class PostgresStore implements DatabaseStore {
  readonly driver = 'postgres' as const
  private last = new Map<string, string>()
  private lastRecords = new Map<string, string>()
  private lastMembership = new Set<string>()
  private lastLtiKid: string | null = null
  /** Saves are serialised so two transactions can never interleave. */
  private queue: Promise<void> = Promise.resolve()

  /**
   * `pool` is optional: with it, every save runs on one leased connection (the
   * only correct way with Supabase's Supavisor or any PgBouncer-style pooler).
   * Without it, the single `db` handle is used — which is what the WASM driver in
   * `verify:db` provides.
   */
  constructor(
    private readonly db: Queryable,
    private readonly pool?: QueryablePool,
  ) {}

  async load(): Promise<Database> {
    const select = async <T>(table: Table) => (await this.db.query<{ data: T }>(`select data from ${table}`)).rows
    const [players, sessions, companies, npcs, classes, students, records, idempotency, city, marketplace, lti] = await Promise.all([
      select<Player>('players'),
      select<Session>('sessions'),
      select('companies'),
      select('npcs'),
      select('classes'),
      this.db.query<{ class_id: string; student_id: string }>('select class_id, student_id from class_students'),
      this.db.query<{ class_id: string; student_id: string; data: ClassroomRecord }>('select class_id, student_id, data from classroom_records'),
      select('idempotency'),
      select<Database['city']>('city_state'),
      select<Database['marketplace']>('marketplace_state'),
      select<Database['ltiKeys']>('lti_keys'),
    ])

    const membership = new Map<string, string[]>()
    for (const row of students.rows) {
      membership.set(row.class_id, [...(membership.get(row.class_id) ?? []), row.student_id])
    }
    const recordMap = new Map<string, ClassroomRecord[]>()
    for (const row of records.rows) {
      recordMap.set(row.class_id, [...(recordMap.get(row.class_id) ?? []), row.data])
    }

    const database: Database = {
      players: players.map((row) => row.data),
      sessions: sessions.map((row) => row.data),
      companies: companies.map((row) => row.data) as Database['companies'],
      npcs: npcs.map((row) => row.data) as Database['npcs'],
      classes: classes.map((row) => {
        const classroom = row.data as unknown as ClassRoom
        return {
          ...classroom,
          studentIds: (membership.get(classroom.id) ?? []).slice().sort(),
          records: recordMap.get(classroom.id) ?? [],
        }
      }),
      idempotency: idempotency.map((row) => row.data) as Database['idempotency'],
      city: city[0]?.data ?? ({} as Database['city']),
      marketplace: marketplace[0]?.data ?? ({} as Database['marketplace']),
      ltiKeys: lti[0]?.data,
    }

    // Seed the dirty-tracking cache so the next save only writes real changes.
    const encoded = encode(database)
    for (const table of TABLES) {
      if (table === 'class_students' || table === 'classroom_records') continue
      for (const row of encoded.rows[table] ?? []) {
        this.last.set(`${table}:${rowKey(table, row)}`, serialise(row))
      }
    }
    for (const [classId, ids] of Object.entries(encoded.classStudents)) {
      for (const id of ids) this.lastMembership.add(`${classId}\u0000${id}`)
    }
    for (const [classId, entries] of Object.entries(encoded.classRecords)) {
      for (const entry of entries) this.lastRecords.set(`${classId}\u0000${entry.studentId}`, canonicalJson(entry))
    }
    this.lastLtiKid = database.ltiKeys?.kid ?? null

    return database
  }

  async save(database: Database): Promise<void> {
    const run = this.queue.then(() => this.write(database))
    // Keep the chain alive even when a save rejects, or every later save would
    // inherit the rejection.
    this.queue = run.catch(() => undefined)
    return run
  }

  private async write(database: Database): Promise<void> {
    const encoded = encode(database)
    const lease: ClientLease | null = this.pool ? await this.pool.connect() : null
    const runner: Queryable = lease ? lease.client : this.db
    try {
      await runner.query('begin')
      // `set local` is transaction-scoped, so it is safe on Supavisor's
      // transaction mode (port 6543) where session state does not survive.
      await runner.query(`set local statement_timeout = '${statementTimeoutMs()}ms'`)
      for (const table of INSERT_ORDER) {
        if (table === 'class_students' || table === 'classroom_records') continue
        for (const row of encoded.rows[table] ?? []) {
          const key = `${table}:${rowKey(table, row)}`
          const bytes = serialise(row)
          if (this.last.get(key) === bytes) continue
          await this.upsert(runner, table, row)
          this.last.set(key, bytes)
        }
      }

      await this.syncMembership(runner, encoded.classStudents)
      await this.syncRecords(runner, encoded.classRecords)

      await this.prune(runner, database)
      await runner.query('commit')
      lease?.release()
    } catch (error) {
      try {
        await runner.query('rollback')
      } catch {
        /* the connection may already be gone */
      }
      lease?.release(error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  private async upsert(runner: Queryable, table: Table, row: Record<string, unknown>) {
    const columns = Object.keys(row)
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
    const updates = columns.map((column) => `${column} = excluded.${column}`).join(', ')
    const conflict =
      table === 'idempotency'
        ? '(player_id, key)'
        : table === 'city_state' || table === 'marketplace_state'
          ? '(id)'
          : `(${table === 'sessions' ? 'token' : table === 'lti_keys' ? 'kid' : 'id'})`
    await runner.query(
      `insert into ${table} (${columns.join(', ')}) values (${placeholders}) on conflict ${conflict} do update set ${updates}`,
      columns.map((column) => row[column]),
    )
  }

  private async syncMembership(runner: Queryable, desired: Record<string, string[]>) {
    const next = new Set<string>()
    for (const [classId, ids] of Object.entries(desired)) {
      for (const studentId of ids) {
        const key = `${classId}\u0000${studentId}`
        next.add(key)
        if (this.lastMembership.has(key)) continue
        await runner.query('insert into class_students (class_id, student_id) values ($1, $2) on conflict do nothing', [classId, studentId])
      }
    }
    for (const key of this.lastMembership) {
      if (next.has(key)) continue
      const [classId, studentId] = key.split('\u0000')
      await runner.query('delete from class_students where class_id = $1 and student_id = $2', [classId, studentId])
    }
    this.lastMembership = next
  }

  private async syncRecords(runner: Queryable, desired: Record<string, ClassroomRecord[]>) {
    const next = new Map<string, string>()
    for (const [classId, entries] of Object.entries(desired)) {
      for (const entry of entries) {
        const key = `${classId}\u0000${entry.studentId}`
        const bytes = canonicalJson(entry)
        next.set(key, bytes)
        if (this.lastRecords.get(key) === bytes) continue
        await runner.query(
          `insert into classroom_records (class_id, student_id, grade, data) values ($1, $2, $3, $4)
           on conflict (class_id, student_id) do update set grade = excluded.grade, data = excluded.data, updated_at = now()`,
          [classId, entry.studentId, entry.grade ?? null, entry],
        )
      }
    }
    for (const key of this.lastRecords.keys()) {
      if (next.has(key)) continue
      const [classId, studentId] = key.split('\u0000')
      await runner.query('delete from classroom_records where class_id = $1 and student_id = $2', [classId, studentId])
    }
    this.lastRecords = next
  }

  /** Remove rows that existed in the last save and no longer exist. */
  private async prune(runner: Queryable, database: Database) {
    const present = new Map<Table, Set<string>>()
    const encoded = encode(database)
    for (const table of TABLES) {
      if (table === 'class_students' || table === 'classroom_records') continue
      present.set(table, new Set((encoded.rows[table] ?? []).map((row) => rowKey(table, row))))
    }

    // Children first, so foreign keys never dangle.
    for (const table of [...INSERT_ORDER].reverse()) {
      const desired = present.get(table) ?? new Set<string>()
      for (const key of [...this.last.keys()]) {
        if (!key.startsWith(`${table}:`)) continue
        const id = key.slice(table.length + 1)
        if (desired.has(id)) continue
        await this.deleteRow(runner, table, id)
        this.last.delete(key)
      }
    }
    this.lastLtiKid = database.ltiKeys?.kid ?? null
  }

  private async deleteRow(runner: Queryable, table: Table, id: string) {
    switch (table) {
      case 'sessions':
        await runner.query('delete from sessions where token = $1', [id])
        return
      case 'idempotency': {
        const [playerId, key] = id.split('\u0000')
        await runner.query('delete from idempotency where player_id = $1 and key = $2', [playerId, key])
        return
      }
      case 'lti_keys':
        await runner.query('delete from lti_keys where kid = $1', [id])
        return
      default:
        await runner.query(`delete from ${table} where id = $1`, [id])
    }
  }

  async close() {
    this.last.clear()
    this.lastRecords.clear()
    this.lastMembership.clear()
  }
}

/**
 * Supabase's dashboard copies `?sslmode=require`. `pg` upgrades that to
 * verify-full but prints a security warning on every connection, which looks
 * like a problem in our logs. Rewrite it to what actually happens.
 *
 * `sslmode=disable` is left alone: it means plaintext, deliberately.
 *
 * Keep in sync with the copy in scripts/db-{migrate,smoke}.mjs — those run
 * without a build step and cannot import this module.
 */
export function pgConnectionString(url: string): string {
  try {
    const parsed = new URL(url)
    const mode = parsed.searchParams.get('sslmode')
    if (mode && mode !== 'disable' && mode !== 'verify-full') {
      parsed.searchParams.set('sslmode', 'verify-full')
      parsed.searchParams.delete('uselibpqcompat')
      return parsed.toString()
    }
  } catch {
    // Not a URL we can parse — let `pg` report the real problem.
  }
  return url
}

/** `sslmode=disable` means plaintext; anything else verifies the chain. */
export function sslFor(url: string): { rejectUnauthorized: boolean } | undefined {
  return /(^|[?&])sslmode=disable(&|$)/.test(url)
    ? undefined
    : { rejectUnauthorized: process.env.DB_SSL_INSECURE !== 'true' }
}

/** `pg` Pool is only imported when a Postgres URL is actually configured. */
export async function createPgStore(connectionString: string): Promise<DatabaseStore> {
  const { Pool } = await import('pg')
  const pool = new Pool({
    connectionString: pgConnectionString(connectionString),
    // Supabase (and Neon) present a publicly-trusted certificate, so this is the
    // strict default. `DB_SSL_INSECURE=true` exists for a self-signed proxy and
    // says so in the boot log rather than silently downgrading in code.
    ssl: sslFor(connectionString),
    max: Number(process.env.PGPOOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Shows up in Supabase's connection logs, which makes a stray client obvious.
    application_name: 'businesslife-api',
  })
  const queryable: Queryable = {
    async query<T>(text: string, params?: unknown[]) {
      const result = await pool.query(text, params as never[])
      return { rows: result.rows as T[] }
    },
  }
  const pooled: QueryablePool = {
    query: queryable.query,
    async connect() {
      const client = await pool.connect()
      return {
        client: {
          async query<T>(text: string, params?: unknown[]) {
            const result = await client.query(text, params as never[])
            return { rows: result.rows as T[] }
          },
        },
        release: (error?: Error) => client.release(error as never),
      }
    },
  }
  const store = new PostgresStore(queryable, pooled)
  return {
    driver: 'postgres',
    load: () => store.load(),
    save: (database) => store.save(database),
    close: async () => {
      await store.close()
      await pool.end()
    },
  }
}

export type { Id }
