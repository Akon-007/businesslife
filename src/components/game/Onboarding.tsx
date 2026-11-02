import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronRight,
  Info,
  LineChart,
  Megaphone,
  Rocket,
  Shuffle,
  Store,
  Target,
  Trash2,
  Truck,
  Wallet,
  Wrench,
} from 'lucide-react'
import { clsx } from 'clsx'
import { CityMap } from '../city/CityMap'
import { Logo } from '../ui/Logo'
import { buttonClass } from '../ui/Button'
import { DIFFICULTIES, FOUNDER_BACKGROUNDS, INDUSTRIES, STRATEGIES } from '../../game/data'
import { useGame } from '../../game/store'
import { money, number } from '../../lib/format'
import type { DifficultyId, FounderBackgroundId, IndustryId, StrategyId } from '../../game/types'

const INDUSTRY_ICONS = { saas: Building2, fnb: Store, retail: Wallet, logistics: Truck } as const

const BACKGROUND_ICONS = { operator: Wrench, builder: Building2, seller: Megaphone, analyst: LineChart } as const

const COMPANY_IDEAS = [
  'Kite & Co.',
  'Meridian Labs',
  'Halcyon Goods',
  'Northline Studio',
  'Palm & Pine',
  'Orbit Supply',
  'Tandem Works',
  'Lumen & Co.',
  'Cedar Street',
  'Mosaic Foods',
  'Brightline',
  'Harbour & Sons',
]

const STEP_TITLES = ['Founder', 'Industry', 'Strategy', 'Profile', 'Briefing']

function backgroundPerk(starting: { cash: number; customers: number; quality: number; reputation: number; morale: number }) {
  const parts: string[] = []
  if (starting.cash) parts.push(`${money(starting.cash, { compact: true })} cash`)
  if (starting.customers) parts.push(`+${starting.customers} customers`)
  if (starting.quality) parts.push(`+${starting.quality} quality`)
  if (starting.reputation) parts.push(`+${starting.reputation} reputation`)
  if (starting.morale) parts.push(`+${starting.morale} morale`)
  return parts.join(' · ')
}

