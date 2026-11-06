/**
 * The accounting layer: supplier bills, payables and the three statements.
 *
 * The simulation keeps cash on an accrual-plus-settlement basis:
 *  - revenue is booked when the customer buys  (invoice → receivable → cash)
 *  - stock cost is expensed when it is used     (bill → payable → cash)
 *  - capex and financing move cash between closes and are memoed in `flows`
 * `buildStatements` turns that into a P&L, a balance sheet and a cash-flow
 * statement that tie back to the cash balance.
 */
import type { Bill, CashFlowStatement, GameState, Statements } from './types'

/** Share of stock purchases that arrive on supplier credit. */
export const BILL_SHARE = 0.45
/** Supplier terms in months (30-day terms). */
export const BILL_TERMS = 1
/** Late supplier bills cost 2% of the bill. */
export const LATE_FEE_RATE = 0.02
/** Monthly depreciation on expansion capex. */
export const DEPRECIATION_RATE = 0.02

export const VENDORS = ['Palm Foods Supply', 'Lagos Wholesale', 'Northline Parts', 'Cedar Packaging', 'Meridian Freight'] as const

export function billDueMonth(issuedMonth: number): number {
  return issuedMonth + BILL_TERMS
}

export function openPayables(bills: Bill[]): number {
  return bills.filter((bill) => bill.status !== 'paid').reduce((total, bill) => total + bill.amount, 0)
}

export interface BillSettlement {
  bills: Bill[]
  paid: number
  lateFees: number
  overdue: number
}

/**
 * Pay whatever falls due, if the cash is there. A bill that cannot be paid
 * becomes overdue, picks up a 2% fee and is settled at the next close.
 */
export function settleBills(bills: Bill[], month: number, cashAvailable: number): BillSettlement {
  const next: Bill[] = []
  let paid = 0
  let lateFees = 0
  let overdue = 0
  let cash = cashAvailable

  for (const bill of bills) {
    if (bill.status === 'paid') {
      next.push(bill)
      continue
    }
    if (bill.dueMonth > month) {
      next.push(bill)
      continue
    }
    if (cash >= bill.amount) {
      cash -= bill.amount
      paid += bill.amount
      next.push({ ...bill, status: 'paid', paidMonth: month, paid: bill.amount })
      continue
    }
    // Not enough cash: roll the bill over and charge the late fee once.
    const fee = Math.round(bill.amount * LATE_FEE_RATE)
    lateFees += fee
    overdue += 1
    next.push({ ...bill, status: 'overdue', amount: bill.amount + fee, lateFee: bill.lateFee + fee })
  }

  return { bills: next, paid, lateFees, overdue }
}

/** Inventory at cost: months of cover × this month's cost of goods sold. */
export function inventoryValueOf(cover: number, cogs: number): number {
  return Math.max(0, Math.round(cover * cogs))
}

export interface StatementInput {
  month: number
  openingCash: number
  closingCash: number
  revenue: number
  cogs: number
  payroll: number
  overhead: number
  marketing: number
  product: number
  training: number
  depreciation: number
  /** Interest and credit fees charged to the P&L. */
  interest: number
  /** Interest actually paid in cash this month (excludes fees capitalised into debt). */
  interestPaid: number
  spoilage: number
  badDebt: number
  lateFees: number
  otherExpenses: number
  otherIncome: number
  cashSales: number
  collections: number
  stockPaid: number
  billsPaid: number
  cashSpoilage: number
  state: GameState
  inventoryValue: number
  fixedAssets: number
  receivables: number
  payables: number
  paidInCapital: number
  retainedEarnings: number
  capex: number
  funding: number
  borrow: number
  repay: number
}

const round = (value: number) => Math.round(value)

export function buildStatements(input: StatementInput): Statements {
  const grossProfit = input.revenue - input.cogs
  const operatingProfit =
    grossProfit - input.payroll - input.overhead - input.depreciation - input.spoilage - input.badDebt -
    input.lateFees - input.otherExpenses + input.otherIncome
  const netProfit = operatingProfit - input.interest

  const totalAssets = input.state.cash + input.receivables + input.inventoryValue + input.fixedAssets
  const totalLiabilities = input.payables + input.state.debt
  const totalEquity = input.paidInCapital + input.retainedEarnings
  const liabilitiesAndEquity = totalLiabilities + totalEquity

  // Bad debt and late fees are accrual expenses: no cash moves with them.
  const operating =
    input.cashSales + input.collections - input.stockPaid - input.billsPaid -
    input.payroll - input.overhead - input.interestPaid - input.cashSpoilage -
    input.otherExpenses + input.otherIncome
  const investing = -input.capex
  const financing = input.funding + input.borrow - input.repay
  const netChange = operating + investing + financing

  const income = {
    revenue: round(input.revenue),
    cogs: round(input.cogs),
    grossProfit: round(grossProfit),
    payroll: round(input.payroll),
    overhead: round(input.overhead),
    marketing: round(input.marketing),
    product: round(input.product),
    training: round(input.training),
    depreciation: round(input.depreciation),
    interest: round(input.interest),
    spoilage: round(input.spoilage),
    badDebt: round(input.badDebt),
    lateFees: round(input.lateFees),
    otherExpenses: round(input.otherExpenses),
    otherIncome: round(input.otherIncome),
    operatingProfit: round(operatingProfit),
    netProfit: round(netProfit),
  }

  const balance = {
    cash: round(input.state.cash),
    receivables: round(input.receivables),
    inventory: round(input.inventoryValue),
    fixedAssets: round(input.fixedAssets),
    totalAssets: round(totalAssets),
    payables: round(input.payables),
    debt: round(input.state.debt),
    totalLiabilities: round(totalLiabilities),
    paidInCapital: round(input.paidInCapital),
    retainedEarnings: round(input.retainedEarnings),
    totalEquity: round(totalEquity),
    liabilitiesAndEquity: round(liabilitiesAndEquity),
    imbalance: round(totalAssets - liabilitiesAndEquity),
  }

  const cashFlow: CashFlowStatement = {
    openingCash: round(input.openingCash),
    cashSales: round(input.cashSales),
    collections: round(input.collections),
    stockPaid: round(input.stockPaid),
    billsPaid: round(input.billsPaid),
    payroll: round(input.payroll),
    overhead: round(input.overhead),
    interest: round(input.interestPaid),
    spoilage: round(input.cashSpoilage),
    lateFees: 0,
    otherExpenses: round(input.otherExpenses),
    otherIncome: round(input.otherIncome),
    operating: round(operating),
    capex: round(input.capex),
    investing: round(investing),
    funding: round(input.funding),
    borrow: round(input.borrow),
    repay: round(input.repay),
    financing: round(financing),
    netChange: round(netChange),
    closingCash: round(input.closingCash),
  }

  return { month: input.month, income, balance, cashFlow }
}

/** Latest statement, or a zeroed skeleton before the first month closes. */
export function latestStatements(state: GameState): Statements | null {
  return state.statements && state.statements.length ? state.statements[state.statements.length - 1] : null
}
