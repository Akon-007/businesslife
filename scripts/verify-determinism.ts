#!/usr/bin/env node
/**
 * Reproducibility: the same seed plus the same decisions must produce the same
 * company, and a different seed must produce a different one. This is the
 * precondition for scenario replay and fair cohort grading.
 *
 *   npx tsx scripts/verify-determinism.ts
 */
import {
  advanceMonth,
  hireCandidate,
  performanceScore,
  resolveCrisis,
  setMarketing,
  setPrice,
  startGame,
  type GameState,
} from '../src/game/engine'

type Projection = Array<Record<string, string | number | null>>

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

function project(game: GameState): Projection {
  return game.history.map((snapshot) => ({
    month: snapshot.month,
    cash: Math.round(snapshot.cash),
    revenue: Math.round(snapshot.revenue),
    costs: Math.round(snapshot.costs),
    customers: snapshot.customers,
    quality: round(snapshot.quality),
    reputation: round(snapshot.reputation),
    morale: round(snapshot.morale),
    valuation: Math.round(snapshot.valuation),
    score: performanceScore(game),
  }))
}

function run(seed: number, months: number): { projection: Projection; log: string[] } {
  let game = startGame({
    founder: 'Repro Tester',
    company: 'Repro Co',
    industry: 'saas',
    strategy: 'product',
    founderBackground: 'operator',
    difficulty: 'standard',
    firstName: 'Repro',
    lastName: 'Tester',
    nickname: 'repro',
    avatar: 'founder-1',
    accountEmail: 'repro@test.local',
    seed,
  })

  const log: string[] = []
  if (game.candidates[0]) log.push(`candidate:${game.candidates[0].name}:${game.candidates[0].skill}`)
  log.push(`economy:${game.economyOffset}`)
  log.push(`pipeline:${game.pipeline.map((deal) => `${deal.company}/${deal.customers}`).join('|')}`)

  for (let month = 1; month <= months; month += 1) {
    if (month % 3 === 0) game = setMarketing(game, 20_000)
    if (month % 5 === 0) game = setPrice(game, Math.round(game.price * 1.05))
    if (month === 2 && game.candidates[0] && game.cash > game.candidates[0].salary * 4) {
      game = hireCandidate(game, game.candidates[0].id)
    }
    game = advanceMonth(game)
    while (game.pendingCrisis) {
      const crisis = game.pendingCrisis
      log.push(`crisis:${month}:${crisis.id}:${crisis.options[0].id}`)
      game = resolveCrisis(game, crisis.options[0].id)
    }
    if (game.status !== 'active') break
  }

  return { projection: project(game), log }
}

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

console.log('\nDeterminism (same seed + same decisions = same run)\n')

const seedA = 20261106
const seedB = 987654321

const first = run(seedA, 24)
const second = run(seedA, 24)
const other = run(seedB, 24)

check('same seed replays identical monthly history', JSON.stringify(first.projection) === JSON.stringify(second.projection), `${first.projection.length} vs ${second.projection.length} months`)
check('same seed replays identical crisis sequence', first.log.join() === second.log.join())
check('same seed produces identical final state', JSON.stringify(first.projection.at(-1)) === JSON.stringify(second.projection.at(-1)))
check('different seed produces a different run', JSON.stringify(first.projection) !== JSON.stringify(other.projection))
check('run actually simulated months', first.projection.length >= 6, String(first.projection.length))

const crisisCount = first.log.filter((entry) => entry.startsWith('crisis:')).length
console.log(`  · ${first.projection.length} months, ${crisisCount} crises, score ${first.projection.at(-1)?.score}`)

console.log(failures ? `\n${failures} failure(s)` : '\nAll determinism checks passed')
process.exit(failures ? 1 : 0)
