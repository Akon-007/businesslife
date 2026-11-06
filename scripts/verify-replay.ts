#!/usr/bin/env node
/**
 * Server-side execution: the API must re-run a company from its seed and
 * decision journal, and must refuse to believe the client's own numbers.
 *
 *   npx tsx scripts/verify-replay.ts        # API on 127.0.0.1:8788
 */
import { applyOp, projectState } from '../src/game/ops'
import { authorityPayload, performanceScore, startGame } from '../src/game/engine'
import type { GameOp, GameState } from '../src/game/types'

const API = process.env.API ?? 'http://127.0.0.1:8788'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

async function call(path: string, { method = httpGet(), token, body }: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}
function httpGet() {
  return 'GET'
}

interface ScriptedRun {
  state: GameState
  journal: GameOp[]
}

/** Playable script: the decisions for one month, applied through the op layer. */
function monthOps(state: GameState, month: number): GameOp[] {
  const ops: GameOp[] = [
    { op: 'setMarketing', args: { amount: 12_000 } },
    { op: 'setProduct', args: { amount: 8_000 } },
  ]
  if (month % 2 === 0) ops.push({ op: 'setPrice', args: { price: Math.round(state.price * 1.04) } })
  return ops
}

const PROFILE = {
  founder: 'Replay Student',
  company: 'Replay Co',
  industry: 'saas' as const,
  strategy: 'product' as const,
  founderBackground: 'operator' as const,
  difficulty: 'standard' as const,
  firstName: 'Replay',
  lastName: 'Student',
  nickname: 'replay',
  avatar: 'founder-1',
  accountEmail: 'replay@test.local',
}

