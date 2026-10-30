import { clsx } from 'clsx'
import type { CSSProperties } from 'react'

const O = { x: 800, y: 96 }
const TW = 72
const TH = 36

type Pt = { x: number; y: number }

const iso = (x: number, y: number): Pt => ({ x: O.x + (x - y) * (TW / 2), y: O.y + (x + y) * (TH / 2) })
const up = (p: Pt, h: number): Pt => ({ x: p.x, y: p.y - h })
const poly = (points: Pt[]) => points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

export type LandmarkId = 'hq' | 'market' | 'talent' | 'bank' | 'investors' | 'crisis' | 'suppliers' | 'expansion'

export type Landmark = {
  id: LandmarkId
  label: string
  short: string
  description: string
  x: number
  y: number
  w: number
  d: number
  h: number
  color: string
  soft: string
}

export const LANDMARKS: Landmark[] = [
  {
    id: 'hq',
    label: 'Headquarters',
    short: 'HQ',
    description: 'Set your price, invest in the product and keep your culture intact.',
    x: 3.2,
    y: 4.2,
    w: 2.6,
    d: 2.0,
    h: 172,
    color: '#0b8550',
    soft: '#d2f6e1',
  },
  {
    id: 'talent',
    label: 'Talent Hub',
    short: 'Talent',
    description: 'Hire builders, sellers and operators. Every salary changes your runway.',
    x: 2.4,
    y: 10.2,
    w: 2.6,
    d: 2.0,
    h: 98,
    color: '#7c6cf6',
    soft: '#e8e4ff',
  },
  {
    id: 'bank',
    label: 'Meridian Bank',
    short: 'Bank',
    description: 'Take credit, repay debt and protect the cash that keeps you alive.',
    x: 8.6,
    y: 12.4,
    w: 3.0,
    d: 2.2,
    h: 86,
    color: '#b07a1e',
    soft: '#ffe9ae',
  },
  {
    id: 'market',
    label: 'Market Plaza',
    short: 'Market',
    description: 'Win customers with price, product and marketing — then watch churn.',
    x: 11.6,
    y: 8.7,
    w: 3.0,
    d: 2.2,
    h: 70,
    color: '#e05a3f',
    soft: '#ffe0dc',
  },
  {
    id: 'investors',
    label: 'Investor Row',
    short: 'Investors',
    description: 'Pitch the story, negotiate terms and decide how much equity to give away.',
    x: 15.9,
    y: 2.5,
    w: 2.6,
    d: 2.2,
    h: 198,
    color: '#2f80c7',
    soft: '#cbe8f7',
  },
  {
    id: 'crisis',
    label: 'Crisis Ops',
    short: 'Crisis',
    description: 'Supplier shocks, key departures, price wars. Decide fast and own the outcome.',
    x: 18.0,
    y: 12.0,
    w: 2.2,
    d: 2.0,
    h: 132,
    color: '#d9483b',
    soft: '#ffd7d1',
  },
  {
    id: 'suppliers',
    label: 'Supply Depot',
    short: 'Supply',
    description: 'Pick who you buy from, choose your stock cover and keep the shelves full.',
    x: 4.8,
    y: 12.8,
    w: 2.4,
    d: 1.8,
    h: 66,
    color: '#6f8f3f',
    soft: '#eef2cf',
  },
  {
    id: 'expansion',
    label: 'Expansion District',
    short: 'Expand',
    description: 'Open a second market. Capex and overhead today, demand tomorrow.',
    x: 16.2,
    y: 8.6,
    w: 2.6,
    d: 1.8,
    h: 62,
    color: '#c4811a',
    soft: '#fbe9c9',
  },
]

export const landmarkAnchor = (landmark: Landmark): Pt => {
  const center = iso(landmark.x + landmark.w / 2, landmark.y + landmark.d / 2)
  return { x: center.x, y: center.y - landmark.h }
}

export const SCENE = { width: 1600, height: 900 }

const shades = {
  glass: { top: '#d8f1ea', left: '#9bd0c8', right: '#6aaca3', window: '#effff9' },
  deepGlass: { top: '#bcd9e7', left: '#6f9db4', right: '#507b91', window: '#e5f6ff' },
  mint: { top: '#d7f1c8', left: '#a6d794', right: '#7cb56c', window: '#f1ffe7' },
  coral: { top: '#ffc3b2', left: '#ee8c75', right: '#cf6a53', window: '#fff3ed' },
  gold: { top: '#ffe4ad', left: '#e8b466', right: '#c18d3f', window: '#fff9e7' },
  violet: { top: '#d7d0ff', left: '#a99bf1', right: '#8675d8', window: '#f6f2ff' },
  sand: { top: '#fff0cf', left: '#e6d0a1', right: '#c9b07c', window: '#fffaea' },
  slate: { top: '#b7c8d5', left: '#71899c', right: '#526b7e', window: '#e8f5ff' },
  cream: { top: '#fff8e6', left: '#ecdbb8', right: '#cfbc93', window: '#fffdf5' },
}

