/**
 * Scenario packs.
 *
 * A scenario is data, not code: a starting position, an assessment window, a
 * rule version and a small set of objectives that can be checked against the
 * final state. The instructor portal assigns one to a cohort; the same pack can
 * be played from the onboarding screen.
 *
 * Two rules keep this honest:
 *  - the pack never replaces the engine, it only seeds it (`applyScenario`)
 *  - every objective is measured from state the engine already produces, so a
 *    debrief cannot disagree with the run
 */
import type { DifficultyId, GameState, IndustryId, ScenarioState, StrategyId } from './types'

export interface ScenarioObjective {
  id: string
  label: string
  /** What is measured. Kept to fields the report already carries. */
  metric: 'cash' | 'customers' | 'reputation' | 'quality' | 'netProfit' | 'valuation' | 'monthsSurvived' | 'contracts'
  direction: 'atLeast' | 'atMost'
  target: number
  /** Shown when the objective is missed. */
  hint: string
}

export interface ScenarioPack {
  id: string
  title: string
  blurb: string
  industry: IndustryId
  strategy: StrategyId
  difficulty: DifficultyId
  /** Fixed so every cohort plays the same market. */
  seed: number
  /** Assessment window in months. */
  months: number
  /** Rules the run was scored under, so an old grade stays interpretable. */
  ruleVersion: string
  startingCash: number
  startingCustomers: number
  startingPrice?: number
  startingDebt?: number
  learningObjectives: string[]
  brief: string
  instructorNotes: string[]
  objectives: ScenarioObjective[]
  tags: string[]
}

/** Bumped whenever a rule change would alter how an old run scores. */
export const RULE_VERSION = '2026.11'