export function Onboarding() {
  const start = useGame((state) => state.start)
  const runs = useGame((state) => state.runs)
  const loadRun = useGame((state) => state.loadRun)
  const deleteRun = useGame((state) => state.deleteRun)
  const [step, setStep] = useState(0)
  const [founder, setFounder] = useState('')
  const [company, setCompany] = useState('Kite & Co.')
  const [industry, setIndustry] = useState<IndustryId>('saas')
  const [strategy, setStrategy] = useState<StrategyId>('product')
  const [background, setBackground] = useState<FounderBackgroundId>('operator')
  const [difficulty, setDifficulty] = useState<DifficultyId>('standard')

  const industryDef = useMemo(() => INDUSTRIES.find((item) => item.id === industry)!, [industry])
  const strategyDef = useMemo(() => STRATEGIES.find((item) => item.id === strategy)!, [strategy])
  const backgroundDef = useMemo(() => FOUNDER_BACKGROUNDS.find((item) => item.id === background)!, [background])
  const difficultyDef = useMemo(() => DIFFICULTIES.find((item) => item.id === difficulty)!, [difficulty])
  const startingCash = Math.round(
    (industryDef.startingCash + strategyDef.starting.cash + backgroundDef.starting.cash) * difficultyDef.cashMult,
  )
  const startingCustomers = industryDef.startingCustomers + strategyDef.starting.customers + backgroundDef.starting.customers
  const startingQuality = industryDef.startingQuality + strategyDef.starting.quality + backgroundDef.starting.quality

  const shuffleCompany = () => {
    const next = COMPANY_IDEAS[Math.floor(Math.random() * COMPANY_IDEAS.length)]
    setCompany(next)
  }

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (step < 4) {
      setStep((value) => value + 1)
      return
    }
    start({
      founder: founder.trim() || 'Founder',
      company: company.trim() || 'Untitled Co.',
      industry,
      strategy,
      founderBackground: background,
      difficulty,
    })
  }

  return (
    <div className="min-h-[100svh] bg-paper">
      <div className="grid min-h-[100svh] grid-cols-1 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative flex flex-col px-5 pb-10 pt-6 sm:px-8 lg:px-12">
          <header className="flex items-center justify-between gap-4">
            <Link to="/" aria-label="BUSINESSLIFE home">
              <Logo />
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 transition hover:text-ink"
            >
              Back to site
              <ArrowRight className="size-3.5 rotate-[-45deg]" />
            </Link>
          </header>

          <div className="mx-auto flex w-full max-w-[540px] flex-1 flex-col justify-center py-8 sm:py-12">
            <div className="flex items-center gap-2">
              {STEP_TITLES.map((title, index) => (
                <div key={title} className="flex flex-1 items-center gap-2">
                  <div className="flex-1">
                    <div
                      className={clsx(
                        'h-1 rounded-full transition-colors duration-300',
                        index <= step ? 'bg-brand-600' : 'bg-line',
                      )}
                    />
                    <p
                      className={clsx(
                        'mt-2 text-[9.5px] font-bold uppercase tracking-[0.12em]',
                        index === step ? 'text-ink' : index < step ? 'text-brand-700' : 'text-ink-300',
                      )}
                    >
                      {title}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-8 inline-flex items-center gap-2 self-start rounded-full bg-ink/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.13em] text-ink-500">
              <span className="grid size-4 place-items-center rounded-full bg-ink text-[8px] text-lime">{step + 1}</span>
              Step {step + 1} of 5
            </p>

            <form onSubmit={submit} className="mt-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {step === 0 && (
                    <div>
                      <h1 className="font-display text-[38px] font-bold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[46px]">
                        Who is building
                        <br />
                        this company?
                      </h1>
                      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-500">
                        No sign-up, no resume. Two names and you are in the room where the decisions happen.
                      </p>

                      <div className="mt-7 space-y-4">
                        <label className="block">
                          <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-ink-400">Your name</span>
                          <input
                            autoFocus
                            value={founder}
                            onChange={(event) => setFounder(event.target.value)}
                            placeholder="e.g. Ada Mensah"
                            maxLength={32}
                            className="mt-2 h-13 w-full rounded-2xl border border-line bg-white px-4 text-[15px] font-medium text-ink outline-none transition placeholder:text-ink-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                          />
                        </label>

                        <label className="block">
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-ink-400">Company name</span>
                            <button
                              type="button"
                              onClick={shuffleCompany}
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-brand-700 transition hover:text-brand-600"
                            >
                              <Shuffle className="size-3" />
                              Surprise me
                            </button>
                          </span>
                          <input
                            value={company}
                            onChange={(event) => setCompany(event.target.value)}
                            placeholder="Your company"
                            maxLength={40}
                            className="mt-2 h-13 w-full rounded-2xl border border-line bg-white px-4 font-display text-[17px] font-semibold text-ink outline-none transition placeholder:font-sans placeholder:text-[15px] placeholder:font-medium placeholder:text-ink-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
                          />
                          <span className="mt-2 flex flex-wrap gap-1.5">
                            {COMPANY_IDEAS.slice(0, 4).map((idea) => (
                              <button
                                key={idea}
                                type="button"
                                onClick={() => setCompany(idea)}
                                className={clsx(
                                  'rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition',
                                  company === idea
                                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                                    : 'border-line bg-white text-ink-400 hover:border-line-strong hover:text-ink-600',
                                )}
                              >
                                {idea}
                              </button>
                            ))}
                          </span>
                        </label>
                      </div>

                      <div className="mt-7 flex items-start gap-2.5 rounded-2xl bg-paper-3/80 p-3.5">
                        <Info className="mt-0.5 size-4 shrink-0 text-brand-700" />
                        <p className="text-[12px] leading-relaxed text-ink-600">
                              Your company is saved in this browser and synced to the local simulation server. Close the tab and come back whenever — the story
                          waits.
                        </p>
                      </div>

                      {runs.length > 0 && (
                        <div className="mt-4">
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-ink-400">
                            Your archive · {runs.length}
                          </p>
                          <ul className="mt-2 space-y-2">
                            {runs.slice(0, 3).map((run) => (
                              <li
                                key={run.id}
                                className="flex items-center gap-2.5 rounded-2xl border border-line bg-white px-3 py-2.5"
                              >
                                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-ink text-lime">
                                  <Building2 className="size-3.5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[12px] font-bold text-ink">{run.game.company}</p>
                                  <p className="text-[9.5px] text-ink-400">
                                    Month {Math.min(run.game.month + 1, 36)} · {money(run.game.valuation, { compact: true })} value ·{' '}
                                    {new Date(run.savedAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => loadRun(run.id)}
                                  className="shrink-0 rounded-full bg-brand-600 px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-brand-700"
                                >
                                  Resume
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteRun(run.id)}
                                  aria-label={`Delete archived ${run.game.company}`}
                                  className="grid size-7 shrink-0 place-items-center rounded-full text-ink-300 transition hover:bg-coral/10 hover:text-coral"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {step === 1 && (
                    <div>
                      <h1 className="font-display text-[38px] font-bold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[46px]">
                        What kind of
                        <br />
                        company?
                      </h1>
                      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-500">
                        Each industry has different margins, churn and rhythm. Pick the one you want to understand from
                        the inside.
                      </p>

                      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                        {INDUSTRIES.map((item) => {
                          const Icon = INDUSTRY_ICONS[item.id]
                          const active = item.id === industry
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setIndustry(item.id)}
                              className={clsx(
                                'group relative flex h-full flex-col rounded-2xl border p-3.5 text-left transition duration-200',
                                active
                                  ? 'border-brand-500 bg-white shadow-[0_16px_36px_-22px_rgba(9,107,65,0.5)] ring-1 ring-brand-500'
                                  : 'border-line bg-white/70 hover:-translate-y-0.5 hover:border-line-strong hover:bg-white',
                              )}
                            >
                              <span className="flex items-center justify-between">
                                <span
                                  className={clsx(
                                    'grid size-9 place-items-center rounded-xl',
                                    active ? 'bg-brand-600 text-white' : 'bg-paper-3 text-ink-500',
                                  )}
                                >
                                  <Icon className="size-4" />
                                </span>
                                {active && (
                                  <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                                    <Check className="size-3" strokeWidth={3} />
                                  </span>
                                )}
                              </span>
                              <span className="mt-3 font-display text-[15px] font-semibold text-ink">{item.name}</span>
                              <span className="mt-1 text-[10.5px] leading-snug text-ink-500">{item.tagline}</span>
                              <span className="mt-2.5 flex items-center gap-1.5 border-t border-line pt-2 text-[9.5px] font-semibold text-ink-400">
                                {money(item.startingCash, { compact: true })} cash · {number(item.startingCustomers)}{' '}
                                {item.customerNounPlural}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-3.5 rounded-2xl border border-line bg-white p-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {industryDef.strengths.map((strength) => (
                            <span
                              key={strength}
                              className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700"
                            >
                              {strength}
                            </span>
                          ))}
                          <span className="rounded-full bg-paper-3 px-2.5 py-1 text-[10px] font-bold text-ink-500">
                            Sales cycle: {industryDef.salesCycle}
                          </span>
                        </div>
                        <p className="mt-2.5 text-[11px] leading-relaxed text-ink-500">
                          Typical price: <b className="text-ink">{money(industryDef.price)}</b> per{' '}
                          {industryDef.customerNoun} per month. Fixed costs:{' '}
                          <b className="text-ink">{money(industryDef.fixedCosts)}</b>/month.
                        </p>
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <h1 className="font-display text-[38px] font-bold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[46px]">
                        What is your edge?
                      </h1>
                      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-500">
                        Strategy is a bet about where your advantage comes from. It changes your starting position and
                        what the machine rewards.
                      </p>

                      <div className="mt-6 space-y-2.5">
                        {STRATEGIES.map((item) => {
                          const active = item.id === strategy
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setStrategy(item.id)}
                              className={clsx(
                                'relative flex w-full items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left transition duration-200',
                                active
                                  ? 'border-ink bg-ink text-white shadow-float'
                                  : 'border-line bg-white hover:border-line-strong',
                              )}
                            >
                              <span
                                className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl"
                                style={{ background: active ? item.accent : item.soft, color: active ? '#fff' : item.accent }}
                              >
                                <Target className="size-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span className={clsx('font-display text-[16px] font-semibold', active ? 'text-white' : 'text-ink')}>
                                    {item.name}
                                  </span>
                                  {active ? (
                                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-lime text-ink">
                                      <Check className="size-3" strokeWidth={3} />
                                    </span>
                                  ) : (
                                    <ChevronRight className="size-4 shrink-0 text-ink-300" />
                                  )}
                                </span>
                                <span className={clsx('mt-0.5 block text-[12px] font-medium', active ? 'text-white/85' : 'text-ink-600')}>
                                  {item.tagline}
                                </span>
                                <span className={clsx('mt-1 block text-[11px] leading-snug', active ? 'text-white/55' : 'text-ink-500')}>
                                  {item.detail}
                                </span>
                                <span className="mt-2 flex flex-wrap gap-1.5">
                                  <span
                                    className={clsx(
                                      'rounded-full px-2 py-0.5 text-[9.5px] font-bold',
                                      active ? 'bg-white/10 text-lime' : 'bg-paper-3 text-ink-500',
                                    )}
                                  >
                                    Trade-off: {item.tradeoff}
                                  </span>
                                  <span
                                    className={clsx(
                                      'rounded-full px-2 py-0.5 text-[9.5px] font-bold',
                                      active ? 'bg-white/10 text-white/70' : 'bg-paper-3 text-ink-500',
                                    )}
                                  >
                                    Quality +{item.powers.quality} · Sales +{item.powers.sales} · Marketing +{item.powers.marketing}
                                  </span>
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <h1 className="font-display text-[38px] font-bold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[46px]">
                        What kind of
                        <br />
                        founder are you?
                      </h1>
                      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-500">
                        Your background changes where you start strong. Your difficulty changes how much room you get to
                        learn.
                      </p>

                      <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
                        {FOUNDER_BACKGROUNDS.map((item) => {
                          const Icon = BACKGROUND_ICONS[item.id]
                          const active = item.id === background
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setBackground(item.id)}
                              className={clsx(
                                'group relative flex h-full flex-col rounded-2xl border p-3.5 text-left transition duration-200',
                                active
                                  ? 'border-brand-500 bg-white shadow-[0_16px_36px_-22px_rgba(9,107,65,0.5)] ring-1 ring-brand-500'
                                  : 'border-line bg-white/70 hover:-translate-y-0.5 hover:border-line-strong hover:bg-white',
                              )}
                            >
                              <span className="flex items-center justify-between">
                                <span
                                  className="grid size-9 place-items-center rounded-xl"
                                  style={{ background: active ? item.accent : item.soft, color: active ? '#fff' : item.accent }}
                                >
                                  <Icon className="size-4" />
                                </span>
                                {active && (
                                  <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                                    <Check className="size-3" strokeWidth={3} />
                                  </span>
                                )}
                              </span>
                              <span className="mt-3 font-display text-[15px] font-semibold text-ink">{item.name}</span>
                              <span className="mt-1 text-[10.5px] leading-snug text-ink-500">{item.detail}</span>
                              <span className="mt-auto flex flex-wrap gap-1 pt-3">
                                <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[9.5px] font-bold text-ink-500">
                                  {backgroundPerk(item.starting) || 'Balanced start'}
                                </span>
                                {item.powers.ops > 0 && (
                                  <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[9.5px] font-bold text-ink-500">
                                    +{item.powers.ops} ops power
                                  </span>
                                )}
                                {item.powers.sales > 0 && (
                                  <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[9.5px] font-bold text-ink-500">
                                    +{item.powers.sales} sales power
                                  </span>
                                )}
                                {item.powers.marketing > 0 && (
                                  <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[9.5px] font-bold text-ink-500">
                                    +{item.powers.marketing} marketing power
                                  </span>
                                )}
                                {item.powers.quality > 0 && (
                                  <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[9.5px] font-bold text-ink-500">
                                    +{item.powers.quality} quality power
                                  </span>
                                )}
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      <div className="mt-5">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.13em] text-ink-400">Difficulty</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-3">
                          {DIFFICULTIES.map((item) => {
                            const active = item.id === difficulty
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setDifficulty(item.id)}
                                className={clsx(
                                  'rounded-2xl border p-3 text-left transition duration-200',
                                  active
                                    ? 'border-ink bg-ink text-white'
                                    : 'border-line bg-white hover:border-line-strong',
                                )}
                              >
                                <span className="flex items-center justify-between gap-2">
                                  <span className={clsx('text-[12px] font-bold', active ? 'text-white' : 'text-ink')}>
                                    {item.name}
                                  </span>
                                  {active && <Check className="size-3.5 text-lime" strokeWidth={3} />}
                                </span>
                                <span className={clsx('mt-1 block text-[10px] leading-snug', active ? 'text-white/60' : 'text-ink-500')}>
                                  {item.blurb}
                                </span>
                                <span
                                  className={clsx(
                                    'mt-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold',
                                    active ? 'bg-white/10 text-lime' : 'bg-paper-3 text-ink-500',
                                  )}
                                >
                                  {item.cashMult === 1 ? 'standard cash' : `${Math.round(item.cashMult * 100)}% starting cash`} ·{' '}
                                  {item.crisisMult === 1 ? 'normal crises' : item.crisisMult < 1 ? 'softer crises' : 'harsher crises'}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-4">
                        {[
                          ['Cash', money(startingCash, { compact: true })],
                          [industryDef.customerNounPlural, number(startingCustomers)],
                          ['Quality', `${startingQuality}/100`],
                          ['Morale', `${70 + backgroundDef.starting.morale}`],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-400">{label}</p>
                            <p className="font-display text-[15px] font-semibold text-ink">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div>
                      <h1 className="font-display text-[38px] font-bold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[46px]">
                        Your first day
                        <br />
                        in Meridian.
                      </h1>
                      <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-500">
                        This is the company you are about to run. The numbers are real enough to make you care.
                      </p>

                      <div className="mt-6 overflow-hidden rounded-[24px] border border-line bg-white shadow-soft">
                        <div className="relative bg-ink px-5 py-5 text-white">
                          <span className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-brand-500/25 blur-2xl" />
                          <p className="text-[9.5px] font-bold uppercase tracking-[0.15em] text-lime">Founder briefing</p>
                          <p className="mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-[-0.03em]">
                            {company.trim() || 'Untitled Co.'}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-white/50">
                            {founder.trim() || 'Founder'} · {industryDef.name} · {strategyDef.name}
                          </p>
                          <p className="mt-1 text-[10.5px] text-white/40">
                            {backgroundDef.name} founder · {difficultyDef.name} mode
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
                          {[
                            ['Cash', money(startingCash, { compact: true })],
                            [industryDef.customerNounPlural, number(startingCustomers)],
                            ['Price', money(industryDef.price)],
                            ['Quality', `${startingQuality}/100`],
                          ].map(([label, value]) => (
                            <div key={label} className="bg-white px-3.5 py-3">
                              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-400">{label}</p>
                              <p className="mt-0.5 font-display text-[15px] font-semibold text-ink">{value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-line px-5 py-4">
                          <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-ink-400">Month 1 checklist</p>
                          <ul className="mt-2.5 space-y-2">
                            {[
                              ...(industryDef.inventory ? ['Check stock cover and pick a supplier'] : []),
                              'Review your price against the market',
                              'Work the pipeline before the month closes',
                              'Close the month and read what happened',
                            ].map((item, index) => (
                              <li key={item} className="flex items-center gap-2 text-[12px] font-medium text-ink-600">
                                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-paper-3 text-[9px] font-bold text-ink-500">
                                  {index + 1}
                                </span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <p className="mt-3 text-center text-[10.5px] text-ink-400">
                        36 months · saved automatically · no real money involved
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-7 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  className={clsx(buttonClass('ghost', 'md', 'pl-2'), step === 0 && 'invisible')}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </button>
                <button type="submit" className={buttonClass(step === 4 ? 'lime' : 'primary', 'lg', 'min-w-[190px]')}>
                  {step === 4 ? (
                    <>
                      <Rocket className="size-4" />
                      Found {company.trim().split(' ')[0] || 'the company'}
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <p className="mx-auto w-full max-w-[540px] text-[10px] text-ink-400">
            BUSINESSLIFE is an educational simulation. Meridian City is fictional.
          </p>
        </div>

        <aside className="relative hidden overflow-hidden bg-sky lg:block">
          <CityMap className="absolute inset-0 h-full w-full" variant="hero" interactive={false} showLabels />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/10 to-transparent" />
          <div className="absolute inset-x-8 bottom-8">
            <div className="glass-dark rounded-[26px] p-6 text-white">
              <p className="inline-flex items-center gap-2 text-[9.5px] font-bold uppercase tracking-[0.16em] text-lime">
                <span className="size-1.5 rounded-full bg-lime blink" />
                Meridian City · open
              </p>
              <p className="mt-3 font-display text-[28px] font-semibold leading-[1.05] tracking-[-0.03em]">
                Eight landmarks.
                <br />
                One company. Thirty-six months.
              </p>
              <p className="mt-2 max-w-sm text-[12.5px] leading-relaxed text-white/55">
                Every pin on the map is a decision you can make. Every month, those decisions send you an invoice.
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {['HQ', 'Talent', 'Bank', 'Market', 'Investors', 'Crisis', 'Supply', 'Expand'].map((item) => (
                  <span key={item} className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
