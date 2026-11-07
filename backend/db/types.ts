/**
 * Storage seams.
 *
 * The API mutates one in-memory `Database` and calls `saveDatabase(db)` at the
 * points where durability matters. This module keeps that shape and puts the
 * choice of driver underneath it, so no route had to learn about SQL.
 */
import type { Database } from '../types.js'

/**
 * The only thing the Postgres driver needs from a client. `pg`'s `Pool` and
 * `PoolClient` satisfy this; so does the WASM Postgres used in `verify:db`,
 * which is what lets the SQL be tested for real without a server.
 */
export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>
}

/**
 * A single connection leased from a pool. Transactions must run on one lease:
 * `pool.query()` may hand out a different backend connection per call, which
 * would silently split a BEGIN and a COMMIT across two sessions.
 */
export interface ClientLease {
  client: Queryable
  release(error?: Error): void
}

export interface QueryablePool extends Queryable {
  connect(): Promise<ClientLease>
}

export interface DatabaseStore {
  readonly driver: 'json' | 'postgres'
  load(): Promise<Database>
  save(database: Database): Promise<void>
  close?(): Promise<void>
}

/** Rows are the unit of durability: one row per aggregate. */
export type Rows = Record<string, Array<Record<string, unknown>>>
