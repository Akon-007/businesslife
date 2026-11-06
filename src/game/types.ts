export type IndustryId = 'saas' | 'fnb' | 'retail' | 'logistics'
export type StrategyId = 'product' | 'sales' | 'community'
export type RoleId = 'engineer' | 'designer' | 'sales' | 'marketer' | 'ops'
export type Tone = 'good' | 'bad' | 'neutral'
export type GameStatus = 'active' | 'completed' | 'bankrupt' | 'acquired'
export type FounderBackgroundId = 'operator' | 'builder' | 'seller' | 'analyst'
export type DifficultyId = 'guided' | 'standard' | 'hardcore'
export type EconomyPhase = 'boom' | 'steady' | 'slowdown' | 'recession'
export type DealStage = 'lead' | 'qualified' | 'negotiation'
export type MissionStatus = 'locked' | 'available' | 'active' | 'submitted' | 'under_review' | 'completed' | 'rejected' | 'failed' | 'expired' | 'cancelled' | 'blocked'

export interface BeginnerMissionProgress {
  missionId: string
  status: MissionStatus
  completedAtMonth?: number
}

export interface BeginnerLevelProgress {
  levelNumber: number
  status: 'locked' | 'available' | 'active' | 'completed'
  missions: BeginnerMissionProgress[]
  completedAtMonth?: number
}

export interface BeginnerProgress {
  stageId: string
  xp: number
  reputation: number
  currentLevel: number
  levels: BeginnerLevelProgress[]
}

export interface BeginnerMissionDefinition {
  id: string
  name: string
  description: string
  type: 'decision' | 'research' | 'planning' | 'compliance' | 'finance' | 'people' | 'fundraising' | 'operations' | 'governance' | 'sales'
  reward: { xp: number; reputation: number }
  mandatory?: boolean
  prerequisites?: string[]
  playerAction?: string
  completionCriteria?: string[]
  failureRoutes?: string[]
}

export interface BeginnerLevelDefinition {
  levelId: string
  stageId: string
  levelNumber: number
  name: string
  description: string
  learningObjective: string
  chapter?: string
  missions: BeginnerMissionDefinition[]
  completionRule: string
  nextUnlock?: string
  entryConditions?: string[]
  completionRules?: string[]
  failureRoutes?: string[]
  engineDependencies?: string[]
  nextUnlocks?: string[]
}

export interface Industry {
  id: IndustryId
  name: string
  tagline: string
  customerNoun: string
  customerNounPlural: string
  priceLabel: string
  price: number
  priceMin: number
  priceMax: number
  startingCash: number
  startingCustomers: number
  startingQuality: number
  churn: number
  fixedCosts: number
  costPerCustomer: number
  marketReach: number
  revenueMultiple: number
  salesCycle: string
  strengths: string[]
  inventory: boolean
  supplierLabel: string
  pipelineLabel: string
  rule: string
}

export interface Supplier {
  id: string
  name: string
  blurb: string
  costIndex: number
  reliability: number
  quality: number
  leadMonths: number
}

export interface Deal {
  id: string
  company: string
  contact: string
  customers: number
  value: number
  stage: DealStage
  chance: number
  monthsOpen: number
  discount: boolean
  pushed?: boolean
}

export interface Competitor {
  id: string
  name: string
  archetype: 'discounter' | 'premium' | 'fast-follower'
  priceIndex: number
  quality: number
  share: number
  lastMove: string
}

export interface EconomyState {
  phase: EconomyPhase
  label: string
  monthsInPhase: number
  demand: number
  churn: number
  valuation: number
}

export interface Branch {
  id: string
  name: string
  district: string
  blurb: string
  launchCost: number
  overhead: number
  demand: number
  minMonth: number
  openedMonth: number | null
}

export interface RoleDef {
  id: RoleId
  name: string
  blurb: string
  salaryMin: number
  salaryMax: number
}

export interface Candidate {
  id: string
  name: string
  role: RoleId
  skill: number
  salary: number
  signingBonus: number
  background: string
  quirk: string
}

export interface Employee {
  id: string
  name: string
  role: RoleId
  skill: number
  salary: number
  morale: number
  joinedMonth: number
  background: string
  level: number
  training: number
}

export interface Effects {
  cash?: number
  customersPct?: number
  customersAdd?: number
  quality?: number
  reputation?: number
  morale?: number
  debt?: number
  marketing?: number
  valuationMult?: number
  acquisitionMult?: number
  status?: 'acquired'
}

