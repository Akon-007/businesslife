import type {
  Branch,
  Competitor,
  CrisisDef,
  DifficultyId,
  EconomyPhase,
  EconomyState,
  FounderBackgroundId,
  Industry,
  IndustryId,
  RoleDef,
  StrategyId,
  Supplier,
} from './types'

export const INDUSTRIES: Industry[] = [
  {
    id: 'saas',
    name: 'SaaS & Software',
    tagline: 'B2B tools with recurring revenue and slow, compounding growth.',
    customerNoun: 'account',
    customerNounPlural: 'accounts',
    priceLabel: 'avg. revenue / account / mo',
    price: 79,
    priceMin: 29,
    priceMax: 299,
    startingCash: 170_000,
    startingCustomers: 36,
    startingQuality: 52,
    churn: 0.03,
    fixedCosts: 5_200,
    costPerCustomer: 4,
    marketReach: 14,
    revenueMultiple: 7,
    salesCycle: 'Weeks, not days',
    strengths: ['High margins', 'Recurring revenue', 'Strong exit multiples'],
    inventory: false,
    supplierLabel: 'Cloud & tooling vendors',
    pipelineLabel: 'Expansion deals',
    rule: 'Churn and uptime decide everything. Quality buys retention; outages cost accounts.',
  },
  {
    id: 'fnb',
    name: 'Food & Beverage',
    tagline: 'Cafés, kitchens and packaged food. Thin margins, loyal regulars.',
    customerNoun: 'regular',
    customerNounPlural: 'regulars',
    priceLabel: 'avg. spend / regular / mo',
    price: 26,
    priceMin: 10,
    priceMax: 70,
    startingCash: 140_000,
    startingCustomers: 160,
    startingQuality: 56,
    churn: 0.085,
    fixedCosts: 6_200,
    costPerCustomer: 6.5,
    marketReach: 62,
    revenueMultiple: 2.6,
    salesCycle: 'Immediate',
    strengths: ['Fast feedback', 'Cash at the counter', 'Local brand love'],
    inventory: true,
    supplierLabel: 'Food & produce suppliers',
    pipelineLabel: 'Catering contracts',
    rule: 'Stock is perishable: over-order and it spoils, under-order and regulars walk.',
  },
  {
    id: 'retail',
    name: 'Fashion & Retail',
    tagline: 'Products people wear, gift and show off. Taste is the moat.',
    customerNoun: 'customer',
    customerNounPlural: 'customers',
    priceLabel: 'avg. order value / customer / mo',
    price: 79,
    priceMin: 30,
    priceMax: 220,
    startingCash: 140_000,
    startingCustomers: 85,
    startingQuality: 50,
    churn: 0.055,
    fixedCosts: 5_600,
    costPerCustomer: 16,
    marketReach: 34,
    revenueMultiple: 3.2,
    salesCycle: 'Days',
    strengths: ['Brand-led pricing', 'Seasonal spikes', 'Social distribution'],
    inventory: true,
    supplierLabel: 'Apparel suppliers',
    pipelineLabel: 'Wholesale deals',
    rule: 'Inventory turns and seasons rule the year. Stockouts lose sales you cannot recover.',
  },
  {
    id: 'logistics',
    name: 'Logistics & Delivery',
    tagline: 'Move things for other businesses. Operations is everything.',
    customerNoun: 'account',
    customerNounPlural: 'accounts',
    priceLabel: 'avg. contract / account / mo',
    price: 900,
    priceMin: 300,
    priceMax: 3_000,
    startingCash: 205_000,
    startingCustomers: 9,
    startingQuality: 54,
    churn: 0.026,
    fixedCosts: 9_500,
    costPerCustomer: 150,
    marketReach: 4,
    revenueMultiple: 4,
    salesCycle: '1–3 months',
    strengths: ['Sticky contracts', 'Defensible density', 'Operational moats'],
    inventory: true,
    supplierLabel: 'Fleet & parts suppliers',
    pipelineLabel: 'Freight contracts',
    rule: 'Utilisation pays for the fleet. Empty capacity is a cost you already committed to.',
  },
]

export const industryById = (id: IndustryId) => INDUSTRIES.find((industry) => industry.id === id)!

export const ROLES: RoleDef[] = [
  { id: 'engineer', name: 'Engineer', blurb: 'Ships the product. Raises quality and capacity.', salaryMin: 4_800, salaryMax: 8_800 },
  { id: 'designer', name: 'Designer', blurb: 'Improves the experience and the brand people talk about.', salaryMin: 3_000, salaryMax: 5_600 },
  { id: 'sales', name: 'Sales lead', blurb: 'Wins new customers and keeps the pipeline honest.', salaryMin: 3_500, salaryMax: 6_500 },
  { id: 'marketer', name: 'Marketer', blurb: 'Makes every marketing dollar work harder.', salaryMin: 3_600, salaryMax: 6_800 },
  { id: 'ops', name: 'Operator', blurb: 'Keeps service tight, churn low and the team sane.', salaryMin: 3_000, salaryMax: 5_600 },
]

export const roleById = (id: RoleDef['id']) => ROLES.find((role) => role.id === id)!

