/**
 * The empty database and the hydration rules, shared by both drivers.
 *
 * Hydration used to live in `backend/store.ts` next to the file IO. It is a
 * property of the *shape*, not of the storage medium, so it belongs here — and
 * that keeps the two drivers from drifting apart in what they return.
 */
import type { Database } from '../types.js'

export function emptyDatabase(): Database {
  return {
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
}

/** Fill in anything an older save (or an older row) is missing. */
export function hydrateDatabase(saved: Partial<Database>, base: Database = emptyDatabase()): Database {
  const merged: Database = {
    ...base,
    ...saved,
    city: { ...base.city, ...(saved.city ?? {}) },
    idempotency: saved.idempotency ?? base.idempotency,
    classes: saved.classes ?? base.classes,
    npcs: saved.npcs ?? base.npcs,
    marketplace: { ...base.marketplace, ...(saved.marketplace ?? {}) },
    players: saved.players ?? base.players,
    sessions: saved.sessions ?? base.sessions,
    companies: saved.companies ?? base.companies,
  }
  merged.players = merged.players.map((player) => ({ ...player, role: player.role ?? 'learner' }))
  merged.companies = merged.companies.map((company) => ({
    ...company,
    auditChain: company.auditChain ?? [],
    aiTraces: company.aiTraces ?? [],
    authorityViolations: company.authorityViolations ?? [],
  }))
  merged.classes = merged.classes.map((classroom) => ({ ...classroom, records: classroom.records ?? [] }))
  return merged
}
