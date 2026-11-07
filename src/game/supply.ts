/**
 * Operations: purchase orders, lead times, capacity and returns.
 *
 * The finance engine already knew the cost of stock; it did not know *when*
 * stock arrives or whether the business can physically serve the demand it has
 * created. This module adds the three operational constraints that make those
 * questions visible:
 *
 *  - **Purchase orders** carry a lead time (the supplier's) and can slip. Stock
 *    now arrives from an order, not from an invisible formula, so ordering late
 *    is a real mistake rather than a rounding difference.
 *  - **Capacity** is the number of customer accounts the business can actually
 *    serve in a month. Demand above it is not free: the unserved share of
 *    revenue is lost, the overflow churns, and overload degrades quality.
 *  - **Returns** are the cost of a cheap supplier: a defect rate driven by
 *    supplier quality and by running the operation past capacity.
 *
 * Money: stock purchases stay in the engine's existing accrual (cost of goods
 * acquired = COGS + inventory movement), so the statements continue to tie.
 * The two cash movements this module owns — the expedite premium and refunds —
 * are memoed to `flows.expenses` and shown as operating costs.
 *
 * Every function is pure and takes its rng, so a replayed run orders, slips and
 * refunds identically.
 */
import type { GameState, PurchaseOrder } from './types'
import { clamp } from '../lib/format'

/** Pay 12% above cost to pull a delivery forward one month. */
export const EXPEDITE_PREMIUM = 0.12
/** Orders in flight at once — a small business cannot juggle more. */
export const MAX_ORDERS = 8
/** Largest single manual order, in months of cover. */
export const MAX_ORDER_COVER = 4
/** Accounts one teammate can serve per month. */
export const CAPACITY_PER_HEAD = 30
/**
 * Baseline capacity of a founder working alone. Tuned so the constraint is a
 * growth problem, not a first-month wall: the starting customer base fits, and
 * the wall arrives when demand outgrows the operation.
 */
export const CAPACITY_BASE = 220
/** Customers of capacity bought per ₦ of capex. */
export const CAPACITY_PER_NAIRA = 1 / 20_000
/** Extra churn applied to the customers you could not serve. */
export const UNSERVED_CHURN = 0.15

/** Slots per month the business can serve. */
export function capacityOf(state: Pick<GameState, 'team' | 'fixedAssets' | 'branches'>): number {
  const heads = state.team?.length ?? 0
  const capex = state.fixedAssets ?? 0
  const branches = (state.branches ?? []).filter((branch) => branch.openedMonth !== null).length
  return Math.round(CAPACITY_BASE + heads * CAPACITY_PER_HEAD + capex * CAPACITY_PER_NAIRA + branches * 40)
}

export interface CapacityView {
  capacity: number
  utilisation: number
  served: number
  unserved: number
  overload: number
  state: 'slack' | 'tight' | 'over'
}

export function capacityView(customers: number, capacity: number) {
  const utilisation = capacity > 0 ? customers / capacity : 2
  const served = Math.min(customers, capacity)
  return {
    capacity,
    utilisation,
    served,
    unserved: Math.max(0, customers - capacity),
    overload: Math.max(0, utilisation - 1),
    state: utilisation > 1 ? 'over' : utilisation > 0.85 ? 'tight' : 'slack',
  } as CapacityView
}

/** Share of demand the operation can actually serve (0–1). */
export function servedShare(customers: number, capacity: number): number {
  if (customers <= 0) return 1
  if (capacity >= customers) return 1
  return clamp(capacity / customers, 0, 1)
}

/** How much the operation is running past what it can serve. */
export function overloadOf(customers: number, capacity: number): number {
  return Math.max(0, capacity > 0 ? customers / capacity - 1 : 1)
}

export interface DefectInput {
  supplierQuality: number
  capacityOverload: number
  quality: number
  reliability: number
}

/**
 * The share of revenue that comes back as refunds. Cheap suppliers and an
 * overloaded operation both raise it; a high quality score lowers it.
 */
export function defectRate(input: DefectInput): number {
  // Supplier quality is a ±5 nudge, not a percentage: a supplier at −3 costs
  // ~5 points of refunds, a premium one at +4 costs none of that premium.
  const supplierPenalty = Math.max(0, 3 - input.supplierQuality) * 0.008
  const overloadPenalty = input.capacityOverload * 0.02
  const unreliability = Math.max(0, 0.9 - input.reliability) * 0.05
  const qualityCredit = Math.max(0, input.quality - 60) * 0.0008
  return clamp(0.012 + supplierPenalty + overloadPenalty + unreliability - qualityCredit, 0.002, 0.14)
}

