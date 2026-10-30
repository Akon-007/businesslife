import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  Building2,
  ChevronDown,
  Compass,
  CircleDollarSign,
  GraduationCap,
  Handshake,
  Lightbulb,
  LineChart,
  MapPin,
  Play,
  Rocket,
  ShieldAlert,
  Store,
  Target,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import { CityMap } from '../components/city/CityMap'
import { SiteNav } from '../components/site/SiteNav'
import { SiteFooter } from '../components/site/SiteFooter'
import { ButtonLink, buttonClass } from '../components/ui/Button'
import { Sparkline, BarRow } from '../components/ui/Charts'
import { AvatarStack, LiveFeed, Reveal, SectionTag, Skyline } from '../components/landing/parts'

const AUDIENCES = [
  'MBA cohorts',
  'Undergraduate business',
  'Accelerators',
  'Entrepreneurship hubs',
  'Corporate L&D',
  'Founder fellowships',
  'University incubators',
  'Student societies',
]

const STATS = [
  { value: '48,200', label: 'founders playing this month' },
  { value: '118', label: 'countries in the sim' },
  { value: '2.4M', label: 'decisions logged' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper">
      <SiteNav overlay />
      <Hero />
      <AudienceStrip />
      <HowItWorks />
      <WorldSection />
      <MiniCase />
      <Programmes />
      <Stories />
      <Faq />
      <FinalCta />
      <SiteFooter />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-sky">
      <CityMap className="absolute inset-0 h-full w-full" variant="hero" focusHref="/play" showLabels />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_15%_45%,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0)_55%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink/25 to-transparent" />

      <div className="container-page relative z-30 flex min-h-[100svh] flex-col justify-end pb-8 pt-28 sm:pb-10 lg:justify-center lg:py-32">
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,600px)_1fr]">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong rounded-[30px] p-6 sm:rounded-[34px] sm:p-8 lg:p-10"
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.13em] text-ink-600">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand-500 opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-brand-500" />
              </span>
              AI-powered business simulation
            </div>

            <h1 className="mt-5 font-display text-[42px] font-bold leading-[0.98] tracking-[-0.045em] text-ink sm:text-[56px] lg:text-[64px]">
              Learn business
              <br />
              by{' '}
              <span className="relative inline-block whitespace-nowrap">
                <span className="absolute inset-x-[-6px] bottom-[5px] h-[42%] -rotate-[1.2deg] rounded-[7px] bg-lime sm:bottom-[7px]" aria-hidden />
                <span className="relative">living it.</span>
              </span>
            </h1>

            <p className="mt-5 max-w-[480px] text-[15px] leading-relaxed text-ink-600 sm:text-base">
              Build a company in Meridian City. Set prices, hire a team, win customers, negotiate with investors and
              survive the crises no case study prepares you for. Every month, your decisions come back with a receipt.
            </p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <ButtonLink to="/play" size="lg" className="group justify-center">
                Start your company — free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </ButtonLink>
              <a href="#how" className={buttonClass('secondary', 'lg', 'justify-center')}>
                <span className="grid size-5 place-items-center rounded-full bg-ink text-white">
                  <Play className="size-2.5 fill-current" />
                </span>
                See how a month works
              </a>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line/80 pt-5">
              <AvatarStack />
              <div>
                <p className="text-[12.5px] font-bold text-ink">48,260 founders and students</p>
                <p className="text-[11.5px] text-ink-500">building companies this month · free to start</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-ink-500 lg:hidden">
              {STATS.map((stat) => (
                <span key={stat.label} className="inline-flex items-baseline gap-1.5">
                  <b className="font-display text-sm text-ink">{stat.value}</b>
                  {stat.label}
                </span>
              ))}
            </div>
          </motion.div>

          <div className="hidden flex-col items-end gap-4 lg:flex">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="glass-strong flex items-center divide-x divide-line/80 rounded-2xl px-1 py-3"
            >
              {STATS.map((stat) => (
                <div key={stat.label} className="px-4">
                  <p className="font-display text-xl font-semibold tracking-[-0.03em] text-ink">{stat.value}</p>
                  <p className="mt-0.5 max-w-[112px] text-[10px] font-medium leading-tight text-ink-500">{stat.label}</p>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-[330px]"
            >
              <LiveFeed />
            </motion.div>

            <div className="glass flex w-[330px] items-center gap-3 rounded-2xl px-4 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-ink text-lime">
                <MapPin className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-ink">Meridian City is open</p>
                <p className="text-[10.5px] text-ink-500">Tap any landmark to see what happens there.</p>
              </div>
              <Link to="/play" className="grid size-8 place-items-center rounded-full bg-white text-ink shadow-sm transition hover:bg-brand-50">
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <a
        href="#how"
        aria-label="Scroll to how it works"
        className="absolute bottom-4 left-1/2 z-30 hidden -translate-x-1/2 flex-col items-center gap-1 text-white/85 transition hover:text-white lg:flex"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] drop-shadow">Scroll</span>
        <span className="grid size-7 place-items-center rounded-full border border-white/40 backdrop-blur">
          <ChevronDown className="size-3.5" />
        </span>
      </a>
    </section>
  )
}