export interface StrategyDef {
  id: StrategyId
  name: string
  tagline: string
  detail: string
  tradeoff: string
  starting: { quality: number; reputation: number; customers: number; cash: number }
  powers: { quality: number; sales: number; marketing: number; ops: number }
  accent: string
  soft: string
}

export const STRATEGIES: StrategyDef[] = [
  {
    id: 'product',
    name: 'Product-led',
    tagline: 'Build something people can’t stop recommending.',
    detail: 'Quality compounds. Customers stay longer. Growth starts slower.',
    tradeoff: 'Slower early growth',
    starting: { quality: 8, reputation: 2, customers: 0, cash: 0 },
    powers: { quality: 6, sales: 1, marketing: 3, ops: 3 },
    accent: '#0b8550',
    soft: '#d2f6e1',
  },
  {
    id: 'sales',
    name: 'Sales-led',
    tagline: 'Get in the room, tell the story, close the deal.',
    detail: 'Faster pipeline and more early customers, but quality lags.',
    tradeoff: 'Thinner margins',
    starting: { quality: -2, reputation: 0, customers: 10, cash: -5_000 },
    powers: { quality: 2, sales: 7, marketing: 4, ops: 2 },
    accent: '#2f80c7',
    soft: '#cbe8f7',
  },
  {
    id: 'community',
    name: 'Community-led',
    tagline: 'Turn early believers into your distribution engine.',
    detail: 'Strong reputation and cheaper marketing. Needs care to convert.',
    tradeoff: 'Volatile demand',
    starting: { quality: 0, reputation: 8, customers: 5, cash: 0 },
    powers: { quality: 3, sales: 4, marketing: 6, ops: 3 },
    accent: '#7c6cf6',
    soft: '#e8e4ff',
  },
]

export const strategyById = (id: StrategyId) => STRATEGIES.find((strategy) => strategy.id === id)!

export interface FounderBackgroundDef {
  id: FounderBackgroundId
  name: string
  tagline: string
  detail: string
  starting: { cash: number; customers: number; quality: number; reputation: number; morale: number }
  powers: { quality: number; sales: number; marketing: number; ops: number }
  accent: string
  soft: string
}

export const FOUNDER_BACKGROUNDS: FounderBackgroundDef[] = [
  {
    id: 'operator',
    name: 'Operator',
    tagline: 'You ran the floor before you ran the company.',
    detail: 'Service stays tight, churn stays low, the team trusts you.',
    starting: { cash: 0, customers: 0, quality: 0, reputation: 0, morale: 6 },
    powers: { quality: 0, sales: 0, marketing: 0, ops: 2.5 },
    accent: '#0b8550',
    soft: '#d2f6e1',
  },
  {
    id: 'builder',
    name: 'Builder',
    tagline: 'You would rather ship the thing than talk about it.',
    detail: 'A stronger product from day one, at the cost of polish elsewhere.',
    starting: { cash: 0, customers: 0, quality: 7, reputation: 0, morale: 0 },
    powers: { quality: 2, sales: 0, marketing: 0, ops: 0 },
    accent: '#2f80c7',
    soft: '#cbe8f7',
  },
  {
    id: 'seller',
    name: 'Seller',
    tagline: 'You have never met a room you could not work.',
    detail: 'More demand early and a sharper close on every deal.',
    starting: { cash: 0, customers: 4, quality: 0, reputation: 2, morale: 0 },
    powers: { quality: 0, sales: 2, marketing: 1, ops: 0 },
    accent: '#c4811a',
    soft: '#fbe9c9',
  },
  {
    id: 'analyst',
    name: 'Analyst',
    tagline: 'You see the spreadsheet under the story.',
    detail: 'Better marketing efficiency and a little more capital to start.',
    starting: { cash: 15_000, customers: 0, quality: 0, reputation: 0, morale: 0 },
    powers: { quality: 0, sales: 0, marketing: 2, ops: 1 },
    accent: '#7c6cf6',
    soft: '#e8e4ff',
  },
]

export const founderBackgroundById = (id: FounderBackgroundId) =>
  FOUNDER_BACKGROUNDS.find((item) => item.id === id) ?? FOUNDER_BACKGROUNDS[0]

export interface DifficultyDef {
  id: DifficultyId
  name: string
  blurb: string
  cashMult: number
  crisisMult: number
  accent: string
  soft: string
}

export const DIFFICULTIES: DifficultyDef[] = [
  {
    id: 'guided',
    name: 'Guided',
    blurb: 'More starting cash, softer crises. Learn how the machine behaves.',
    cashMult: 1.2,
    crisisMult: 0.75,
    accent: '#0b8550',
    soft: '#d2f6e1',
  },
  {
    id: 'standard',
    name: 'Standard',
    blurb: 'The intended run. Every lever matters, nothing is scripted.',
    cashMult: 1,
    crisisMult: 1,
    accent: '#1c2a26',
    soft: '#e9eeea',
  },
  {
    id: 'hardcore',
    name: 'Hardcore',
    blurb: 'Thin cash, meaner shocks. For people who already know the ropes.',
    cashMult: 0.85,
    crisisMult: 1.3,
    accent: '#e05a3f',
    soft: '#fbe2dc',
  },
]

