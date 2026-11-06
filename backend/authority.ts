import { createHash } from 'node:crypto'
import type { AuditRecord, AuthorityState, AuthorityViolation, Company } from './types.js'

/**
 * Server authority for protected game state.
 *
 * The simulation still runs in the client engine, but the server is the source
 * of truth for the fields that matter for assessment and integrity:
 *   - score (always computed here, never accepted from the client)
 *   - month / day progression (no time travel, no skipped months)
 *   - cash, customers, revenue, expenses, valuation (bounded and reconciled)
 *   - a tamper-evident hash chain over every consequential action
 *
 * Commits that fall outside physical/economic plausibility are corrected to the
 * canonical value and recorded as violations, so a hand-edited client save can
 * never produce a forged score or an invented balance.
 */

export const AUTHORITY_VERSION = 1
const NAIRA = 100
const MAX_KOBO = 1e16 // ₦100bn hard ceiling on any single figure
const MAX_MONTH = 1200

export interface RunSnapshot {
  /** Seed the run was generated with. Recorded so instructors can replay it. */
  seed?: number
  month: number
  day?: number
  cashKobo: number
  customers: number
  priceNaira?: number
  revenueKobo: number
  expensesKobo: number
  valuationKobo: number
  quality?: number
  reputation?: number
  morale?: number
  teamSize?: number
  teamSkill?: number
  inventory?: number
  debtKobo?: number
  founderEquity?: number
  status?: string
}

