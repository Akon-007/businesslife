/**
 * JSON file store — the default.
 *
 * It is what every developer and every test runs against: no service to start,
 * no credentials, and the file is easy to inspect with `jq`. It stays supported
 * after Postgres arrives because "run the whole app with no database" is a
 * useful property, not a temporary scaffold.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { emptyDatabase, hydrateDatabase } from './shape.js'
import type { Database } from '../types.js'
import type { DatabaseStore } from './types.js'

export function createJsonStore(file = resolve(process.cwd(), 'backend', 'data', 'businesslife.json')): DatabaseStore {
  return {
    driver: 'json',
    async load(): Promise<Database> {
      try {
        return hydrateDatabase(JSON.parse(await readFile(file, 'utf8')) as Partial<Database>)
      } catch {
        return emptyDatabase()
      }
    },
    async save(database: Database) {
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, JSON.stringify(database, null, 2), 'utf8')
    },
  }
}
