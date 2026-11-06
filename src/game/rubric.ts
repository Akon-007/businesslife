/**
 * Client mirror of the server rubric (backend/rubric.ts). The server recomputes
 * and stores the grade; this copy drives the instructor's preview and the
 * suggested levels. `scripts/verify-rubric.ts` fails if the two lists diverge.
 */
import type { GameState } from './types'

export type RubricId = 'finance' | 'strategy' | 'operations' | 'market' | 'leadership' | 'integrity'

export interface RubricCriterion {
  id: RubricId
  label: string
  weight: number
  hint: string
}

export const RUBRIC: readonly RubricCriterion[] = [
  { id: 'finance', label: 'Financial acumen', weight: 25, hint: 'Protected cash, collected receivables, kept margins, funded growth deliberately.' },
  { id: 'strategy', label: 'Strategy & priorities', weight: 20, hint: 'A coherent position: price, product and customers pulled in one direction.' },
  { id: 'operations', label: 'Operational execution', weight: 15, hint: 'Supply, capacity and quality held together while demand grew.' },
  { id: 'market', label: 'Market & customer', weight: 15, hint: 'Demand created and retained — funnel, pricing and churn, not one-off luck.' },
  { id: 'leadership', label: 'Leadership & team', weight: 15, hint: 'Hired deliberately, kept morale up, handled crises without breaking the team.' },
  { id: 'integrity', label: 'Ethics & governance', weight: 10, hint: 'Honest claims, defensible trade-offs, stakeholders treated fairly.' },
] as const

export const RUBRIC_LEVELS = [
  { level: 1, label: 'Emerging', points: 25 },
  { level: 2, label: 'Developing', points: 50 },
  { level: 3, label: 'Proficient', points: 75 },
  { level: 4, label: 'Exemplary', points: 100 },
] as const

export type RubricLevel = 1 | 2 | 3 | 4
export type RubricScores = Record<RubricId, RubricLevel>

export const DEFAULT_RUBRIC: RubricScores = {
  finance: 3,
  strategy: 3,
  operations: 3,
  market: 3,
  leadership: 3,
  integrity: 3,
}

export const MIN_RATIONALE = 40

export function localGrade(rubric: RubricScores): number {
  const total = RUBRIC.reduce((sum, criterion) => {
    const points = RUBRIC_LEVELS.find((item) => item.level === rubric[criterion.id])?.points ?? 0
    return sum + points * criterion.weight
  }, 0)
  const weights = RUBRIC.reduce((sum, criterion) => sum + criterion.weight, 0)
  return Math.round(total / weights)
}

/** Weighted contribution of one competency, in grade points out of 100. */
export function criterionPoints(rubric: RubricScores, id: RubricId): number {
  const criterion = RUBRIC.find((item) => item.id === id)
  if (!criterion) return 0
  const level = RUBRIC_LEVELS.find((item) => item.level === rubric[id])?.points ?? 0
  return Math.round((level * criterion.weight) / 100)
}

const levelFrom = (ratio: number): RubricLevel => (ratio >= 0.85 ? 4 : ratio >= 0.6 ? 3 : ratio >= 0.35 ? 2 : 1)

/**
 * A starting position for the instructor, derived from the run itself. It is
 * evidence, not a verdict: every level can be overridden, and the written
 * rationale is what actually justifies the grade.
 */
export function suggestRubric(state: GameState): { scores: RubricScores; evidence: Record<RubricId, string> } {
  const months = Math.max(1, state.month)
  const last = state.lastReport
  const revenue = last?.revenue ?? state.customers * state.price
  const net = last?.netProfit ?? 0
  const margin = revenue > 0 ? net / revenue : 0
  const cashMonths = last && last.cashEnd > 0 && last.costs > 0 ? last.cashEnd / last.costs : 0
  const retention = last ? 1 - last.churned / Math.max(1, last.customersEnd + last.churned) : 0
  const utilisation = last && last.capacity > 0 ? last.customersEnd / last.capacity : 0
  const teamSize = state.team.length
  const emergencies = state.emergencyLoans ?? 0
  const statements = state.statements ?? []
  const imbalance = statements.at(-1)?.balance.imbalance ?? 0

  const financeRatio = clamp01(0.45 * clamp01(margin / 0.25) + 0.3 * clamp01(cashMonths / 6) + 0.25 * (emergencies === 0 ? 1 : 0.2))
  const strategyRatio = clamp01(0.4 * clamp01(state.valuation / Math.max(1, (state.startingCash ?? 1) * 6)) + 0.3 * clamp01(retention) + 0.3 * clamp01(state.reputation / 100))
  const operationsRatio = clamp01(0.4 * (1 - clamp01(utilisation - 1)) + 0.3 * (1 - clamp01((last?.returns ?? 0) / Math.max(1, revenue))) + 0.3 * clamp01(state.quality / 100))
  const marketRatio = clamp01(0.4 * clamp01(retention) + 0.3 * clamp01(state.customers / 150) + 0.3 * clamp01(state.reputation / 100))
  const leadershipRatio = clamp01(0.4 * clamp01(state.morale / 100) + 0.3 * clamp01(teamSize / 4) + 0.3 * (state.status === 'active' ? 1 : 0.3))
  const integrityRatio = clamp01(0.5 * (Math.abs(imbalance) <= 1 ? 1 : 0.3) + 0.3 * (emergencies === 0 ? 1 : 0.2) + 0.2 * clamp01(months / 12))

  return {
    scores: {
      finance: levelFrom(financeRatio),
      strategy: levelFrom(strategyRatio),
      operations: levelFrom(operationsRatio),
      market: levelFrom(marketRatio),
      leadership: levelFrom(leadershipRatio),
      integrity: levelFrom(integrityRatio),
    },
    evidence: {
      finance: `Net margin ${percent(margin)}, ${cashMonths.toFixed(1)} months of costs in cash, ${emergencies} emergency loan${emergencies === 1 ? '' : 's'}.`,
      strategy: `Valuation ₦${Math.round(state.valuation).toLocaleString()} against ₦${Math.round(state.startingCash ?? 0).toLocaleString()} of starting capital.`,
      operations: `Capacity ${percent(utilisation, 0)} used, ₦${Math.round(last?.returns ?? 0).toLocaleString()} of refunds, quality ${Math.round(state.quality)}.`,
      market: `${Math.round(retention * 100)}% retention on ${Math.round(state.customers)} customers, reputation ${Math.round(state.reputation)}.`,
      leadership: `Morale ${Math.round(state.morale)} across ${teamSize} hire${teamSize === 1 ? '' : 's'}, ${months} months survived.`,
      integrity: `Books ${Math.abs(imbalance) <= 1 ? 'balanced' : `out by ₦${Math.round(imbalance)}`}, ${emergencies} emergency bailout${emergencies === 1 ? '' : 's'} taken.`,
    },
  }
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
const percent = (value: number, digits = 0) => `${(clampNumber(value) * 100).toFixed(digits)}%`
const clampNumber = (value: number) => (Number.isFinite(value) ? value : 0)
