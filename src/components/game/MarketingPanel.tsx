import { useState } from 'react'
import { clsx } from 'clsx'
import { ArrowUpRight, Megaphone, TrendingDown, TrendingUp } from 'lucide-react'
import { MARKETING_CHANNELS, channelSpend, mixFactor, normalizeMix, unitEconomics } from '../../game/marketing'
import { useGame } from '../../game/store'
import type { GameState, MarketingChannelId } from '../../game/types'
import { money, monthLabel, number, percent } from '../../lib/format'
import { PanelSection, RangeRow, Stat } from './bits'

const PRESETS: { id: string; label: string; blurb: string; mix: Record<MarketingChannelId, number> }[] = [
  { id: 'balanced', label: 'Balanced', blurb: 'A bit of everything', mix: { social: 0.4, search: 0.3, content: 0.2, events: 0.1 } },
  { id: 'reach', label: 'Reach', blurb: 'Volume in mass markets', mix: { social: 0.7, search: 0.15, content: 0.1, events: 0.05 } },
  { id: 'intent', label: 'Intent', blurb: 'Catch people searching', mix: { social: 0.15, search: 0.6, content: 0.2, events: 0.05 } },
  { id: 'authority', label: 'Authority', blurb: 'Slow, compounding quality', mix: { social: 0.1, search: 0.15, content: 0.6, events: 0.15 } },
  { id: 'deals', label: 'Deals', blurb: 'Events and B2B meetings', mix: { social: 0.1, search: 0.15, content: 0.15, events: 0.6 } },
]

const channelLabel = (id: MarketingChannelId | 'organic') =>
  id === 'organic' ? 'Word of mouth' : MARKETING_CHANNELS.find((channel) => channel.id === id)?.label ?? id

