import {
  ACHIEVEMENTS,
  BRANCH_OPTIONS,
  CRISES,
  FUNDS,
  INDUSTRIES,
  ROLES,
  STRATEGIES,
  WORLD_EVENTS,
  difficultyById,
  economyForMonth,
  founderBackgroundById,
  industryById,
  makeCompetitors,
  makeSuppliers,
  randomCandidateName,
  roleById,
  strategyById,
} from './data'
import { ALL_LEVELS } from './progression'
import { BILL_SHARE, VENDORS, billDueMonth, buildStatements, openPayables, settleBills } from './accounting'
import type {
  Bill,
  Candidate,
  CrisisDef,
  CrisisState,
  Deal,
  DifficultyId,
  Effects,
  Employee,
  FlowBucket,
  FounderBackgroundId,
  GameMetrics,
  GameState,
  IndustryId,
  Invoice,
  InvestorOffer,
  LogEntry,
  MonthReport,
  RoleId,
  StrategyId,
  Tone,
  BeginnerProgress,
  BeginnerMissionProgress,
} from './types'
import { clamp, money, number, uid } from '../lib/format'
import { hashSeed, newSeed, pickWith, randWith, rngFor, shuffledWith } from './random'

export const RUN_LENGTH = Number.POSITIVE_INFINITY
export const DAYS_PER_MONTH = 30
export const SAVE_VERSION = 2

export function createBeginnerProgress(): BeginnerProgress {
  return {
    stageId: 'beginner',
    xp: 0,
    reputation: 0,
    currentLevel: 1,
    levels: ALL_LEVELS.map((level, index) => ({
      levelNumber: level.levelNumber,
      status: index === 0 ? 'available' : 'locked',
      missions: level.missions.map((mission) => ({ missionId: mission.id, status: index === 0 ? 'available' : 'locked' })),
    })),
  }
}

export function acknowledgeMissionEvidence(state: GameState, evidence: string[]): GameState {
  const existingEvidence = new Set(state.missionEvidence ?? [])
  evidence.forEach((item) => existingEvidence.add(item))
  let next = { ...state, missionEvidence: [...existingEvidence] }
  const current = ALL_LEVELS[next.beginner.currentLevel - 1]
  if (!current) return next
  const progress = next.beginner.levels.find((item) => item.levelNumber === current.levelNumber)
  if (!progress) return next
  const newlyCompleted = current.missions.filter((mission) => existingEvidence.has(mission.id) && !progress.missions.find((item) => item.missionId === mission.id)?.status?.includes('completed'))
  if (newlyCompleted.length === 0) return next
  const missions = progress.missions.map((item) => newlyCompleted.some((mission) => mission.id === item.missionId) ? { ...item, status: 'completed' as const, completedAtMonth: next.month } : item)
  const levelComplete = current.missions.every((mission) => missions.some((item) => item.missionId === mission.id && item.status === 'completed'))
  const levels = next.beginner.levels.map((item) => item.levelNumber === current.levelNumber ? { ...item, missions, status: levelComplete ? 'completed' as const : 'active' as const, ...(levelComplete ? { completedAtMonth: next.month } : {}) } : item)
  const xp = newlyCompleted.reduce((total, mission) => total + mission.reward.xp, 0)
  const reputation = newlyCompleted.reduce((total, mission) => total + mission.reward.reputation, 0)
  if (levelComplete && current.levelNumber < ALL_LEVELS.length) {
    const nextLevel = current.levelNumber + 1
    next = { ...next, beginner: { ...next.beginner, xp: next.beginner.xp + xp, reputation: next.beginner.reputation + reputation, currentLevel: nextLevel, levels: levels.map((item) => item.levelNumber === nextLevel ? { ...item, status: 'available' as const, missions: item.missions.map((entry) => ({ ...entry, status: 'available' as const })) } : item) } }
    return addLog(next, { month: next.month, title: `Level ${String(nextLevel).padStart(2, '0')} unlocked`, detail: `${ALL_LEVELS[nextLevel - 1].name} is now available because the previous work is complete.`, tone: 'good', kind: 'milestone' })
  }
  return { ...next, beginner: { ...next.beginner, xp: next.beginner.xp + xp, reputation: next.beginner.reputation + reputation, levels } }
}

export function completeBeginnerMission(state: GameState, missionId: string): GameState {
  const level = ALL_LEVELS.find((definition) => definition.missions.some((mission) => mission.id === missionId))
  if (!level || state.beginner.currentLevel !== level.levelNumber) return state
  const mission = level.missions.find((item) => item.id === missionId)
  const progress = state.beginner.levels.find((item) => item.levelNumber === level.levelNumber)
  const missionProgress = progress?.missions.find((item) => item.missionId === missionId)
  if (!mission || !progress || !missionProgress || missionProgress.status === 'completed') return state

  const nextMission: BeginnerMissionProgress = { ...missionProgress, status: 'completed', completedAtMonth: state.month }
  const missions = progress.missions.map((item) => (item.missionId === missionId ? nextMission : item))
  const levelComplete = level.missions.every((item) => missions.find((entry) => entry.missionId === item.id)?.status === 'completed')
  const levels = state.beginner.levels.map((item) => item.levelNumber === level.levelNumber
    ? { ...item, missions, status: levelComplete ? 'completed' as const : 'active' as const, ...(levelComplete ? { completedAtMonth: state.month } : {}) }
    : item)
  if (levelComplete && level.levelNumber < ALL_LEVELS.length) {
    const nextLevel = level.levelNumber + 1
    return addLog({
      ...state,
      beginner: {
        ...state.beginner,
        xp: state.beginner.xp + mission.reward.xp,
        reputation: state.beginner.reputation + mission.reward.reputation,
        currentLevel: nextLevel,
        levels: levels.map((item) => item.levelNumber === nextLevel
          ? { ...item, status: 'available' as const, missions: item.missions.map((entry) => ({ ...entry, status: 'available' as const })) }
          : item),
      },
    }, { month: state.month, title: `Level ${String(nextLevel).padStart(2, '0')} unlocked`, detail: `${ALL_LEVELS[nextLevel - 1].name} is now available.`, tone: 'good', kind: 'milestone' })
  }
  return {
    ...state,
    beginner: {
      ...state.beginner,
      xp: state.beginner.xp + mission.reward.xp,
      reputation: state.beginner.reputation + mission.reward.reputation,
      levels,
    },
  }
}

const addLog = (state: GameState, entry: Omit<LogEntry, 'id'>): GameState => ({
  ...state,
  log: [{ id: uid(), ...entry }, ...state.log].slice(0, 80),
})

const makeEmployee = (candidate: Candidate, month: number): Employee => ({
  id: candidate.id,
  name: candidate.name,
  role: candidate.role,
  skill: candidate.skill,
  salary: candidate.salary,
  morale: 72,
  joinedMonth: month,
  background: candidate.background,
  level: 1,
  training: 0,
})

export function makeCandidate(role?: RoleId, rng: () => number = Math.random): Candidate {
  const roleDef = role ? roleById(role) : pickWith(rng, ROLES)
  const skill = Math.round(randWith(rng, 2.5, 9.2) * 10) / 10
  const salary = Math.round((roleDef.salaryMin + (skill / 10) * (roleDef.salaryMax - roleDef.salaryMin)) / 100) * 100
  const { name, background, quirk } = randomCandidateName(rng)
  return {
    id: uid(),
    name,
    role: roleDef.id,
    skill,
    salary,
    signingBonus: Math.round((salary * 0.5) / 100) * 100,
    background,
    quirk,
  }
}

export function makeCandidatePool(rng: () => number = Math.random, count = 5): Candidate[] {
  return Array.from({ length: count }, () => makeCandidate(undefined, rng))
}

const DEAL_COMPANIES = [
  'Arden & Co.', 'Blue Harbour Group', 'Cedar Street Foods', 'Delta Freight', 'Everline Retail',
  'Foxglove Studio', 'Granite Partners', 'Harbourview Hotels', 'Ivy & Oak', 'Juniper Labs',
  'Kestrel Logistics', 'Linden Health', 'Mosaic Hotels', 'Northgate Group', 'Orchid Events',
]

const DEAL_CONTACTS = ['Ada', 'Tunde', 'Zainab', 'Kwame', 'Lina', 'Mateo', 'Priya', 'Noah', 'Nia', 'Omar']

