/**
 * Grading rubric — the six competencies the scope specifies, weighted
 * 25 / 20 / 15 / 15 / 15 / 10.
 *
 * Instructors score each competency 1–4; the weights produce the final 0–100
 * grade. Every graded run carries a written rationale so a grade can be
 * justified to a student or an examiner.
 *
 * The client keeps a mirror of this list in `src/game/rubric.ts` for its preview
 * grade; `scripts/verify-rubric.ts` fails if the two ever disagree.
 */
export type RubricId = 'finance' | 'strategy' | 'operations' | 'market' | 'leadership' | 'integrity'

export interface RubricCriterion {
  id: RubricId
  label: string
  weight: number
  hint: string
}

export const RUBRIC: readonly RubricCriterion[] = [
  {
    id: 'finance',
    label: 'Financial acumen',
    weight: 25,
    hint: 'Protected cash, collected receivables, kept margins, funded growth deliberately.',
  },
  {
    id: 'strategy',
    label: 'Strategy & priorities',
    weight: 20,
    hint: 'A coherent position: price, product and customers pulled in one direction.',
  },
  {
    id: 'operations',
    label: 'Operational execution',
    weight: 15,
    hint: 'Supply, capacity and quality held together while demand grew.',
  },
  {
    id: 'market',
    label: 'Market & customer',
    weight: 15,
    hint: 'Demand created and retained — funnel, pricing and churn, not one-off luck.',
  },
  {
    id: 'leadership',
    label: 'Leadership & team',
    weight: 15,
    hint: 'Hired deliberately, kept morale up, handled crises without breaking the team.',
  },
  {
    id: 'integrity',
    label: 'Ethics & governance',
    weight: 10,
    hint: 'Honest claims, defensible trade-offs, stakeholders treated fairly.',
  },
] as const

export const RUBRIC_LEVELS = [1, 2, 3, 4] as const
export type RubricLevel = (typeof RUBRIC_LEVELS)[number]

const LEVEL_POINTS: Record<RubricLevel, number> = { 1: 25, 2: 50, 3: 75, 4: 100 }

export const MIN_RATIONALE = 40

export function isRubricLevel(value: unknown): value is RubricLevel {
  return value === 1 || value === 2 || value === 3 || value === 4
}

/**
 * Rubrics graded before the six-competency framework used four criteria. Their
 * grades are still on record, so the old shape is mapped rather than rejected:
 * cash → finance, customers → market, operations → operations, judgement →
 * strategy; leadership and integrity default to Proficient.
 */
const LEGACY_MAP: Record<string, RubricId> = {
  cash: 'finance',
  customers: 'market',
  operations: 'operations',
  judgement: 'strategy',
}

/** Normalise and validate an incoming rubric object. Returns null when incomplete. */
export function parseRubric(input: unknown): Record<RubricId, RubricLevel> | null {
  if (!input || typeof input !== 'object') return null
  const source = input as Record<string, unknown>
  const parsed = {} as Record<RubricId, RubricLevel>

  for (const criterion of RUBRIC) {
    const value = source[criterion.id]
    if (value === undefined) continue
    if (!isRubricLevel(value)) return null
    parsed[criterion.id] = value
  }

  const legacyKeys = Object.keys(LEGACY_MAP).filter((key) => key in source)
  if (legacyKeys.length) {
    for (const key of legacyKeys) {
      const value = source[key]
      if (!isRubricLevel(value)) return null
      const mapped = LEGACY_MAP[key]
      if (parsed[mapped] === undefined) parsed[mapped] = value
    }
  }

  for (const criterion of RUBRIC) {
    if (parsed[criterion.id] === undefined) {
      // Only a legacy crescent may leave criteria unset, and only the two that
      // had no equivalent.
      if (!legacyKeys.length) return null
      parsed[criterion.id] = 3
    }
  }
  return parsed
}

/** Weighted 0–100 grade for a complete rubric. */
export function rubricGrade(rubric: Record<RubricId, RubricLevel>): number {
  const total = RUBRIC.reduce((sum, criterion) => sum + LEVEL_POINTS[rubric[criterion.id]] * criterion.weight, 0)
  const weights = RUBRIC.reduce((sum, criterion) => sum + criterion.weight, 0)
  return Math.round(total / weights)
}

export function rubricBreakdown(rubric: Record<RubricId, RubricLevel>) {
  return RUBRIC.map((criterion) => ({
    id: criterion.id,
    label: criterion.label,
    weight: criterion.weight,
    level: rubric[criterion.id],
    points: Math.round((LEVEL_POINTS[rubric[criterion.id]] * criterion.weight) / 100),
  }))
}