export const difficultyById = (id: DifficultyId) =>
  DIFFICULTIES.find((item) => item.id === id) ?? DIFFICULTIES[1]

export const SUPPLIER_POOLS: Record<IndustryId, Supplier[]> = {
  saas: [
    { id: 'nimbus', name: 'Nimbus Cloud', blurb: 'Cheap compute, occasional rough nights.', costIndex: 0.9, reliability: 0.78, quality: -2, leadMonths: 0 },
    { id: 'keystone', name: 'Keystone Infra', blurb: 'Reliable, expensive, boring in the best way.', costIndex: 1.1, reliability: 0.95, quality: 3, leadMonths: 1 },
    { id: 'brightstack', name: 'Brightstack', blurb: 'Fast support and flexible contracts.', costIndex: 1, reliability: 0.87, quality: 1, leadMonths: 0 },
  ],
  fnb: [
    { id: 'greenrow', name: 'Greenrow Produce', blurb: 'Excellent quality, short shelf life.', costIndex: 1.06, reliability: 0.8, quality: 4, leadMonths: 0 },
    { id: 'harbour-foods', name: 'Harbour Foods', blurb: 'Bulk pricing, consistent, no surprises.', costIndex: 0.9, reliability: 0.9, quality: -1, leadMonths: 1 },
    { id: 'dailypick', name: 'Daily Pick Co-op', blurb: 'Local growers, weather-dependent.', costIndex: 0.97, reliability: 0.72, quality: 2, leadMonths: 0 },
  ],
  retail: [
    { id: 'arden', name: 'Arden Textiles', blurb: 'Premium fabric and finishing.', costIndex: 1.12, reliability: 0.88, quality: 5, leadMonths: 1 },
    { id: 'quickstitch', name: 'Quickstitch', blurb: 'Fast, cheap, quality varies by batch.', costIndex: 0.86, reliability: 0.74, quality: -3, leadMonths: 0 },
    { id: 'meridian-mills', name: 'Meridian Mills', blurb: 'Steady mid-market supplier.', costIndex: 1, reliability: 0.9, quality: 1, leadMonths: 1 },
  ],
  logistics: [
    { id: 'durable', name: 'Durable Parts Co.', blurb: 'OEM parts, slower deliveries.', costIndex: 1.05, reliability: 0.93, quality: 3, leadMonths: 1 },
    { id: 'fleetfast', name: 'FleetFast Supply', blurb: 'Same-week parts, premium prices.', costIndex: 1.15, reliability: 0.85, quality: 1, leadMonths: 0 },
    { id: 'valuehaul', name: 'ValueHaul', blurb: 'Cheap, used where possible.', costIndex: 0.82, reliability: 0.7, quality: -4, leadMonths: 1 },
  ],
}

export const COMPETITOR_POOLS: Record<IndustryId, string[]> = {
  saas: ['Pilotboard', 'Harbourstack', 'Kestrel OS', 'Goodmatter'],
  fnb: ['Corner & Co.', 'Palm Street Kitchen', 'Daily Grind', 'Saltbox'],
  retail: ['Northline Threads', 'Mosaic Studio', 'The Wardrobe', 'Cedar & Sable'],
  logistics: ['Apex Freight', 'Blue Lane Logistics', 'Meridian Haul', 'Swift Dock'],
}

export function makeSuppliers(industry: IndustryId): Supplier[] {
  return SUPPLIER_POOLS[industry].map((supplier) => ({ ...supplier }))
}

export function makeCompetitors(industry: IndustryId): Competitor[] {
  const names = [...COMPETITOR_POOLS[industry]]
  const archetypes: Competitor['archetype'][] = ['discounter', 'premium', 'fast-follower']
  return names.slice(0, 3).map((name, index) => ({
    id: unicornId(index),
    name,
    archetype: archetypes[index],
    priceIndex: archetypes[index] === 'discounter' ? 0.78 : archetypes[index] === 'premium' ? 1.28 : 0.96,
    quality: archetypes[index] === 'discounter' ? 46 : archetypes[index] === 'premium' ? 72 : 58,
    share: archetypes[index] === 'discounter' ? 0.18 : archetypes[index] === 'premium' ? 0.12 : 0.15,
    lastMove: 'Watching the market.',
  }))
}

const unicornId = (index: number) => `comp-${index}-${Math.random().toString(36).slice(2, 6)}`

export const BRANCH_OPTIONS: Branch[] = [
  {
    id: 'harbour',
    name: 'Harbour District',
    district: 'Second location',
    blurb: 'A smaller market across the river. Cheap to test, slow to compound.',
    launchCost: 45_000,
    overhead: 2_400,
    demand: 6,
    minMonth: 4,
    openedMonth: null,
  },
  {
    id: 'northline',
    name: 'Northline',
    district: 'Growth market',
    blurb: 'Busier footfall and higher expectations. A real second base.',
    launchCost: 85_000,
    overhead: 4_200,
    demand: 11,
    minMonth: 8,
    openedMonth: null,
  },
  {
    id: 'meridian-west',
    name: 'Meridian West',
    district: 'Metro expansion',
    blurb: 'The big bet. Large demand, large overhead, no room for sloppy ops.',
    launchCost: 150_000,
    overhead: 7_000,
    demand: 18,
    minMonth: 14,
    openedMonth: null,
  },
]

