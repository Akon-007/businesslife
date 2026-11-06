/**
 * Server-side execution. The API bundles the browser's own engine
 * (`backend-dist/engine.mjs`, built from `src/game`) and re-runs a company from
 * its seed plus the recorded decision journal. The client's reported figures
 * are then only a claim to be checked against the server's own arithmetic.
 */
import type { RunSnapshot } from './authority.js'

interface EngineModule {
  startGame: (input: Record<string, unknown>) => unknown
  applyJournal: (state: unknown, journal: unknown[]) => unknown
  projectState: (state: unknown) => Record<string, number | string>
  performanceScore: (state: unknown) => number
  assertJournal: (value: unknown, maxOps?: number) => unknown[]
  InvalidOpErrorName?: string
}

let cached: Promise<EngineModule> | null = null

/** Load the engine bundle that ships next to the compiled server. */
export function loadEngine(): Promise<EngineModule> {
  if (!cached) {
    const url = new URL('./engine.mjs', import.meta.url).href
    cached = import(url) as Promise<EngineModule>
  }
  return cached
}

export const MAX_REPLAY_OPS = 5000

const INDUSTRIES = new Set(['saas', 'fnb', 'retail', 'logistics'])
const STRATEGIES = new Set(['product', 'sales', 'community', 'franchise'])
const BACKGROUNDS = new Set(['operator', 'builder', 'seller', 'analyst'])
const DIFFICULTIES = new Set(['gentle', 'standard', 'hard'])

export interface ReplayProfile {
  founder?: string
  firstName?: string
  lastName?: string
  nickname?: string
  avatar?: string
  accountEmail?: string
  company?: string
  industry?: string
  strategy?: string
  founderBackground?: string
  difficulty?: string
  startingCash?: number
  seed: number
}

export interface ReplayInput {
  profile: ReplayProfile | Record<string, unknown>
  journal: unknown[]
}

export interface ReplayDiff {
  field: string
  client: number | string
  replay: number | string
}

export interface ReplayVerdict {
  ok: boolean
  status: 'match' | 'mismatch' | 'error'
  error?: string
  ops: number
  months: number
  seed: number
  score: number
  projection: Record<string, number | string>
  /** Snapshot fields taken from the server's execution, ready for validation. */
  snapshot: Omit<RunSnapshot, 'seed'> | null
  diffs: ReplayDiff[]
}

function profileInput(profile: ReplayProfile): Record<string, unknown> | null {
  const seed = Math.round(Number(profile.seed))
  if (!Number.isFinite(seed) || seed <= 0) return null
  const industry = String(profile.industry ?? '').toLowerCase()
  const strategy = String(profile.strategy ?? 'product').toLowerCase()
  const founderBackground = String(profile.founderBackground ?? 'operator').toLowerCase()
  const difficulty = String(profile.difficulty ?? 'standard').toLowerCase()
  if (!INDUSTRIES.has(industry)) return null
  if (!STRATEGIES.has(strategy)) return null
  if (!BACKGROUNDS.has(founderBackground)) return null
  if (!DIFFICULTIES.has(difficulty)) return null
  const startingCash = Number(profile.startingCash)
  return {
    founder: String(profile.founder ?? 'Founder').slice(0, 80),
    firstName: String(profile.firstName ?? '').slice(0, 60),
    lastName: String(profile.lastName ?? '').slice(0, 60),
    nickname: String(profile.nickname ?? '').slice(0, 60),
    avatar: String(profile.avatar ?? 'founder-1').slice(0, 40),
    accountEmail: String(profile.accountEmail ?? '').slice(0, 120),
    company: String(profile.company ?? 'Company').slice(0, 80),
    industry,
    strategy,
    founderBackground,
    difficulty,
    seed,
    ...(Number.isFinite(startingCash) && startingCash > 0 ? { startingCash: Math.round(startingCash) } : {}),
  }
}

const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits

function snapshotFromProjection(projection: Record<string, number | string>) {
  const number = (key: string) => Number(projection[key] ?? 0)
  return {
    month: number('month'),
    day: number('day'),
    cashKobo: Math.round(number('cash') * 100),
    customers: Math.round(number('customers')),
    priceNaira: number('price'),
    revenueKobo: Math.round(number('revenue') * 100),
    expensesKobo: Math.round(number('expenses') * 100),
    valuationKobo: Math.round(number('valuation') * 100),
    quality: number('quality'),
    reputation: number('reputation'),
    morale: number('morale'),
    teamSize: Math.round(number('teamSize')),
    teamSkill: number('teamSkill'),
    inventory: 0,
    debtKobo: Math.round(number('debt') * 100),
    founderEquity: number('founderEquity'),
    status: String(projection.status ?? 'active'),
  }
}

/**
 * Re-execute a company from its seed and decision journal.
 * `expected` is the client's projection; pass it to receive a field-level diff.
 */
export async function runReplay(
  input: ReplayInput,
  expected?: Partial<Record<string, number | string>>,
  maxOps = MAX_REPLAY_OPS,
): Promise<ReplayVerdict> {
  const base: ReplayVerdict = {
    ok: false,
    status: 'error',
    ops: 0,
    months: 0,
    seed: Number(input.profile?.seed ?? 0),
    score: 0,
    projection: {},
    snapshot: null,
    diffs: [],
  }

  const profile = profileInput((input.profile ?? {}) as ReplayProfile)
  if (!profile) return { ...base, error: 'Replay profile is incomplete or invalid.' }

  let engine: EngineModule
  let journal: unknown[]
  try {
    engine = await loadEngine()
    journal = engine.assertJournal(input.journal ?? [], maxOps)
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : 'Journal rejected.' }
  }

  try {
    const started = engine.startGame(profile)
    const final = engine.applyJournal(started, journal)
    const projection = engine.projectState(final) as Record<string, number | string>
    const score = Math.round(engine.performanceScore(final))
    const diffs: ReplayDiff[] = []
    if (expected) {
      for (const key of Object.keys(projection)) {
        const claim = expected[key]
        if (claim === undefined || claim === null) continue
        const actual = projection[key]
        if (typeof actual === 'number' && typeof claim === 'number') {
          const allowed = Math.max(1, Math.abs(actual) * 0.005)
          if (Math.abs(actual - claim) > allowed) diffs.push({ field: key, client: round(claim), replay: round(actual) })
        } else if (String(actual) !== String(claim)) {
          diffs.push({ field: key, client: String(claim), replay: String(actual) })
        }
      }
    }
    return {
      ...base,
      ok: true,
      status: diffs.length ? 'mismatch' : 'match',
      seed: Number(profile.seed),
      ops: journal.length,
      months: Number(projection.month ?? 0),
      score,
      projection,
      snapshot: snapshotFromProjection(projection),
      diffs,
    }
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : 'Replay failed.' }
  }
}

/** Build the projection the client claims, from its committed snapshot. */
export function projectionFromSnapshot(snapshot: Partial<RunSnapshot>) {
  return {
    month: snapshot.month,
    day: snapshot.day,
    cash: snapshot.cashKobo === undefined ? undefined : snapshot.cashKobo / 100,
    customers: snapshot.customers,
    revenue: snapshot.revenueKobo === undefined ? undefined : snapshot.revenueKobo / 100,
    expenses: snapshot.expensesKobo === undefined ? undefined : snapshot.expensesKobo / 100,
    valuation: snapshot.valuationKobo === undefined ? undefined : snapshot.valuationKobo / 100,
    quality: snapshot.quality,
    reputation: snapshot.reputation,
    morale: snapshot.morale,
    debt: snapshot.debtKobo === undefined ? undefined : snapshot.debtKobo / 100,
    founderEquity: snapshot.founderEquity,
    status: snapshot.status,
  } as Partial<Record<string, number | string>>
}
