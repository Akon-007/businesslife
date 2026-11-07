#!/usr/bin/env node
/**
 * Bundle the deterministic engine for the API. The server imports this bundle
 * so replay runs the *same* code as the browser — one source of truth, no
 * duplicated simulation.
 *
 *   node scripts/build-engine.mjs
 */
import { mkdir } from 'node:fs/promises'

// `npm run dev:backend` starts here, so a missing node_modules must say so.
let build
try {
  ;({ build } = await import('esbuild'))
} catch (cause) {
  if (/Cannot find package 'esbuild'|ERR_MODULE_NOT_FOUND/.test(String(cause?.message ?? cause))) {
    console.error('\nThe bundler is not installed — node_modules is missing or incomplete.\n')
    console.error('  npm install\n')
    process.exit(1)
  }
  throw cause
}

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