export function makeDeal(industry: IndustryId, month: number, rng: () => number = Math.random): Deal {
  const def = industryById(industry)
  const customers = Math.max(1, Math.round(randWith(rng, 2, 6) * (def.price > 300 ? 0.5 : 1) * (def.marketReach > 40 ? 8 : 1) * 0.12))
  const monthlyValue = customers * def.price
  return {
    id: uid(),
    company: pickWith(rng, DEAL_COMPANIES),
    contact: `${pickWith(rng, DEAL_CONTACTS)} ${pickWith(rng, ['Okafor', 'Mensah', 'Silva', 'Park', 'Haddad', 'Rossi', 'Chen'])}`,
    customers,
    value: Math.round((monthlyValue * randWith(rng, 1.8, 4.2)) / 100) * 100,
    stage: month === 0 ? 'lead' : pickWith(rng, ['lead', 'qualified', 'negotiation'] as const),
    chance: Math.round(randWith(rng, 0.24, 0.52) * 100) / 100,
    monthsOpen: 0,
    discount: false,
  }
}

export function startGame(input: {
  founder: string
  company: string
  industry: IndustryId
  strategy?: StrategyId
  founderBackground?: FounderBackgroundId
  difficulty?: DifficultyId
  firstName?: string
  lastName?: string
  nickname?: string
  avatar?: string
  accountEmail?: string
  seed?: number
  /** Scenario starting capital (₦). Overrides the industry/strategy default. */
  startingCash?: number
}): GameState {
  const industry = industryById(input.industry)
  const strategy = strategyById(input.strategy ?? 'product')
  const background = founderBackgroundById(input.founderBackground ?? 'operator')
  const difficulty = difficultyById(input.difficulty ?? 'standard')
  const startingQuality = clamp(industry.startingQuality + strategy.starting.quality + background.starting.quality, 15, 85)
  const startingReputation = clamp(48 + strategy.starting.reputation + background.starting.reputation, 10, 80)
  const derivedCash = Math.round(
    (industry.startingCash + strategy.starting.cash + background.starting.cash) * difficulty.cashMult,
  )
  const startingCash = Number.isFinite(input.startingCash) && (input.startingCash ?? 0) > 0
    ? Math.round(input.startingCash as number)
    : derivedCash
  const seed = input.seed ?? newSeed()
  const bootstrap = rngFor(seed, 'bootstrap')
  const economyOffset = Math.floor(randWith(bootstrap, 0, 7))
  const suppliers = makeSuppliers(input.industry)
  const startingCustomers =
    industry.startingCustomers + strategy.starting.customers + background.starting.customers

  const base: GameState = {
    version: SAVE_VERSION,
    seed,
    journal: [],
    journalComplete: true,
    startingCash,
    status: 'active',
    founder: input.founder.trim() || 'Founder',
    firstName: input.firstName?.trim() || input.founder.trim().split(' ')[0] || 'Founder',
    lastName: input.lastName?.trim() || input.founder.trim().split(' ').slice(1).join(' '),
    nickname: input.nickname?.trim() || input.founder.trim().split(' ')[0] || 'Founder',
    avatar: input.avatar || 'founder-1',
    accountEmail: input.accountEmail?.trim() || '',
    founderBackground: background.id,
    difficulty: difficulty.id,
    company: input.company.trim() || 'Untitled Co.',
    industry: input.industry,
    strategy: strategy.id,
    month: 0,
    day: 1,
    cash: startingCash,
    debt: 0,
    customers: industry.startingCustomers + strategy.starting.customers + background.starting.customers,
    price: industry.price,
    quality: startingQuality,
    reputation: startingReputation,
    morale: clamp(70 + background.starting.morale, 0, 100),
    marketingSpend: 2_000,
    productSpend: 3_000,
    trainingSpend: 0,
    valuation: 400_000,
    founderEquity: 100,
    team: [],
    candidates: makeCandidatePool(rngFor(seed, 'candidates', 0)),
    offers: [],
    lastRoundMonth: -3,
    totalRaised: 0,
    emergencyLoans: 0,
    pendingCrisis: null,
    invoices: [],
    receivables: 0,
    bills: [],
    payables: 0,
    inventoryValue: industry.inventory
      ? Math.round(1.6 * startingCustomers * industry.costPerCustomer)
      : 0,
    fixedAssets: 0,
    paidInCapital: startingCash + (industry.inventory ? Math.round(1.6 * startingCustomers * industry.costPerCustomer) : 0),
    retainedEarnings: 0,
    flows: { capex: 0, funding: 0, borrow: 0, repay: 0, expenses: 0, otherIncome: 0 },
    statements: [],
    seenCrises: [],
    log: [],
    history: [],
    achievements: [],
    lastReport: null,
    suppliers,
    supplierId: suppliers[0].id,
    inventory: industry.inventory ? 1.6 : 0,
    restockMonths: industry.inventory ? 1 : 0,
    pipeline: [makeDeal(input.industry, 0, rngFor(seed, 'pipeline', 0, 1)), makeDeal(input.industry, 0, rngFor(seed, 'pipeline', 0, 2))],
    pipelineWon: 0,
    competitors: makeCompetitors(input.industry),
    economy: economyForMonth(0, economyOffset),
    economyOffset,
    branches: BRANCH_OPTIONS.map((branch) => ({ ...branch })),
    beginner: createBeginnerProgress(),
    missionEvidence: [],
  }

  const withValuation = acknowledgeMissionEvidence({ ...base, valuation: computeValuation(base) }, ['beginner-1-1', 'beginner-1-2', 'beginner-1-3', 'beginner-1-4', 'beginner-1-5', 'beginner-1-6'])
  return addLog(withValuation, {
    month: 0,
    title: `${withValuation.company} opens its doors`,
    detail: `${industry.name} · ${strategy.name} · ${background.name} founder. ${money(withValuation.cash)} in the bank. Month 1 starts now.`,
    tone: 'good',
    kind: 'milestone',
  })
}

const avg = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

const backgroundPower = (state: GameState, key: 'quality' | 'sales' | 'marketing' | 'ops') =>
  founderBackgroundById(state.founderBackground ?? 'operator').powers[key]

const supplierOf = (state: GameState) =>
  state.suppliers?.find((supplier) => supplier.id === state.supplierId) ?? state.suppliers?.[0]

const openBranches = (state: GameState) => (state.branches ?? []).filter((branch) => branch.openedMonth !== null)

const branchDemandOf = (state: GameState) => sum(openBranches(state).map((branch) => branch.demand))

const competitorPressureOf = (state: GameState) => {
  const competitors = state.competitors ?? []
  if (!competitors.length) return 0
  const industry = industryById(state.industry)
  return clamp(
    competitors.reduce((acc, competitor) => {
      const priceEdge = competitor.priceIndex < state.price / industry.price ? 0.45 : 0
      const qualityEdge = competitor.quality > state.quality ? 0.45 : 0
      return acc + competitor.share * (1 + priceEdge + qualityEdge)
    }, 0),
    0,
    1,
  )
}

function rolesPower(state: GameState, role: RoleId) {
  return sum(
    state.team
      .filter((member) => member.role === role)
      .map((member) => member.skill * (1 + ((member.level ?? 1) - 1) * 0.15)),
  )
}

export function computeValuation(state: GameState): number {
  const industry = industryById(state.industry)
  const arr = state.customers * state.price * 12
  const teamSkill = sum(state.team.map((member) => member.skill * (member.level ?? 1)))
  const base = 220_000
  const arrValue = arr * industry.revenueMultiple * (0.55 + state.reputation / 130)
  const brandValue = state.quality * 2_400 + state.reputation * 1_600
  const teamValue = teamSkill * 5_500
  const branchValue = sum(openBranches(state).map((branch) => branch.demand * 28_000))
  const economyMult = state.economy?.valuation ?? 1
  const raw = (base + arrValue + brandValue + teamValue + branchValue) * economyMult
  return Math.max(250_000, Math.round(raw / 10_000) * 10_000)
}

