/**
 * Entry point bundled for the server (see scripts/build-engine.mjs). The API
 * re-executes `startGame` + the decision journal with exactly the same code the
 * browser runs, so server and client can never drift.
 */
export {
  authorityPayload,
  performanceScore,
  startGame,
  advanceMonth,
  advanceDay,
} from './engine'
export {
  InvalidOpError,
  applyJournal,
  applyOp,
  assertJournal,
  assertOp,
  diffProjection,
  OP_TYPES,
  projectState,
} from './ops'
export type { GameOp, GameState } from './types'
export type { ProjectionDiff, RunProjection } from './ops'
