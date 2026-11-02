import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { money } from '../../lib/format'

export function PanelSection({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string
  hint?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('rounded-2xl border border-line bg-white p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.13em] text-ink-400">{title}</h3>
          {hint && <p className="mt-1 text-[11.5px] leading-snug text-ink-500">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function Stat({
  label,
  value,
  sub,
  tone = 'neutral',
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  tone?: 'neutral' | 'good' | 'bad' | 'warn'
  className?: string
}) {
  return (
    <div className={clsx('rounded-xl bg-paper-3/70 px-3 py-2.5', className)}>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink-400">{label}</p>
      <p
        className={clsx(
          'mt-1 font-display text-[17px] font-semibold leading-none tabular-nums',
          tone === 'good' && 'text-brand-700',
          tone === 'bad' && 'text-coral',
          tone === 'warn' && 'text-[#9a6b12]',
          tone === 'neutral' && 'text-ink',
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[10px] leading-tight text-ink-400">{sub}</p>}
    </div>
  )
}

export function RangeRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  helper,
  accent = 'brand',
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format: (value: number) => string
  helper?: string
  accent?: 'brand' | 'coral' | 'violet'
  disabled?: boolean
}) {
  const fill = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const color = accent === 'coral' ? '#e05a3f' : accent === 'violet' ? '#7c6cf6' : '#0b8550'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-[11.5px] font-semibold text-ink-600">{label}</label>
        <span className="font-display text-[15px] font-semibold tabular-nums text-ink">{format(value)}</span>
      </div>
      <div className="relative mt-2">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full" style={{ width: `${fill}%`, background: color }} />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          aria-label={label}
          className="relative h-5 w-full cursor-pointer appearance-none bg-transparent disabled:cursor-not-allowed disabled:opacity-50 [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-ink [&::-moz-range-thumb]:shadow [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-ink [&::-webkit-slider-thumb]:shadow-md"
        />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2 text-[10px] text-ink-400">
        <span>{format(min)}</span>
        {helper && <span className="text-center">{helper}</span>}
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

export function Meter({
  label,
  value,
  suffix,
  tone = 'brand',
}: {
  label: string
  value: number
  suffix?: string
  tone?: 'brand' | 'gold' | 'coral' | 'violet'
}) {
  const color = tone === 'gold' ? '#e3a41c' : tone === 'coral' ? '#e05a3f' : tone === 'violet' ? '#7c6cf6' : '#12a060'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-semibold text-ink-600">{label}</span>
        <span className="font-bold tabular-nums text-ink">
          {Math.round(value)}
          {suffix}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }}
        />
      </div>
    </div>
  )
}

export function moneyShort(n: number) {
  return money(n, { compact: true })
}

export function deltaLabel(value: number, format: (n: number) => string = moneyShort) {
  if (Math.abs(value) < 0.05) return 'no change'
  return `${value > 0 ? '+' : '−'}${format(Math.abs(value))}`
}

export function effectLabel(key: string, value: number): string | null {
  switch (key) {
    case 'cash':
      return `${value > 0 ? '+' : '−'}${money(Math.abs(value))} cash`
    case 'customersPct':
      return `${value > 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(0)}% customers`
    case 'customersAdd':
      return `${value > 0 ? '+' : '−'}${Math.abs(value)} customers`
    case 'quality':
      return `${value > 0 ? '+' : '−'}${Math.abs(value)} quality`
    case 'reputation':
      return `${value > 0 ? '+' : '−'}${Math.abs(value)} reputation`
    case 'morale':
      return `${value > 0 ? '+' : '−'}${Math.abs(value)} morale`
    case 'debt':
      return `${value > 0 ? '+' : '−'}${money(Math.abs(value))} debt`
    case 'marketing':
      return `Marketing set to ${money(value)}`
    case 'acquisitionMult':
      return 'Company acquired'
    default:
      return null
  }
}