export const SCENARIOS: readonly ScenarioPack[] = [
  {
    id: 'cash-crunch',
    title: 'The cash crunch',
    blurb: 'Twelve weeks of runway, rent due, and a product people like. Survive first, grow second.',
    industry: 'retail',
    strategy: 'product',
    difficulty: 'hardcore',
    seed: 41_001,
    months: 6,
    ruleVersion: RULE_VERSION,
    startingCash: 95_000,
    startingCustomers: 62,
    startingDebt: 60_000,
    learningObjectives: [
      'Distinguish profit from cash and act on the difference',
      'Cut discretionary spend before taking emergency credit',
      'Protect the customer base while shrinking the cost base',
    ],
    brief:
      'You sell clothes people like but do not need this quarter. Cash is tight, a supplier is owed money, and the bank is watching. Every big move has to be paid for before month four.',
    instructorNotes: [
      'Look for whether they cut marketing or stock first — cutting stock hurts recovery.',
      'A run that takes two emergency loans has failed the cash objective even if it survives.',
    ],
    objectives: [
      { id: 'survive', label: 'Still trading at month 6', metric: 'monthsSurvived', direction: 'atLeast', target: 6, hint: 'The business has to be alive at the end of the window.' },
      { id: 'positive-cash', label: 'Close the window with positive cash', metric: 'cash', direction: 'atLeast', target: 1, hint: 'Negative cash at the end means the bank or a bailout is propping the run up.' },
      { id: 'no-shock', label: 'Reputation held above 40', metric: 'reputation', direction: 'atLeast', target: 40, hint: 'Cost-cutting that customers can see usually shows up in reputation first.' },
    ],
    tags: ['cash', 'turnaround'],
  },
  {
    id: 'growth-engine',
    title: 'The growth engine',
    blurb: 'A working product and a marketing budget. Grow without buying growth you cannot keep.',
    industry: 'saas',
    strategy: 'sales',
    difficulty: 'standard',
    seed: 42_002,
    months: 9,
    ruleVersion: RULE_VERSION,
    startingCash: 190_000,
    startingCustomers: 38,
    learningObjectives: [
      'Build a marketing mix that pays for itself',
      'Read CAC against LTV before scaling spend',
      'Keep quality from falling as the customer base grows',
    ],
    brief:
      'You have nine months and a budget that could be spent ten different ways. The board wants growth, the customers want the product to keep working, and the bank wants neither at the cost of the other.',
    instructorNotes: [
      'Compare their CAC and LTV at month nine, not their customer count.',
      'A run that doubles customers while quality collapses has missed the point.',
    ],
    objectives: [
      { id: 'customers', label: 'Reach 120 customers', metric: 'customers', direction: 'atLeast', target: 120, hint: 'Growth is the brief — but only growth the operation can carry.' },
      { id: 'quality', label: 'Hold quality at 60 or better', metric: 'quality', direction: 'atLeast', target: 60, hint: 'Cheap growth usually shows up as a quality slide.' },
      { id: 'value', label: 'Close worth at least 1.5x your opening capital', metric: 'valuation', direction: 'atLeast', target: 285_000, hint: 'Value, not turnover, is what the round is buying.' },
    ],
    tags: ['growth', 'marketing'],
  },
  {
    id: 'capacity-wall',
    title: 'The capacity wall',
    blurb: 'Demand is pouring in and the depot cannot move it. Grow the operation, not just the order book.',
    industry: 'logistics',
    strategy: 'sales',
    difficulty: 'standard',
    seed: 43_003,
    months: 8,
    ruleVersion: RULE_VERSION,
    startingCash: 210_000,
    startingCustomers: 14,
    learningObjectives: [
      'Read capacity utilisation before promising delivery',
      'Trade capital spend against service quality',
      'Separate demand problems from fulfilment problems',
    ],
    brief:
      'Every new account is another van you do not have. You can sell the capacity you want or buy the capacity you sell — but not for free, and not late.',
    instructorNotes: [
      'Ask what they did in the month utilisation first passed 100%.',
      'Refunds and reputation are the tell for unserved demand.',
    ],
    objectives: [
      { id: 'accounts', label: 'Serve 25 accounts', metric: 'customers', direction: 'atLeast', target: 25, hint: 'The book has to grow, not just the pipeline.' },
      { id: 'service', label: 'Keep reputation above 55', metric: 'reputation', direction: 'atLeast', target: 55, hint: 'Turning work away quietly is still turning work away.' },
      { id: 'solvent', label: 'Finish with positive cash', metric: 'cash', direction: 'atLeast', target: 1, hint: 'Capacity bought badly is just a bigger cost base.' },
    ],
    tags: ['operations', 'growth'],
  },
  {
    id: 'harvest',
    title: 'Harvest',
    blurb: 'Inputs are bought now, revenue arrives later. Survive the season between.',
    industry: 'agriculture',
    strategy: 'community',
    difficulty: 'hardcore',
    seed: 44_004,
    months: 6,
    ruleVersion: RULE_VERSION,
    startingCash: 150_000,
    startingCustomers: 18,
    learningObjectives: [
      'Plan cash around a harvest cycle rather than a monthly rhythm',
      'Decide how much to borrow against an uncertain yield',
      'Price offtake contracts against input-cost risk',
    ],
    brief:
      'You buy seed and inputs at the start of the season and get paid at the end of it. The gap in the middle is the whole test.',
    instructorNotes: [
      'Borrowing is legitimate here — borrowing without a repayment plan is not.',
      'Check whether they held cash through the lean month or sold forward at a discount.',
    ],
    objectives: [
      { id: 'survive', label: 'Still trading after the season', metric: 'monthsSurvived', direction: 'atLeast', target: 6, hint: 'Seasons end; the business has to as well.' },
      { id: 'cash', label: 'Close with positive cash', metric: 'cash', direction: 'atLeast', target: 1, hint: 'A good harvest with no cash left is a failed harvest.' },
      { id: 'distributors', label: 'Keep 20 distributors', metric: 'customers', direction: 'atLeast', target: 20, hint: 'Offtake relationships are the asset; do not spend them for one month.' },
    ],
    tags: ['seasonality', 'cash'],
  },
  {
    id: 'clinic-trust',
    title: 'Clinic trust',
    blurb: 'Cheap consumables would fix the margin and break the thing that keeps patients coming.',
    industry: 'healthcare',
    strategy: 'product',
    difficulty: 'standard',
    seed: 45_005,
    months: 9,
    ruleVersion: RULE_VERSION,
    startingCash: 230_000,
    startingCustomers: 16,
    learningObjectives: [
      'Weigh short-term margin against trust that compounds',
      'Read returns and quality as one signal, not two',
      'Price a sticky service without losing the panel',
    ],
    brief:
      'Your panels renew quietly as long as nothing goes wrong. A supplier is offering a 20% discount on consumables and asking for nothing in writing.',
    instructorNotes: [
      'The interesting decision is the supplier switch — ask them to defend it.',
      'Quality above 65 at month nine is the marker of a run that understood the brief.',
    ],
    objectives: [
      { id: 'quality', label: 'Hold quality at 65 or better', metric: 'quality', direction: 'atLeast', target: 65, hint: 'Quality is the product in healthcare; everything else is admin.' },
      { id: 'panels', label: 'Grow to 24 panels', metric: 'customers', direction: 'atLeast', target: 24, hint: 'Growth is expected — carefully.' },
      { id: 'profit', label: 'Earn a profit in the final month', metric: 'netProfit', direction: 'atLeast', target: 1, hint: 'Trust and margin are not opposites; a monthly loss at the end means neither was managed.' },
    ],
    tags: ['quality', 'trust'],
  },
  {
    id: 'factory-floor',
    title: 'Factory floor',
    blurb: 'A cost shock lands on a business with no room in the price. Rebuild the margin.',
    industry: 'manufacturing',
    strategy: 'product',
    difficulty: 'hardcore',
    seed: 46_006,
    months: 6,
    ruleVersion: RULE_VERSION,
    startingCash: 180_000,
    startingCustomers: 7,
    learningObjectives: [
      'Pass input-cost inflation through without losing volume',
      'Tell a margin problem apart from a volume problem',
      'Use capacity and suppliers as levers, not just costs',
    ],
    brief:
      'Your main input went up 15% last quarter and the buyers have contracts. You cannot cut your way out of this one alone.',
    instructorNotes: [
      'A price rise is usually correct here; a price rise with no marketing is usually not.',
      'Look at whether they changed supplier, price, or both.',
    ],
    objectives: [
      { id: 'margin', label: 'End the window profitable', metric: 'netProfit', direction: 'atLeast', target: 1, hint: 'The brief is margin recovery.' },
      { id: 'buyers', label: 'Keep at least 6 buyers', metric: 'customers', direction: 'atLeast', target: 6, hint: 'Margin won by losing the customer base is not margin.' },
      { id: 'quality', label: 'Hold quality above 55', metric: 'quality', direction: 'atLeast', target: 55, hint: 'Cheap inputs and rushed production show up here first.' },
    ],
    tags: ['margin', 'cost-shock'],
  },
  {
    id: 'cohort-growth',
    title: 'Cohort growth',
    blurb: 'A gentle first scenario: enrol, teach well, and keep the next cohort coming.',
    industry: 'education',
    strategy: 'community',
    difficulty: 'guided',
    seed: 47_007,
    months: 6,
    ruleVersion: RULE_VERSION,
    startingCash: 175_000,
    startingCustomers: 52,
    learningObjectives: [
      'Connect teaching quality to enrolment',
      'Spend on demand generation with a term calendar in mind',
      'Keep cash stable through a fee cycle',
    ],
    brief:
      'Your reputation is the enrolment funnel. Six months, two cohorts, one question: do they come back?',
    instructorNotes: [
      'This is the onboarding scenario — look for basic cash discipline, not cleverness.',
    ],
    objectives: [
      { id: 'learners', label: 'Reach 70 learners', metric: 'customers', direction: 'atLeast', target: 70, hint: 'Enrolment is the growth signal.' },
      { id: 'reputation', label: 'Reputation at 55 or better', metric: 'reputation', direction: 'atLeast', target: 55, hint: 'Word of mouth is the channel that matters here.' },
      { id: 'cash', label: 'Never run out of cash', metric: 'cash', direction: 'atLeast', target: 1, hint: 'Fees arrive in waves; costs do not.' },
    ],
    tags: ['starter', 'retention'],
  },
  {
    id: 'table-for-two',
    title: 'Table for two',
    blurb: 'A café with great food, thin margins and a competitor opening across the road.',
    industry: 'fnb',
    strategy: 'community',
    difficulty: 'standard',
    seed: 48_008,
    months: 6,
    ruleVersion: RULE_VERSION,
    startingCash: 130_000,
    startingCustomers: 140,
    learningObjectives: [
      'Manage perishable stock against demand',
      'Decide when a price rise is safer than a cost cut',
      'Build loyalty that survives a competitor',
    ],
    brief:
      'You are good at food and bad at spreadsheets. Someone with better spreadsheets is opening opposite you next month.',
    instructorNotes: [
      'Spoilage and stockouts in the same run is the classic failure here.',
    ],
    objectives: [
      { id: 'regulars', label: 'Keep 130 regulars', metric: 'customers', direction: 'atLeast', target: 130, hint: 'A competitor takes the customers you do not hold.' },
      { id: 'profit', label: 'Finish with a profitable month', metric: 'netProfit', direction: 'atLeast', target: 1, hint: 'Busy and unprofitable is still unprofitable.' },
      { id: 'quality', label: 'Quality above 55', metric: 'quality', direction: 'atLeast', target: 55, hint: 'Food businesses die of inconsistency before they die of price.' },
    ],
    tags: ['competition', 'food'],
  },
] as const

