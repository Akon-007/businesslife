#!/usr/bin/env node
/**
 * Contrast gate for the design tokens in src/index.css.
 *
 * Reads the @theme block and checks the pairs the UI actually uses for text
 * against WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text and non-text
 * UI). This is arithmetic on the token values — it does not prove anything
 * about how the pages look, but it does catch the "gold on white" class of
 * mistake before it ships.
 *
 *   node scripts/verify-contrast.mjs
 */
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})/g)].map((match) => [match[1], match[2].toLowerCase()]),
)

const channel = (value) => {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (hex) => {
  const h = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [foreground, background, minimum, what it is used for]
const PAIRS = [
  ['ink', 'paper', 4.5, 'body text on the app background'],
  ['ink', 'paper-2', 4.5, 'body text on cards'],
  ['ink-600', 'paper-2', 4.5, 'secondary text on cards'],
  ['ink-500', 'paper-2', 4.5, 'helper text on cards'],
  ['ink-400', 'paper-2', 4.5, 'labels and captions on cards'],
  ['ink-400', 'paper', 4.5, 'labels on the app background'],
  ['ink-400', 'paper-3', 4.5, 'labels on inset panels'],
  ['brand-500', 'paper-2', 4.5, 'links and accents'],
  ['paper-2', 'brand-500', 4.5, 'primary button label'],
  ['brand-700', 'brand-50', 4.5, 'brand chip text'],
  ['success-strong', 'paper-2', 4.5, 'positive figures'],
  ['success-strong', 'success-soft', 4.5, 'paid pill text'],
  ['coral', 'paper-2', 4.5, 'negative figures'],
  ['coral', 'coral-soft', 4.5, 'overdue pill text'],
  ['gold-ink', 'paper-2', 4.5, 'warning text'],
  ['gold-ink', 'gold-soft', 4.5, 'warning chip on gold'],
  ['ink', 'gold', 4.5, 'dark text on a gold fill'],
  ['ink', 'lime', 4.5, 'dark text on the success fill'],
  ['ink', 'success', 4.5, 'dark label on a success button'],
  ['paper-2', 'success-strong', 4.5, 'hovered success button label'],
  ['lime', 'ink-900', 4.5, 'success text on the dark HUD'],
  ['gold', 'ink-900', 4.5, 'warning text on the dark HUD'],
  ['paper-2', 'ink-900', 4.5, 'text on the dark HUD'],
  ['ink-300', 'ink-900', 4.5, 'muted text on the dark HUD'],
  ['brand-400', 'ink-900', 3, 'focus ring on dark surfaces'],
  ['line-strong', 'paper-2', 1.2, 'borders must at least be visible'],
]

let failures = 0
const missing = []

console.log('\nDesign token contrast\n')

for (const [fg, bg, minimum, use] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) {
    missing.push(`${fg} / ${bg}`)
    continue
  }
  const value = ratio(tokens[fg], tokens[bg])
  const pass = value >= minimum
  if (!pass) failures += 1
  console.log(`  ${pass ? '✓' : '✗'} ${`${fg} on ${bg}`.padEnd(28)} ${value.toFixed(2).padStart(5)}:1  (min ${minimum})  ${use}`)
}

if (missing.length) {
  failures += missing.length
  console.log(`\n  ✗ missing tokens: ${missing.join(', ')}`)
}

console.log(failures ? `\n${failures} contrast failure(s)` : `\nAll ${PAIRS.length} contrast pairs pass`)
process.exit(failures ? 1 : 0)