export interface CrisisOption {
  id: string
  label: string
  detail: string
  result: string
  effects: Effects
  tone: Tone
}

export interface CrisisDef {
  id: string
  title: string
  kicker: string
  body: string
  minMonth?: number
  weight: number
  requires?: (state: GameState) => boolean
  options: CrisisOption[]
}

export interface CrisisState {
  id: string
  month: number
  title: string
  kicker: string
  body: string
  options: CrisisOption[]
}

export interface InvestorOffer {
  id: string
  fund: string
  partner: string
  amount: number
  equity: number
  valuation: number
  terms: string[]
  vibe: string
}

export interface LogEntry {
  id: string
  month: number
  title: string
  detail?: string
  tone: Tone
  kind: 'finance' | 'team' | 'market' | 'funding' | 'crisis' | 'milestone' | 'world'
}

/**
 * Customer invoices. Revenue is recognised when the sale happens; cash only
 * arrives when the invoice is due and paid. That gap is the receivable.
 */
export interface Invoice {
  id: string
  /** Game month the sale happened in (0-based, matches GameState.month). */
  issuedMonth: number
  /** Game month the money is expected. */
  dueMonth: number
  amount: number
  terms: 0 | 15 | 30 | 45
  customer: string
  status: 'open' | 'overdue' | 'paid'
  paidMonth: number | null
  /** Cash actually collected — late payers can settle short. */
  collected: number
}

/**
 * Supplier bills. Stock is often bought on account: the cost is expensed when
 * the goods are used, but cash leaves when the bill falls due.
 */
export interface Bill {
  id: string
  issuedMonth: number
  dueMonth: number
  amount: number
  vendor: string
  status: 'open' | 'overdue' | 'paid'
  paidMonth: number | null
  paid: number
  /** Late-payment fee charged when the bill missed its due date. */
  lateFee: number
}

/** Money that moved between closes: capex, funding, borrowing, repayments. */
export interface FlowBucket {
  capex: number
  funding: number
  borrow: number
  repay: number
  /** One-off cash costs between closes (signing bonus, crisis spend, …). */
  expenses: number
  /** One-off cash income between closes (crisis upside, asset sales, …). */
  otherIncome: number
}

export interface IncomeStatement {
  revenue: number
  cogs: number
  grossProfit: number
  payroll: number
  overhead: number
  marketing: number
  product: number
  training: number
  depreciation: number
  interest: number
  spoilage: number
  badDebt: number
  lateFees: number
  otherExpenses: number
  otherIncome: number
  operatingProfit: number
  netProfit: number
}

export interface BalanceSheet {
  cash: number
  receivables: number
  inventory: number
  fixedAssets: number
  totalAssets: number
  payables: number
  debt: number
  totalLiabilities: number
  paidInCapital: number
  retainedEarnings: number
  totalEquity: number
  liabilitiesAndEquity: number
  /** Assets − (liabilities + equity). Should be ~0; shown so the learner can check. */
  imbalance: number
}

export interface CashFlowStatement {
  openingCash: number
  cashSales: number
  collections: number
  stockPaid: number
  billsPaid: number
  payroll: number
  overhead: number
  interest: number
  spoilage: number
  lateFees: number
  otherExpenses: number
  otherIncome: number
  operating: number
  capex: number
  investing: number
  funding: number
  borrow: number
  repay: number
  financing: number
  netChange: number
  closingCash: number
}

export interface Statements {
  month: number
  income: IncomeStatement
  balance: BalanceSheet
  cashFlow: CashFlowStatement
}

export interface Snapshot {
  month: number
  cash: number
  revenue: number
  costs: number
  customers: number
  valuation: number
  reputation: number
  morale: number
  quality: number
  /** Cash collected from customers this month (revenue is accrued). */
  collected?: number
  /** Invoiced but not yet collected at month close. */
  receivables?: number
}

export interface ServerAuthority {
  score: number
  month: number
  cash: number
  commits: number
  updatedAt: string
  integrity: 'verified' | 'flagged' | 'unknown'
  readOnly: boolean
}

