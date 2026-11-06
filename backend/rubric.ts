/**
 * Grading rubric. Instructors score four dimensions on a 1–4 scale; the
 * weights below produce the final 0–100 grade. Every graded run must carry a
 * written rationale so a grade can be justified to a student or an examiner.
 */
export interface RubricCriterion {
  id: 'cash' | 'customers' | 'operations' | 'judgement'
  label: string
  weight: number
  hint: string
}

export const RUBRIC: readonly RubricCriterion[] = [
  {
    id: 'cash',
    label: 'Cash & runway discipline',
    weight: 30,
    hint: 'Did they protect cash, collect receivables and avoid emergency credit?',
  },
  {
    id: 'customers',
    label: 'Customer & revenue evidence',
    weight: 30,
    hint: 'Growth backed by price, retention and pipeline rather than one-off luck.',
  },
  {
    id: 'operations',
    label: 'Team & operations',
    weight: 20,
    hint: 'Hiring, morale, supplier choice and quality held together under load.',
  },
  {
    id: 'judgement',
    label: 'Decision quality & rationale',
    weight: 20,
    hint: 'Choices are justified, reversible where possible, and defensible in review.',
  },
] as const

export type RubricId = RubricCriterion['id']
export const RUBRIC_LEVELS = [1, 2, 3, 4] as const
export type RubricLevel = (typeof RUBRIC_LEVELS)[number]

const LEVEL_POINTS: Record<RubricLevel, number> = { 1: 25, 2: 50, 3: 75, 4: 100 }

export const MIN_RATIONALE = 40

export function isRubricLevel(value: unknown): value is RubricLevel {
  return value === 1 || value === 2 || value === 3 || value === 4
}

/** Normalise and validate an incoming rubric object. Returns null when incomplete. */
export function parseRubric(input: unknown): Record<RubricId, RubricLevel> | null {
  if (!input || typeof input !== 'object') return null
  const source = input as Record<string, unknown>
  const parsed = {} as Record<RubricId, RubricLevel>
  for (const criterion of RUBRIC) {
    const value = source[criterion.id]
    if (!isRubricLevel(value)) return null
    parsed[criterion.id] = value
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
    points: Math.round(LEVEL_POINTS[rubric[criterion.id]] * criterion.weight) / 100,
  }))
}
