/**
 * The sales funnel: leads → qualification → quotes → signed contracts.
 *
 * The pipeline in `engine.ts` models loose deals that may or may not close. This
 * module is the deliberate B2B motion on top of it:
 *
 *  - leads arrive from four sources, weighted by what the player has built
 *    (marketing spend, reputation, sales headcount, live contracts)
 *  - a lead carries intent and fit, so it can be scored rather than guessed at
 *  - qualification costs cash and buys a better read on the account
 *  - a quote is priced off the player's own price and a chosen discount; it is
 *    valid for two months and its win chance is deterministic arithmetic
 *  - a win becomes a retainer that pays monthly until the term runs out
 *
 * Contract revenue is collected in the month it is earned, so it never touches
 * the receivables ledger. It is deliberately *not* added to `state.customers`:
 * these are accounts on retainer, not consumers in the demand model, and double
 * counting them would inflate both revenue and churn.
 *
 * Everything here is a pure function of (state, seeded rng, month) so a replay
 * reproduces the same funnel.
 */
import type { Contract, IndustryId, Lead, LeadSource } from './types'
import { clamp } from '../lib/format'

/** What it costs to properly qualify an account (references, discovery call). */
export const QUALIFICATION_FEE = 1_200
/** How long a quote stays open before the buyer moves on. */
export const QUOTE_VALID_MONTHS = 2
/** Never show a win chance outside this band — nothing in sales is certain. */
export const CHANCE_FLOOR = 0.05
export const CHANCE_CEILING = 0.92
/** Don't swamp the panel; new inbound replaces nothing, it queues. */
export const MAX_OPEN_LEADS = 8

export const SOURCE_META: Record<LeadSource, { label: string; blurb: string }> = {
  inbound: { label: 'Inbound', blurb: 'Found you. Warm intent, average fit.' },
  referral: { label: 'Referral', blurb: 'Introduced by someone who trusts you. Best fit.' },
  outbound: { label: 'Outbound', blurb: 'You went looking. Cheap, but the intent is thin.' },
  event: { label: 'Event', blurb: 'Met at an industry event. Mixed signals.' },
}

const COMPANIES = [
  'Delta Fresh Foods',
  'Zuri Aesthetics',
  'Kano Textiles Co.',
  'Brightline Academy',
  'Ogun Agro Supply',
  'Lagos Health Partners',
  'Riverside Hotels',
  'Trident Manufacturing',
  'Palm Grove Retail',
  'Silverline Studios',
  'Abuja Data Systems',
  'Coastal Freight Ltd',
] as const

const CONTACTS = [
  'Ngozi Eze',
  'Emeka Obi',
  'Fatima Bello',
  'Segun Adeleke',
  'Chiamaka Ude',
  'Ibrahim Sule',
  'Tolu Ajayi',
  'Blessing Etim',
  'Yusuf Danjuma',
  'Ada Nwankwo',
] as const

export interface LeadScore {
  score: number
  band: 'hot' | 'warm' | 'cold'
  /** What the account is worth per month if it signs at the current price. */
  potential: number
  overBudget: boolean
}

/**
 * Score a lead out of 100. Intent and fit carry most of the weight; the last
 * slice is whether the account can actually afford the current price.
 */
export function scoreLead(lead: Lead, price: number): LeadScore {
  const ask = lead.seats * price
  const ratio = ask / Math.max(1, lead.budget)
  const budgetFit = clamp(100 - Math.max(0, ratio - 1) * 100, 0, 100)
  const score = Math.round(0.45 * lead.intent + 0.4 * lead.fit + 0.15 * budgetFit)
  return {
    score,
    band: score >= 70 ? 'hot' : score >= 45 ? 'warm' : 'cold',
    potential: ask,
    overBudget: ratio > 1.05,
  }
}

/** Monthly value of a quote: seats × list price, less the discount offered. */
export function quoteValue(lead: Lead, price: number, discount: number): number {
  const capped = clamp(discount, 0, 0.3)
  return Math.round(lead.seats * price * (1 - capped))
}

export interface ChanceInput {
  score: number
  value: number
  budget: number
  discount: number
  qualified: boolean
  price: number
}

/**
 * The modelled probability that a quote is accepted. Arithmetic only: score
 * carries it, the discount buys some of it back, asking above the account's
 * budget costs a third of it.
 */
export function quoteChance(input: ChanceInput): number {
  const base = 0.1 + (input.score / 100) * 0.52
  const discountBoost = input.discount * 0.9
  const overBudget = clamp((input.value - input.budget) / Math.max(1, input.budget), 0, 1)
  const research = input.qualified ? 0.06 : 0
  return clamp(base + discountBoost - overBudget * 0.33 + research, CHANCE_FLOOR, CHANCE_CEILING)
}

/** Term length in months, by how much the retainer is worth. */
export function contractTerm(value: number, monthlyPrice: number): number {
  if (value >= monthlyPrice * 8) return 12
  if (value >= monthlyPrice * 5) return 9
  return 6
}

