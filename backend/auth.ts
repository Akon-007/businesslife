import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import type { Database, Player, Session } from './types.js'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SCRYPT_KEYLEN = 64
const SCRYPT_PREFIX = 'scrypt'

/** Dev login is a convenience for local demos and the verification harnesses. */
export const devLoginEnabled = () => process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_LOGIN !== 'false'

/** Production instructor signup requires this shared code (never shipped to the client). */
export const instructorCode = () => process.env.INSTRUCTOR_CODE ?? ''

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN)
  return `${SCRYPT_PREFIX}$${salt.toString('hex')}$${derived.toString('hex')}`
}

/**
 * Verifies a password against a stored hash. Also accepts the legacy bare
 * sha256 hex digest used by the first prototype so old accounts keep working;
 * `needsRehash` tells the caller to upgrade the record on next login.
 */
export function verifyPassword(password: string, stored: string | undefined): { ok: boolean; needsRehash: boolean } {
  if (!stored) return { ok: false, needsRehash: false }
  if (stored.startsWith(`${SCRYPT_PREFIX}$`)) {
    const [, saltHex, hashHex] = stored.split('$')
    if (!saltHex || !hashHex) return { ok: false, needsRehash: false }
    const expected = Buffer.from(hashHex, 'hex')
    const derived = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
    return { ok: expected.length === derived.length && timingSafeEqual(expected, derived), needsRehash: false }
  }
  const legacy = createHash('sha256').update(password).digest('hex')
  const a = Buffer.from(legacy, 'hex')
  const b = Buffer.from(stored, 'hex')
  const ok = a.length === b.length && timingSafeEqual(a, b)
  return { ok, needsRehash: ok }
}

export function issueSession(database: Database, playerId: string): Session {
  const now = Date.now()
  database.sessions = database.sessions.filter((session) => Date.parse(session.expiresAt) > now)
  const session: Session = {
    token: randomBytes(24).toString('base64url'),
    playerId,
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  }
  database.sessions.push(session)
  return session
}

export function revokeSession(database: Database, token: string): boolean {
  const before = database.sessions.length
  database.sessions = database.sessions.filter((session) => session.token !== token)
  return database.sessions.length !== before
}

export function sessionFor(database: Database, token: string | undefined): Session | null {
  if (!token) return null
  const session = database.sessions.find((item) => item.token === token)
  if (!session) return null
  if (Date.parse(session.expiresAt) <= Date.now()) {
    database.sessions = database.sessions.filter((item) => item.token !== token)
    return null
  }
  return session
}

export function playerForToken(database: Database, token: string | undefined): Player | null {
  const session = sessionFor(database, token)
  if (!session) return null
  return database.players.find((player) => player.id === session.playerId) ?? null
}

// --- login throttling ------------------------------------------------------
// Simple in-process limiter: enough to blunt credential stuffing on a single
// node, deliberately not a distributed rate limiter.
const attempts = new Map<string, { count: number; firstAt: number }>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8

export function throttleCheck(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const entry = attempts.get(key)
  if (!entry) return { allowed: true, retryAfterSeconds: 0 }
  if (Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.delete(key)
    return { allowed: true, retryAfterSeconds: 0 }
  }
  if (entry.count < MAX_ATTEMPTS) return { allowed: true, retryAfterSeconds: 0 }
  return { allowed: false, retryAfterSeconds: Math.ceil((WINDOW_MS - (Date.now() - entry.firstAt)) / 1000) }
}

export function throttleFail(key: string): void {
  const entry = attempts.get(key)
  if (!entry || Date.now() - entry.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() })
    return
  }
  entry.count += 1
}

export function throttleReset(key: string): void {
  attempts.delete(key)
}
