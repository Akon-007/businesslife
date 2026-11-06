/**
 * The decision journal. Every state-changing player action is recorded as a
 * small, validated operation so the server can re-execute the run from the seed
 * and the decisions alone — the client's reported numbers are never the source
 * of truth when a journal is present.
 */
import {
  acceptOffer,
  acknowledgeMissionEvidence,
  advanceDay,
  declineOffers,
  fireEmployee,
  hireCandidate,
  offerRound,
  openBranch,
  payAllBills,
  payBill,
  pushDeal,
  refreshCandidates,
  repayDebt,
  resolveCrisis,
  selectSupplier,
  setMarketing,
  setMarketingChannel,
  setMarketingMix,
  setPrice,
  setProduct,
  setRestock,
  setTraining,
  takeLoan,
  toggleDealDiscount,
} from './engine'
import type { GameOp, GameState } from './types'

export type GameOpType = GameOp['op']

export const OP_TYPES: readonly GameOpType[] = [
  'advanceDay',
  'resolveCrisis',
  'hireCandidate',
  'fireEmployee',
  'refreshCandidates',
  'offerRound',
  'acceptOffer',
  'declineOffers',
  'takeLoan',
  'repayDebt',
  'setPrice',
  'setMarketing',
  'setMarketingChannel',
  'setMarketingMix',
  'setProduct',
  'setTraining',
  'selectSupplier',
  'setRestock',
  'toggleDealDiscount',
  'pushDeal',
  'openBranch',
  'payBill',
  'payAllBills',
  'missionEvidence',
] as const

/** Numeric ceilings for journal arguments. Anything outside is rejected. */
const LIMITS: Record<string, { min: number; max: number }> = {
  amount: { min: 0, max: 500_000_000 },
  price: { min: 0, max: 5_000_000 },
  share: { min: 0, max: 1 },
  months: { min: 0, max: 12 },
}

/** Operations that are meaningless without a target id. */
const REQUIRED_IDS: Partial<Record<GameOpType, readonly string[]>> = {
  resolveCrisis: ['optionId'],
  hireCandidate: ['candidateId'],
  fireEmployee: ['employeeId'],
  acceptOffer: ['offerId'],
  selectSupplier: ['supplierId'],
  toggleDealDiscount: ['dealId'],
  pushDeal: ['dealId'],
  openBranch: ['branchId'],
  payBill: ['billId'],
  setMarketingChannel: ['channelId'],
}

const ID_MAX = 80
const MAX_EVIDENCE = 24

export class InvalidOpError extends Error {}

/** Validate one operation from an untrusted source. Throws InvalidOpError. */
export function assertOp(value: unknown, index = 0): GameOp {
  if (!value || typeof value !== 'object') throw new InvalidOpError(`op ${index} is not an object`)
  const raw = value as Record<string, unknown>
  const op = raw.op
  if (typeof op !== 'string' || !OP_TYPES.includes(op as GameOpType)) {
    throw new InvalidOpError(`op ${index} has an unknown type`)
  }
  const args = (raw.args ?? {}) as Record<string, unknown>
  if (typeof args !== 'object' || Array.isArray(args)) throw new InvalidOpError(`op ${index} has invalid args`)

  const numericKeys: Array<keyof typeof LIMITS> = ['amount', 'price', 'months', 'share']
  for (const key of numericKeys) {
    if (args[key] === undefined) continue
    const number = Number(args[key])
    const limit = LIMITS[key]
    if (!Number.isFinite(number) || number < limit.min || number > limit.max) {
      throw new InvalidOpError(`op ${index} (${op}) ${key} out of range`)
    }
  }

  const idKeys = ['optionId', 'candidateId', 'employeeId', 'offerId', 'supplierId', 'dealId', 'branchId', 'billId', 'channelId'] as const
  for (const key of idKeys) {
    if (args[key] === undefined) continue
    const id = args[key]
    if (typeof id !== 'string' || id.length === 0 || id.length > ID_MAX) {
      throw new InvalidOpError(`op ${index} (${op}) ${key} is not a valid id`)
    }
  }

  for (const key of REQUIRED_IDS[op as GameOpType] ?? []) {
    const id = args[key]
    if (typeof id !== 'string' || id.length === 0 || id.length > ID_MAX) {
      throw new InvalidOpError(`op ${index} (${op}) is missing a valid ${key}`)
    }
  }

  if (op === 'setMarketingMix') {
    const keys = ['social', 'search', 'content', 'events'] as const
    if (!keys.some((key) => args[key] !== undefined)) {
      throw new InvalidOpError(`op ${index} (setMarketingMix) has no channel shares`)
    }
    for (const key of keys) {
      if (args[key] === undefined) continue
      const value = Number(args[key])
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new InvalidOpError(`op ${index} (setMarketingMix) ${key} out of range`)
      }
    }
  }

  if (op === 'missionEvidence') {
    const evidence = args.evidence
    if (!Array.isArray(evidence) || evidence.length > MAX_EVIDENCE) {
      throw new InvalidOpError(`op ${index} (missionEvidence) evidence must be a short array`)
    }
    for (const item of evidence) {
      if (typeof item !== 'string' || item.length > ID_MAX) {
        throw new InvalidOpError(`op ${index} (missionEvidence) has an invalid entry`)
      }
    }
  }

  return { op: op as GameOpType, args } as GameOp
}

