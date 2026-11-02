type Json = Record<string, unknown>

const TOKEN_KEY = 'businesslife.api.token'

function token() {
  try { return window.localStorage.getItem(TOKEN_KEY) } catch { return null }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('content-type', 'application/json')
  const auth = token()
  if (auth) headers.set('authorization', `Bearer ${auth}`)
  const response = await fetch(path, { ...options, headers })
  const payload = (await response.json()) as T & { error?: { message?: string } }
  if (!response.ok) throw new Error(payload.error?.message ?? `API request failed (${response.status})`)
  return payload
}

export async function ensureApiSession(name: string, profile: { firstName?: string; lastName?: string; nickname?: string; avatar?: string; accountEmail?: string; password?: string } = {}) {
  const existing = token()
  if (existing) return existing
  const result = await request<{ token: string }>('/api/auth/dev-login', { method: 'POST', body: JSON.stringify({ name, ...profile }) })
  try { window.localStorage.setItem(TOKEN_KEY, result.token) } catch { /* private mode */ }
  return result.token
}

export async function checkCompanyName(name: string) {
  const result = await request<{ available: boolean; name: string }>(`/api/companies/name-availability?name=${encodeURIComponent(name.trim())}`)
  return result
}

export async function createRemoteCompany(input: { founder: string; company: string; industry: string; strategy: string; ambition: string; startingCash: number; firstName?: string; lastName?: string; nickname?: string; avatar?: string; accountEmail?: string; password?: string; problem?: string; solution?: string }) {
  await ensureApiSession(input.founder, input)
  const initialName = input.company === 'New Venture' ? `New Venture · ${input.founder}` : input.company
  return request<{ id: string }>('/api/companies', { method: 'POST', body: JSON.stringify({ name: initialName, sector: input.industry, businessModel: input.strategy, problem: input.problem ?? 'A customer problem worth solving', solution: input.solution ?? 'A first useful product or service', ambition: input.ambition, initialCapitalKobo: Math.round(input.startingCash * 100) }) })
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
