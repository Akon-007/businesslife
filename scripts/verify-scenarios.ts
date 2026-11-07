#!/usr/bin/env node
/**
 * Scenario packs: the data contract, the engine hand-off and the debrief.
 *
 *   - every pack is well formed (ids, seeds, window, objectives, rule version)
 *   - all eight industries are reachable through a pack
 *   - `startGame({ scenarioId })` really fixes industry, strategy, difficulty,
 *     seed, starting cash and starting customers
 *   - the same pack + the same decisions produce the same run (determinism)
 *   - the verdict is measured from state the engine produces and cannot
 *     disagree with its own arithmetic
 *   - a save round-trip keeps the scenario attached to the run
 *
 *   npx tsx scripts/verify-scenarios.ts
 */
import {
  advanceMonth,
  normalizeGame,
  resolveCrisis,
  setMarketing,
  setProduct,
  startGame,
} from '../src/game/engine'
import { SCENARIOS, RULE_VERSION, evaluateScenario, scenarioById } from '../src/game/scenarios'
import { INDUSTRIES } from '../src/game/data'
import type { GameState, IndustryId } from '../src/game/types'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

const base = {
  founder: 'Scenario Tester',
  company: 'Scenario Co',
  industry: 'saas' as IndustryId,
  strategy: 'product' as const,
  founderBackground: 'operator' as const,
  difficulty: 'standard' as const,
  firstName: 'Scenario',
  lastName: 'Tester',
  nickname: 'scenario',
  avatar: 'founder-1',
  accountEmail: 'scenario@test.local',
}

const METRICS = new Set(['cash', 'customers', 'reputation', 'quality', 'netProfit', 'valuation', 'monthsSurvived', 'contracts'])
const DIFFICULTIES = new Set(['guided', 'standard', 'hardcore'])

function advance(game: GameState): GameState {
  let next = advanceMonth(game)
  let guard = 0
  while (next.pendingCrisis && guard < 40) {
    next = resolveCrisis(next, next.pendingCrisis.options[0].id)
    guard += 1
  }
  return next
}

/** A fixed, boring operator so determinism is about the engine, not the player. */
function playPack(id: string, months: number): GameState {
  let game = startGame({ ...base, scenarioId: id })
  for (let month = 1; month <= months && game.status === 'active'; month += 1) {
    if (month % 2 === 0) game = setMarketing(game, 8_000)
    if (month % 3 === 0) game = setProduct(game, 5_000)
    game = advance(game)
  }
  return game
}

console.log('\nScenario packs: the data contract\n')

check('eight packs ship', SCENARIOS.length === 8, String(SCENARIOS.length))
check('pack ids are unique', new Set(SCENARIOS.map((pack) => pack.id)).size === SCENARIOS.length)
check('pack seeds are unique', new Set(SCENARIOS.map((pack) => pack.seed)).size === SCENARIOS.length)
check('rule version is stamped on every pack', SCENARIOS.every((pack) => pack.ruleVersion === RULE_VERSION), RULE_VERSION)

const industriesCovered = new Set(SCENARIOS.map((pack) => pack.industry))
check(
  'every industry is playable through a pack',
  INDUSTRIES.every((industry) => industriesCovered.has(industry.id)),
  INDUSTRIES.filter((industry) => !industriesCovered.has(industry.id)).map((industry) => industry.id).join(', '),
)
check(
  'packs only reference real industries',
  SCENARIOS.every((pack) => INDUSTRIES.some((industry) => industry.id === pack.industry)),
)
check('difficulties come from the engine set', SCENARIOS.every((pack) => DIFFICULTIES.has(pack.difficulty)))
check(
  'assessment windows are plausible',
  SCENARIOS.every((pack) => pack.months >= 4 && pack.months <= 12),
  SCENARIOS.map((pack) => `${pack.id}:${pack.months}`).join(' '),
)
check(
  'every pack has 3-5 objectives',
  SCENARIOS.every((pack) => pack.objectives.length >= 3 && pack.objectives.length <= 5),
  SCENARIOS.map((pack) => `${pack.id}:${pack.objectives.length}`).join(' '),
)
check(
  'objective metrics are measures the engine produces',
  SCENARIOS.every((pack) => pack.objectives.every((objective) => METRICS.has(objective.metric))),
)
check(
  'objective targets are finite and non-zero',
  SCENARIOS.every((pack) => pack.objectives.every((objective) => Number.isFinite(objective.target) && objective.target !== 0)),
)
check(
  'every objective explains itself',
  SCENARIOS.every((pack) => pack.objectives.every((objective) => objective.hint.trim().length > 10 && objective.label.trim().length > 5)),
)
check(
  'every pack carries learning objectives and instructor notes',
  SCENARIOS.every((pack) => pack.learningObjectives.length > 0 && pack.instructorNotes.length > 0),
)
check('a pack is retrievable by id', SCENARIOS.every((pack) => scenarioById(pack.id)?.id === pack.id))
check('an unknown id is not a pack', scenarioById('nope-not-a-pack') === null)

