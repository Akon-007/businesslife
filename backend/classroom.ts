import type { ClassRoom, ClassroomRecord, Database } from './types.js'
import { authorityOf, verifyChain } from './authority.js'

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
    }
  })
}

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function rosterCsv(classroom: ClassRoom, entries: RosterEntry[]): string {
  const header = ['cohort', 'scenario', 'student_id', 'student', 'email', 'company', 'month', 'engine_score', 'instructor_grade', 'cash_ngn', 'revenue_ngn', 'status', 'commits', 'integrity', 'feedback', 'last_commit']
  const scenario = classroom.scenario ? String((classroom.scenario as { title?: string }).title ?? 'custom') : 'none'
  const rows = entries.map((entry) => [
    classroom.name,
    scenario,
    entry.studentId,
    entry.name,
    entry.email,
    entry.company ?? '',
    entry.month,
    entry.score,
    entry.grade ?? '',
    entry.cash,
    entry.revenue,
    entry.status,
    entry.commits,
    entry.integrity,
    entry.feedback ?? '',
    entry.updatedAt ?? '',
  ])
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

export function scenarioStart(scenario: Record<string, unknown> | null): { startingCashKobo: number; month: number; day: number } {
  const cashNaira = Number(scenario?.startingCash ?? 0)
  return {
    startingCashKobo: Number.isFinite(cashNaira) && cashNaira > 0 ? Math.round(cashNaira * 100) : 0,
    month: 0,
    day: 1,
  }
}
