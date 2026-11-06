#!/usr/bin/env node
/**
 * Decision-surface tests for the centres: supplier payment runs today, more as
 * they land. Every player action here has to be (a) economically correct,
 * (b) reflected in the ledger, and (c) replayable through the operation journal
 * the server re-executes.
 *
 *   npx tsx scripts/verify-centres.ts
 */
import { openPayables } from '../src/game/accounting'
import { advanceMonth, payAllBills, payBill, resolveCrisis, setMarketingChannel, setMarketingMix, startGame } from '../src/game/engine'
import { CHANNEL_IDS, attributeCustomers, mixFactor, normalizeMix, unitEconomics, withChannelShare } from '../src/game/marketing'
import { applyJournal, assertOp, InvalidOpError, projectState } from '../src/game/ops'
import type { GameState } from '../src/game/types'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

const base = {
  founder: 'Centres Tester',
  company: 'Centres Co',
  strategy: 'product' as const,
  founderBackground: 'operator' as const,
  difficulty: 'standard' as const,
  firstName: 'Centres',
  lastName: 'Tester',
  nickname: 'centres',
  avatar: 'founder-1',
  accountEmail: 'centres@test.local',
}

function advance(game: GameState): GameState {
  let next = advanceMonth(game)
  while (next.pendingCrisis) next = resolveCrisis(next, next.pendingCrisis.options[0].id)
  return next
}

console.log('\nSupplier payment runs\n')

let game = startGame({ ...base, industry: 'retail', seed: 31337 })
for (let index = 0; index < 4; index += 1) game = advance(game)

const openBills = (game.bills ?? []).filter((bill) => bill.status !== 'paid')
check('a run of months leaves supplier bills open', openBills.length > 0, `${openBills.length} open`)

const target = openBills[openBills.length - 1]
const beforeCash = game.cash
const beforePayables = game.payables
const paid = payBill(game, target.id)
const settled = (paid.bills ?? []).find((bill) => bill.id === target.id)

check('paying a bill moves cash by exactly the bill', Math.round(beforeCash - paid.cash) === target.amount, `${beforeCash - paid.cash} vs ${target.amount}`)
check('the bill is marked paid', settled?.status === 'paid' && settled?.paid === target.amount && settled?.paidMonth === game.month, `${settled?.status}`)
check('payables fall by the same amount', Math.round(beforePayables - paid.payables) === target.amount, `${beforePayables} → ${paid.payables}`)
check('payables still equal the open bills', paid.payables === openPayables(paid.bills ?? []))
check('the payment is memoed for the next close', (paid.flows?.billsPaid ?? 0) >= target.amount, `${paid.flows?.billsPaid}`)
check('no late fee is charged for paying early', (settled?.lateFee ?? 0) === (target.lateFee ?? 0))

const afterClose = advance(paid)
const statement = afterClose.statements[afterClose.statements.length - 1]!
check('the next cash-flow statement shows the payment', statement.cashFlow.billsPaid >= target.amount, `${statement.cashFlow.billsPaid}`)
check('the balance sheet still balances', Math.abs(statement.balance.imbalance) <= 2, `${statement.balance.imbalance}`)
check('cash flow still ties to closing cash', Math.abs(statement.cashFlow.openingCash + statement.cashFlow.operating + statement.cashFlow.investing + statement.cashFlow.financing - statement.cashFlow.closingCash) <= 2)

const replay = applyJournal(game, [{ op: 'payBill', args: { billId: target.id } }])
check('replaying the op reproduces the state', JSON.stringify(projectState(replay)) === JSON.stringify(projectState(paid)))

// Guards: a payment that cannot be afforded must not change anything.
const broke = { ...game, cash: 10 }
check('an unaffordable single payment is refused', payBill(broke, target.id) === broke)
check('an unaffordable payment run is refused', payAllBills(broke) === broke)