type Shade = (typeof shades)[keyof typeof shades]

function Building({
  x,
  y,
  w,
  d,
  h,
  shade,
  rows = 3,
  cols = 3,
  windows = true,
  windowInset = 0.16,
  opacity = 1,
}: {
  x: number
  y: number
  w: number
  d: number
  h: number
  shade: Shade
  rows?: number
  cols?: number
  windows?: boolean
  windowInset?: number
  opacity?: number
}) {
  const p00 = iso(x, y)
  const p10 = iso(x + w, y)
  const p11 = iso(x + w, y + d)
  const p01 = iso(x, y + d)
  const t00 = up(p00, h)
  const t10 = up(p10, h)
  const t11 = up(p11, h)
  const t01 = up(p01, h)

  const center = iso(x + w / 2, y + d / 2)
  const shadow = (
    <ellipse cx={center.x + 8} cy={center.y + 2} rx={(w + d) * 21} ry={(w + d) * 9.5} fill="#204a2c" opacity={0.14} />
  )

  const windowsFor = (a: Pt, b: Pt) => {
    if (!windows) return null
    const cells = []
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const t0 = windowInset + (j / cols) * (1 - windowInset * 2)
        const t1 = windowInset + ((j + 0.62) / cols) * (1 - windowInset * 2)
        const u0 = 0.16 + (i / rows) * 0.72
        const u1 = 0.16 + ((i + 0.5) / rows) * 0.72
        const q = (t: number, u: number) => ({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t - h * u,
        })
        const q0 = q(t0, u0)
        const q1 = q(t1, u0)
        const q2 = q(t1, u1)
        const q3 = q(t0, u1)
        const lit = (i * 7 + j * 3 + Math.round(x + y)) % 5 !== 0
        cells.push(
          <polygon
            key={`${i}-${j}-${a.x}-${b.x}`}
            points={poly([q0, q1, q2, q3])}
            fill={lit ? shade.window : '#274b55'}
            opacity={lit ? 0.82 : 0.22}
          />,
        )
      }
    }
    return cells
  }

  return (
    <g opacity={opacity}>
      {shadow}
      <polygon points={poly([p01, p11, t11, t01])} fill={shade.left} />
      <polygon points={poly([p11, p10, t10, t11])} fill={shade.right} />
      {windowsFor(p01, p11)}
      {windowsFor(p11, p10)}
      <polygon points={poly([t00, t10, t11, t01])} fill={shade.top} />
      <polygon points={poly([p01, p11, t11, t01])} fill="none" stroke="#06202b" strokeOpacity={0.07} strokeWidth={1.2} />
      <polygon points={poly([p11, p10, t10, t11])} fill="none" stroke="#06202b" strokeOpacity={0.07} strokeWidth={1.2} />
      <polygon points={poly([t00, t10, t11, t01])} fill="none" stroke="#06202b" strokeOpacity={0.06} strokeWidth={1.2} />
    </g>
  )
}

function RoofUnit({ x, y, w, d, h = 8, color = '#d5dfe6', top = '#edf4f8' }: { x: number; y: number; w: number; d: number; h?: number; color?: string; top?: string }) {
  const p00 = iso(x, y)
  const p10 = iso(x + w, y)
  const p11 = iso(x + w, y + d)
  const p01 = iso(x, y + d)
  return (
    <g>
      <polygon points={poly([p01, p11, up(p11, h), up(p01, h)])} fill={color} />
      <polygon points={poly([p11, p10, up(p10, h), up(p11, h)])} fill={color} />
      <polygon points={poly([up(p00, h), up(p10, h), up(p11, h), up(p01, h)])} fill={top} />
    </g>
  )
}