export function MarketingPanel({ game: injected }: { game?: GameState } = {}) {
  const stored = useGame((state) => state.game) as GameState | null
  const setChannelShare = useGame((state) => state.setChannelShare)
  const setMixPreset = useGame((state) => state.setMixPreset)
  const [draft, setDraft] = useState<Partial<Record<MarketingChannelId, number>>>({})

  const game = injected ?? stored
  if (!game) return null

  const mix = normalizeMix(game.marketingMix)
  const spends = channelSpend(game)
  const factor = mixFactor(game)
  const report = game.lastReport
  const editable = game.status === 'active' && !injected

  const churn = report ? Math.max(0.005, report.churned / Math.max(1, report.customersEnd + report.churned)) : 0.04
  const economics = unitEconomics({
    arpu: report && report.customersEnd > 0 ? report.revenue / report.customersEnd : game.price,
    costPerCustomer: report ? Math.max(1, Math.round(report.revenue / Math.max(1, report.customersEnd) / 2)) : Math.round(game.price / 2),
    churn,
    spend: spends.reduce((sum, item) => sum + item.spend, 0),
    customersWon: report ? (report.newCustomers + report.dealsWon) * 0.7 : 0,
  })

  const totalSpend = spends.reduce((sum, item) => sum + item.spend, 0)
  const paidRows = (report?.channels ?? []).filter((row) => row.channel !== 'organic')
  const organicRow = (report?.channels ?? []).find((row) => row.channel === 'organic')
  const attributed = report?.channels.reduce((sum, row) => sum + row.customers, 0) ?? 0
  const bestChannel = [...paidRows].sort((a, b) => (a.cac || Infinity) - (b.cac || Infinity))[0]
  const worstChannel = [...paidRows].sort((a, b) => b.cac - a.cac)[0]

  const move = (id: MarketingChannelId, value: number) => {
    setDraft((current) => ({ ...current, [id]: value }))
    setChannelShare(id, value)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-ink-900 px-3 py-2.5 text-white">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-white/50">Budget</p>
          <p className="figure mt-1 text-[16px] font-semibold tabular-nums">{money(game.marketingSpend)}</p>
        </div>
        <Stat label="Mix effect" value={`${factor >= 1 ? '+' : ''}${percent(factor - 1, 1)}`} tone={factor >= 1 ? 'good' : 'bad'} sub="demand vs a neutral mix" />
        <Stat label="Blended CAC" value={economics.cac > 0 ? money(economics.cac) : '—'} sub={report ? `${number(report.newCustomers + report.dealsWon)} won` : 'close a month'} />
        <Stat
          label="LTV : CAC"
          value={economics.ratio > 0 ? `${economics.ratio.toFixed(1)}×` : '—'}
          tone={economics.ratio >= 3 ? 'good' : economics.ratio > 0 && economics.ratio < 1 ? 'bad' : 'neutral'}
          sub={economics.ltv > 0 ? `${money(economics.ltv)} lifetime value` : undefined}
        />
      </div>

      <PanelSection
        title="Where the budget goes"
        hint="Shares of the same budget. Each channel reaches people at a different cost and suits a different industry — the mix effect above is the result."
      >
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const active = MARKETING_CHANNELS.every((channel) => Math.abs(mix[channel.id] - preset.mix[channel.id]) < 0.02)
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setDraft({})
                  setMixPreset(preset.mix)
                }}
                disabled={!editable}
                aria-pressed={active}
                title={preset.blurb}
                className={clsx(
                  'rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition disabled:opacity-40',
                  active ? 'bg-brand-500 text-white shadow-sm' : 'bg-paper-3/80 text-ink-500 hover:bg-paper-3 hover:text-ink',
                )}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <div className="mt-4 space-y-4">
          {MARKETING_CHANNELS.map((channel) => {
            const share = draft[channel.id] ?? mix[channel.id]
            const spend = spends.find((item) => item.channel === channel.id)?.spend ?? 0
            const stats = game.channelStats?.find((item) => item.channel === channel.id)
            return (
              <div key={channel.id}>
                <RangeRow
                  label={channel.label}
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round(share * 100)}
                  disabled={!editable}
                  onChange={(value) => move(channel.id, value / 100)}
                  format={(value) => `${value}%`}
                  helper={`${money(spend)} · fit ${channel.fit[game.industry].toFixed(2)} · ${stats?.customers ? `${number(stats.customers)} won so far` : 'no customers yet'}`}
                  accent={channel.id === 'social' ? 'coral' : channel.id === 'search' ? 'brand' : 'violet'}
                />
                <p className="mt-1 text-[10.5px] leading-snug text-ink-400">{channel.blurb}</p>
              </div>
            )
          })}
        </div>

        <p className="mt-3 rounded-xl bg-paper-3/60 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
          Changing one channel rebalances the others so the shares always total 100%. {editable ? 'Sliders apply immediately and are recorded as decisions.' : 'This run is over — the mix is read-only.'}
        </p>
      </PanelSection>

      <PanelSection
        title={report ? `Attribution · ${monthLabel(report.month)}` : 'Attribution'}
        hint={
          report
            ? `${number(attributed)} customers won, ${number(report.newCustomers)} from demand and ${number(report.dealsWon)} from the pipeline. 30% is treated as word of mouth.`
            : 'Close a month to see where the customers came from.'
        }
      >
        {!report ? (
          <p className="text-[12px] text-ink-500">Nothing to attribute yet.</p>
        ) : (
          <>
            <table className="w-full border-collapse">
              <caption className="sr-only">Customers won per channel this month</caption>
              <thead>
                <tr className="border-b border-line text-[9.5px] uppercase tracking-[0.11em] text-ink-400">
                  <th scope="col" className="py-1.5 text-left font-bold">Channel</th>
                  <th scope="col" className="py-1.5 text-right font-bold">Spend</th>
                  <th scope="col" className="py-1.5 text-right font-bold">Won</th>
                  <th scope="col" className="py-1.5 text-right font-bold">CAC</th>
                </tr>
              </thead>
              <tbody>
                {(report.channels ?? []).map((row) => (
                  <tr key={row.channel} className="border-b border-line/60">
                    <th scope="row" className="py-2 pr-3 text-left text-[12px] font-normal text-ink-600">
                      {channelLabel(row.channel)}
                      {row.channel === 'organic' && <span className="ml-1.5 rounded-full bg-success-soft px-1.5 py-0.5 text-[9px] font-bold uppercase text-success-strong">free</span>}
                    </th>
                    <td className="py-2 text-right"><span className="figure text-[12px] tabular-nums text-ink-700">{row.spend > 0 ? money(row.spend) : '—'}</span></td>
                    <td className="py-2 text-right"><span className="figure text-[12px] tabular-nums text-ink">{number(row.customers)}</span></td>
                    <td className="py-2 text-right"><span className="figure text-[12px] tabular-nums text-ink-700">{row.cac > 0 ? money(row.cac) : '—'}</span></td>
                  </tr>
                ))}
                <tr className="border-t border-line-strong bg-paper-3/60">
                  <th scope="row" className="py-2 pr-3 text-left text-[12px] font-semibold text-ink">Total</th>
                  <td className="py-2 text-right"><span className="figure text-[12px] font-semibold tabular-nums text-ink">{money(totalSpend)}</span></td>
                  <td className="py-2 text-right"><span className="figure text-[12px] font-semibold tabular-nums text-ink">{number(attributed)}</span></td>
                  <td className="py-2 text-right"><span className="figure text-[12px] font-semibold tabular-nums text-ink">{report.cac > 0 ? money(report.cac) : '—'}</span></td>
                </tr>
              </tbody>
            </table>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-success-soft/60 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.11em] text-success-strong">
                  <TrendingUp className="size-3" /> Cheapest customers
                </p>
                <p className="mt-1 text-[12px] font-semibold text-ink">
                  {bestChannel ? `${channelLabel(bestChannel.channel)} · ${money(bestChannel.cac)} each` : 'No paid customers yet'}
                </p>
              </div>
              <div className="rounded-xl bg-coral-soft/60 px-3 py-2">
                <p className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.11em] text-coral">
                  <TrendingDown className="size-3" /> Most expensive
                </p>
                <p className="mt-1 text-[12px] font-semibold text-ink">
                  {worstChannel && worstChannel.customers > 0 ? `${channelLabel(worstChannel.channel)} · ${money(worstChannel.cac)} each` : 'Not enough data yet'}
                </p>
              </div>
            </div>

            {organicRow && organicRow.customers > 0 && (
              <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-500">
                <Megaphone className="mt-0.5 size-3.5 shrink-0" />
                {number(organicRow.customers)} customers arrived without paid spend — reputation {game.reputation.toFixed(1)} and quality{' '}
                {game.quality.toFixed(1)} are doing that work.
              </p>
            )}
          </>
        )}
      </PanelSection>

      <PanelSection title="Unit economics" hint="How much a customer is worth against what one costs to win.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Revenue / customer" value={money(economics.arpu)} sub="per month" />
          <Stat label="Gross margin" value={money(economics.grossMargin)} sub="per customer / month" />
          <Stat label="Expected life" value={`${economics.lifetimeMonths} mo`} sub={`${percent(economics.churn, 1)} monthly churn`} />
          <Stat label="LTV" value={money(economics.ltv)} sub="gross-margin lifetime" />
        </div>
        <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-paper-3/60 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
          <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" />
          {economics.ratio >= 3
            ? `At ${economics.ratio.toFixed(1)}× LTV:CAC, paying for customers is working — there is room to spend more here.`
            : economics.ratio > 0 && economics.ratio < 1
              ? `At ${economics.ratio.toFixed(1)}× LTV:CAC you are buying customers for more than they return. Cut the weakest channel or lift price/quality.`
              : economics.ratio > 0
                ? `At ${economics.ratio.toFixed(1)}× LTV:CAC the mix roughly breaks even; 3× is the usual target.`
                : 'Close a month with marketing spend to see whether acquisition pays for itself.'}
        </p>
      </PanelSection>
    </div>
  )
}
