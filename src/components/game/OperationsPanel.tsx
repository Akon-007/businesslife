import { useState } from 'react'
import { clsx } from 'clsx'
import { AlertTriangle, Gauge, PackageCheck, RotateCcw, Timer, Truck } from 'lucide-react'
import { useGame } from '../../game/store'
import {
  CAPACITY_COST_PER_SLOT,
  CAPACITY_PER_NAIRA,
  MAX_ORDER_COVER,
  capacityView,
  defectRate,
  expediteCost,
  openOrders,
  operationsSummary,
} from '../../game/supply'
import { industryById } from '../../game/data'
import type { GameState } from '../../game/types'
import { money, monthLabel, number, percent } from '../../lib/format'
import { PanelSection, Stat } from './bits'

/**
 * Operations: what is on order and when it lands, whether the business can
 * actually serve the demand it has, and what the returns bill is. Every number
 * comes from `game/supply.ts`; nothing is re-derived here.
 */
export function OperationsPanel({ game: injected }: { game?: GameState } = {}) {
  const stored = useGame((state) => state.game) as GameState | null
  const placeOrder = useGame((state) => state.placeOrder)
  const expediteOrder = useGame((state) => state.expediteOrder)
  const cancelOrder = useGame((state) => state.cancelOrder)
  const investCapacity = useGame((state) => state.investCapacity)
  const [cover, setCover] = useState(1)

  const game = injected ?? stored
  if (!game) return null

  const industry = industryById(game.industry)
  const supplier = (game.suppliers ?? []).find((item) => item.id === game.supplierId) ?? game.suppliers?.[0]
  const summary = operationsSummary(game)
  const view = capacityView(game.customers, summary.capacity)
  const inFlight = openOrders(game.orders ?? [])
  const delivered = (game.orders ?? [])
    .filter((order) => order.status === 'delivered')
    .slice(-4)
    .reverse()
  const monthlyStockCost = Math.max(1, game.customers * industry.costPerCustomer)
  const refunds = game.lastReport?.returns ?? 0
  const defectPct = defectRate({
    supplierQuality: supplier?.quality ?? 0,
    capacityOverload: view.overload,
    quality: game.quality,
    reliability: supplier?.reliability ?? 0.85,
  })

  const capacityTone = view.state === 'over' ? 'bad' : view.state === 'tight' ? 'warn' : 'good'

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Capacity used"
          value={percent(view.utilisation, 0)}
          tone={capacityTone}
          sub={`${number(view.served)} of ${number(summary.capacity)} accounts`}
        />
        <Stat
          label="Unserved demand"
          value={number(view.unserved)}
          tone={view.unserved > 0 ? 'bad' : 'good'}
          sub={view.unserved > 0 ? 'lost revenue, extra churn' : 'every customer served'}
        />
        <Stat
          label="On order"
          value={number(inFlight.length)}
          sub={summary.nextArrival ? `next ${monthLabel(summary.nextArrival)}` : 'nothing in transit'}
        />
        <Stat
          label="Returns"
          value={percent(defectPct, 1)}
          tone={defectPct > 0.05 ? 'bad' : defectPct > 0.03 ? 'warn' : 'good'}
          sub={refunds > 0 ? `${money(refunds, { compact: true })} refunded` : 'defect rate of revenue'}
        />
      </div>

      {view.unserved > 0 ? (
        <p className="flex items-start gap-2 rounded-xl bg-coral-soft px-3 py-2.5 text-[10.5px] leading-snug text-coral">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          You are turning away {number(view.unserved)} accounts a month. Overflow churns 15% faster and drags quality down.
          Hire, open a branch, or buy capacity below.
        </p>
      ) : null}

      {industry.inventory ? (
        <>
          <PanelSection
            title="Purchase orders"
            hint={`Stock arrives from these orders. ${supplier ? supplier.name : 'Your supplier'} quotes a ${supplier?.leadMonths ?? 1}-month lead time; unreliable suppliers slip.`}
          >
            {inFlight.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-paper-3/50 px-4 py-5 text-center">
                <Truck className="mx-auto size-5 text-ink-300" />
                <p className="mt-2 text-[12px] font-semibold text-ink-600">Nothing in transit</p>
                <p className="mt-0.5 text-[10.5px] text-ink-400">
                  {game.restockMonths > 0
                    ? 'Your restock policy places a standing order each close.'
                    : 'The restock policy is off — order manually or set it in the panel above.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {inFlight.map((order) => {
                  const atRisk = order.expectedMonth > order.promisedMonth
                  const premium = expediteCost(order, monthlyStockCost)
                  const canExpedite = order.expectedMonth > game.month + 1
                  return (
                    <li key={order.id} className="rounded-xl border border-line bg-paper-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-bold text-ink">
                            {order.cover.toFixed(1)} months of cover
                          </p>
                          <p className="text-[10px] text-ink-500">
                            {order.note ?? 'Manual order'} · due {monthLabel(order.expectedMonth)}
                            {atRisk ? ` · slipped from ${monthLabel(order.promisedMonth)}` : ''}
                          </p>
                        </div>
                        <span
                          className={clsx(
                            'shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold',
                            atRisk ? 'bg-gold-soft text-gold-ink' : 'bg-brand-50 text-brand-700',
                          )}
                        >
                          {atRisk ? 'At risk' : 'On time'}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => expediteOrder(order.id)}
                          disabled={!canExpedite || game.cash < premium}
                          className="rounded-full bg-ink px-2 py-1 text-[9.5px] font-bold text-white transition hover:bg-ink-800 disabled:opacity-40"
                        >
                          Expedite {money(premium, { compact: true })}
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelOrder(order.id)}
                          className="rounded-full bg-paper-3 px-2 py-1 text-[9.5px] font-bold text-ink-500 transition hover:text-coral"
                        >
                          Cancel
                        </button>
                        {!canExpedite ? <span className="text-[9px] text-ink-400">already landing next close</span> : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="mt-3 rounded-xl border border-line bg-paper-2 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold text-ink">Place an order</p>
                <p className="figure text-[11px] font-bold text-ink">{cover.toFixed(1)} mo</p>
              </div>
              <input
                type="range"
                min={0.5}
                max={MAX_ORDER_COVER}
                step={0.5}
                value={cover}
                onChange={(event) => setCover(Number(event.target.value))}
                aria-label="Months of cover to order"
                className="mt-2 w-full accent-brand-500"
              />
              <button
                type="button"
                onClick={() => placeOrder(cover)}
                className="mt-2 w-full rounded-full bg-brand-600 px-3 py-1.5 text-[10.5px] font-bold text-white transition hover:bg-brand-700"
              >
                Order {cover.toFixed(1)} months · arrives {monthLabel(game.month + (supplier?.leadMonths ?? 1) + 1)}
              </button>
            </div>
          </PanelSection>

          {delivered.length > 0 ? (
            <PanelSection title="Recently delivered" hint="A late delivery is a stockout you paid for in lost sales.">
              <ul className="space-y-1.5">
                {delivered.map((order) => (
                  <li key={order.id} className="flex items-center justify-between gap-2 rounded-lg bg-paper-3/60 px-2.5 py-2">
                    <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-ink">
                      <PackageCheck className="size-3.5 text-success-strong" />
                      {order.cover.toFixed(1)} months on {monthLabel(order.deliveredMonth ?? order.expectedMonth)}
                    </span>
                    <span
                      className={clsx(
                        'rounded-full px-2 py-0.5 text-[9px] font-bold',
                        order.lateMonths > 0 ? 'bg-gold-soft text-gold-ink' : 'bg-success-soft text-success-strong',
                      )}
                    >
                      {order.lateMonths > 0 ? `${order.lateMonths} mo late` : 'On time'}
                    </span>
                  </li>
                ))}
              </ul>
            </PanelSection>
          ) : null}
        </>
      ) : (
        <PanelSection title="No physical deliveries" hint="This business sells capacity, not stock — the constraint below is what matters.">
          <p className="rounded-xl bg-paper-3/60 px-3 py-3 text-[10.5px] leading-relaxed text-ink-500">
            There is nothing to order in months of cover. Watch utilisation instead: an overloaded service business
            loses the customers it cannot serve, and quality falls with it.
          </p>
        </PanelSection>
      )}

      <PanelSection title="Capacity" hint="Each teammate serves 10 accounts a month; equipment adds more. Overflow is revenue you cannot bill.">
        <div className="rounded-xl border border-line bg-paper-2 p-3">
          <div className="flex items-center justify-between text-[10.5px]">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
              <Gauge className="size-3.5 text-brand-600" />
              {number(game.customers)} accounts against {number(summary.capacity)} slots
            </span>
            <span className="figure font-bold text-ink">{percent(view.utilisation, 0)}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/[0.07]">
            <div
              className={clsx('h-full rounded-full', view.state === 'over' ? 'bg-coral' : view.state === 'tight' ? 'bg-gold' : 'bg-success')}
              style={{ width: `${Math.min(100, Math.round(view.utilisation * 100))}%` }}
            />
          </div>
          <p className="mt-2 text-[9.5px] leading-snug text-ink-400">
            {view.state === 'over'
              ? 'Over capacity: the unserved share of demand is lost, and those accounts churn faster.'
              : view.state === 'tight'
                ? 'Close to the ceiling. Buy capacity before demand arrives, not after.'
                : 'Room to grow without spending on capacity.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[CAPACITY_COST_PER_SLOT, CAPACITY_COST_PER_SLOT * 3].map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => investCapacity(amount)}
                disabled={game.cash < amount}
                className="rounded-full bg-ink px-2 py-1 text-[9.5px] font-bold text-white transition hover:bg-ink-800 disabled:opacity-40"
              >
                +{Math.round(amount * CAPACITY_PER_NAIRA)} slots · {money(amount, { compact: true })}
              </button>
            ))}
          </div>
        </div>
      </PanelSection>

      {game.lastReport?.capacity ? (
        <PanelSection title="Last month" hint="What the operation actually delivered.">
          <ul className="space-y-1.5 text-[10.5px] text-ink-600">
            <li className="flex items-center gap-1.5">
              <Timer className="size-3.5 text-ink-400" /> {number(game.lastReport.ordersInTransit)} order
              {game.lastReport.ordersInTransit === 1 ? '' : 's'} in transit · {number(game.lastReport.lateDeliveries)} late
            </li>
            <li className="flex items-center gap-1.5">
              <RotateCcw className="size-3.5 text-ink-400" /> {money(game.lastReport.returns)} refunded on{' '}
              {percent(game.lastReport.revenue > 0 ? game.lastReport.returns / game.lastReport.revenue : 0, 1)} of revenue
            </li>
            <li className="flex items-center gap-1.5">
              <AlertTriangle className="size-3.5 text-ink-400" /> {number(game.lastReport.unserved)} account
              {game.lastReport.unserved === 1 ? '' : 's'} unserved
            </li>
          </ul>
        </PanelSection>
      ) : null}
    </>
  )
}