function Tree({ x, y, scale = 1, tone = 'deep' }: { x: number; y: number; scale?: number; tone?: 'deep' | 'light' | 'gold' }) {
  const p = iso(x, y)
  const colors =
    tone === 'light'
      ? { dark: '#7fbe6d', mid: '#9fd48a', light: '#c3e8af' }
      : tone === 'gold'
        ? { dark: '#d6a742', mid: '#ecc35d', light: '#f7dc93' }
        : { dark: '#39874f', mid: '#52a965', light: '#78c586' }
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${scale})`}>
      <ellipse cx="2" cy="0" rx="13" ry="5.5" fill="#1f4a2d" opacity="0.16" />
      <rect x="-2" y="-24" width="4" height="24" rx="2" fill="#8a6b4a" />
      <circle cx="-7" cy="-30" r="10" fill={colors.dark} />
      <circle cx="7" cy="-32" r="11" fill={colors.mid} />
      <circle cx="0" cy="-41" r="10" fill={colors.light} />
      <circle cx="-3" cy="-33" r="8" fill={colors.mid} opacity="0.9" />
    </g>
  )
}

function Person({ x, y, shirt = '#ff6f61' }: { x: number; y: number; shirt?: string }) {
  const p = iso(x, y)
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <ellipse cx="1" cy="0" rx="4.5" ry="2" fill="#1f4a2d" opacity="0.2" />
      <rect x="-2" y="-9" width="4" height="9" rx="2" fill="#243848" />
      <rect x="-3.4" y="-15" width="6.8" height="8" rx="3" fill={shirt} />
      <circle cx="0" cy="-18" r="3.2" fill="#6b4a35" />
    </g>
  )
}

function Car({ color = '#f2c14e', delay = 0, dur = 26, path, reverse = false }: { color?: string; delay?: number; dur?: number; path: string; reverse?: boolean }) {
  return (
    <g>
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" path={path} rotate="auto" keyPoints={reverse ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" />
      <ellipse cx="1" cy="4" rx="19" ry="6" fill="#183325" opacity="0.18" />
      <rect x="-16" y="-8" width="32" height="12" rx="4" fill={color} />
      <rect x="-8" y="-13" width="17" height="9" rx="3.5" fill={color} />
      <rect x="-5" y="-11.5" width="11" height="6" rx="2" fill="#dff4f7" opacity="0.9" />
      <circle cx="-10" cy="5" r="3.4" fill="#243038" />
      <circle cx="10" cy="5" r="3.4" fill="#243038" />
      <rect x="14" y="-6" width="3" height="3" rx="1" fill="#fff6c9" />
    </g>
  )
}

function MarketStall({ x, y, stripe = '#ff6f61' }: { x: number; y: number; stripe?: string }) {
  const p = iso(x, y)
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <ellipse cx="4" cy="4" rx="32" ry="12" fill="#204a2c" opacity="0.15" />
      <rect x="-20" y="-4" width="40" height="16" rx="4" fill="#f7e9cd" />
      <rect x="-18" y="1" width="36" height="4" rx="2" fill="#d9bd90" />
      <rect x="-22" y="-26" width="44" height="10" rx="3" fill={stripe} />
      <path d="M-22 -16h44l-5 7h-34z" fill={stripe} opacity="0.85" />
      <path d="M-22 -16h44l-5 7h-34z" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1" />
      <rect x="-18" y="-30" width="4" height="28" rx="2" fill="#916c45" />
      <rect x="14" y="-30" width="4" height="28" rx="2" fill="#916c45" />
      <circle cx="-8" cy="-8" r="3.4" fill="#ffc94a" />
      <circle cx="2" cy="-8" r="3.4" fill="#7cc586" />
      <circle cx="11" cy="-8" r="3.4" fill="#ff8f73" />
    </g>
  )
}

function Fountain({ x, y }: { x: number; y: number }) {
  const p = iso(x, y)
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <ellipse cx="0" cy="0" rx="32" ry="16" fill="#dcd6c4" />
      <ellipse cx="0" cy="-2" rx="26" ry="12" fill="#8fd0ef" />
      <ellipse cx="0" cy="-3" rx="18" ry="8" fill="#c8ecf8" opacity="0.9" />
      <rect x="-2.5" y="-20" width="5" height="18" rx="2" fill="#ece5d2" />
      <circle cx="0" cy="-24" r="4" fill="#dff7ff" />
      <path d="M0 -24c-10 4 -14 12 -14 18M0 -24c10 4 14 12 14 18" stroke="#dff7ff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
    </g>
  )
}

function LandmarkHalo({ landmark, active }: { landmark: Landmark; active?: boolean }) {
  const c = iso(landmark.x + landmark.w / 2, landmark.y + landmark.d / 2)
  const span = landmark.w + landmark.d
  return (
    <g pointerEvents="none">
      <ellipse
        cx={c.x}
        cy={c.y + 4}
        rx={span * 23}
        ry={span * 11.5}
        fill={landmark.color}
        opacity={active ? 0.16 : 0.07}
        stroke={landmark.color}
        strokeOpacity={active ? 0.5 : 0.22}
        strokeWidth={active ? 2 : 1.2}
        strokeDasharray={active ? undefined : '5 7'}
      />
      {active && (
        <ellipse cx={c.x} cy={c.y + 4} rx={span * 23} ry={span * 11.5} fill="none" stroke={landmark.color} strokeWidth="2" opacity="0.5">
          <animate attributeName="rx" values={`${span * 23};${span * 30}`} dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="ry" values={`${span * 11.5};${span * 15}`} dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.45;0" dur="1.8s" repeatCount="indefinite" />
        </ellipse>
      )}
    </g>
  )
}

function Flags({ x, y, h }: { x: number; y: number; h: number }) {
  const p = iso(x, y)
  return (
    <g transform={`translate(${p.x} ${p.y - h})`}>
      <rect x="-1" y="-46" width="2" height="46" fill="#5b7083" />
      <g style={{ transformOrigin: '0px -44px' }} className="flag-wave">
        <path d="M1 -44c9 -4 14 4 24 0v15c-10 4 -15 -4 -24 0z" fill="#c9f269" stroke="#0a1d2e" strokeOpacity="0.15" />
      </g>
      <circle cx="0" cy="-47" r="2.6" fill="#ffc94a" />
    </g>
  )
}

function HQ({ landmark }: { landmark: Landmark }) {
  const { x, y, w, d, h } = landmark
  return (
    <g>
      <Building x={x} y={y} w={w} d={d} h={h} shade={shades.glass} rows={8} cols={4} />
      <RoofUnit x={x + 0.4} y={y + 0.5} w={1.1} d={0.8} h={12} />
      <RoofUnit x={x + 1.6} y={y + 0.4} w={0.6} d={0.6} h={8} color="#9fbfae" top="#cfe7d7" />
      <Flags x={x + 1.6} y={y + 1.5} h={h + 12} />
      <g>
        {[0.3, 0.9, 1.5].map((dx, i) => (
          <Tree key={i} x={x + dx} y={y + 1.7} scale={0.55} tone="light" />
        ))}
      </g>
    </g>
  )
}

function TallTower({ landmark }: { landmark: Landmark }) {
  const { x, y, w, d, h } = landmark
  return (
    <g>
      <Building x={x} y={y} w={w} d={d} h={h} shade={shades.deepGlass} rows={10} cols={4} />
      <Building x={x + 0.55} y={y + 0.45} w={w - 1.1} d={d - 0.9} h={h + 26} shade={shades.glass} rows={3} cols={3} />
      <RoofUnit x={x + 0.9} y={y + 0.8} w={0.7} d={0.5} h={7} color="#8ba7b8" top="#dcecf4" />
      <line x1={iso(x + w - 0.4, y + d - 0.4).x} y1={iso(x + w - 0.4, y + d - 0.4).y - h - 40} x2={iso(x + w - 0.4, y + d - 0.4).x} y2={iso(x + w - 0.4, y + d - 0.4).y - h - 26} stroke="#5b7083" strokeWidth="2" />
      <circle cx={iso(x + w - 0.4, y + d - 0.4).x} cy={iso(x + w - 0.4, y + d - 0.4).y - h - 42} r="2.5" fill="#ff6f61" className="blink" />
    </g>
  )
}

function MarketHall({ landmark }: { landmark: Landmark }) {
  const { x, y, w, d, h } = landmark
  const c = iso(x + w / 2, y + d / 2)
  return (
    <g>
      <Building x={x} y={y} w={w} d={d} h={h} shade={shades.coral} rows={2} cols={4} />
      <path
        d={`M${c.x - 58} ${c.y - h} Q ${c.x} ${c.y - h - 52} ${c.x + 58} ${c.y - h} Q ${c.x + 30} ${c.y - h + 8} ${c.x} ${c.y - h + 10} Q ${c.x - 30} ${c.y - h + 8} ${c.x - 58} ${c.y - h} Z`}
        fill="#ffd9c9"
        stroke="#d9785f"
        strokeWidth="2"
      />
      <path d={`M${c.x} ${c.y - h - 42} l0 -12`} stroke="#a15a43" strokeWidth="2" />
      <circle cx={c.x} cy={c.y - h - 56} r="4" fill="#ffc94a" />
    </g>
  )
}

function TalentHub({ landmark }: { landmark: Landmark }) {
  const { x, y, w, d, h } = landmark
  const c = iso(x + w / 2, y + d / 2)
  return (
    <g>
      <Building x={x} y={y} w={w} d={d} h={h} shade={shades.violet} rows={3} cols={4} />
      <path d={`M${c.x - 38} ${c.y - h + 2} Q ${c.x} ${c.y - h - 46} ${c.x + 38} ${c.y - h + 2} Z`} fill="#e8e4ff" stroke="#a99bf1" strokeWidth="2" />
      <path d={`M${c.x} ${c.y - h - 30} l0 -14`} stroke="#8675d8" strokeWidth="2" />
      <circle cx={c.x} cy={c.y - h - 47} r="3.4" fill="#ffc94a" />
      <Tree x={x + w + 0.35} y={y + d + 0.3} scale={0.7} tone="light" />
    </g>
  )
}

function BankHall({ landmark }: { landmark: Landmark }) {
  const { x, y, w, d, h } = landmark
  const front = iso(x + w, y + d)
  return (
    <g>
      <Building x={x} y={y} w={w} d={d} h={h} shade={shades.sand} rows={2} cols={3} />
      <RoofUnit x={x + 0.25} y={y + 0.3} w={w - 0.5} d={d - 0.6} h={14} color="#e6d0a1" top="#fff3d6" />
      <polygon
        points={poly([
          up(iso(x + 0.2, y + 0.5), h + 14),
          up(iso(x + w + 0.2, y + 0.5), h + 14),
          up(iso(x + w / 2, y + 0.5), h + 34),
        ])}
        fill="#f6e3b8"
        stroke="#d3bc8b"
        strokeWidth="1.4"
      />
      {[0.18, 0.38, 0.58, 0.78].map((t) => {
        const bx = front.x + (iso(x, y + d).x - front.x) * t
        const by = front.y + (iso(x, y + d).y - front.y) * t
        return <rect key={t} x={bx - 3} y={by - h * 0.62} width="6" height={h * 0.6} rx="2" fill="#fff8e6" stroke="#d3bc8b" strokeWidth="1" />
      })}
    </g>
  )
}

function OpsTower({ landmark }: { landmark: Landmark }) {
  const { x, y, w, d, h } = landmark
  const top = iso(x + w / 2, y + d / 2)
  return (
    <g>
      <Building x={x} y={y} w={w} d={d} h={h} shade={shades.slate} rows={5} cols={3} />
      <Building x={x + 0.45} y={y + 0.4} w={w - 0.9} d={d - 0.8} h={h + 18} shade={shades.coral} rows={1} cols={2} />
      <line x1={top.x} y1={top.y - h - 18} x2={top.x} y2={top.y - h - 48} stroke="#526b7e" strokeWidth="2.5" />
      <ellipse cx={top.x} cy={top.y - h - 54} rx="19" ry="7" fill="#e8f5ff" stroke="#526b7e" strokeWidth="1.4" transform={`rotate(-18 ${top.x} ${top.y - h - 54})`} />
      <circle cx={top.x} cy={top.y - h - 49} r="3" fill="#ff6f61" className="blink" />
    </g>
  )
}

function SupplyDepot({ landmark }: { landmark: Landmark }) {
  const { x, y, w, d, h } = landmark
  return (
    <g>
      <Building x={x} y={y} w={w} d={d} h={h} shade={shades.cream} rows={1} cols={5} windows={false} />
      <RoofUnit x={x + 0.25} y={y + 0.25} w={w - 0.5} d={d - 0.55} h={10} color="#dbc7a0" top="#f4e9d0" />
      {[0.25, 0.62, 0.95].map((t, i) => (
        <RoofUnit key={i} x={x + 0.2 + t * 0.35} y={y + 0.2} w={0.22} d={0.22} h={4} color="#c9b07c" top="#efe1c2" />
      ))}
      {[
        [w + 0.28, 0.35],
        [w + 0.28, 0.72],
        [w + 0.62, 0.52],
      ].map(([dx, dy], i) => {
        const p = iso(x + dx, y + dy)
        return (
          <g key={`crate-${i}`}>
            <rect x={p.x - 6} y={p.y - 10} width="12" height="10" rx="1.5" fill="#c79752" stroke="#8d6733" strokeWidth="1" />
            <line x1={p.x - 6} y1={p.y - 5} x2={p.x + 6} y2={p.y - 5} stroke="#8d6733" strokeWidth="1" />
          </g>
        )
      })}
      <Tree x={x - 0.7} y={y + d + 0.2} scale={0.55} tone="gold" />
    </g>
  )
}

function ExpansionHall({ landmark }: { landmark: Landmark }) {
  const { x, y, w, d, h } = landmark
  const base = iso(x + w * 0.28, y + d * 0.5)
  return (
    <g>
      <Building x={x} y={y} w={w * 0.46} d={d} h={h} shade={shades.gold} rows={2} cols={2} />
      <Building x={x + w * 0.56} y={y + 0.28} w={w * 0.38} d={d - 0.5} h={h * 0.68} shade={shades.sand} rows={1} cols={2} />
      <line x1={base.x} y1={base.y - h} x2={base.x} y2={base.y - h - 48} stroke="#b07a1e" strokeWidth="3" />
      <line x1={base.x - 30} y1={base.y - h - 46} x2={base.x + 44} y2={base.y - h - 46} stroke="#b07a1e" strokeWidth="2.5" />
      <line x1={base.x + 36} y1={base.y - h - 46} x2={base.x + 36} y2={base.y - h - 18} stroke="#7d5a1f" strokeWidth="1.2" />
      <rect x={base.x + 31} y={base.y - h - 18} width="10" height="8" rx="1" fill="#f0c46a" stroke="#a97d2b" strokeWidth="1" />
      <circle cx={base.x} cy={base.y - h - 49} r="3" fill="#ffc94a" className="blink" />
      <Tree x={x + w + 0.4} y={y + d - 0.2} scale={0.6} tone="light" />
    </g>
  )
}

function BackgroundCity() {
  const blocks = [
    { x: 1.0, y: 1.0, w: 1.8, d: 1.4, h: 52, s: shades.mint, r: 2, c: 2 },
    { x: 5.7, y: 0.9, w: 1.8, d: 1.6, h: 74, s: shades.glass, r: 3, c: 2 },
    { x: 1.2, y: 2.8, w: 1.3, d: 1.2, h: 36, s: shades.coral, r: 1, c: 2 },
    { x: 5.9, y: 3.0, w: 1.6, d: 1.4, h: 44, s: shades.sand, r: 2, c: 2 },
    { x: 0.8, y: 8.8, w: 1.4, d: 1.2, h: 36, s: shades.sand, r: 1, c: 2 },
    { x: 6.0, y: 9.4, w: 1.2, d: 1.2, h: 46, s: shades.mint, r: 2, c: 2 },
    { x: 0.9, y: 13.0, w: 1.5, d: 1.3, h: 40, s: shades.coral, r: 1, c: 2 },
    { x: 3.0, y: 14.4, w: 1.6, d: 1.3, h: 58, s: shades.glass, r: 3, c: 2 },
    { x: 5.2, y: 15.2, w: 1.4, d: 1.2, h: 34, s: shades.violet, r: 1, c: 2 },
    { x: 0.9, y: 17.6, w: 1.8, d: 1.4, h: 44, s: shades.cream, r: 2, c: 2 },
    { x: 12.9, y: 1.0, w: 1.5, d: 1.3, h: 62, s: shades.gold, r: 2, c: 2 },
    { x: 19.6, y: 2.7, w: 1.6, d: 1.4, h: 118, s: shades.glass, r: 5, c: 2 },
    { x: 16.9, y: 5.1, w: 1.4, d: 1.2, h: 66, s: shades.mint, r: 3, c: 2 },
    { x: 20.1, y: 5.2, w: 1.2, d: 1.1, h: 48, s: shades.coral, r: 2, c: 1 },
    { x: 10.4, y: 1.5, w: 1.4, d: 1.2, h: 40, s: shades.cream, r: 2, c: 2 },
    { x: 9.2, y: 9.1, w: 1.6, d: 1.3, h: 52, s: shades.mint, r: 2, c: 2 },
    { x: 10.0, y: 16.1, w: 1.4, d: 1.2, h: 58, s: shades.sand, r: 3, c: 2 },
    { x: 12.8, y: 16.5, w: 1.6, d: 1.3, h: 72, s: shades.glass, r: 4, c: 2 },
    { x: 15.4, y: 16.9, w: 1.3, d: 1.2, h: 48, s: shades.coral, r: 2, c: 2 },
    { x: 12.2, y: 19.4, w: 1.4, d: 1.1, h: 40, s: shades.cream, r: 2, c: 2 },
    { x: 17.0, y: 18.7, w: 1.2, d: 1.0, h: 34, s: shades.violet, r: 1, c: 2 },
  ] as const
  return (
    <g>
      {blocks.map((b, i) => (
        <g key={i}>
          <Building x={b.x} y={b.y} w={b.w} d={b.d} h={b.h} shade={b.s} rows={b.r} cols={b.c} />
          {b.h > 70 && <RoofUnit x={b.x + 0.3} y={b.y + 0.3} w={0.5} d={0.4} h={6} />}
        </g>
      ))}
    </g>
  )
}

export function CityScene({
  className,
  activeId,
  style,
}: {
  className?: string
  activeId?: LandmarkId | null
  style?: CSSProperties
}) {
  const center = iso(11, 11)
  const avenueStart = iso(0, 7.32)
  const avenueEnd = iso(22, 7.32)
  const crossStart = iso(8.05, 0)
  const crossEnd = iso(8.05, 22)

  return (
    <svg
      viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}
      preserveAspectRatio="xMidYMid slice"
      className={clsx('block size-full', className)}
      style={style}
      aria-hidden
    >
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#dff2fb" />
          <stop offset="55%" stopColor="#b9e4f5" />
          <stop offset="100%" stopColor="#8fd0ef" />
        </linearGradient>
        <linearGradient id="land" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor="#eff8dd" />
          <stop offset="52%" stopColor="#dff0c7" />
          <stop offset="100%" stopColor="#cbe6b4" />
        </linearGradient>
        <linearGradient id="park" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#d3eeb8" />
          <stop offset="100%" stopColor="#b9e09e" />
        </linearGradient>
        <pattern id="waves" width="90" height="34" patternUnits="userSpaceOnUse">
          <path d="M0 18c14 -8 24 -8 38 0s24 8 38 0" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.6" fill="none" />
        </pattern>
        <clipPath id="landclip">
          <polygon points={poly([iso(0, 0), iso(22, 0), iso(22, 22), iso(0, 22)])} />
        </clipPath>
        <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#12372a" floodOpacity="0.12" />
        </filter>
      </defs>

      <rect width={SCENE.width} height={SCENE.height} fill="url(#sea)" />
      <rect width={SCENE.width} height={SCENE.height} fill="url(#waves)" opacity="0.7" />

      <polygon points={poly([iso(0, 0), iso(22, 0), iso(22, 22), iso(0, 22)])} fill="url(#land)" stroke="#a8d194" strokeWidth="3" />
      <g clipPath="url(#landclip)">
        {Array.from({ length: 23 }).map((_, i) => (
          <g key={i} stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1">
            <line x1={iso(i, 0).x} y1={iso(i, 0).y} x2={iso(i, 22).x} y2={iso(i, 22).y} />
            <line x1={iso(0, i).x} y1={iso(0, i).y} x2={iso(22, i).x} y2={iso(22, i).y} />
          </g>
        ))}

        <polygon points={poly([iso(1, 1), iso(7.2, 1), iso(7.2, 6.2), iso(1, 6.2)])} fill="url(#park)" opacity="0.9" />
        <polygon points={poly([iso(15.6, 2.2), iso(21.8, 2.2), iso(21.8, 6.4), iso(15.6, 6.4)])} fill="url(#park)" opacity="0.75" />
        <polygon points={poly([iso(1.2, 16.2), iso(6.4, 16.2), iso(6.4, 21.6), iso(1.2, 21.6)])} fill="url(#park)" opacity="0.8" />
        <polygon points={poly([iso(9.0, 15.4), iso(11.4, 15.4), iso(11.4, 20.6), iso(9.0, 20.6)])} fill="url(#park)" opacity="0.8" />

        <polygon points={poly([iso(10.2, 7.8), iso(16.2, 7.8), iso(16.2, 12.2), iso(10.2, 12.2)])} fill="#f5edd7" opacity="0.9" />
        <polygon points={poly([iso(9.4, 1.0), iso(14.6, 1.0), iso(14.6, 6.3), iso(9.4, 6.3)])} fill="#f5edd7" opacity="0.55" />

        {/* roads */}
        <polygon points={poly([iso(0, 6.55), iso(22, 6.55), iso(22, 8.12), iso(0, 8.12)])} fill="#eee9da" />
        <polygon points={poly([iso(0, 6.78), iso(22, 6.78), iso(22, 7.9), iso(0, 7.9)])} fill="#a9b5b2" />
        <polygon points={poly([iso(7.3, 0), iso(8.86, 0), iso(8.86, 22), iso(7.3, 22)])} fill="#eee9da" />
        <polygon points={poly([iso(7.54, 0), iso(8.62, 0), iso(8.62, 22), iso(7.54, 22)])} fill="#a9b5b2" />
        <line x1={avenueStart.x} y1={avenueStart.y} x2={avenueEnd.x} y2={avenueEnd.y} stroke="#ffffff" strokeOpacity="0.75" strokeWidth="2.5" strokeDasharray="16 14" />
        <line x1={crossStart.x} y1={crossStart.y} x2={crossEnd.x} y2={crossEnd.y} stroke="#ffffff" strokeOpacity="0.75" strokeWidth="2.5" strokeDasharray="16 14" />
        {/* crosswalks */}
        {Array.from({ length: 5 }).map((_, i) => {
          const p = iso(7.35 + i * 0.33, 6.36)
          return <rect key={`cw1-${i}`} x={p.x - 2} y={p.y - 4} width="4" height="14" fill="#fff" opacity="0.7" transform={`skewX(0)`} />
        })}

        {/* roadside trees */}
        {[
          [10.2, 6.1], [11.4, 6.1], [12.6, 6.1], [13.8, 6.1],
          [9.6, 8.6], [10.2, 9.2],
          [1.6, 7.0], [2.4, 7.0], [3.2, 7.0],
          [7.0, 10.0], [6.8, 11.2], [7.0, 12.4],
          [1.2, 12.0], [2.0, 12.6],
          [19.2, 9.2], [20.0, 9.8], [19.6, 10.6],
          [10.6, 13.4], [10.4, 14.2],
        ].map(([x, y], i) => (
          <Tree key={`t-${i}`} x={x} y={y} scale={0.62} tone={i % 4 === 0 ? 'gold' : i % 3 === 0 ? 'light' : 'deep'} />
        ))}

        <Fountain x={15.1} y={11.9} />
        <Fountain x={5.8} y={17.6} />

        <MarketStall x={11.4} y={12.2} stripe="#ff6f61" />
        <MarketStall x={13.1} y={13.2} stripe="#ffc94a" />
        <MarketStall x={15.1} y={12.9} stripe="#7c6cf6" />

        <Person x={12.0} y={10.6} shirt="#2f80c7" />
        <Person x={14.6} y={9.9} shirt="#ff6f61" />
        <Person x={9.6} y={8.9} shirt="#7c6cf6" />
        <Person x={3.0} y={8.9} shirt="#ffc94a" />
        <Person x={17.3} y={7.3} shirt="#0b8550" />
        <Person x={6.4} y={12.0} shirt="#ff6f61" />

        <Car path={`M${avenueStart.x} ${avenueStart.y} L${avenueEnd.x} ${avenueEnd.y}`} color="#f2c14e" dur={30} />
        <Car path={`M${avenueStart.x} ${avenueStart.y} L${avenueEnd.x} ${avenueEnd.y}`} color="#7cc586" dur={34} delay={9} />
        <Car path={`M${crossStart.x} ${crossStart.y} L${crossEnd.x} ${crossEnd.y}`} color="#ff8f73" dur={26} delay={4} />
        <Car path={`M${crossStart.x} ${crossStart.y} L${crossEnd.x} ${crossEnd.y}`} color="#e8f5ff" dur={32} delay={15} />

        {LANDMARKS.map((l) => (
          <LandmarkHalo key={l.id} landmark={l} active={activeId === l.id} />
        ))}

        <BackgroundCity />

        <HQ landmark={LANDMARKS[0]} />
        <TalentHub landmark={LANDMARKS[1]} />
        <BankHall landmark={LANDMARKS[2]} />
        <MarketHall landmark={LANDMARKS[3]} />
        <TallTower landmark={LANDMARKS[4]} />
        <OpsTower landmark={LANDMARKS[5]} />
        <SupplyDepot landmark={LANDMARKS[6]} />
        <ExpansionHall landmark={LANDMARKS[7]} />

        <g transform={`translate(${center.x} ${center.y})`} />
      </g>

      <path d={shoreline(iso(0, 16), iso(6, 22))} fill="#8fd0ef" opacity="0.55" />
      <g transform={`translate(${iso(2.6, 19.6).x} ${iso(2.6, 19.6).y})`}>
        <ellipse cx="0" cy="0" rx="34" ry="12" fill="#fff" opacity="0.5" />
        <path d="M-20 0h40l-8 8h-24z" fill="#f6f1e2" stroke="#c9b07c" />
        <path d="M0 -1v-20l18 14z" fill="#ffffff" stroke="#cdd6c2" />
        <rect x="-2" y="-22" width="3" height="22" fill="#916c45" />
      </g>
    </svg>
  )
}

function shoreline(a: Pt, b: Pt) {
  return `M${a.x} ${a.y} Q ${(a.x + b.x) / 2 + 18} ${(a.y + b.y) / 2 - 12} ${b.x} ${b.y} L${b.x} ${b.y} Z`
}