export type GameOpName =
  | 'advanceDay'
  | 'resolveCrisis'
  | 'hireCandidate'
  | 'fireEmployee'
  | 'refreshCandidates'
  | 'offerRound'
  | 'acceptOffer'
  | 'declineOffers'
  | 'takeLoan'
  | 'repayDebt'
  | 'setPrice'
  | 'setMarketing'
  | 'setProduct'
  | 'setTraining'
  | 'selectSupplier'
  | 'setRestock'
  | 'toggleDealDiscount'
  | 'pushDeal'
  | 'openBranch'
  | 'missionEvidence'

/**
 * One recorded decision. The journal is append-only: replaying the seed plus
 * this list reproduces the run exactly, which is what the server checks.
 */
export interface GameOp {
  op: GameOpName
  args?: Record<string, unknown>
}

export interface GameState {
  backendCompanyId?: string
  authority?: ServerAuthority
  /** Seed for the deterministic engine. Same seed + same decisions = same run. */
  seed: number
  /** Append-only record of the decisions that produced this state. */
  journal: GameOp[]
  /**
   * False for runs that were already in progress before the journal existed:
   * their journal starts mid-run, so the server cannot replay them from zero.
   */
  journalComplete?: boolean
  /** Cash the run actually began with (scenario starting capital or derived). */
  startingCash: number
  version: number
  status: GameStatus
  endedReason?: string
  founder: string
  firstName: string
  lastName: string
  nickname: string
  avatar: string
  accountEmail: string
  founderBackground: FounderBackgroundId
  difficulty: DifficultyId
  company: string
  industry: IndustryId
  strategy: StrategyId
  month: number
  day: number
  cash: number
  debt: number
  customers: number
  price: number
  quality: number
  reputation: number
  morale: number
  marketingSpend: number
  productSpend: number
  trainingSpend: number
  valuation: number
  founderEquity: number
  team: Employee[]
  candidates: Candidate[]
  offers: InvestorOffer[]
  lastRoundMonth: number
  totalRaised: number
  emergencyLoans: number
  pendingCrisis: CrisisState | null
  /** Outstanding customer invoices, oldest first. */
  invoices: Invoice[]
  /** Total ₦ invoiced and not yet collected. */
  receivables: number
  /** Outstanding supplier bills, oldest first. */
  bills: Bill[]
  /** Total ₦ owed to suppliers. */
  payables: number
  /** Inventory at cost. */
  inventoryValue: number
  /** Accumulated branch/expansion capex, net of depreciation. */
  fixedAssets: number
  /** Capital the founders and investors have put in. */
  paidInCapital: number
  /** Lifetime profit kept in the business. */
  retainedEarnings: number
  /** Money moved between closes, for the cash-flow statement. */
  flows: FlowBucket
  /** Latest statements, one per closed month (newest last, capped). */
  statements: Statements[]
  seenCrises: string[]
  log: LogEntry[]
  history: Snapshot[]
  achievements: string[]
  lastReport: MonthReport | null
  suppliers: Supplier[]
  supplierId: string
  inventory: number
  restockMonths: number
  pipeline: Deal[]
  pipelineWon: number
  competitors: Competitor[]
  economy: EconomyState
  economyOffset: number
  branches: Branch[]
  beginner: BeginnerProgress
  missionEvidence: string[]
}

export interface MonthReport {
  month: number
  cashStart: number
  cashEnd: number
  revenue: number
  costs: number
  net: number
  payroll: number
  overhead: number
  interest: number
  newCustomers: number
  churned: number
  customersEnd: number
  quality: number
  reputation: number
  morale: number
  headline: string
  insights: string[]
  crisisQueued: boolean
  newAchievements: string[]
  drivers: string[]
  training: number
  stockout: boolean
  dealsWon: number
  branchDemand: number
  /** Accrual revenue vs cash actually banked this month. */
  invoiced: number
  collected: number
  receivables: number
  overdue: number
  /** Payables side of the ledger. */
  billed: number
  billsPaid: number
  payables: number
  lateFees: number
  depreciation: number
  badDebt: number
  netProfit: number
}

export interface GameMetrics {
  mrr: number
  arr: number
  monthlyCosts: number
  burn: number
  runway: number
  payroll: number
  teamSize: number
  avgMorale: number
  capacity: number
  salesPower: number
  marketingPower: number
  opsPower: number
  qualityPower: number
  priceFactor: number
  churnRate: number
  growthRate: number
  score: number
  inventoryCover: number
  supplyRisk: number
  pipelineValue: number
  economyDemand: number
  branchDemand: number
  competitorPressure: number
  trainingSpend: number
}
