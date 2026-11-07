#!/usr/bin/env node
/**
 * The dev server and the API must agree on one port.
 *
 * They disagreed once: `.env` had `PORT=8788`, the API read it, Vite did not, and
 * the proxy kept pointing at its 8787 default. Every `/api` call failed, and
 * nothing in the UI said why. `vite.config.ts` now derives the proxy target from
 * the same value, and these cases keep it that way.
 *
 *   npx tsx scripts/verify-dev-ports.ts
 */
import { resolveDevPorts } from '../vite.config.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

// Documented defaults: app 5173, API 8787, proxy points at the API.
const defaults = resolveDevPorts({})
check('with no configuration the app listens on 5173', defaults.devPort === 5173, String(defaults.devPort))
check('with no configuration the proxy targets the API on 8787', defaults.apiTarget === 'http://127.0.0.1:8787', defaults.apiTarget)

// The bug: PORT moves the API, so the proxy has to move with it.
const moved = resolveDevPorts({ PORT: '8788' })
check('PORT moves the proxy target as well as the listener', moved.apiTarget === 'http://127.0.0.1:8788', moved.apiTarget)
check('PORT does not move the app itself', moved.devPort === 5173, String(moved.devPort))

// Explicit overrides still win, which is how Playwright and the deploy shell do it.
const explicit = resolveDevPorts({ PORT: '8788', API_PROXY_TARGET: 'http://api.internal:9000' })
check('API_PROXY_TARGET overrides the derived target', explicit.apiTarget === 'http://api.internal:9000', explicit.apiTarget)
check('DEV_PORT overrides the app port', resolveDevPorts({ DEV_PORT: '3000' }).devPort === 3000)
check('DEV_HOST overrides the bind address', resolveDevPorts({ DEV_HOST: '127.0.0.1' }).devHost === '127.0.0.1')

// A non-numeric PORT must not end up inside the proxy URL.
check('a malformed PORT falls back to the default instead of building a bad URL', resolveDevPorts({ PORT: 'not-a-port' }).apiTarget === 'http://127.0.0.1:8787')
check('a quoted PORT from .env still resolves', resolveDevPorts({ PORT: ' 8788 ' }).apiTarget === 'http://127.0.0.1:8788')

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — dev ports: ${failures} failure(s)\n`)
process.exit(failures === 0 ? 0 : 1)
