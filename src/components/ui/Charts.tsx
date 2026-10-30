import { useId } from 'react'

export function Sparkline({
  data,
  color = 'var(--color-brand-500)',
  height = 48,
  strokeWidth = 2.25,
  fill = true,
  className,
}: {
  data: number[]
  color?: string
  height?: number
  strokeWidth?: number
  fill?: boolean
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const width = 120
  const values = data.length > 1 ? data : [...data, ...data]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = 4
  const points = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (value - min) / span) * (height - pad * 2)
    return [x, y] as const
  })
  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${width - pad},${height - pad} L${pad},${height - pad} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ height, width: '100%' }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.24" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#spark-${id})`} />}
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export function BarRow({
  label,
  value,
  max,
  color = 'var(--color-brand-500)',
  valueLabel,
}: {
  label: string
  value: number
  max: number
  color?: string
  valueLabel?: string
}) {
  const width = Math.max(2, Math.min(100, (Math.abs(value) / Math.max(1, max)) * 100))
  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="text-ink-600">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{valueLabel ?? Math.round(value).toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/[0.06]">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  )
}
