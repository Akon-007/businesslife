import { writeFileSync } from 'node:fs'
import {
  acceptOffer,
  advanceMonth,
  offerRound,
  resolveCrisis,
  setMarketing,
  setPrice,
  setProduct,
  startGame,
  takeLoan,
} from '../src/game/engine'

const out = process.argv[2] ?? 'C:\\Users\\akann\\AppData\\Local\\Temp\\blshots\\base.json'
let game = startGame({ founder: 'Ada Mensah', company: 'Kite & Co.', industry: 'saas', strategy: 'product' })
for (let month = 1; month <= 26; month += 1) {
  if (game.pendingCrisis) {
    const option = game.pendingCrisis.options[0]
    game = resolveCrisis(game, option.id)
  }
  if (game.status !== 'active') break
  if (month % 6 === 0) {
    game = offerRound(game)
    if (game.offers.length) game = acceptOffer(game, game.offers[0].id)
  }
  if (game.cash < 40_000) game = takeLoan(game, 25_000)
  game = setPrice(game, 149)
  game = setMarketing(game, 5_000)
  game = setProduct(game, 6_000)
  game = advanceMonth(game)
}

writeFileSync(out, JSON.stringify(game))
console.log(`base save: month=${game.month} status=${game.status} cash=${Math.round(game.cash)} history=${game.history.length} achievements=${game.achievements.length}`)
if (game.status !== 'active' || game.month < 24) throw new Error('base save did not reach an active month 24+')