function AudienceStrip() {
  return (
    <section className="relative z-10 overflow-hidden bg-ink-950 py-4 text-white">
      <div className="flex w-max animate-marquee items-center gap-8 whitespace-nowrap">
        {[0, 1].map((pass) => (
          <div key={pass} className="flex items-center gap-8" aria-hidden={pass === 1}>
            <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-lime">
              <Zap className="size-3.5" /> Built for
            </span>
            {AUDIENCES.map((audience) => (
              <span key={`${pass}-${audience}`} className="inline-flex items-center gap-3 text-[12.5px] font-semibold text-white/55">
                {audience}
                <span className="size-1 rounded-full bg-white/20" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function SectionHeader({
  tag,
  title,
  copy,
  align = 'left',
  dark = false,
}: {
  tag: string
  title: ReactNode
  copy?: string
  align?: 'left' | 'center'
  dark?: boolean
}) {
  return (
    <Reveal className={clsx('max-w-3xl', align === 'center' && 'mx-auto text-center')}>
      <SectionTag dark={dark}>{tag}</SectionTag>
      <h2
        className={clsx(
          'mt-5 font-display text-[34px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[44px] lg:text-[52px]',
          dark ? 'text-white' : 'text-ink',
        )}
      >
        {title}
      </h2>
      {copy && (
        <p className={clsx('mt-4 max-w-2xl text-[15px] leading-relaxed sm:text-base', align === 'center' && 'mx-auto', dark ? 'text-white/60' : 'text-ink-500')}>
          {copy}
        </p>
      )}
    </Reveal>
  )
}

const STEPS = [
  {
    number: '01',
    title: 'Found your company',
    copy: 'Pick an industry, a strategy and a name. You start with real trade-offs, starting cash and one uncomfortable question: what is your edge?',
    icon: Rocket,
    visual: <FoundPreview />,
  },
  {
    number: '02',
    title: 'Run the month',
    copy: 'Set price, marketing and product investment. Hire, fire, borrow, raise or hold. Then close the month and watch the consequences hit every number.',
    icon: LineChart,
    visual: <RunPreview />,
  },
  {
    number: '03',
    title: 'Read the story',
    copy: 'A monthly report explains what moved and why. Nova, your AI advisor, flags the constraint. Thirty-six months later, you get a scorecard you earned.',
    icon: BookOpenText,
    visual: <ReportPreview />,
  },
]

function HowItWorks() {
  return (
    <section id="how" className="relative overflow-hidden bg-paper py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent" />
      <div className="container-page">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeader
            tag="How it works"
            title={
              <>
                One company. Thirty-six months.
                <br />
                <span className="text-brand-600">Every consequence.</span>
              </>
            }
            copy="No lectures, no spreadsheets to fill in. A living company with limited cash, real trade-offs and a scoreboard that does not care how good your slide deck is."
          />
          <Reveal delay={0.1}>
            <Link to="/play" className={buttonClass('dark', 'md', 'shrink-0')}>
              Open Meridian City
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delay={index * 0.08}>
              <article className="group flex h-full flex-col overflow-hidden rounded-[26px] border border-line bg-white p-5 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-float sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">
                    <step.icon className="size-3.5 text-brand-600" />
                    Step {step.number}
                  </span>
                  <span className="font-display text-3xl font-semibold tracking-[-0.04em] text-line-strong">{step.number}</span>
                </div>
                <h3 className="mt-4 font-display text-[24px] font-semibold tracking-[-0.03em] text-ink">{step.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{step.copy}</p>
                <div className="mt-5 flex-1">{step.visual}</div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function FoundPreview() {
  return (
    <div className="rounded-2xl bg-paper-3/70 p-3.5 ring-1 ring-line/70">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Choose your industry</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[9.5px] font-bold text-ink-400">1 of 4</span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {[
          { icon: Building2, name: 'SaaS & Software', active: true },
          { icon: Store, name: 'Food & Beverage' },
          { icon: Wallet, name: 'Fashion & Retail' },
          { icon: Zap, name: 'Logistics' },
        ].map((industry) => (
          <div
            key={industry.name}
            className={clsx(
              'flex items-center gap-2 rounded-xl px-2.5 py-2 text-[10.5px] font-bold transition',
              industry.active ? 'bg-ink text-white shadow-sm' : 'bg-white text-ink-500 ring-1 ring-line',
            )}
          >
            <industry.icon className={clsx('size-3.5', industry.active ? 'text-lime' : 'text-ink-400')} />
            {industry.name}
          </div>
        ))}
      </div>
      <div className="mt-2.5 rounded-xl bg-white p-3 ring-1 ring-line">
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-400">Company name</p>
        <div className="mt-1 flex items-center justify-between">
          <p className="font-display text-base font-semibold text-ink">Kite & Co.</p>
          <span className="rounded-md bg-brand-50 px-1.5 py-1 text-[9px] font-bold text-brand-700">Available</span>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between rounded-xl bg-lime/50 px-3 py-2">
        <p className="text-[10px] font-bold text-ink-700">Starting cash</p>
        <p className="font-display text-sm font-semibold text-ink">$170,000</p>
      </div>
    </div>
  )
}

function RunPreview() {
  return (
    <div className="rounded-2xl bg-ink-950 p-3.5 text-white shadow-inner">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/40">Month 08</p>
          <p className="mt-0.5 font-display text-lg font-semibold text-white">Your monthly plan</p>
        </div>
        <span className="rounded-full bg-lime px-2 py-1 text-[9.5px] font-bold text-ink">Runway 9mo</span>
      </div>
      <div className="mt-3 space-y-3">
        {[
          { label: 'Price', value: '$79', fill: '62%' },
          { label: 'Marketing', value: '$3,000', fill: '44%' },
          { label: 'Product', value: '$4,500', fill: '55%' },
        ].map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between text-[10px] font-semibold">
              <span className="text-white/50">{row.label}</span>
              <span className="text-white">{row.value}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
              <div className="h-full rounded-full bg-lime" style={{ width: row.fill }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3.5 flex items-center justify-between rounded-xl bg-white/10 px-3 py-2.5">
        <div>
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/40">Projected cash</p>
          <p className="font-display text-base font-semibold">$238,400</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-bold text-ink">Close month →</span>
      </div>
    </div>
  )
}

function ReportPreview() {
  return (
    <div className="rounded-2xl bg-white p-3.5 ring-1 ring-line-strong/60">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-ink-400">Month 08 report</p>
          <p className="mt-0.5 font-display text-lg font-semibold text-ink">A rough month. A useful one.</p>
        </div>
        <span className="rounded-full bg-coral/10 px-2 py-1 text-[9px] font-bold text-coral">−$11.2k</span>
      </div>
      <div className="mt-2 -mx-1">
        <Sparkline data={[148, 155, 150, 162, 158, 170, 159, 158]} color="#e05a3f" height={42} />
      </div>
      <div className="mt-2 rounded-xl bg-paper-3/80 p-2.5">
        <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-brand-700">
          <Lightbulb className="size-3" /> Nova noticed
        </div>
        <p className="mt-1 text-[10.5px] leading-relaxed text-ink-600">
          You won 34 customers and lost 19. Churn is tracking quality, not price — fix the product before the next push.
        </p>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: Wallet,
    title: 'Cash is the whole game',
    copy: 'Payroll, rent, inventory, marketing, interest. Watch runway in real time and learn the difference between profitable and solvent.',
    className: 'lg:col-span-2',
    visual: <CashVisual />,
  },
  {
    icon: Users,
    title: 'Hire people, not headcount',
    copy: 'Every candidate has a salary, a skill and a personality. Add too much payroll and your runway pays for it.',
    visual: <HireVisual />,
  },
  {
    icon: Target,
    title: 'Price is a strategy',
    copy: 'Raise price and watch volume. Cut it and watch margin. There is no free lunch — only a testable thesis.',
    visual: <PriceVisual />,
  },
  {
    icon: Handshake,
    title: 'Raise on your terms',
    copy: 'Negotiate real term sheets. Valuation, dilution and board seats follow you for the rest of the run.',
    visual: <RaiseVisual />,
  },
  {
    icon: ShieldAlert,
    title: 'The crisis is the curriculum',
    copy: 'Supplier shocks, price wars, key departures, regulator letters. Ten-plus scenarios with no perfect answer.',
    visual: <CrisisVisual />,
  },
  {
    icon: Compass,
    title: 'An advisor that reads the numbers',
    copy: 'Nova turns your dashboard into plain English: what is working, what is breaking and what to examine next.',
    className: 'lg:col-span-2',
    visual: <AdvisorVisual />,
  },
]

function WorldSection() {
  return (
    <section id="world" className="bg-paper pt-4 pb-20 sm:pb-28">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <SectionHeader
            tag="Inside the simulation"
            title={
              <>
                A business is a system.
                <br />
                <span className="text-brand-600">This is where you feel it.</span>
              </>
            }
            copy="Every lever connects to another. Spend more on marketing and your service quality falls behind. Hire faster and your runway shortens. The game is noticing the connection before it costs you."
          />
          <Reveal delay={0.1} className="shrink-0">
            <Link to="/play" className={buttonClass('primary', 'md')}>
              Try a live run
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={index * 0.05} className={feature.className}>
              <article className="flex h-full flex-col rounded-[26px] border border-line bg-white p-5 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:shadow-float sm:p-6">
                <span className="grid size-10 place-items-center rounded-2xl bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <feature.icon className="size-4.5" />
                </span>
                <h3 className="mt-4 font-display text-[21px] font-semibold tracking-[-0.02em] text-ink">{feature.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">{feature.copy}</p>
                <div className="mt-5 flex-1">{feature.visual}</div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function CashVisual() {
  return (
    <div className="grid gap-4 rounded-2xl bg-paper-3/60 p-4 sm:grid-cols-[1.2fr_1fr]">
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Cash on hand</p>
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9.5px] font-bold text-brand-700">+$18k</span>
        </div>
        <p className="mt-1 font-display text-2xl font-semibold text-ink">$238,400</p>
        <Sparkline data={[92, 108, 103, 126, 118, 145, 160, 152, 178, 205, 196, 238]} height={56} />
      </div>
      <div className="space-y-2.5 rounded-xl bg-white p-3 ring-1 ring-line">
        <BarRow label="Revenue" value={24_000} max={30_000} color="#12a060" valueLabel="$24.0k" />
        <BarRow label="Payroll" value={19_000} max={30_000} color="#7c6cf6" valueLabel="$19.0k" />
        <BarRow label="Other costs" value={12_000} max={30_000} color="#ffc94a" valueLabel="$12.0k" />
        <div className="flex items-center justify-between border-t border-line pt-2 text-[10.5px]">
          <span className="font-semibold text-ink-500">Runway</span>
          <span className="font-bold text-ink">11.4 months</span>
        </div>
      </div>
    </div>
  )
}

function HireVisual() {
  return (
    <div className="space-y-2">
      {[
        { name: 'Amara Okafor', role: 'Engineer', skill: '8.4', pay: '$7.1k' },
        { name: 'Tunde Mensah', role: 'Sales lead', skill: '7.2', pay: '$5.4k' },
        { name: 'Hana Sato', role: 'Operator', skill: '6.8', pay: '$4.2k' },
      ].map((person, index) => (
        <div key={person.name} className="flex items-center gap-2.5 rounded-xl bg-paper-3/60 p-2.5 ring-1 ring-line/60">
          <span
            className="grid size-8 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
            style={{ background: ['#0b8550', '#7c6cf6', '#2f80c7'][index] }}
          >
            {person.name.split(' ').map((part) => part[0]).join('')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-bold text-ink">{person.name}</p>
            <p className="text-[9.5px] text-ink-500">{person.role} · skill {person.skill}</p>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] font-bold text-ink">{person.pay}</p>
            <p className="text-[8.5px] text-ink-400">/month</p>
          </div>
        </div>
      ))}
      <p className="pl-1 text-[9.5px] text-ink-400">+ 2 more candidates this month</p>
    </div>
  )
}

function PriceVisual() {
  return (
    <div className="rounded-2xl bg-ink-950 p-4 text-white">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Your price</p>
        <p className="font-display text-2xl font-semibold text-lime">$79</p>
      </div>
      <div className="relative mt-4 h-1.5 rounded-full bg-white/15">
        <div className="absolute inset-y-0 left-0 w-[58%] rounded-full bg-lime" />
        <span className="absolute -top-1.5 left-[58%] size-4 -translate-x-1/2 rounded-full border-2 border-ink bg-lime shadow" />
      </div>
      <div className="mt-1.5 flex justify-between text-[8.5px] font-semibold text-white/35">
        <span>$29</span>
        <span>market avg. $79</span>
        <span>$299</span>
      </div>
      <div className="mt-4 rounded-xl bg-white/[0.07] px-3 py-2.5">
        <p className="text-[9px] uppercase tracking-[0.1em] text-white/40">Forecast</p>
        <div className="mt-1 flex items-baseline justify-between">
          <p className="text-[11px] font-semibold text-white">+18 customers</p>
          <p className="text-[11px] font-semibold text-coral">−7.2% margin</p>
        </div>
      </div>
    </div>
  )
}

function RaiseVisual() {
  return (
    <div className="rounded-2xl border border-line bg-paper-3/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-400">Term sheet</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-ink-500 ring-1 ring-line">Offer 1 of 2</span>
      </div>
      <p className="mt-2 font-display text-xl font-semibold text-ink">$250,000</p>
      <p className="text-[10.5px] text-ink-500">for 14.3% of the company</p>
      <div className="mt-3 space-y-1.5 text-[10px] text-ink-600">
        {['$1.5M pre-money valuation', '1x non-participating preference', 'Board observer seat'].map((term) => (
          <div key={term} className="flex items-center gap-1.5">
            <BadgeCheck className="size-3 text-brand-600" /> {term}
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg bg-ink px-3 py-2 text-center text-[10px] font-bold text-white">Review & sign</div>
    </div>
  )
}

function CrisisVisual() {
  return (
    <div className="rounded-2xl border border-coral/25 bg-coral-soft/50 p-3.5">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-coral text-white">
          <ShieldAlert className="size-3" />
        </span>
        <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-coral">Crisis · month 8</p>
      </div>
      <p className="mt-2 text-[12px] font-bold leading-snug text-ink">Your biggest customer wants 25% off.</p>
      <div className="mt-2.5 space-y-1.5">
        {['Take the deal', 'Protect your price', 'Trade for a case study'].map((option, index) => (
          <div
            key={option}
            className={clsx(
              'rounded-lg px-2.5 py-1.5 text-[10px] font-semibold',
              index === 1 ? 'bg-ink text-white' : 'bg-white/80 text-ink-600 ring-1 ring-line',
            )}
          >
            {option}
          </div>
        ))}
      </div>
    </div>
  )
}

function AdvisorVisual() {
  return (
    <div className="rounded-2xl bg-ink p-4 text-white">
      <div className="flex items-center gap-2.5">
        <span className="relative grid size-8 place-items-center rounded-full bg-lime text-ink">
          <Compass className="size-4" />
        </span>
        <div>
          <p className="text-[11px] font-bold">Nova · AI chief of staff</p>
          <p className="text-[9px] uppercase tracking-[0.1em] text-white/40">Reads your monthly numbers</p>
        </div>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[8.5px] font-bold text-lime">
          <span className="size-1 rounded-full bg-lime" /> LIVE
        </span>
      </div>
      <div className="mt-3 rounded-xl bg-white/[0.07] p-3">
        <p className="text-[11px] leading-relaxed text-white/75">
          You are spending $4.5k on marketing while service quality falls. The next cohort of customers will churn
          before your ads pay back. Fix quality first.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-semibold text-white/60">Cash flow</span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-semibold text-white/60">Quality</span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-semibold text-white/60">Churn risk</span>
      </div>
    </div>
  )
}

const CASE_OPTIONS = [
  {
    id: 'accept',
    label: 'Take the deal',
    detail: 'Volume now, lower margin for a year.',
    result:
      'You sign. The logo lands and the team celebrates — but your average price quietly drops. Investors like the logo. Your unit economics do not.',
    lesson: 'Discounts are easy to give and hard to take back.',
    tone: 'neutral',
  },
  {
    id: 'hold',
    label: 'Protect your price',
    detail: 'Walk away and keep pricing power.',
    result:
      'You decline politely. Two weeks later they return with a smaller pilot at full price. Discipline compounds — but so does the wait.',
    lesson: 'Pricing power is a muscle you build by saying no.',
    tone: 'good',
  },
  {
    id: 'trade',
    label: 'Trade the discount for value',
    detail: 'Ask for a case study, referrals and better terms.',
    result:
      'You trade 12 points of discount for a public case study, three referrals and net-30. The deal closes and so does a better relationship.',
    lesson: 'Negotiation is not price. It is the package around it.',
    tone: 'good',
  },
] as const

function MiniCase() {
  const [choice, setChoice] = useState<(typeof CASE_OPTIONS)[number] | null>(null)

  return (
    <section className="relative overflow-hidden bg-paper pb-20 sm:pb-28">
      <div className="container-page">
        <div className="grain relative overflow-hidden rounded-[32px] bg-ink-950 p-5 text-white sm:p-10 lg:p-14">
          <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-brand-600/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-10 size-72 rounded-full bg-lime/10 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div>
              <SectionTag dark>Try the real thing</SectionTag>
              <h2 className="mt-5 font-display text-[34px] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-[44px]">
                A case study tells you what happened.
                <br />
                <span className="text-lime">This asks what you will do.</span>
              </h2>
              <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-white/60">
                You are eight months into a SaaS company. Cash is fine, growth is slowing, and your biggest customer
                just asked for a discount. Choose — then live with the next twelve months.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4 text-[11px] font-semibold text-white/40">
                <span className="inline-flex items-center gap-1.5"><CircleDollarSign className="size-3.5 text-lime" /> $79 avg. price</span>
                <span className="inline-flex items-center gap-1.5"><Users className="size-3.5 text-lime" /> 290 customers</span>
                <span className="inline-flex items-center gap-1.5"><Wallet className="size-3.5 text-lime" /> $238k cash</span>
              </div>
            </div>

            <div className="rounded-[26px] bg-white p-4 text-ink shadow-2xl sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-full bg-coral/10 text-coral">
                    <ShieldAlert className="size-4" />
                  </span>
                  <div>
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Decision · month 08</p>
                    <p className="text-[13px] font-bold text-ink">The discount request</p>
                  </div>
                </div>
                <span className="rounded-full bg-gold-soft px-2.5 py-1 text-[9.5px] font-bold text-ink-700">No perfect answer</span>
              </div>

              {!choice ? (
                <>
                  <p className="mt-4 text-[13px] leading-relaxed text-ink-600">
                    A national chain will sign a 12-month contract — if you give them 25% off and net-60 payment terms.
                  </p>
                  <div className="mt-4 grid gap-2">
                    {CASE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => setChoice(option)}
                        className="group flex items-center justify-between gap-3 rounded-xl border border-line bg-paper-2 px-3.5 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/50"
                      >
                        <span>
                          <span className="block text-[12.5px] font-bold text-ink">{option.label}</span>
                          <span className="mt-0.5 block text-[10.5px] text-ink-500">{option.detail}</span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-center text-[9.5px] text-ink-400">This is one of 10+ crisis scenarios. In the full run, it changes your numbers.</p>
                </>
              ) : (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                  <p className="mt-4 text-[13px] leading-relaxed text-ink-700">{choice.result}</p>
                  <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-100">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand-700" />
                    <p className="text-[11px] font-semibold leading-relaxed text-brand-800">{choice.lesson}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/play" className={buttonClass('primary', 'md', 'flex-1 justify-center')}>
                      Play the next 28 months
                      <ArrowRight className="size-4" />
                    </Link>
                    <button
                      onClick={() => setChoice(null)}
                      className={buttonClass('secondary', 'md', 'justify-center')}
                    >
                      Pick differently
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const PROGRAMMES = [
  {
    icon: GraduationCap,
    title: 'MBA & business schools',
    copy: 'Turn frameworks into decisions with consequences. Students run a company, compare outcomes and defend their choices in the debrief.',
    points: ['Team-based cohort runs', 'Debrief-ready reports', 'Facilitator guide included'],
    accent: 'bg-brand-50 text-brand-700 ring-brand-100',
  },
  {
    icon: Building2,
    title: 'Undergraduate programmes',
    copy: 'Give students a company before their first internship. No prior finance knowledge required — the simulation teaches through consequence.',
    points: ['Guided first run', 'Built-in reflection prompts', 'Accessible on any laptop'],
    accent: 'bg-violet-soft text-violet ring-violet/20',
  },
  {
    icon: Rocket,
    title: 'Accelerators & ecosystems',
    copy: 'See how founders behave when cash gets tight, a key hire leaves or an investor moves the goalposts. Screen for judgment, not just pitch polish.',
    points: ['Cohort leaderboards', 'Founder diagnostics', 'Custom crisis scenarios'],
    accent: 'bg-gold-soft text-ink-700 ring-gold/40',
  },
]

function Programmes() {
  return (
    <section id="programmes" className="relative overflow-hidden bg-white py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent" />
      <div className="container-page">
        <SectionHeader
          tag="For programmes"
          align="center"
          title={
            <>
              Bring the real thing
              <br />
              into the room.
            </>
          }
          copy="BUSINESSLIFE is built for business schools, MBA programmes, universities and entrepreneurship ecosystems. One shared world, a scorecard everyone can debate, and a debrief that does not need a spreadsheet."
        />

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {PROGRAMMES.map((programme, index) => (
            <Reveal key={programme.title} delay={index * 0.08}>
              <article className="flex h-full flex-col rounded-[26px] border border-line bg-paper-2 p-6 transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-float">
                <span className={clsx('grid size-11 place-items-center rounded-2xl ring-1', programme.accent)}>
                  <programme.icon className="size-5" />
                </span>
                <h3 className="mt-5 font-display text-[24px] font-semibold tracking-[-0.03em] text-ink">{programme.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-500">{programme.copy}</p>
                <ul className="mt-5 space-y-2 border-t border-line pt-4">
                  {programme.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-[12px] font-semibold text-ink-600">
                      <BadgeCheck className="size-3.5 text-brand-600" />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-5 flex flex-col items-center justify-between gap-5 rounded-[26px] bg-ink-950 p-6 text-white sm:flex-row sm:p-8">
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
              {[
                ['36', 'months in a run'],
                ['4', 'industries to master'],
                ['10+', 'crisis scenarios'],
                ['1', 'shared scorecard'],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="font-display text-[28px] font-semibold leading-none text-lime">{value}</p>
                  <p className="mt-1 text-[10.5px] font-medium uppercase tracking-[0.1em] text-white/40">{label}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="mailto:programmes@businesslife.app" className={buttonClass('lime', 'md')}>
                Book a walkthrough
                <ArrowRight className="size-4" />
              </a>
              <Link to="/play" className="inline-flex h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white/80 transition hover:border-white/30 hover:text-white">
                Try a sample run
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

const STORIES = [
  {
    quote:
      'I had read about runway a hundred times. I only understood it the month I ran out — and had to explain to my team why payroll was late.',
    name: 'Adaeze O.',
    role: 'MBA candidate, Class of 2027',
    color: '#0b8550',
    stat: 'Ran out of cash in month 14',
  },
  {
    quote:
      'The first supplier shock hit and I did what I do at work: nothing, and hoped. The sim made me feel the cost in the next three months.',
    name: 'Tomi A.',
    role: 'Founder, consumer brand',
    color: '#7c6cf6',
    stat: 'Rebuilt with 9 months runway',
  },
  {
    quote:
      'My students argued about pricing for forty minutes. Nobody asked what the answer was for the exam. That is the whole point.',
    name: 'Daniel K.',
    role: 'Entrepreneurship lecturer',
    color: '#2f80c7',
    stat: 'Used in a 60-student cohort',
  },
]

function Stories() {
  return (
    <section id="stories" className="bg-paper py-20 sm:py-24">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeader
            tag="Stories"
            title={
              <>
                The lesson lands
                <br />
                <span className="text-brand-600">when it is yours.</span>
              </>
            }
          />
          <p className="max-w-xs text-[12px] leading-relaxed text-ink-400">
            Stories from the prototype cohort. Names shortened, companies fictional, lessons real.
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {STORIES.map((story, index) => (
            <Reveal key={story.name} delay={index * 0.08}>
              <figure className="flex h-full flex-col rounded-[26px] border border-line bg-white p-6 shadow-soft">
                <div className="flex items-center gap-1 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <span key={i} aria-hidden>★</span>
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-[14px] leading-relaxed text-ink-700">“{story.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3 border-t border-line pt-4">
                  <span
                    className="grid size-9 place-items-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: story.color }}
                  >
                    {story.name.slice(0, 1)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-ink">{story.name}</p>
                    <p className="text-[10.5px] text-ink-500">{story.role}</p>
                  </div>
                  <span className="hidden rounded-full bg-paper-3 px-2 py-1 text-[9px] font-bold text-ink-500 sm:block">
                    {story.stat}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

const FAQS = [
  {
    q: 'Is this a course or a game?',
    a: 'Both, in the right order. You run a company month by month like a game, then debrief like a course. Every monthly report shows what changed, why, and what to examine next. Nothing is graded on whether you “win” — only on what you can explain.',
  },
  {
    q: 'How long does a full run take?',
    a: 'A run is 36 simulated months and usually takes 20–40 minutes. You can close a month in under a minute once you know your strategy, or spend much longer negotiating every decision. It saves automatically in your browser.',
  },
  {
    q: 'Do I need business or finance knowledge?',
    a: 'No. The first month explains the levers, the advisor flags what matters, and every number has a plain-English label. If you already know the theory, the game gives you something harder: applying it under pressure.',
  },
  {
    q: 'Can my school or programme use it?',
    a: 'Yes. Cohort runs, facilitator guides and debrief reports are built for business schools, universities, accelerators and corporate learning teams. Reach out and we will set up a walkthrough for your programme.',
  },
  {
    q: 'Is the AI advisor giving me financial advice?',
    a: 'No. Nova is a coaching layer over the simulation. It points out patterns in your own numbers — runway, churn, capacity, morale — and suggests what to examine. BUSINESSLIFE is an educational simulation, not financial, legal or investment advice.',
  },
  {
    q: 'Is my company saved?',
    a: 'Yes, locally in your browser. You can close the tab and continue later. Resetting a run deletes that company permanently, so finish the story you want to learn from first.',
  },
]

function Faq() {
  return (
    <section id="faq" className="border-t border-line bg-white py-20 sm:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHeader tag="FAQ" title={<>Questions before you <span className="text-brand-600">run a company.</span></>} />
          <p className="mt-5 text-[13px] leading-relaxed text-ink-500">
            Still curious? Write to <a className="font-semibold text-brand-700 underline decoration-brand-200 underline-offset-4" href="mailto:hello@businesslife.app">hello@businesslife.app</a> and a human will answer.
          </p>
        </div>
        <div className="divide-y divide-line">
          {FAQS.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {faq.q}
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink/5 text-ink-500 transition group-open:rotate-45 group-open:bg-brand-600 group-open:text-white">
                  <span className="text-lg leading-none">+</span>
                </span>
              </summary>
              <p className="mt-3 max-w-2xl pr-8 text-[13.5px] leading-relaxed text-ink-500">{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function FinalCta() {
  return (
    <section className="bg-paper pb-16 pt-16 sm:pb-24 sm:pt-20">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-[32px] bg-ink-950 px-6 pb-0 pt-12 text-center text-white sm:px-10 sm:pt-16">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(201,242,105,0.16),transparent_70%)]" />
          <div className="relative mx-auto max-w-2xl">
            <SectionTag dark>Meridian City is open</SectionTag>
            <h2 className="mt-5 font-display text-[38px] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-[56px]">
              You have read enough.
              <br />
              <span className="text-lime">Run a company.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-[14.5px] leading-relaxed text-white/55">
              Four industries, thirty-six months and one question that never leaves you: what would you actually do?
              Start free in your browser.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-2.5 sm:flex-row">
              <ButtonLink to="/play" size="lg" variant="lime" className="justify-center">
                Start your company — free
                <ArrowRight className="size-4" />
              </ButtonLink>
              <a
                href="mailto:programmes@businesslife.app"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-white/15 px-7 text-[15px] font-semibold text-white/80 transition hover:border-white/30 hover:text-white"
              >
                For programmes
              </a>
            </div>
            <p className="mt-4 text-[10.5px] text-white/30">No credit card. No download. Saved in your browser.</p>
          </div>
          <div className="relative mt-10 h-32 overflow-hidden sm:h-40">
            <Skyline className="absolute inset-x-0 bottom-0 w-full opacity-90" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink-950 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  )
}
