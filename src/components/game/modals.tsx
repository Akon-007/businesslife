import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Boxes,
  Building2,
  Check,
  Compass,
  Handshake,
  Landmark,
  Lightbulb,
  MapPin,
  RotateCcw,
  Share2,
  ShieldAlert,
  Store,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Modal } from '../ui/Modal'
import { Sparkline, BarRow } from '../ui/Charts'
import { ACHIEVEMENTS, industryById } from '../../game/data'
import { getGrade, performanceScore, RUN_LENGTH } from '../../game/engine'
import type { CrisisOption, CrisisState, GameState, MonthReport } from '../../game/types'
import { money, monthLabel, number, percent } from '../../lib/format'
import { effectLabel, Stat } from './bits'

const effectKeys = ['cash', 'customersPct', 'customersAdd', 'quality', 'reputation', 'morale', 'debt', 'marketing', 'acquisitionMult'] as const

function signedDecimal(value: number, digits = 1) {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`
}

function EffectChips({ effects }: { effects: CrisisOption['effects'] }) {
  const labels = effectKeys
    .map((key) => {
      const value = effects[key]
      return typeof value === 'number' ? effectLabel(key, value) : null
    })
    .filter((label): label is string => Boolean(label))

  return (
    <div className="flex flex-wrap gap-1.5">
      {labels.map((label) => (
        <span
          key={label}
          className={clsx(
            'rounded-full px-2.5 py-1 text-[10px] font-bold',
            label.startsWith('+') || label.includes('acquired')
              ? 'bg-brand-100 text-brand-800'
              : 'bg-coral/15 text-[#9c3426]',
          )}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

export function ReportModal({
  report,
  game,
  onClose,
}: {
  report: MonthReport | null
  game: GameState
  onClose: () => void
}) {
  const industry = industryById(game.industry)
  if (!report) return null

  const previous = game.history.length > 1 ? game.history[game.history.length - 2] : null
  const qualityDelta = previous ? report.quality - previous.quality : 0
  const reputationDelta = previous ? report.reputation - previous.reputation : 0
  const moraleDelta = previous ? report.morale - previous.morale : 0
  const positive = report.net >= 0

  return (
    <Modal open onClose={onClose} size="lg" title="Monthly report">
      <div className="-mt-1">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-ink-400">
              Month {report.month} · {monthLabel(report.month - 1)}
            </p>
            <h2 className="mt-1 max-w-[380px] font-display text-[26px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink">
              {report.headline}
            </h2>
          </div>
          <div
            className={clsx(
              'rounded-2xl px-4 py-2.5 text-right',
              positive ? 'bg-brand-50 text-brand-800' : 'bg-coral/10 text-[#9c3426]',
            )}
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] opacity-60">Net cash</p>
            <p className="font-display text-[24px] font-semibold leading-none tabular-nums">
              {money(report.net, { sign: true })}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-line bg-white p-4">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Cash flow</p>
            <div className="mt-3 space-y-2.5">
              <BarRow label="Revenue" value={report.revenue} max={Math.max(report.revenue, report.costs)} color="#12a060" valueLabel={money(report.revenue)} />
              <BarRow label="Payroll" value={report.payroll} max={Math.max(report.revenue, report.costs)} color="#7c6cf6" valueLabel={money(report.payroll)} />
              <BarRow label="Overhead" value={report.overhead} max={Math.max(report.revenue, report.costs)} color="#ffc94a" valueLabel={money(report.overhead)} />
              <BarRow label="Interest" value={report.interest} max={Math.max(report.revenue, report.costs)} color="#ff6f61" valueLabel={money(report.interest)} />
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
              <span className="text-[10.5px] font-semibold text-ink-500">Cash end of month</span>
              <span className="font-display text-[15px] font-semibold text-ink">{money(report.cashEnd)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Won" value={`+${number(report.newCustomers)}`} tone="good" sub={industry.customerNounPlural} />
              <Stat label="Churned" value={`−${number(report.churned)}`} tone="bad" sub={`${number(report.customersEnd)} left`} />
              <Stat
                label="Quality"
                value={`${report.quality.toFixed(1)}`}
                tone={qualityDelta >= 0 ? 'good' : 'bad'}
                sub={`${signedDecimal(qualityDelta)} this month`}
              />
              <Stat
                label="Reputation"
                value={`${report.reputation.toFixed(1)}`}
                tone={reputationDelta >= 0 ? 'good' : 'bad'}
                sub={`${signedDecimal(reputationDelta)} this month`}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-paper-3/70 px-3 py-2.5">
              <span className="text-[10.5px] font-semibold text-ink-500">Team morale</span>
              <span className={clsx('text-[12px] font-bold', moraleDelta >= 0 ? 'text-brand-700' : 'text-coral')}>
                {report.morale.toFixed(1)}
                <span className="ml-1 text-[10px] font-semibold opacity-70">{signedDecimal(moraleDelta)}</span>
              </span>
            </div>
          </div>
        </div>

        {report.drivers.length > 0 && (
          <div className="mt-4 rounded-2xl border border-line bg-white p-4">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-400">What moved the month</p>
            <ul className="mt-2 space-y-1.5">
              {report.drivers.map((driver) => (
                <li key={driver} className="flex gap-2 text-[11.5px] leading-snug text-ink-600">
                  <span
                    className={clsx(
                      'mt-1.5 size-1 shrink-0 rounded-full',
                      driver.toLowerCase().includes('crisis') || driver.toLowerCase().includes('stockout')
                        ? 'bg-coral'
                        : 'bg-brand-500',
                    )}
                  />
                  {driver}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 rounded-2xl bg-ink p-4 text-white">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-full bg-lime text-ink">
              <Lightbulb className="size-3.5" />
            </span>
            <p className="text-[11.5px] font-bold">Nova noticed</p>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {report.insights.map((insight) => (
              <li key={insight} className="flex gap-2 text-[11.5px] leading-relaxed text-white/70">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-lime" />
                {insight}
              </li>
            ))}
          </ul>
        </div>

        {report.newAchievements.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl bg-gold-soft/40 px-3 py-2.5">
            <Trophy className="size-3.5 text-[#9a6b12]" />
            {report.newAchievements.map((id) => (
              <span key={id} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-ink-600">
                {ACHIEVEMENTS[id]?.label ?? id}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          {report.crisisQueued && (
            <span className="flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-coral">
              <ShieldAlert className="size-3.5" />
              A crisis is waiting
            </span>
          )}
          <button
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink-800"
          >
            {report.crisisQueued ? 'Face the crisis' : 'Back to the city'}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function CrisisModal({
  crisis,
  choice,
  onChoose,
  onContinue,
}: {
  crisis: CrisisState | null
  choice: CrisisOption | null
  onChoose: (option: CrisisOption) => void
  onContinue: () => void
}) {
  if (!crisis) return null

  return (
    <Modal open onClose={onContinue} dismissible={false} size="lg" className="bg-paper-2">
      <div className="-mx-5 -my-5 sm:-mx-7 sm:-my-7">
        <div className="relative overflow-hidden bg-ink px-5 py-6 text-white sm:px-7">
          <span className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-coral/25 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-coral/15 px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.13em] text-[#ffb4a8]">
              <ShieldAlert className="size-3.5" />
              Crisis · month {crisis.month}
            </span>
            <h2 className="mt-3 max-w-[440px] font-display text-[28px] font-semibold leading-[1.03] tracking-[-0.035em] sm:text-[32px]">
              {crisis.title}
            </h2>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/35">{crisis.kicker}</p>
          </div>
        </div>

        <div className="px-5 py-5 sm:px-7 sm:py-6">
          <p className="max-w-[540px] text-[13.5px] leading-relaxed text-ink-600">{crisis.body}</p>

          {!choice ? (
            <>
              <p className="mt-5 text-[9.5px] font-bold uppercase tracking-[0.13em] text-ink-400">Your move</p>
              <div className="mt-2 space-y-2">
                {crisis.options.map((option, index) => (
                  <button
                    key={option.id}
                    onClick={() => onChoose(option)}
                    className="group flex w-full items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-soft"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-paper-3 text-[11px] font-bold text-ink-500 transition group-hover:bg-ink group-hover:text-lime">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-bold text-ink">{option.label}</span>
                      <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-500">{option.detail}</span>
                    </span>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </button>
                ))}
              </div>
              <p className="mt-3 text-center text-[10px] text-ink-400">No perfect answer. Choose what you can defend.</p>
            </>
          ) : (
            <div className="mt-5">
              <div className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-brand-600 text-white">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-brand-700">
                    Decision: {choice.label}
                  </p>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-ink-700">{choice.result}</p>
                <div className="mt-3 border-t border-line pt-3">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-400">On your numbers</p>
                  <div className="mt-2">
                    <EffectChips effects={choice.effects} />
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-[10px] text-ink-400">The story continues in the next report.</p>
                <button
                  onClick={onContinue}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink-800"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

const STATUS_COPY: Record<string, { eyebrow: string; title: string; copy: string }> = {
  completed: {
    eyebrow: 'Run complete',
    title: 'Thirty-six months. One company.',
    copy: 'You made it through the full run. The scorecard below is what your decisions compounded into.',
  },
  acquired: {
    eyebrow: 'Exit',
    title: 'You sold the company.',
    copy: 'You traded the next chapter for certainty. The run ends on your terms — with cash in hand.',
  },
  bankrupt: {
    eyebrow: 'Run over',
    title: 'The bank called in the debt.',
    copy: 'The business ran out of room before it ran out of ambition. The debrief is where this becomes useful.',
  },
}

export function RunEndModal({
  game,
  onReset,
  onReview,
  onShare,
}: {
  game: GameState
  onReset: () => void
  onReview: () => void
  onShare: () => void
}) {
  const score = performanceScore(game)
  const { grade, label } = getGrade(score)
  const status = STATUS_COPY[game.status] ?? STATUS_COPY.completed
  const history = game.history.map((snapshot) => snapshot.valuation)

  useEffect(() => {
    if (game.status !== 'bankrupt') {
      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.35 },
        colors: ['#0b8550', '#c9f269', '#ffc94a', '#ffffff'],
        disableForReducedMotion: true,
      })
    }
  }, [game.status])

  return (
    <Modal open onClose={onReview} dismissible={false} size="lg" dark className="bg-ink">
      <div className="-mx-5 -my-5 sm:-mx-7 sm:-my-7">
        <div className="relative overflow-hidden px-5 pb-6 pt-7 text-center sm:px-7">
          <span className="pointer-events-none absolute -left-16 -top-20 size-56 rounded-full bg-brand-500/25 blur-3xl" />
          <span className="pointer-events-none absolute -right-10 top-10 size-40 rounded-full bg-lime/15 blur-3xl" />
          <div className="relative">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-lime">{status.eyebrow}</p>
            <h2 className="mx-auto mt-2 max-w-[420px] font-display text-[30px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[36px]">
              {status.title}
            </h2>
            <p className="mx-auto mt-2 max-w-[430px] text-[12.5px] leading-relaxed text-white/55">{status.copy}</p>

            <div className="mx-auto mt-6 flex max-w-[260px] items-center gap-4 rounded-2xl bg-white/[0.06] p-4 text-left ring-1 ring-white/10">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-lime text-ink">
                <span className="font-display text-[30px] font-bold leading-none tracking-[-0.04em]">{grade}</span>
              </div>
              <div>
                <p className="font-display text-[17px] font-semibold">{label}</p>
                <p className="text-[10.5px] text-white/45">Score {score} / 100</p>
                <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-lime" style={{ width: `${score}%` }} />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
              {[
                ['Months', `${game.month} / ${RUN_LENGTH}`],
                ['Valuation', money(game.valuation, { compact: true })],
                ['Cash', money(game.cash, { compact: true })],
                ['Equity left', `${game.founderEquity.toFixed(1)}%`],
                ['Customers', number(game.customers)],
                ['Team', number(game.team.length)],
                ['Raised', game.totalRaised ? money(game.totalRaised, { compact: true }) : '—'],
                ['Quality', `${Math.round(game.quality)} / 100`],
              ].map(([metric, value]) => (
                <div key={metric} className="rounded-xl bg-white/[0.06] px-3 py-2">
                  <p className="text-[9px] uppercase tracking-[0.1em] text-white/35">{metric}</p>
                  <p className="mt-0.5 font-display text-[14px] font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {history.length > 1 && (
              <div className="mt-4 rounded-xl bg-white/[0.05] px-3 pb-2 pt-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">Valuation over {game.month} months</p>
                  <p className="text-[10px] font-semibold text-lime">{money(game.valuation, { compact: true })}</p>
                </div>
                <Sparkline data={history} color="#c9f269" height={48} />
              </div>
            )}

            {game.achievements.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {game.achievements.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70">
                    <BadgeCheck className="size-3 text-lime" />
                    {ACHIEVEMENTS[id]?.label ?? id}
                  </span>
                ))}
              </div>
            )}

            {game.endedReason && (
              <p className="mx-auto mt-4 max-w-md text-[10.5px] leading-relaxed text-white/35">{game.endedReason}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 bg-white/[0.03] px-5 py-4 sm:flex-row sm:px-7">
          <button
            onClick={onReset}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-lime px-5 text-sm font-bold text-ink transition hover:brightness-[0.97]"
          >
            <RotateCcw className="size-4" />
            Start a new company
          </button>
          <button
            onClick={onShare}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/15 px-5 text-sm font-semibold text-white/75 transition hover:border-white/30 hover:text-white"
          >
            <Share2 className="size-4" />
            Share score
          </button>
          <button
            onClick={onReview}
            className="inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-white/45 transition hover:text-white"
          >
            Review city
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const items = [
    { icon: Store, title: 'Market Plaza', copy: 'Set price, marketing and product budget. Demand, churn and quality respond next month.' },
    { icon: Users, title: 'Talent Hub', copy: 'Hire for capacity, train for skill, promote when people earn it. Low morale loses them.' },
    { icon: Landmark, title: 'Meridian Bank', copy: 'Borrow against revenue when cash gets tight — then live with the interest.' },
    { icon: Handshake, title: 'Investor Row', copy: 'Open a round after month 3. Term sheets trade cash for equity and expectations.' },
    { icon: ShieldAlert, title: 'Crisis Ops', copy: 'Real shocks with no perfect answer. Your choice changes the numbers immediately.' },
    { icon: Building2, title: 'Headquarters', copy: 'The full company picture: cash history, achievements and every decision logged.' },
    { icon: Boxes, title: 'Supply Depot', copy: 'Pick a supplier and keep stock cover above one month. Stockouts cost sales, quality and reputation.' },
    { icon: Target, title: 'Sales Office', copy: 'Work deals from lead to contract. Discounts close faster; pushes cost cash for a better chance.' },
    { icon: MapPin, title: 'Expansion District', copy: 'Open new markets with upfront capex and monthly overhead. More demand, more strain.' },
    { icon: Compass, title: 'Climate', copy: 'Boom, slowdown and recession move demand, churn and valuations. Read the phase before you raise or expand.' },
  ]

  return (
    <Modal open={open} onClose={onClose} size="lg" title="How to run a company" description="One month at a time. No spreadsheets required.">
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ['1', 'Adjust', 'Move one or two levers: price, spend, stock, a hire, a loan.'],
            ['2', 'Close', 'End the month. Revenue, costs, churn, stock and quality resolve.'],
            ['3', 'Read', 'The report says what moved and why. Nova names the next constraint.'],
          ].map(([step, title, copy]) => (
            <div key={step} className="rounded-2xl bg-paper-3/70 p-3.5">
              <span className="grid size-6 place-items-center rounded-full bg-ink text-[10px] font-bold text-lime">{step}</span>
              <p className="mt-2 text-[12px] font-bold text-ink">{title}</p>
              <p className="mt-0.5 text-[10.5px] leading-snug text-ink-500">{copy}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.title} className="flex items-start gap-2.5 rounded-xl border border-line bg-white p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-paper-3 text-ink-600">
                <item.icon className="size-3.5" />
              </span>
              <div>
                <p className="text-[11.5px] font-bold text-ink">{item.title}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-ink-500">{item.copy}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2.5 rounded-2xl bg-gold-soft/40 p-3.5">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-[#9a6b12]" />
          <p className="text-[11px] leading-relaxed text-ink-700">
            There is no single win condition. The score blends valuation, revenue, reputation, quality and equity kept.
            A small, profitable company you own can beat a large one you sold.
          </p>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-sm font-semibold text-white transition hover:bg-ink-800"
          >
            Back to the city
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function ResetModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Archive this run?"
      description="Your current company moves to the archive. Nothing is deleted."
    >
      <div className="flex items-start gap-2.5 rounded-xl bg-gold-soft/40 p-3">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-[#9a6b12]" />
        <p className="text-[11px] leading-relaxed text-ink-700">
          You will start a fresh company. This run stays saved in this browser so you can reopen it later.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={onClose}
          className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-white text-sm font-semibold text-ink-600 transition hover:bg-paper-3"
        >
          Keep running
        </button>
        <button
          onClick={onConfirm}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-ink-800"
        >
          <RotateCcw className="size-4" />
          Archive & restart
        </button>
      </div>
    </Modal>
  )
}

export function Toast({ toast, onClear }: { toast: { id: string; message: string; tone: 'good' | 'bad' | 'neutral' } | null; onClear: () => void }) {
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(onClear, 3200)
    return () => window.clearTimeout(timer)
  }, [toast, onClear])

  if (!toast) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-4 lg:bottom-8">
      <div
        className={clsx(
          'animate-rise pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-semibold shadow-float ring-1',
          toast.tone === 'good' && 'bg-brand-700 text-white ring-brand-800/20',
          toast.tone === 'bad' && 'bg-coral text-white ring-coral/30',
          toast.tone === 'neutral' && 'bg-ink text-white ring-white/10',
        )}
      >
        {toast.tone === 'good' ? (
          <BadgeCheck className="size-4" />
        ) : toast.tone === 'bad' ? (
          <ShieldAlert className="size-4" />
        ) : (
          <Banknote className="size-4" />
        )}
        {toast.message}
        <button onClick={onClear} aria-label="Dismiss" className="ml-1 opacity-60 transition hover:opacity-100">
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export function shareText(game: GameState) {
  const score = performanceScore(game)
  const { grade } = getGrade(score)
  return `I ran ${game.company} for ${game.month} months on BUSINESSLIFE — grade ${grade} (${score}/100), ${money(
    game.valuation,
    { compact: true },
  )} valuation, ${percent(game.founderEquity / 100)} equity kept.`
}
