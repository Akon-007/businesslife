#!/usr/bin/env node
/**
 * Accounting integrity: the three statements must be internally consistent and
 * must tie back to the cash the engine reports.
 *   - P&L: gross profit and net profit recompute from their own lines
 *   - Balance sheet: assets = liabilities + equity, every month
 *   - Cash flow: opening + operating + investing + financing = closing
 *   - Payables: supplier bills move cash when they fall due, not when incurred
 *
 *   npx tsx scripts/verify-statements.ts
 */
import {
  advanceMonth,
  hireCandidate,
  openBranch,
  repayDebt,
  resolveCrisis,
  setMarketing,
  setProduct,
  startGame,
  takeLoan,
} from '../src/game/engine'
import { BILL_SHARE, openPayables, settleBills } from '../src/game/accounting'
import type { GameState } from '../src/game/types'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

const base = {
  founder: 'Ledger Tester',
  company: 'Ledger Co',
  strategy: 'product' as const,
  founderBackground: 'operator' as const,
  difficulty: 'standard' as const,
  firstName: 'Ledger',
  lastName: 'Tester',
  nickname: 'ledger',
  avatar: 'founder-1',
  accountEmail: 'ledger@test.local',
}

function play(industry: 'saas' | 'retail' | 'logistics' | 'fnb', seed: number, months: number) {
  let game: GameState = startGame({ ...base, industry, seed })
  const snapshots = []
  for (let month = 1; month <= months; month += 1) {
    if (month % 2 === 0) game = setMarketing(game, 10_000)
    if (month % 3 === 0) game = setProduct(game, 6_000)
    game = advance(game)
    if (game.status !== 'active') break
    snapshots.push(game)
  }
  return { game, snapshots }
}

function advance(game: GameState): GameState {
  let next = advanceMonth(game)
  while (next.pendingCrisis) next = resolveCrisis(next, next.pendingCrisis.options[0].id)
  return next
}

console.log('\nStatements: internal consistency\n')

for (const industry of ['saas', 'retail', 'logistics', 'fnb'] as const) {
  const { game } = play(industry, 1234, 12)
  const statements = game.statements ?? []
  check(`${industry}: statements were produced`, statements.length >= 6, `${statements.length} months`)

  let worstImbalance = 0
  let worstCashGap = 0
  let worstProfitGap = 0
  for (const statement of statements) {
    const { income, balance, cashFlow } = statement
    worstImbalance = Math.max(worstImbalance, Math.abs(balance.totalAssets - balance.liabilitiesAndEquity))
    worstCashGap = Math.max(
      worstCashGap,
      Math.abs(cashFlow.openingCash + cashFlow.operating + cashFlow.investing + cashFlow.financing - cashFlow.closingCash),
    )
    const gross = income.revenue - income.cogs
    const net =
      gross - income.payroll - income.overhead - income.depreciation - income.spoilage - income.badDebt - income.lateFees -
      income.otherExpenses + income.otherIncome - income.interest
    worstProfitGap = Math.max(worstProfitGap, Math.abs(income.grossProfit - gross), Math.abs(income.netProfit - net))
  }

  check(`${industry}: balance sheet balances every month`, worstImbalance <= 2, `worst ${worstImbalance}`)
  check(`${industry}: cash flow ties to closing cash`, worstCashGap <= 2, `worst ${worstCashGap}`)
  check(`${industry}: P&L lines recompute`, worstProfitGap <= 2, `worst ${worstProfitGap}`)

  const last = statements[statements.length - 1]
  check(`${industry}: cash on the balance sheet is the engine's cash`, Math.abs((last?.balance.cash ?? 0) - Math.round(game.cash)) <= 2, `${last?.balance.cash} vs ${game.cash}`)
  check(`${industry}: retained earnings accumulate`, Math.abs((last?.balance.retainedEarnings ?? 0) - Math.round(game.retainedEarnings)) <= 2, `${last?.balance.retainedEarnings} vs ${game.retainedEarnings}`)
}

console.log('\nPayables: bills move cash when they fall due\n')

const billRun = startGame({ ...base, industry: 'retail', seed: 555 })
const monthOne = advance(billRun)
const bill = (monthOne.bills ?? []).find((item) => item.issuedMonth === 1)
check('closing a month issues a supplier bill', Boolean(bill) && (bill?.amount ?? 0) > 0, String(bill?.amount))
check('the bill is still open at the close', bill?.status === 'open', bill?.status)
check('payables equal the open bills', monthOne.payables === openPayables(monthOne.bills ?? []), `${monthOne.payables}`)
check('bills are only a share of stock purchases', BILL_SHARE > 0 && BILL_SHARE < 1, String(BILL_SHARE))
check('the month report exposes the payable', (monthOne.lastReport?.billed ?? 0) > 0 && (monthOne.lastReport?.payables ?? 0) === monthOne.payables)

