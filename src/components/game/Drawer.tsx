import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Boxes,
  Building2,
  Check,
  ClipboardCheck,
  Code2,
  Coins,
  Compass,
  Handshake,
  Landmark,
  Lightbulb,
  MapPin,
  Megaphone,
  Palette,
  RefreshCcw,
  ShieldAlert,
  Store,
  Target,
  TrendingUp,
  UserMinus,
  Users,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { useGame } from '../../game/store'
import {
  buildInsights,
  estimateChurn,
  getMetrics,
  maxLoan,
  newCustomersEstimate,
  performanceScore,
} from '../../game/engine'
import {
  ACHIEVEMENTS,
  ECONOMY_COPY,
  difficultyById,
  founderBackgroundById,
  industryById,
  roleById,
  strategyById,
} from '../../game/data'
import type { Employee, GameState, RoleId } from '../../game/types'
import { money, monthLabel, number, percent } from '../../lib/format'
import { Sparkline } from '../ui/Charts'
import { PanelSection, RangeRow, Stat } from './bits'

export type PanelId =
  | 'company'
  | 'market'
  | 'talent'
  | 'bank'
  | 'investors'
  | 'crisis'
  | 'nova'
  | 'suppliers'
  | 'sales'
  | 'expansion'

export const PANEL_META: Record<PanelId, { title: string; kicker: string; description: string; icon: LucideIcon; color: string }> = {
  company: {
    title: 'Headquarters',
    kicker: 'Company',
    description: 'The whole story: cash, valuation, plan and every decision you have made.',
    icon: Building2,
    color: '#0b8550',
  },
  market: {
    title: 'Market Plaza',
    kicker: 'Customers',
    description: 'Set price and budgets, then watch the demand and churn forecast move.',
    icon: Store,
    color: '#e05a3f',
  },
  talent: {
    title: 'Talent Hub',
    kicker: 'Team',
    description: 'Every hire buys capacity and costs runway. Choose carefully.',
    icon: Users,
    color: '#7c6cf6',
  },
  bank: {
    title: 'Meridian Bank',
    kicker: 'Credit',
    description: 'Borrow against the business, or repay debt and buy back your freedom.',
    icon: Landmark,
    color: '#b07a1e',
  },
  investors: {
    title: 'Investor Row',
    kicker: 'Funding',
    description: 'Open a round, read the term sheets and decide how much equity to sell.',
    icon: Handshake,
    color: '#2f80c7',
  },
  crisis: {
    title: 'Crisis Ops',
    kicker: 'Risk',
    description: 'The crises you survived, and the ones still waiting for an answer.',
    icon: ShieldAlert,
    color: '#e05a3f',
  },
  nova: {
    title: 'Nova',
    kicker: 'AI advisor',
    description: 'A coaching layer over your numbers. Plain English, no financial advice.',
    icon: Compass,
    color: '#0b8550',
  },
  suppliers: {
    title: 'Supply Depot',
    kicker: 'Operations',
    description: 'Choose who you buy from, how much cover to hold, and what a stockout costs.',
    icon: Boxes,
    color: '#0b8550',
  },
  sales: {
    title: 'Sales Office',
    kicker: 'Pipeline',
    description: 'Leads become qualified, then negotiated. Push the deals worth closing.',
    icon: Target,
    color: '#2f80c7',
  },
  expansion: {
    title: 'Expansion District',
    kicker: 'Growth',
    description: 'Open a second market. Capex and overhead today, demand tomorrow.',
    icon: MapPin,
    color: '#c4811a',
  },
}

const ROLE_ICONS: Record<RoleId, LucideIcon> = {
  engineer: Code2,
  designer: Palette,
  sales: TrendingUp,
  marketer: Megaphone,
  ops: ClipboardCheck,
}

