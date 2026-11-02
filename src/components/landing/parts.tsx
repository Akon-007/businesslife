import { useEffect, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { ArrowUpRight, Radio } from 'lucide-react'
import { clsx } from 'clsx'

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function SectionTag({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]',
        dark ? 'bg-white/10 text-lime ring-1 ring-white/15' : 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
      )}
    >
      <span className={clsx('size-1.5 rounded-full', dark ? 'bg-lime' : 'bg-brand-500')} />
      {children}
    </span>
  )
}

export function AvatarStack({ count = 4, className }: { count?: number; className?: string }) {
  const people = [
    { initials: 'AO', color: '#0b8550' },
    { initials: 'ZK', color: '#7c6cf6' },
    { initials: 'TM', color: '#2f80c7' },
    { initials: 'LS', color: '#e05a3f' },
    { initials: 'HN', color: '#b07a1e' },
  ].slice(0, count)

  return (
    <span className={clsx('flex items-center', className)}>
      {people.map((person, index) => (
        <span
          key={person.initials}
          className="grid size-8 place-items-center rounded-full border-2 border-white text-[9.5px] font-bold text-white shadow-sm"
          style={{ background: person.color, marginLeft: index === 0 ? 0 : -9, zIndex: people.length - index }}
        >
          {person.initials}
        </span>
      ))}
    </span>
  )
}

const FEED = [
  { text: 'Sable Capital closed a $400k seed round', tag: 'Funding', tone: 'good' },
  { text: 'A price war just broke out in Market Plaza', tag: 'Market', tone: 'bad' },
  { text: 'A team of four hit $50k MRR in month 22', tag: 'Milestone', tone: 'good' },
  { text: 'A supplier shock hit three food companies', tag: 'Crisis', tone: 'bad' },
  { text: 'Kite & Co signed its first enterprise account', tag: 'Revenue', tone: 'good' },
  { text: 'A founder paused hiring to protect runway', tag: 'Strategy', tone: 'neutral' },
]

export function LiveFeed({ className }: { className?: string }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % FEED.length), 3800)
    return () => window.clearInterval(timer)
  }, [])

  const visible = [0, 1, 2].map((offset) => FEED[(index + offset) % FEED.length])

  return (
    <div className={clsx('glass-strong rounded-[24px] p-4 sm:p-5', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative grid size-7 place-items-center rounded-full bg-coral/15 text-coral">
            <Radio className="size-3.5" />
            <span className="absolute inset-0 animate-ping rounded-full border border-coral/30" />
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-ink-600">Live from Meridian City</p>
        </div>
        <span className="rounded-full bg-ink/5 px-2 py-1 text-[10px] font-bold text-ink-500">· 2,341 playing</span>
      </div>
      <div className="mt-3.5 space-y-2">
        {visible.map((item, i) => (
          <div
            key={`${item.text}-${i}`}
            className={clsx(
              'flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-500',
              i === 0 ? 'bg-paper-2 shadow-[0_1px_0_rgba(10,29,46,0.04)]' : 'opacity-45',
            )}
          >
            <span
              className={clsx(
                'size-1.5 shrink-0 rounded-full',
                item.tone === 'good' ? 'bg-brand-500' : item.tone === 'bad' ? 'bg-coral' : 'bg-ink-300',
              )}
            />
            <p className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-ink-700">{item.text}</p>
            <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-[0.08em] text-ink-400">
              {item.tag}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Skyline({ className, tone = 'lime' }: { className?: string; tone?: 'lime' | 'brand' }) {
  const color = tone === 'lime' ? '#c9f269' : '#0b8550'
  const buildings = [
    [0, 70, 26, 60], [30, 46, 32, 84], [66, 84, 22, 46], [92, 24, 36, 106], [132, 62, 24, 68],
    [160, 38, 42, 92], [206, 78, 26, 52], [236, 10, 30, 120], [270, 54, 36, 76], [310, 70, 24, 60],
    [338, 32, 40, 98], [382, 58, 28, 72], [414, 82, 24, 48], [442, 20, 32, 110], [478, 60, 36, 70],
    [518, 44, 26, 86], [548, 74, 32, 56],
  ]
  return (
    <svg viewBox="0 0 580 160" preserveAspectRatio="xMidYMax meet" className={className} aria-hidden>
      {buildings.map(([x, y, w, h], index) => (
        <g key={index}>
          <rect x={x} y={y} width={w} height={h} rx="2" fill={index % 3 === 0 ? color : index % 3 === 1 ? '#0c3045' : '#123c52'} opacity={index % 3 === 0 ? 0.9 : 1} />
          {Array.from({ length: Math.floor(h / 16) }).map((_, row) =>
            Array.from({ length: Math.max(1, Math.floor(w / 12)) }).map((__, col) => (
              <rect
                key={`${row}-${col}`}
                x={x + 5 + col * 12}
                y={y + 7 + row * 16}
                width="5"
                height="6"
                rx="1"
                fill={index % 5 === 0 ? '#ffc94a' : '#dff3ea'}
                opacity={row % 4 === 0 ? 0.9 : 0.35}
              />
            )),
          )}
        </g>
      ))}
    </svg>
  )
}

export function MiniMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tracking-[-0.03em] text-ink">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-500">{sub}</p>}
    </div>
  )
}

export function InlineLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="group inline-flex items-center gap-1.5 text-[13px] font-bold text-brand-700">
      {children}
      <ArrowUpRight className="size-3.5 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </a>
  )
}
