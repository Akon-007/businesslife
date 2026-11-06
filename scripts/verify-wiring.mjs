#!/usr/bin/env node
/**
 * Frontend ↔ backend wiring check.
 *
 * The API is a hand-written `node:http` router, so nothing at build time proves
 * that a path the client calls actually exists. This script extracts both sides
 * from source and compares them:
 *
 *   1. every path the client calls must resolve to a route the server declares
 *      (a rename on one side, or a typo, fails the gate);
 *   2. routes the server exposes but no client calls are listed as server-only,
 *      so we can tell "built but not wired" from "not built".
 *
 * It is a static check on purpose: no API, database or browser needed, which is
 * why it can sit in the same gate as lint and the type checker.
 *
 *   node scripts/verify-wiring.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'

const server = readFileSync(new URL('../backend/server.ts', import.meta.url), 'utf8')

// ---------------------------------------------------------------------------
// Backend: literal paths, regex matchers, and `/:id/<action>` sub-actions
// ---------------------------------------------------------------------------

const exactPaths = new Set()
{
  const marker = "path === '"
  let index = server.indexOf(marker)
  while (index !== -1) {
    const start = index + marker.length
    const end = server.indexOf("'", start)
    if (end === -1) break
    exactPaths.add(server.slice(start, end))
    index = server.indexOf(marker, end)
  }
}

const regexRoutes = []
{
  // Every matcher in this router is written as `path.match(/...$/)`.
  const marker = 'path.match(/'
  let index = server.indexOf(marker)
  while (index !== -1) {
    const start = index + marker.length
    const end = server.indexOf('$/)', start)
    if (end === -1) break
    const source = server.slice(start, end + 1)
    try {
      regexRoutes.push({ source, pattern: new RegExp(source) })
    } catch {
      // Unusable patterns are caught by the extraction floor below.
    }
    index = server.indexOf(marker, end)
  }
}

const actions = new Set()
for (const match of server.matchAll(/action === '([^']+)'/g)) actions.add(match[1])

const actionPrefixes = [...server.matchAll(/action\.startsWith\('([^']+)'\)/g)].map((match) => match[1])
const actionSuffixes = [...server.matchAll(/action\.endsWith\('([^']+)'\)/g)].map((match) => match[1])

if (exactPaths.size < 15 || regexRoutes.length < 8) {
  console.log('\n  ✗ route extraction drifted — refusing to report a pass')
  console.log(`    found ${exactPaths.size} literal paths and ${regexRoutes.length} regex routes\n`)
  process.exit(1)
}

/** Does the server know this path? */
function resolves(path) {
  const clean = path.split('?')[0].replace(/\/+$/, '')
  if (exactPaths.has(clean)) return 'literal'
  for (const route of regexRoutes) if (route.pattern.test(clean)) return 'regex'
  const scoped = clean.match(/^\/api\/(companies|classes)\/([^/]+)\/(.+)$/)
  if (scoped) {
    const action = scoped[3]
    if (actions.has(action)) return 'action'
    if (actionPrefixes.some((prefix) => action.startsWith(prefix))) return 'prefix'
    if (actionSuffixes.some((suffix) => action.endsWith(suffix))) return 'suffix'
    return null
  }
  return null
}

// ---------------------------------------------------------------------------
// Frontend: every path the client can call
// ---------------------------------------------------------------------------

const clientFiles = []
const walk = (dir) => {
  for (const entry of readdirSync(new URL(`../${dir}/`, import.meta.url))) {
    const relative = `${dir}/${entry}`
    const stats = statSync(new URL(`../${relative}`, import.meta.url))
    if (stats.isDirectory()) walk(relative)
    else if (/\.(ts|tsx)$/.test(entry)) clientFiles.push(relative)
  }
}
walk('src')

const calls = []
for (const file of clientFiles) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  for (const match of source.matchAll(/(?:request(?:<[^>]*>)?|fetch)\(\s*([`'"])([^`'"]*)\1/g)) {
    const raw = match[2]
    if (!raw.startsWith('/api')) continue
    const path = raw
      .replace(/\$\{[^}]*\}/g, ':param')
      .split('?')[0]
      .replace(/\/+$/, '')
    calls.push({ file, path })
  }
}

const unique = [...new Map(calls.map((call) => [call.path, call])).values()].sort((a, b) =>
  a.path.localeCompare(b.path),
)

console.log('\nFrontend → backend wiring\n')

let failures = 0
for (const call of unique) {
  const how = resolves(call.path)
  if (!how) failures += 1
  console.log(
    `  ${how ? '✓' : '✗'} ${call.path.padEnd(50)} ${how ? `(${how})` : `NO SERVER ROUTE — called from ${call.file}`}`,
  )
}

const clientLiteralPaths = new Set(unique.map((call) => call.path))
const orphans = [...exactPaths]
  .filter((path) => path.startsWith('/api'))
  .filter((path) => !clientLiteralPaths.has(path))
  .sort()

console.log(`\nServer-only routes (${orphans.length} — no client caller)\n`)
for (const path of orphans) console.log(`  · ${path}`)

console.log(
  failures
    ? `\n${failures} unwired client call(s) out of ${unique.length}\n`
    : `\nAll ${unique.length} client calls resolve to a server route · ${orphans.length} server-only routes listed above\n`,
)
process.exit(failures ? 1 : 0)
