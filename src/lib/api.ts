type Json = Record<string, unknown>

const TOKEN_KEYS = {
  learner: 'businesslife.api.token',
  instructor: 'businesslife.api.instructor-token',
} as const

export type AuthScope = keyof typeof TOKEN_KEYS

function readToken(scope: AuthScope) {
  try {
    return window.localStorage.getItem(TOKEN_KEYS[scope])
  } catch {
    return null
  }
}

function writeToken(scope: AuthScope, token: string) {
  try {
    window.localStorage.setItem(TOKEN_KEYS[scope], token)
  } catch {
    /* private mode */
  }
}

export function clearSession(scope: AuthScope) {
  try {
    window.localStorage.removeItem(TOKEN_KEYS[scope])
  } catch {
    /* ignore */
  }
}

async function request<T>(path: string, options: RequestInit & { scope?: AuthScope } = {}): Promise<T> {
  const { scope = 'learner', ...init } = options
  const headers = new Headers(init.headers)
  headers.set('content-type', 'application/json')
  const token = readToken(scope)
  if (token) headers.set('authorization', `Bearer ${token}`)
  const response = await fetch(path, { ...init, headers })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!response.ok) {
    const failure = new Error(payload.error?.message ?? `API request failed (${response.status})`) as Error & { status?: number }
    failure.status = response.status
    throw failure
  }
  return payload
}

interface AuthResponse { token: string; player: { id: string; name: string; role: string }; expiresAt?: string }

export async function ensureApiSession(
  name: string,
  profile: { firstName?: string; lastName?: string; nickname?: string; avatar?: string; accountEmail?: string; password?: string } = {},
) {
  const existing = readToken('learner')
  if (existing) return existing
  const accountEmail = profile.accountEmail?.trim().toLowerCase() ?? ''
  const password = profile.password ?? ''
  let result: AuthResponse
  if (accountEmail && password.length >= 8) {
    // Real accounts: register once, then sign in with the same credentials.
    try {
      result = await request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, ...profile, accountEmail, password }),
      })
    } catch (error) {
      if ((error as { status?: number }).status !== 409) throw error
      result = await request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ accountEmail, password }),
      })
    }
  } else {
    result = await request<AuthResponse>('/api/auth/dev-login', { method: 'POST', body: JSON.stringify({ name, ...profile }) })
  }
  writeToken('learner', result.token)
  return result.token
}

