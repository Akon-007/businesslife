/**
 * Marketing channels and attribution.
 *
 * The budget is one number; the mix decides how that number is spent. Each
 * channel converts cash into prospects at a different rate and suits a
 * different industry, so the same spend buys more customers in one market than
 * another. Attribution is deliberately simple and stated in the UI: 30% of new
 * customers are treated as word of mouth, 70% are split across the channels in
 * proportion to their share × industry fit, with largest-remainder rounding so
 * the parts always add up to the whole.
 */
import type { GameState, IndustryId, MarketingChannelId, MarketingMix } from './types'

export interface ChannelDefinition {
  id: MarketingChannelId
  label: string
  blurb: string
  /** Relative cost of reaching the same audience. Higher is dearer. */
  cost: number
  /** Lead quality multiplier: how well the customers attracted here stick. */
  quality: number
  /** How well the channel suits each industry (1.0 = neutral). */
  fit: Record<IndustryId, number>
}

export const MARKETING_CHANNELS: readonly ChannelDefinition[] = [
  {
    id: 'social',
    label: 'Social & creators',
    blurb: 'Cheap reach, shallow intent. Good for volume in retail and food.',
    cost: 0.8,
    quality: 0.85,
    fit: { saas: 0.9, fnb: 1.25, retail: 1.2, logistics: 0.8, manufacturing: 0.75, agriculture: 0.95, healthcare: 0.85, education: 1.2 },
  },
  {
    id: 'search',
    label: 'Search & intent',
    blurb: 'People already looking for the thing you sell. Dearer, converts better.',
    cost: 1.25,
    quality: 1.1,
    fit: { saas: 1.2, fnb: 0.85, retail: 1.0, logistics: 1.1, manufacturing: 1.0, agriculture: 0.9, healthcare: 1.15, education: 1.05 },
  },
  {
    id: 'content',
    label: 'Content & SEO',
    blurb: 'Slow to start, compounds. Cheapest quality over a long run.',
    cost: 0.65,
    quality: 1.25,
    fit: { saas: 1.3, fnb: 0.8, retail: 0.9, logistics: 1.0, manufacturing: 0.9, agriculture: 0.85, healthcare: 1.1, education: 1.25 },
  },
  {
    id: 'events',
    label: 'Events & B2B',
    blurb: 'Expensive per head, but the customers who come are worth more.',
    cost: 1.6,
    quality: 1.2,
    fit: { saas: 0.95, fnb: 1.0, retail: 0.8, logistics: 1.35, manufacturing: 1.25, agriculture: 1.15, healthcare: 1.05, education: 0.85 },
  },
]

export const CHANNEL_IDS: readonly MarketingChannelId[] = MARKETING_CHANNELS.map((channel) => channel.id)

export const DEFAULT_MIX: MarketingMix = { social: 0.4, search: 0.3, content: 0.2, events: 0.1 }

/** Share of new customers treated as word of mouth rather than paid. */
export const ORGANIC_SHARE = 0.3

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const channelById = (id: MarketingChannelId) =>
  MARKETING_CHANNELS.find((channel) => channel.id === id) ?? MARKETING_CHANNELS[0]

/** Shares are kept non-negative and summing to 1, whatever the caller sends. */
export function normalizeMix(mix: Partial<MarketingMix> | undefined): MarketingMix {
  const raw = CHANNEL_IDS.map((id) => Math.max(0, Number(mix?.[id] ?? DEFAULT_MIX[id])))
  const total = raw.reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(total) || total <= 0) return { ...DEFAULT_MIX }
  const scaled = raw.map((value) => value / total)
  const next = {} as MarketingMix
  CHANNEL_IDS.forEach((id, index) => {
    next[id] = Math.round(scaled[index] * 1000) / 1000
  })
  return next
}

/** Set one channel's share and redistribute the rest proportionally. */
export function withChannelShare(mix: MarketingMix | undefined, id: MarketingChannelId, share: number): MarketingMix {
  const current = normalizeMix(mix)
  const wanted = clamp(Number.isFinite(share) ? share : 0, 0, 1)
  const others = CHANNEL_IDS.filter((channel) => channel !== id)
  const otherTotal = others.reduce((sum, channel) => sum + current[channel], 0)
  const remaining = 1 - wanted
  const next = { ...current, [id]: wanted } as MarketingMix

  if (remaining <= 0) {
    for (const channel of others) next[channel] = 0
  } else if (otherTotal <= 0) {
    for (const channel of others) next[channel] = remaining / others.length
  } else {
    for (const channel of others) next[channel] = (current[channel] / otherTotal) * remaining
  }
  return normalizeMix(next)
}