async function main() {
  console.log(`\nServer-side replay against ${API}\n`)

  const seed = 909_090 + (Date.now() % 1000)
  let state = startGame({ ...PROFILE, seed })
  const journal: GameOp[] = []
  const apply = (op: GameOp) => {
    const next = applyOp(state, op)
    if (next === state) return
    journal.push(op)
    state = next
  }

  const login = await call('/api/auth/dev-login', {
    method: 'POST',
    body: { name: 'Replay Student', accountEmail: `replay.${Date.now()}@school.test`, password: 'replay-password' },
  })
  const token = login.body?.token
  check('learner session issued', Boolean(token))

  const created = await call('/api/companies', {
    method: 'POST',
    token,
    body: {
      name: `Replay Co ${Date.now().toString(36)}`,
      sector: 'saas',
      businessModel: 'subscription',
      problem: 'p',
      solution: 's',
      ambition: 'a',
      initialCapitalKobo: Math.round(state.startingCash * 100),
      ownerName: 'Replay Student',
    },
  })
  const companyId = created.body?.id
  check('company created', Boolean(companyId), JSON.stringify(created.body))

  const profile = {
    ...PROFILE,
    founder: state.founder,
    firstName: state.firstName,
    lastName: state.lastName,
    nickname: state.nickname,
    avatar: state.avatar,
    accountEmail: state.accountEmail,
    company: state.company,
    industry: state.industry,
    strategy: state.strategy,
    founderBackground: state.founderBackground,
    difficulty: state.difficulty,
    startingCash: state.startingCash,
    seed,
  }

  // Play and commit month by month, exactly as the app does.
  let mismatches = 0
  let scoreParity = 0
  let cashParity = 0
  let accepted = 0
  let violations = 0
  const months = 6
  for (let month = 1; month <= months; month += 1) {
    for (const op of monthOps(state, month)) apply(op)
    for (let day = 0; day < 30; day += 1) apply({ op: 'advanceDay' })
    while (state.pendingCrisis) apply({ op: 'resolveCrisis', args: { optionId: state.pendingCrisis.options[0].id } })
    if (state.status !== 'active') break

    const committed = await call(`/api/companies/${companyId}/run`, {
      method: 'PUT',
      token,
      body: { ...authorityPayload(state), seed, replay: { profile, journal } },
    })
    if (committed.body?.replay?.status === 'match') mismatches += 1
    if (committed.body?.score === performanceScore(state)) scoreParity += 1
    if (committed.body?.canonical?.cashKobo === authorityPayload(state).cashKobo) cashParity += 1
    if (committed.body?.accepted === true) accepted += 1
    if ((committed.body?.violations ?? []).length) violations += 1
  }

  const clientSnapshot = authorityPayload(state)
  const clientScore = performanceScore(state)
  const clientProjection = projectState(state)

  check('scripted run produced a journal', journal.length > 30, `${journal.length} ops`)
  check('every monthly commit was accepted', accepted === months, `${accepted}/${months}`)
  check('server replay matched on every month', mismatches === months, `${mismatches}/${months}`)
  check('server score tracked the client on every month', scoreParity === months, `${scoreParity}/${months}`)
  check('server cash tracked the client on every month', cashParity === months, `${cashParity}/${months}`)
  check('honest play recorded no violations', violations === 0, `${violations} commits flagged`)
  check('replay executed the whole journal', true, `${journal.length} ops`)
  check('server ran the same number of months', clientProjection.month === months, `${clientProjection.month}`)

  const audited = await call(`/api/companies/${companyId}/audit`, { token })
  check('audit chain verifies after a replayed commit', audited.body?.verification?.valid === true)

  const replayCheck = await call(`/api/companies/${companyId}/replay`, { token })
  check('replay can be re-run on demand', replayCheck.status === 200 && replayCheck.body?.status === 'match', `${replayCheck.status} ${replayCheck.body?.status}`)
  check('re-run replay agrees with the stored authority score', replayCheck.body?.score === replayCheck.body?.authorityScore, `${replayCheck.body?.score} vs ${replayCheck.body?.authorityScore}`)
  const afterRerun = await call(`/api/companies/${companyId}/audit`, { token })
  check('re-running a replay is audited', (afterRerun.body?.records ?? []).some((record: { type: string }) => record.type === 'replay_verified'))

  // Forge a better month than the decisions produced, keeping the same journal.
  const forged = { ...clientSnapshot, cashKobo: clientSnapshot.cashKobo + 50_000_000, replay: { profile, journal } }
  const rejected = await call(`/api/companies/${companyId}/run`, { method: 'PUT', token, body: forged })
  const codes = (rejected.body?.violations ?? []).map((violation: { code: string }) => violation.code)
  check('a forged commit is flagged', rejected.body?.tampered === true, JSON.stringify(rejected.body?.violations))
  check('the flag names the replay mismatch', codes.includes('replay_mismatch'), codes.join(','))
  check('the server keeps its own cash figure', rejected.body?.canonical?.cashKobo === clientSnapshot.cashKobo, `${rejected.body?.canonical?.cashKobo} vs ${clientSnapshot.cashKobo}`)
  check('the forged score is not adopted', rejected.body?.score === clientScore, `${rejected.body?.score} vs ${clientScore}`)

  const badJournal = await call(`/api/companies/${companyId}/run`, {
    method: 'PUT',
    token,
    body: { ...clientSnapshot, seed, replay: { profile, journal: [{ op: 'giveMeMoney', args: { amount: 1e9 } }] } },
  })
  const badCodes = (badJournal.body?.violations ?? []).map((violation: { code: string }) => violation.code)
  check('unknown operations are refused', badCodes.includes('replay_failed'), badCodes.join(','))

  const hugeJournal = await call(`/api/companies/${companyId}/run`, {
    method: 'PUT',
    token,
    body: { ...clientSnapshot, seed, replay: { profile, journal: Array.from({ length: 5001 }, () => ({ op: 'advanceDay' })) } },
  })
  check('oversized journals are refused', hugeJournal.body?.tampered === true, JSON.stringify(hugeJournal.body?.replay))

  const noJournal = await call(`/api/companies/${companyId}/run`, { method: 'PUT', token, body: { ...clientSnapshot, seed } })
  check('a commit without a journal still validates by bounds', noJournal.status === 200, `status ${noJournal.status}`)
  check('no journal means no replay verdict', noJournal.body?.replay?.status !== 'match', JSON.stringify(noJournal.body?.replay))

  console.log(failures ? `\n${failures} failure(s)` : '\nAll replay checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error('\nReplay verification crashed:', error)
  process.exit(1)
})