export function makeLead(
  industry: IndustryId,
  month: number,
  price: number,
  source: LeadSource,
  rng: () => number,
  used: string[] = [],
): Lead {
  const pool = COMPANIES.filter((name) => !used.includes(name))
  const company = pool[Math.floor(rng() * Math.max(1, pool.length))] ?? `Account ${Math.floor(rng() * 9_000) + 1_000}`
  const contact = CONTACTS[Math.floor(rng() * CONTACTS.length)]
  const seats = 2 + Math.floor(rng() * 8)
  // Budgets sit around the list price for that seat count, ±40%.
  const budget = Math.round(seats * price * (0.6 + rng() * 0.8))
  const profile = {
    inbound: { intent: [45, 80], fit: [40, 80] },
    referral: { intent: [55, 90], fit: [60, 95] },
    outbound: { intent: [20, 55], fit: [35, 75] },
    event: { intent: [30, 70], fit: [40, 85] },
  }[source]
  const pick = (band: number[]) => Math.round(band[0] + rng() * (band[1] - band[0]))
  return {
    id: `lead-${month}-${Math.floor(rng() * 1e6)}-${source}`,
    company: industry === 'saas' ? `${company} (${source})` : company,
    contact,
    source,
    seats,
    budget,
    intent: pick(profile.intent),
    fit: pick(profile.fit),
    addedMonth: month,
    status: 'open',
  }
}

export interface LeadWaveInput {
  industry: IndustryId
  month: number
  price: number
  marketingSpend: number
  reputation: number
  salesHeads: number
  liveContracts: number
  openLeads: number
  rng: () => number
}

/**
 * Which sources produced a lead this close. Each source rolls independently, so
 * a month can be dry, and a good month can bring two.
 */
export function arriveLeads(input: LeadWaveInput): Lead[] {
  const room = Math.max(0, MAX_OPEN_LEADS - input.openLeads)
  if (room === 0) return []
  const rates: Array<[LeadSource, number]> = [
    ['inbound', 0.34 + input.marketingSpend / 26_000],
    ['referral', (input.reputation >= 60 ? 0.24 : 0.06) + input.liveContracts * 0.05],
    ['outbound', input.salesHeads > 0 ? 0.3 + input.salesHeads * 0.04 : 0.1],
    ['event', 0.08],
  ]
  const leads: Lead[] = []
  for (const [source, rate] of rates) {
    if (leads.length >= room) break
    if (input.rng() >= clamp(rate, 0, 0.95)) continue
    leads.push(makeLead(input.industry, input.month, input.price, source, input.rng, leads.map((item) => item.company)))
  }
  return leads
}

export interface QuoteOutcome {
  leads: Lead[]
  contracts: Contract[]
  notes: string[]
}

/**
 * Close every open quote at month end. A lapsed quote is a lost account: the
 * buyer does not wait, and pretending they do would teach the wrong lesson.
 */
export function resolveQuotes(leads: Lead[], month: number, price: number, rng: () => number): QuoteOutcome {
  const next: Lead[] = []
  const contracts: Contract[] = []
  const notes: string[] = []

  for (const lead of leads) {
    if (lead.status !== 'quoted' || !lead.quote) {
      next.push(lead)
      continue
    }
    const quote = lead.quote
    if (month > quote.expiresMonth) {
      next.push({ ...lead, status: 'lost', note: 'The quote lapsed — the account moved on.' })
      notes.push(`${lead.company} let the quote lapse.`)
      continue
    }
    if (rng() < quote.chance) {
      const months = contractTerm(quote.value, price)
      contracts.push({
        id: `ct-${lead.id}`,
        company: lead.company,
        customers: lead.seats,
        monthlyValue: quote.value,
        months,
        monthsLeft: months,
        startedMonth: month,
        discount: quote.discount,
      })
      next.push({ ...lead, status: 'won', note: `Signed a ${months}-month retainer.` })
      notes.push(`${lead.company} signed a ${months}-month retainer at ${Math.round(quote.value / 1000)}k/month.`)
      continue
    }
    next.push({ ...lead, status: 'lost', note: 'Chose a competitor or shelved the project.' })
    notes.push(`${lead.company} turned the quote down.`)
  }

  return { leads: next, contracts, notes }
}

export interface ContractTick {
  contracts: Contract[]
  revenue: number
  active: number
  ended: string[]
}

/** Pay every live retainer for the month, then step the term down. */
export function tickContracts(contracts: Contract[]): ContractTick {
  const next: Contract[] = []
  const ended: string[] = []
  let revenue = 0
  let active = 0

  for (const contract of contracts) {
    if (contract.monthsLeft <= 0) continue
    revenue += contract.monthlyValue
    active += 1
    const monthsLeft = contract.monthsLeft - 1
    // A finished retainer leaves the book — the report keeps the memory of it.
    if (monthsLeft === 0) {
      ended.push(contract.company)
      continue
    }
    next.push({ ...contract, monthsLeft })
  }

  return { contracts: next, revenue, active, ended }
}

export interface FunnelSummary {
  leads: Lead[]
  open: Lead[]
  quoted: number
  won: number
  lost: number
  pipelineValue: number
  monthlyRecurring: number
  avgChance: number
}

/** Everything the UI needs to describe the funnel without re-deriving rules. */
export function funnelSummary(leads: Lead[], contracts: Contract[], price: number): FunnelSummary {
  const open = leads.filter((lead) => lead.status === 'open' || lead.status === 'qualified')
  const quoted = leads.filter((lead) => lead.status === 'quoted')
  const chances = quoted.map((lead) => lead.quote?.chance ?? 0)
  return {
    leads,
    open,
    quoted: quoted.length,
    won: leads.filter((lead) => lead.status === 'won').length,
    lost: leads.filter((lead) => lead.status === 'lost').length,
    pipelineValue: quoted.reduce((total, lead) => total + (lead.quote?.value ?? 0), 0) + open.reduce((total, lead) => total + scoreLead(lead, price).potential, 0),
    monthlyRecurring: contracts.filter((contract) => contract.monthsLeft > 0).reduce((total, contract) => total + contract.monthlyValue, 0),
    avgChance: chances.length ? chances.reduce((total, chance) => total + chance, 0) / chances.length : 0,
  }
}
