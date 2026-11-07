/**
 * Persistence facade.
 *
 * The rest of the server only ever calls `loadDatabase()` and `saveDatabase()`;
 * whether those bytes land in a JSON file or in Neon is decided once, by
 * `DATABASE_URL`, in `backend/db/index.ts`.
 */
import type { Database } from './types.js'
import { getStore, storeDriver } from './db/index.js'

export async function loadDatabase(): Promise<Database> {
  return (await getStore()).load()
}

export async function saveDatabase(database: Database) {
  await (await getStore()).save(database)
}

export { storeDriver }

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function now() {
  return new Date().toISOString()
}