const ECONOMY_SEQUENCE: { phase: EconomyPhase; months: number }[] = [
  { phase: 'steady', months: 5 },
  { phase: 'boom', months: 7 },
  { phase: 'slowdown', months: 6 },
  { phase: 'recession', months: 5 },
  { phase: 'steady', months: 7 },
  { phase: 'boom', months: 6 },
]

export const ECONOMY_COPY: Record<EconomyPhase, { label: string; blurb: string }> = {
  boom: { label: 'Boom', blurb: 'Demand is easy, valuations are generous, and everyone thinks they are a genius.' },
  steady: { label: 'Steady', blurb: 'Normal conditions. The business decides the outcome, not the market.' },
  slowdown: { label: 'Slowdown', blurb: 'Buyers hesitate and churn ticks up. Cash discipline starts to matter.' },
  recession: { label: 'Recession', blurb: 'Demand is scarce and investors are hiding. Survival is the strategy.' },
}

export function economyForMonth(month: number, offset = 0): EconomyState {
  const cycleLength = ECONOMY_SEQUENCE.reduce((total, item) => total + item.months, 0)
  let cursor = ((month + offset) % cycleLength + cycleLength) % cycleLength
  for (const segment of ECONOMY_SEQUENCE) {
    if (cursor < segment.months) {
      const copy = ECONOMY_COPY[segment.phase]
      const multipliers: Record<EconomyPhase, { demand: number; churn: number; valuation: number }> = {
        boom: { demand: 1.12, churn: 0.9, valuation: 1.08 },
        steady: { demand: 1, churn: 1, valuation: 1 },
        slowdown: { demand: 0.92, churn: 1.1, valuation: 0.95 },
        recession: { demand: 0.79, churn: 1.25, valuation: 0.86 },
      }
      return {
        phase: segment.phase,
        label: copy.label,
        monthsInPhase: cursor,
        ...multipliers[segment.phase],
      }
    }
    cursor -= segment.months
  }
  return { phase: 'steady', label: 'Steady', monthsInPhase: 0, demand: 1, churn: 1, valuation: 1 }
}

export const economyLabel = (phase: EconomyPhase) => ECONOMY_COPY[phase].label

const FIRST_NAMES = [
  'Amara', 'Tunde', 'Zainab', 'Kwame', 'Lina', 'Mateo', 'Priya', 'Noah', 'Ada', 'Kai',
  'Sofia', 'Ethan', 'Ngozi', 'Ravi', 'Maya', 'Diego', 'Hana', 'Omar', 'Freya', 'Leo',
  'Imani', 'Kofi', 'Mei', 'Jonas', 'Aisha', 'Luca', 'Nadia', 'Theo', 'Rania', 'Sami',
]

const LAST_NAMES = [
  'Okafor', 'Mensah', 'Silva', 'Park', 'Haddad', 'Rossi', 'Chen', 'Mwangi', 'Duarte', 'Novak',
  'Lindqvist', 'Adeyemi', 'Sharma', 'Kim', 'Ferreira', 'Bianchi', 'Osei', 'Rahman', 'Weber', 'Moreau',
]

const BACKGROUNDS = [
  'ex-fintech', 'ex-agency', 'ex-marketplace', 'ex-consultancy', 'ex-startup',
  'ex-corporate', 'self-taught', 'bootcamp grad', 'second-time founder', 'ex-retail',
]

const QUIRKS = [
  'Ships fast, documents later.',
  'Asks for the data before the opinion.',
  'Great with customers, allergic to process.',
  'Quiet operator. Never drops a deadline.',
  'Wants a clear ladder to grow.',
  'Will challenge your pricing in week one.',
  'Has a small following in the industry.',
  'Prefers depth over speed.',
  'Has run this play before.',
  'Will tell you what you need to hear.',
]

export const randomCandidateName = () => ({
  name: `${FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`,
  background: BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)],
  quirk: QUIRKS[Math.floor(Math.random() * QUIRKS.length)],
})

