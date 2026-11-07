#!/usr/bin/env node
/**
 * Legitimate play must never be flagged as tampering, and the score the player
 * sees must equal the score the server stores. Runs the real client engine
 * against a live API and commits six months of honest play.
 *
 *   npx tsx scripts/verify-legit-play.ts
 */
import { authorityPayload, performanceScore, startGame } from '../src/game/engine'
import { applyOp } from '../src/game/ops'
import type { GameOp, GameState } from '../src/game/types'

/**
 * Play the way the store plays: one `advanceDay` decision per day, a
 * `resolveCrisis` decision when a crisis lands, and a journal that records both.
 * Anything less is not a run the server can replay.
 */
const decide = (state: GameState, op: GameOp): GameState => ({ ...applyOp(state, op), journal: [...(state.journal ?? []), op] })

const API = process.env.API ?? 'http://127.0.0.1:8788'

async function post(path: string, body: unknown, token?: string) {
  const response = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> }
}

async function put(path: string, body: unknown, token: string) {
  const response = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, unknown> }
}

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

async function main() {
  const stamp = Date.now().toString(36)
  const login = await post('/api/auth/dev-login', { name: 'Legit Player', password: 'pw-123456', accountEmail: `legit.${stamp}@test.local` })
  const token = String((login.body as { token?: string }).token ?? '')
  if (!token) throw new Error(`Could not authenticate against ${API}`)

  let game = startGame({
    founder: 'Legit Player',
    company: `Legit Co ${stamp}`,
    industry: 'logistics',
    strategy: 'product',
    founderBackground: 'operator',
    difficulty: 'standard',
    startingCash: 5_000_000,
    firstName: 'Legit',
    lastName: 'Player',
    nickname: 'legit',
    avatar: 'founder-1',
    accountEmail: 'legit@test.local',
    problem: 'p',
    solution: 's',
  })

  const created = await post('/api/companies', {
    name: game.company,
    sector: game.industry,
    businessModel: game.strategy,
    problem: 'p',
    solution: 's',
    ambition: 'a',
    initialCapitalKobo: 500_000_000,
  }, token)
  const companyId = String((created.body as { id?: string }).id ?? '')
  if (!companyId) throw new Error('Could not create a company')

  console.log('\nLegitimate play (client engine → server authority)\n')

  /**
   * Exactly what `store.syncRun` sends: the projection, the seed and the
   * decision journal. Without the journal the server can only score bounded
   * canonical values, which are rounded — that path is checked separately below.
   */
  const clientPayload = (game: GameState) => ({
    ...authorityPayload(game),
    seed: game.seed,
    replay: game.journalComplete === false
      ? undefined
      : {
          profile: {
            founder: game.founder,
            firstName: game.firstName,
            lastName: game.lastName,
            nickname: game.nickname,
            avatar: game.avatar,
            accountEmail: game.accountEmail,
            company: game.company,
            industry: game.industry,
            strategy: game.strategy,
            founderBackground: game.founderBackground,
            difficulty: game.difficulty,
            startingCash: game.startingCash,
            seed: game.seed,
          },
          journal: game.journal ?? [],
        },
  })

  const commit = async (label: string, expectMonth: number) => {
    const response = await put(`/api/companies/${companyId}/run`, clientPayload(game), token)
    const body = response.body as {
      tampered?: boolean
      score?: number
      canonical?: { month?: number }
      violations?: Array<{ code: string; field: string }>
    }
    const clientScore = performanceScore(game)
    const replay = (body as { replay?: { status?: string; ops?: number } }).replay
    if (expectMonth > 0) {
      check(
        `${label}: the server replayed the journal (${replay?.status ?? 'none'}, ${replay?.ops ?? 0} ops)`,
        replay?.status === 'match' && (replay?.ops ?? 0) > 0,
        JSON.stringify(replay),
      )
    }
    check(`${label}: accepted`, response.status === 200 && body.tampered === false, JSON.stringify(body.violations?.map((item) => item.code)))
    check(`${label}: score parity (client ${clientScore} vs server ${body.score})`, body.score === clientScore, String(body.score))
    check(`${label}: server month ${expectMonth}`, body.canonical?.month === expectMonth, String(body.canonical?.month))
  }

  await commit('after create', 0)
  for (let month = 1; month <= 6; month += 1) {
    // Press "next day" until the month closes (30 days, guard against a stall).
    for (let day = 0; day < 40 && game.month < month; day += 1) {
      if (game.pendingCrisis) {
        game = decide(game, { op: 'resolveCrisis', args: { optionId: game.pendingCrisis.options[0].id } })
        continue
      }
      game = decide(game, { op: 'advanceDay' })
    }
    while (game.pendingCrisis) game = decide(game, { op: 'resolveCrisis', args: { optionId: game.pendingCrisis.options[0].id } })
    await commit(`month ${month}`, month)
  }

  // The fallback path: a commit with no journal (what an older client sends, and
  // what a run with an incomplete journal falls back to). The server can only
  // score rounded canonical values here, so agreement is within one point —
  // documented rather than hidden.
  const noJournal = await put(`/api/companies/${companyId}/run`, authorityPayload(game), token)
  const drift = Math.abs(Number(noJournal.body.score ?? 0) - performanceScore(game))
  check('a commit without a journal is scored within one point', drift <= 1, `${noJournal.body.score} vs ${performanceScore(game)}`)

  const audit = await fetch(`${API}/api/companies/${companyId}/audit`, { headers: { authorization: `Bearer ${token}` } })
  const auditBody = (await audit.json()) as { verification?: { valid?: boolean; length?: number } }
  check('audit chain verifies after six honest commits', auditBody.verification?.valid === true, JSON.stringify(auditBody.verification))
  check('audit chain recorded every commit', (auditBody.verification?.length ?? 0) >= 7, String(auditBody.verification?.length))

  console.log(failures ? `\n${failures} failure(s)` : '\nAll legitimate-play checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((error) => {
  console.error('Legitimate-play verification crashed:', error)
  process.exit(1)
})
