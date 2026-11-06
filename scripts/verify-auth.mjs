#!/usr/bin/env node
/**
 * Authentication checks: real accounts (scrypt-hashed passwords), session
 * issuance and revocation, login throttling, and the dev-login gate.
 *
 *   node scripts/verify-auth.mjs
 */
const API = process.env.API ?? 'http://127.0.0.1:8788'

let passed = 0
let failed = 0
const failures = []

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const response = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const payload = await response.json().catch(() => ({}))
  return { status: response.status, body: payload }
}

const uid = Date.now().toString(36)
const email = `auth.${uid}@school.test`
const password = 'correct-horse-battery'

async function main() {
  console.log(`\nAuthentication checks against ${API}\n`)

  const registered = await call('/api/auth/register', { method: 'POST', body: { name: 'Auth Student', accountEmail: email, password } })
  check('account registers', registered.status === 201 && Boolean(registered.body?.token), `status ${registered.status}`)
  check('registration never returns a password hash', !JSON.stringify(registered.body).includes('passwordHash'))
  check('new accounts are learners by default', registered.body?.player?.role === 'learner', String(registered.body?.player?.role))

  const duplicate = await call('/api/auth/register', { method: 'POST', body: { name: 'Auth Student', accountEmail: email, password } })
  check('duplicate email rejected', duplicate.status === 409, `status ${duplicate.status}`)

  const weak = await call('/api/auth/register', { method: 'POST', body: { name: 'Weak', accountEmail: `weak.${uid}@school.test`, password: 'short' } })
  check('short password rejected', weak.status === 400, `status ${weak.status}`)

  const badEmail = await call('/api/auth/register', { method: 'POST', body: { name: 'No Mail', accountEmail: 'not-an-email', password } })
  check('invalid email rejected', badEmail.status === 400, `status ${badEmail.status}`)

  const selfInstructor = await call('/api/auth/register', { method: 'POST', body: { name: 'Sneaky', accountEmail: `sneaky.${uid}@school.test`, password, role: 'instructor' } })
  check('self-service instructor signup blocked without a code', selfInstructor.status === 403, `status ${selfInstructor.status}`)

  const signedIn = await call('/api/auth/login', { method: 'POST', body: { accountEmail: email, password } })
  check('sign in returns a session', signedIn.status === 200 && Boolean(signedIn.body?.token), `status ${signedIn.status}`)
  check('sign in returns the account id', signedIn.body?.player?.id === registered.body?.player?.id)
  check('session carries an expiry', typeof signedIn.body?.expiresAt === 'string' && Date.parse(signedIn.body.expiresAt) > Date.now())

  const me = await call('/api/me', { token: signedIn.body.token })
  check('session authenticates /api/me', me.status === 200 && me.body?.accountEmail === email, `status ${me.status}`)
  check('/api/me hides the password hash', me.body?.passwordHash === undefined)

  const noToken = await call('/api/me')
  check('anonymous access is rejected', noToken.status === 401, `status ${noToken.status}`)

  const wrongPassword = await call('/api/auth/login', { method: 'POST', body: { accountEmail: email, password: 'wrong-password' } })
  check('wrong password rejected', wrongPassword.status === 401, `status ${wrongPassword.status}`)
  check('failed sign in leaks no credential material', !JSON.stringify(wrongPassword.body).includes('passwordHash') && !JSON.stringify(wrongPassword.body).includes('$scrypt'))

  const unknownEmail = await call('/api/auth/login', { method: 'POST', body: { accountEmail: `nobody.${uid}@school.test`, password } })
  check('unknown email rejected the same way', unknownEmail.status === 401 && unknownEmail.body?.error?.message === wrongPassword.body?.error?.message)

  const signedOut = await call('/api/auth/logout', { method: 'POST', token: signedIn.body.token })
  check('sign out succeeds', signedOut.status === 200, `status ${signedOut.status}`)
  const revoked = await call('/api/me', { token: signedIn.body.token })
  check('revoked session no longer authenticates', revoked.status === 401, `status ${revoked.status}`)

  // Throttling: eight failures then a 429 for the same identifier.
  const victim = `throttle.${uid}@school.test`
  await call('/api/auth/register', { method: 'POST', body: { name: 'Throttle', accountEmail: victim, password } })
  const attempts = []
  for (let index = 0; index < 9; index += 1) {
    attempts.push(await call('/api/auth/login', { method: 'POST', body: { accountEmail: victim, password: 'nope-nope-nope' } }))
  }
  check('repeated failures eventually rate limit', attempts.at(-1)?.status === 429, `last status ${attempts.at(-1)?.status}`)
  check('rate limited before the correct password is tried', attempts.filter((item) => item.status === 401).length >= 1)

  const devSession = await call('/api/auth/dev-login', { method: 'POST', body: { name: 'Dev Lecturer', accountEmail: `dev.${uid}@school.test`, role: 'instructor' } })
  check('dev sign-in still available outside production', devSession.status === 201 || devSession.status === 200, `status ${devSession.status}`)
  check('dev sign-in honours the instructor role', devSession.body?.player?.role === 'instructor', String(devSession.body?.player?.role))
  check('dev sign-in never returns a password hash', !JSON.stringify(devSession.body).includes('passwordHash'))

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed) {
    console.log('\nFailures:')
    for (const failure of failures) console.log(`  - ${failure}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error('\nVerification crashed:', error)
  process.exit(1)
})