export function getMetrics(state: GameState): GameMetrics {
  const industry = industryById(state.industry)
  const strategy = strategyById(state.strategy)
  const team = state.team
  const payroll = sum(team.map((member) => member.salary))
  const teamSize = team.length
  const avgMorale = teamSize ? avg(team.map((member) => member.morale)) : state.morale
  const qualityPower =
    rolesPower(state, 'engineer') +
    rolesPower(state, 'designer') * 0.45 +
    strategy.powers.quality +
    backgroundPower(state, 'quality')
  const salesPower =
    rolesPower(state, 'sales') + rolesPower(state, 'marketer') * 0.2 + strategy.powers.sales + backgroundPower(state, 'sales')
  const marketingPower =
    rolesPower(state, 'marketer') +
    rolesPower(state, 'designer') * 0.2 +
    strategy.powers.marketing +
    backgroundPower(state, 'marketing')
  const opsPower = rolesPower(state, 'ops') + strategy.powers.ops + backgroundPower(state, 'ops')
  const moraleFactor = 0.72 + avgMorale / 235
  const revenue = state.customers * state.price
  const branchOverhead = sum(openBranches(state).map((branch) => branch.overhead))
  const monthlyCosts =
    payroll +
    industry.fixedCosts +
    state.marketingSpend +
    state.productSpend +
    (state.trainingSpend ?? 0) +
    teamSize * 180 +
    branchOverhead +
    state.debt * 0.018 +
    state.customers * industry.costPerCustomer
  const burn = Math.max(0, monthlyCosts - revenue)
  const runway = burn > 0.5 ? state.cash / burn : 99
  const priceFactor = clamp((industry.price / state.price) ** 1.5, 0.25, 2.2)
  const churnRate = estimateChurn(state)
  const growthRate =
    state.customers > 0
      ? (newCustomersEstimate(state) - state.customers * churnRate) / state.customers
      : 0
  const supplier = supplierOf(state)
  const supplyRisk = industry.inventory
    ? clamp((1 - (supplier?.reliability ?? 0.85)) + (state.restockMonths ?? 0) * 0.06 - (state.inventory ?? 0) * 0.16, 0, 0.95)
    : 0
  return {
    mrr: revenue,
    arr: revenue * 12,
    monthlyCosts,
    burn,
    runway,
    payroll,
    teamSize,
    avgMorale,
    capacity: (qualityPower + opsPower + teamSize) * 4 * moraleFactor,
    salesPower,
    marketingPower,
    opsPower,
    qualityPower,
    priceFactor,
    churnRate,
    growthRate,
    score: computeScore(state),
    inventoryCover: industry.inventory ? clamp(state.inventory ?? 0, 0, 12) : 0,
    supplyRisk,
    pipelineValue: sum((state.pipeline ?? []).map((deal) => deal.value * deal.chance)),
    economyDemand: state.economy?.demand ?? 1,
    branchDemand: branchDemandOf(state),
    competitorPressure: competitorPressureOf(state),
    trainingSpend: state.trainingSpend ?? 0,
  }
}

export function estimateChurn(state: GameState) {
  const industry = industryById(state.industry)
  const strategy = strategyById(state.strategy)
  const opsPower = rolesPower(state, 'ops') + strategy.powers.ops + backgroundPower(state, 'ops')
  const base =
    industry.churn *
    (0.6 + (state.price / industry.price) * 0.55) *
    (1.65 - state.quality / 95) *
    (1.28 - opsPower / 90) *
    (1.15 - state.reputation / 400) *
    (1.08 - state.morale / 900) *
    (state.economy?.churn ?? 1) *
    (1 + competitorPressureOf(state) * 0.22)
  return clamp(base, 0.004, 0.32)
}

export function newCustomersEstimate(state: GameState) {
  const industry = industryById(state.industry)
  const strategy = strategyById(state.strategy)
  const salesPower = rolesPower(state, 'sales') + strategy.powers.sales + backgroundPower(state, 'sales')
  const marketingPower =
    rolesPower(state, 'marketer') + strategy.powers.marketing + backgroundPower(state, 'marketing')
  const priceFactor = clamp((industry.price / state.price) ** 1.5, 0.25, 2.2)
  const qualityFactor = 0.55 + (state.quality / 100) * 0.9
  const reputationFactor = 0.55 + state.reputation / 140
  const salesFactor = 0.65 + salesPower / 26
  const spendFactor = 0.65 + (state.marketingSpend / 2400) * (0.7 + marketingPower / 18)
  const moraleFactor = 0.8 + state.morale / 300
  const branchLift = branchDemandOf(state) * (0.55 + state.quality / 130)
  const economyFactor = state.economy?.demand ?? 1
  const competitionFactor = 1 - competitorPressureOf(state) * 0.18
  return Math.max(
    0,
    Math.round(
      (industry.marketReach * qualityFactor * priceFactor * reputationFactor * salesFactor * spendFactor * moraleFactor +
        branchLift) *
        economyFactor *
        competitionFactor,
    ),
  )
}

/**
 * Scoring v2 (mirrors backend/authority.ts `scoreSnapshot`).
 *
 * Every component is normalised against a stated benchmark and capped, so the
 * score responds to operating evidence instead of saturating on valuation.
 * The server recomputes this same formula and is the authority for the score.
 */
function computeScore(state: GameState) {
  const last = state.history[state.history.length - 1]
  const revenue = last?.revenue ?? state.customers * state.price
  const costs = last?.costs ?? sum(state.team.map((member) => member.salary)) + (state.marketingSpend ?? 0) + (state.productSpend ?? 0) + (state.trainingSpend ?? 0) + state.team.length * 180
  const burn = Math.max(0, costs - revenue)
  const runway = burn > 0 ? state.cash / burn : 12
  const teamSkill = sum(state.team.map((member) => member.skill * (member.level ?? 1)))
  const debt = Math.max(0, state.debt ?? 0)
  const raw =
    clamp(revenue / 250_000, 0, 1) * 30 +
    clamp(state.customers / 500, 0, 1) * 15 +
    clamp(runway / 12, 0, 1) * 15 +
    (clamp(state.quality, 0, 100) / 100) * 10 +
    (clamp(state.reputation, 0, 100) / 100) * 10 +
    clamp(state.valuation / 10_000_000, 0, 1) * 10 +
    clamp(teamSkill / 100, 0, 1) * 5 +
    (clamp(state.founderEquity ?? 100, 0, 100) / 100) * 5 -
    clamp(debt / Math.max(1, revenue * 12), 0, 1) * 10
  return Math.max(0, Math.round(clamp(raw, 0, 100) * 10) / 10)
}

/** Inputs the server needs to recompute and protect the score. */
export function authorityPayload(state: GameState) {
  const last = state.history[state.history.length - 1]
  const revenue = last?.revenue ?? state.customers * state.price
  const costs = last?.costs ?? sum(state.team.map((member) => member.salary)) + (state.marketingSpend ?? 0) + (state.productSpend ?? 0) + (state.trainingSpend ?? 0) + state.team.length * 180
  return {
    month: state.month,
    day: state.day,
    cashKobo: Math.round(state.cash * 100),
    customers: Math.round(state.customers),
    priceNaira: state.price,
    revenueKobo: Math.round(revenue * 100),
    expensesKobo: Math.round(costs * 100),
    valuationKobo: Math.round(state.valuation * 100),
    quality: state.quality,
    reputation: state.reputation,
    morale: state.morale,
    teamSize: state.team.length,
    teamSkill: Math.round(sum(state.team.map((member) => member.skill * (member.level ?? 1)))),
    inventory: state.inventory ?? 0,
    debtKobo: Math.round(Math.max(0, state.debt ?? 0) * 100),
    founderEquity: state.founderEquity ?? 100,
    status: state.status,
  }
}

/**
 * Record a one-off cash movement that happens between month closes, so the
 * cash-flow statement and the balance sheet still tie out.
 */
function recordFlow(state: GameState, key: keyof FlowBucket, amount: number): FlowBucket {
  const flows = state.flows ?? { capex: 0, funding: 0, borrow: 0, repay: 0, expenses: 0, otherIncome: 0 }
  if (!Number.isFinite(amount) || amount === 0) return flows
  return { ...flows, [key]: (flows[key] ?? 0) + amount }
}

export function applyEffects(state: GameState, effects: Effects): GameState {
  let next = { ...state }
  if (effects.cash) {
    next.cash += effects.cash
    next.flows = recordFlow(next, effects.cash < 0 ? 'expenses' : 'otherIncome', Math.abs(effects.cash))
  }
  if (effects.customersPct) next.customers = Math.max(0, Math.round(next.customers * (1 + effects.customersPct)))
  if (effects.customersAdd) next.customers = Math.max(0, next.customers + effects.customersAdd)
  if (effects.quality) next.quality = clamp(next.quality + effects.quality, 0, 100)
  if (effects.reputation) next.reputation = clamp(next.reputation + effects.reputation, 0, 100)
  if (effects.morale) next.morale = clamp(next.morale + effects.morale, 0, 100)
  if (effects.debt) next.debt = Math.max(0, next.debt + effects.debt)
  if (effects.marketing !== undefined) next.marketingSpend = effects.marketing
  if (effects.valuationMult) next.valuation = Math.round(next.valuation * effects.valuationMult)
  if (effects.acquisitionMult) {
    const payout = Math.round(next.valuation * effects.acquisitionMult * (next.founderEquity / 100))
    next.cash += payout
    next.status = 'acquired'
    next.endedReason = `Acquired by Kestrel Group for ${money(payout)} of founder proceeds`
    next.founderEquity = 0
  }
  if (effects.status === 'acquired' && !effects.acquisitionMult) {
    next.status = 'acquired'
    next.endedReason = 'Acquired'
  }
  return next
}