export interface CommitResult {
  canonical: RunSnapshot
  authority: AuthorityState
  violations: AuthorityViolation[]
  tampered: boolean
  score: number
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toInt = (value: unknown, fallback = 0) => {
  if (!isFiniteNumber(value)) return fallback
  return Math.round(value)
}

export function emptyAuthority(): AuthorityState {
  const at = new Date().toISOString()
  return {
    version: AUTHORITY_VERSION,
    score: 0,
    month: 0,
    day: 1,
    cashKobo: 0,
    customers: 0,
    revenueKobo: 0,
    expensesKobo: 0,
    valuationKobo: 0,
    priceNaira: 0,
    quality: 50,
    reputation: 50,
    morale: 70,
    teamSkill: 0,
    status: 'active',
    commits: 0,
    updatedAt: at,
  }
}

export function authorityOf(company: Company): AuthorityState {
  return company.authority ?? emptyAuthority()
}

/**
 * Scoring v2 — bounded, evidence-weighted, comparable across cohorts.
 *
 * The original formula divided valuation by 1,500, which saturated at 100/100
 * for any company worth more than ~₦10m and made every grade meaningless.
 * Each component here is normalised against a stated benchmark and capped, so
 * the score moves with operating evidence rather than with one big number.
 */
export function scoreSnapshot(snapshot: RunSnapshot): number {
  const revenue = snapshot.revenueKobo / NAIRA
  const expenses = snapshot.expensesKobo / NAIRA
  const cash = snapshot.cashKobo / NAIRA
  const debt = Math.max(0, (snapshot.debtKobo ?? 0) / NAIRA)
  const valuation = Math.max(0, snapshot.valuationKobo / NAIRA)
  const burn = Math.max(0, expenses - revenue)
  const runway = burn > 0 ? cash / burn : 12
  const teamSkill = clampNumber(isFiniteNumber(snapshot.teamSkill) ? snapshot.teamSkill : 0, 0, 500)
  const quality = clampNumber(isFiniteNumber(snapshot.quality) ? snapshot.quality : 0, 0, 100)
  const reputation = clampNumber(isFiniteNumber(snapshot.reputation) ? snapshot.reputation : 0, 0, 100)
  const equity = clampNumber(isFiniteNumber(snapshot.founderEquity) ? snapshot.founderEquity : 100, 0, 100)

  const components = {
    revenue: clampNumber(revenue / 250_000, 0, 1) * 30,
    customers: clampNumber(snapshot.customers / 500, 0, 1) * 15,
    runway: clampNumber(runway / 12, 0, 1) * 15,
    quality: (quality / 100) * 10,
    reputation: (reputation / 100) * 10,
    valuation: clampNumber(valuation / 10_000_000, 0, 1) * 10,
    team: clampNumber(teamSkill / 100, 0, 1) * 5,
    ownership: (equity / 100) * 5,
    debtPenalty: -clampNumber(debt / Math.max(1, revenue * 12), 0, 1) * 10,
  }

  const raw = Object.values(components).reduce((total, value) => total + value, 0)
  return Math.round(clampNumber(raw, 0, 100))
}

export interface ScoreBreakdown {
  score: number
  components: Record<string, number>
}

export function scoreBreakdown(snapshot: RunSnapshot): ScoreBreakdown {
  return { score: scoreSnapshot(snapshot), components: {} }
}

/**
 * Economic plausibility envelope for one commit. Deliberately generous: real
 * play never approaches it, but an edited save (₦9bn cash on month 2) does.
 */
function cashDeltaLimit(previous: AuthorityState): number {
  return Math.max(
    previous.cashKobo * 2,
    previous.revenueKobo * 4,
    previous.expensesKobo * 4,
    50_000_000 * NAIRA, // ₦50m of legitimate movement per commit
  )
}

export function validateSnapshot(company: Company, input: Partial<RunSnapshot>): CommitResult {
  const previous = authorityOf(company)
  const at = new Date().toISOString()
  const violations: AuthorityViolation[] = []

  const record = (code: string, field: string, message: string, clientValue: number | string | null, canonicalValue: number | string | null) => {
    violations.push({ code, field, message, clientValue, canonicalValue, at })
  }

  // ---- time -------------------------------------------------------------
  let month = toInt(input.month, previous.month)
  if (month < previous.month) {
    record('month_regression', 'month', 'Simulation time cannot move backwards.', month, previous.month)
    month = previous.month
  }
  if (month > previous.month + 1) {
    record('month_jump', 'month', 'Only one month can be closed per commit.', month, previous.month + 1)
    month = previous.month + 1
  }
  month = clampNumber(month, 0, MAX_MONTH)

  let day = toInt(input.day, previous.day)
  if (day < 1 || day > 31) {
    record('day_out_of_range', 'day', 'Day must be within the month.', day, clampNumber(day, 1, 31))
    day = clampNumber(day, 1, 31)
  }

  // ---- cash -------------------------------------------------------------
  let cashKobo = toInt(input.cashKobo, previous.cashKobo)
  const limit = cashDeltaLimit(previous)
  const cashDelta = cashKobo - previous.cashKobo
  if (Math.abs(cashDelta) > limit) {
    const canonicalCash = previous.cashKobo + Math.sign(cashDelta) * limit
    record('cash_implausible', 'cashKobo', 'Cash movement exceeds what the economy can produce in one month.', cashKobo, canonicalCash)
    cashKobo = canonicalCash
  }
  if (Math.abs(cashKobo) > MAX_KOBO) {
    record('cash_out_of_bounds', 'cashKobo', 'Cash is outside the supported range.', cashKobo, clampNumber(cashKobo, -MAX_KOBO, MAX_KOBO))
    cashKobo = clampNumber(cashKobo, -MAX_KOBO, MAX_KOBO)
  }

  // ---- customers --------------------------------------------------------
  let customers = toInt(input.customers, previous.customers)
  if (customers < 0) {
    record('customers_negative', 'customers', 'Customer count cannot be negative.', customers, 0)
    customers = 0
  }
  const growthCeiling = previous.customers === 0 ? 1_000 : previous.customers * 3 + 50
  if (customers > growthCeiling) {
    record('customers_implausible', 'customers', 'Customer growth exceeds the market ceiling for one month.', customers, growthCeiling)
    customers = growthCeiling
  }
  customers = clampNumber(customers, 0, 5_000_000)

  // ---- revenue / expenses ----------------------------------------------
  let price = clampNumber(isFiniteNumber(input.priceNaira) ? input.priceNaira : (previous.priceNaira ?? 0), 0, 1_000_000)
  const previousPrice = previous.priceNaira ?? 0
  if (previousPrice > 0 && Math.abs(price - previousPrice) > previousPrice * 0.6 + 1_000) {
    record('price_implausible', 'priceNaira', 'Price cannot move more than 60% in a single month.', price, previousPrice)
    price = previousPrice
  }

  let revenueKobo = toInt(input.revenueKobo, previous.revenueKobo)
  if (revenueKobo < 0) {
    record('revenue_negative', 'revenueKobo', 'Revenue cannot be negative.', revenueKobo, 0)
    revenueKobo = 0
  }
  const revenueCeiling = Math.max(previous.revenueKobo * 3, customers * Math.max(price, 1) * NAIRA * 1.5, 500_000 * NAIRA)
  if (revenueKobo > revenueCeiling) {
    record('revenue_implausible', 'revenueKobo', 'Revenue is not supported by the customer base and price.', revenueKobo, revenueCeiling)
    revenueKobo = revenueCeiling
  }

  // Absolute ceiling: repeated commits cannot ratchet cash upwards indefinitely.
  const cashCeiling = Math.max(revenueKobo * 24, 10_000_000 * NAIRA * (month + 1))
  if (cashKobo > cashCeiling) {
    record('cash_ceiling', 'cashKobo', 'Cash exceeds what this company could have raised or earned by now.', cashKobo, cashCeiling)
    cashKobo = cashCeiling
  }

  let expensesKobo = toInt(input.expensesKobo, previous.expensesKobo)
  if (expensesKobo < 0) {
    record('expenses_negative', 'expensesKobo', 'Expenses cannot be negative.', expensesKobo, 0)
    expensesKobo = 0
  }
  const expenseFloor = revenueKobo > 1_000_000 * NAIRA ? Math.round(revenueKobo * 0.1) : 0
  if (expensesKobo < expenseFloor) {
    record('expenses_understated', 'expensesKobo', 'A company with revenue must carry operating costs.', expensesKobo, expenseFloor)
    expensesKobo = expenseFloor
  }
  const expenseCeiling = Math.max(previous.expensesKobo * 6, Math.abs(cashKobo) * 4, 200_000_000 * NAIRA)
  if (expensesKobo > expenseCeiling) {
    record('expenses_implausible', 'expensesKobo', 'Expenses exceed any plausible operating run rate.', expensesKobo, expenseCeiling)
    expensesKobo = expenseCeiling
  }

  // ---- valuation --------------------------------------------------------
  let valuationKobo = toInt(input.valuationKobo, previous.valuationKobo)
  if (valuationKobo < 0) {
    record('valuation_negative', 'valuationKobo', 'Valuation cannot be negative.', valuationKobo, 0)
    valuationKobo = 0
  }
  const valuationCeiling = Math.max(revenueKobo * 3_000, Math.abs(cashKobo) * 5_000, 5_000_000_000 * NAIRA)
  if (valuationKobo > valuationCeiling) {
    record('valuation_implausible', 'valuationKobo', 'Valuation is not supported by revenue or capital.', valuationKobo, valuationCeiling)
    valuationKobo = valuationCeiling
  }

  // ---- bounded 0-100 attributes ----------------------------------------
  const bounded = (field: 'quality' | 'reputation' | 'morale' | 'founderEquity', fallback: number, maxDelta?: number, previousValue?: number) => {
    const raw = toInt(input[field], fallback)
    let value = clampNumber(raw, 0, 100)
    if (raw < 0 || raw > 100) record(`${field}_out_of_range`, field, `${field} must be between 0 and 100.`, raw, value)
    if (maxDelta !== undefined && previousValue !== undefined && Math.abs(value - previousValue) > maxDelta) {
      value = clampNumber(previousValue + Math.sign(value - previousValue) * maxDelta, 0, 100)
      record(`${field}_jump`, field, `${field} cannot move more than ${maxDelta} points in one month.`, raw, value)
    }
    return value
  }

  const quality = bounded('quality', previous.quality ?? 50, 15, previous.quality)
  const reputation = bounded('reputation', previous.reputation ?? 50, 15, previous.reputation)
  const morale = bounded('morale', previous.morale ?? 70, 20, previous.morale)
  const founderEquity = bounded('founderEquity', 100, 40, undefined)

  let teamSize = toInt(input.teamSize, Math.max(0, company.employees.length))
  if (teamSize < 0 || teamSize > 500) {
    record('team_out_of_bounds', 'teamSize', 'Team size is outside the supported range.', teamSize, clampNumber(teamSize, 0, 500))
    teamSize = clampNumber(teamSize, 0, 500)
  }
  let teamSkill = toInt(input.teamSkill, teamSize * 5)
  if (teamSkill < 0 || teamSkill > 500) {
    record('skill_out_of_bounds', 'teamSkill', 'Team skill total is outside the supported range.', teamSkill, clampNumber(teamSkill, 0, 500))
    teamSkill = clampNumber(teamSkill, 0, 500)
  }
  const previousSkill = previous.teamSkill ?? 0
  if (teamSkill - previousSkill > 30) {
    record('skill_jump', 'teamSkill', 'Team skill cannot grow by more than 30 points in one month.', teamSkill, previousSkill + 30)
    teamSkill = previousSkill + 30
  }
  let inventory = toInt(input.inventory, 0)
  if (inventory < 0 || inventory > 1_000) {
    record('inventory_out_of_bounds', 'inventory', 'Inventory is outside the supported range.', inventory, clampNumber(inventory, 0, 1_000))
    inventory = clampNumber(inventory, 0, 1_000)
  }
  let debtKobo = toInt(input.debtKobo, 0)
  if (debtKobo < 0 || debtKobo > MAX_KOBO) {
    record('debt_out_of_bounds', 'debtKobo', 'Debt is outside the supported range.', debtKobo, clampNumber(debtKobo, 0, MAX_KOBO))
    debtKobo = clampNumber(debtKobo, 0, MAX_KOBO)
  }

  const status = typeof input.status === 'string' && ['active', 'completed', 'bankrupt', 'acquired'].includes(input.status)
    ? input.status
    : previous.status

  const canonical: RunSnapshot = {
    month,
    day,
    cashKobo,
    customers,
    priceNaira: price,
    revenueKobo,
    expensesKobo,
    valuationKobo,
    quality,
    reputation,
    morale,
    teamSize,
    teamSkill,
    inventory,
    debtKobo,
    founderEquity,
    status,
  }

  // Score is always recomputed here; any client-supplied score is discarded.
  const score = scoreSnapshot(canonical)

  const authority: AuthorityState = {
    version: AUTHORITY_VERSION,
    score,
    month,
    day,
    cashKobo,
    customers,
    revenueKobo,
    expensesKobo,
    valuationKobo,
    priceNaira: price,
    quality,
    reputation,
    morale,
    teamSkill,
    status,
    commits: previous.commits + 1,
    updatedAt: at,
    lastViolationAt: violations.length ? at : previous.lastViolationAt,
  }

  return { canonical, authority, violations, tampered: violations.length > 0, score }
}

/** Mirror canonical figures onto the company record so finance endpoints agree. */
export function applyCanonical(company: Company, canonical: RunSnapshot): void {
  company.balanceKobo = canonical.cashKobo
  company.balance = canonical.cashKobo / NAIRA
  company.revenueKobo = canonical.revenueKobo
  company.revenue = canonical.revenueKobo / NAIRA
  company.expensesKobo = canonical.expensesKobo
  company.expenses = canonical.expensesKobo / NAIRA
  company.simulation.day = canonical.day ?? company.simulation.day
  company.updatedAt = new Date().toISOString()
  if (company.status === 'draft' && canonical.customers > 0) company.status = 'operating'
}

// ---------------------------------------------------------------------------
// Tamper-evident audit chain
// ---------------------------------------------------------------------------

const stable = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`
}

export function recordHash(record: Pick<AuditRecord, 'seq' | 'at' | 'type' | 'actor' | 'payload' | 'prevHash'>): string {
  return createHash('sha256')
    .update(`${record.prevHash}|${record.seq}|${record.at}|${record.type}|${record.actor}|${stable(record.payload)}`)
    .digest('hex')
}

export function appendAudit(company: Company, type: string, actor: string, payload: Record<string, unknown> = {}): AuditRecord {
  const chain = company.auditChain ?? []
  const prevHash = chain.length ? chain[chain.length - 1].hash : 'genesis'
  const seq = chain.length + 1
  const at = new Date().toISOString()
  const record: AuditRecord = { seq, at, type, actor, payload, prevHash, hash: '' }
  record.hash = recordHash(record)
  chain.push(record)
  // Keep the chain bounded but never break continuity of what is retained.
  if (chain.length > 5_000) chain.splice(0, chain.length - 5_000)
  company.auditChain = chain
  return record
}

export interface ChainVerification {
  valid: boolean
  length: number
  brokenAt?: number
  head?: string
}

export function verifyChain(company: Company): ChainVerification {
  const chain = company.auditChain ?? []
  for (const [index, record] of chain.entries()) {
    const expectedPrev = index === 0 ? record.prevHash : chain[index - 1].hash
    if (record.prevHash !== expectedPrev) return { valid: false, length: chain.length, brokenAt: record.seq }
    const recomputed = recordHash(record)
    if (recomputed !== record.hash) return { valid: false, length: chain.length, brokenAt: record.seq }
  }
  return { valid: true, length: chain.length, head: chain.length ? chain[chain.length - 1].hash : undefined }
}

export function publicAuthority(authority: AuthorityState) {
  return {
    ...authority,
    score: authority.score,
    cash: authority.cashKobo / NAIRA,
    revenue: authority.revenueKobo / NAIRA,
    expenses: authority.expensesKobo / NAIRA,
    valuation: authority.valuationKobo / NAIRA,
  }
}
