#!/usr/bin/env node
/**
 * Scoring parity: the score the player sees must equal the score the server
 * recomputes from the same payload. Run with:
 *   npx tsx scripts/verify-scoring.ts
 */
import { advanceMonth, authorityPayload, performanceScore, startGame } from '../src/game/engine'
import { scoreSnapshot } from '../backend/authority'
import { INDUSTRIES, STRATEGIES } from '../src/game/data'

let failures = 0

function scenario(industry: 'saas' | 'fnb' | 'retail' | 'logistics', strategy: string, months: number) {
  let game = startGame({
    founder: 'Parity Tester',
    company: `Parity ${industry}`,
    industry,
    strategy: strategy as never,
    founderBackground: 'operator',
    difficulty: 'standard',
    startingCash: 5_000_000,
    firstName: 'Parity',
    lastName: 'Tester',
    nickname: 'parity',
    avatar: 'founder-1',
    accountEmail: 'parity@test.local',
    problem: 'p',
    solution: 's',
  })
  for (let index = 0; index < months; index += 1) game = advanceMonth(game)
  const client = performanceScore(game)
  const server = scoreSnapshot(authorityPayload(game))
  const drift = Math.abs(client - server)
  const ok = drift <= 1
  if (!ok) failures += 1
  console.log(
    `${ok ? '✓' : '✗'} ${industry.padEnd(9)} ${strategy.padEnd(11)} month ${String(game.month).padStart(2)} ` +
      `cash ${Math.round(game.cash).toLocaleString().padStart(12)} customers ${String(game.customers).padStart(5)} ` +
      `client ${String(client).padStart(3)} server ${String(server).padStart(3)}`,
  )
  return { client, server }
}

console.log('\nScoring parity (client display vs server authority)\n')
const results: Array<{ client: number; server: number }> = []
for (const industry of INDUSTRIES) {
  for (const strategy of STRATEGIES) {
    for (const months of [1, 6, 12]) {
      results.push(scenario(industry.id, strategy.id, months))
    }
  }
}

const scores = results.map((item) => item.server)
const saturated = scores.filter((score) => score >= 99).length / scores.length
console.log(`\nspread: min ${Math.min(...scores)} · median ${scores.sort((a, b) => a - b)[Math.floor(scores.length / 2)]} · max ${Math.max(...scores)}`)
console.log(`saturated (>=99): ${(saturated * 100).toFixed(0)}% of runs`)

if (saturated > 0.5) {
  console.log('✗ scoring saturates on half of ordinary runs — not fit for assessment')
  failures += 1
} else {
  console.log('✓ scoring discriminates across ordinary runs')
}

console.log(failures ? `\n${failures} parity failure(s)` : '\nAll parity checks passed')
process.exit(failures ? 1 : 0)
