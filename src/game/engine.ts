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
import type {
  Candidate,
  CrisisDef,
  CrisisState,
  Deal,
  DifficultyId,
  Effects,
  Employee,
  FounderBackgroundId,
  GameMetrics,
  GameState,
  IndustryId,
  InvestorOffer,
  LogEntry,
  MonthReport,
  RoleId,
  StrategyId,
  Tone,
} from './types'
import { clamp, money, number, pick, rand, uid } from '../lib/format'

export const RUN_LENGTH = 36
export const SAVE_VERSION = 2

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

export function makeCandidate(role?: RoleId): Candidate {
  const roleDef = role ? roleById(role) : pick(ROLES)
  const skill = Math.round(rand(2.5, 9.2) * 10) / 10
  const salary = Math.round((roleDef.salaryMin + (skill / 10) * (roleDef.salaryMax - roleDef.salaryMin)) / 100) * 100
  const { name, background, quirk } = randomCandidateName()
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

export function makeCandidatePool(seed?: number): Candidate[] {
  const count = seed ?? 5
  return Array.from({ length: count }, () => makeCandidate())
}

const DEAL_COMPANIES = [
  'Arden & Co.', 'Blue Harbour Group', 'Cedar Street Foods', 'Delta Freight', 'Everline Retail',
  'Foxglove Studio', 'Granite Partners', 'Harbourview Hotels', 'Ivy & Oak', 'Juniper Labs',
  'Kestrel Logistics', 'Linden Health', 'Mosaic Hotels', 'Northgate Group', 'Orchid Events',
]

const DEAL_CONTACTS = ['Ada', 'Tunde', 'Zainab', 'Kwame', 'Lina', 'Mateo', 'Priya', 'Noah', 'Nia', 'Omar']

export function makeDeal(industry: IndustryId, month: number): Deal {
  const def = industryById(industry)
  const customers = Math.max(1, Math.round(rand(2, 6) * (def.price > 300 ? 0.5 : 1) * (def.marketReach > 40 ? 8 : 1) * 0.12))
  const monthlyValue = customers * def.price
  return {
    id: uid(),
    company: pick(DEAL_COMPANIES),
    contact: `${pick(DEAL_CONTACTS)} ${pick(['Okafor', 'Mensah', 'Silva', 'Park', 'Haddad', 'Rossi', 'Chen'])}`,
    customers,
    value: Math.round((monthlyValue * rand(1.8, 4.2)) / 100) * 100,
    stage: month === 0 ? 'lead' : pick(['lead', 'qualified', 'negotiation'] as const),
    chance: Math.round(rand(0.24, 0.52) * 100) / 100,
    monthsOpen: 0,
    discount: false,
  }
}

export function startGame(input: {
  founder: string
  company: string
  industry: IndustryId
  strategy: StrategyId
  founderBackground?: FounderBackgroundId
  difficulty?: DifficultyId
}): GameState {
  const industry = industryById(input.industry)
  const strategy = strategyById(input.strategy)
  const background = founderBackgroundById(input.founderBackground ?? 'operator')
  const difficulty = difficultyById(input.difficulty ?? 'standard')
  const startingQuality = clamp(industry.startingQuality + strategy.starting.quality + background.starting.quality, 15, 85)
  const startingReputation = clamp(48 + strategy.starting.reputation + background.starting.reputation, 10, 80)
  const startingCash = Math.round(
    (industry.startingCash + strategy.starting.cash + background.starting.cash) * difficulty.cashMult,
  )
  const economyOffset = Math.floor(rand(0, 7))
  const suppliers = makeSuppliers(input.industry)

  const base: GameState = {
    version: SAVE_VERSION,
    status: 'active',
    founder: input.founder.trim() || 'Founder',
    founderBackground: background.id,
    difficulty: difficulty.id,
    company: input.company.trim() || 'Untitled Co.',
    industry: input.industry,
    strategy: input.strategy,
    month: 0,
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
    candidates: makeCandidatePool(),
    offers: [],
    lastRoundMonth: -3,
    totalRaised: 0,
    emergencyLoans: 0,
    pendingCrisis: null,
    seenCrises: [],
    log: [],
    history: [],
    achievements: [],
    lastReport: null,
    suppliers,
    supplierId: suppliers[0].id,
    inventory: industry.inventory ? 1.6 : 0,
    restockMonths: industry.inventory ? 1 : 0,
    pipeline: [makeDeal(input.industry, 0), makeDeal(input.industry, 0)],
    pipelineWon: 0,
    competitors: makeCompetitors(input.industry),
    economy: economyForMonth(0, economyOffset),
    economyOffset,
    branches: BRANCH_OPTIONS.map((branch) => ({ ...branch })),
  }

  const withValuation = { ...base, valuation: computeValuation(base) }
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

function computeScore(state: GameState) {
  const metrics = {
    arr: state.customers * state.price * 12,
  }
  return Math.max(
    0,
    Math.round(
      state.valuation / 1_500 +
        metrics.arr / 500 +
        state.customers * 0.8 +
        state.reputation * 14 +
        state.quality * 10 +
        state.cash / 2_000 +
        state.founderEquity * 1.2 -
        state.debt / 800 +
        sum(state.team.map((member) => member.skill)) * 7 +
        state.month * 25,
    ),
  )
}

export function applyEffects(state: GameState, effects: Effects): GameState {
  let next = { ...state }
  if (effects.cash) next.cash += effects.cash
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
  if (Math.random() > 0.22) return { state }
  const event = pick(WORLD_EVENTS)
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
  const chance = (state.month >= 12 ? 0.42 : 0.32) * multiplier
  if (Math.random() > chance) return null
  const eligible = CRISES.filter((crisis) => {
    if ((crisis.minMonth ?? 0) > state.month) return false
    if (crisis.requires && !crisis.requires(state)) return false
    return true
  })
  if (!eligible.length) return null
  const unseen = eligible.filter((crisis) => !state.seenCrises.includes(crisis.id))
  const pool = unseen.length ? unseen : eligible
  const total = sum(pool.map((crisis) => crisis.weight))
  let ticket = Math.random() * total
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
  const kept: Deal[] = []
  const notes: string[] = []
  let cash = 0
  let customers = 0
  let won = 0

  for (const deal of state.pipeline ?? []) {
    let next: Deal = { ...deal, monthsOpen: deal.monthsOpen + 1 }
    if (next.stage === 'lead') {
      if (Math.random() < 0.58 + state.marketingSpend / 40_000) next.stage = 'qualified'
    } else if (next.stage === 'qualified') {
      if (Math.random() < 0.55) next.stage = 'negotiation'
    } else {
      const chance = clamp(next.chance + (next.discount ? 0.16 : 0), 0.08, 0.92)
      if (Math.random() < chance) {
        const payout = Math.round(next.value * (next.discount ? 0.9 : 1))
        cash += payout
        customers += next.customers
        won += 1
        notes.push(`${next.company} signed: ${money(payout)} and ${number(next.customers)} ${industry.customerNounPlural}.`)
        continue
      }
      next = { ...next, chance: clamp(next.chance - 0.06, 0.08, 0.92) }
      if (next.monthsOpen > 3 && Math.random() < 0.35) {
        notes.push(`${next.company} went with someone else.`)
        continue
      }
    }
    if (next.monthsOpen > 5) continue
    kept.push(next)
  }

  const leadChance = 0.28 + state.marketingSpend / 22_000 + (rolesPower(state, 'sales') > 0 ? 0.18 : 0)
  if (kept.length < 6 && Math.random() < leadChance) kept.push(makeDeal(state.industry, state.month))
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
  let cash = state.cash + revenue - costs + pipeline.cash

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
  const leavers = trainedTeam.filter(
    (member) => member.morale < 32 && Math.random() < 0.1 + (32 - member.morale) / 110,
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
    candidates: makeCandidatePool(),
    pipeline: pipeline.pipeline,
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

  if (cash < 0) {
    const shortfall = Math.abs(cash)
    const needed = Math.ceil((shortfall + 6_000) / 1_000) * 1_000
    cash += needed
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
  }

  next = { ...next, lastReport: report }

  if (next.month >= RUN_LENGTH && next.status === 'active') {
    next = {
      ...next,
      status: 'completed',
      endedReason: `You built ${next.company} for ${RUN_LENGTH} months.`,
    }
  }

  return next
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
    candidates: makeCandidatePool(),
  }
}

export function offerRound(state: GameState): GameState {
  if (state.month < 3) return state
  const metrics = getMetrics(state)
  const valuation = computeValuation(state)
  const tractionBonus = clamp(metrics.mrr / 800, 0, 1.6)
  const funds = [...FUNDS].sort(() => Math.random() - 0.5).slice(0, 2)
  const offers: InvestorOffer[] = funds.map((fund, index) => {
    const preMoney = Math.round((valuation * rand(0.85, 1.25) * (1 + tractionBonus * 0.25)) / 50_000) * 50_000
    const target = index === 0 ? rand(0.1, 0.18) : rand(0.07, 0.14)
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
  const raw = computeScore(state)
  return Math.round(clamp(raw / 70, 0, 100))
}

export const ALL_INDUSTRIES = INDUSTRIES
export const ALL_STRATEGIES = STRATEGIES

export function normalizeGame(raw: Partial<GameState>): GameState {
  const game = raw as GameState
  const industry = industryById(game.industry)
  const economyOffset = game.economyOffset ?? 0
  const suppliers = game.suppliers?.length ? game.suppliers : makeSuppliers(game.industry)
  return {
    ...game,
    version: SAVE_VERSION,
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
