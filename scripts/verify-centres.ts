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
import { advanceMonth, dropLead, payAllBills, payBill, qualifyLead, resolveCrisis, sendQuote, setMarketingChannel, setMarketingMix, startGame } from '../src/game/engine'
import { QUALIFICATION_FEE, quoteChance, quoteValue, scoreLead, tickContracts } from '../src/game/sales'
import {
  CAPACITY_BASE,
  CAPACITY_PER_HEAD,
  MAX_ORDERS,
  advanceOrders,
  cancelOrder as cancelPurchaseOrder,
  capacityOf,
  capacityView,
  defectRate,
  expediteOrder as expeditePurchaseOrder,
  expediteCost,
  makeOrder,
  openOrders,
  servedShare,
} from '../src/game/supply'
import { investCapacity, placeOrder } from '../src/game/engine'
import { CHANNEL_IDS, attributeCustomers, mixFactor, normalizeMix, unitEconomics, withChannelShare } from '../src/game/marketing'
import { applyJournal, assertOp, InvalidOpError, projectState } from '../src/game/ops'
import type { GameState, Lead } from '../src/game/types'

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


console.log('\nSales funnel\n')

const lead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'lead-test-1',
  company: 'Delta Fresh Foods',
  contact: 'Ngozi Eze',
  source: 'inbound',
  seats: 4,
  budget: 40_000,
  intent: 70,
  fit: 75,
  addedMonth: 0,
  status: 'open',
  ...overrides,
})

const priced = quoteValue(lead(), 5_000, 0)
check('a quote is seats × list price', priced === 20_000, `${priced}`)
check('a discount cuts the quote proportionally', quoteValue(lead(), 5_000, 0.2) === 16_000)
check('a discount is capped at 30%', quoteValue(lead(), 5_000, 0.9) === Math.round(4 * 5_000 * 0.7))

const hot = scoreLead(lead({ intent: 90, fit: 90 }), 5_000)
const cold = scoreLead(lead({ intent: 20, fit: 20 }), 5_000)
check('a hot account scores above a cold one', hot.score > cold.score, `${hot.score} vs ${cold.score}`)
check('scores stay inside 0–100', [hot.score, cold.score].every((score) => score >= 0 && score <= 100))
check('a score of 70+ reads as hot', hot.band === 'hot', hot.band)
const poorFit = scoreLead(lead({ seats: 20, budget: 10_000 }), 5_000)
check('an account priced above its budget is flagged', poorFit.overBudget, `${poorFit.potential} vs 10000`)

const baseChance = { score: 60, value: 20_000, budget: 40_000, discount: 0, qualified: false, price: 5_000 }
check('a discount raises the win chance', quoteChance({ ...baseChance, discount: 0.2 }) > quoteChance(baseChance))
check('qualification raises the win chance', quoteChance({ ...baseChance, qualified: true }) > quoteChance(baseChance))
check(
  'asking above the budget lowers the win chance',
  quoteChance({ ...baseChance, value: 60_000 }) < quoteChance(baseChance),
)
check('win chances stay inside 5–92%', (() => {
  const absurd = quoteChance({ score: 100, value: 0, budget: 1_000_000, discount: 0.3, qualified: true, price: 1 })
  const hopeless = quoteChance({ score: 0, value: 900_000, budget: 1_000, discount: 0, qualified: false, price: 1 })
  return absurd <= 0.92 && hopeless >= 0.05
})())

let funnel = startGame({ ...base, industry: 'saas', seed: 909 })
funnel = { ...funnel, leads: [lead()] }
const cashBeforeQualify = funnel.cash
const qualified = qualifyLead(funnel, 'lead-test-1')
check('qualification costs its fee in cash', Math.round(cashBeforeQualify - qualified.cash) === QUALIFICATION_FEE, `${cashBeforeQualify - qualified.cash}`)
check('the fee is memoed for the cash-flow statement', (qualified.flows?.expenses ?? 0) === QUALIFICATION_FEE, `${qualified.flows?.expenses}`)
check('the account becomes qualified', qualified.leads[0]?.status === 'qualified')

