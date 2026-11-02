import type { Company } from './types.js'

export interface Forecast {
  day: number
  demandIndex: number
  projectedSalesKobo: number
  projectedExpensesKobo: number
  projectedNetKobo: number
  runwayDays: number | null
  breakEven: boolean
  risks: string[]
}

export function forecast(company: Company, days = 30): Forecast {
  const safeDays = Math.max(1, Math.min(90, Math.floor(days)))
  const payrollKobo = company.employees.reduce((total, employee) => total + Math.round(Number(employee.salaryKobo ?? Number(employee.salary ?? 0) * 100) * safeDays / 30), 0)
  const baselineSales = Math.round(company.revenueKobo * safeDays / 30)
  const projectedExpensesKobo = company.expensesKobo + payrollKobo
  const projectedSalesKobo = baselineSales
  const projectedNetKobo = projectedSalesKobo - projectedExpensesKobo
  const runwayDays = projectedNetKobo < 0 && projectedExpensesKobo > 0 ? Math.floor(company.balanceKobo / (projectedExpensesKobo / safeDays)) : null
  const risks: string[] = []
  if (company.balanceKobo <= projectedExpensesKobo) risks.push('cash may not cover projected operating expenses')
  if (company.employees.length === 0) risks.push('no employees are recorded; capacity is founder-constrained')
  if (company.orders.length === 0) risks.push('no sales evidence has been recorded')
  return { day: company.simulation.day, demandIndex: 1, projectedSalesKobo, projectedExpensesKobo, projectedNetKobo, runwayDays, breakEven: projectedSalesKobo >= projectedExpensesKobo, risks }
}

export function evaluateAction(company: Company, action: string, input: Record<string, unknown>) {
  const reasons: string[] = []
  let allowed = true
  if (action === 'hire') {
    const salaryKobo = Math.round(Number(input.salaryKobo ?? Number(input.salary ?? 0) * 100))
    if (salaryKobo <= 0) { allowed = false; reasons.push('salary must be greater than zero') }
    if (company.balanceKobo < salaryKobo * 3) reasons.push('less than three months of salary runway remains')
  } else if (action === 'spend') {
    const amountKobo = Math.round(Number(input.amountKobo ?? Number(input.amount ?? 0) * 100))
    if (amountKobo <= 0) { allowed = false; reasons.push('spend amount must be greater than zero') }
    if (amountKobo > company.balanceKobo) { allowed = false; reasons.push('company cash cannot cover this spend') }
  } else if (action === 'launch') {
    if (!company.registration) reasons.push('company registration is incomplete')
    if (!company.bankApplication) reasons.push('corporate banking is incomplete')
    if (!company.brand) reasons.push('brand profile is incomplete')
    if (reasons.length) allowed = false
  } else {
    reasons.push('no rule set is configured for this action')
  }
  return { action, allowed, reasons, evaluatedAt: new Date().toISOString() }
}
