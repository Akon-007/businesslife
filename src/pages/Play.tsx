import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  Building2,
  ChevronRight,
  CircleHelp,
  Compass,
  Handshake,
  Landmark,
  MapPin,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { CityMap, type PinBadge } from '../components/city/CityMap'
import type { LandmarkId } from '../components/city/CityScene'
import { Logo, LogoMark } from '../components/ui/Logo'
import { Sparkline } from '../components/ui/Charts'
import { Onboarding } from '../components/game/Onboarding'
import { Drawer, type PanelId } from '../components/game/Drawer'
import {
  CrisisModal,
  HelpModal,
  ReportModal,
  ResetModal,
  RunEndModal,
  Toast,
  shareText,
} from '../components/game/modals'
import { Stat } from '../components/game/bits'
import { useGame } from '../game/store'
import { buildInsights, getMetrics, RUN_LENGTH } from '../game/engine'
import { ECONOMY_COPY, industryById, strategyById } from '../game/data'
import type { CrisisOption, GameMetrics, GameState } from '../game/types'
import { money, monthLabel, number, percent } from '../lib/format'

const PANEL_FROM_LANDMARK: Record<LandmarkId, PanelId> = {
  hq: 'company',
  market: 'market',
  talent: 'talent',
  bank: 'bank',
  investors: 'investors',
  crisis: 'crisis',
  suppliers: 'suppliers',
  expansion: 'expansion',
}

const LANDMARK_FROM_PANEL: Partial<Record<PanelId, LandmarkId>> = {
  company: 'hq',
  market: 'market',
  talent: 'talent',
  bank: 'bank',
  investors: 'investors',
  crisis: 'crisis',
  suppliers: 'suppliers',
  expansion: 'expansion',
}

const QUICK_ACTIONS: { panel: PanelId; label: string; icon: LucideIcon }[] = [
  { panel: 'market', label: 'Plan', icon: SlidersHorizontal },
  { panel: 'suppliers', label: 'Supply', icon: Boxes },
  { panel: 'sales', label: 'Sales', icon: Target },
  { panel: 'expansion', label: 'Expand', icon: MapPin },
  { panel: 'talent', label: 'Team', icon: Users },
  { panel: 'bank', label: 'Bank', icon: Landmark },
  { panel: 'investors', label: 'Raise', icon: Handshake },
  { panel: 'crisis', label: 'Crisis', icon: ShieldAlert },
  { panel: 'nova', label: 'Nova', icon: Compass },
]

const DESKTOP_ACTIONS = new Set<PanelId>(['market', 'talent', 'bank', 'investors'])

const TUTORIAL_STEPS: { title: string; body: string; action: string; panel: PanelId | null; icon: LucideIcon }[] = [
  {
    title: 'Set the plan first',
    body: 'Price, marketing and product budget decide who walks in. Set them before you spend a month.',
    action: 'Open plan',
    panel: 'market',
    icon: SlidersHorizontal,
  },
  {
    title: 'Close the month',
    body: 'Nothing moves until you close the month. That is when the invoice arrives and the report tells you why.',
    action: 'Close month',
    panel: null,
    icon: ArrowRight,
  },
  {
    title: 'Ask Nova what matters',
    body: 'Nova reads your numbers and points at the decision that will change next month.',
    action: 'Open Nova',
    panel: 'nova',
    icon: Compass,
  },
]

function readTutorialStep() {
  try {
    const raw = window.localStorage.getItem('businesslife.tutorial')
    const step = raw ? Number(raw) : 0
    return Number.isFinite(step) ? Math.min(Math.max(step, 0), TUTORIAL_STEPS.length) : 0
  } catch {
    return 0
  }
}

export default function Play() {
  const game = useGame((state) => state.game)
  if (!game) return <Onboarding />
  return <GameBoard game={game} />
}

