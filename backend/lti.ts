/**
 * LTI Advantage — Assignment and Grade Services (AGS) passback.
 *
 * When a course runs inside an LMS, the grade has to leave this app and land in
 * the LMS gradebook. That is a signed OAuth2 client-credentials exchange: our
 * platform signs a short-lived JWT assertion with an RSA key the LMS knows
 * about, trades it for an access token, then POSTs a score to a line item.
 *
 * What is real here: the keypair, the JWKS the LMS fetches, the RS256 assertion
 * with its claims, the token exchange, the score payload and the error handling.
 * What is not: a live platform. There is no LMS in this environment, so the
 * end-to-end path is tested against a stub platform in `verify:api` and every
 * other run is a dry run that returns the exact request it would have sent.
 *
 * Deliberate omissions, stated rather than implied:
 *  - the OIDC `id_token` launch flow (login initiation, JWKS validation of the
 *    platform's own signature) is not implemented; a cohort is configured with
 *    the platform's endpoints by the instructor instead
 *  - Deep Linking / NRPS are not implemented
 *  - a grade is sent for one student per call; there is no retry queue
 */
import { createPrivateKey, createPublicKey, createSign, createVerify, generateKeyPairSync, randomUUID } from 'node:crypto'
import type { Database } from './types.js'

export interface LtiKeys {
  kid: string
  publicJwk: Record<string, unknown>
  privatePem: string
  createdAt: string
}

export interface LtiConfig {
  issuer: string
  clientId: string
  deploymentId?: string
  /** OAuth2 token endpoint on the platform. */
  tokenUrl: string
  /** AGS line item the scores are written to. */
  lineItemUrl: string
  scope?: string
}

export interface PassbackResult {
  studentId: string
  status: 'sent' | 'dry-run' | 'failed' | 'skipped'
  statusCode?: number
  error?: string
  request?: PassbackRequest
}

export interface PassbackRequest {
  tokenUrl: string
  lineItemUrl: string
  assertion: { header: Record<string, unknown>; claims: Record<string, unknown> }
  score: Record<string, unknown>
}

const DEFAULT_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/score'

/** Create the platform keypair once and keep it: a changing kid breaks trust. */
export function ensureLtiKeys(database: Database): LtiKeys {
  const existing = database.ltiKeys
  if (existing?.privatePem && existing.publicJwk && existing.kid) return existing

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = publicKey.export({ format: 'jwk' }) as Record<string, unknown>
  const kid = `bl-${randomUUID().slice(0, 8)}`
  const keys: LtiKeys = {
    kid,
    publicJwk: { ...jwk, kid, alg: 'RS256', use: 'sig' },
    privatePem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    createdAt: new Date().toISOString(),
  }
  database.ltiKeys = keys
  return keys
}

/** What an LMS fetches to verify our assertions. Never exposes the private key. */
export function ltiJwks(database: Database) {
  const keys = ensureLtiKeys(database)
  return { keys: [keys.publicJwk] }
}

const base64url = (value: Buffer | string) =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const decodePart = (part: string) => JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))

