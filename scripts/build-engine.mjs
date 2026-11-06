#!/usr/bin/env node
/**
 * Bundle the deterministic engine for the API. The server imports this bundle
 * so replay runs the *same* code as the browser — one source of truth, no
 * duplicated simulation.
 *
 *   node scripts/build-engine.mjs
 */
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

const outfile = 'backend-dist/engine.mjs'

await mkdir('backend-dist', { recursive: true })

const result = await build({
  entryPoints: ['src/game/replay-entry.ts'],
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'node22',
  logLevel: 'warning',
  legalComments: 'none',
  metafile: true,
})

const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0
console.log(`engine bundle: ${outfile} (${(bytes / 1024).toFixed(1)} kB)`)