function GameBoard({ game }: { game: GameState }) {
  const advance = useGame((state) => state.advance)
  const reset = useGame((state) => state.reset)
  const resolve = useGame((state) => state.resolve)
  const dismissReport = useGame((state) => state.dismissReport)
  const notify = useGame((state) => state.notify)
  const toast = useGame((state) => state.toast)
  const clearToast = useGame((state) => state.clearToast)

  const [panel, setPanel] = useState<PanelId | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(true)
  const [tutorialStep, setTutorialStep] = useState(readTutorialStep)
  const [crisisView, setCrisisView] = useState<{ crisis: NonNullable<GameState['pendingCrisis']>; choice: CrisisOption | null } | null>(
    null,
  )

  const advanceTutorial = (step: number) => {
    setTutorialStep(step)
    try {
      window.localStorage.setItem('businesslife.tutorial', String(step))
    } catch {
      // storage can be unavailable in private mode
    }
  }

  const metrics = getMetrics(game)
  const insights = buildInsights(game)
  const runEnded = game.status !== 'active'
  const industry = industryById(game.industry)
  const openBranchCount = (game.branches ?? []).filter((branch) => branch.openedMonth !== null).length

  useEffect(() => {
    if (game.pendingCrisis && !game.lastReport && !crisisView) {
      setCrisisView({ crisis: game.pendingCrisis, choice: null })
    }
  }, [game.pendingCrisis, game.lastReport, crisisView])

  const closeMonth = () => {
    setPanel(null)
    advance()
  }

  const chooseCrisis = (option: CrisisOption) => {
    resolve(option.id)
    setCrisisView((view) => (view ? { ...view, choice: option } : view))
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText(game))
      notify('Score copied — go make someone feel it.', 'good')
    } catch {
      notify('Could not copy the score in this browser.', 'bad')
    }
  }

  const badges: Partial<Record<LandmarkId, PinBadge>> = {
    hq: { label: money(game.valuation, { compact: true }), tone: 'info' },
    market: { label: number(game.customers), tone: 'info' },
    talent: { label: `${game.team.length}`, tone: game.team.length > 0 ? 'good' : 'warn' },
    bank: { label: game.debt > 0 ? money(game.debt, { compact: true }) : 'clear', tone: game.debt > 0 ? 'warn' : 'good' },
    investors: {
      label: game.offers.length > 0 ? 'Offers' : `${Math.round(game.founderEquity)}%`,
      tone: game.offers.length > 0 ? 'good' : 'info',
    },
    crisis: { label: game.pendingCrisis ? 'Act now' : 'calm', tone: game.pendingCrisis ? 'bad' : 'good' },
    suppliers: industry.inventory
      ? {
          label: `${metrics.inventoryCover.toFixed(1)}mo`,
          tone: metrics.inventoryCover < 0.8 ? 'bad' : metrics.inventoryCover < 1.4 ? 'warn' : 'good',
        }
      : {
          label: percent(metrics.supplyRisk, 0),
          tone: metrics.supplyRisk > 0.55 ? 'bad' : metrics.supplyRisk > 0.35 ? 'warn' : 'good',
        },
    expansion: {
      label: openBranchCount > 0 ? `${openBranchCount} open` : 'Expand',
      tone: openBranchCount > 0 ? 'good' : 'info',
    },
  }

  return (
    <div className="min-h-[100svh] bg-paper lg:flex lg:h-[100svh] lg:flex-col lg:overflow-hidden">
      <TopBar game={game} metrics={metrics} onHelp={() => setHelpOpen(true)} onReset={() => setResetOpen(true)} />

      <div className="relative h-[46svh] min-h-[340px] shrink-0 overflow-hidden bg-sky lg:h-auto lg:min-h-0 lg:flex-1">
        <CityMap
          className="absolute inset-0 h-full w-full"
          variant="game"
          activeId={panel ? LANDMARK_FROM_PANEL[panel] ?? null : null}
          onSelect={(id) => setPanel(PANEL_FROM_LANDMARK[id])}
          badges={badges}
          showLabels={false}
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink/15 to-transparent" />

        <div className="absolute left-4 top-4 z-30 hidden w-[300px] flex-col gap-3 lg:flex">
          <ObjectiveCard game={game} metrics={metrics} />
          <CompanySnapshot game={game} metrics={metrics} onNavigate={setPanel} />
        </div>

        <div className="absolute bottom-4 right-4 z-30 hidden w-[300px] xl:block">
          <NovaCard insight={insights[0]} onOpen={() => setPanel('nova')} metrics={metrics} />
        </div>

        <MapDock
          month={game.month}
          disabled={!!game.pendingCrisis}
          ended={runEnded}
          onAdvance={closeMonth}
          onNavigate={setPanel}
          onReview={() => setEndOpen(true)}
          pending={!!game.pendingCrisis}
        />

        {tutorialStep < TUTORIAL_STEPS.length && !runEnded && !game.pendingCrisis && (
          <div className="absolute bottom-3 left-3 right-3 z-30 lg:bottom-24 lg:left-1/2 lg:right-auto lg:w-[380px] lg:-translate-x-1/2">
            <TutorialCard
              step={tutorialStep}
              onAction={() => {
                const current = TUTORIAL_STEPS[tutorialStep]
                advanceTutorial(tutorialStep + 1)
                if (current.panel) setPanel(current.panel)
                else closeMonth()
              }}
              onSkip={() => advanceTutorial(TUTORIAL_STEPS.length)}
            />
          </div>
        )}

        {runEnded && !endOpen && (
          <div className="absolute inset-x-3 bottom-3 z-30 flex justify-center lg:bottom-24">
            <button
              onClick={() => setEndOpen(true)}
              className="glass-strong inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-bold text-ink shadow-soft"
            >
              <Trophy className="size-3.5 text-[#9a6b12]" />
              Run ended · view scorecard
              <ChevronRight className="size-3.5 text-ink-400" />
            </button>
          </div>
        )}
      </div>

      <MobileSummary game={game} metrics={metrics} insights={insights} onNavigate={setPanel} onHelp={() => setHelpOpen(true)} />

      <MobileDock
        month={game.month}
        pending={!!game.pendingCrisis}
        ended={runEnded}
        onAdvance={closeMonth}
        onNavigate={setPanel}
        onReview={() => setEndOpen(true)}
      />

      <Drawer panel={panel} onClose={() => setPanel(null)} onNavigate={setPanel} />

      <ReportModal report={game.lastReport} game={game} onClose={dismissReport} />

      <CrisisModal
        crisis={crisisView?.crisis ?? null}
        choice={crisisView?.choice ?? null}
        onChoose={chooseCrisis}
        onContinue={() => setCrisisView(null)}
      />

      {runEnded && endOpen && !game.lastReport && !crisisView && (
        <RunEndModal
          game={game}
          onReset={reset}
          onShare={handleShare}
          onReview={() => setEndOpen(false)}
        />
      )}

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ResetModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          setResetOpen(false)
          reset()
        }}
      />
      <Toast toast={toast} onClear={clearToast} />
    </div>
  )
}