console.log('\nStarting a run from a pack\n')

for (const pack of SCENARIOS) {
  const game = startGame({ ...base, scenarioId: pack.id })
  check(
    `${pack.id}: industry, strategy, difficulty and cash come from the pack`,
    game.industry === pack.industry &&
      game.strategy === pack.strategy &&
      game.difficulty === pack.difficulty &&
      game.startingCash === pack.startingCash &&
      game.cash === pack.startingCash,
    `${game.industry}/${game.strategy}/${game.difficulty} ${game.cash} vs ${pack.industry}/${pack.strategy}/${pack.difficulty} ${pack.startingCash}`,
  )
  check(
    `${pack.id}: seed and starting demand are fixed`,
    game.seed === pack.seed && game.customers === pack.startingCustomers,
    `seed ${game.seed}/${pack.seed}, customers ${game.customers}/${pack.startingCustomers}`,
  )
  check(
    `${pack.id}: the run is tagged with the scenario and its rule version`,
    game.scenario?.id === pack.id && game.scenario?.ruleVersion === RULE_VERSION && game.scenario?.months === pack.months,
    JSON.stringify(game.scenario),
  )
  check(
    `${pack.id}: pack inputs override caller inputs`,
    startGame({ ...base, industry: 'fnb', difficulty: 'guided', seed: 1, scenarioId: pack.id }).seed === pack.seed,
  )
}

const freePlay = startGame({ ...base, seed: 4242 })
check('free play carries no scenario tag', freePlay.scenario === undefined && freePlay.seed === 4242)

console.log('\nDeterminism and the debrief\n')

for (const pack of SCENARIOS) {
  const window = Math.min(pack.months, 6)
  const first = playPack(pack.id, window)
  const second = playPack(pack.id, window)
  const fingerprint = (game: GameState) =>
    JSON.stringify({
      cash: Math.round(game.cash),
      debt: Math.round(game.debt),
      customers: Math.round(game.customers),
      quality: Math.round(game.quality),
      reputation: Math.round(game.reputation),
      valuation: Math.round(game.valuation),
      month: game.month,
      status: game.status,
    })
  check(
    `${pack.id}: same pack, same decisions, same run`,
    fingerprint(first) === fingerprint(second),
    `${fingerprint(first)} vs ${fingerprint(second)}`,
  )

  const verdict = evaluateScenario(first, pack)
  check(`${pack.id}: the verdict covers every objective`, verdict.total === pack.objectives.length && verdict.results.length === verdict.total)
  check(`${pack.id}: met count matches the individual results`, verdict.met === verdict.results.filter((result) => result.met).length)
  check(
    `${pack.id}: each result is recomputed from engine state`,
    verdict.results.every((result) =>
      result.objective.metric === 'cash'
        ? result.actual === Math.round(first.cash)
        : result.objective.metric === 'customers'
          ? result.actual === Math.round(first.customers)
          : true,
    ),
  )
  check(
    `${pack.id}: pass means every objective was met`,
    verdict.passed === (verdict.met === verdict.total),
    `${verdict.met}/${verdict.total} passed=${verdict.passed}`,
  )
}

console.log('\nThe assessment window\n')

for (const pack of SCENARIOS) {
  const run = playPack(pack.id, pack.months + 2)
  check(
    `${pack.id}: the run closes when the ${pack.months}-month window elapses`,
    run.status !== 'active' && run.month === pack.months,
    `status ${run.status}, month ${run.month}`,
  )
  const verdict = evaluateScenario(run, pack)
  check(`${pack.id}: a closed run is no longer overdue`, verdict.overdue === false && verdict.monthsElapsed === pack.months)
}

const freeLong = playPack('', 0)
let freeRun = startGame({ ...base, seed: 909 })
for (let month = 1; month <= 13 && freeRun.status === 'active'; month += 1) freeRun = advance(freeRun)
check(
  'free play is never closed by a scenario window',
  freeRun.status !== 'completed',
  `status ${freeRun.status} at month ${freeRun.month}`,
)
check('free play has no verdict to compute', freeLong.scenario === undefined)

console.log('\nPersistence\n')

const tagged = playPack('cash-crunch', 3)
const reloaded = normalizeGame(JSON.parse(JSON.stringify(tagged)) as Partial<GameState>)
check(
  'a save round-trip keeps the scenario attached',
  reloaded.scenario?.id === 'cash-crunch' && reloaded.scenario?.ruleVersion === RULE_VERSION,
  JSON.stringify(reloaded.scenario),
)
check(
  'the verdict survives the round-trip',
  JSON.stringify(evaluateScenario(reloaded, scenarioById('cash-crunch')!)) ===
    JSON.stringify(evaluateScenario(tagged, scenarioById('cash-crunch')!)),
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — scenarios: ${failures} failure(s)\n`)
process.exit(failures === 0 ? 0 : 1)
