/**
 * Client mirror of the server rubric (backend/rubric.ts). The server recomputes
 * and stores the grade; this copy only drives the instructor's preview.
 */
export const RUBRIC = [
  { id: 'cash', label: 'Cash & runway', weight: 30, hint: 'Protected cash, collected receivables, avoided emergency credit.' },
  { id: 'customers', label: 'Customers & revenue', weight: 30, hint: 'Growth backed by price, retention and pipeline evidence.' },
  { id: 'operations', label: 'Team & operations', weight: 20, hint: 'Hiring, morale, suppliers and quality held together.' },
  { id: 'judgement', label: 'Decision quality', weight: 20, hint: 'Choices are justified and defensible in review.' },
] as const

export type RubricId = (typeof RUBRIC)[number]['id']

export const RUBRIC_LEVELS = [
  { level: 1, label: 'Emerging', points: 25 },
  { level: 2, label: 'Developing', points: 50 },
  { level: 3, label: 'Proficient', points: 75 },
  { level: 4, label: 'Exemplary', points: 100 },
] as const

export type RubricLevel = 1 | 2 | 3 | 4
export type RubricScores = Record<RubricId, RubricLevel>

export const DEFAULT_RUBRIC: RubricScores = { cash: 3, customers: 3, operations: 3, judgement: 3 }

export const MIN_RATIONALE = 40

export function localGrade(rubric: RubricScores): number {
  const total = RUBRIC.reduce((sum, criterion) => {
    const points = RUBRIC_LEVELS.find((item) => item.level === rubric[criterion.id])?.points ?? 0
    return sum + points * criterion.weight
  }, 0)
  const weights = RUBRIC.reduce((sum, criterion) => sum + criterion.weight, 0)
  return Math.round(total / weights)
}