function signAssertion(database: Database, config: LtiConfig, nowMs = Date.now()) {
  const keys = ensureLtiKeys(database)
  const issuedAt = Math.floor(nowMs / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid: keys.kid }
  const claims = {
    iss: config.issuer,
    sub: config.clientId,
    aud: config.tokenUrl,
    iat: issuedAt,
    exp: issuedAt + 300,
    jti: randomUUID(),
  }
  const payload = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`
  const signer = createSign('RSA-SHA256')
  signer.update(payload)
  signer.end()
  const signature = base64url(signer.sign(createPrivateKey(keys.privatePem)))
  return {
    compact: `${payload}.${signature}`,
    header,
    claims,
  }
}

/** Verify a compact JWS against the platform's advertised key. Used by tests and by the LMS. */
export function verifyAssertion(database: Database, compact: string): boolean {
  const [header, payload, signature] = compact.split('.')
  if (!header || !payload || !signature) return false
  const keys = ensureLtiKeys(database)
  const publicKey = createPublicKey({ key: keys.publicJwk as never, format: 'jwk' })
  const verifier = createVerify('RSA-SHA256')
  verifier.update(`${header}.${payload}`)
  verifier.end()
  return verifier.verify(publicKey, Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64'))
}

export function scorePayload(input: { studentId: string; grade: number; comment?: string; timestamp?: string }) {
  return {
    userId: input.studentId,
    scoreGiven: Math.max(0, Math.min(100, Math.round(input.grade))),
    scoreMaximum: 100,
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
    comment: input.comment?.slice(0, 500),
    timestamp: input.timestamp ?? new Date().toISOString(),
  }
}

/**
 * Send one student's grade to the LMS.
 *
 * `dryRun` stops after building the request, which is what the UI uses by
 * default: an instructor can see exactly what would be sent before a real grade
 * leaves the building.
 */
export async function passbackScore(
  database: Database,
  config: LtiConfig,
  grade: { studentId: string; grade: number; comment?: string },
  options: { dryRun?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<PassbackResult> {
  const assertion = signAssertion(database, config)
  const score = scorePayload(grade)
  const request: PassbackRequest = {
    tokenUrl: config.tokenUrl,
    lineItemUrl: config.lineItemUrl,
    assertion: { header: assertion.header, claims: assertion.claims },
    score,
  }
  if (options.dryRun) return { studentId: grade.studentId, status: 'dry-run', request }

  const doFetch = options.fetchImpl ?? fetch
  try {
    const tokenResponse = await doFetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: assertion.compact,
        scope: config.scope ?? DEFAULT_SCOPE,
      }).toString(),
    })
    if (!tokenResponse.ok) {
      return { studentId: grade.studentId, status: 'failed', statusCode: tokenResponse.status, error: 'The platform refused the client assertion.', request }
    }
    const token = (await tokenResponse.json()) as { access_token?: string }
    if (!token.access_token) {
      return { studentId: grade.studentId, status: 'failed', statusCode: tokenResponse.status, error: 'No access token in the platform response.', request }
    }
    const scoreResponse = await doFetch(`${config.lineItemUrl}/scores`, {
      method: 'POST',
      headers: { 'content-type': 'application/vnd.ims.lis.v1.score+json', authorization: `Bearer ${token.access_token}` },
      body: JSON.stringify(score),
    })
    if (!scoreResponse.ok) {
      return {
        studentId: grade.studentId,
        status: 'failed',
        statusCode: scoreResponse.status,
        error: `The platform rejected the score (${scoreResponse.status}).`,
        request,
      }
    }
    return { studentId: grade.studentId, status: 'sent', statusCode: scoreResponse.status, request }
  } catch (caught) {
    return {
      studentId: grade.studentId,
      status: 'failed',
      error: caught instanceof Error ? caught.message : 'The platform could not be reached.',
      request,
    }
  }
}

export function parseLtiConfig(raw: unknown): LtiConfig | null {
  const input = (raw ?? {}) as Record<string, unknown>
  const issuer = String(input.issuer ?? '').trim()
  const clientId = String(input.clientId ?? '').trim()
  const tokenUrl = String(input.tokenUrl ?? '').trim()
  const lineItemUrl = String(input.lineItemUrl ?? '').trim()
  if (!issuer || !clientId) return null
  const url = (value: string) => {
    try {
      const parsed = new URL(value)
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString().replace(/\/$/, '') : null
    } catch {
      return null
    }
  }
  const token = url(tokenUrl)
  const lineItem = url(lineItemUrl)
  if (!token || !lineItem) return null
  return {
    issuer,
    clientId,
    deploymentId: input.deploymentId ? String(input.deploymentId).slice(0, 120) : undefined,
    tokenUrl: token,
    lineItemUrl: lineItem,
    scope: input.scope ? String(input.scope).slice(0, 200) : undefined,
  }
}

/** Decode a compact JWT without verifying it — for displaying what will be sent. */
export function decodeAssertion(compact: string) {
  const [header, payload] = compact.split('.')
  return { header: decodePart(header), claims: decodePart(payload) }
}
