#!/usr/bin/env node
/**
 * `npm run db:smoke -- --check '<string>'` is the first thing a person runs after
 * copying a connection string out of the Supabase dashboard, and the first thing
 * they get wrong is copying the *project URL* or an API key out of the page next
 * to it. These cases pin that advice down.
 *
 * Each case is a URL plus the exit code the checker must produce (0 = usable,
 * 1 = something the user has to fix) and a phrase that must appear in the output.
 *
 *   node scripts/verify-db-url.mjs
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./db-smoke.mjs', import.meta.url))
const pooler = 'aws-0-eu-west-1.pooler.supabase.com'

const cases = [
  {
    label: 'the project URL from the API-keys page is rejected by name',
    url: 'https://abcdefghijklmnop.supabase.co',
    exit: 1,
    says: 'project URL',
  },
  {
    label: 'a publishable key is rejected by name',
    url: 'sb_publishable_LRc17m2yp768q-lRSBpJWg_CzJIlyel',
    exit: 1,
    says: 'API key',
  },
  {
    label: 'a legacy JWT anon key is rejected by name',
    url: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.x',
    exit: 1,
    says: 'API key',
  },
  {
    label: 'an untouched [YOUR-PASSWORD] placeholder is caught',
    url: `postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@${pooler}:5432/postgres?sslmode=require`,
    exit: 1,
    says: 'placeholder',
  },
  {
    label: 'a pooler user without the project ref is caught',
    url: `postgresql://postgres:pw@${pooler}:5432/postgres?sslmode=require`,
    exit: 1,
    says: 'missing the project ref',
  },
  {
    label: 'a broken percent-escape in the password is caught',
    url: `postgresql://postgres.abcdefghijklmnop:pa%ss@${pooler}:5432/postgres?sslmode=require`,
    exit: 1,
    says: 'percent-escape',
  },
  {
    label: 'a session-pooler URI passes and prints the next two commands',
    url: `postgresql://postgres.abcdefghijklmnop:realpw@${pooler}:5432/postgres?sslmode=require`,
    exit: 0,
    says: 'npm run db:migrate',
  },
  {
    label: 'a transaction-pooler URI passes but warns about the migration',
    url: `postgresql://postgres.abcdefghijklmnop:realpw@${pooler}:6543/postgres?sslmode=require`,
    exit: 0,
    says: 'run db:migrate on 5432',
  },
  {
    label: 'no argument explains how to use the flag',
    url: null,
    exit: 1,
    says: 'nothing passed',
  },
]

let failures = 0
for (const item of cases) {
  const args = [script, '--check']
  if (item.url !== null) args.push(item.url)
  const run = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, SUPABASE_DB_URL: '', DATABASE_URL: '', NEON_DATABASE_URL: '' } })
  const output = `${run.stdout}${run.stderr}`
  const ok = run.status === item.exit && output.includes(item.says)
  console.log(`  ${ok ? '✓' : '✗'} ${item.label}${ok ? '' : ` — exit ${run.status} (wanted ${item.exit}), output ${JSON.stringify(output.slice(0, 200))}`}`)
  if (!ok) failures += 1
}

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — connection-string checks: ${failures} failure(s)\n`)
process.exit(failures === 0 ? 0 : 1)