const monthTwo = advance(monthOne)
const settled = (monthTwo.bills ?? []).find((item) => item.id === bill?.id)
check('the bill is paid at the next close', settled?.status === 'paid' && settled?.paidMonth === 2, `${settled?.status} ${settled?.paidMonth}`)
check('the cash-flow statement shows the payment', (monthTwo.statements.at(-1)?.cashFlow.billsPaid ?? 0) >= (bill?.amount ?? 0), `${monthTwo.statements.at(-1)?.cashFlow.billsPaid}`)
check('payables stay equal to the open bills', monthTwo.payables === openPayables(monthTwo.bills ?? []), `${monthTwo.payables}`)

// A supplier who cannot be paid rolls over with a 2% fee, expensed not paid.
const billFixture = [{ id: 'b1', issuedMonth: 0, dueMonth: 1, amount: 100_000, vendor: 'Test', status: 'open' as const, paidMonth: null, paid: 0, lateFee: 0 }]
const broke = settleBills(billFixture, 1, 10_000)
check('an unaffordable bill is rolled over, not paid', broke.paid === 0 && broke.bills[0]?.status === 'overdue', `${broke.paid} ${broke.bills[0]?.status}`)
check('the late fee is 2% of the bill', broke.lateFees === 2_000, String(broke.lateFees))
const recovered = settleBills(broke.bills, 2, 500_000)
check('a rolled-over bill is paid with its fee', recovered.paid === 102_000, String(recovered.paid))

console.log('\nFinancing and investing appear where they belong\n')

let financed = startGame({ ...base, industry: 'saas', seed: 8080 })
financed = advance(financed)
const debtBefore = financed.debt
financed = takeLoan(financed, 50_000)
const borrowed = financed.debt - debtBefore
financed = advance(financed)
const loanStatement = financed.statements.at(-1)!
check('a loan shows up as financing', borrowed > 0 && loanStatement.cashFlow.financing === Math.round(borrowed), `${loanStatement.cashFlow.financing} vs ${borrowed}`)
check('debt appears on the balance sheet', Math.abs(loanStatement.balance.debt - Math.round(financed.debt)) <= 2, `${loanStatement.balance.debt} vs ${financed.debt}`)
check('the loan statement still balances', Math.abs(loanStatement.balance.imbalance) <= 2, String(loanStatement.balance.imbalance))

financed = repayDebt(financed, Math.min(20_000, financed.debt, financed.cash))
financed = advance(financed)
const repayStatement = financed.statements.at(-1)!
check('a repayment reduces financing', repayStatement.cashFlow.repay >= 20_000, String(repayStatement.cashFlow.repay))

let expanded = startGame({ ...base, industry: 'retail', seed: 6060 })
for (let index = 0; index < 6; index += 1) expanded = advance(expanded)
const branch = expanded.branches
  .filter((item) => item.openedMonth === null && item.minMonth <= expanded.month)
  .sort((a, b) => a.launchCost - b.launchCost)[0]
if (branch && expanded.cash > branch.launchCost) {
  expanded = openBranch(expanded, branch.id)
  expanded = advance(expanded)
  const capexStatement = expanded.statements.at(-1)!
  check('branch capex appears as investing', capexStatement.cashFlow.capex >= branch.launchCost, String(capexStatement.cashFlow.capex))
  check('fixed assets are capitalised', capexStatement.balance.fixedAssets > 0, String(capexStatement.balance.fixedAssets))
  check('capex month still balances', Math.abs(capexStatement.balance.imbalance) <= 2, String(capexStatement.balance.imbalance))
} else {
  check('branch capex scenario available', false, 'no affordable branch at month 3')
}

let hiring = startGame({ ...base, industry: 'saas', seed: 9091 })
const candidate = hiring.candidates[0]
if (candidate && hiring.cash > candidate.salary * 4) {
  hiring = hireCandidate(hiring, candidate.id)
  hiring = advance(hiring)
  const hireStatement = hiring.statements.at(-1)!
  check('a signing bonus is an operating cost', hireStatement.income.otherExpenses >= candidate.signingBonus, String(hireStatement.income.otherExpenses))
  check('the hiring month still balances', Math.abs(hireStatement.balance.imbalance) <= 2, String(hireStatement.balance.imbalance))
} else {
  check('hiring scenario available', false, 'no affordable candidate')
}

console.log(failures ? `\n${failures} failure(s)` : '\nAll statement checks passed')
process.exit(failures ? 1 : 0)