function rollMicroEvent(state: GameState): { state: GameState; message?: string } {
  const rng = rngFor(state.seed ?? 0, 'micro', state.month)
  if (rng() > 0.22) return { state }
  const event = pickWith(rng, WORLD_EVENTS)
  const next = applyEffects(state, event.effects)
  return {
    state: addLog(next, {
      month: next.month,
      title: event.title,
      detail: event.detail,
      tone: event.tone,
      kind: 'world',
    }),
    message: event.title,
  }
}

export function pickCrisis(state: GameState, multiplier = 1): CrisisDef | null {
  if (state.month < 3) return null
  const rng = rngFor(state.seed ?? 0, 'crisis', state.month)
  const chance = (state.month >= 12 ? 0.42 : 0.32) * multiplier
  if (rng() > chance) return null
  const eligible = CRISES.filter((crisis) => {
    if ((crisis.minMonth ?? 0) > state.month) return false
    if (crisis.requires && !crisis.requires(state)) return false
    return true
  })
  if (!eligible.length) return null
  const unseen = eligible.filter((crisis) => !state.seenCrises.includes(crisis.id))
  const pool = unseen.length ? unseen : eligible
  const total = sum(pool.map((crisis) => crisis.weight))
  let ticket = rng() * total
  for (const crisis of pool) {
    ticket -= crisis.weight
    if (ticket <= 0) return crisis
  }
  return pool[pool.length - 1]
}

function advancePipeline(state: GameState): {
  pipeline: Deal[]
  won: number
  cash: number
  customers: number
  notes: string[]
} {
  const industry = industryById(state.industry)
  const rng = rngFor(state.seed ?? 0, 'pipeline', state.month)
  const kept: Deal[] = []
  const notes: string[] = []
  let cash = 0
  let customers = 0
  let won = 0

  for (const deal of state.pipeline ?? []) {
    let next: Deal = { ...deal, monthsOpen: deal.monthsOpen + 1 }
    if (next.stage === 'lead') {
      if (rng() < 0.58 + state.marketingSpend / 40_000) next.stage = 'qualified'
    } else if (next.stage === 'qualified') {
      if (rng() < 0.55) next.stage = 'negotiation'
    } else {
      const chance = clamp(next.chance + (next.discount ? 0.16 : 0), 0.08, 0.92)
      if (rng() < chance) {
        const payout = Math.round(next.value * (next.discount ? 0.9 : 1))
        cash += payout
        customers += next.customers
        won += 1
        notes.push(`${next.company} signed: ${money(payout)} and ${number(next.customers)} ${industry.customerNounPlural}.`)
        continue
      }
      next = { ...next, chance: clamp(next.chance - 0.06, 0.08, 0.92) }
      if (next.monthsOpen > 3 && rng() < 0.35) {
        notes.push(`${next.company} went with someone else.`)
        continue
      }
    }
    if (next.monthsOpen > 5) continue
    kept.push(next)
  }

  const leadChance = 0.28 + state.marketingSpend / 22_000 + (rolesPower(state, 'sales') > 0 ? 0.18 : 0)
  if (kept.length < 6 && rng() < leadChance) kept.push(makeDeal(state.industry, state.month, rng))
  return { pipeline: kept, won, cash, customers, notes }
}

function moveCompetitors(state: GameState): GameState['competitors'] {
  const industry = industryById(state.industry)
  const relativePrice = state.price / industry.price
  return (state.competitors ?? []).map((competitor) => {
    const priceGap = relativePrice - competitor.priceIndex
    const qualityGap = state.quality - competitor.quality
    const share = clamp(competitor.share + priceGap * 0.018 + qualityGap * 0.0007, 0.04, 0.4)
    let lastMove = competitor.lastMove
    if (share > competitor.share + 0.004) {
      lastMove =
        competitor.archetype === 'discounter'
          ? 'Cut prices to win volume.'
          : competitor.archetype === 'premium'
            ? 'Launched a premium tier.'
            : 'Copied your last move quickly.'
    } else if (share < competitor.share - 0.004) {
      lastMove = 'Losing ground to your offer.'
    }
    return { ...competitor, share: Math.round(share * 1000) / 1000, lastMove }
  })
}

/**
 * How customers pay. B2B industries sell on account, so a slice of each
 * month's revenue is invoiced and only lands in cash when the invoice falls
 * due. Consumer industries collect at the till.
 */
const ACCOUNT_NAMES = [
  'Northline Distributors',
  'Kite Retail Group',
  'Meridian Logistics',
  'Palm Foods Ltd',
  'Harbour Wholesale',
  'Cedar Street Stores',
] as const

export const CREDIT_TERMS: Record<IndustryId, { share: number; terms: 15 | 30 | 45 }> = {
  saas: { share: 0.52, terms: 30 },
  logistics: { share: 0.44, terms: 45 },
  retail: { share: 0.16, terms: 15 },
  fnb: { share: 0.08, terms: 15 },
}

/** An invoice falls due in the issuing month for 15-day terms, +1 month for 30, +2 for 45. */
export function dueMonthFor(issuedMonth: number, terms: 15 | 30 | 45): number {
  return issuedMonth + (terms === 15 ? 0 : terms === 45 ? 2 : 1)
}

export function openReceivables(invoices: Invoice[]): number {
  return invoices.filter((invoice) => invoice.status !== 'paid').reduce((total, invoice) => total + invoice.amount, 0)
}

export interface SettlementResult {
  invoices: Invoice[]
  collected: number
  overdue: number
  writtenOff: number
}

/**
 * Settle every invoice that falls due in `month`. Late payers are marked
 * overdue and recover 80% at the next close; the rest is a bad debt.
 */
export function settleInvoices(
  invoices: Invoice[],
  month: number,
  rng: () => number,
  defaultRate: number,
): SettlementResult {
  const next: Invoice[] = []
  let collected = 0
  let overdue = 0
  let writtenOff = 0

  for (const invoice of invoices) {
    if (invoice.status === 'paid') {
      next.push(invoice)
      continue
    }
    if (invoice.status === 'overdue') {
      const recovered = Math.round(invoice.amount * 0.8)
      collected += recovered
      writtenOff += invoice.amount - recovered
      overdue += 1
      next.push({ ...invoice, status: 'paid', paidMonth: month, collected: recovered })
      continue
    }
    if (invoice.dueMonth > month) {
      next.push(invoice)
      continue
    }
    if (rng() < defaultRate) {
      overdue += 1
      next.push({ ...invoice, status: 'overdue' })
      continue
    }
    collected += invoice.amount
    next.push({ ...invoice, status: 'paid', paidMonth: month, collected: invoice.amount })
  }

  return { invoices: next, collected, overdue, writtenOff }
}

