import type { Company } from './types.js'

export function operationsOverview(company: Company) {
  const inventory = company.products.reduce((total, product) => total + Number(product.stock ?? 0), 0)
  const monthlyPayrollKobo = company.employees.reduce((total, employee) => total + Number(employee.salaryKobo ?? Number(employee.salary ?? 0) * 100), 0)
  const receivablesKobo = company.orders.filter((order) => order.paymentStatus === 'receivable').reduce((total, order) => total + Number(order.amountKobo ?? 0), 0)
  return {
    companyId: company.id,
    products: company.products,
    suppliers: company.suppliers,
    inventoryUnits: inventory,
    monthlyPayrollKobo,
    receivablesKobo,
    customers: company.orders.length,
    orders: company.orders,
    operatingStatus: company.status === 'launched' ? 'operating' : 'pre-launch',
  }
}

export function demandFor(company: Company, product: Record<string, unknown>, quantity: number) {
  const priceKobo = Number(product.priceKobo ?? 0)
  const quality = Math.max(0, Math.min(100, Number(product.quality ?? 50)))
  const marketing = company.campaigns.reduce((total, campaign) => total + Number(campaign.budgetKobo ?? 0), 0)
  const marketingBoost = Math.min(0.35, marketing / 100_000_000)
  const qualityBoost = (quality - 50) / 200
  const base = Math.max(0.1, 1 + marketingBoost + qualityBoost - Math.max(0, priceKobo - 100_000) / 10_000_000)
  return Math.max(1, Math.round(quantity * base))
}

export function consumeStock(company: Company, productId: string, units: number) {
  const product = company.products.find((item) => item.id === productId)
  if (!product) throw new Error('Product not found.')
  const stock = Number(product.stock ?? 0)
  if (stock < units) throw new Error(`Insufficient stock. Available units: ${stock}.`)
  product.stock = stock - units
  return product
}
