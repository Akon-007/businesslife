import { advanceMonth, getMetrics, hireCandidate, offerRound, acceptOffer, resolveCrisis, startGame, takeLoan, setMarketing, setProduct, performanceScore } from '../src/game/engine'
import type { IndustryId } from '../src/game/types'

function run(label: string, industry: IndustryId, opts: { hires: boolean; raises: boolean; marketing: number; product: number }) {
  let g = startGame({ founder: 'Test', company: 'TestCo', industry, strategy: 'product' })
  for (let m = 1; m <= 36; m++) {
    if (g.pendingCrisis) {
      const takeExit = g.pendingCrisis.id === 'acquisition' ? g.pendingCrisis.options[2] : g.pendingCrisis.options[0]
      g = resolveCrisis(g, takeExit.id)
    }
    if (g.status !== 'active') break
    if (opts.hires && g.team.length < 6 && m % 3 === 1) {
      const c = g.candidates[0]
      if (g.cash > c.signingBonus + c.salary * 2) g = hireCandidate(g, c.id)
    }
    if (opts.raises && m >= 6 && m - g.lastRoundMonth >= 6) {
      g = offerRound(g)
      if (g.offers.length) g = acceptOffer(g, g.offers[0].id)
    }
    if (g.cash < 25000) g = takeLoan(g, 20000)
    g = setMarketing(g, opts.marketing)
    g = setProduct(g, opts.product)
    g = advanceMonth(g)
  }
  console.log(`${label}: m${g.month} ${g.status} cash ${Math.round(g.cash/1000)}k cust ${g.customers} MRR ${Math.round(getMetrics(g).mrr/1000)}k val ${Math.round(g.valuation/1e5)/10}M q${Math.round(g.quality)} rep${Math.round(g.reputation)} score${performanceScore(g)}`)
}
run('lean product spend', 'saas', { hires: false, raises: false, marketing: 1000, product: 3000 })
run('lean + hires', 'saas', { hires: true, raises: false, marketing: 1000, product: 3000 })
run('spend hard no raise', 'fnb', { hires: true, raises: false, marketing: 6000, product: 6000 })
run('spend hard + raise', 'fnb', { hires: true, raises: true, marketing: 6000, product: 6000 })
run('defaults', 'retail', { hires: true, raises: true, marketing: 2000, product: 3000 })