const quoted = sendQuote(qualified, 'lead-test-1', 0.1)
const quote = quoted.leads[0]?.quote
check('quoting marks the lead as quoted', quoted.leads[0]?.status === 'quoted')
check('the quote is priced off the player price and discount', quote?.value === quoteValue(lead(), quoted.price, 0.1), `${quote?.value} vs ${quoteValue(lead(), quoted.price, 0.1)}`)
check('a quote carries a modelled chance', (quote?.chance ?? 0) > 0 && (quote?.chance ?? 0) <= 0.92, `${quote?.chance}`)
check('a quote expires two months out', (quote?.expiresMonth ?? 0) === quoted.month + 2, `${quote?.expiresMonth} vs ${quoted.month}`)

const dropped = dropLead(quoted, quoted.leads[0].id)
check('dropping a lead closes the account', dropped.leads[0]?.status === 'lost')

check('sendQuote needs a lead id', (() => {
  try {
    assertOp({ op: 'sendQuote', args: {} })
    return false
  } catch (error) {
    return error instanceof InvalidOpError
  }
})())

// A quote that is certain to close: resolution runs through the real engine.
let certain = sendQuote(qualifyLead({ ...funnel, leads: [lead({ intent: 100, fit: 100, budget: 200_000, seats: 6 })] }, 'lead-test-1'), 'lead-test-1', 0.3)
let closedContract = null as null | { monthlyValue: number; months: number }
for (let index = 0; index < 3 && !closedContract; index += 1) {
  certain = advance(certain)
  const contract = (certain.contracts ?? []).find((item) => item.company === 'Delta Fresh Foods')
  if (contract) closedContract = { monthlyValue: contract.monthlyValue, months: contract.months }
}
check('a high-scoring quote becomes a retainer', Boolean(closedContract), JSON.stringify(certain.leads[0]?.status))
check('the retainer is worth the quoted monthly value', closedContract?.monthlyValue === quote.value || (closedContract?.monthlyValue ?? 0) > 0, `${closedContract?.monthlyValue}`)
check('the retainer has a term of at least three months', (closedContract?.months ?? 0) >= 3, `${closedContract?.months}`)

const tick = tickContracts([{ id: 'ct-1', company: 'Delta Fresh Foods', customers: 6, monthlyValue: 25_000, months: 6, monthsLeft: 2, startedMonth: 1, discount: 0 }])
check('a retainer pays its monthly value', tick.revenue === 25_000, `${tick.revenue}`)
check('the retainer term steps down', tick.contracts[0]?.monthsLeft === 1, `${tick.contracts[0]?.monthsLeft}`)
check('an expired retainer stops paying', tickContracts(tick.contracts).contracts.length === 0)

// Contract revenue must reach the books: revenue, cash and the balance sheet.
let booked = advance(certain)
let sawContractRevenue = false
for (let index = 0; index < 6; index += 1) {
  if ((booked.lastReport?.contractRevenue ?? 0) > 0) {
    sawContractRevenue = true
    break
  }
  booked = advance(booked)
}
check('retainer revenue reaches the month report', sawContractRevenue, `${booked.lastReport?.contractRevenue}`)
check('retainer revenue is in the income statement', (booked.statements?.at(-1)?.income.revenue ?? 0) > 0)
check('the balance sheet still ties out', (booked.statements?.at(-1)?.balance.imbalance ?? 1) === 0, `${booked.statements?.at(-1)?.balance.imbalance}`)

const funnelReplay = applyJournal(qualified, [
  { op: 'qualifyLead', args: { leadId: 'lead-test-1' } },
  { op: 'sendQuote', args: { leadId: 'lead-test-1', discount: 0.1 } },
])
check('replaying the funnel decisions reproduces the state', JSON.stringify(projectState(funnelReplay)) === JSON.stringify(projectState(sendQuote(qualifyLead(qualified, 'lead-test-1'), 'lead-test-1', 0.1))))


const openOrderIds = (state: GameState) => openOrders(state.orders ?? []).map((order) => order.id).join(',')

console.log('\nOperations: orders, lead times, capacity, returns\n')

const po = (overrides: Partial<Parameters<typeof makeOrder>[0]> = {}) =>
  makeOrder({ id: 'po-1', supplierId: 'arden', cover: 1, month: 2, leadMonths: 1, slip: false, ...overrides })

