/**
 * Driver selection.
 *
 * `DATABASE_URL` (or `NEON_DATABASE_URL`, which Neon sets for you in some
 * environments) switches the API to Postgres. Nothing else changes: routes still
 * call `saveDatabase(database)`.
 */
import { createJsonStore } from './json.js'
import { createPgStore } from './postgres.js'
import type { DatabaseStore } from './types.js'

let cached: DatabaseStore | null = null

export function databaseUrl(): string | null {
  const url = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL ?? ''
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
