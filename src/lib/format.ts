export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export const money = (n: number, opts: { compact?: boolean; sign?: boolean } = {}) => {
  const { compact = false, sign = false } = opts
  const abs = Math.abs(n)
  let value = n
  let suffix = ''

  if (compact) {
    if (abs >= 1_000_000_000) {
      value = n / 1_000_000_000
      suffix = 'B'
    } else if (abs >= 1_000_000) {
      value = n / 1_000_000
      suffix = 'M'
    } else if (abs >= 10_000) {
      value = n / 1_000
      suffix = 'k'
    }
  }

  const digits = compact && Math.abs(value) < 100 ? 1 : 0
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'standard',
    maximumFractionDigits: suffix ? digits : 0,
  }).format(Math.abs(value))

  const prefix = n < 0 ? '-' : sign && n > 0 ? '+' : ''
  return `${prefix}${formatted}${suffix}`
}

export const number = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n))

export const percent = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`

export const monthLabel = (index: number) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const start = new Date(2026, 0, 1)
  const date = new Date(start.getFullYear(), start.getMonth() + index, 1)
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

export const rand = (min: number, max: number) => min + Math.random() * (max - min)

export const roundTo = (n: number, step: number) => Math.round(n / step) * step

export const sum = <T,>(arr: readonly T[], fn: (item: T) => number) => arr.reduce((acc, item) => acc + fn(item), 0)

export const plural = (n: number, word: string, pluralWord?: string) =>
  `${number(n)} ${n === 1 ? word : (pluralWord ?? `${word}s`)}`
