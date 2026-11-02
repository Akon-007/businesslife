import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { Database } from './types.js'

const file = resolve(process.cwd(), 'backend', 'data', 'businesslife.json')
const empty: Database = {
  players: [], sessions: [], companies: [],
  city: {
    districts: [
      { id: 'central', name: 'Central Business District', demand: 1.15, rentIndex: 1.3 },
      { id: 'market', name: 'Market Quarter', demand: 1.25, rentIndex: 0.85 },
      { id: 'harbour', name: 'Harbour District', demand: 0.95, rentIndex: 1.05 },
      { id: 'university', name: 'University Quarter', demand: 1.1, rentIndex: 0.7 },
    ],
    properties: [
      { id: 'central-suite', districtId: 'central', type: 'office', rent: 120000, capacity: 12, available: true },
      { id: 'market-stall', districtId: 'market', type: 'shop', rent: 65000, capacity: 5, available: true },
      { id: 'campus-pop-up', districtId: 'university', type: 'pop-up', rent: 30000, capacity: 3, available: true },
    ],
    businesses: [], events: [],
  },
  classes: [], idempotency: [], npcs: [], marketplace: { businesses: [], listings: [], follows: [], messages: [], enquiries: [], quotations: [], orders: [] },
}

export async function loadDatabase(): Promise<Database> {
  try {
    const saved = JSON.parse(await readFile(file, 'utf8')) as Partial<Database>
    return { ...structuredClone(empty), ...saved, city: { ...structuredClone(empty.city), ...(saved.city ?? {}) }, idempotency: saved.idempotency ?? [], classes: saved.classes ?? [], npcs: saved.npcs ?? [], marketplace: { ...structuredClone(empty.marketplace), ...(saved.marketplace ?? {}) } }
  } catch {
    return structuredClone(empty)
  }
}

export async function saveDatabase(database: Database) {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(database, null, 2), 'utf8')
}

export function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function now() {
  return new Date().toISOString()
}