export async function signOut(scope: AuthScope = 'learner') {
  const token = readToken(scope)
  clearSession(scope)
  if (!token) return
  try {
    await fetch('/api/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${token}` } })
  } catch {
    /* local session is already cleared */
  }
}

export async function checkCompanyName(name: string) {
  const result = await request<{ available: boolean; name: string }>(`/api/companies/name-availability?name=${encodeURIComponent(name.trim())}`)
  return result
}

export async function createRemoteCompany(input: { founder: string; company: string; industry: string; strategy: string; ambition: string; startingCash: number; firstName?: string; lastName?: string; nickname?: string; avatar?: string; accountEmail?: string; password?: string; problem?: string; solution?: string }) {
  await ensureApiSession(input.founder, input)
  return request<{ id: string }>('/api/companies', {
    method: 'POST',
    body: JSON.stringify({
      name: input.company,
      sector: input.industry,
      businessModel: input.strategy,
      problem: input.problem ?? 'A customer problem worth solving',
      solution: input.solution ?? 'A first useful product or service',
      ambition: input.ambition,
      initialCapitalKobo: Math.round(input.startingCash * 100),
    }),
  })
}

export function syncCompanyAction(companyId: string | undefined, action: string, payload: Json = {}, idempotencyKey?: string) {
  if (!companyId) return Promise.resolve()
  const headers = idempotencyKey ? { 'idempotency-key': idempotencyKey } : undefined
  return request(`/api/companies/${companyId}/${action}`, { method: 'POST', headers, body: JSON.stringify(payload) }).then(() => undefined)
}

export function syncMission(companyId: string | undefined, missionId: string) {
  if (!companyId) return Promise.resolve()
  return request(`/api/companies/${companyId}/missions/${missionId}/complete`, { method: 'POST', body: '{}' }).then(() => undefined)
}

export function syncFundingAction(companyId: string | undefined, offerId: string, amount: number, equity: number) {
  if (!companyId) return Promise.resolve()
  return request(`/api/funding/offers/${offerId}/response`, { method: 'POST', body: JSON.stringify({ companyId, amount, equity }) }).then(() => undefined)
}

// ---------------------------------------------------------------------------
// Server-authoritative run state
// ---------------------------------------------------------------------------

export interface CanonicalRun {
  month: number
  day: number
  cashKobo: number
  customers: number
  revenueKobo: number
  expensesKobo: number
  valuationKobo: number
  status: string
}

export interface AuthorityViolationView {
  code: string
  field: string
  message: string
  clientValue?: number | string | null
  canonicalValue?: number | string | null
  at: string
}

export interface RunState {
  companyId: string
  authority: {
    version: number
    score: number
    month: number
    day: number
    cash: number
    revenue: number
    expenses: number
    valuation: number
    status: string
    commits: number
    updatedAt: string
  }
  canonical: CanonicalRun
  score: number
  integrity: { valid: boolean; length: number; head?: string; brokenAt?: number }
  violations: AuthorityViolationView[]
  readOnly: boolean
}

export function fetchRun(companyId: string): Promise<RunState> {
  return request<RunState>(`/api/companies/${companyId}/run`)
}

export interface CommitResponse {
  accepted: boolean
  tampered: boolean
  canonical: CanonicalRun
  score: number
  violations: AuthorityViolationView[]
  integrity: { valid: boolean; length: number }
}

export function commitRun(companyId: string, payload: Json): Promise<CommitResponse> {
  return request<CommitResponse>(`/api/companies/${companyId}/run`, { method: 'PUT', body: JSON.stringify(payload) })
}

export interface AuditResponse {
  verification: { valid: boolean; length: number; brokenAt?: number }
  records: Array<{ seq: number; at: string; type: string; actor: string; hash: string }>
  violations: AuthorityViolationView[]
}

export interface ReplayVerdict {
  status: 'match' | 'mismatch' | 'error' | 'none'
  ok?: boolean
  error?: string | null
  ops: number
  months: number
  score?: number
  authorityScore?: number
  message?: string
  replay?: { status: string; checkedAt: string; ops: number; months: number; diffs: number; error?: string } | null
}

/** Ask the server to re-execute this company from its seed and decision journal. */
export function fetchReplay(companyId: string, scope: 'learner' | 'instructor' = 'learner'): Promise<ReplayVerdict> {
  return request<ReplayVerdict>(`/api/companies/${companyId}/replay`, { scope })
}

export function fetchAudit(companyId: string): Promise<AuditResponse> {
  return request<AuditResponse>(`/api/companies/${companyId}/audit`)
}

// ---------------------------------------------------------------------------
// AI gateway
// ---------------------------------------------------------------------------

export interface AiReply {
  character: string
  reply: string
  provider: string
  blocked: boolean
  reason?: string
  grounded: string[]
  rateRemaining: number
}

export function askAdvisor(companyId: string, question: string): Promise<AiReply> {
  return request<AiReply>(`/api/companies/${companyId}/ai/advice`, { method: 'POST', body: JSON.stringify({ question }) })
}

export function talkToCharacter(companyId: string, character: string, message: string): Promise<AiReply> {
  return request<AiReply>(`/api/companies/${companyId}/ai/dialogue`, { method: 'POST', body: JSON.stringify({ character, message }) })
}

export interface AiCharacter {
  id: string
  name: string
  role: string
  goals: string[]
  personality: string
  knowledge: string[]
}

export interface AiCharacterCatalog {
  characters: AiCharacter[]
  provider: string
  guardrails: { tools: string; rateLimit: string; stateChanges: string; numericValidation: string }
}

export function fetchCharacters(companyId: string): Promise<AiCharacterCatalog> {
  return request<AiCharacterCatalog>(`/api/companies/${companyId}/ai/characters`)
}

// ---------------------------------------------------------------------------
// Instructor portal
// ---------------------------------------------------------------------------

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
  seed: number | null
  seedMatch: boolean | null
  rubric: Record<string, number> | null
  rationale: string | null
  engineScoreAtGrade: number | null
  replay: 'match' | 'mismatch' | 'error' | 'none'
}

