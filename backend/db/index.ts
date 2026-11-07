/**
 * Driver selection.
 *
 * `DATABASE_URL` (or `SUPABASE_DB_URL`, or Neon's `NEON_DATABASE_URL`) switches
 * the API to Postgres. Nothing else changes: routes still call
 * `saveDatabase(database)`.
 */
import { createJsonStore } from './json.js'
import { createPgStore } from './postgres.js'
import type { DatabaseStore } from './types.js'

let cached: DatabaseStore | null = null

/**
 * Supabase sets no variable for you, so accept the names people actually use:
 * `DATABASE_URL`, the Supabase-style `SUPABASE_DB_URL`, and Neon's
 * `NEON_DATABASE_URL` for older deployments.
 */
export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? process.env.NEON_DATABASE_URL ?? ''
  return url.trim() ? url.trim() : null
}

export async function getStore(): Promise<DatabaseStore> {
  if (cached) return cached
  const url = databaseUrl()
  cached = url ? await createPgStore(url) : createJsonStore()
  return cached
}

/** Only used by tests and by `npm run db:*` scripts. */
export function setStore(store: DatabaseStore | null) {
  cached = store
}

export function storeDriver(): 'json' | 'postgres' {
  return cached?.driver ?? (databaseUrl() ? 'postgres' : 'json')
}