export const scenarioById = (id: string | undefined | null) =>
  id ? SCENARIOS.find((scenario) => scenario.id === id) ?? null : null

/** The slice of a pack a saved run carries with it. */
export function embedScenario(pack: ScenarioPack, startedMonth = 0): ScenarioState {
  return {
    id: pack.id,
    title: pack.title,
    ruleVersion: pack.ruleVersion,
    months: pack.months,
    startedMonth,
    learningObjectives: [...pack.learningObjectives],
  }
}

export interface ScenarioResult {
  objective: ScenarioObjective
  actual: number
  met: boolean
}

export interface ScenarioVerdict {
  scenarioId: string
  results: ScenarioResult[]
  met: number
  total: number
  passed: boolean
  monthsElapsed: number
  overdue: boolean
}

function metricValue(state: GameState, metric: ScenarioObjective['metric']): number {
  switch (metric) {
    case 'cash':
      return Math.round(state.cash)
    case 'customers':
      return Math.round(state.customers)
    case 'reputation':
      return Math.round(state.reputation)
    case 'quality':
      return Math.round(state.quality)
    case 'valuation':
      return Math.round(state.valuation)
    case 'netProfit':
      return Math.round(state.lastReport?.netProfit ?? 0)
    case 'contracts':
      return (state.contracts ?? []).filter((contract) => contract.monthsLeft > 0).length
    case 'monthsSurvived':
      return state.status === 'active' || state.status === 'completed' || state.status === 'acquired' ? state.month : 0
    default:
      return 0
  }
}

/** Score a run against its pack. Pure: the same state always gives the same verdict. */
export function evaluateScenario(state: GameState, pack: ScenarioPack): ScenarioVerdict {
  const elapsed = Math.max(0, state.month - (state.scenario?.startedMonth ?? 0))
  const results = pack.objectives.map((objective) => {
    const actual = metricValue(state, objective.metric)
    const met = objective.direction === 'atLeast' ? actual >= objective.target : actual <= objective.target
    return { objective, actual, met }
  })
  const met = results.filter((result) => result.met).length
  return {
    scenarioId: pack.id,
    results,
    met,
    total: results.length,
    passed: met === results.length,
    monthsElapsed: elapsed,
    overdue: state.status === 'active' && elapsed > pack.months,
  }
}
