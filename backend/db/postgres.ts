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
import type { DatabaseStore, Queryable, Rows } from './types.js'

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

  constructor(private readonly db: Queryable) {}

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
    const encoded = encode(database)
    await this.db.query('begin')
    try {
      for (const table of INSERT_ORDER) {
        if (table === 'class_students' || table === 'classroom_records') continue
        for (const row of encoded.rows[table] ?? []) {
          const key = `${table}:${rowKey(table, row)}`
          const bytes = serialise(row)
          if (this.last.get(key) === bytes) continue
          await this.upsert(table, row)
          this.last.set(key, bytes)
        }
      }

      await this.syncMembership(encoded.classStudents)
      await this.syncRecords(encoded.classRecords)

      await this.prune(database)
      await this.db.query('commit')
    } catch (error) {
      await this.db.query('rollback')
      throw error
    }
  }

  private async upsert(table: Table, row: Record<string, unknown>) {
    const columns = Object.keys(row)
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
    const updates = columns.map((column) => `${column} = excluded.${column}`).join(', ')
    const conflict =
      table === 'idempotency'
        ? '(player_id, key)'
        : table === 'city_state' || table === 'marketplace_state'
          ? '(id)'
          : `(${table === 'sessions' ? 'token' : table === 'lti_keys' ? 'kid' : 'id'})`
    await this.db.query(
      `insert into ${table} (${columns.join(', ')}) values (${placeholders}) on conflict ${conflict} do update set ${updates}`,
      columns.map((column) => row[column]),
    )
  }

  private async syncMembership(desired: Record<string, string[]>) {
    const next = new Set<string>()
    for (const [classId, ids] of Object.entries(desired)) {
      for (const studentId of ids) {
        const key = `${classId}\u0000${studentId}`
        next.add(key)
        if (this.lastMembership.has(key)) continue
        await this.db.query('insert into class_students (class_id, student_id) values ($1, $2) on conflict do nothing', [classId, studentId])
      }
    }
    for (const key of this.lastMembership) {
      if (next.has(key)) continue
      const [classId, studentId] = key.split('\u0000')
      await this.db.query('delete from class_students where class_id = $1 and student_id = $2', [classId, studentId])
    }
    this.lastMembership = next
  }

  private async syncRecords(desired: Record<string, ClassroomRecord[]>) {
    const next = new Map<string, string>()
    for (const [classId, entries] of Object.entries(desired)) {
      for (const entry of entries) {
        const key = `${classId}\u0000${entry.studentId}`
        const bytes = canonicalJson(entry)
        next.set(key, bytes)
        if (this.lastRecords.get(key) === bytes) continue
        await this.db.query(
          `insert into classroom_records (class_id, student_id, grade, data) values ($1, $2, $3, $4)
           on conflict (class_id, student_id) do update set grade = excluded.grade, data = excluded.data, updated_at = now()`,
          [classId, entry.studentId, entry.grade ?? null, entry],
        )
      }
    }
    for (const key of this.lastRecords.keys()) {
      if (next.has(key)) continue
      const [classId, studentId] = key.split('\u0000')
      await this.db.query('delete from classroom_records where class_id = $1 and student_id = $2', [classId, studentId])
    }
    this.lastRecords = next
  }

  /** Remove rows that existed in the last save and no longer exist. */
  private async prune(database: Database) {
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
        await this.deleteRow(table, id)
        this.last.delete(key)
      }
    }
    this.lastLtiKid = database.ltiKeys?.kid ?? null
  }

  private async deleteRow(table: Table, id: string) {
    switch (table) {
      case 'sessions':
        await this.db.query('delete from sessions where token = $1', [id])
        return
      case 'idempotency': {
        const [playerId, key] = id.split('\u0000')
        await this.db.query('delete from idempotency where player_id = $1 and key = $2', [playerId, key])
        return
      }
      case 'lti_keys':
        await this.db.query('delete from lti_keys where kid = $1', [id])
        return
      default:
        await this.db.query(`delete from ${table} where id = $1`, [id])
    }
  }

  async close() {
    this.last.clear()
    this.lastRecords.clear()
    this.lastMembership.clear()
  }
}

/** `pg` Pool is only imported when a Postgres URL is actually configured. */
export async function createPgStore(connectionString: string): Promise<DatabaseStore> {
  const { Pool } = await import('pg')
  const pool = new Pool({
    connectionString,
    // Neon terminates TLS with a public CA; `sslmode=require` in the URL is
    // honoured by pg, and this keeps the same guarantee when it is not.
    ssl: /sslmode=disable/.test(connectionString) ? undefined : { rejectUnauthorized: true },
    max: Number(process.env.PGPOOL_MAX ?? 8),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  const queryable: Queryable = {
    async query<T>(text: string, params?: unknown[]) {
      const result = await pool.query(text, params as never[])
      return { rows: result.rows as T[] }
    },
  }
  const store = new PostgresStore(queryable)
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
