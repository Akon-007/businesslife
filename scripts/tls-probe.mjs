import { connect as netConnect, isIP } from 'node:net'
import { connect as tlsConnect } from 'node:tls'

/**
 * Read the certificate a Postgres (or HTTPS) endpoint presents, without logging in.
 *
 * Postgres does not speak TLS on connect. It waits for an SSLRequest packet,
 * answers `S` (proceed), `N` (no TLS) or `E` (an ErrorResponse), and only then
 * does the TLS handshake start. A raw TLS handshake against port 5432 therefore
 * fails with ERR_SSL_WRONG_VERSION_NUMBER against a perfectly healthy server —
 * which is why this exists instead of a plain tls.connect().
 *
 * Separated from db-smoke.mjs so scripts/verify-tls-probe.mjs can drive it
 * against in-process fake servers.
 */

/** Postgres negotiates TLS after this 8-byte SSLRequest, not on connect. */
const SSL_REQUEST = Buffer.from([0x00, 0x00, 0x00, 0x08, 0x04, 0xd2, 0x16, 0x2f])

const printable = (text) => Array.from(text, (character) => {
  const code = character.codePointAt(0) ?? 0
  return code >= 0x20 && code <= 0x7e ? character : ' '
}).join('')

/**
 * Pull the human-readable message out of a Postgres ErrorResponse.
 *
 * The packet is `E`, a 4-byte length, then fields — each a type byte, the text,
 * and a NUL. `M` is the message; `S` is the severity, which is why a naive read of
 * the whole buffer produces `ESFATALMno more connections allowed`.
 */
function decodePgError(chunk) {
  const body = chunk.subarray(5).toString('latin1')
  for (const field of body.split('\u0000')) {
    if (field.startsWith('M')) return printable(field.slice(1)).trim()
  }
  return printable(body).trim()
}

const derToPem = (der) => `-----BEGIN CERTIFICATE-----\n${(der.toString('base64').match(/.{1,64}/g) ?? []).join('\n')}\n-----END CERTIFICATE-----\n`

/**
 * Walk the chain that `tls` hands back (`getPeerCertificate(true)` nests each
 * issuer in `issuerCertificate`) and return it as PEM, leaf first.
 *
 * A self-signed certificate points at itself, so identity — not just depth —
 * stops the walk.
 */
export function chainPem(cert) {
  const seen = new Set()
  const out = []
  let node = cert
  while (node && node.raw) {
    const pem = derToPem(node.raw)
    if (seen.has(pem)) break
    seen.add(pem)
    out.push(pem)
    const issuer = node.issuerCertificate
    node = issuer && issuer !== node ? issuer : undefined
  }
  return out
}

export function probeTls({ host, port, isPostgres, rejectUnauthorized, ca, timeoutMs = 15_000 }) {
  return new Promise((resolve) => {
    let settled = false
    let socket
    const finish = (value) => {
      if (settled) return
      settled = true
      try { socket?.destroy() } catch { /* already gone */ }
      resolve(value)
    }

    if (!isPostgres) {
      socket = tlsConnect({ host, port, ...(isIP(host) ? {} : { servername: host }), rejectUnauthorized, ...(ca ? { ca } : {}) }, () => {
        const cert = socket.getPeerCertificate(true) || {}
        socket.end()
        finish({ ok: true, cert })
      })
      socket.setTimeout(timeoutMs, () => finish({ ok: false, code: 'ETIMEDOUT', message: `no answer after ${timeoutMs}ms` }))
      socket.on('error', (error) => finish({ ok: false, code: error.code, message: error.message }))
      return
    }

    const raw = netConnect({ host, port })
    socket = raw
    raw.setTimeout(timeoutMs, () => finish({ ok: false, code: 'ETIMEDOUT', message: `no answer after ${timeoutMs}ms` }))
    raw.on('error', (error) => finish({ ok: false, code: error.code, message: error.message }))
    raw.on('connect', () => raw.write(SSL_REQUEST))
    raw.once('data', (chunk) => {
      const code = chunk[0]
      if (code === 0x4e) {
        finish({ ok: false, code: 'SSL_NOT_SUPPORTED', message: 'the server answered N to the SSLRequest' })
        return
      }
      if (code === 0x45) {
        finish({ ok: false, code: 'PG_ERROR', message: decodePgError(chunk) })
        return
      }
      if (code !== 0x53) {
        finish({ ok: false, code: 'UNEXPECTED_REPLY', message: `expected S, N or E from the SSLRequest, got 0x${code.toString(16)}` })
        return
      }

      raw.removeAllListeners('data')
      raw.removeAllListeners('timeout')
      const rest = chunk.subarray(1)
      if (rest.length) raw.unshift(rest)

      const secure = tlsConnect({ socket: raw, ...(isIP(host) ? {} : { servername: host }), rejectUnauthorized, ...(ca ? { ca } : {}) }, () => {
        const cert = secure.getPeerCertificate(true) || {}
        secure.end()
        finish({ ok: true, cert })
      })
      socket = secure
      secure.setTimeout(timeoutMs, () => finish({ ok: false, code: 'ETIMEDOUT', message: 'TLS handshake timed out' }))
      secure.on('error', (error) => finish({ ok: false, code: error.code, message: error.message }))
    })
  })
}

export { SSL_REQUEST }