/** Expected refunds on this month's trading revenue. */
export function refundEstimate(revenue: number, rate: number): number {
  return Math.max(0, Math.round(revenue * rate))
}

/** One month's slip chance when a supplier is unreliable. */
export function slipChance(reliability: number): number {
  return clamp(1 - reliability, 0, 0.35)
}

export interface OrderInput {
  id: string
  supplierId: string
  cover: number
  month: number
  leadMonths: number
  slip: boolean
  note?: string
}

/** Build an in-flight order. `expectedMonth` is the promised arrival. */
export function makeOrder(input: OrderInput): PurchaseOrder {
  const lead = Math.max(1, input.leadMonths + 1)
  return {
    id: input.id,
    supplierId: input.supplierId,
    cover: input.cover,
    status: 'in_transit',
    orderedMonth: input.month,
    promisedMonth: input.month + lead,
    expectedMonth: input.month + lead + (input.slip ? 1 : 0),
    deliveredMonth: null,
    lateMonths: 0,
    note: input.note,
  }
}

export interface OrderTick {
  orders: PurchaseOrder[]
  arrived: number
  lateOrders: number
  deliveredIds: string[]
}

/**
 * Deliver every order whose revised date has arrived. An order that lands after
 * its promise is counted as late — the player should see the slip, not just
 * discover a stockout.
 */
export function advanceOrders(orders: PurchaseOrder[], month: number): OrderTick {
  const next: PurchaseOrder[] = []
  const deliveredIds: string[] = []
  let arrived = 0
  let lateOrders = 0

  for (const order of orders) {
    if (order.status === 'cancelled') continue
    if (order.status === 'delivered') continue
    if (order.expectedMonth > month) {
      next.push(order)
      continue
    }
    arrived += order.cover
    deliveredIds.push(order.id)
    const lateMonths = Math.max(0, month - order.promisedMonth)
    if (lateMonths > 0) lateOrders += 1
    next.push({ ...order, status: 'delivered', deliveredMonth: month, lateMonths })
  }

  return { orders: next, arrived, lateOrders, deliveredIds }
}

/** Open orders still on the water. */
export function openOrders(orders: PurchaseOrder[]): PurchaseOrder[] {
  return orders.filter((order) => order.status === 'in_transit' && order.expectedMonth > 0)
}

/** Pull an order forward one month. The caller pays the premium. */
export function expediteOrder(orders: PurchaseOrder[], orderId: string, month: number): PurchaseOrder[] {
  return orders.map((order) => {
    if (order.id !== orderId || order.status !== 'in_transit') return order
    return { ...order, expectedMonth: Math.max(month + 1, order.expectedMonth - 1), note: 'Expedited' }
  })
}

export function cancelOrder(orders: PurchaseOrder[], orderId: string): PurchaseOrder[] {
  return orders.map((order) =>
    order.id === orderId && order.status === 'in_transit' ? { ...order, status: 'cancelled' as const } : order,
  )
}

/** What an expedite costs: a premium on the cover being bought. */
export function expediteCost(order: Pick<PurchaseOrder, 'cover'>, monthlyStockCost: number): number {
  return Math.max(1, Math.round(order.cover * monthlyStockCost * EXPEDITE_PREMIUM))
}

/** What buying capacity costs per customer-slot, for the UI. */
export const CAPACITY_COST_PER_SLOT = Math.round(1 / CAPACITY_PER_NAIRA)

export interface OperationsSummary {
  capacity: number
  utilisation: number
  state: CapacityView['state']
  unserved: number
  inTransit: number
  nextArrival: number | null
  lateDeliveries: number
  defectRate: number
  lastRefunds: number
}

/** Everything the operations panel needs, derived from state alone. */
export function operationsSummary(state: GameState): OperationsSummary {
  const capacity = capacityOf(state)
  const view = capacityView(state.customers, capacity)
  const inFlight = openOrders(state.orders ?? [])
  const supplier = (state.suppliers ?? []).find((item) => item.id === state.supplierId) ?? state.suppliers?.[0]
  return {
    capacity,
    utilisation: view.utilisation,
    state: view.state,
    unserved: view.unserved,
    inTransit: inFlight.length,
    nextArrival: inFlight.length ? Math.min(...inFlight.map((order) => order.expectedMonth)) : null,
    lateDeliveries: (state.orders ?? []).filter((order) => order.lateMonths > 0).length,
    defectRate: defectRate({
      supplierQuality: supplier?.quality ?? 0,
      capacityOverload: view.overload,
      quality: state.quality,
      reliability: supplier?.reliability ?? 0.85,
    }),
    lastRefunds: state.lastReport?.returns ?? 0,
  }
}