// A payment run clears whatever the cash covers, oldest due first.
const richest = { ...game, cash: 5_000_000 }
const run = payAllBills(richest)
const runBills = run.bills ?? []
check('a payment run settles every affordable bill', runBills.filter((bill) => bill.status !== 'paid').length === 0, `${runBills.filter((bill) => bill.status !== 'paid').length} left`)
check('the run books the total against cash', Math.round(richest.cash - run.cash) === (game.bills ?? []).filter((bill) => bill.status !== 'paid').reduce((sum, bill) => sum + bill.amount, 0))
check('payables are zero after the run', run.payables === 0, `${run.payables}`)

// An empty book is a no-op rather than an error.
check('paying with no bills outstanding is a no-op', payAllBills(run) === run)

console.log('\nJournal guards\n')

check('payBill validates a bill id', (() => {
  try {
    assertOp({ op: 'payBill', args: { billId: 'bill-3' } })
    return true
  } catch {
    return false
  }
})())
check('payBill rejects a missing id', (() => {
  try {
    assertOp({ op: 'payBill', args: {} })
    return false
  } catch (error) {
    return error instanceof InvalidOpError
  }
})())
check('payBill rejects an oversized id', (() => {
  try {
    assertOp({ op: 'payBill', args: { billId: 'x'.repeat(120) } })
    return false
  } catch {
    return true
  }
})())
check('payAllBills takes no arguments', (() => {
  try {
    assertOp({ op: 'payAllBills' })
    return true
  } catch {
    return false
  }
})())

console.log('\nMarketing mix\n')

const balanced = normalizeMix({ social: 1, search: 1, content: 1, events: 1 })
check('shares are normalised to 1', Math.abs(CHANNEL_IDS.reduce((sum, id) => sum + balanced[id], 0) - 1) < 0.005, JSON.stringify(balanced))
check('negative shares are clamped away', normalizeMix({ social: -5, search: 1, content: 0, events: 0 }).social === 0)
check('an empty mix falls back to the default', normalizeMix(undefined).search > 0)

const moved = withChannelShare(balanced, 'events', 0.5)
check('moving one channel keeps the total at 1', Math.abs(CHANNEL_IDS.reduce((sum, id) => sum + moved[id], 0) - 1) < 0.005, JSON.stringify(moved))
check('the moved channel holds its share', Math.abs(moved.events - 0.5) < 0.005, String(moved.events))
const allIn = withChannelShare(balanced, 'content', 1)
check('putting everything in one channel zeroes the rest', allIn.content === 1 && allIn.social === 0 && allIn.search === 0 && allIn.events === 0)

const demandGame = startGame({ ...base, industry: 'fnb', seed: 777 })
const noSpend = { ...demandGame, marketingSpend: 0 }
check('no budget means no mix effect', mixFactor(noSpend) === 1)

const fnbFit = setMarketingMix({ ...demandGame, marketingSpend: 8_000 }, { social: 1, search: 0, content: 0, events: 0 })
const fnbMiss = setMarketingMix({ ...demandGame, marketingSpend: 8_000 }, { social: 0, search: 0, content: 0, events: 1 })
check('a well-matched mix beats a mismatched one', mixFactor(fnbFit) > mixFactor(fnbMiss), `${mixFactor(fnbFit).toFixed(3)} vs ${mixFactor(fnbMiss).toFixed(3)}`)
check('the mix effect stays inside its bounds', mixFactor(fnbFit) <= 1.2 && mixFactor(fnbMiss) >= 0.85, `${mixFactor(fnbFit)} / ${mixFactor(fnbMiss)}`)

const split = attributeCustomers(100, { ...demandGame, marketingSpend: 6_000 })
check('attribution adds up to the customers won', split.reduce((sum, row) => sum + row.customers, 0) === 100, String(split.reduce((sum, row) => sum + row.customers, 0)))
check('roughly 30% is treated as word of mouth', Math.abs((split.find((row) => row.channel === 'organic')?.customers ?? 0) - 30) <= 1)
const organicOnly = attributeCustomers(40, { ...demandGame, marketingSpend: 0 })
check('without spend every customer is organic', organicOnly.find((row) => row.channel === 'organic')?.customers === 40)
const tiny = attributeCustomers(3, { ...demandGame, marketingSpend: 6_000 })
check('rounding never invents customers', tiny.reduce((sum, row) => sum + row.customers, 0) === 3, String(tiny.reduce((sum, row) => sum + row.customers, 0)))

