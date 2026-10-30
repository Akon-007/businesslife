import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Boxes, Building2, Handshake, Landmark, MapPin, ShieldAlert, Store, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { CityScene, LANDMARKS, SCENE, landmarkAnchor, type LandmarkId } from './CityScene'

const ICONS: Record<LandmarkId, LucideIcon> = {
  hq: Building2,
  market: Store,
  talent: Users,
  bank: Landmark,
  investors: Handshake,
  crisis: ShieldAlert,
  suppliers: Boxes,
  expansion: MapPin,
}

export type PinBadge = { label: string; tone?: 'good' | 'warn' | 'bad' | 'info' }

export function CityMap({
  className,
  activeId,
  onSelect,
  badges,
  variant = 'hero',
  interactive = true,
  showLabels = true,
  focusHref,
}: {
  className?: string
  activeId?: LandmarkId | null
  onSelect?: (id: LandmarkId) => void
  badges?: Partial<Record<LandmarkId, PinBadge>>
  variant?: 'hero' | 'game'
  interactive?: boolean
  showLabels?: boolean
  focusHref?: string
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState({ scale: 1, offsetX: 0, offsetY: 0 })
  const [hovered, setHovered] = useState<LandmarkId | null>(null)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      const scale = Math.max(width / SCENE.width, height / SCENE.height)
      setMap({ scale, offsetX: (width - SCENE.width * scale) / 2, offsetY: (height - SCENE.height * scale) / 2 })
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!interactive) setHovered(null)
  }, [interactive])

  return (
    <div
      ref={wrapRef}
      className={clsx(
        'overflow-hidden',
        !/(^|\s)(absolute|fixed|relative|sticky)(\s|$)/.test(className ?? '') && 'relative',
        className,
      )}
    >
      <CityScene activeId={activeId ?? hovered} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_10%,transparent_40%,rgba(7,23,37,0.16)_100%)]" />

      {(() => {
        const width = wrapRef.current?.clientWidth ?? 2000
        const height = wrapRef.current?.clientHeight ?? 900
        const narrow = width < 640
        const edge = narrow ? 44 : 78
        const minGapX = narrow ? 96 : 156
        const stepY = narrow ? 56 : 72
        const placed: { x: number; y: number }[] = []

        return LANDMARKS.map((landmark) => {
          const anchor = landmarkAnchor(landmark)
          const rawX = anchor.x * map.scale + map.offsetX
          const rawY = anchor.y * map.scale + map.offsetY
          const x = Math.min(Math.max(rawX, edge), width - edge)
          const minY = 84
          const maxY = height - 14
          const startY = Math.min(Math.max(rawY, minY), maxY)
          const isFree = (candidate: number) =>
            !placed.some((p) => Math.abs(p.x - x) < minGapX && Math.abs(p.y - candidate) < stepY)
          let y = startY
          for (let step = 1; !isFree(y) && step <= 8; step++) {
            const up = Math.min(Math.max(rawY - step * stepY, minY), maxY)
            if (isFree(up)) {
              y = up
              break
            }
            const down = Math.min(Math.max(rawY + step * stepY, minY), maxY)
            if (isFree(down)) {
              y = down
              break
            }
          }
          placed.push({ x, y })

          if (rawX < -60 || rawX > width + 60 || rawY < -40) return null

          const Icon = ICONS[landmark.id]
          const badge = badges?.[landmark.id]
          const isActive = activeId === landmark.id
          const isHovered = hovered === landmark.id

          return (
            <div
              key={landmark.id}
              className="absolute z-20 -translate-x-1/2 -translate-y-full"
              style={{ left: x, top: y }}
              onMouseEnter={() => interactive && setHovered(landmark.id)}
              onMouseLeave={() => setHovered(null)}
            >
            {interactive ? (
              <button
                type="button"
                aria-label={`${landmark.label}. ${landmark.description}`}
                onClick={() => onSelect?.(landmark.id)}
                className={clsx(
                  'group relative flex flex-col items-center outline-offset-8 transition-transform duration-300 hover:-translate-y-1.5',
                  isActive && '-translate-y-1.5',
                )}
              >
                <LandmarkPin
                  landmark={landmark}
                  Icon={Icon}
                  badge={badge}
                  active={isActive}
                  showLabel={showLabels}
                  variant={variant}
                />
              </button>
            ) : (
              <div className="flex flex-col items-center">
                <LandmarkPin landmark={landmark} Icon={Icon} badge={badge} active={isActive} showLabel={showLabels} variant={variant} />
              </div>
            )}

            {variant === 'hero' && (
              <div
                className={clsx(
                  'pointer-events-none absolute left-1/2 top-full z-30 w-64 -translate-x-1/2 pt-3 transition duration-200',
                  isHovered ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
                )}
              >
                <div className="glass-strong rounded-2xl p-3.5 text-left">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: landmark.color }} />
                    <p className="text-[13px] font-bold text-ink">{landmark.label}</p>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{landmark.description}</p>
                  {focusHref && (
                    <a
                      href={focusHref}
                      className="pointer-events-auto mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-brand-700 hover:text-brand-600"
                    >
                      Open in the demo →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )
        })
      })()}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/10 to-transparent" />
    </div>
  )
}

function LandmarkPin({
  landmark,
  Icon,
  badge,
  active,
  showLabel,
  variant,
}: {
  landmark: (typeof LANDMARKS)[number]
  Icon: LucideIcon
  badge?: PinBadge
  active?: boolean
  showLabel: boolean
  variant: 'hero' | 'game'
}) {
  const toneClass =
    badge?.tone === 'bad'
      ? 'bg-coral text-white'
      : badge?.tone === 'warn'
        ? 'bg-gold text-ink'
        : badge?.tone === 'good'
          ? 'bg-brand-600 text-white'
          : 'bg-ink text-white'

  return (
    <>
      <span
        className={clsx(
          'relative flex items-center gap-2 rounded-full border bg-white/95 py-1.5 pl-1.5 pr-2.5 shadow-[0_10px_24px_-10px_rgba(6,19,31,0.55)] backdrop-blur-md transition duration-200',
          active ? 'border-transparent ring-2 ring-offset-2 ring-offset-white/0' : 'border-white/80 hover:border-white',
          variant === 'game' ? 'gap-2 py-2 pl-2 pr-3' : '',
        )}
        style={active ? ({ '--tw-ring-color': landmark.color } as CSSProperties) : undefined}
      >
        <span
          className={clsx('grid place-items-center rounded-full text-white shadow-inner', variant === 'game' ? 'size-8' : 'size-7')}
          style={{ background: landmark.color }}
        >
          <Icon className={variant === 'game' ? 'size-4' : 'size-3.5'} strokeWidth={2.3} />
        </span>
        <span className={clsx('text-[11.5px] font-bold tracking-[-0.01em] text-ink', showLabel ? 'block' : 'hidden sm:block')}>
          {landmark.short}
        </span>
        {badge && (
          <span className={clsx('rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums', toneClass)}>
            {badge.label}
          </span>
        )}
        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-white" style={{ background: landmark.color }} />
      </span>

      <span className="relative mt-0 h-5 w-[2px] bg-gradient-to-b from-ink/30 to-ink/5" aria-hidden />
      <span className="relative -mt-1 grid place-items-center" aria-hidden>
        <span className="absolute size-7 rounded-full opacity-40" style={{ background: landmark.color, animation: 'pin-pulse 2.6s ease-out infinite' }} />
        <span className="size-2.5 rounded-full border-2 border-white shadow" style={{ background: landmark.color }} />
      </span>
    </>
  )
}