export function advanceMonth(state: GameState): GameState {
  if (state.status !== 'active' || state.pendingCrisis) return state
  const industry = industryById(state.industry)
  const strategy = strategyById(state.strategy)
  const difficulty = difficultyById(state.difficulty ?? 'standard')
  const month = state.month + 1
  const cashStart = state.cash
  const economy = economyForMonth(month, state.economyOffset ?? 0)
  const supplier = supplierOf(state)
  const season =
    1 + Math.sin((month / 12) * Math.PI * 2 - 0.9) * (industry.id === 'fnb' || industry.id === 'retail' ? 0.09 : 0.025)

  const payrollBefore = sum(state.team.map((member) => member.salary))
  const interest = state.debt * 0.018
  const trainingBudget = state.trainingSpend ?? 0
  const branchOverhead = sum(openBranches(state).map((branch) => branch.overhead))
  const branchDemand = branchDemandOf(state)

  let inventory = state.inventory ?? 0
  let stockout = false
  let spoilage = 0
  if (industry.inventory) {
    stockout = inventory < 0.7
    const reliability = supplier?.reliability ?? 0.85
    const incoming = Math.max(0, (state.restockMonths ?? 0) * reliability)
    inventory = clamp(inventory - 1 + incoming, 0, 6)
    if (state.industry === 'fnb' || state.industry === 'retail') {
      const overflow = Math.max(0, inventory - 3.2)
      if (overflow > 0.2) {
        spoilage = Math.round(overflow * state.customers * industry.costPerCustomer * 0.5)
        inventory = clamp(inventory - overflow * 0.5, 0, 6)
      }
    }
  }

  const supplyFactor = stockout ? 0.86 : 1
  const revenue = Math.round(state.customers * state.price * season * supplyFactor)
  const cogs = Math.round(
    state.customers * industry.costPerCustomer * season * (supplier?.costIndex ?? 1) * supplyFactor,
  )

  const qualityPower =
    rolesPower(state, 'engineer') +
    rolesPower(state, 'designer') * 0.45 +
    strategy.powers.quality +
    backgroundPower(state, 'quality')
  const overload = Math.max(0, state.customers / Math.max(6, state.team.length + 3) - 60)
  const productBoost =
    state.productSpend === 0 ? -1.5 : (state.productSpend / 3800) * (0.4 + qualityPower / 34) - 0.3
  const quality = clamp(
    state.quality +
      productBoost +
      (supplier?.quality ?? 0) * 0.05 +
      (trainingBudget / 5000) * 0.35 +
      (stockout ? -3.5 : 0) -
      overload * 0.03 -
      openBranches(state).length * 0.35,
    0,
    100,
  )

  let workingState: GameState = { ...state, month, quality, economy }
  const pipeline = advancePipeline(workingState)
  const newCustomers = newCustomersEstimate(workingState)
  const churnRate = estimateChurn(workingState)
  const churned = Math.round(state.customers * churnRate)
  const customers = Math.max(0, state.customers + newCustomers - churned + pipeline.customers)

  const overhead =
    industry.fixedCosts +
    state.marketingSpend +
    state.productSpend +
    trainingBudget +
    state.team.length * 180 +
    branchOverhead
  const costs = payrollBefore + overhead + interest + cogs + spoilage

  // Revenue is accrued when the customer buys; cash arrives when the invoice
  // falls due. This gap is what the receivables ledger tracks.
  const credit = CREDIT_TERMS[industry.id]
  const invoiced = Math.round(revenue * credit.share)
  const cashSales = revenue - invoiced
  const defaultRate = economy.phase === 'recession' ? 0.12 : 0.06
  const settlement = settleInvoices(
    state.invoices ?? [],
    month,
    rngFor(state.seed ?? 0, 'invoices', month),
    defaultRate,
  )
  const newInvoices: Invoice[] = invoiced > 0
    ? [{
        id: `inv-${month + 1}`,
        issuedMonth: month,
        dueMonth: dueMonthFor(month, credit.terms),
        amount: invoiced,
        terms: credit.terms,
        customer: pickWith(rngFor(state.seed ?? 0, 'account', month), ACCOUNT_NAMES),
        status: 'open' as const,
        paidMonth: null,
        collected: 0,
      }]
    : []
  const invoices = [...settlement.invoices, ...newInvoices].slice(-36)
  const receivables = openReceivables(invoices)

  // Stock is bought on supplier credit: the cost is expensed as it is used, but
  // cash leaves when the bill falls due. `billed` is the payable for this month.
  const inventoryValue = industry.inventory ? Math.max(0, Math.round(inventory * cogs)) : 0
  const inventoryDelta = inventoryValue - (state.inventoryValue ?? 0)
  const stockPurchases = Math.max(0, cogs + inventoryDelta)
  const billed = Math.round(stockPurchases * BILL_SHARE)
  const cashForStock = stockPurchases - billed

  const cashBeforeBills =
    state.cash + cashSales + settlement.collected - (payrollBefore + overhead + interest + cashForStock + spoilage) + pipeline.cash
  const billSettlement = settleBills(state.bills ?? [], month, Math.max(0, cashBeforeBills))
  const newBills: Bill[] = billed > 0
    ? [{
        id: `bill-${month + 1}`,
        issuedMonth: month,
        dueMonth: billDueMonth(month),
        amount: billed,
        vendor: pickWith(rngFor(state.seed ?? 0, 'vendor', month), VENDORS),
        status: 'open' as const,
        paidMonth: null,
        paid: 0,
        lateFee: 0,
      }]
    : []
  const bills = [...billSettlement.bills, ...newBills].slice(-36)
  const payables = openPayables(bills)
  let cash = cashBeforeBills - billSettlement.paid

  const depreciation = Math.round((state.fixedAssets ?? 0) * 0.02)
  const fixedAssets = Math.max(0, (state.fixedAssets ?? 0) - depreciation)
  const lateFees = billSettlement.lateFees
  const badDebt = settlement.writtenOff

  const moraleTarget =
    74 -
    clamp((state.customers / Math.max(3, state.team.length + 2) - 22) * 0.5, 0, 18) +
    (quality > 72 ? 3 : 0) -
    (cash < 10_000 ? 4 : 0) -
    (stockout ? 3 : 0)
  const morale = clamp(state.morale + (moraleTarget - state.morale) * 0.2, 0, 100)

  const repDelta =
    (quality - 55) / 38 +
    ((newCustomers + pipeline.customers - churned) / Math.max(30, state.customers)) * 1.0 +
    (strategy.id === 'community' ? 0.28 : 0) -
    (churnRate > 0.1 ? 0.8 : 0) -
    (stockout ? 0.7 : 0) +
    (economy.phase === 'boom' ? 0.15 : 0)
  const reputation = clamp(state.reputation + repDelta * 0.65, 0, 100)

  let promoted = false
  const trainingShare = trainingBudget / Math.max(1, state.team.length)
  const trainedTeam: Employee[] = state.team.map((member) => {
    let training = clamp((member.training ?? 0) + trainingShare / 90, 0, 100)
    let level = member.level ?? 1
    let skill = member.skill
    let salary = member.salary
    if (training >= 100 && level < 3) {
      level += 1
      training = 0
      skill = Math.round((skill + 0.35) * 10) / 10
      salary = Math.round((salary * 1.08) / 100) * 100
      promoted = true
    } else if (training > 100) {
      training = 100
    }
    return {
      ...member,
      level,
      training,
      skill,
      salary,
      morale: clamp(member.morale + (morale - member.morale) * 0.25, 0, 100),
    }
  })
  const attritionRng = rngFor(state.seed ?? 0, 'attrition', month)
  const leavers = trainedTeam.filter(
    (member) => member.morale < 32 && attritionRng() < 0.1 + (32 - member.morale) / 110,
  )
  const team = trainedTeam.filter((member) => !leavers.includes(member))

  let next: GameState = {
    ...state,
    month,
    cash,
    customers,
    quality,
    reputation,
    morale,
    economy,
    inventory,
    team,
    candidates: makeCandidatePool(rngFor(state.seed ?? 0, 'candidates', month)),
    pipeline: pipeline.pipeline,
    invoices,
    receivables,
    bills,
    payables,
    inventoryValue,
    fixedAssets,
    pipelineWon: (state.pipelineWon ?? 0) + pipeline.won,
    competitors: moveCompetitors({ ...state, quality, price: state.price }),
  }

  next = { ...next, valuation: computeValuation(next) }

  if (leavers.length) {
    next = { ...next, morale: clamp(next.morale - 2, 0, 100) }
    for (const leaver of leavers) {
      next = addLog(next, {
        month,
        title: `${leaver.name} resigned`,
        detail: 'Morale had been low for months. They found somewhere quieter.',
        tone: 'bad',
        kind: 'team',
      })
    }
  }

  let headline = `${customers >= state.customers ? '+' : ''}${number(customers - state.customers)} net ${industry.customerNounPlural} this month.`
  if (pipeline.won > 0) {
    headline = `${number(pipeline.won)} deal${pipeline.won === 1 ? '' : 's'} closed. ${customers >= state.customers ? '+' : ''}${number(customers - state.customers)} net ${industry.customerNounPlural}.`
  }
  if (stockout) {
    headline = 'You ran out of stock and turned demand away.'
  }

  let emergencyBorrow = 0
  if (cash < 0) {
    const shortfall = Math.abs(cash)
    const needed = Math.ceil((shortfall + 6_000) / 1_000) * 1_000
    cash += needed
    emergencyBorrow = needed
    next = {
      ...next,
      cash,
      debt: next.debt + Math.round(needed * 1.12),
      emergencyLoans: next.emergencyLoans + 1,
      reputation: clamp(next.reputation - 4, 0, 100),
    }
    next = addLog(next, {
      month,
      title: 'Emergency credit line triggered',
      detail: `You were ${money(shortfall)} short. The bank advanced ${money(needed)} against future revenue.`,
      tone: 'bad',
      kind: 'finance',
    })
    headline = 'You ran out of cash and the bank stepped in — at a price.'
    if (next.emergencyLoans >= 3) {
      next = {
        ...next,
        status: 'bankrupt',
        endedReason: 'Three emergency bailouts. The bank called in the debt.',
      }
    }
  }

  const mrr = customers * state.price
  const profitable = revenue - cogs - payrollBefore - overhead - interest - spoilage > 0

  if (mrr >= 10_000) next = unlock(next, 'first_10k')
  if (customers >= 100) next = unlock(next, 'hundred_customers')
  if (next.team.length > 0) next = unlock(next, 'first_hire')
  if (profitable) next = unlock(next, 'profitable')
  if (month >= 12) next = unlock(next, 'survivor')
  if (next.valuation >= 1_000_000) next = unlock(next, 'million')
  if (next.reputation >= 80) next = unlock(next, 'beloved')
  if ((next.pipelineWon ?? 0) > 0) next = unlock(next, 'first_deal')
  if (openBranches(next).length > 0) next = unlock(next, 'second_market')
  if (profitable && economy.phase === 'recession') next = unlock(next, 'weatherproof')
  if (promoted) next = unlock(next, 'promoted')

  // --- statements ---------------------------------------------------------
  // Built last so every cash movement in this close (including micro-events)
  // is reflected, and the ledger ties out against the final cash balance.
  const openingCash = state.history.length ? state.history[state.history.length - 1].cash : (state.startingCash ?? state.cash)
  const flows = {
    capex: next.flows?.capex ?? 0,
    funding: next.flows?.funding ?? 0,
    borrow: (next.flows?.borrow ?? 0) + emergencyBorrow,
    repay: next.flows?.repay ?? 0,
    expenses: next.flows?.expenses ?? 0,
    otherIncome: (next.flows?.otherIncome ?? 0) + pipeline.cash,
  }
  const emergencyFee = Math.round(emergencyBorrow * 0.12)
  const netProfit =
    revenue - cogs - payrollBefore - overhead - depreciation - spoilage - badDebt - lateFees -
    interest - emergencyFee + flows.otherIncome - flows.expenses
  const paidInCapital = (state.paidInCapital ?? 0) + flows.funding
  const retainedEarnings = (state.retainedEarnings ?? 0) + netProfit
  const statement = buildStatements({
    month,
    openingCash,
    closingCash: next.cash,
    revenue,
    cogs,
    payroll: payrollBefore,
    overhead,
    marketing: state.marketingSpend ?? 0,
    product: state.productSpend ?? 0,
    training: trainingBudget,
    depreciation,
    interest: interest + emergencyFee,
    interestPaid: interest,
    spoilage,
    badDebt,
    lateFees,
    otherExpenses: flows.expenses,
    otherIncome: flows.otherIncome,
    cashSales,
    collections: settlement.collected,
    stockPaid: cashForStock,
    billsPaid: billSettlement.paid,
    cashSpoilage: spoilage,
    state: next,
    inventoryValue,
    fixedAssets,
    receivables,
    payables,
    paidInCapital,
    retainedEarnings,
    capex: flows.capex,
    funding: flows.funding,
    borrow: flows.borrow,
    repay: flows.repay,
  })
  next = {
    ...next,
    paidInCapital,
    retainedEarnings,
    statements: [...(state.statements ?? []), statement].slice(-24),
    flows: { capex: 0, funding: 0, borrow: 0, repay: 0, expenses: 0, otherIncome: 0 },
  }

  const insights = buildInsights(next)

  const snapshot = {
    month,
    cash: next.cash,
    revenue,
    costs,
    customers,
    valuation: next.valuation,
    reputation: next.reputation,
    morale: next.morale,
    quality: next.quality,
    collected: cashSales + settlement.collected + pipeline.cash,
    receivables: next.receivables,
  }
  next = { ...next, history: [...next.history, snapshot] }

  const drivers: string[] = []
  drivers.push(`Economy is in ${economy.label.toLowerCase()}: demand ×${economy.demand.toFixed(2)}, churn ×${economy.churn.toFixed(2)}.`)
  if (stockout) {
    drivers.push('Stockout cut sales by 14% and cost quality and reputation.')
  } else if (industry.inventory) {
    drivers.push(`Inventory cover: ${inventory.toFixed(1)} months at the current run rate.`)
  }
  if (spoilage > 0) drivers.push(`Spoilage wrote off ${money(spoilage)} of stock.`)
  if (invoiced > 0) {
    drivers.push(
      `${money(invoiced)} of revenue was invoiced on ${credit.terms}-day terms; ${money(cashSales + settlement.collected)} reached the bank account and ${money(receivables)} is still receivable.`,
    )
  }
  if (settlement.overdue > 0) {
    drivers.push(`${number(settlement.overdue)} invoice${settlement.overdue === 1 ? '' : 's'} missed the due date — late payers recover about 80% next month.`)
  }
  if (pipeline.notes.length) drivers.push(...pipeline.notes.slice(0, 2))
  if (branchDemand > 0) drivers.push(`Branches added ${number(branchDemand)} demand points.`)
  if (trainingBudget > 0) drivers.push(`Training spend of ${money(trainingBudget)} lifted team capability.`)
  if (promoted) drivers.push('A teammate earned a promotion and a raise.')
  if (leavers.length) drivers.push(`${number(leavers.length)} teammate${leavers.length === 1 ? '' : 's'} resigned from low morale.`)

  next = addLog(next, {
    month,
    title: `Month ${month} closed`,
    detail: `${money(revenue)} revenue · ${money(costs)} costs · ${number(newCustomers)} won, ${number(churned)} churned${pipeline.won ? ` · ${pipeline.won} deal${pipeline.won === 1 ? '' : 's'}` : ''}`,
    tone: profitable ? 'good' : 'neutral',
    kind: 'finance',
  })

  const micro = rollMicroEvent(next)
  next = micro.state

  let crisisQueued = false
  const crisis = next.status === 'active' ? pickCrisis(next, difficulty.crisisMult) : null
  if (crisis) {
    const pending: CrisisState = {
      id: crisis.id,
      month: next.month,
      title: crisis.title,
      kicker: crisis.kicker,
      body: crisis.body,
      options: crisis.options,
    }
    next = {
      ...next,
      pendingCrisis: pending,
      seenCrises: [...next.seenCrises, crisis.id],
    }
    next = addLog(next, {
      month: next.month,
      title: `Crisis: ${crisis.title}`,
      detail: crisis.kicker,
      tone: 'bad',
      kind: 'crisis',
    })
    crisisQueued = true
  }

  const newAchievements = next.achievements.filter((id) => !state.achievements.includes(id))

  const report: MonthReport = {
    month,
    cashStart,
    cashEnd: next.cash,
    revenue,
    costs,
    net: revenue - costs + pipeline.cash,
    payroll: payrollBefore,
    overhead,
    interest,
    newCustomers,
    churned,
    customersEnd: customers,
    quality: next.quality,
    reputation: next.reputation,
    morale: next.morale,
    headline,
    insights,
    crisisQueued,
    newAchievements,
    drivers: drivers.slice(0, 6),
    training: trainingBudget,
    stockout,
    dealsWon: pipeline.won,
    branchDemand,
    invoiced,
    collected: cashSales + settlement.collected,
    receivables: next.receivables,
    overdue: invoices.filter((invoice) => invoice.status === 'overdue').length,
    billed,
    billsPaid: billSettlement.paid,
    payables,
    lateFees,
    depreciation,
    badDebt,
    netProfit: statement.income.netProfit,
  }

  next = { ...next, lastReport: report }

  return next
}