const econ = unitEconomics({ arpu: 1_000, costPerCustomer: 600, churn: 0.05, spend: 5_000, customersWon: 10 })
check('lifetime is 1/churn', econ.lifetimeMonths === 20, String(econ.lifetimeMonths))
check('LTV is gross margin × lifetime', econ.ltv === 8_000, String(econ.ltv))
check('CAC is spend ÷ customers', econ.cac === 500, String(econ.cac))
check('the ratio is LTV ÷ CAC', econ.ratio === 16, String(econ.ratio))
check('no customers won means no CAC claim', unitEconomics({ arpu: 1_000, costPerCustomer: 600, churn: 0.05, spend: 5_000, customersWon: 0 }).cac === 0)

console.log('\nMarketing in the run\n')

let marketed = startGame({ ...base, industry: 'saas', seed: 5150 })
marketed = { ...marketed, marketingSpend: 8_000 }
marketed = setMarketingChannel(marketed, 'content', 0.6)
check('the channel share lands on the state', Math.abs(marketed.marketingMix.content - 0.6) < 0.02, String(marketed.marketingMix.content))
check('the mix still sums to 1', Math.abs(CHANNEL_IDS.reduce((sum, id) => sum + marketed.marketingMix[id], 0) - 1) < 0.01)
check('an unknown channel is refused', setMarketingChannel(marketed, 'billboard', 0.5) === marketed)

marketed = advance(marketed)
const marketingReport = marketed.lastReport!
check('the report carries attribution', (marketingReport.channels ?? []).length === 5, `${marketingReport.channels?.length}`)
check('attribution matches the customers won', (marketingReport.channels ?? []).reduce((sum, row) => sum + row.customers, 0) === marketingReport.newCustomers + marketingReport.dealsWon, `${(marketingReport.channels ?? []).reduce((sum, row) => sum + row.customers, 0)} vs ${marketingReport.newCustomers + marketingReport.dealsWon}`)
check('the report carries CAC and LTV', Number.isFinite(marketingReport.cac) && Number.isFinite(marketingReport.ltv), `${marketingReport.cac} / ${marketingReport.ltv}`)
check('channel spend never exceeds the budget', (marketingReport.channels ?? []).reduce((sum, row) => sum + row.spend, 0) <= 8_000, String((marketingReport.channels ?? []).reduce((sum, row) => sum + row.spend, 0)))
check('cumulative channel stats grow', (marketed.channelStats ?? []).some((row) => row.spend > 0), JSON.stringify(marketed.channelStats))

const mixReplay = applyJournal(marketed, [{ op: 'setMarketingChannel', args: { channelId: 'search', share: 0.5 } }])
check('replaying a mix decision reproduces the state', JSON.stringify(projectState(mixReplay)) === JSON.stringify(projectState(setMarketingChannel(marketed, 'search', 0.5))))

check('setMarketingMix validates its shares', (() => {
  try {
    assertOp({ op: 'setMarketingMix', args: { social: 0.5, search: 0.5 } })
    return true
  } catch {
    return false
  }
})())
check('setMarketingMix rejects an out-of-range share', (() => {
  try {
    assertOp({ op: 'setMarketingMix', args: { social: 1.4 } })
    return false
  } catch {
    return true
  }
})())
check('setMarketingMix rejects an empty mix', (() => {
  try {
    assertOp({ op: 'setMarketingMix', args: {} })
    return false
  } catch {
    return true
  }
})())

console.log(failures ? `\n${failures} failure(s)` : '\nAll centre checks passed')
process.exit(failures ? 1 : 0)
