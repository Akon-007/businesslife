import { newId, now } from './store.js'
import type { Company, Npc } from './types.js'

const names = ['Amina Yusuf', 'Chinedu Okafor', 'Zainab Bello', 'Tunde Adeyemi', 'Mariam Sani', 'Kelechi Nwosu', 'Bassey Etim', 'Nneka Obi', 'Ibrahim Musa', 'Adaeze Eze']
const roles = ['engineer', 'sales', 'designer', 'operator', 'marketer']
const investorNames = ['Northstar Ventures', 'Kora Capital', 'Harbour Seed Fund', 'Mosaic Angels', 'Meridian Growth']
const supplierNames = ['Unity Wholesale', 'Harbour Supply Co.', 'Mango & Sons', 'Greenline Distribution', 'Cedar Trade Partners']

function hash(value: string) {
  let result = 2166136261
  for (const char of value) result = Math.imul(result ^ char.charCodeAt(0), 16777619)
  return Math.abs(result >>> 0)
}

function score(seed: string, min: number, max: number) {
  return min + (hash(seed) % 10_000) / 10_000 * (max - min)
}

function npc(companyId: string, type: Npc['type'], name: string, profile: Record<string, unknown>): Npc {
  const timestamp = now()
  return { id: newId(`npc_${type}`), companyId, type, name, profile, createdAt: timestamp, updatedAt: timestamp }
}

export function seedCompanyNpcs(companyId: string, sector: string): Npc[] {
  const employees = names.slice(0, 5).map((name, index) => npc(companyId, 'employee', name, { role: roles[index], skill: Math.round(score(`${companyId}:${name}`, 45, 92)), reliability: Math.round(score(`${name}:reliability`, 45, 98)), salaryKobo: Math.round(score(`${name}:salary`, 350_000, 1_500_000) / 10_000) * 10_000, desiredSector: sector }))
  const customers = names.slice(5, 10).map((name, index) => npc(companyId, 'customer', name, { budgetKobo: Math.round(score(`${companyId}:${name}:budget`, 100_000, 2_000_000) / 10_000) * 10_000, priceSensitivity: Number(score(`${name}:price`, 0.2, 0.9).toFixed(2)), conveniencePreference: Number(score(`${name}:convenience`, 0.2, 0.95).toFixed(2)), repeatProbability: Number(score(`${name}:repeat`, 0.1, 0.8).toFixed(2)), sector }))
  const suppliers = supplierNames.map((name) => npc(companyId, 'supplier', name, { reliability: Number(score(`${companyId}:${name}:reliability`, 0.55, 0.98).toFixed(2)), quality: Math.round(score(`${name}:quality`, 45, 95)), leadDays: Math.round(score(`${name}:lead`, 2, 21)), costIndex: Number(score(`${name}:cost`, 0.8, 1.35).toFixed(2)), sectors: [sector] }))
  const investors = investorNames.map((name) => npc(companyId, 'investor', name, { sectors: [sector, 'technology', 'retail'], minTicketKobo: 2_000_000_000, maxTicketKobo: 30_000_000_000, stage: 'pre-seed', riskTolerance: Number(score(`${name}:risk`, 0.2, 0.9).toFixed(2)), teamWeight: Number(score(`${name}:team`, 0.2, 0.5).toFixed(2)) }))
  return [...employees, ...customers, ...suppliers, ...investors]
}

export function interviewCustomer(customer: Npc, product: { priceKobo?: number; quality?: number }) {
  const budget = Number(customer.profile.budgetKobo ?? 0)
  const price = Number(product.priceKobo ?? 0)
  const quality = Number(product.quality ?? 50)
  const affordable = price <= budget
  return {
    npcId: customer.id,
    response: affordable ? (quality >= 65 ? 'I would try this and recommend it if the experience stays consistent.' : 'The price works. I would need proof that the quality is reliable.') : 'This is outside my current budget, but I would consider a lower-priced option.',
    likelyToBuy: affordable && quality >= 45,
    attributes: customer.profile,
  }
}

export function evaluateInvestor(investor: Npc, company: Company, requestedKobo: number) {
  const teamScore = Math.min(25, company.employees.length * 8)
  const demandScore = Math.min(25, company.orders.length * 5 + (company.revenueKobo > 0 ? 10 : 0))
  const complianceScore = company.registration && company.bankApplication ? 15 : 0
  const planScore = company.businessPlan ? 15 : 0
  const riskScore = Number(investor.profile.riskTolerance ?? 0.5) * 20
  const amountOk = requestedKobo >= Number(investor.profile.minTicketKobo) && requestedKobo <= Number(investor.profile.maxTicketKobo)
  const scoreTotal = Math.round(teamScore + demandScore + complianceScore + planScore + riskScore + (amountOk ? 10 : 0))
  const decision = scoreTotal >= 65 ? 'offer' : scoreTotal >= 45 ? 'more_information' : 'rejected'
  return { investorId: investor.id, score: scoreTotal, decision, reasons: { teamScore, demandScore, complianceScore, planScore, riskScore, amountOk }, evaluatedAt: now() }
}

export function selectSupplier(supplier: Npc, company: Company) {
  const reliability = Number(supplier.profile.reliability ?? 0)
  const costIndex = Number(supplier.profile.costIndex ?? 1)
  return { supplierId: supplier.id, supplier: supplier.name, fitScore: Math.round((reliability * 70 + (1 / costIndex) * 30)), recommended: reliability >= 0.72 && costIndex <= 1.15, companyId: company.id }
}