export const CRISES: CrisisDef[] = [
  {
    id: 'key-engineer',
    title: 'Your lead engineer has another offer',
    kicker: 'Talent · urgent',
    body: 'A competitor has offered your best builder a 40% raise. She is not threatening to leave — she is asking you to make her stay.',
    minMonth: 3,
    weight: 10,
    requires: (state) => state.team.some((member) => member.role === 'engineer'),
    options: [
      {
        id: 'match',
        label: 'Match the offer',
        detail: 'Pay $12,000 more a year and keep the roadmap intact.',
        result: 'She stays. The team notices that you fight for your people.',
        effects: { cash: -12_000, morale: 5, quality: 1 },
        tone: 'neutral',
      },
      {
        id: 'promote',
        label: 'Promote from within',
        detail: 'Save the cash, accept a slower quarter, give someone a shot.',
        result: 'Slower shipping, but the team feels seen. A new leader emerges.',
        effects: { quality: -3, morale: 6 },
        tone: 'neutral',
      },
      {
        id: 'leave',
        label: 'Let her go',
        detail: 'Protect payroll and move on.',
        result: 'You lose momentum on the roadmap — and a little of the room’s trust.',
        effects: { quality: -8, morale: -5 },
        tone: 'bad',
      },
    ],
  },
  {
    id: 'supplier-shock',
    title: 'Your main supplier just went dark',
    kicker: 'Operations · supply',
    body: 'A storm has pushed your primary supplier’s lead times from five days to five weeks. Your next delivery window is tomorrow.',
    minMonth: 3,
    weight: 9,
    requires: (state) => state.industry !== 'saas',
    options: [
      {
        id: 'emergency-stock',
        label: 'Buy emergency stock',
        detail: 'Pay a premium elsewhere to keep shelves and kitchens full.',
        result: 'You keep the promise. The margin takes the hit.',
        effects: { cash: -9_000, quality: -1 },
        tone: 'neutral',
      },
      {
        id: 'new-supplier',
        label: 'Qualify a new supplier',
        detail: 'Spend $4,000 and three weeks testing quality.',
        result: 'Short disruption, better long-term supply. Some customers notice.',
        effects: { cash: -4_000, quality: 2, customersPct: -0.03 },
        tone: 'neutral',
      },
      {
        id: 'improvise',
        label: 'Improvise and stretch stock',
        detail: 'No cash out, but the experience slips.',
        result: 'You hold cash, but quality and morale take the strain.',
        effects: { quality: -7, morale: -3 },
        tone: 'bad',
      },
    ],
  },
  {
    id: 'price-war',
    title: 'A competitor just cut prices 30%',
    kicker: 'Market · competition',
    body: 'The newest player in town is buying market share. Their new price undercuts yours and customers are starting to ask questions.',
    minMonth: 5,
    weight: 9,
    options: [
      {
        id: 'hold',
        label: 'Hold your price',
        detail: 'Trust the value story. Lose the most price-sensitive customers.',
        result: 'Some customers churn. The ones who stay believe in what you built.',
        effects: { customersPct: -0.1, reputation: 3 },
        tone: 'neutral',
      },
      {
        id: 'match',
        label: 'Match the cut',
        detail: 'Spend $5,000 on a promo push and protect volume.',
        result: 'You keep the volume, but the discount is hard to unwind later.',
        effects: { cash: -5_000, customersPct: 0.04, reputation: -2 },
        tone: 'neutral',
      },
      {
        id: 'premium',
        label: 'Go premium',
        detail: 'Raise the experience and let the cheap seats go.',
        result: 'A sharper brand, a smaller base. Margins stay intact.',
        effects: { quality: 5, customersPct: -0.05, reputation: 5 },
        tone: 'good',
      },
    ],
  },
  {
    id: 'viral-moment',
    title: 'You just went viral',
    kicker: 'Market · momentum',
    body: 'A creator with a real audience posted about you. Traffic is up 9x, your inbox is chaos, and the window is open for exactly one week.',
    minMonth: 4,
    weight: 7,
    options: [
      {
        id: 'capacity',
        label: 'Spend to keep up',
        detail: 'Invest $8,000 in stock, support and delivery capacity.',
        result: 'You convert the spike. The team is exhausted but proud.',
        effects: { cash: -8_000, customersPct: 0.18, quality: -2 },
        tone: 'good',
      },
      {
        id: 'ride',
        label: 'Let it ride',
        detail: 'Capture what you can without new spend.',
        result: 'A solid bump. Some newcomers churn when service slows.',
        effects: { customersPct: 0.09, quality: -1 },
        tone: 'good',
      },
      {
        id: 'referral',
        label: 'Launch a referral offer',
        detail: 'Spend $3,000 turning attention into advocates.',
        result: 'The spike becomes a story your customers tell for you.',
        effects: { cash: -3_000, customersPct: 0.13, reputation: 4 },
        tone: 'good',
      },
    ],
  },
  {
    id: 'regulator-audit',
    title: 'A regulator wants a look',
    kicker: 'Risk · compliance',
    body: 'A routine review has turned into a formal inquiry. They want documentation, a meeting and “a clear owner of the process.”',
    minMonth: 8,
    weight: 6,
    options: [
      {
        id: 'comply',
        label: 'Comply fully and fast',
        detail: 'Spend $11,000 on counsel and process.',
        result: 'Clean file, clean conscience. The process makes you stronger.',
        effects: { cash: -11_000, reputation: 3, quality: 1 },
        tone: 'neutral',
      },
      {
        id: 'contest',
        label: 'Contest the scope',
        detail: 'Spend $4,000 pushing back on what they can see.',
        result: 'You protect the cash but spend weeks of attention.',
        effects: { cash: -4_000, reputation: -4, morale: -2 },
        tone: 'bad',
      },
      {
        id: 'slowwalk',
        label: 'Slow-walk it',
        detail: 'Say yes in public, delay in private.',
        result: 'The delay leaks. Customers read about it before you respond.',
        effects: { reputation: -7, customersPct: -0.04 },
        tone: 'bad',
      },
    ],
  },
  {
    id: 'big-discount',
    title: 'A chain wants a big discount',
    kicker: 'Customer · negotiation',
    body: 'A national chain is willing to sign a 12-month contract — if you give them 25% off and net-60 payment terms.',
    minMonth: 4,
    weight: 7,
    options: [
      {
        id: 'accept',
        label: 'Take the deal',
        detail: 'Volume, credibility and a cash advance — at a lower margin.',
        result: 'Your logo wall gets stronger. So does the pressure on service.',
        effects: { customersPct: 0.15, cash: 10_000, reputation: -2, quality: -2 },
        tone: 'neutral',
      },
      {
        id: 'hold',
        label: 'Protect your price',
        detail: 'Decline politely and keep the premium positioning.',
        result: 'You lose a logo, not the pricing power.',
        effects: { customersPct: -0.03, reputation: 4 },
        tone: 'good',
      },
      {
        id: 'pilot',
        label: 'Offer a smaller pilot',
        detail: 'One city, one quarter, full price.',
        result: 'You prove value without giving away the farm.',
        effects: { cash: 3_000, customersPct: 0.05, reputation: 1 },
        tone: 'good',
      },
    ],
  },
  {
    id: 'cash-crunch',
    title: 'Payroll hits in nine days',
    kicker: 'Finance · survivable',
    body: 'Cash is tighter than the dashboard said. You have enough for payroll and almost nothing else. You need a decision, not optimism.',
    minMonth: 5,
    weight: 10,
    requires: (state) => state.team.length > 0 && state.cash < 35_000,
    options: [
      {
        id: 'revenue-loan',
        label: 'Take a revenue loan',
        detail: 'Borrow $25,000 against next quarter’s receipts.',
        result: 'Payroll is covered. The debt is now part of every decision.',
        effects: { cash: 25_000, debt: 25_000, reputation: -2 },
        tone: 'neutral',
      },
      {
        id: 'freeze',
        label: 'Freeze marketing',
        detail: 'Pause all campaigns until cash recovers.',
        result: 'The bleed slows. New customers slow with it.',
        effects: { marketing: 0, customersPct: -0.02, morale: -3 },
        tone: 'neutral',
      },
      {
        id: 'delay-payroll',
        label: 'Delay payroll two weeks',
        detail: 'A $12,000 bridge on the backs of the team.',
        result: 'Cash protected. Trust damaged. Some people start looking.',
        effects: { cash: 12_000, morale: -12, reputation: -5 },
        tone: 'bad',
      },
    ],
  },
  {
    id: 'outage',
    title: 'Everything is down',
    kicker: 'Operations · outage',
    body: 'Your core operation failed during the busiest window of the week. Customers are posting screenshots. The clock is running.',
    minMonth: 6,
    weight: 7,
    requires: (state) => state.industry === 'saas' || state.industry === 'logistics',
    options: [
      {
        id: 'compensate',
        label: 'Compensate every customer',
        detail: 'Spend $6,000 on credits and over-communicate.',
        result: 'People remember how you handled it more than the outage.',
        effects: { cash: -6_000, reputation: 4, customersPct: 0.01 },
        tone: 'good',
      },
      {
        id: 'quiet',
        label: 'Fix it quietly',
        detail: 'Restore service, say as little as possible.',
        result: 'The service returns. The silence does not go unnoticed.',
        effects: { reputation: -5, quality: -2 },
        tone: 'bad',
      },
      {
        id: 'reliability',
        label: 'Reinvest in reliability',
        detail: 'Spend $10,000 on the root cause and public follow-up.',
        result: 'An expensive lesson that becomes a selling point.',
        effects: { cash: -10_000, quality: 5, reputation: 2 },
        tone: 'good',
      },
    ],
  },
  {
    id: 'star-hire',
    title: 'A star operator is suddenly available',
    kicker: 'Talent · opportunity',
    body: 'A senior operator you have admired for years just left a bigger company. She is open to a conversation — for the next 72 hours.',
    minMonth: 4,
    weight: 6,
    options: [
      {
        id: 'premium',
        label: 'Offer a premium package',
        detail: 'Pay $15,000 up front and make the role hers.',
        result: 'Instant credibility. The team has someone to learn from.',
        effects: { cash: -15_000, quality: 3, morale: 4, reputation: 2 },
        tone: 'good',
      },
      {
        id: 'lite',
        label: 'Offer a lean deal',
        detail: 'Small package, big scope, real ownership.',
        result: 'She signs with conditions. The upside is worth the ambiguity.',
        effects: { cash: -5_000, quality: 1, morale: 2 },
        tone: 'neutral',
      },
      {
        id: 'pass',
        label: 'Pass for now',
        detail: 'Protect cash and promote from within.',
        result: 'You keep the runway. The team wonders what you were waiting for.',
        effects: { morale: -2 },
        tone: 'neutral',
      },
    ],
  },
  {
    id: 'acquisition',
    title: 'Someone wants to buy the company',
    kicker: 'Exit · decision',
    body: 'Kestrel Group has watched you for six months. They are offering to acquire the business at a modest premium — cash today, control tomorrow.',
    minMonth: 24,
    weight: 3,
    requires: (state) => state.valuation >= 6_000_000,
    options: [
      {
        id: 'accept',
        label: 'Take the exit',
        detail: 'Cash out your equity at 85% of the current valuation.',
        result: 'You trade the next chapter for certainty. The run ends on your terms.',
        effects: { acquisitionMult: 0.85 },
        tone: 'good',
      },
      {
        id: 'raise',
        label: 'Use it as leverage',
        detail: 'Tell investors a strategic buyer is circling.',
        result: 'The market takes you more seriously. So does your team.',
        effects: { reputation: 3, morale: 4 },
        tone: 'good',
      },
      {
        id: 'decline',
        label: 'Decline and keep building',
        detail: 'You are not done yet.',
        result: 'You choose independence. The team rallies around the ambition.',
        effects: { reputation: 4, morale: 2 },
        tone: 'good',
      },
    ],
  },
  {
    id: 'supplier-squeeze',
    title: 'Your supplier wants new terms',
    kicker: 'Operations · supply',
    body: 'Your main supplier is raising prices 18% and shortening payment terms. They know switching is painful, and they are right.',
    minMonth: 5,
    weight: 8,
    requires: (state) => industryById(state.industry).inventory,
    options: [
      {
        id: 'absorb',
        label: 'Absorb the increase',
        detail: 'Keep operations smooth and eat the margin.',
        result: 'Customers notice nothing. Your gross margin does.',
        effects: { cash: -7_000, quality: 1 },
        tone: 'neutral',
      },
      {
        id: 'switch',
        label: 'Qualify a second supplier',
        detail: 'Spend $5,000 and accept a month of uneven quality.',
        result: 'You gain leverage for the next negotiation.',
        effects: { cash: -5_000, quality: -3, reputation: 1 },
        tone: 'neutral',
      },
      {
        id: 'pass-on',
        label: 'Pass it to customers',
        detail: 'Raise prices to protect the margin.',
        result: 'The numbers hold. A few customers quietly leave.',
        effects: { customersPct: -0.05, reputation: -2 },
        tone: 'bad',
      },
    ],
  },
  {
    id: 'pr-blowup',
    title: 'A complaint is going viral',
    kicker: 'Brand · reputation',
    body: 'A frustrated customer posted a thread about your service. It is being quote-tweeted by people who have never bought anything from you.',
    minMonth: 7,
    weight: 8,
    options: [
      {
        id: 'own-it',
        label: 'Own it publicly',
        detail: 'Respond fast, refund them, publish what you are fixing.',
        result: 'The pile-on turns into a lesson people respect.',
        effects: { cash: -3_000, reputation: 4, quality: 1 },
        tone: 'good',
      },
      {
        id: 'quiet-fix',
        label: 'Fix it quietly',
        detail: 'Solve the customer problem, say nothing publicly.',
        result: 'The thread fades, but the screenshots stay searchable.',
        effects: { reputation: -4 },
        tone: 'neutral',
      },
      {
        id: 'defend',
        label: 'Push back',
        detail: 'Correct the record, firmly.',
        result: 'Your side gets heard. So does the argument.',
        effects: { reputation: -7, morale: -2 },
        tone: 'bad',
      },
    ],
  },
  {
    id: 'legal-demand',
    title: 'A lawyer sends a letter',
    kicker: 'Risk · legal',
    body: 'A customer claims your service caused them real losses. Their lawyer is suggesting a settlement. Your lawyer is suggesting you take it seriously.',
    minMonth: 10,
    weight: 6,
    options: [
      {
        id: 'settle',
        label: 'Settle quickly',
        detail: 'Pay $14,000 and close the file with no admission.',
        result: 'Expensive, quiet, over. The distraction ends today.',
        effects: { cash: -14_000, reputation: -1 },
        tone: 'neutral',
      },
      {
        id: 'fight',
        label: 'Fight it',
        detail: 'Spend $6,000 on counsel and defend the record.',
        result: 'You win the argument and lose a quarter of attention.',
        effects: { cash: -6_000, morale: -3, quality: -1 },
        tone: 'neutral',
      },
      {
        id: 'ignore',
        label: 'Let it sit',
        detail: 'Answer nothing without being forced to.',
        result: 'The silence becomes the story.',
        effects: { reputation: -6, customersPct: -0.03 },
        tone: 'bad',
      },
    ],
  },
  {
    id: 'downturn',
    title: 'The market turns',
    kicker: 'Economy · recession',
    body: 'Two of your best customers just cut their budgets. The papers are calling it a downturn. This is the month cash discipline stops being a slogan.',
    minMonth: 6,
    weight: 9,
    requires: (state) => state.economy.phase === 'recession',
    options: [
      {
        id: 'defend',
        label: 'Protect the base',
        detail: 'Spend $8,000 on retention offers and service.',
        result: 'You keep the customers you have. Growth waits.',
        effects: { cash: -8_000, quality: 1, reputation: 2 },
        tone: 'neutral',
      },
      {
        id: 'cut',
        label: 'Cut marketing hard',
        detail: 'Preserve cash and accept a smaller pipeline.',
        result: 'The burn drops. So does your visibility when the recovery starts.',
        effects: { marketing: 0, customersPct: -0.04, morale: -2 },
        tone: 'neutral',
      },
      {
        id: 'double-down',
        label: 'Double down',
        detail: 'Spend while others retreat. It is expensive and bold.',
        result: 'You buy share cheaply — if you can survive the next six months.',
        effects: { cash: -12_000, customersPct: 0.05, reputation: 3, morale: 3 },
        tone: 'good',
      },
    ],
  },
  {
    id: 'branch-trouble',
    title: 'The new location is not working',
    kicker: 'Expansion · operations',
    body: 'Your second market is missing its numbers. The manager says the demand is there; the dashboard says the quality is not. Both are right.',
    minMonth: 6,
    weight: 7,
    requires: (state) => state.branches.some((branch) => branch.openedMonth !== null),
    options: [
      {
        id: 'invest',
        label: 'Send in a fixer',
        detail: 'Spend $10,000 on training and support for the new team.',
        result: 'The branch stabilises. The main location feels the attention drain.',
        effects: { cash: -10_000, quality: 2, morale: 1 },
        tone: 'neutral',
      },
      {
        id: 'shrink',
        label: 'Shrink the footprint',
        detail: 'Cut the branch cost base and protect cash.',
        result: 'Smaller ambition, survivable economics.',
        effects: { cash: 6_000, reputation: -2, quality: -1 },
        tone: 'neutral',
      },
      {
        id: 'close',
        label: 'Close it',
        detail: 'Take the write-down and refocus on the core.',
        result: 'You lose the investment and gain back your attention.',
        effects: { cash: -12_000, reputation: -4, morale: -3 },
        tone: 'bad',
      },
    ],
  },
]