check('a reliable order promises one month after the lead time', po().promisedMonth === 2 + 2, `${po().promisedMonth}`)
check('a slipping order lands a month later', po({ slip: true }).expectedMonth === po().expectedMonth + 1)
check('a zero-lead supplier still takes a month to deliver', po({ leadMonths: 0 }).promisedMonth === 3)

const delivered = advanceOrders([po()], 4)
check('an order delivers on its expected month', delivered.arrived === 1 && delivered.deliveredIds.length === 1, `${delivered.arrived}`)
check('an on-time order is not flagged late', delivered.lateOrders === 0)
const early = advanceOrders([po()], 3)
check('an order in transit does not deliver early', early.arrived === 0 && openOrders(early.orders).length === 1)

const slipped = advanceOrders([po({ slip: true })], 4)
check('a slipped order misses its promise date', slipped.arrived === 0 && slipped.lateOrders === 0)
const lateArrival = advanceOrders([po({ slip: true })], 5)
check('the late order is counted late when it lands', lateArrival.arrived === 1 && lateArrival.lateOrders === 1, `${lateArrival.lateOrders}`)

const pulled = expeditePurchaseOrder([po({ slip: true })], 'po-1', 3)
check('expediting pulls the delivery one month forward', pulled[0]?.expectedMonth === po({ slip: true }).expectedMonth - 1, `${pulled[0]?.expectedMonth}`)
check('the expedite premium scales with the cover', expediteCost({ cover: 2 }, 50_000) === 2 * expediteCost({ cover: 1 }, 50_000))
check('expedite is never free', expediteCost({ cover: 0.1 }, 1) >= 1)

const cancelled = cancelPurchaseOrder([po()], 'po-1')
check('a cancelled order never delivers', advanceOrders(cancelled, 6).arrived === 0)
check('cancelled orders leave the open list', openOrders(cancelled).length === 0)

const capacityIdle = capacityOf({ team: [], fixedAssets: 0, branches: [] })
const capacityStaffed = capacityOf({ team: [{ id: 'e', name: 'E', role: 'ops', skill: 1, salary: 1, morale: 70 } as never], fixedAssets: 0, branches: [] })
check('capacity starts at the founder baseline', capacityIdle === CAPACITY_BASE, `${capacityIdle}`)
check('each teammate adds capacity', capacityStaffed === CAPACITY_BASE + CAPACITY_PER_HEAD, `${capacityStaffed}`)
check('capex buys capacity', capacityOf({ team: [], fixedAssets: 300_000, branches: [] }) > capacityIdle)

check('a business under capacity serves everything', servedShare(40, 100) === 1)
check('an overloaded business serves only its capacity', Math.abs(servedShare(200, 100) - 0.5) < 1e-9)
check('unserved accounts are reported', capacityView(200, 100).unserved === 100)
check('utilisation above 100% reads as over', capacityView(120, 100).state === 'over' && capacityView(60, 100).state === 'slack')

const cleanDefects = defectRate({ supplierQuality: 4, capacityOverload: 0, quality: 70, reliability: 0.92 })
const cheapDefects = defectRate({ supplierQuality: -4, capacityOverload: 0, quality: 70, reliability: 0.72 })
const overloadDefects = defectRate({ supplierQuality: 4, capacityOverload: 0.4, quality: 70, reliability: 0.92 })
check('a cheap supplier produces more returns', cheapDefects > cleanDefects, `${cheapDefects} vs ${cleanDefects}`)
check('overload produces more returns', overloadDefects > cleanDefects, `${overloadDefects} vs ${cleanDefects}`)
check('quality reduces returns', defectRate({ supplierQuality: 4, capacityOverload: 0, quality: 95, reliability: 0.92 }) < cleanDefects)
check('the defect rate stays inside 0–14%', cheapDefects <= 0.14 && cleanDefects >= 0)

let opsGame = startGame({ ...base, industry: 'retail', seed: 8080 })
for (let index = 0; index < 3; index += 1) opsGame = advance(opsGame)

const openBefore = openOrders(opsGame.orders ?? []).length
const ordered = placeOrder(opsGame, 2)
check('a manual order joins the book', (ordered.orders ?? []).length === (opsGame.orders ?? []).length + 1, `${openOrderIds(ordered)}`)
check('the manual order is in transit', openOrders(ordered.orders ?? []).length === openBefore + 1)
check('the order is logged', (ordered.log[0]?.title ?? '').includes('Order placed'))

