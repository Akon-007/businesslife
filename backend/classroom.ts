import type { ClassRoom, ClassroomRecord, Database } from './types.js'
import { authorityOf, verifyChain } from './authority.js'
import { RUBRIC, rubricGrade } from './rubric.js'

export interface RosterEntry {
  studentId: string
  name: string
  email: string
  companyId: string | null
  company: string | null
  month: number
  score: number
  cash: number
  revenue: number
  status: string
  commits: number
  updatedAt: string | null
  grade: number | null
  feedback: string | null
  gradedAt: string | null
  integrity: 'verified' | 'flagged' | 'no-data' | 'broken-chain'
  violations: number
  /** Seed the student's latest run was generated with (null until first commit). */
  seed: number | null
  /** Does that seed match the assigned scenario seed? null = not comparable yet. */
  seedMatch: boolean | null
  /** 1–4 scores per criterion when the instructor used the rubric. */
  rubric: Record<string, number> | null
  rationale: string | null
  /** Engine score when the grade was recorded, for a documented delta. */
  engineScoreAtGrade: number | null
  /** Server-side replay verdict for this student's latest commit. */
  replay: 'match' | 'mismatch' | 'error' | 'none'
}

export function recordFor(classroom: ClassRoom, studentId: string): ClassroomRecord {
  classroom.records = classroom.records ?? []
  let record = classroom.records.find((item) => item.studentId === studentId)
  if (!record) {
    record = { studentId }
    classroom.records.push(record)
  }
  return record
}

export function rosterFor(database: Database, classroom: ClassRoom): RosterEntry[] {
  return classroom.studentIds.map((studentId) => {
    const player = database.players.find((item) => item.id === studentId)
    const companies = database.companies.filter((company) => company.playerId === studentId)
    const company = companies[companies.length - 1]
    const record = classroom.records?.find((item) => item.studentId === studentId)
    if (!company) {
      return {
        studentId,
        name: player?.name ?? 'Unknown student',
        email: player?.accountEmail ?? '',
        companyId: null,
        company: null,
        month: 0,
        score: 0,
        cash: 0,
        revenue: 0,
        status: 'no-company',
        commits: 0,
        updatedAt: null,
        grade: record?.grade ?? null,
        feedback: record?.feedback ?? null,
        gradedAt: record?.gradedAt ?? null,
        integrity: 'no-data' as const,
        violations: 0,
        seed: null,
        seedMatch: null,
        rubric: null,
        rationale: null,
        engineScoreAtGrade: null,
        replay: 'none' as const,
      }
    }
    const authority = authorityOf(company)
    const chain = verifyChain(company)
    const violations = company.authority?.lastViolationAt ? 1 : 0
    return {
      studentId,
      name: player?.name ?? company.name,
      email: player?.accountEmail ?? '',
      companyId: company.id,
      company: company.name,
      month: authority.month,
      score: authority.score,
      cash: Math.round(authority.cashKobo) / 100,
      revenue: Math.round(authority.revenueKobo) / 100,
      status: authority.status,
      commits: authority.commits,
      updatedAt: authority.updatedAt,
      grade: record?.grade ?? null,
      feedback: record?.feedback ?? null,
      gradedAt: record?.gradedAt ?? null,
      integrity: !chain.valid ? ('broken-chain' as const) : violations ? ('flagged' as const) : ('verified' as const),
      violations,
      seed: company.simulation.runSeed ?? null,
      seedMatch: seedComparison(company, classroom),
      rubric: record?.rubric ?? null,
      rationale: record?.rationale ?? null,
      engineScoreAtGrade: record?.engineScoreAtGrade ?? null,
      replay: company.simulation.replay?.status ?? 'none',
    }
  })
}

/**
 * Did this student run the scenario seed their instructor assigned?
 * `null` means the question cannot be answered yet (no scenario seed, or the
 * student has not committed a run).
 */