function TutorialCard({ step, onAction, onSkip }: { step: number; onAction: () => void; onSkip: () => void }) {
  const current = TUTORIAL_STEPS[step]
  const Icon = current.icon

  return (
    <div className="glass-strong rounded-2xl px-3.5 py-3 shadow-soft">
      <div className="flex items-start gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-lime">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
            First run · {step + 1} of {TUTORIAL_STEPS.length}
          </p>
          <p className="mt-0.5 text-[12px] font-bold leading-tight text-ink">{current.title}</p>
          <p className="mt-1 text-[10.5px] leading-snug text-ink-500">{current.body}</p>
        </div>
        <button onClick={onSkip} aria-label="Skip tutorial" className="shrink-0 text-ink-300 transition hover:text-ink">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 pl-[42px]">
        <span className="flex items-center gap-1">
          {TUTORIAL_STEPS.map((item, index) => (
            <span
              key={item.title}
              className={clsx('h-1 w-4 rounded-full transition-colors', index <= step ? 'bg-brand-600' : 'bg-ink/15')}
            />
          ))}
        </span>
        <button onClick={onAction} className="rounded-full bg-ink px-3 py-1.5 text-[10.5px] font-bold text-white">
          {current.action}
        </button>
      </div>
    </div>
  )
}

function TopBar({
  game,
  metrics,
  onHelp,
  onReset,
}: {
  game: GameState
  metrics: GameMetrics
  onHelp: () => void
  onReset: () => void
}) {
  const industry = industryById(game.industry)
  const strategy = strategyById(game.strategy)
  const runway = metrics.runway >= 99 ? '∞' : metrics.runway.toFixed(1)
  const runwayTone = metrics.runway >= 6 ? 'good' : metrics.runway >= 3 ? 'warn' : 'bad'
  const climateTone =
    game.economy.phase === 'boom' ? 'good' : game.economy.phase === 'steady' ? undefined : game.economy.phase === 'slowdown' ? 'warn' : 'bad'

  return (
    <header className="sticky top-0 z-40 shrink-0 bg-ink-950 text-white lg:relative">
      <div className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4">
        <Link to="/" aria-label="BUSINESSLIFE home" className="shrink-0">
          <span className="hidden sm:inline-flex">
            <Logo dark />
          </span>
          <span className="inline-flex sm:hidden">
            <LogoMark dark className="size-9" />
          </span>
        </Link>
        <span className="hidden h-8 w-px bg-white/10 sm:block" />

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[14px] font-semibold leading-tight sm:text-[15px]">{game.company}</p>
          <p className="truncate text-[9.5px] text-white/40">
            {industry.name} · {strategy.name}
          </p>
        </div>

        <div className="hidden items-center gap-1.5 md:flex">
          <HudPill label="Cash" value={money(game.cash, { compact: true })} />
          <HudPill label="MRR" value={money(metrics.mrr, { compact: true })} />
          <HudPill label="Value" value={money(game.valuation, { compact: true })} />
          <HudPill label="Runway" value={`${runway} mo`} tone={runwayTone} />
          <div className="hidden xl:block">
            <HudPill label="Climate" value={game.economy.label} tone={climateTone} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-center">
            <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">Month</p>
            <p className="text-[11px] font-bold leading-tight tabular-nums">
              {Math.min(game.month + 1, RUN_LENGTH)}
              <span className="text-white/35">/{RUN_LENGTH}</span>
            </p>
          </div>
          <button
            onClick={onHelp}
            aria-label="How to play"
            className="grid size-8 place-items-center rounded-full bg-white/[0.07] text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            <CircleHelp className="size-4" />
          </button>
          <button
            onClick={onReset}
            aria-label="Start over"
            className="grid size-8 place-items-center rounded-full bg-white/[0.07] text-white/70 transition hover:bg-white/15 hover:text-white"
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto border-t border-white/[0.06] px-3 py-1.5 md:hidden">
        <HudChip label="Cash" value={money(game.cash, { compact: true })} />
        <HudChip label="MRR" value={money(metrics.mrr, { compact: true })} />
        <HudChip label="Value" value={money(game.valuation, { compact: true })} />
        <HudChip label="Runway" value={`${runway}mo`} tone={runwayTone} />
        <HudChip label="Climate" value={game.economy.label} tone={climateTone} />
        <HudChip label="Customers" value={number(game.customers)} />
        <HudChip label="Team" value={number(game.team.length)} />
      </div>
    </header>
  )
}