/**
 * Advance one day. The day counter is always within the month (1..30) so it
 * matches what the server accepts, and a pending crisis blocks the clock
 * instead of silently rolling the month over.
 */
export function advanceDay(state: GameState): GameState {
  if (state.status !== 'active' || state.pendingCrisis) return state
  const day = Math.min(Math.max(1, Math.round(state.day ?? 1)), DAYS_PER_MONTH)
  if (day >= DAYS_PER_MONTH) {
    const closed = advanceMonth({ ...state, day })
    if (closed === state) return state
    return { ...closed, day: 1 }
  }
  return { ...state, day: day + 1 }
}

function unlock(state: GameState, achievement: string): GameState {
  if (state.achievements.includes(achievement)) return state
  return {
    ...state,
    achievements: [...state.achievements, achievement],
    log: [
      {
        id: uid(),
        month: state.month,
        title: `Achievement: ${ACHIEVEMENTS[achievement]?.label ?? achievement}`,
        detail: ACHIEVEMENTS[achievement]?.description,
        tone: 'good' as Tone,
        kind: 'milestone' as const,
      },
      ...state.log,
    ].slice(0, 80),
  }
}

export function resolveCrisis(state: GameState, optionId: string): GameState {
  if (!state.pendingCrisis) return state
  const option = state.pendingCrisis.options.find((item) => item.id === optionId)
  if (!option) return state
  let next = applyEffects(
    { ...state, pendingCrisis: null },
    option.effects,
  )
  next = {
    ...next,
    pendingCrisis: null,
    valuation: next.status === 'active' ? computeValuation(next) : next.valuation,
  }
  next = addLog(next, {
    month: state.month,
    title: `Decision: ${option.label}`,
    detail: option.result,
    tone: option.tone,
    kind: 'crisis',
  })
  if (next.status === 'acquired') {
    next = addLog(next, {
      month: state.month,
      title: 'The run ends in an acquisition',
      detail: next.endedReason,
      tone: 'good',
      kind: 'milestone',
    })
  }
  return next
}