export function Drawer({
  panel,
  onClose,
  onNavigate,
}: {
  panel: PanelId | null
  onClose: () => void
  onNavigate: (panel: PanelId) => void
}) {
  const meta = panel ? PANEL_META[panel] : null
  const game = useGame((state) => state.game)
  const ended = !!game && game.status !== 'active'

  return (
    <AnimatePresence>
      {panel && meta && (
        <div className="fixed inset-0 z-[70]">
          <motion.button
            type="button"
            aria-label="Close panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink-950/45 backdrop-blur-[3px]"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={meta.title}
            initial={{ x: 56, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 48, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col bg-paper-2 shadow-[-30px_0_80px_-30px_rgba(6,19,31,0.5)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-line bg-white px-5 py-4">
              <div className="flex items-start gap-3">
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-2xl text-white shadow-sm"
                  style={{ background: meta.color }}
                >
                  <meta.icon className="size-[18px]" />
                </span>
                <div>
                  <p className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-ink-400">{meta.kicker}</p>
                  <h2 className="font-display text-[21px] font-semibold leading-tight tracking-[-0.03em] text-ink">
                    {meta.title}
                  </h2>
                  <p className="mt-0.5 max-w-[280px] text-[11px] leading-snug text-ink-500">{meta.description}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/5 text-ink-600 transition hover:bg-ink/10"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {ended && (
                <p className="rounded-xl bg-gold-soft/50 px-3 py-2 text-[10.5px] font-semibold leading-relaxed text-ink-700 ring-1 ring-gold/30">
                  The run is over. This is a read-only recap — start a new company to make new decisions.
                </p>
              )}
              {panel === 'company' && <CompanyPanel onNavigate={onNavigate} />}
              {panel === 'market' && <MarketPanel onClose={onClose} onNavigate={onNavigate} />}
              {panel === 'talent' && <TalentPanel />}
              {panel === 'bank' && <BankPanel />}
              {panel === 'investors' && <InvestorsPanel />}
              {panel === 'crisis' && <CrisisPanel />}
              {panel === 'nova' && <NovaPanel onNavigate={onNavigate} />}
              {panel === 'suppliers' && <SupplierPanel />}
              {panel === 'sales' && <SalesPanel />}
              {panel === 'expansion' && <ExpansionPanel onNavigate={onNavigate} />}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}

function useCurrentGame(): GameState {
  return useGame((state) => state.game)!
}

function CompanyPanel({ onNavigate }: { onNavigate: (panel: PanelId) => void }) {
  const game = useCurrentGame()
  const industry = industryById(game.industry)
  const strategy = strategyById(game.strategy)
  const background = founderBackgroundById(game.founderBackground)
  const difficulty = difficultyById(game.difficulty)
  const metrics = getMetrics(game)
  const score = performanceScore(game)
  const cashHistory = game.history.map((snapshot) => snapshot.cash)
  const unlocked = game.achievements
  const locked = Object.keys(ACHIEVEMENTS).filter((id) => !unlocked.includes(id))

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-ink p-4 text-white">
        <span className="pointer-events-none absolute -right-8 -top-10 size-32 rounded-full bg-brand-500/25 blur-2xl" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-lime">Founder overview</p>
            <h3 className="mt-1 font-display text-[22px] font-semibold leading-tight">{game.company}</h3>
            <p className="mt-0.5 text-[11px] text-white/50">
              {game.founder} · {background.name} founder · {industry.name}
            </p>
            <p className="mt-0.5 text-[10px] text-white/35">
              {strategy.name} · {difficulty.name} difficulty
            </p>
          </div>
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-lime">
            Score {score}/100
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ['Cash', money(game.cash, { compact: true })],
            ['Valuation', money(game.valuation, { compact: true })],
            ['Your equity', `${game.founderEquity.toFixed(1)}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/[0.07] px-2.5 py-2">
              <p className="text-[9px] uppercase tracking-[0.1em] text-white/40">{label}</p>
              <p className="mt-0.5 font-display text-[15px] font-semibold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 h-10">
          <Sparkline data={cashHistory.length > 1 ? cashHistory : [game.cash * 0.85, game.cash]} color="#c9f269" height={40} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[9.5px] text-white/40">
          <span>Cash since month 1</span>
          <span>
            M{String(game.month).padStart(2, '0')} · {monthLabel(game.month)}
          </span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Stat label="Monthly revenue" value={money(metrics.mrr, { compact: true })} sub="before seasonality" />
        <Stat label="Monthly costs" value={money(metrics.monthlyCosts, { compact: true })} sub={`payroll ${money(metrics.payroll, { compact: true })}`} />
        <Stat
          label="Runway"
          value={metrics.runway >= 99 ? 'profitable' : `${metrics.runway.toFixed(1)} mo`}
          tone={metrics.runway >= 6 ? 'good' : metrics.runway >= 3 ? 'warn' : 'bad'}
        />
        <Stat label="Total raised" value={game.totalRaised ? money(game.totalRaised, { compact: true }) : '—'} sub={`${game.emergencyLoans} emergency loans`} />
      </div>

      <PanelSection
        title="This month's plan"
        hint="Changes take effect when you close the month."
        action={
          <button
            onClick={() => onNavigate('market')}
            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-brand-700 hover:text-brand-600"
          >
            Edit <ArrowRight className="size-3" />
          </button>
        }
      >
        <div className="divide-y divide-line">
          {[
            ['Price', `${money(game.price)} / ${industry.customerNoun}`, `${money(game.price - industry.price, { sign: true })} vs. market`],
            ['Marketing', `${money(game.marketingSpend)} / month`, `${number(metrics.marketingPower)} points of marketing power`],
            ['Product', `${money(game.productSpend)} / month`, `${number(metrics.qualityPower)} points of quality power`],
            ['Training', `${money(game.trainingSpend)} / month`, `${game.team.length ? 'grows skill and promotions' : 'no team to train yet'}`],
            ['Economy', ECONOMY_COPY[game.economy.phase].label, `demand ×${game.economy.demand.toFixed(2)} · churn ×${game.economy.churn.toFixed(2)}`],
          ].map(([label, value, hint]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div>
                <p className="text-[12px] font-semibold text-ink">{label}</p>
                <p className="text-[10px] text-ink-400">{hint}</p>
              </div>
              <p className="text-[12px] font-bold tabular-nums text-ink">{value}</p>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Achievements" hint={`${unlocked.length} of ${unlocked.length + locked.length} unlocked`}>
        <div className="flex flex-wrap gap-1.5">
          {unlocked.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">
              <BadgeCheck className="size-3" />
              {ACHIEVEMENTS[id]?.label ?? id}
            </span>
          ))}
          {locked.map((id) => (
            <span key={id} className="rounded-full bg-paper-3 px-2 py-1 text-[10px] font-semibold text-ink-300">
              {ACHIEVEMENTS[id]?.label ?? id}
            </span>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Decision log" hint="Newest first. Every entry is something you caused.">
        <ol className="space-y-2.5">
          {game.log.slice(0, 10).map((entry) => (
            <li key={entry.id} className="flex gap-2.5">
              <span
                className={clsx(
                  'mt-1.5 size-1.5 shrink-0 rounded-full',
                  entry.tone === 'good' ? 'bg-brand-500' : entry.tone === 'bad' ? 'bg-coral' : 'bg-ink-300',
                )}
              />
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold leading-snug text-ink">{entry.title}</p>
                {entry.detail && <p className="mt-0.5 text-[10.5px] leading-snug text-ink-500">{entry.detail}</p>}
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-300">
                  Month {entry.month}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </PanelSection>
    </>
  )
}

function MarketPanel({ onClose, onNavigate }: { onClose: () => void; onNavigate: (panel: PanelId) => void }) {
  const game = useCurrentGame()
  const updatePrice = useGame((state) => state.updatePrice)
  const updateMarketing = useGame((state) => state.updateMarketing)
  const updateProduct = useGame((state) => state.updateProduct)
  const advance = useGame((state) => state.advance)
  const industry = industryById(game.industry)
  const metrics = getMetrics(game)
  const newCustomers = newCustomersEstimate(game)
  const churn = estimateChurn(game)
  const projectedCash = game.cash + game.customers * game.price - metrics.monthlyCosts
  const guidance = buildInsights(game)[0]
  const economy = game.economy
  const economyCopy = ECONOMY_COPY[economy.phase]

  return (
    <>
      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-ink-400">Monthly levers</p>
            <p className="mt-0.5 font-display text-[18px] font-semibold text-ink">Set the plan</p>
          </div>
          <span className="rounded-full bg-paper-3 px-2.5 py-1 text-[10px] font-bold text-ink-500">
            {number(game.customers)} {industry.customerNounPlural}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          <RangeRow
            label={`Price per ${industry.customerNoun}`}
            value={game.price}
            min={industry.priceMin}
            max={industry.priceMax}
            step={Math.max(1, Math.round((industry.priceMax - industry.priceMin) / 60))}
            onChange={updatePrice}
            format={(value) => money(value)}
            helper={`market avg. ${money(industry.price)}`}
          />
          <RangeRow
            label="Marketing budget"
            value={game.marketingSpend}
            min={0}
            max={20_000}
            step={500}
            onChange={updateMarketing}
            format={(value) => money(value)}
            accent="coral"
            helper="buys reach"
          />
          <RangeRow
            label="Product budget"
            value={game.productSpend}
            min={0}
            max={25_000}
            step={500}
            onChange={updateProduct}
            format={(value) => money(value)}
            accent="violet"
            helper="protects quality"
          />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-white p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-paper-3 text-ink-600">
              <TrendingUp className="size-3.5" />
            </span>
            <div>
              <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Macro climate</p>
              <p className="text-[12.5px] font-bold text-ink">
                {economyCopy.label}
                <span className="ml-1.5 text-[9.5px] font-semibold text-ink-400">month {economy.monthsInPhase + 1} of phase</span>
              </p>
            </div>
          </div>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[9px] font-bold text-brand-700">
            demand ×{economy.demand.toFixed(2)}
          </span>
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-ink-500">{economyCopy.blurb}</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          {[
            ['Demand', `×${economy.demand.toFixed(2)}`],
            ['Churn', `×${economy.churn.toFixed(2)}`],
            ['Valuation', `×${economy.valuation.toFixed(2)}`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-paper-3/70 px-2 py-1.5">
              <p className="text-[8.5px] font-bold uppercase tracking-[0.1em] text-ink-400">{label}</p>
              <p className="text-[11.5px] font-bold tabular-nums text-ink">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <PanelSection
        title="Competitors"
        hint={`${game.competitors.length} active players. Share moves as price and quality move.`}
        action={
          <button
            onClick={() => onNavigate('sales')}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-700 hover:text-brand-600"
          >
            Pipeline <ArrowUpRight className="size-3" />
          </button>
        }
      >
        <ul className="space-y-2">
          {game.competitors.map((competitor) => (
            <li key={competitor.id} className="rounded-xl bg-paper-3/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[11.5px] font-bold text-ink">{competitor.name}</p>
                  <p className="text-[9.5px] capitalize text-ink-400">
                    {competitor.archetype.replace('-', ' ')} · price {Math.round(competitor.priceIndex * 100)}% of market
                  </p>
                </div>
                <span className="text-[11px] font-bold tabular-nums text-ink">{percent(competitor.share, 1)}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
                <div className="h-full rounded-full bg-coral/70" style={{ width: `${Math.min(100, competitor.share * 250)}%` }} />
              </div>
              <p className="mt-1 text-[9.5px] italic leading-snug text-ink-400">{competitor.lastMove}</p>
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection title="Next month's forecast" hint="Estimated before seasonality. Actual results may surprise you.">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="New customers" value={`+${number(newCustomers)}`} tone="good" sub="at current spend" />
          <Stat label="Churn rate" value={percent(churn, 1)} tone={churn > 0.1 ? 'bad' : churn > 0.06 ? 'warn' : 'good'} sub={`≈ ${number(game.customers * churn)} leaving`} />
          <Stat label="Monthly costs" value={money(metrics.monthlyCosts, { compact: true })} />
          <Stat
            label="Projected cash"
            value={money(projectedCash, { compact: true })}
            tone={projectedCash > game.cash ? 'good' : 'bad'}
            sub={projectedCash > game.cash ? 'before the month' : 'burning cash'}
          />
          <Stat
            label={industry.inventory ? 'Stock cover' : 'Supply risk'}
            value={industry.inventory ? `${metrics.inventoryCover.toFixed(1)} mo` : percent(metrics.supplyRisk, 0)}
            tone={industry.inventory ? (metrics.inventoryCover < 0.8 ? 'bad' : metrics.inventoryCover < 1.4 ? 'warn' : 'good') : 'neutral'}
            sub={industry.inventory ? 'before the next order lands' : 'vendor dependency'}
          />
          <Stat label="Pipeline" value={money(metrics.pipelineValue, { compact: true })} sub={`${game.pipeline.length} open deals`} />
        </div>
      </PanelSection>

      <div className="flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3.5 ring-1 ring-brand-100">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-700" />
        <p className="text-[11.5px] leading-relaxed text-brand-800">
          <b className="font-bold">Nova:</b> {guidance}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onNavigate('suppliers')}
          className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-left transition hover:border-line-strong"
        >
          <Boxes className="size-4 shrink-0 text-brand-700" />
          <span className="min-w-0">
            <span className="block text-[11px] font-bold text-ink">Supply Depot</span>
            <span className="block text-[9.5px] text-ink-400">{industry.supplierLabel}</span>
          </span>
        </button>
        <button
          onClick={() => onNavigate('expansion')}
          className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-left transition hover:border-line-strong"
        >
          <MapPin className="size-4 shrink-0 text-[#9a6b12]" />
          <span className="min-w-0">
            <span className="block text-[11px] font-bold text-ink">Expansion</span>
            <span className="block text-[9.5px] text-ink-400">{game.branches.filter((branch) => branch.openedMonth !== null).length} markets open</span>
          </span>
        </button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button
          onClick={() => {
            advance()
            onClose()
          }}
          disabled={!!game.pendingCrisis}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(9,107,65,0.65)] transition hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-50"
        >
          Close month {game.month + 1}
          <ArrowRight className="size-4" />
        </button>
        <button
          onClick={onClose}
          className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink-600 transition hover:bg-paper-3"
        >
          Done
        </button>
      </div>
    </>
  )
}

const AVATAR_COLORS = ['#0b8550', '#7c6cf6', '#2f80c7', '#b07a1e', '#e05a3f']

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
}

function TalentPanel() {
  const game = useCurrentGame()
  const hire = useGame((state) => state.hire)
  const fire = useGame((state) => state.fire)
  const refreshPool = useGame((state) => state.refreshPool)
  const updateTraining = useGame((state) => state.updateTraining)
  const [confirmFire, setConfirmFire] = useState<string | null>(null)
  const metrics = getMetrics(game)
  const canRefresh = game.cash >= 500
  const trainingPerPerson = game.team.length ? game.trainingSpend / game.team.length : 0

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Team" value={number(game.team.length)} sub={`payroll ${money(metrics.payroll, { compact: true })}/mo`} />
        <Stat label="Avg. morale" value={`${Math.round(metrics.avgMorale)}`} tone={metrics.avgMorale >= 65 ? 'good' : metrics.avgMorale >= 50 ? 'warn' : 'bad'} />
        <Stat label="Capacity" value={number(metrics.capacity)} sub={`serving ${number(game.customers)}`} tone={game.customers > metrics.capacity ? 'warn' : 'neutral'} />
        <Stat label="Team skill" value={number(game.team.reduce((total, member) => total + member.skill, 0))} sub="sum of all skills" />
      </div>

      <PanelSection title="Training & development" hint="Budgets compound into skill. At 100 points a teammate is promoted and paid more.">
        <RangeRow
          label="Training budget"
          value={game.trainingSpend}
          min={0}
          max={15_000}
          step={500}
          onChange={updateTraining}
          format={(value) => money(value)}
          accent="violet"
          helper={game.team.length ? `${money(trainingPerPerson)} per teammate` : 'hire someone first'}
          disabled={game.team.length === 0}
        />
        <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
          Each $9,000 per teammate fills the training bar. Promotions raise skill and salary — homegrown leaders are
          cheaper than senior hires.
        </p>
      </PanelSection>

      <PanelSection title="Your team" hint={game.team.length ? 'Salaries are charged at the start of each month.' : 'You are doing every job yourself.'}>
        {game.team.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper-3/50 px-4 py-5 text-center">
            <Users className="mx-auto size-5 text-ink-300" />
            <p className="mt-2 text-[12px] font-semibold text-ink-600">No teammates yet</p>
            <p className="mt-0.5 text-[10.5px] text-ink-400">Capacity is low. Hire below to unlock growth.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {game.team.map((member, index) => (
              <EmployeeRow
                key={member.id}
                member={member}
                color={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                confirming={confirmFire === member.id}
                onAskFire={() => setConfirmFire(member.id)}
                onCancel={() => setConfirmFire(null)}
                onFire={() => {
                  fire(member.id)
                  setConfirmFire(null)
                }}
              />
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection
        title="Open roles"
        hint="Hiring pays a signing bonus now; salary starts next month."
        action={
          <button
            onClick={refreshPool}
            disabled={!canRefresh}
            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-brand-700 transition hover:text-brand-600 disabled:opacity-40"
          >
            <RefreshCcw className="size-3" />
            Refresh $500
          </button>
        }
      >
        <ul className="space-y-2">
          {game.candidates.map((candidate) => {
            const Icon = ROLE_ICONS[candidate.role]
            const affordable = game.cash >= candidate.signingBonus + candidate.salary
            return (
              <li key={candidate.id} className="rounded-xl border border-line bg-paper-2 p-3">
                <div className="flex items-start gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-bold text-white">
                    {initials(candidate.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-bold text-ink">{candidate.name}</p>
                      <span className="rounded-full bg-violet-soft px-1.5 py-0.5 text-[9px] font-bold text-violet">
                        {candidate.skill.toFixed(1)}
                      </span>
                    </div>
                    <p className="flex items-center gap-1 text-[10px] text-ink-500">
                      <Icon className="size-3" />
                      {roleById(candidate.role).name} · {candidate.background}
                    </p>
                    <p className="mt-1 text-[10px] italic leading-snug text-ink-400">“{candidate.quirk}”</p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
                  <div className="text-[10px] text-ink-500">
                    <b className="text-ink">{money(candidate.salary)}</b>/mo · {money(candidate.signingBonus)} bonus
                  </div>
                  <button
                    onClick={() => hire(candidate.id)}
                    disabled={!affordable}
                    className="rounded-full bg-ink px-3 py-1.5 text-[10.5px] font-bold text-white transition hover:bg-ink-800 disabled:opacity-40"
                    title={affordable ? `Hire ${candidate.name}` : 'Not enough cash for bonus and first salary'}
                  >
                    Hire
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </PanelSection>

      <div className="flex items-start gap-2.5 rounded-2xl bg-gold-soft/50 p-3.5 ring-1 ring-gold/30">
        <Coins className="mt-0.5 size-4 shrink-0 text-[#9a6b12]" />
        <p className="text-[11px] leading-relaxed text-ink-700">
          Payroll is your largest fixed cost. A $6,000 salary is <b>{money(72_000)}</b> a year — against your current
          burn, that is real runway.
        </p>
      </div>
    </>
  )
}

function EmployeeRow({
  member,
  color,
  confirming,
  onAskFire,
  onCancel,
  onFire,
}: {
  member: Employee
  color: string
  confirming: boolean
  onAskFire: () => void
  onCancel: () => void
  onFire: () => void
}) {
  const Icon = ROLE_ICONS[member.role]
  return (
    <li className="rounded-xl border border-line bg-paper-2 p-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: color }}>
          {initials(member.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-bold text-ink">{member.name}</p>
          <p className="flex items-center gap-1 text-[10px] text-ink-500">
            <Icon className="size-3" />
            {roleById(member.role).name} · L{member.level ?? 1} · skill {(member.skill * (1 + ((member.level ?? 1) - 1) * 0.15)).toFixed(1)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold tabular-nums text-ink">{money(member.salary)}</p>
          <p className="text-[8.5px] text-ink-400">/month</p>
        </div>
        {!confirming && (
          <button
            onClick={onAskFire}
            aria-label={`Let ${member.name} go`}
            className="grid size-7 shrink-0 place-items-center rounded-full text-ink-300 transition hover:bg-coral/10 hover:text-coral"
          >
            <UserMinus className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${member.morale}%` }} />
        </div>
        <span className="text-[9px] font-semibold text-ink-400">morale {Math.round(member.morale)}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
          <div className="h-full rounded-full bg-violet/70" style={{ width: `${member.training ?? 0}%` }} />
        </div>
        <span className="text-[9px] font-semibold text-ink-400">training {Math.round(member.training ?? 0)}</span>
      </div>
      {confirming && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-coral/10 px-2.5 py-2">
          <p className="text-[10px] font-semibold text-[#9c3426]">One month severance. Morale drops.</p>
          <div className="flex gap-1.5">
            <button onClick={onCancel} className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-ink-600">
              Keep
            </button>
            <button onClick={onFire} className="rounded-full bg-coral px-2.5 py-1 text-[10px] font-bold text-white">
              Let go
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function BankPanel() {
  const game = useCurrentGame()
  const loan = useGame((state) => state.loan)
  const repay = useGame((state) => state.repay)
  const limit = maxLoan(game)
  const interest = game.debt * 0.018
  const loans = [25_000, 50_000, 100_000].filter((amount) => amount <= limit)
  const repayments = [10_000, 25_000].filter((amount) => amount <= game.debt && amount <= game.cash)

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Cash" value={money(game.cash, { compact: true })} />
        <Stat label="Debt" value={game.debt ? money(game.debt, { compact: true }) : 'None'} tone={game.debt > 0 ? 'warn' : 'good'} />
        <Stat label="Interest / month" value={money(interest)} sub="1.8% of outstanding" />
        <Stat label="Available credit" value={money(limit, { compact: true })} sub="8× monthly revenue, capped" />
      </div>

      {game.emergencyLoans > 0 && (
        <div className="flex items-start gap-2.5 rounded-2xl bg-coral/10 p-3.5 ring-1 ring-coral/20">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-coral" />
          <p className="text-[11px] leading-relaxed text-[#8c3a2c]">
            You have triggered {game.emergencyLoans} emergency credit line{game.emergencyLoans > 1 ? 's' : ''}. Three
            trips and the bank calls in the debt.
          </p>
        </div>
      )}

      <PanelSection title="Borrow" hint="Cash today, interest every month. Debt also lowers your valuation.">
        {limit <= 0 ? (
          <p className="rounded-xl bg-paper-3/60 px-3 py-4 text-center text-[11px] text-ink-500">
            The bank has no more credit to extend. Grow revenue or repay what you owe.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {loans.map((amount) => (
              <button
                key={amount}
                onClick={() => loan(amount)}
                className="rounded-xl border border-line bg-paper-2 px-2 py-3 text-center transition hover:border-brand-300 hover:bg-brand-50"
              >
                <Banknote className="mx-auto size-4 text-brand-700" />
                <p className="mt-1 text-[12px] font-bold text-ink">{money(amount, { compact: true })}</p>
                <p className="text-[9px] text-ink-400">+{money(amount * 0.018)}/mo</p>
              </button>
            ))}
            {limit < 25_000 && (
              <button
                onClick={() => loan(limit)}
                className="col-span-3 rounded-xl bg-ink px-3 py-2.5 text-[11px] font-bold text-white transition hover:bg-ink-800"
              >
                Borrow the remaining {money(limit)}
              </button>
            )}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between rounded-lg bg-paper-3/60 px-3 py-2 text-[10.5px]">
          <span className="text-ink-500">Debt service next month</span>
          <span className="font-bold text-ink">{money(interest)}</span>
        </div>
      </PanelSection>

      <PanelSection title="Repay" hint="Paying down debt improves valuation and cuts interest.">
        {game.debt <= 0 ? (
          <p className="rounded-xl bg-brand-50 px-3 py-4 text-center text-[11px] font-semibold text-brand-700">
            Debt-free. The balance sheet has room to breathe.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {repayments.map((amount) => (
              <button
                key={amount}
                onClick={() => repay(amount)}
                className="rounded-xl border border-line bg-paper-2 px-3 py-2.5 text-[11px] font-bold text-ink transition hover:border-brand-300 hover:bg-brand-50"
              >
                Repay {money(amount, { compact: true })}
              </button>
            ))}
            <button
              onClick={() => repay(game.debt)}
              className={clsx(
                'rounded-xl bg-ink px-3 py-2.5 text-[11px] font-bold text-white transition hover:bg-ink-800',
                repayments.length === 0 && 'col-span-2',
              )}
            >
              Clear all debt
            </button>
          </div>
        )}
      </PanelSection>

      <p className="px-1 text-[10px] leading-relaxed text-ink-400">
        Credit limit: eight months of revenue, between $20k and $300k. Interest accrues monthly and compounds through
        your monthly costs.
      </p>
    </>
  )
}

function InvestorsPanel() {
  const game = useCurrentGame()
  const openRound = useGame((state) => state.openRound)
  const accept = useGame((state) => state.accept)
  const decline = useGame((state) => state.decline)
  const eligibleMonth = game.month >= 3
  const cooldown = game.month - game.lastRoundMonth >= 3

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Your equity" value={`${game.founderEquity.toFixed(1)}%`} />
        <Stat label="Current valuation" value={money(game.valuation, { compact: true })} />
        <Stat label="Total raised" value={game.totalRaised ? money(game.totalRaised, { compact: true }) : '—'} />
        <Stat
          label="Last round"
          value={game.lastRoundMonth >= 0 ? `Month ${game.lastRoundMonth}` : 'Never'}
          sub={game.lastRoundMonth >= 0 ? `${game.month - game.lastRoundMonth} months ago` : 'No investors yet'}
        />
      </div>

      {game.offers.length === 0 ? (
        <PanelSection title="Term sheets" hint="Investors look at revenue, reputation and momentum.">
          <div className="rounded-xl border border-dashed border-line-strong bg-paper-3/40 px-4 py-6 text-center">
            <Handshake className="mx-auto size-5 text-ink-300" />
            <p className="mt-2 text-[12px] font-semibold text-ink-600">No offers on the table</p>
            <p className="mx-auto mt-1 max-w-[250px] text-[10.5px] leading-snug text-ink-400">
              {eligibleMonth
                ? cooldown
                  ? 'Open a round to see who is interested. It costs nothing to ask.'
                  : 'Give investors another quarter. A new round this soon looks desperate.'
                : 'Investors want to see three months of progress first.'}
            </p>
            <button
              onClick={openRound}
              disabled={!eligibleMonth || !cooldown}
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-brand-600 px-4 text-[11.5px] font-bold text-white transition hover:bg-brand-700 disabled:pointer-events-none disabled:opacity-40"
            >
              <Handshake className="size-3.5" />
              Open a round
            </button>
          </div>
        </PanelSection>
      ) : (
        <>
          {game.offers.map((offer) => {
            const diluted = game.founderEquity * (1 - offer.equity)
            return (
              <section key={offer.id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
                <div className="flex items-center justify-between gap-3 bg-paper-3/60 px-4 py-2.5">
                  <div>
                    <p className="text-[12px] font-bold text-ink">{offer.fund}</p>
                    <p className="text-[9.5px] text-ink-500">{offer.partner}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-ink-500 ring-1 ring-line">
                    Term sheet
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="font-display text-[26px] font-semibold leading-none text-ink">{money(offer.amount, { compact: true })}</p>
                      <p className="mt-1 text-[10.5px] text-ink-500">
                        for <b className="text-ink">{percent(offer.equity, 1)}</b> of the company
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-ink-400">Pre-money</p>
                      <p className="text-[12px] font-bold text-ink">{money(offer.valuation, { compact: true })}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[10.5px] italic leading-snug text-ink-500">“{offer.vibe}”</p>
                  <ul className="mt-3 space-y-1">
                    {offer.terms.map((term) => (
                      <li key={term} className="flex items-center gap-1.5 text-[10.5px] text-ink-600">
                        <Check className="size-3 text-brand-600" />
                        {term}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
                    <span className="text-[9.5px] text-ink-400">You keep {diluted.toFixed(1)}%</span>
                    <button
                      onClick={() => accept(offer.id)}
                      className="rounded-full bg-brand-600 px-3.5 py-1.5 text-[10.5px] font-bold text-white transition hover:bg-brand-700"
                    >
                      Accept terms
                    </button>
                  </div>
                </div>
              </section>
            )
          })}
          <button
            onClick={decline}
            className="mx-auto text-[10.5px] font-semibold text-ink-400 underline decoration-line-strong underline-offset-4 transition hover:text-ink-600"
          >
            Pass on both offers
          </button>
        </>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl bg-violet-soft/60 p-3.5 ring-1 ring-violet/15">
        <TrendingUp className="mt-0.5 size-4 shrink-0 text-violet" />
        <p className="text-[11px] leading-relaxed text-ink-700">
          Raising buys runway, not validation. Every point of equity you sell now is a point you never sell later.
        </p>
      </div>
    </>
  )
}

function CrisisPanel() {
  const game = useCurrentGame()
  const metrics = getMetrics(game)
  const history = game.log.filter((entry) => entry.kind === 'crisis').slice(0, 8)
  const risks = buildInsights(game)

  return (
    <>
      {game.pendingCrisis ? (
        <section className="rounded-2xl border border-coral/30 bg-coral/10 p-4">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-coral">
            Open decision · {game.pendingCrisis.kicker}
          </p>
          <p className="mt-1.5 font-display text-[17px] font-semibold leading-snug text-ink">
            {game.pendingCrisis.title}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-600">{game.pendingCrisis.body}</p>
        </section>
      ) : (
        <section className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldAlert className="size-4" />
            </span>
            <div>
              <p className="text-[12px] font-bold text-ink">Crisis Ops is quiet</p>
              <p className="text-[10.5px] text-ink-500">
                {game.month < 3 ? 'Crises begin after month 3.' : 'No open decision right now. Use the calm.'}
              </p>
            </div>
          </div>
          <p className="mt-3 rounded-xl bg-paper-3/60 px-3 py-2.5 text-[10.5px] leading-relaxed text-ink-500">
            Risk check · churn {percent(metrics.churnRate, 1)} · runway{' '}
            {metrics.runway >= 99 ? 'positive' : `${metrics.runway.toFixed(1)} months`} · quality {Math.round(game.quality)}/100
          </p>
        </section>
      )}

      <PanelSection title="What Nova is watching" hint="The three constraints most likely to bite next.">
        <ul className="space-y-2">
          {risks.map((risk) => (
            <li key={risk} className="flex gap-2 rounded-xl bg-paper-3/60 px-3 py-2.5">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-brand-700" />
              <p className="text-[11px] leading-relaxed text-ink-600">{risk}</p>
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection title="Decision history" hint="Crises you have faced so far.">
        {history.length === 0 ? (
          <p className="rounded-xl bg-paper-3/60 px-3 py-4 text-center text-[11px] text-ink-400">
            Nothing yet. That is not the same as nothing coming.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {history.map((entry) => (
              <li key={entry.id} className="flex gap-2.5">
                <span
                  className={clsx(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    entry.tone === 'good' ? 'bg-brand-500' : entry.tone === 'bad' ? 'bg-coral' : 'bg-ink-300',
                  )}
                />
                <div>
                  <p className="text-[11.5px] font-semibold leading-snug text-ink">{entry.title}</p>
                  {entry.detail && <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{entry.detail}</p>}
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-ink-300">Month {entry.month}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </PanelSection>
    </>
  )
}

function SupplierPanel() {
  const game = useCurrentGame()
  const chooseSupplier = useGame((state) => state.chooseSupplier)
  const updateRestock = useGame((state) => state.updateRestock)
  const industry = industryById(game.industry)
  const metrics = getMetrics(game)
  const current = game.suppliers.find((supplier) => supplier.id === game.supplierId) ?? game.suppliers[0]

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Supplier" value={current.name} sub={`${industry.supplierLabel}`} />
        <Stat
          label="Cost index"
          value={`${current.costIndex.toFixed(2)}×`}
          tone={current.costIndex > 1.05 ? 'warn' : 'good'}
          sub="applied to monthly COGS"
        />
        <Stat
          label="Reliability"
          value={percent(current.reliability, 0)}
          tone={current.reliability > 0.88 ? 'good' : current.reliability > 0.78 ? 'warn' : 'bad'}
          sub={`${current.leadMonths} month lead time`}
        />
        <Stat
          label={industry.inventory ? 'Stock cover' : 'Supply risk'}
          value={industry.inventory ? `${metrics.inventoryCover.toFixed(1)} mo` : percent(metrics.supplyRisk, 0)}
          tone={!industry.inventory ? 'neutral' : metrics.inventoryCover < 0.8 ? 'bad' : metrics.inventoryCover < 1.4 ? 'warn' : 'good'}
        />
      </div>

      <PanelSection title="Pick a supplier" hint="Cheap and unreliable versus costly and dependable is the whole trade.">
        <ul className="space-y-2">
          {game.suppliers.map((supplier) => {
            const active = supplier.id === game.supplierId
            return (
              <li
                key={supplier.id}
                className={clsx(
                  'rounded-xl border p-3',
                  active ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-200' : 'border-line bg-paper-2',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-ink">{supplier.name}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-ink-500">{supplier.blurb}</p>
                  </div>
                  <button
                    onClick={() => chooseSupplier(supplier.id)}
                    disabled={active}
                    className={clsx(
                      'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition',
                      active ? 'bg-brand-600 text-white' : 'bg-ink text-white hover:bg-ink-800',
                    )}
                  >
                    {active ? 'Selected' : 'Switch'}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-bold">
                  <span className="rounded-full bg-white px-2 py-0.5 text-ink-500 ring-1 ring-line">cost {supplier.costIndex.toFixed(2)}×</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-ink-500 ring-1 ring-line">reliability {Math.round(supplier.reliability * 100)}%</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-ink-500 ring-1 ring-line">
                    quality {supplier.quality > 0 ? '+' : ''}{supplier.quality}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-ink-500 ring-1 ring-line">lead {supplier.leadMonths}mo</span>
                </div>
              </li>
            )
          })}
        </ul>
      </PanelSection>

      {industry.inventory ? (
        <PanelSection title="Restock policy" hint="How many months of cover to order each month. Orders arrive after the lead time.">
          <RangeRow
            label="Order cover"
            value={game.restockMonths}
            min={0}
            max={3}
            step={1}
            onChange={updateRestock}
            format={(value) => (value === 0 ? 'Just in time' : `${value} month${value === 1 ? '' : 's'}`)}
            helper="more cover, more holding cost"
          />
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="Supply risk" value={percent(metrics.supplyRisk, 0)} tone={metrics.supplyRisk > 0.55 ? 'bad' : metrics.supplyRisk > 0.35 ? 'warn' : 'good'} />
            <Stat
              label="Spoilage risk"
              value={game.industry === 'fnb' || game.industry === 'retail' ? (game.inventory > 3.2 ? 'High' : game.inventory > 2.4 ? 'Watch' : 'Low') : '—'}
              tone={game.inventory > 3.2 ? 'bad' : game.inventory > 2.4 ? 'warn' : 'good'}
            />
          </div>
          {metrics.inventoryCover < 0.8 && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-coral/10 px-2.5 py-2 text-[10px] leading-snug text-[#8c3a2c]">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              You are about to stock out. A stockout cuts sales and damages quality for a full month.
            </p>
          )}
        </PanelSection>
      ) : (
        <PanelSection title="Vendor dependency" hint="No physical stock — your supplier affects cost and reliability of the platform.">
          <p className="rounded-xl bg-paper-3/60 px-3 py-3 text-[10.5px] leading-relaxed text-ink-500">
            A cheaper vendor improves margin but raises the odds of an outage month. A premium vendor costs more and
            keeps the service steady.
          </p>
        </PanelSection>
      )}

      <div className="flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3.5 ring-1 ring-brand-100">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-700" />
        <p className="text-[11px] leading-relaxed text-brand-800">
          <b className="font-bold">{industry.name}:</b> {industry.rule}
        </p>
      </div>
    </>
  )
}

const STAGE_META: Record<string, { label: string; tone: string }> = {
  lead: { label: 'Lead', tone: 'bg-paper-3 text-ink-500' },
  qualified: { label: 'Qualified', tone: 'bg-violet-soft text-violet' },
  negotiation: { label: 'Negotiating', tone: 'bg-gold-soft text-[#9a6b12]' },
}

function SalesPanel() {
  const game = useCurrentGame()
  const toggleDiscount = useGame((state) => state.toggleDealDiscount)
  const pushDeal = useGame((state) => state.pushDeal)
  const industry = industryById(game.industry)
  const metrics = getMetrics(game)

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Pipeline value" value={money(metrics.pipelineValue, { compact: true })} sub={`${game.pipeline.length} open ${industry.pipelineLabel.toLowerCase()}`} />
        <Stat label="Deals won" value={number(game.pipelineWon)} tone="good" sub="closed so far" />
        <Stat label="Demand climate" value={`×${game.economy.demand.toFixed(2)}`} tone={game.economy.demand >= 1 ? 'good' : 'warn'} sub={`${ECONOMY_COPY[game.economy.phase].label} economy`} />
        <Stat label="Competitive pressure" value={percent(metrics.competitorPressure, 0)} tone={metrics.competitorPressure > 0.55 ? 'bad' : metrics.competitorPressure > 0.35 ? 'warn' : 'good'} />
      </div>

      <PanelSection title={`Open ${industry.pipelineLabel.toLowerCase()}`} hint="Stages advance each month. Negotiated deals can be discounted or pushed.">
        {game.pipeline.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong bg-paper-3/50 px-4 py-5 text-center">
            <Target className="mx-auto size-5 text-ink-300" />
            <p className="mt-2 text-[12px] font-semibold text-ink-600">No deals in the pipeline</p>
            <p className="mt-0.5 text-[10.5px] text-ink-400">Marketing and sales hires generate new leads.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {game.pipeline.map((deal) => {
              const stage = STAGE_META[deal.stage]
              return (
                <li key={deal.id} className="rounded-xl border border-line bg-paper-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-ink">{deal.company}</p>
                      <p className="text-[10px] text-ink-500">{deal.contact} · {number(deal.customers)} {deal.customers === 1 ? industry.customerNoun : industry.customerNounPlural}</p>
                    </div>
                    <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold', stage.tone)}>{stage.label}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-ink">{money(deal.value, { compact: true })} contract</span>
                    <span className="text-ink-400">{deal.monthsOpen} mo open</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                      <div
                        className={clsx('h-full rounded-full', deal.discount ? 'bg-gold' : 'bg-brand-500')}
                        style={{ width: `${clampPercent(deal.chance + (deal.discount ? 0.16 : 0))}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-semibold text-ink-400">{percent(clampChance(deal.chance + (deal.discount ? 0.16 : 0)), 0)} close</span>
                  </div>
                  {deal.stage === 'negotiation' && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        onClick={() => toggleDiscount(deal.id)}
                        className={clsx(
                          'rounded-full px-2 py-1 text-[9.5px] font-bold transition',
                          deal.discount ? 'bg-gold-soft text-[#9a6b12]' : 'bg-paper-3 text-ink-500 hover:text-ink',
                        )}
                      >
                        {deal.discount ? '10% discount on' : 'Offer 10% discount'}
                      </button>
                      <button
                        onClick={() => pushDeal(deal.id)}
                        disabled={deal.pushed || game.cash < 1_200}
                        className="rounded-full bg-ink px-2 py-1 text-[9.5px] font-bold text-white transition hover:bg-ink-800 disabled:opacity-40"
                      >
                        {deal.pushed ? 'Pushed' : 'Push $1.2k'}
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </PanelSection>

      <div className="flex items-start gap-2.5 rounded-2xl bg-violet-soft/60 p-3.5 ring-1 ring-violet/15">
        <Target className="mt-0.5 size-4 shrink-0 text-violet" />
        <p className="text-[11px] leading-relaxed text-ink-700">
          Discounts lift close odds and cut contract value. Pushing a deal costs cash now for a better chance later.
          Neither fixes a bad offer — stage, price and timing still matter.
        </p>
      </div>
    </>
  )
}

const clampPercent = (value: number) => Math.max(4, Math.min(100, value * 100))
const clampChance = (value: number) => Math.max(0.08, Math.min(0.92, value))

function ExpansionPanel({ onNavigate }: { onNavigate: (panel: PanelId) => void }) {
  const game = useCurrentGame()
  const openBranchAction = useGame((state) => state.openBranch)
  const industry = industryById(game.industry)
  const opened = game.branches.filter((branch) => branch.openedMonth !== null)
  const available = game.branches.filter((branch) => branch.openedMonth === null)
  const demand = opened.reduce((total, branch) => total + branch.demand, 0)

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Markets open" value={number(opened.length)} sub={`+${number(demand)} demand`} tone={opened.length ? 'good' : 'neutral'} />
        <Stat label="Branch overhead" value={money(opened.reduce((total, branch) => total + branch.overhead, 0), { compact: true })} sub="added to monthly costs" tone={opened.length ? 'warn' : 'neutral'} />
        <Stat label="Home demand" value={`×${game.economy.demand.toFixed(2)}`} sub={`${ECONOMY_COPY[game.economy.phase].label} economy`} />
        <Stat label="New customers / mo" value={number(newCustomersEstimate(game))} sub="current run rate" />
      </div>

      {opened.length > 0 && (
        <PanelSection title="Open markets" hint="These branches already contribute demand and overhead.">
          <ul className="space-y-2">
            {opened.map((branch) => (
              <li key={branch.id} className="flex items-center justify-between gap-2 rounded-xl bg-brand-50/60 px-3 py-2.5 ring-1 ring-brand-100">
                <div>
                  <p className="text-[11.5px] font-bold text-ink">{branch.name}</p>
                  <p className="text-[9.5px] text-ink-500">
                    Open since month {branch.openedMonth} · +{branch.demand} demand · {money(branch.overhead)}/mo
                  </p>
                </div>
                <BadgeCheck className="size-4 shrink-0 text-brand-600" />
              </li>
            ))}
          </ul>
        </PanelSection>
      )}

      <PanelSection title="Expansion options" hint="Launch costs hit cash once; overhead is permanent.">
        <ul className="space-y-2.5">
          {available.map((branch) => {
            const locked = game.month < branch.minMonth
            const affordable = game.cash >= branch.launchCost
            return (
              <li key={branch.id} className="rounded-xl border border-line bg-paper-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-bold text-ink">{branch.name}</p>
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-400">{branch.district}</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-ink-500 ring-1 ring-line">
                    +{branch.demand} demand
                  </span>
                </div>
                <p className="mt-1 text-[10px] leading-snug text-ink-500">{branch.blurb}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="text-[9.5px] text-ink-400">
                    <b className="text-ink">{money(branch.launchCost, { compact: true })}</b> launch · {money(branch.overhead)}/mo
                  </div>
                  <button
                    onClick={() => openBranchAction(branch.id)}
                    disabled={locked || !affordable}
                    className="rounded-full bg-ink px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-ink-800 disabled:opacity-40"
                  >
                    {locked ? `Month ${branch.minMonth}` : affordable ? 'Open market' : 'Need cash'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </PanelSection>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onNavigate('suppliers')}
          className="flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[10.5px] font-bold text-ink-600 transition hover:bg-paper-3"
        >
          <Boxes className="size-3.5" />
          Supply
        </button>
        <button
          onClick={() => onNavigate('sales')}
          className="flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-[10.5px] font-bold text-ink-600 transition hover:bg-paper-3"
        >
          <Target className="size-3.5" />
          Pipeline
        </button>
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-gold-soft/50 p-3.5 ring-1 ring-gold/30">
        <MapPin className="mt-0.5 size-4 shrink-0 text-[#9a6b12]" />
        <p className="text-[11px] leading-relaxed text-ink-700">
          A second market only works when the first one no longer needs your attention. {industry.name} branches add
          demand every month and overhead whether customers arrive or not.
        </p>
      </div>
    </>
  )
}

function NovaPanel({ onNavigate }: { onNavigate: (panel: PanelId) => void }) {
  const game = useCurrentGame()
  const industry = industryById(game.industry)
  const metrics = getMetrics(game)
  const insights = buildInsights(game)
  const forecastCustomers = newCustomersEstimate(game)
  const forecastChurn = estimateChurn(game)
  const marketsOpen = game.branches.filter((branch) => branch.openedMonth !== null).length

  return (
    <>
      <section className="relative overflow-hidden rounded-2xl bg-ink p-4 text-white">
        <span className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-lime/15 blur-2xl" />
        <div className="flex items-center gap-3">
          <span className="relative grid size-10 place-items-center rounded-full bg-lime text-ink">
            <Compass className="size-5" />
            <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-ink bg-brand-500" />
          </span>
          <div>
            <p className="font-display text-[16px] font-semibold">Nova · AI chief of staff</p>
            <p className="text-[10px] text-white/45">Reads your numbers, not your pitch</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          {insights.map((insight) => (
            <p key={insight} className="rounded-xl bg-white/[0.07] px-3 py-2 text-[11px] leading-relaxed text-white/80">
              {insight}
            </p>
          ))}
        </div>
      </section>

      <PanelSection title="The numbers Nova used">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Runway" value={metrics.runway >= 99 ? 'positive' : `${metrics.runway.toFixed(1)} mo`} tone={metrics.runway >= 6 ? 'good' : metrics.runway >= 3 ? 'warn' : 'bad'} />
          <Stat label="Churn" value={percent(metrics.churnRate, 1)} tone={metrics.churnRate > 0.1 ? 'bad' : 'neutral'} />
          <Stat label="Quality" value={`${Math.round(game.quality)}`} />
          <Stat label="Morale" value={`${Math.round(metrics.avgMorale)}`} />
          <Stat label="Customers" value={number(game.customers)} />
          <Stat label="Capacity" value={number(metrics.capacity)} tone={game.customers > metrics.capacity ? 'warn' : 'good'} />
          <Stat label="Economy" value={ECONOMY_COPY[game.economy.phase].label} sub={`demand ×${game.economy.demand.toFixed(2)}`} />
          <Stat
            label={industry.inventory ? 'Stock cover' : 'Supply risk'}
            value={industry.inventory ? `${metrics.inventoryCover.toFixed(1)} mo` : percent(metrics.supplyRisk, 0)}
            tone={industry.inventory && metrics.inventoryCover < 0.8 ? 'bad' : 'neutral'}
          />
          <Stat label="Pipeline" value={money(metrics.pipelineValue, { compact: true })} sub={`${game.pipeline.length} open`} />
          <Stat label="Markets" value={number(marketsOpen + 1)} sub={marketsOpen ? `${marketsOpen} branch${marketsOpen === 1 ? '' : 'es'}` : 'home market only'} />
        </div>
      </PanelSection>

      <PanelSection title="Next month's forecast" hint="A read on direction, not a promise.">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="New customers" value={`+${number(forecastCustomers)}`} tone="good" />
          <Stat label="Expected churn" value={`−${number(game.customers * forecastChurn)}`} tone={forecastChurn > 0.1 ? 'bad' : 'warn'} sub={percent(forecastChurn, 1)} />
          <Stat label="Deals in play" value={number(game.pipeline.length)} sub={money(metrics.pipelineValue, { compact: true }) + ' weighted'} />
          <Stat label="Monthly net" value={money(metrics.mrr - metrics.monthlyCosts, { compact: true, sign: true })} tone={metrics.mrr >= metrics.monthlyCosts ? 'good' : 'bad'} />
        </div>
      </PanelSection>

      <PanelSection title="Try this month" hint="One constraint at a time.">
        <ul className="space-y-2">
          {[
            'Pick the constraint that would hurt most if it broke next month.',
            'Change one lever, not three. You are buying information.',
            'Close the month and compare the report to your forecast.',
          ].map((step, index) => (
            <li key={step} className="flex items-start gap-2 text-[11px] leading-relaxed text-ink-600">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-paper-3 text-[9px] font-bold text-ink-500">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ul>
      </PanelSection>

      <div className="grid grid-cols-3 gap-2">
        {[
          { panel: 'suppliers' as const, label: 'Supply', icon: Boxes },
          { panel: 'sales' as const, label: 'Pipeline', icon: Target },
          { panel: 'expansion' as const, label: 'Expand', icon: MapPin },
        ].map((item) => (
          <button
            key={item.panel}
            onClick={() => onNavigate(item.panel)}
            className="flex items-center justify-center gap-1.5 rounded-full border border-line bg-white px-2 py-2 text-[10.5px] font-bold text-ink-600 transition hover:bg-paper-3"
          >
            <item.icon className="size-3.5" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl bg-brand-50 p-3.5 ring-1 ring-brand-100">
        <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand-700" />
        <p className="text-[10.5px] leading-relaxed text-brand-800">
          Nova is a coaching layer over this simulation, not a financial advisor. The decisions — and the consequences —
          are yours.
        </p>
      </div>
    </>
  )
}
