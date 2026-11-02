import { newId, now } from './store.js'
import type { Company, Player } from './types.js'

export function amountKobo(input: Record<string, unknown>) {
  const raw = input.amountKobo ?? input.amount
  const amount = Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.')
  return Math.round(input.amountKobo !== undefined ? amount : amount * 100)
}

export function postCompanyTransaction(company: Company, amount: number, type: Company['transactions'][number]['type'], description: string, source: string, createdBy: string, idempotencyKey?: string) {
  const existing = idempotencyKey && company.transactions.find((item) => item.idempotencyKey === idempotencyKey)
  if (existing) return existing
  const transaction = { id: newId('txn'), type, amount: amount / 100, amountKobo: amount, currency: 'NGN' as const, description, source, sourceAccount: source, destinationAccount: 'company:cash', category: type, status: 'posted' as const, createdBy, createdAt: now(), idempotencyKey }
  company.transactions.unshift(transaction)
  company.journal.push({ id: newId('jrn'), account: 'company:cash', debit: type === 'expense' ? 0 : amount, credit: type === 'expense' ? amount : 0, source, currency: 'NGN', amountKobo: amount, createdAt: now() })
  company.journal.push({ id: newId('jrn'), account: type, debit: type === 'expense' ? amount : 0, credit: type === 'expense' ? 0 : amount, source, currency: 'NGN', amountKobo: amount, createdAt: now() })
  if (type === 'expense') { company.balanceKobo -= amount; company.expensesKobo += amount }
  else { company.balanceKobo += amount; if (type === 'sale') company.revenueKobo += amount }
  company.balance = company.balanceKobo / 100
  company.revenue = company.revenueKobo / 100
  company.expenses = company.expensesKobo / 100
  return transaction
}

export function transferFromFounder(player: Player, company: Company, amount: number, createdBy: string, description: string, idempotencyKey?: string) {
  if (player.wallet < amount) throw new Error('Founder wallet cannot cover this contribution.')
  const transaction = postCompanyTransaction(company, amount, 'funding', description, `player:${player.id}:wallet`, createdBy, idempotencyKey)
  if (!idempotencyKey || transaction.idempotencyKey === idempotencyKey && player.wallet >= amount) player.wallet -= amount
  return transaction
}

export function breakEven(company: Company) {
  const recurring = company.employees.reduce((total, employee) => total + Number(employee.salaryKobo ?? Number(employee.salary ?? 0) * 100), 0)
  return { monthlyRevenueKobo: recurring + company.expensesKobo, monthlyRevenue: (recurring + company.expensesKobo) / 100, achieved: company.revenueKobo >= recurring + company.expensesKobo }
}