export function hireCandidate(state: GameState, candidateId: string): GameState {
  const candidate = state.candidates.find((item) => item.id === candidateId)
  if (!candidate) return state
  let next: GameState = {
    ...state,
    cash: state.cash - candidate.signingBonus,
    flows: recordFlow(state, 'expenses', candidate.signingBonus),
    team: [...state.team, makeEmployee(candidate, state.month)],
    candidates: state.candidates.filter((item) => item.id !== candidateId),
    morale: clamp(state.morale + 1, 0, 100),
  }
  next = { ...next, valuation: computeValuation(next) }
  next = unlock(next, 'first_hire')
  return addLog(next, {
    month: state.month,
    title: `Hired ${candidate.name}`,
    detail: `${roleById(candidate.role).name} · ${money(candidate.salary)}/mo · skill ${candidate.skill.toFixed(1)}/10`,
    tone: 'good',
    kind: 'team',
  })
}

export function fireEmployee(state: GameState, employeeId: string): GameState {
  const member = state.team.find((item) => item.id === employeeId)
  if (!member) return state
  let next: GameState = {
    ...state,
    cash: state.cash - member.salary,
    flows: recordFlow(state, 'expenses', member.salary),
    team: state.team.filter((item) => item.id !== employeeId),
    morale: clamp(state.morale - 6, 0, 100),
    reputation: clamp(state.reputation - 1, 0, 100),
  }
  next = { ...next, valuation: computeValuation(next) }
  return addLog(next, {
    month: state.month,
    title: `${member.name} left the team`,
    detail: `One month severance (${money(member.salary)}). The team feels it.`,
    tone: 'bad',
    kind: 'team',
  })
}

export function refreshCandidates(state: GameState): GameState {
  return {
    ...state,
    cash: state.cash - 500,
    flows: recordFlow(state, 'expenses', 500),
    candidates: makeCandidatePool(rngFor(state.seed ?? 0, 'pool-refresh', state.month, Math.round(state.cash))),
  }
}

export function offerRound(state: GameState): GameState {
  if (state.month < 3) return state
  const metrics = getMetrics(state)
  const valuation = computeValuation(state)
  const tractionBonus = clamp(metrics.mrr / 800, 0, 1.6)
  const rng = rngFor(state.seed ?? 0, 'offers', state.month)
  const funds = shuffledWith(rng, FUNDS).slice(0, 2)
  const offers: InvestorOffer[] = funds.map((fund, index) => {
    const preMoney = Math.round((valuation * randWith(rng, 0.85, 1.25) * (1 + tractionBonus * 0.25)) / 50_000) * 50_000
    const target = index === 0 ? randWith(rng, 0.1, 0.18) : randWith(rng, 0.07, 0.14)
    const amount = Math.max(125_000, Math.round((preMoney * target) / 25_000) * 25_000)
    const equity = clamp(amount / (preMoney + amount), 0.03, 0.35)
    const terms = [
      '1x non-participating preference',
      equity > 0.14 ? '1 board seat' : 'Board observer',
      'Pro-rata follow-on rights',
      index === 0 ? 'Quarterly investor updates' : 'Monthly investor updates',
    ]
    return {
      id: uid(),
      fund: fund.fund,
      partner: fund.partner,
      amount,
      equity,
      valuation: preMoney,
      terms,
      vibe: fund.vibe,
    }
  })
  return { ...state, offers }
}

export function acceptOffer(state: GameState, offerId: string): GameState {
  const offer = state.offers.find((item) => item.id === offerId)
  if (!offer) return state
  const next: GameState = {
    ...state,
    cash: state.cash + offer.amount,
    flows: recordFlow(state, 'funding', offer.amount),
    founderEquity: Math.round(state.founderEquity * (1 - offer.equity) * 10) / 10,
    valuation: offer.valuation + offer.amount,
    totalRaised: state.totalRaised + offer.amount,
    lastRoundMonth: state.month,
    reputation: clamp(state.reputation + 6, 0, 100),
    morale: clamp(state.morale + 4, 0, 100),
    offers: [],
  }
  return addLog(unlock(next, 'first_raise'), {
    month: state.month,
    title: `Raised ${money(offer.amount)} from ${offer.fund}`,
    detail: `${(offer.equity * 100).toFixed(1)}% equity at a ${money(offer.valuation, { compact: true })} pre-money valuation.`,
    tone: 'good',
    kind: 'funding',
  })
}

export function declineOffers(state: GameState): GameState {
  return { ...state, offers: [] }
}

export function takeLoan(state: GameState, amount: number): GameState {
  const max = maxLoan(state)
  const loan = Math.min(Math.max(0, Math.round(amount)), max)
  if (loan <= 0) return state
  let next: GameState = {
    ...state,
    cash: state.cash + loan,
    debt: state.debt + loan,
    flows: recordFlow(state, 'borrow', loan),
  }
  next = { ...next, valuation: computeValuation(next) }
  return addLog(next, {
    month: state.month,
    title: `Borrowed ${money(loan)} from Meridian Bank`,
    detail: `1.8% monthly interest. Debt outstanding: ${money(next.debt)}.`,
    tone: 'neutral',
    kind: 'finance',
  })
}

export function repayDebt(state: GameState, amount: number): GameState {
  const repayment = Math.min(Math.max(0, Math.round(amount)), state.debt, state.cash)
  if (repayment <= 0) return state
  let next: GameState = {
    ...state,
    cash: state.cash - repayment,
    debt: state.debt - repayment,
    flows: recordFlow(state, 'repay', repayment),
  }
  next = { ...next, valuation: computeValuation(next) }
  return addLog(next, {
    month: state.month,
    title: `Repaid ${money(repayment)} of debt`,
    detail: next.debt > 0 ? `${money(next.debt)} still outstanding.` : 'Debt-free. The balance sheet breathes.',
    tone: 'good',
    kind: 'finance',
  })
}

export function maxLoan(state: GameState) {
  const mrr = state.customers * state.price
  const limit = clamp(mrr * 8, 20_000, 300_000)
  return Math.max(0, Math.round((limit - state.debt) / 1_000) * 1_000)
}

export function setPrice(state: GameState, price: number): GameState {
  const industry = industryById(state.industry)
  return { ...state, price: clamp(Math.round(price), industry.priceMin, industry.priceMax) }
}

export function setMarketing(state: GameState, amount: number): GameState {
  return { ...state, marketingSpend: clamp(Math.round(amount), 0, 20_000) }
}

export function setProduct(state: GameState, amount: number): GameState {
  return { ...state, productSpend: clamp(Math.round(amount), 0, 25_000) }
}

export function setTraining(state: GameState, amount: number): GameState {
  return { ...state, trainingSpend: clamp(Math.round(amount), 0, 15_000) }
}

export function setRestock(state: GameState, months: number): GameState {
  return { ...state, restockMonths: clamp(Math.round(months), 0, 3) }
}

export function selectSupplier(state: GameState, supplierId: string): GameState {
  const supplier = state.suppliers?.find((item) => item.id === supplierId)
  if (!supplier) return state
  return addLog(
    { ...state, supplierId },
    {
      month: state.month,
      title: `Supplier switched to ${supplier.name}`,
      detail: `Cost index ${supplier.costIndex.toFixed(2)} · reliability ${Math.round(supplier.reliability * 100)}%.`,
      tone: 'neutral',
      kind: 'market',
    },
  )
}

export function toggleDealDiscount(state: GameState, dealId: string): GameState {
  return {
    ...state,
    pipeline: state.pipeline.map((deal) => (deal.id === dealId ? { ...deal, discount: !deal.discount } : deal)),
  }
}

export function pushDeal(state: GameState, dealId: string): GameState {
  const deal = state.pipeline.find((item) => item.id === dealId)
  if (!deal || deal.pushed || state.cash < 1_200) return state
  return addLog(
    {
      ...state,
      cash: state.cash - 1_200,
      flows: recordFlow(state, 'expenses', 1_200),
      pipeline: state.pipeline.map((item) =>
        item.id === dealId ? { ...item, chance: clamp(item.chance + 0.16, 0.08, 0.92), pushed: true } : item,
      ),
    },
    {
      month: state.month,
      title: `Pushed ${deal.company}`,
      detail: 'Dinner, a tailored deck and one more meeting. $1,200 spent.',
      tone: 'neutral',
      kind: 'market',
    },
  )
}

export function openBranch(state: GameState, branchId: string): GameState {
  const branch = state.branches?.find((item) => item.id === branchId)
  if (!branch || branch.openedMonth !== null) return state
  if (state.month < branch.minMonth) return state
  if (state.cash < branch.launchCost) return state
  const next: GameState = {
    ...state,
    cash: state.cash - branch.launchCost,
    fixedAssets: (state.fixedAssets ?? 0) + branch.launchCost,
    flows: recordFlow(state, 'capex', branch.launchCost),
    branches: state.branches.map((item) =>
      item.id === branchId ? { ...item, openedMonth: state.month } : item,
    ),
  }
  return addLog(unlock(next, 'second_market'), {
    month: state.month,
    title: `Opened ${branch.name}`,
    detail: `${money(branch.launchCost)} launch cost · ${money(branch.overhead)}/mo overhead · +${branch.demand} demand.`,
    tone: 'good',
    kind: 'milestone',
  })
}