export const WORLD_EVENTS = [
  { title: 'A local business newsletter mentioned you', detail: 'A small write-up brought a handful of curious customers.', tone: 'good' as const, effects: { reputation: 1, customersPct: 0.01 } },
  { title: 'Your team shipped a small win', detail: 'Nothing dramatic, but the product feels a little better today.', tone: 'good' as const, effects: { quality: 1, morale: 2 } },
  { title: 'An early customer sent a referral', detail: 'Word of mouth is starting to do some of the work.', tone: 'good' as const, effects: { customersPct: 0.02 } },
  { title: 'A competitor poached a lead', detail: 'One that was nearly yours. It stings more than it should.', tone: 'bad' as const, effects: { customersPct: -0.012 } },
  { title: 'A supplier invoice was double-charged', detail: 'Finance caught it late. The refund takes weeks.', tone: 'bad' as const, effects: { cash: -900 } },
  { title: 'Your landlord agreed to a small rent credit', detail: 'A rare piece of good news from the building.', tone: 'good' as const, effects: { cash: 1_500 } },
  { title: 'A hiring post went unexpectedly viral', detail: 'Your inbox fills with people who want to work with you.', tone: 'good' as const, effects: { reputation: 1, morale: 1 } },
  { title: 'A key process broke during a busy week', detail: 'The team improvised. A little quality slipped away.', tone: 'bad' as const, effects: { quality: -1, morale: -1 } },
]