/** Validate a whole journal. Throws on the first bad operation. */
export function assertJournal(value: unknown, maxOps = 5000): GameOp[] {
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) throw new InvalidOpError('journal must be an array')
  if (value.length > maxOps) throw new InvalidOpError(`journal exceeds ${maxOps} operations`)
  return value.map((entry, index) => assertOp(entry, index))
}

/** Apply one validated operation. Deterministic: same state + op → same state. */
export function applyOp(state: GameState, op: GameOp): GameState {
  const args = (op.args ?? {}) as Record<string, unknown>
  switch (op.op) {
    case 'advanceDay':
      return advanceDay(state)
    case 'resolveCrisis':
      return resolveCrisis(state, String(args.optionId ?? ''))
    case 'hireCandidate':
      return hireCandidate(state, String(args.candidateId ?? ''))
    case 'fireEmployee':
      return fireEmployee(state, String(args.employeeId ?? ''))
    case 'refreshCandidates':
      return refreshCandidates(state)
    case 'offerRound':
      return offerRound(state)
    case 'acceptOffer':
      return acceptOffer(state, String(args.offerId ?? ''))
    case 'declineOffers':
      return declineOffers(state)
    case 'takeLoan':
      return takeLoan(state, Number(args.amount ?? 0))
    case 'repayDebt':
      return repayDebt(state, Number(args.amount ?? 0))
    case 'setPrice':
      return setPrice(state, Number(args.price ?? state.price))
    case 'setMarketing':
      return setMarketing(state, Number(args.amount ?? 0))
    case 'setMarketingChannel':
      return setMarketingChannel(state, String(args.channelId ?? ''), Number(args.share ?? 0))
    case 'setMarketingMix':
      return setMarketingMix(state, {
        social: args.social === undefined ? undefined : Number(args.social),
        search: args.search === undefined ? undefined : Number(args.search),
        content: args.content === undefined ? undefined : Number(args.content),
        events: args.events === undefined ? undefined : Number(args.events),
      })
    case 'setProduct':
      return setProduct(state, Number(args.amount ?? 0))
    case 'setTraining':
      return setTraining(state, Number(args.amount ?? 0))
    case 'selectSupplier':
      return selectSupplier(state, String(args.supplierId ?? ''))
    case 'setRestock':
      return setRestock(state, Number(args.months ?? 0))
    case 'toggleDealDiscount':
      return toggleDealDiscount(state, String(args.dealId ?? ''))
    case 'pushDeal':
      return pushDeal(state, String(args.dealId ?? ''))
    case 'openBranch':
      return openBranch(state, String(args.branchId ?? ''))
    case 'payBill':
      return payBill(state, String(args.billId ?? ''))
    case 'payAllBills':
      return payAllBills(state)
    case 'missionEvidence':
      return acknowledgeMissionEvidence(state, (args.evidence as string[]) ?? [])
    default:
      return state
  }
}

/** Replay a whole journal from a fresh state. */
export function applyJournal(state: GameState, journal: GameOp[]): GameState {
  let current = state
  for (const op of journal) current = applyOp(current, op)
  return current
}

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

export interface RunProjection {
  month: number
  day: number
  status: string
  cash: number
  customers: number
  price: number
  quality: number
  reputation: number
  morale: number
  valuation: number
  debt: number
  teamSize: number
  teamSkill: number
  receivables: number
  invoicesOpen: number
  emergencyLoans: number
  founderEquity: number
  revenue: number
  expenses: number
}

/** The economically meaningful view of a state — ids and log text excluded. */
export function projectState(state: GameState): RunProjection {
  const last = state.history[state.history.length - 1]
  return {
    month: state.month,
    day: state.day,
    status: state.status,
    cash: round(state.cash),
    customers: Math.round(state.customers),
    price: round(state.price),
    quality: round(state.quality),
    reputation: round(state.reputation),
    morale: round(state.morale),
    valuation: Math.round(state.valuation),
    debt: Math.round(state.debt ?? 0),
    teamSize: state.team.length,
    teamSkill: round(state.team.reduce((total, member) => total + member.skill * (member.level ?? 1), 0), 3),
    receivables: Math.round(state.receivables ?? 0),
    invoicesOpen: (state.invoices ?? []).filter((invoice) => invoice.status !== 'paid').length,
    emergencyLoans: state.emergencyLoans,
    founderEquity: round(state.founderEquity ?? 100),
    revenue: Math.round(last?.revenue ?? 0),
    expenses: Math.round(last?.costs ?? 0),
  }
}

export interface ProjectionDiff {
  field: string
  client: number | string
  replay: number | string
}

/**
 * Compare a projection with a client-reported one. `tolerance` is a relative
 * allowance for floating-point noise (default 0.1%).
 */
export function diffProjection(
  client: Partial<RunProjection>,
  replay: RunProjection,
  tolerance = 0.001,
): ProjectionDiff[] {
  const diffs: ProjectionDiff[] = []
  for (const key of Object.keys(replay) as Array<keyof RunProjection>) {
    const expected = client[key]
    if (expected === undefined || expected === null) continue
    const actual = replay[key]
    if (typeof actual === 'number' && typeof expected === 'number') {
      const allowed = Math.max(1, Math.abs(actual) * tolerance)
      if (Math.abs(actual - expected) > allowed) diffs.push({ field: key, client: expected, replay: actual })
      continue
    }
    if (String(actual) !== String(expected)) diffs.push({ field: key, client: String(expected), replay: String(actual) })
  }
  return diffs
}
