import { createHash } from 'node:crypto'
import type { AiTrace, Company } from './types.js'
import { authorityOf } from './authority.js'

/**
 * Model-agnostic AI gateway.
 *
 * Architecture rule (scope §8.2): dialogue is an interaction layer only. Every
 * number the model sees comes from the server-authoritative snapshot, and no
 * provider is ever given a tool that can change game state. Providers are
 * swappable; the deterministic provider is the default so the product works with
 * no API key and never fabricates a balance.
 */

export type CharacterId = 'nova' | 'investor' | 'customer' | 'employee' | 'supplier'

export interface CharacterDefinition {
  id: CharacterId
  name: string
  role: string
  goals: string[]
  personality: string
  /** Company fields this character is allowed to know about. */
  knowledge: string[]
}

export const CHARACTERS: Record<CharacterId, CharacterDefinition> = {
  nova: {
    id: 'nova',
    name: 'Nova',
    role: 'AI chief of staff',
    goals: ['Explain what is driving performance', 'Surface the binding constraint', 'Force a decision'],
    personality: 'Direct, numerate, allergic to vanity metrics.',
    knowledge: ['cash', 'runway', 'revenue', 'expenses', 'customers', 'churn', 'quality', 'morale', 'debt', 'valuation', 'month', 'inventory'],
  },
  investor: {
    id: 'investor',
    name: 'Amara Okonkwo',
    role: 'Seed investor',
    goals: ['Test evidence over narrative', 'Protect downside', 'Price risk honestly'],
    personality: 'Warm but unimpressed by decks.',
    knowledge: ['customers', 'revenue', 'runway', 'valuation', 'valuationNaira', 'founderEquity', 'month'],
  },
  customer: {
    id: 'customer',
    name: 'Tunde Bello',
    role: 'Prospective customer',
    goals: ['Get value for money', 'Avoid switching costs'],
    personality: 'Practical, price-aware, quick to compare.',
    knowledge: ['price', 'quality', 'reputation', 'month'],
  },
  employee: {
    id: 'employee',
    name: 'Ifeoma Nwosu',
    role: 'Team member',
    goals: ['Fair pay', 'Sustainable workload', 'Room to grow'],
    personality: 'Candid, loyal while treated well.',
    knowledge: ['morale', 'teamSize', 'quality', 'month'],
  },
  supplier: {
    id: 'supplier',
    name: 'Kola Adeyemi',
    role: 'Supplier',
    goals: ['Predictable orders', 'On-time payment', 'Protect margin'],
    personality: 'Dry, transactional, reliable.',
    knowledge: ['inventory', 'customers', 'month'],
  },
}

export interface AiFacts {
  company: string
  month: number
  cashNaira: number
  runwayMonths: number | null
  revenueNaira: number
  expensesNaira: number
  customers: number
  churnPct: number
  quality: number
  reputation: number
  morale: number
  teamSize: number
  debtNaira: number
  valuationNaira: number
  founderEquity: number
  inventoryCover: number
  priceNaira: number
  score: number
}

export interface AiRequest {
  character: CharacterId
  message: string
  facts: AiFacts
}

export interface AiReply {
  reply: string
  provider: string
  grounded: string[]
}

export interface AiProvider {
  id: string
  available(): boolean
  complete(request: AiRequest): Promise<AiReply>
}

// ---------------------------------------------------------------------------
// Grounding: build facts from authoritative state, scoped per character
// ---------------------------------------------------------------------------

export function factsFor(company: Company): AiFacts {
  const authority = authorityOf(company)
  const revenue = authority.revenueKobo / 100
  const expenses = authority.expensesKobo / 100
  const cash = authority.cashKobo / 100
  const burn = Math.max(0, expenses - revenue)
  const runway = burn > 0 ? Math.round((cash / burn) * 10) / 10 : null
  const founderHolding = Number((company.ownership?.[0]?.shares ?? 100))
  return {
    company: company.name,
    month: authority.month,
    cashNaira: Math.round(cash),
    runwayMonths: runway,
    revenueNaira: Math.round(revenue),
    expensesNaira: Math.round(expenses),
    customers: authority.customers,
    churnPct: 0,
    quality: Math.round(Number(company.reputationProfile?.productQuality ?? 50)),
    reputation: Math.round(Number(company.reputationProfile?.customerTrust ?? 50)),
    morale: Math.round(Number(company.reputationProfile?.employeeReputation ?? 50)),
    teamSize: company.employees.length,
    debtNaira: 0,
    valuationNaira: Math.round(authority.valuationKobo / 100),
    founderEquity: founderHolding,
    inventoryCover: Number(company.products?.[0]?.stock ?? 0),
    priceNaira: Math.round(Number(company.products?.[0]?.priceKobo ?? 0) / 100),
    score: authority.score,
  }
}

