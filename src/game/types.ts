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
  stageId: 'beginner'
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
}

export interface BeginnerLevelDefinition {
  levelId: string
  stageId: 'beginner'
  levelNumber: number
  name: string
  description: string
  learningObjective: string
  missions: BeginnerMissionDefinition[]
  completionRule: string
  nextUnlock?: string
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
}

export interface GameState {
  backendCompanyId?: string
  version: number
  status: GameStatus
  endedReason?: string
  founder: string
  founderBackground: FounderBackgroundId
  difficulty: DifficultyId
  company: string
  industry: IndustryId
  strategy: StrategyId
  month: number
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