export function seedComparison(company: { simulation?: { scenarioSeed?: number; runSeed?: number } }, classroom: { scenario: Record<string, unknown> | null }): boolean | null {
  const assigned = Number(classroom.scenario?.seed)
  const run = Number(company.simulation?.runSeed)
  if (!Number.isFinite(assigned) || assigned <= 0) return null
  if (!Number.isFinite(run) || run <= 0) return null
  return Math.round(assigned) === Math.round(run)
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function rosterCsv(classroom: ClassRoom, entries: RosterEntry[]): string {
  const header = ['cohort', 'scenario', 'scenario_seed', 'student_id', 'student', 'email', 'company', 'month', 'engine_score', 'instructor_grade', 'grade_minus_engine', 'rubric_finance', 'rubric_strategy', 'rubric_operations', 'rubric_market', 'rubric_leadership', 'rubric_integrity', 'rationale', 'cash_ngn', 'revenue_ngn', 'status', 'commits', 'integrity', 'replay', 'seed_match', 'feedback', 'last_commit']
  const scenario = classroom.scenario ? String((classroom.scenario as { title?: string }).title ?? 'custom') : 'none'
  const scenarioSeed = classroom.scenario ? String((classroom.scenario as { seed?: number }).seed ?? '') : ''
  const rows = entries.map((entry) => [
    classroom.name,
    scenario,
    scenarioSeed,
    entry.studentId,
    entry.name,
    entry.email,
    entry.company ?? '',
    entry.month,
    entry.score,
    entry.grade ?? '',
    entry.grade === null || entry.engineScoreAtGrade === null ? '' : entry.grade - entry.engineScoreAtGrade,
    entry.rubric?.finance ?? '',
    entry.rubric?.strategy ?? '',
    entry.rubric?.operations ?? '',
    entry.rubric?.market ?? '',
    entry.rubric?.leadership ?? '',
    entry.rubric?.integrity ?? '',
    entry.rationale ?? '',
    entry.cash,
    entry.revenue,
    entry.status,
    entry.commits,
    entry.integrity,
    entry.replay,
    entry.seedMatch === null ? '' : entry.seedMatch ? 'yes' : 'no',
    entry.feedback ?? '',
    entry.updatedAt ?? '',
  ])
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

export function scenarioStart(scenario: Record<string, unknown> | null): { startingCashKobo: number; month: number; day: number; seed: number | null } {
  const cashNaira = Number(scenario?.startingCash ?? 0)
  const seed = Number(scenario?.seed)
  return {
    startingCashKobo: Number.isFinite(cashNaira) && cashNaira > 0 ? Math.round(cashNaira * 100) : 0,
    month: 0,
    day: 1,
    seed: Number.isFinite(seed) && seed > 0 ? Math.round(seed) : null,
  }
}

type RUBRIC_ID = (typeof RUBRIC)[number]['id']

export interface CompetencyStat {
  id: string
  label: string
  weight: number
  /** Mean level (1–4) across graded students who used the rubric. */
  mean: number | null
  /** How many students sit at each level, index 0 = level 1. */
  distribution: number[]
  /** Share of graded students at or above Proficient (3). */
  proficientShare: number | null
}

export interface StudentProfile {
  studentId: string
  name: string
  company: string | null
  grade: number | null
  engineScore: number | null
  /** Latest 1–4 levels per competency, null when the grade was not a rubric grade. */
  levels: Record<string, number> | null
  /** Weighted grade of that latest rubric, so the profile can be checked. */
  rubricGrade: number | null
  /** Grade history, oldest first: { at, grade, engineScore }. */
  history: { at: string; grade: number; engineScore: number | null }[]
  /** Change in grade from the first recorded grade to the latest. */
  trend: number | null
}

export interface CohortComparison {
  classId: string
  className: string
  size: number
  active: number
  graded: number
  rubricGraded: number
  meanGrade: number | null
  meanEngineScore: number | null
  /** Mean instructor grade minus mean engine score: how generous the marking is. */
  meanDelta: number | null
  integrity: { verified: number; flagged: number; brokenChain: number; noData: number }
  seedMatch: { matched: number; different: number; unknown: number }
  replay: { match: number; mismatch: number; error: number; none: number }
  /** Engine score buckets, the CV-shaped band an examiner can read at a glance. */
  buckets: { label: string; min: number; max: number; count: number }[]
  competencies: CompetencyStat[]
  students: StudentProfile[]
}

const BUCKETS = [
  { label: '0-39', min: 0, max: 39 },
  { label: '40-54', min: 40, max: 54 },
  { label: '55-69', min: 55, max: 69 },
  { label: '70-84', min: 70, max: 84 },
  { label: '85-100', min: 85, max: 100 },
]

const mean = (values: number[]) => (values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)) : null)