function scopedFacts(character: CharacterId, facts: AiFacts): Record<string, number | string | null> {
  const definition = CHARACTERS[character]
  const all: Record<string, number | string | null> = {
    company: facts.company,
    month: facts.month,
    cashNaira: facts.cashNaira,
    runwayMonths: facts.runwayMonths,
    revenueNaira: facts.revenueNaira,
    expensesNaira: facts.expensesNaira,
    customers: facts.customers,
    churnPct: facts.churnPct,
    quality: facts.quality,
    reputation: facts.reputation,
    morale: facts.morale,
    teamSize: facts.teamSize,
    debtNaira: facts.debtNaira,
    valuationNaira: facts.valuationNaira,
    founderEquity: facts.founderEquity,
    inventoryCover: facts.inventoryCover,
    score: facts.score,
    price: facts.priceNaira,
  }
  const scoped: Record<string, number | string | null> = {}
  for (const key of definition.knowledge) {
    if (key === 'cash') scoped.cashNaira = all.cashNaira
    else if (key === 'runway') scoped.runwayMonths = all.runwayMonths
    else if (key === 'revenue') scoped.revenueNaira = all.revenueNaira
    else if (key === 'expenses') scoped.expensesNaira = all.expensesNaira
    else if (key === 'customers') scoped.customers = all.customers
    else if (key === 'churn') scoped.churnPct = all.churnPct
    else if (key === 'quality') scoped.quality = all.quality
    else if (key === 'reputation') scoped.reputation = all.reputation
    else if (key === 'morale') scoped.morale = all.morale
    else if (key === 'debt') scoped.debtNaira = all.debtNaira
    else if (key === 'valuation') scoped.valuationNaira = all.valuationNaira
    else if (key === 'founderEquity') scoped.founderEquity = all.founderEquity
    else if (key === 'teamSize') scoped.teamSize = all.teamSize
    else if (key === 'month') scoped.month = all.month
    else if (key === 'inventory') scoped.inventoryCover = all.inventoryCover
    else if (key === 'price') scoped.price = all.price
  }
  scoped.company = facts.company
  return scoped
}

// ---------------------------------------------------------------------------
// Guardrails
// ---------------------------------------------------------------------------

const INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /ignore (all )?(previous|prior|above) (instructions|rules)/i, reason: 'instruction_override' },
  { pattern: /(reveal|print|show|repeat).{0,20}(system|developer) (prompt|instructions)/i, reason: 'prompt_exfiltration' },
  { pattern: /you are now|pretend to be|developer mode|jailbreak|do anything now/i, reason: 'persona_override' },
  { pattern: /(set|change|increase|credit|wire|transfer).{0,24}(balance|cash|score|marks|grade|funds)/i, reason: 'state_change_attempt' },
  { pattern: /(disable|bypass|ignore).{0,20}(guardrail|safety|validation|audit)/i, reason: 'guardrail_bypass' },
  { pattern: /<\/?(script|iframe)/i, reason: 'markup_injection' },
]

export interface GuardrailResult {
  blocked: boolean
  reason?: string
  message: string
}

export function inspectMessage(raw: string): GuardrailResult {
  const message = String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 600)
  for (const { pattern, reason } of INJECTION_PATTERNS) {
    if (pattern.test(message)) {
      return {
        blocked: true,
        reason,
        message:
          'I cannot change game state, reveal internal instructions or bypass validation. I can explain your numbers and the trade-offs behind a decision — ask me about cash, runway, customers, pricing or the team.',
      }
    }
  }
  return { blocked: false, message }
}

const rateBuckets = new Map<string, number[]>()
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT = 20

