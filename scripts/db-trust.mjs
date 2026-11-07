#!/usr/bin/env node
/**
 * `npm run db:trust` — export the certificate chain this machine is actually
 * given, so a TLS-inspecting proxy can be trusted explicitly instead of disabling
 * verification.
 *
 *   SELF_SIGNED_CERT_IN_CHAIN almost always means a corporate proxy, VPN or
 *   antivirus is re-signing the connection. The fix is to add its root, not to
 *   stop checking. This writes the chain to `db-ca.pem` and then *proves* the
 *   file works by reconnecting with it.
 *
 * The export is not trusted automatically: you get the file and the line to add.
 * On a managed machine, ask IT whether that root belongs there before shipping it.
 *
 *   npm run db:trust              # writes ./db-ca.pem
 *   npm run db:trust -- path.pem  # somewhere else
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { X509Certificate } from 'node:crypto'
import { chainPem, probeTls } from './tls-probe.mjs'

const envFile = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envFile)) {
  try { process.loadEnvFile(envFile) } catch (cause) { console.warn(`ignoring .env: ${cause.message}`) }
}

const url = (process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? process.env.NEON_DATABASE_URL ?? '').trim()
if (!url) {
  console.error('\nNo database URL. Set SUPABASE_DB_URL (or DATABASE_URL) in .env and retry.\n')
  process.exit(1)
}

let parsed
try {
  parsed = new URL(url)
} catch {
  console.error('\nThat does not parse as a URL.\n')
  process.exit(1)
}

const host = parsed.hostname
const port = Number(parsed.port || 5432)
const target = process.argv[2] ?? fileURLToPath(new URL('../db-ca.pem', import.meta.url))

console.log(`\nCertificate export for ${host}:${port}\n`)

const first = await probeTls({ host, port, isPostgres: true, rejectUnauthorized: false })
if (!first.ok) {
  console.error(`  ✗ could not reach the server: ${first.code ?? 'ERROR'} — ${first.message}\n`)
  console.error('    Nothing was written. Fix reachability first: npm run db:smoke -- --tls\n')
  process.exit(1)
}

const chain = chainPem(first.cert)
if (chain.length === 0) {
  console.error('  ✗ the server did not present a certificate.\n')
  process.exit(1)
}

const subjects = chain.map((pem) => {
  const cert = new X509Certificate(pem)
  return { subject: cert.subject.replace(/\n/g, ', '), issuer: cert.issuer.replace(/\n/g, ', '), validTo: cert.validTo }
})

chain.forEach((_, index) => {
  const role = index === 0 ? 'leaf' : index === chain.length - 1 ? 'root' : 'intermediate'
  console.log(`  · ${role}: ${subjects[index].subject}`)
  console.log(`      issued by       ${subjects[index].issuer}`)
  console.log(`      valid until     ${subjects[index].validTo}`)
})

writeFileSync(target, chain.join('\n'))
console.log(`\n  ✓ wrote ${chain.length} certificate(s) to ${target}\n`)

// The point of the exercise: does that file actually fix verification?
const verified = await probeTls({ host, port, isPostgres: true, rejectUnauthorized: true, ca: chain.join('\n') })
if (verified.ok) {
  console.log('  ✓ reconnecting with that file verifies the chain — this is the fix.\n')
  console.log('    Add one line to .env (gitignored), then re-run the migration:\n')
  console.log(`      DB_SSL_CA=${target}\n`)
  console.log('    Windows PowerShell, if you prefer the environment:\n')
  console.log(`      $env:DB_SSL_CA="${target}"\n`)
  process.exit(0)
}

console.error(`  ✗ the file did not satisfy verification: ${verified.code ?? verified.message}\n`)
console.error('    The chain may be incomplete, or something is rewriting it per-connection.')
console.error('    Prefer the OS store instead:  $env:NODE_OPTIONS="--use-system-ca"\n')
process.exit(1)