/**
 * A cohort read-out for the instructor: where the group sits, competence by
 * competence, and each student's own profile over time.
 *
 * Everything here is derived from the roster and the recorded grade history —
 * no separate store, so a comparison cannot drift from the marks it summarises.
 */
export function comparisonFor(database: Database, classroom: ClassRoom): CohortComparison {
  const roster = rosterFor(database, classroom)
  const graded = roster.filter((entry) => entry.grade !== null)
  const rubricEntries = graded.filter((entry) => entry.rubric)

  const competencies: CompetencyStat[] = RUBRIC.map((criterion) => {
    const levels = rubricEntries
      .map((entry) => entry.rubric?.[criterion.id])
      .filter((level): level is number => typeof level === 'number' && level >= 1 && level <= 4)
    const distribution = [1, 2, 3, 4].map((level) => levels.filter((value) => value === level).length)
    return {
      id: criterion.id,
      label: criterion.label,
      weight: criterion.weight,
      mean: mean(levels),
      distribution,
      proficientShare: levels.length ? Number(((levels.filter((value) => value >= 3).length / levels.length) * 100).toFixed(1)) : null,
    }
  })

  const grades = graded.map((entry) => entry.grade as number)
  const engineScores = graded.map((entry) => entry.engineScoreAtGrade).filter((score): score is number => typeof score === 'number')

  const students: StudentProfile[] = roster.map((entry) => {
    const record = classroom.records?.find((item) => item.studentId === entry.studentId)
    const history = (record?.history ?? []).map((item) => ({ at: item.gradedAt, grade: item.grade, engineScore: item.engineScore ?? null }))
    const first = history[0]
    const last = history[history.length - 1]
    return {
      studentId: entry.studentId,
      name: entry.name,
      company: entry.company,
      grade: entry.grade,
      engineScore: entry.engineScoreAtGrade ?? entry.score,
      levels: entry.rubric ?? null,
      rubricGrade: entry.rubric ? rubricGrade(entry.rubric as Record<RUBRIC_ID, 1 | 2 | 3 | 4>) : null,
      history,
      trend: history.length > 1 && first && last ? last.grade - first.grade : null,
    }
  })

  return {
    classId: classroom.id,
    className: classroom.name,
    size: roster.length,
    active: roster.filter((entry) => entry.status === 'active' || entry.status === 'running').length,
    graded: graded.length,
    rubricGraded: rubricEntries.length,
    meanGrade: mean(grades),
    meanEngineScore: mean(engineScores),
    meanDelta: grades.length && engineScores.length ? Number((mean(grades)! - mean(engineScores)!).toFixed(2)) : null,
    integrity: {
      verified: roster.filter((entry) => entry.integrity === 'verified').length,
      flagged: roster.filter((entry) => entry.integrity === 'flagged').length,
      brokenChain: roster.filter((entry) => entry.integrity === 'broken-chain').length,
      noData: roster.filter((entry) => entry.integrity === 'no-data').length,
    },
    seedMatch: {
      matched: roster.filter((entry) => entry.seedMatch === true).length,
      different: roster.filter((entry) => entry.seedMatch === false).length,
      unknown: roster.filter((entry) => entry.seedMatch === null).length,
    },
    replay: {
      match: roster.filter((entry) => entry.replay === 'match').length,
      mismatch: roster.filter((entry) => entry.replay === 'mismatch').length,
      error: roster.filter((entry) => entry.replay === 'error').length,
      none: roster.filter((entry) => entry.replay === 'none').length,
    },
    buckets: BUCKETS.map((bucket) => ({
      ...bucket,
      count: roster.filter((entry) => entry.score >= bucket.min && entry.score <= bucket.max).length,
    })),
    competencies,
    students,
  }
}