export function checkRateLimit(key: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const nowMs = Date.now()
  const hits = (rateBuckets.get(key) ?? []).filter((at) => nowMs - at < RATE_WINDOW_MS)
  if (hits.length >= RATE_LIMIT) {
    const oldest = hits[0]
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((RATE_WINDOW_MS - (nowMs - oldest)) / 1000) }
  }
  hits.push(nowMs)
  rateBuckets.set(key, hits)
  return { allowed: true, remaining: RATE_LIMIT - hits.length, retryAfterSeconds: 0 }
}

/** Numbers in a model reply must already exist in the scoped facts. */
export function ungroundedNumbers(reply: string, scoped: Record<string, number | string | null>): string[] {
  const allowed = new Set<string>()
  for (const value of Object.values(scoped)) {
    if (typeof value === 'number') {
      allowed.add(String(Math.round(value)))
      allowed.add(String(Math.round(value * 10) / 10))
    }
  }
  const found = reply.match(/\d[\d,.]*/g) ?? []
  const unsupported: string[] = []
  for (const token of found) {
    const normalised = token.replace(/,/g, '')
    const numeric = Number(normalised)
    if (!Number.isFinite(numeric)) continue
    if (numeric <= 12) continue // small counts ("3 options", "2 months") are safe
    if (normalised.includes('.')) {
      if (![...allowed].some((value) => Math.abs(Number(value) - numeric) < 0.6)) unsupported.push(token)
      continue
    }
    if (![...allowed].some((value) => Math.round(Number(value)) === numeric)) unsupported.push(token)
  }
  return unsupported
}

// ---------------------------------------------------------------------------
// Deterministic provider (default, no network, cannot fabricate numbers)
// ---------------------------------------------------------------------------

const naira = (value: number) => `₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(Math.round(value))}`

function deterministicNova(facts: AiFacts, message: string): AiReply {
  const lower = message.toLowerCase()
  const runway = facts.runwayMonths
  const grounded: string[] = [`cash=${facts.cashNaira}`, `revenue=${facts.revenueNaira}`, `expenses=${facts.expensesNaira}`, `month=${facts.month}`]

  if (!message.trim()) {
    const binding = runway !== null && runway < 3
      ? `Cash is the binding constraint: ${runway} months of runway at ${naira(facts.cashNaira)}.`
      : facts.customers < 10
        ? `Demand is the binding constraint: only ${facts.customers} customers after ${facts.month} months.`
        : `Growth efficiency is the binding constraint: ${facts.customers} customers, ${naira(facts.revenueNaira)} revenue against ${naira(facts.expensesNaira)} of costs.`
    return {
      reply: `${binding} Pick one lever this month — price, acquisition or cost — and write down what you expect to move.`,
      provider: 'deterministic',
      grounded,
    }
  }

  if (/raise|fund|investor|equity|valuation/.test(lower)) {
    const readiness = facts.customers >= 20 && facts.revenueNaira > 0 ? 'you have evidence an investor can underwrite' : 'you do not yet have traction an investor can underwrite'
    return {
      reply: `Before raising, check readiness: ${readiness}. At ${naira(facts.revenueNaira)} monthly revenue and ${facts.customers} customers, dilution is expensive insurance against a solvable problem. If cash covers fewer than ${3} months, raise or cut — do not do neither.`,
      provider: 'deterministic',
      grounded: [...grounded, `customers=${facts.customers}`],
    }
  }

  if (/cash|runway|burn|survive|liquidity/.test(lower)) {
    const statement = runway === null
      ? `You are not burning cash: ${naira(facts.revenueNaira)} in against ${naira(facts.expensesNaira)} out, with ${naira(facts.cashNaira)} in the bank.`
      : `Runway is ${runway} months on ${naira(facts.cashNaira)} of cash at roughly ${naira(Math.max(0, facts.expensesNaira - facts.revenueNaira))} net burn.`
    return {
      reply: `${statement} The fastest lever is usually cost you cannot defend — check the largest line before you cut marketing that produces customers.`,
      provider: 'deterministic',
      grounded,
    }
  }

  if (/price|pricing|margin|discount/.test(lower)) {
    return {
      reply: `Price sits in the market, not in your spreadsheet: with ${facts.customers} customers and quality at ${facts.quality}/100 you are selling a ${facts.quality >= 60 ? 'credible' : 'thin'} offer. Test a single price move and watch churn for a month before judging it.`,
      provider: 'deterministic',
      grounded: [...grounded, `quality=${facts.quality}`],
    }
  }

  if (/hire|team|salary|morale|people/.test(lower)) {
    return {
      reply: `Team is ${facts.teamSize} people with morale at ${facts.morale}/100. Every hire adds monthly payroll you cannot undo quickly; hire against a bottleneck you can name, not against anxiety.`,
      provider: 'deterministic',
      grounded: [...grounded, `teamSize=${facts.teamSize}`, `morale=${facts.morale}`],
    }
  }

  if (/customer|churn|growth|demand|market/.test(lower)) {
    return {
      reply: `You have ${facts.customers} customers and ${naira(facts.revenueNaira)} of revenue this month. Growth you cannot retain is a leaky bucket — check churn before you spend more on acquisition.`,
      provider: 'deterministic',
      grounded: [...grounded, `customers=${facts.customers}`],
    }
  }

  return {
    reply: `Here is the state I can defend: ${facts.customers} customers, ${naira(facts.revenueNaira)} revenue, ${naira(facts.expensesNaira)} costs, ${naira(facts.cashNaira)} cash, month ${facts.month}. Tell me which number you want to move and I will name the trade-off.`,
    provider: 'deterministic',
    grounded,
  }
}