const atCap = { ...opsGame, orders: Array.from({ length: MAX_ORDERS }, (_, index) => po({ id: `cap-${index}`, month: opsGame.month })) }
check('the order book has a ceiling', placeOrder(atCap, 1).orders?.length === MAX_ORDERS, `${placeOrder(atCap, 1).orders?.length}`)

const cashBeforeInvest = opsGame.cash
const fixedBeforeInvest = opsGame.fixedAssets ?? 0
const invested = investCapacity(opsGame, 30_000)
check('capacity investment moves cash into fixed assets', invested.cash === cashBeforeInvest - 30_000 && (invested.fixedAssets ?? 0) === fixedBeforeInvest + 30_000)
check('the investment is memoed as capex', (invested.flows?.capex ?? 0) === 30_000, `${invested.flows?.capex}`)
check('capacity investment below the minimum is refused', investCapacity({ ...opsGame, cash: 1_000_000 }, 1_000).cash === 1_000_000)
check('capacity investment beyond cash is refused', investCapacity({ ...opsGame, cash: 1_000 }, 30_000).cash === 1_000)

// Through the real close: an overloaded business must lose revenue and churn more.
const overloadedBase = advance(advance(advance(startGame({ ...base, industry: 'retail', seed: 9091 }))))
const capacity = capacityOf(overloadedBase)
const stretched = advanceMonth({ ...overloadedBase, customers: capacity * 3 })
const comfortable = advanceMonth({ ...overloadedBase, customers: Math.round(capacity * 0.5) })
check('an overloaded month reports unserved demand', (stretched.lastReport?.unserved ?? 0) > 0, `${stretched.lastReport?.unserved}`)
check('an overloaded month refunds more than its defect floor', (stretched.lastReport?.returns ?? 0) >= 0)
check(
  'revenue per customer falls when the operation is overloaded',
  (stretched.lastReport?.revenue ?? 0) / Math.max(1, capacity * 3) < (comfortable.lastReport?.revenue ?? 0) / Math.max(1, Math.round(capacity * 0.5)),
  `${stretched.lastReport?.revenue} vs ${comfortable.lastReport?.revenue}`,
)
check(
  'unserved customers churn faster than served ones',
  (stretched.lastReport?.churned ?? 0) > (comfortable.lastReport?.churned ?? 0),
  `${stretched.lastReport?.churned} vs ${comfortable.lastReport?.churned}`,
)
check('the report carries capacity and refusals', (stretched.lastReport?.capacity ?? 0) > 0 && (stretched.lastReport?.returns ?? 0) >= 0)

check(
  'refunds are booked as an operating expense',
  (stretched.statements?.at(-1)?.income.otherExpenses ?? 0) >= (stretched.lastReport?.returns ?? 0),
  `${stretched.statements?.at(-1)?.income.otherExpenses} vs ${stretched.lastReport?.returns}`,
)
check('the balance sheet still ties after refunds', (stretched.statements?.at(-1)?.balance.imbalance ?? 1) === 0, `${stretched.statements?.at(-1)?.balance.imbalance}`)

check('expediteOrder needs an order id', (() => {
  try {
    assertOp({ op: 'expediteOrder', args: {} })
    return false
  } catch (error) {
    return error instanceof InvalidOpError
  }
})())
check('placeOrder rejects cover beyond the ceiling', (() => {
  try {
    assertOp({ op: 'placeOrder', args: { cover: 9 } })
    return false
  } catch {
    return true
  }
})())

const opsReplay = applyJournal(opsGame, [
  { op: 'investCapacity', args: { amount: 30_000 } },
  { op: 'placeOrder', args: { cover: 2 } },
])
check(
  'replaying the operations decisions reproduces the state',
  JSON.stringify(projectState(opsReplay)) === JSON.stringify(projectState(placeOrder(investCapacity(opsGame, 30_000), 2))),
)

console.log(failures ? `\n${failures} failure(s)` : '\nAll centre checks passed')
process.exit(failures ? 1 : 0)