function HudPill({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="rounded-xl bg-white/[0.06] px-2.5 py-1.5">
      <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-white/35">{label}</p>
      <p
        className={clsx(
          'text-[11.5px] font-bold leading-tight tabular-nums',
          tone === 'good' && 'text-lime',
          tone === 'warn' && 'text-gold',
          tone === 'bad' && 'text-coral',
          !tone && 'text-white',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function HudChip({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <div className="flex shrink-0 items-baseline gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1">
      <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-white/35">{label}</span>
      <span
        className={clsx(
          'text-[10.5px] font-bold tabular-nums',
          tone === 'good' && 'text-lime',
          tone === 'warn' && 'text-gold',
          tone === 'bad' && 'text-coral',
          !tone && 'text-white/90',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function ObjectiveCard({ game, metrics }: { game: GameState; metrics: GameMetrics }) {
  const progress = Math.min(100, (game.month / RUN_LENGTH) * 100)
  const runway = metrics.runway >= 99 ? 'Positive' : `${metrics.runway.toFixed(1)} months`

  return (
    <div className="glass-strong rounded-2xl p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-ink-400">Meridian City</p>
          <p className="mt-0.5 font-display text-[17px] font-semibold leading-tight text-ink">
            Month {Math.min(game.month + 1, RUN_LENGTH)}
            <span className="text-[12px] font-medium text-ink-400"> of {RUN_LENGTH}</span>
          </p>
        </div>
        <span className="rounded-full bg-ink px-2 py-1 text-[9px] font-bold text-lime">{monthLabel(game.month)}</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink/10">
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-700" style={{ width: `${Math.max(2, progress)}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/70 px-2.5 py-1.5">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-400">Runway</p>
          <p className={clsx('text-[12px] font-bold', metrics.runway >= 6 ? 'text-brand-700' : metrics.runway >= 3 ? 'text-[#9a6b12]' : 'text-coral')}>
            {runway}
          </p>
        </div>
        <div className="rounded-lg bg-white/70 px-2.5 py-1.5">
          <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-400">Cash</p>
          <p className="text-[12px] font-bold text-ink">{money(game.cash, { compact: true })}</p>
        </div>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[9.5px] leading-snug text-ink-400">
        <SliderHint />
        Tap a landmark or use the dock to act.
      </p>
    </div>
  )
}

function SliderHint() {
  return <span className="inline-block size-1.5 shrink-0 rounded-full bg-brand-500" />
}

function CompanySnapshot({
  game,
  metrics,
  onNavigate,
}: {
  game: GameState
  metrics: GameMetrics
  onNavigate: (panel: PanelId) => void
}) {
  const industry = industryById(game.industry)

  return (
    <div className="glass-strong rounded-2xl p-3.5">
      <button onClick={() => onNavigate('company')} className="flex w-full items-center justify-between gap-2 text-left">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink text-lime">
            <Building2 className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[8.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Your company</p>
            <p className="truncate text-[12px] font-bold text-ink">{game.company}</p>
          </div>
        </div>
        <ArrowUpRight className="size-3.5 shrink-0 text-ink-300" />
      </button>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        <MiniStat label={industry.customerNounPlural} value={number(game.customers)} />
        <MiniStat label="Team" value={number(game.team.length)} />
        <MiniStat label="Reputation" value={`${Math.round(game.reputation)}/100`} />
        <MiniStat label="Quality" value={`${Math.round(game.quality)}/100`} />
      </div>

      <button
        onClick={() => onNavigate('market')}
        className="mt-3 flex w-full items-center justify-between gap-2 border-t border-ink/10 pt-2.5 text-left"
      >
        <span className="min-w-0 truncate text-[10px] text-ink-500">
          {money(game.price)} price · {money(game.marketingSpend, { compact: true })} mkt ·{' '}
          {money(game.productSpend, { compact: true })} product
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[9.5px] font-bold text-brand-700">
          Edit
          <ChevronRight className="size-3" />
        </span>
      </button>
      <div className="mt-2 flex items-center justify-between text-[9px] text-ink-400">
        <span>Payroll {money(metrics.payroll, { compact: true })}/mo</span>
        <span>Churn {percent(metrics.churnRate, 1)}</span>
      </div>
    </div>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-400">{label}</p>
      <p className="text-[12px] font-bold tabular-nums text-ink">{value}</p>
    </div>
  )
}

function NovaCard({
  insight,
  onOpen,
  metrics,
}: {
  insight: string
  onOpen: () => void
  metrics: GameMetrics
}) {
  return (
    <button onClick={onOpen} className="glass-strong w-full rounded-2xl p-3.5 text-left transition hover:-translate-y-0.5">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-full bg-ink text-lime">
          <Compass className="size-3.5" />
        </span>
        <div>
          <p className="text-[11.5px] font-bold text-ink">Nova</p>
          <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-400">AI chief of staff</p>
        </div>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[8px] font-bold text-brand-700">
          <span className="size-1 rounded-full bg-brand-500 blink" />
          LIVE
        </span>
      </div>
      <p className="mt-2.5 text-[11px] leading-relaxed text-ink-600">{insight}</p>
      <div className="mt-2.5 flex items-center justify-between border-t border-ink/10 pt-2 text-[9px] font-semibold text-ink-400">
        <span>
          Churn {percent(metrics.churnRate, 1)} · runway{' '}
          {metrics.runway >= 99 ? 'positive' : `${metrics.runway.toFixed(1)}mo`}
        </span>
        <span className="flex items-center gap-0.5 font-bold text-brand-700">
          Ask Nova
          <ChevronRight className="size-3" />
        </span>
      </div>
    </button>
  )
}

function MapDock({
  month,
  disabled,
  pending,
  ended,
  onAdvance,
  onReview,
  onNavigate,
}: {
  month: number
  disabled: boolean
  pending: boolean
  ended: boolean
  onAdvance: () => void
  onReview: () => void
  onNavigate: (panel: PanelId) => void
}) {
  return (
    <div className="glass-strong absolute bottom-4 left-1/2 z-30 hidden -translate-x-1/2 items-center gap-1 rounded-full p-1.5 pl-2 lg:flex">
      {QUICK_ACTIONS.filter((action) => DESKTOP_ACTIONS.has(action.panel)).map((action) => (
        <button
          key={action.panel}
          onClick={() => onNavigate(action.panel)}
          className="group flex items-center gap-1.5 rounded-full px-2.5 py-2 text-[11px] font-semibold text-ink-600 transition hover:bg-ink/[0.06] hover:text-ink"
        >
          <action.icon className="size-3.5 text-ink-400 transition group-hover:text-brand-700" />
          {action.label}
        </button>
      ))}
      <span className="mx-1 h-6 w-px bg-ink/10" />
      {ended ? (
        <button
          onClick={onReview}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[12.5px] font-bold text-lime transition hover:bg-ink-800"
        >
          <Trophy className="size-3.5" />
          View scorecard
        </button>
      ) : (
        <button
          onClick={onAdvance}
          disabled={disabled}
          className={clsx(
            'inline-flex h-10 items-center gap-2 rounded-full px-5 text-[12.5px] font-bold transition',
            pending ? 'bg-coral/15 text-[#9c3426]' : 'bg-brand-600 text-white hover:bg-brand-700',
          )}
        >
          {pending ? 'Crisis waiting' : `Close month ${month + 1}`}
          <ArrowRight className="size-3.5" />
        </button>
      )}
      <button
        onClick={() => onNavigate('nova')}
        aria-label="Ask Nova"
        className="grid size-10 place-items-center rounded-full bg-ink text-lime transition hover:bg-ink-800"
      >
        <Compass className="size-4" />
      </button>
    </div>
  )
}

function MobileDock({
  month,
  pending,
  ended,
  onAdvance,
  onReview,
  onNavigate,
}: {
  month: number
  pending: boolean
  ended: boolean
  onAdvance: () => void
  onReview: () => void
  onNavigate: (panel: PanelId) => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-2/95 pb-[max(env(safe-area-inset-bottom),0.6rem)] pt-2 backdrop-blur lg:hidden">
      <div className="flex items-center gap-2 px-3">
        <div className="no-scrollbar flex flex-1 items-center gap-0.5 overflow-x-auto">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.panel}
              onClick={() => onNavigate(action.panel)}
              className="flex min-w-[50px] flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-ink-500 transition active:bg-ink/5"
            >
              <action.icon className={clsx('size-4', action.panel === 'crisis' && pending ? 'text-coral' : 'text-ink-600')} />
              <span className="text-[8.5px] font-bold">{action.label}</span>
            </button>
          ))}
        </div>
        {ended ? (
          <button
            onClick={onReview}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[12px] font-bold text-lime"
          >
            <Trophy className="size-3.5" />
            Scorecard
          </button>
        ) : (
          <button
            onClick={onAdvance}
            disabled={pending}
            className={clsx(
              'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[12px] font-bold shadow-[0_10px_24px_-12px_rgba(9,107,65,0.6)]',
              pending ? 'bg-coral/15 text-[#9c3426]' : 'bg-brand-600 text-white',
            )}
          >
            {pending ? 'Crisis' : `Close M${month + 1}`}
            <ArrowRight className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function MobileSummary({
  game,
  metrics,
  insights,
  onNavigate,
  onHelp,
}: {
  game: GameState
  metrics: GameMetrics
  insights: string[]
  onNavigate: (panel: PanelId) => void
  onHelp: () => void
}) {
  const cashHistory = game.history.map((snapshot) => snapshot.cash)
  const industry = industryById(game.industry)
  const openMarketCount = (game.branches ?? []).filter((branch) => branch.openedMonth !== null).length

  return (
    <div className="bg-paper px-4 pb-28 pt-4 lg:hidden">
      <div className="mx-auto max-w-xl space-y-3">
        <ObjectiveCard game={game} metrics={metrics} />

        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-ink-400">Your company</p>
              <p className="mt-0.5 font-display text-[18px] font-semibold leading-tight text-ink">{game.company}</p>
              <p className="text-[10.5px] text-ink-500">
                {industry.name} · {strategyById(game.strategy).name}
              </p>
            </div>
            <button
              onClick={() => onNavigate('company')}
              className="flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-[10px] font-bold text-white"
            >
              HQ
              <ChevronRight className="size-3" />
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label={industry.customerNounPlural} value={number(game.customers)} />
            <Stat label="Team" value={number(game.team.length)} sub={`${money(metrics.payroll, { compact: true })} payroll`} />
            <Stat label="Reputation" value={`${Math.round(game.reputation)}/100`} tone={game.reputation >= 65 ? 'good' : 'neutral'} />
            <Stat label="Quality" value={`${Math.round(game.quality)}/100`} tone={game.quality >= 60 ? 'good' : game.quality >= 40 ? 'warn' : 'bad'} />
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-paper-3/70 px-3 py-2">
            <div>
              <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-400">Monthly plan</p>
              <p className="text-[10.5px] font-semibold text-ink">
                {money(game.price)} · {money(game.marketingSpend, { compact: true })} mkt ·{' '}
                {money(game.productSpend, { compact: true })} product
              </p>
            </div>
            <button
              onClick={() => onNavigate('market')}
              className="inline-flex items-center gap-0.5 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-bold text-brand-700 ring-1 ring-line"
            >
              Edit
              <ChevronRight className="size-3" />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span
              className="rounded-full bg-paper-3 px-2.5 py-1 text-[9.5px] font-semibold text-ink-500"
              title={ECONOMY_COPY[game.economy.phase].blurb}
            >
              Climate <b className="text-ink">{game.economy.label}</b>
            </span>
            {industry.inventory && (
              <button
                onClick={() => onNavigate('suppliers')}
                className="rounded-full bg-paper-3 px-2.5 py-1 text-[9.5px] font-semibold text-ink-500"
              >
                Stock <b className="text-ink">{metrics.inventoryCover.toFixed(1)} mo</b>
              </button>
            )}
            <button
              onClick={() => onNavigate('sales')}
              className="rounded-full bg-paper-3 px-2.5 py-1 text-[9.5px] font-semibold text-ink-500"
            >
              Pipeline <b className="text-ink">{money(metrics.pipelineValue, { compact: true })}</b>
            </button>
            {openMarketCount > 0 && (
              <button
                onClick={() => onNavigate('expansion')}
                className="rounded-full bg-brand-50 px-2.5 py-1 text-[9.5px] font-semibold text-brand-700"
              >
                {openMarketCount} markets open
              </button>
            )}
          </div>
        </div>

        <NovaCard insight={insights[0]} onOpen={() => onNavigate('nova')} metrics={metrics} />

        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-ink-400">Cash trajectory</p>
              <p className="mt-0.5 font-display text-[18px] font-semibold text-ink">{money(game.cash)}</p>
            </div>
            <span
              className={clsx(
                'rounded-full px-2.5 py-1 text-[9.5px] font-bold',
                metrics.runway >= 6 ? 'bg-brand-50 text-brand-700' : metrics.runway >= 3 ? 'bg-gold-soft text-ink-700' : 'bg-coral/10 text-[#9c3426]',
              )}
            >
              {metrics.runway >= 99 ? 'Cash positive' : `${metrics.runway.toFixed(1)} mo runway`}
            </span>
          </div>
          <div className="mt-2">
            <Sparkline data={cashHistory.length > 1 ? cashHistory : [game.cash * 0.92, game.cash]} height={54} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              ['MRR', money(metrics.mrr, { compact: true })],
              ['Costs', money(metrics.monthlyCosts, { compact: true })],
              ['Churn', percent(metrics.churnRate, 1)],
            ].map(([label, value]) => (
              <span key={label} className="rounded-full bg-paper-3 px-2.5 py-1 text-[9.5px] font-semibold text-ink-500">
                {label} <b className="text-ink">{value}</b>
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-ink-400">Recent decisions</p>
            <button
              onClick={() => onNavigate('company')}
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-700"
            >
              Full log
              <ChevronRight className="size-3" />
            </button>
          </div>
          <ol className="mt-3 space-y-2.5">
            {game.log.slice(0, 4).map((entry) => (
              <li key={entry.id} className="flex gap-2.5">
                <span
                  className={clsx(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    entry.tone === 'good' ? 'bg-brand-500' : entry.tone === 'bad' ? 'bg-coral' : 'bg-ink-300',
                  )}
                />
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold leading-snug text-ink">{entry.title}</p>
                  {entry.detail && <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-ink-500">{entry.detail}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <BadgeCheck className="size-4 text-brand-600" />
            <p className="text-[11px] font-semibold text-ink-600">Need the rules?</p>
          </div>
          <button onClick={onHelp} className="text-[10.5px] font-bold text-brand-700">
            How to play →
          </button>
        </div>

        <p className="pb-2 text-center text-[9.5px] text-ink-300">
          Every decision is saved in this browser. Meridian City is fictional.
        </p>
      </div>
    </div>
  )
}