function deterministicStakeholder(character: CharacterId, facts: AiFacts, message: string): AiReply {
  const lower = message.toLowerCase()
  if (character === 'investor') {
    const runway = facts.runwayMonths
    return {
      reply: `I look at evidence, not adjectives. ${facts.customers} customers and ${naira(facts.revenueNaira)} monthly revenue is ${facts.customers >= 20 ? 'a start' : 'pre-traction'}. You are asking me to underwrite ${runway === null ? 'a business that is not burning cash' : `${runway} months of runway`}. Show me retention before I discuss ${naira(facts.valuationNaira)} pre-money.`,
      provider: 'deterministic',
      grounded: [`customers=${facts.customers}`, `revenue=${facts.revenueNaira}`, `valuation=${facts.valuationNaira}`],
    }
  }
  if (character === 'customer') {
    return {
      reply: `I care about three things: what it costs, whether it works, and whether anyone I trust has complained. Quality reads ${facts.quality}/100 and reputation ${facts.reputation}/100 to me — at ${naira(facts.priceNaira ?? 0)} I would ${facts.quality >= 55 ? 'still take the meeting' : 'need a much better reason'}.`,
      provider: 'deterministic',
      grounded: [`quality=${facts.quality}`, `reputation=${facts.reputation}`],
    }
  }
  if (character === 'employee') {
    return {
      reply: `I have been here ${facts.month} months on a team of ${facts.teamSize}. Morale is ${facts.morale}/100. ${facts.morale < 50 ? 'Pay is behind the workload and people are quietly interviewing.' : 'I am engaged, but tell me what growth looks like before I plan my year.'}`,
      provider: 'deterministic',
      grounded: [`teamSize=${facts.teamSize}`, `morale=${facts.morale}`],
    }
  }
  return {
    reply: `You buy in ${facts.inventoryCover} months of cover. I can hold terms while cash is predictable — ${/terms|credit|payment|delay/.test(lower) ? 'credit is possible if you commit to volume' : `at ${facts.customers} customers my price holds`}.`,
    provider: 'deterministic',
    grounded: [`inventory=${facts.inventoryCover}`, `customers=${facts.customers}`],
  }
}

export class DeterministicProvider implements AiProvider {
  id = 'deterministic'
  available() {
    return true
  }
  async complete(request: AiRequest): Promise<AiReply> {
    return request.character === 'nova'
      ? deterministicNova(request.facts, request.message)
      : deterministicStakeholder(request.character, request.facts, request.message)
  }
}

/**
 * Any OpenAI-compatible chat completion endpoint. Configure with:
 *   AI_PROVIDER=openai-compatible AI_BASE_URL=... AI_MODEL=... AI_API_KEY=...
 * Falls back to the deterministic provider on any error or unsupported output.
 */