export const FUNDS = [
  { fund: 'Northline Ventures', partner: 'Ravi Shah', vibe: 'Backs boring problems with sharp operators.' },
  { fund: 'Sable Capital', partner: 'Elena Rossi', vibe: 'Moves fast, expects revenue discipline.' },
  { fund: 'Kite & Co', partner: 'Tunde Adeyemi', vibe: 'Founder-friendly, allergic to hype.' },
  { fund: 'Blue Harbour', partner: 'Hana Sato', vibe: 'Leads rounds, takes a board seat.' },
  { fund: 'First Draft', partner: 'Noah Berg', vibe: 'Small checks, strong operator network.' },
  { fund: 'Meridian Ventures', partner: 'Amara Osei', vibe: 'Local roots, long horizon.' },
  { fund: 'Salt Partners', partner: 'Mateo Duarte', vibe: 'Data-driven, quietly competitive.' },
  { fund: 'Copper Lane', partner: 'Priya Sharma', vibe: 'Turns around good companies, not stories.' },
]

export const ACHIEVEMENTS: Record<string, { label: string; description: string }> = {
  first_hire: { label: 'First hire', description: 'You added someone to the payroll.' },
  first_10k: { label: '$10k months', description: 'Monthly revenue crossed $10,000.' },
  hundred_customers: { label: 'Hundred club', description: 'You reached 100 customers.' },
  first_raise: { label: 'Funded', description: 'You closed your first investor round.' },
  profitable: { label: 'In the black', description: 'A profitable month, without excuses.' },
  survivor: { label: 'One year in', description: 'You survived 12 months of running a company.' },
  million: { label: 'Million-dollar story', description: 'Your valuation crossed $1M.' },
  beloved: { label: 'Beloved', description: 'Reputation reached 80.' },
  first_deal: { label: 'Closed won', description: 'You closed a deal that started in the pipeline.' },
  second_market: { label: 'Second market', description: 'You opened a branch outside the home district.' },
  weatherproof: { label: 'Weatherproof', description: 'You stayed profitable through a recession month.' },
  promoted: { label: 'Homegrown', description: 'Someone on your team earned a promotion.' },
}