export function buildInsights(state: GameState): string[] {
  const metrics = getMetrics(state)
  const industry = industryById(state.industry)
  const insights: string[] = []

  if (metrics.runway < 3 && metrics.burn > 0) {
    insights.push(`Runway is ${metrics.runway.toFixed(1)} months. Cut spend or raise before the next payroll.`)
  } else if (metrics.runway < 6 && metrics.burn > 0) {
    insights.push(`${metrics.runway.toFixed(1)} months of runway. A round or a loan would buy you time.`)
  }
  if (state.quality < 40) {
    insights.push('Quality is slipping. Churn follows quality with a lag — invest before you see it.')
  } else if (state.quality < 55 && state.productSpend < 4_000) {
    insights.push('Quality is drifting. Product investment or an engineer would protect retention.')
  }
  if (state.team.length > 0 && state.customers > (state.team.length + 3) * 60) {
    insights.push('You are serving more customers per teammate than the team can carry. Quality will suffer.')
  }
  if (metrics.churnRate > 0.1) {
    insights.push(`Churn is ${(metrics.churnRate * 100).toFixed(1)}%. Price and service are both worth a look.`)
  }
  if (state.team.length === 0 && state.month >= 2) {
    insights.push('You are doing every job yourself. One strong hire could unlock the next stage.')
  }
  if (metrics.teamSize > 0 && metrics.avgMorale < 55) {
    insights.push('Team morale is low. Overworked people ship worse work and leave first.')
  }
  if (state.debt > state.cash * 0.8 && state.debt > 0) {
    insights.push('Debt is close to your cash balance. Interest is quietly eating next month.')
  }
  if (state.marketingSpend === 0 && state.customers > 20) {
    insights.push('Marketing is off. Growth now depends entirely on word of mouth.')
  }
  if (state.price < industry.price * 0.75) {
    insights.push('You are priced well below market. Check whether volume is worth the margin.')
  }
  if (state.price > industry.price * 1.35) {
    insights.push('You are priced above the market. Quality and reputation have to carry it.')
  }
  if (metrics.growthRate > 0.12) {
    insights.push('Growth is accelerating. Make sure capacity can actually serve the demand.')
  }
  if (industry.inventory) {
    if (state.inventory < 0.8) {
      insights.push('You are out of stock. Restock before closing the month or demand walks out the door.')
    } else if (metrics.supplyRisk > 0.55) {
      insights.push('Supply risk is high. A more reliable supplier or more cover would protect sales.')
    } else if (state.inventory > 3.4) {
      insights.push('You are holding more stock than you need. Spoilage and holding costs are creeping in.')
    }
  }
  if (metrics.pipelineValue > 0) {
    insights.push(`${money(metrics.pipelineValue, { compact: true })} of pipeline is in play. Push the deals closest to signing.`)
  }
  if (state.economy?.phase === 'recession') {
    insights.push('The economy is in recession. Protect cash and your best customers before chasing growth.')
  } else if (state.economy?.phase === 'slowdown') {
    insights.push('Demand is slowing. Churn will tick up — service and retention are worth more than new logos.')
  }
  if (metrics.competitorPressure > 0.55) {
    insights.push('Competitors are pressing on price and quality. Your differentiation needs to be obvious.')
  }
  if (state.team.length >= 3 && (state.trainingSpend ?? 0) === 0) {
    insights.push('Nobody is learning anything new. A training budget compounds through the team.')
  }
  if (openBranches(state).length > 0 && metrics.avgMorale < 52) {
    insights.push('Branches are straining the core team. One more operator would take the load off.')
  }
  if (!insights.length) {
    insights.push('The basics look steady. Pick one constraint and push it harder this month.')
  }
  return insights.slice(0, 3)
}

export function getGrade(score: number) {
  if (score >= 90) return { grade: 'A+', label: 'Operator' }
  if (score >= 75) return { grade: 'A', label: 'Compounder' }
  if (score >= 60) return { grade: 'B', label: 'Builder' }
  if (score >= 45) return { grade: 'C', label: 'Survivor' }
  if (score >= 30) return { grade: 'D', label: 'Scrapper' }
  return { grade: 'E', label: 'Lesson earned' }
}

export function performanceScore(state: GameState) {
  return Math.round(clamp(computeScore(state), 0, 100))
}

export const ALL_INDUSTRIES = INDUSTRIES
export const ALL_STRATEGIES = STRATEGIES

export function normalizeGame(raw: Partial<GameState>): GameState {
  const game = raw as GameState
  const industry = industryById(game.industry)
  const economyOffset = game.economyOffset ?? 0
  const suppliers = game.suppliers?.length ? game.suppliers : makeSuppliers(game.industry)
  const savedProgress = game.beginner
  const freshProgress = createBeginnerProgress()
  const completedIds = new Set(savedProgress?.levels?.flatMap((level) => level.missions.filter((mission) => mission.status === 'completed').map((mission) => mission.missionId)) ?? [])
  const migratedProgress: BeginnerProgress = savedProgress
    ? { ...freshProgress, ...savedProgress, levels: freshProgress.levels.map((level) => ({ ...level, status: level.levelNumber < (savedProgress.currentLevel ?? 1) ? 'completed' as const : level.levelNumber === (savedProgress.currentLevel ?? 1) ? 'available' as const : 'locked' as const, missions: level.missions.map((mission) => ({ ...mission, status: completedIds.has(mission.missionId) ? 'completed' as const : level.levelNumber <= (savedProgress.currentLevel ?? 1) ? 'available' as const : 'locked' as const })) })) }
    : freshProgress
  return {
    ...game,
    version: SAVE_VERSION,
    seed: game.seed ?? hashSeed(game.company ?? 'businesslife', game.month ?? 0),
    journal: game.journal ?? [],
    journalComplete: game.journalComplete ?? ((game.journal?.length ?? 0) === 0 && (game.month ?? 0) === 0),
    startingCash: game.startingCash ?? game.cash ?? 0,
    invoices: game.invoices ?? [],
    receivables: game.receivables ?? 0,
    bills: game.bills ?? [],
    payables: game.payables ?? 0,
    inventoryValue: game.inventoryValue ?? 0,
    fixedAssets: game.fixedAssets ?? 0,
    paidInCapital: game.paidInCapital ?? game.cash ?? 0,
    retainedEarnings: game.retainedEarnings ?? 0,
    flows: game.flows ?? { capex: 0, funding: 0, borrow: 0, repay: 0, expenses: 0, otherIncome: 0 },
    statements: game.statements ?? [],
    authority: game.authority ?? undefined,
    beginner: migratedProgress,
    day: game.day ?? ((game.month ?? 0) * DAYS_PER_MONTH + 1),
    firstName: game.firstName ?? game.founder?.split(' ')[0] ?? 'Founder',
    lastName: game.lastName ?? game.founder?.split(' ').slice(1).join(' ') ?? '',
    nickname: game.nickname ?? game.founder?.split(' ')[0] ?? 'Founder',
    avatar: game.avatar ?? 'founder-1',
    accountEmail: game.accountEmail ?? '',
    missionEvidence: game.missionEvidence ?? [],
    founderBackground: game.founderBackground ?? 'operator',
    difficulty: game.difficulty ?? 'standard',
    trainingSpend: game.trainingSpend ?? 0,
    suppliers,
    supplierId: game.supplierId ?? suppliers[0].id,
    inventory: game.inventory ?? (industry.inventory ? 1.6 : 0),
    restockMonths: game.restockMonths ?? (industry.inventory ? 1 : 0),
    pipeline: game.pipeline ?? [],
    pipelineWon: game.pipelineWon ?? 0,
    competitors: game.competitors?.length ? game.competitors : makeCompetitors(game.industry),
    economy: game.economy ?? economyForMonth(game.month ?? 0, economyOffset),
    economyOffset,
    branches: game.branches?.length ? game.branches : BRANCH_OPTIONS.map((branch) => ({ ...branch })),
    team: (game.team ?? []).map((member) => ({
      ...member,
      level: member.level ?? 1,
      training: member.training ?? 0,
    })),
    lastReport: game.lastReport
      ? {
          ...game.lastReport,
          drivers: game.lastReport.drivers ?? [],
          training: game.lastReport.training ?? 0,
          stockout: game.lastReport.stockout ?? false,
          dealsWon: game.lastReport.dealsWon ?? 0,
          branchDemand: game.lastReport.branchDemand ?? 0,
        }
      : null,
  }
}
