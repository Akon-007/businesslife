#!/usr/bin/env node
/**
 * The TLS probe, driven against fake Postgres endpoints.
 *
 * This exists because the probe shipped once doing a plain `tls.connect()` against
 * port 5432. Postgres does not speak TLS on connect — it waits for an SSLRequest
 * packet and answers S/N/E first — so the diagnostic reported
 * ERR_SSL_WRONG_VERSION_NUMBER for a perfectly healthy server. A test with real
 * sockets would have caught that; a mock of `tls.connect` would not.
 *
 * The certificate is generated at runtime with openssl when it is available; the
 * S/N/E protocol paths need no certificate and always run.
 *
 *   node scripts/verify-tls-probe.mjs
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import net from 'node:net'
import tls from 'node:tls'
import { X509Certificate } from 'node:crypto'
import { chainPem, probeTls, SSL_REQUEST } from './tls-probe.mjs'

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

function selfSignedCert() {
  const dir = mkdtempSync(join(tmpdir(), 'bl-tls-'))
  try {
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem'),
      '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost',
    ], { stdio: 'ignore' })
    return { key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')), dir }
  } catch {
    rmSync(dir, { recursive: true, force: true })
    return null
  }
}

const servers = []
const sockets = new Set()
function listen(handler) {
  return new Promise((resolve) => {
    const server = handler()
    server.on('connection', (socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })
    server.listen(0, '127.0.0.1', () => {
      servers.push(server)
      resolve(server.address().port)
    })
  })
}

// Test servers can leave upgraded TLS sockets behind; close the sockets, not just
// the listeners, or the script waits for the event loop to drain.
function closeAll() {
  for (const socket of sockets) socket.destroy()
  for (const server of servers) server.close()
}

const material = selfSignedCert()

// S: speaks the Postgres handshake, then upgrades to TLS with a self-signed cert.
const tlsPort = material
  ? await listen(() => net.createServer((socket) => {
      socket.once('data', (chunk) => {
        if (!chunk.equals(SSL_REQUEST)) { socket.destroy(); return }
        socket.write(Buffer.from([0x53]))
        const secure = new tls.TLSSocket(socket, { isServer: true, key: material.key, cert: material.cert })
        secure.on('error', () => {})
        secure.on('end', () => socket.destroy())
        secure.resume()
      })
    }))
  : 0

// N: refuses TLS.
const noTlsPort = await listen(() => net.createServer((socket) => {
  socket.once('data', () => { socket.write(Buffer.from([0x4e])); socket.end() })
}))

// E: Postgres error before any TLS.
const errorMessage = 'remaining connection slots are reserved'
const errorPort = await listen(() => net.createServer((socket) => {
  socket.once('data', () => {
    const fields = Buffer.concat([Buffer.from('SFATAL\0'), Buffer.from(`M${errorMessage}\0`), Buffer.from([0x00])])
    const length = Buffer.alloc(4)
    length.writeInt32BE(fields.length + 4)
    socket.write(Buffer.concat([Buffer.from([0x45]), length, fields]))
    socket.end()
  })
}))

if (material) {
  const lenient = await probeTls({ host: '127.0.0.1', port: tlsPort, isPostgres: true, rejectUnauthorized: false })
  check('the SSLRequest is understood and TLS then begins', lenient.ok === true, lenient.code ?? lenient.message)
  check('the certificate is read through the upgraded socket', Boolean(lenient.cert?.subject?.CN), JSON.stringify(lenient.cert?.subject))

  const strict = await probeTls({ host: '127.0.0.1', port: tlsPort, isPostgres: true, rejectUnauthorized: true })
  check('an untrusted chain is rejected when verification is on', strict.ok === false && /SELF_SIGNED/i.test(String(strict.code)), `${strict.code}: ${strict.message}`)

  // `npm run db:trust` exports the chain and claims that pinning it fixes the
  // handshake. Prove exactly that, rather than printing the claim.
  const chain = chainPem(lenient.cert)
  check('the presented chain is exported as PEM', chain.length === 1 && chain[0].startsWith('-----BEGIN CERTIFICATE-----'), `${chain.length} certificate(s)`)
  check('the exported PEM parses as a certificate', (() => {
    try { return new X509Certificate(chain[0]).subject.includes('CN=localhost') } catch { return false }
  })())

  const pinned = await probeTls({ host: '127.0.0.1', port: tlsPort, isPostgres: true, rejectUnauthorized: true, ca: chain.join('\n') })
  check('pinning that exported root makes the same handshake verify', pinned.ok === true, pinned.code ?? pinned.message)
} else {
  console.log('  ! openssl not available — skipping the two handshake checks, still testing S/N/E')
}

const refused = await probeTls({ host: '127.0.0.1', port: noTlsPort, isPostgres: true, rejectUnauthorized: true })
check('an N reply is reported as "no TLS on this port", not a version error', refused.code === 'SSL_NOT_SUPPORTED', refused.code ?? refused.message)

const errored = await probeTls({ host: '127.0.0.1', port: errorPort, isPostgres: true, rejectUnauthorized: true })
check('a Postgres ErrorResponse is surfaced with exactly its message, not the raw packet', errored.code === 'PG_ERROR' && errored.message === errorMessage, `${errored.code}: ${errored.message}`)

// A port that answers nothing must not hang the whole diagnostic.
const silentPort = await listen(() => net.createServer(() => {}))
const silent = await Promise.race([
  probeTls({ host: '127.0.0.1', port: silentPort, isPostgres: true, rejectUnauthorized: true, timeoutMs: 1_500 }),
  new Promise((resolve) => setTimeout(() => resolve({ code: 'HUNG' }), 20_000)),
])
check('a server that never answers does not hang forever', silent.code !== 'HUNG', String(silent.code))

// Direct TLS (https) still works, and is not attempted for postgres URLs.
const httpsPort = material
  ? await listen(() => tls.createServer({ key: material.key, cert: material.cert }, (socket) => socket.end()))
  : 0
if (material) {
  const direct = await probeTls({ host: '127.0.0.1', port: httpsPort, isPostgres: false, rejectUnauthorized: false })
  check('non-Postgres targets still use a direct TLS handshake', direct.ok === true, direct.code ?? direct.message)
}

closeAll()
if (material) rmSync(material.dir, { recursive: true, force: true })

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — tls probe: ${failures} failure(s)\n`)
process.exit(failures === 0 ? 0 : 1)