/**
 * How well the current mix suits the industry, as a demand multiplier around 1.
 * A perfectly matched mix reaches ~1.2; a badly mismatched one falls to ~0.85.
 */
export function mixFactor(state: GameState): number {
  const mix = normalizeMix(state.marketingMix)
  const raw = CHANNEL_IDS.reduce((sum, id) => sum + mix[id] * channelById(id).fit[state.industry], 0)
  if (state.marketingSpend <= 0) return 1
  return clamp(0.85 + (raw - 0.55) * 0.35, 0.85, 1.2)
}

/** This month's marketing budget split across the channels. */
export function channelSpend(state: GameState): { channel: MarketingChannelId; share: number; spend: number }[] {
  const mix = normalizeMix(state.marketingMix)
  return CHANNEL_IDS.map((id) => ({ channel: id, share: mix[id], spend: Math.round((state.marketingSpend ?? 0) * mix[id]) }))
}

/**
 * Split acquired customers across channels. Returns one row per channel plus an
 * organic row; the customers always sum to the number passed in.
 */
export function attributeCustomers(
  acquired: number,
  state: GameState,
): { channel: MarketingChannelId | 'organic'; share: number; customers: number }[] {
  const total = Math.max(0, Math.round(acquired))
  const mix = normalizeMix(state.marketingMix)
  const hasSpend = (state.marketingSpend ?? 0) > 0
  const organic = hasSpend ? Math.round(total * ORGANIC_SHARE) : total
  const paid = total - organic

  if (paid <= 0) {
    return [
      ...CHANNEL_IDS.map((channel) => ({ channel, share: mix[channel], customers: 0 })),
      { channel: 'organic' as const, share: 1, customers: organic },
    ]
  }

  const weights = CHANNEL_IDS.map((id) => {
    const definition = channelById(id)
    const quality = definition.quality * definition.fit[state.industry]
    return { channel: id, share: mix[id], weight: mix[id] * quality }
  })
  const weightTotal = weights.reduce((sum, item) => sum + item.weight, 0) || 1

  // Largest remainder, so the rounded parts add up to `paid` exactly.
  const exact = weights.map((item) => ({ channel: item.channel, share: item.share, value: (item.weight / weightTotal) * paid }))
  const floored = exact.map((item) => ({ ...item, customers: Math.floor(item.value), remainder: item.value - Math.floor(item.value) }))
  let budget = paid - floored.reduce((sum, item) => sum + item.customers, 0)
  const ranked = [...floored].sort((a, b) => b.remainder - a.remainder)
  for (const item of ranked) {
    if (budget <= 0) break
    item.customers += 1
    budget -= 1
  }

  return [
    ...floored.map((item) => ({ channel: item.channel, share: item.share, customers: item.customers })),
    { channel: 'organic' as const, share: ORGANIC_SHARE, customers: organic },
  ]
}

export interface UnitEconomics {
  /** Revenue per customer per month. */
  arpu: number
  /** Gross margin per customer per month. */
  grossMargin: number
  /** Monthly churn rate, 0..1. */
  churn: number
  /** Expected months a customer stays. */
  lifetimeMonths: number
  /** Gross-margin lifetime value. */
  ltv: number
  /** Marketing spend divided by customers won. */
  cac: number
  /** LTV : CAC. Below 1 means you are buying customers at a loss. */
  ratio: number
}

export function unitEconomics(input: {
  arpu: number
  costPerCustomer: number
  churn: number
  spend: number
  customersWon: number
}): UnitEconomics {
  const grossMargin = Math.max(0, input.arpu - input.costPerCustomer)
  const churn = clamp(input.churn, 0.005, 1)
  const lifetimeMonths = Math.round((1 / churn) * 10) / 10
  const ltv = Math.round(grossMargin * lifetimeMonths)
  const cac = input.customersWon > 0 ? Math.round(input.spend / input.customersWon) : 0
  const ratio = cac > 0 ? Math.round((ltv / cac) * 100) / 100 : 0
  return { arpu: Math.round(input.arpu), grossMargin: Math.round(grossMargin), churn, lifetimeMonths, ltv, cac, ratio }
}
