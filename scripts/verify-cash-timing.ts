#!/usr/bin/env node
/**
 * Cash timing: invoices must move cash when they fall due, not when the sale
 * was booked. Covers the three things a finance reviewer asks about:
 *   1. a 30-day invoice is still open at the close of its issuing month,
 *   2. it lands in cash the following month,
 *   3. late payers recover ~80% one month later and the rest is a bad debt.
 *
 *   npx tsx scripts/verify-cash-timing.ts
 */
import { CREDIT_TERMS, advanceMonth, dueMonthFor, openReceivables, settleInvoices, startGame, type GameState } from '../src/game/engine'
import type { Invoice } from '../src/game/types'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

function newRun(seed: number, industry: 'saas' | 'logistics' | 'retail' | 'fnb' = 'saas'): GameState {
  return startGame({
    founder: 'Cash Tester',
    company: 'Timing Co',
    industry,
    strategy: 'product',
    founderBackground: 'operator',
    difficulty: 'standard',
    firstName: 'Cash',
    lastName: 'Tester',
    nickname: 'cash',
    avatar: 'founder-1',
    accountEmail: 'cash@test.local',
    seed,
  })
}

const invoiceById = (game: GameState, id: string) => (game.invoices ?? []).find((invoice) => invoice.id === id)

console.log('\nInvoice cash timing\n')

const terms = CREDIT_TERMS.saas
check('saas sells on 30-day terms', terms.terms === 30 && terms.share > 0, JSON.stringify(terms))
check('30-day invoice falls due the following month', dueMonthFor(3, 30) === 4)
check('15-day invoice falls due inside its own month', dueMonthFor(3, 15) === 3)
check('45-day invoice falls due two months later', dueMonthFor(3, 45) === 5)

let game = newRun(4242, 'saas')
const month1 = advanceMonth(game)
const issued = month1.invoices.find((invoice) => invoice.issuedMonth === 1)
check('closing a month issues an invoice for credit sales', Boolean(issued) && (issued?.amount ?? 0) > 0, String(issued?.amount))
check('the newly issued invoice is still open', issued?.status === 'open', issued?.status)
check('its due month is next month', issued?.dueMonth === 2, String(issued?.dueMonth))

// The invoice must not have been double counted: receivables equal the open total.
check('receivables equal the open invoice total', month1.receivables === openReceivables(month1.invoices ?? []), `${month1.receivables} vs ${openReceivables(month1.invoices ?? [])}`)
check('the month report exposes the accrual gap', (month1.lastReport?.invoiced ?? 0) > 0 && (month1.lastReport?.receivables ?? 0) === month1.receivables)
check(
  'cash collected in the issuing month excludes 30-day invoices',
  (month1.lastReport?.collected ?? 0) < (month1.lastReport?.revenue ?? 0),
  `${month1.lastReport?.collected} vs ${month1.lastReport?.revenue}`,
)

// Month two closes and the invoice falls due.
const month2 = advanceMonth(month1)
const settled = invoiceById(month2, issued?.id ?? '')
if (settled?.status === 'paid' && settled.paidMonth === 2) {
  check('the invoice is collected when it falls due', settled.collected === settled.amount, `${settled.collected} of ${settled.amount}`)
} else {
  check('an unpaid invoice rolls into overdue rather than vanishing', settled?.status === 'overdue', settled?.status)
  const month3 = advanceMonth(month2)
  const recovered = invoiceById(month3, issued?.id ?? '')
  check('late payer is collected at ~80% the following month', recovered?.status === 'paid' && recovered.collected === Math.round((issued?.amount ?? 0) * 0.8), `${recovered?.collected} of ${issued?.amount}`)
}

check('receivables stay in step with the ledger every month', month2.receivables === openReceivables(month2.invoices ?? []))

// Direct check of the settlement engine: a defaulting cohort recovers 80%.
const base: Invoice = { id: 'inv-x', issuedMonth: 0, dueMonth: 1, amount: 100_000, terms: 30, customer: 'Test Co', status: 'open', paidMonth: null, collected: 0 }
const defaults = settleInvoices([base], 1, () => 0, 0.5)
check('a defaulting invoice is marked overdue, not paid', defaults.invoices[0]?.status === 'overdue', defaults.invoices[0]?.status)
check('no cash arrives on the default date', defaults.collected === 0, String(defaults.collected))
const recovery = settleInvoices(defaults.invoices, 2, () => 0.99, 0.5)
check('recovery the next month banks 80%', recovery.collected === 80_000, String(recovery.collected))
check('the shortfall is written off as bad debt', recovery.writtenOff === 20_000, String(recovery.writtenOff))
const onTime = settleInvoices([base], 1, () => 0.99, 0.05)
check('on-time payers settle in full', onTime.collected === 100_000 && onTime.writtenOff === 0, String(onTime.collected))
const notDue = settleInvoices([{ ...base, dueMonth: 3 }], 2, () => 0.99, 0.05)
check('invoices are not collected before the due month', notDue.collected === 0 && notDue.invoices[0]?.status === 'open')

// Consumer industries collect at the till.
let shop = newRun(77, 'retail')
for (let index = 0; index < 3; index += 1) shop = advanceMonth(shop)
const shopCredit = CREDIT_TERMS.retail
check('retail invoices a small share of revenue', shopCredit.share < 0.25, String(shopCredit.share))
check('retail receivables stay small', (shop.receivables ?? 0) < (shop.lastReport?.revenue ?? 1), `${shop.receivables} vs ${shop.lastReport?.revenue}`)

console.log(failures ? `\n${failures} failure(s)` : '\nAll cash-timing checks passed')
process.exit(failures ? 1 : 0)
