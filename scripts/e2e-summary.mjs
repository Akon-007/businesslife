#!/usr/bin/env node
/**
 * Turn a Playwright JSON report into GitHub annotations.
 *
 * Artifacts are not always retrievable from a sandbox, but run annotations are,
 * so a failing e2e job explains itself in `gh run view` without a download.
 */
import { existsSync, readFileSync } from 'node:fs'

const file = process.env.PLAYWRIGHT_JSON_OUTPUT_NAME ?? 'test-results/results.json'
if (!existsSync(file)) {
  console.log(`::warning::No Playwright JSON report at ${file}`)
  process.exit(0)
}

const report = JSON.parse(readFileSync(file, 'utf8'))
const failures = []

const walk = (suite, trail) => {
  const path = [...trail, suite.title].filter(Boolean)
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      for (const result of test.results ?? []) {
        if (result.status === 'passed' || result.status === 'skipped') continue
        const error = (result.errors ?? [])[0]?.message ?? result.error?.message ?? 'no error message'
        failures.push({
          title: [...path, spec.title].filter(Boolean).join(' › '),
          message: String(error).replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 12).join('\n'),
        })
      }
    }
  }
  for (const child of suite.suites ?? []) walk(child, path)
}

for (const suite of report.suites ?? []) walk(suite, [])

for (const failure of failures) {
  const message = failure.message.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A')
  console.log(`::error title=${failure.title}::${message}`)
}

console.log(`\n${failures.length} failing test result(s) annotated.`)
