import { useState } from 'react'
import { clsx } from 'clsx'
import { BadgeCheck, Ban, FileText, Handshake, Inbox, Send, Sparkles } from 'lucide-react'
import { useGame } from '../../game/store'
import { QUALIFICATION_FEE, SOURCE_META, contractTerm, funnelSummary, quoteValue, scoreLead } from '../../game/sales'
import type { GameState, Lead } from '../../game/types'
import { money, monthLabel, number, percent } from '../../lib/format'
import { PanelSection, Stat } from './bits'

const BAND_META = {
  hot: { label: 'Hot', tone: 'bg-success-soft text-success-strong', bar: 'bg-success' },
  warm: { label: 'Warm', tone: 'bg-gold-soft text-gold-ink', bar: 'bg-gold' },
  cold: { label: 'Cold', tone: 'bg-paper-3 text-ink-500', bar: 'bg-ink-300' },
} as const

const DISCOUNTS = [0, 0.1, 0.2] as const

/**
 * The sales funnel: scouted accounts, their qualification score, the quote the
 * player sends and the retainers that follow. Every rule shown here (score,
 * win chance, quote value, term length) comes from `game/sales.ts` — the panel
 * renders arithmetic, it does not invent any.
 */
export function SalesFunnel({ game: injected }: { game?: GameState } = {}) {
  const stored = useGame((state) => state.game) as GameState | null
  const qualifyLead = useGame((state) => state.qualifyLead)
  const sendQuote = useGame((state) => state.sendQuote)
  const dropLead = useGame((state) => state.dropLead)
  const [discounts, setDiscounts] = useState<Record<string, number>>({})

  const game = injected ?? stored
  if (!game) return null

  const leads = game.leads ?? []
  const contracts = game.contracts ?? []
  const price = game.price
  const summary = funnelSummary(leads, contracts, price)
  const working = leads.filter((lead) => lead.status === 'open' || lead.status === 'qualified')
  const quoted = leads.filter((lead) => lead.status === 'quoted')
  const closed = leads.filter((lead) => lead.status === 'won' || lead.status === 'lost').slice(-6).reverse()
  const live = contracts.filter((contract) => contract.monthsLeft > 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Funnel value"
          value={money(summary.pipelineValue, { compact: true })}
          sub={`${working.length + quoted.length} open account${working.length + quoted.length === 1 ? '' : 's'}`}
        />
        <Stat
          label="Recurring revenue"
          value={money(summary.monthlyRecurring, { compact: true })}
          tone={summary.monthlyRecurring > 0 ? 'good' : 'neutral'}
          sub={`${live.length} live retainer${live.length === 1 ? '' : 's'}`}
        />
        <Stat label="Quotes out" value={number(quoted.length)} sub={quoted.length ? `${percent(summary.avgChance, 0)} average chance` : 'nothing pending'} />
        <Stat label="Signed / lost" value={`${number(summary.won)} / ${number(summary.lost)}`} tone={summary.won > summary.lost ? 'good' : 'neutral'} sub="all time" />
      </div>

      <PanelSection title="Accounts to work" hint="Score is intent, fit and whether they can afford your price. Qualify before quoting to improve the odds.">
        {working.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper-3/50 px-4 py-5 text-center">
            <Inbox className="mx-auto size-5 text-ink-300" />
            <p className="mt-2 text-[12px] font-semibold text-ink-600">No accounts in the funnel</p>
            <p className="mt-0.5 text-[10.5px] text-ink-400">
              Marketing spend brings inbound, referrals follow live retainers, sales hires open outbound.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {working.map((lead) => {
              const scored = scoreLead(lead, price)
              const band = BAND_META[scored.band]
              const discount = discounts[lead.id] ?? 0
              const value = quoteValue(lead, price, discount)
              const qualified = lead.status === 'qualified'
              return (
                <li key={lead.id} className="rounded-xl border border-line bg-paper-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-ink">{lead.company}</p>
                      <p className="text-[10px] text-ink-500">
                        {lead.contact} · {number(lead.seats)} seats · budget {money(lead.budget, { compact: true })}/mo
                      </p>
                    </div>
                    <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold', band.tone)}>
                      {band.label} {scored.score}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                    <span className="rounded-full bg-white px-2 py-0.5 text-ink-500 ring-1 ring-line">{SOURCE_META[lead.source].label}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-ink-500 ring-1 ring-line">intent {lead.intent}</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-ink-500 ring-1 ring-line">fit {lead.fit}</span>
                    {qualified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-success-strong">
                        <BadgeCheck className="size-3" /> qualified
                      </span>
                    ) : null}
                    {scored.overBudget ? (
                      <span className="rounded-full bg-coral-soft px-2 py-0.5 text-coral">over budget</span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                      <div className={clsx('h-full rounded-full', band.bar)} style={{ width: `${Math.max(4, scored.score)}%` }} />
                    </div>
                    <span className="text-[9px] font-semibold text-ink-400">{money(scored.potential, { compact: true })}/mo potential</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {!qualified ? (
                      <button
                        type="button"
                        onClick={() => qualifyLead(lead.id)}
                        disabled={game.cash < QUALIFICATION_FEE}
                        className="rounded-full bg-paper-3 px-2 py-1 text-[9.5px] font-bold text-ink-600 transition hover:text-ink disabled:opacity-40"
                      >
                        Qualify {money(QUALIFICATION_FEE)}
                      </button>
                    ) : null}
                    {DISCOUNTS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setDiscounts((current) => ({ ...current, [lead.id]: option }))}
                        className={clsx(
                          'rounded-full px-2 py-1 text-[9.5px] font-bold transition',
                          discount === option ? 'bg-ink text-white' : 'bg-paper-3 text-ink-500 hover:text-ink',
                        )}
                      >
                        {option === 0 ? 'list' : `${Math.round(option * 100)}% off`}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => sendQuote(lead.id, discount)}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-1 text-[9.5px] font-bold text-white transition hover:bg-brand-700"
                    >
                      <Send className="size-2.5" /> Quote {money(value, { compact: true })}
                    </button>
                    <button
                      type="button"
                      onClick={() => dropLead(lead.id)}
                      aria-label={`Drop ${lead.company}`}
                      className="ml-auto rounded-full px-2 py-1 text-[9.5px] font-bold text-ink-400 transition hover:text-coral"
                    >
                      <Ban className="size-3" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </PanelSection>

      {quoted.length > 0 ? (
        <PanelSection title="Quotes out" hint="The buyer answers at the next month close. A quote that passes its expiry is a lost account.">
          <ul className="space-y-2">
            {quoted.map((lead) => (
              <li key={lead.id} className="rounded-xl border border-line bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold text-ink">{lead.company}</p>
                    <p className="text-[10px] text-ink-500">
                      {money(lead.quote?.value ?? 0)}/mo · {lead.quote?.discount ? `${Math.round((lead.quote.discount ?? 0) * 100)}% off · ` : ''}
                      {contractTerm(lead.quote?.value ?? 0, price)}-month term
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="figure text-[12px] font-bold text-ink">{percent(lead.quote?.chance ?? 0, 0)}</p>
                    <p className="text-[9px] text-ink-400">modelled chance</p>
                  </div>
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-[9.5px] text-ink-400">
                  <FileText className="size-3" /> open to {monthLabel(lead.quote?.expiresMonth ?? game.month)}
                </p>
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}

      {live.length > 0 ? (
        <PanelSection title="Live retainers" hint="Billed and collected monthly. These accounts sit outside the consumer demand model, so they never churn.">
          <ul className="space-y-2">
            {live.map((contract) => (
              <li key={contract.id} className="rounded-xl border border-line bg-paper-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-bold text-ink">{contract.company}</p>
                    <p className="text-[10px] text-ink-500">
                      {number(contract.customers)} seats · {contract.monthsLeft} of {contract.months} months left
                    </p>
                  </div>
                  <p className="figure shrink-0 text-[12px] font-bold text-ink">{money(contract.monthlyValue, { compact: true })}<span className="text-[9px] text-ink-400">/mo</span></p>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink/[0.07]">
                  <div
                    className={clsx('h-full rounded-full', contract.monthsLeft <= 2 ? 'bg-gold' : 'bg-success')}
                    style={{ width: `${Math.round((contract.monthsLeft / Math.max(1, contract.months)) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </PanelSection>
      ) : null}

      {closed.length > 0 ? (
        <PanelSection title="Recently closed" hint="Won accounts became retainers; lost ones are the cost of a weak offer.">
          <ul className="space-y-1.5">
            {closed.map((lead) => (
              <LeadRow key={lead.id} lead={lead} />
            ))}
          </ul>
        </PanelSection>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3.5 ring-1 ring-brand-100">
        <Handshake className="mt-0.5 size-4 shrink-0 text-brand-700" />
        <p className="text-[11px] leading-relaxed text-brand-800">
          <b className="font-bold">How the funnel pays:</b> a retainer is billed monthly and lands in cash in the month it is
          earned, so it never sits in receivables. Discounts lift the odds and cut the value; asking above a budget costs a
          third of the chance. <Sparkles className="inline size-3" /> Qualification is the only lever that costs cash up front.
        </p>
      </div>
    </>
  )
}

function LeadRow({ lead }: { lead: Lead }) {
  const won = lead.status === 'won'
  return (
    <li className="flex items-start justify-between gap-2 rounded-lg bg-paper-3/60 px-2.5 py-2">
      <div className="min-w-0">
        <p className="truncate text-[11px] font-semibold text-ink">{lead.company}</p>
        <p className="truncate text-[9.5px] text-ink-400">{lead.note ?? (won ? 'Signed.' : 'Lost.')}</p>
      </div>
      <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold', won ? 'bg-success-soft text-success-strong' : 'bg-paper-3 text-ink-400')}>
        {won ? 'Won' : 'Lost'}
      </span>
    </li>
  )
}