export interface RubricCriterion {
  id: 'cash' | 'customers' | 'operations' | 'judgement'
  label: string
  weight: number
  hint: string
}

export async function fetchRubric(): Promise<{ criteria: RubricCriterion[]; minRationale: number }> {
  return request('/api/rubric')
}

export interface Cohort {
  id: string
  lecturerId: string
  name: string
  studentIds: string[]
  scenario: Record<string, unknown> | null
  createdAt: string
  roster?: RosterEntry[]
}

export async function instructorLogin(name: string, email?: string, password?: string, instructorCode?: string) {
  const accountEmail = email?.trim().toLowerCase() ?? ''
  let result: AuthResponse
  if (accountEmail && password && password.length >= 8) {
    try {
      result = await request<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, accountEmail, password, role: 'instructor', instructorCode: instructorCode ?? '' }),
      })
    } catch (error) {
      if ((error as { status?: number }).status !== 409) throw error
      result = await request<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ accountEmail, password }),
      })
      if (result.player.role === 'learner') throw new Error('That account is a student account, not an instructor account.')
    }
  } else {
    result = await request<AuthResponse>('/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ name, accountEmail, role: 'instructor', password: crypto.randomUUID() }),
    })
  }
  writeToken('instructor', result.token)
  return result.player
}

export function instructorSession() {
  return readToken('instructor')
}

export async function listClasses(): Promise<Cohort[]> {
  const result = await request<{ classes: Cohort[] }>('/api/classes', { scope: 'instructor' })
  return result.classes
}

export function createClass(name: string): Promise<Cohort> {
  return request<Cohort>('/api/classes', { method: 'POST', scope: 'instructor', body: JSON.stringify({ name }) })
}

export function inviteStudent(classId: string, payload: { studentId?: string; email?: string }): Promise<Cohort> {
  return request<Cohort>(`/api/classes/${classId}/invite`, { method: 'POST', scope: 'instructor', body: JSON.stringify(payload) })
}

export function assignScenario(classId: string, scenario: Record<string, unknown>): Promise<{ scenario: Record<string, unknown> }> {
  return request(`/api/classes/${classId}/scenario`, { method: 'POST', scope: 'instructor', body: JSON.stringify(scenario) })
}

export function fetchRoster(classId: string): Promise<{ class: Cohort; roster: RosterEntry[] }> {
  return request(`/api/classes/${classId}/roster`, { scope: 'instructor' })
}

export function gradeStudent(
  classId: string,
  payload: { studentId: string; grade?: number; feedback?: string; rationale?: string; rubric?: Record<string, number> },
): Promise<{ roster: RosterEntry[] }> {
  return request(`/api/classes/${classId}/grade`, { method: 'POST', scope: 'instructor', body: JSON.stringify(payload) })
}

export function resetStudent(classId: string, studentId: string): Promise<{ roster: RosterEntry[] }> {
  return request(`/api/classes/${classId}/reset`, { method: 'POST', scope: 'instructor', body: JSON.stringify({ studentId }) })
}

export async function downloadRosterCsv(classId: string, filename: string) {
  const token = readToken('instructor')
  const response = await fetch(`/api/classes/${classId}/export.csv`, { headers: token ? { authorization: `Bearer ${token}` } : undefined })
  if (!response.ok) throw new Error(`Export failed (${response.status})`)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export interface CohortScenario {
  title?: string
  industry?: string
  difficulty?: string
  startingCash?: number
  months?: number
  objectives?: string[]
  seed?: number
  deadline?: string | null
}

export interface StudentCohort {
  id: string
  name: string
  lecturerId: string
  scenario: CohortScenario | null
}

/** Cohorts this student belongs to (with the scenario they were assigned). */
export async function myCohorts(): Promise<StudentCohort[]> {
  const result = await request<{ classes?: StudentCohort[] }>('/api/classes', { scope: 'learner' })
  return result.classes ?? []
}