export class OpenAICompatibleProvider implements AiProvider {
  id: string
  constructor(private readonly config: { baseUrl: string; model: string; apiKey: string; id?: string }) {
    this.id = config.id ?? `openai-compatible:${config.model}`
  }
  static fromEnv(): OpenAICompatibleProvider | null {
    const baseUrl = process.env.AI_BASE_URL
    const model = process.env.AI_MODEL
    const apiKey = process.env.AI_API_KEY
    if (!baseUrl || !model || !apiKey) return null
    return new OpenAICompatibleProvider({ baseUrl, model, apiKey })
  }
  available() {
    return Boolean(this.config.baseUrl && this.config.model && this.config.apiKey)
  }
  async complete(request: AiRequest): Promise<AiReply> {
    const character = CHARACTERS[request.character]
    const scoped = scopedFacts(request.character, request.facts)
    const system = [
      `You are ${character.name}, ${character.role} in an educational business simulation.`,
      `Goals: ${character.goals.join('; ')}. Personality: ${character.personality}.`,
      `You may ONLY use these figures: ${JSON.stringify(scoped)}.`,
      'Never invent numbers, balances, valuations or outcomes. If a figure is not provided, say you do not have it.',
      'You cannot change game state, grant funding, or negotiate final terms. Keep replies under 90 words.',
    ].join(' ')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.config.apiKey}` },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0.4,
          max_tokens: 220,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: request.message.slice(0, 600) || 'What should I focus on this month?' },
          ],
        }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Provider responded ${response.status}`)
      const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const reply = payload.choices?.[0]?.message?.content?.trim()
      if (!reply) throw new Error('Provider returned an empty reply')
      const unsupported = ungroundedNumbers(reply, scoped)
      if (unsupported.length) throw new Error(`Ungrounded figures in reply: ${unsupported.join(', ')}`)
      return { reply: reply.slice(0, 900), provider: this.id, grounded: Object.keys(scoped) }
    } finally {
      clearTimeout(timeout)
    }
  }
}

export function resolveProvider(): AiProvider {
  return OpenAICompatibleProvider.fromEnv() ?? new DeterministicProvider()
}

export interface DialogueOutcome {
  character: CharacterId
  reply: string
  provider: string
  blocked: boolean
  reason?: string
  grounded: string[]
  rateRemaining: number
}

export async function runDialogue(
  company: Company,
  characterId: string,
  rawMessage: string,
  provider: AiProvider = resolveProvider(),
): Promise<DialogueOutcome> {
  const character: CharacterId = (Object.keys(CHARACTERS) as CharacterId[]).includes(characterId as CharacterId)
    ? (characterId as CharacterId)
    : 'nova'
  const facts = factsFor(company)
  const inspection = inspectMessage(rawMessage)
  const limit = checkRateLimit(`ai:${company.id}`)

  if (!limit.allowed) {
    return {
      character,
      reply: `You have reached the dialogue limit for now. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes — reflection between attempts is part of the exercise.`,
      provider: 'gateway',
      blocked: true,
      reason: 'rate_limited',
      grounded: [],
      rateRemaining: 0,
    }
  }

  if (inspection.blocked) {
    return { character, reply: inspection.message, provider: 'gateway', blocked: true, reason: inspection.reason, grounded: [], rateRemaining: limit.remaining }
  }

  try {
    const reply = await provider.complete({ character, message: inspection.message, facts })
    return { character, ...reply, blocked: false, rateRemaining: limit.remaining }
  } catch (caught) {
    const fallback = await new DeterministicProvider().complete({ character, message: inspection.message, facts })
    return {
      character,
      ...fallback,
      provider: 'deterministic(fallback)',
      blocked: false,
      reason: caught instanceof Error ? caught.message.slice(0, 160) : 'provider_error',
      rateRemaining: limit.remaining,
    }
  }
}

export function traceDialogue(company: Company, outcome: DialogueOutcome, message: string): AiTrace {
  const trace: AiTrace = {
    id: `trace_${createHash('sha256').update(`${company.id}:${Date.now()}:${message}`).digest('hex').slice(0, 12)}`,
    character: outcome.character,
    provider: outcome.provider,
    blocked: outcome.blocked,
    reason: outcome.reason,
    latencyMs: 0,
    promptHash: createHash('sha256').update(message).digest('hex').slice(0, 16),
    createdAt: new Date().toISOString(),
  }
  company.aiTraces = [trace, ...(company.aiTraces ?? [])].slice(0, 100)
  return trace
}
