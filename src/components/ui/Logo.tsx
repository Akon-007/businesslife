import { clsx } from 'clsx'

export function Logo({
  className,
  dark = false,
  compact = false,
}: {
  className?: string
  dark?: boolean
  compact?: boolean
}) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={compact ? 'size-8' : 'size-9'} dark={dark} />
      <span
        className={clsx(
          'font-display text-[19px] font-bold tracking-[-0.03em] leading-none',
          dark ? 'text-white' : 'text-ink',
        )}
      >
        BUSINESS<span className={dark ? 'text-lime' : 'text-brand-600'}>LIFE</span>
      </span>
    </span>
  )
}

export function LogoMark({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <span
      className={clsx(
        'relative grid place-items-center overflow-hidden rounded-[11px] shadow-[0_2px_6px_rgba(6,19,31,0.18)]',
        dark ? 'bg-white/10 ring-1 ring-white/15' : 'bg-ink',
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" className="size-full" fill="none">
        <path
          d="M6.5 22.6h19M9.4 22.6V15l6.6-4 6.6 4v7.6"
          stroke="var(--color-lime)"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13.4 22.6v-4.7h5.2v4.7" stroke="var(--color-lime)" strokeWidth="2.1" strokeLinejoin="round" />
        <circle cx="16" cy="7.6" r="1.8" fill="var(--color-gold)" />
        <path d="M16 9.4V11" stroke="var(--color-gold)" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </span>
  )
}
