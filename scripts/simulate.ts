import {
  advanceMonth, getMetrics, hireCandidate, offerRound, acceptOffer, resolveCrisis,
  startGame, takeLoan, setMarketing, setProduct, performanceScore,
} from '../src/game/engine'
import type { IndustryId, StrategyId } from '../src/game/types'

function play(industry: IndustryId, strategy: StrategyId, verbose = false) {
  let g = startGame({ founder: 'Test', company: 'TestCo', industry, strategy })
  for (let m = 1; m <= 36; m++) {
    if (g.pendingCrisis) g = resolveCrisis(g, g.pendingCrisis.options[0].id)
    if (g.status !== 'active') break
    if (g.team.length < 6 && m % 3 === 1) {
      const c = g.candidates.find((x) => x.role === (m % 2 === 0 ? 'sales' : 'engineer')) ?? g.candidates[0]
      if (g.cash > c.signingBonus + c.salary * 2) g = hireCandidate(g, c.id)
    }
    if (m % 6 === 0) {
      g = offerRound(g)
      if (g.offers.length) g = acceptOffer(g, g.offers[0].id)
    }
    if (m === 4 && g.cash < 30000) g = takeLoan(g, 20000)
    g = setMarketing(g, 3000)
    g = setProduct(g, 3500)
    g = advanceMonth(g)
    if (verbose) {
      const met = getMetrics(g)
      console.log(`m${String(m).padStart(2)} cash ${Math.round(g.cash/1000)}k cust ${g.customers} mrr ${Math.round(met.mrr/1000)}k churn ${(met.churnRate*100).toFixed(1)}% rep ${Math.round(g.reputation)} q ${Math.round(g.quality)} morale ${Math.round(g.morale)} val ${Math.round(g.valuation/1000)}k team ${g.team.length} ${g.status}`)
    }
  }
  const met = getMetrics(g)
  console.log(`${industry}/${strategy}: m${g.month} ${g.status} cash ${Math.round(g.cash/1000)}k cust ${g.customers} MRR ${Math.round(met.mrr/1000)}k val ${Math.round(g.valuation/1e5)/10}M team ${g.team.length} rep ${Math.round(g.reputation)} q ${Math.round(g.quality)} equity ${g.founderEquity}% score ${performanceScore(g)}`)
}
play('saas','product', true)
play('fnb','sales')
play('retail','community')
play('logistics','product')
