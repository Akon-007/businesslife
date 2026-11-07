import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createHash } from 'node:crypto'
import { devLoginEnabled, hashPassword, instructorCode, issueSession, playerForToken, revokeSession, throttleCheck, throttleFail, throttleReset, verifyPassword } from './auth.js'
import { BEGINNER_LEVELS, stageSummary } from './stage.js'
import { ALL_LEVELS, allStageSummaries } from './stages.js'
import { loadDatabase, newId, now, saveDatabase } from './store.js'
import { amountKobo, breakEven, transferFromFounder } from './finance.js'
import { evaluateAction, forecast } from './simulation.js'
import { consumeStock, demandFor, operationsOverview } from './operations.js'
import { evaluateInvestor, interviewCustomer, seedCompanyNpcs, selectSupplier as selectNpcSupplier } from './npcs.js'
import { searchMarketplace, seedMarketplace } from './marketplace.js'
import { IN_GAME_APPS } from './apps.js'
import { appendAudit, applyCanonical, authorityOf, emptyAuthority, publicAuthority, validateSnapshot, verifyChain, type RunSnapshot } from './authority.js'
import { CHARACTERS, factsFor, runDialogue, traceDialogue } from './ai.js'
import { comparisonFor, recordFor, rosterCsv, rosterFor, scenarioStart } from './classroom.js'
import { MIN_RATIONALE, RUBRIC, parseRubric, rubricBreakdown, rubricGrade } from './rubric.js'
import { MAX_REPLAY_OPS, projectionFromSnapshot, runReplay, type ReplayInput, type ReplayVerdict } from './replay.js'
import { addMessage, applyIncidentOutcome, createComment, createIncident, createPost, ensureCommunications, generateNpcActivity, notification, openConversation, reputation } from './social.js'
import type { Company, Database, Player } from './types.js'

const port = Number(process.env.PORT ?? 8787)
const host = process.env.HOST ?? '127.0.0.1'
const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': 'http://127.0.0.1:5173', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' }

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, jsonHeaders)
  response.end(JSON.stringify(body))
}

function error(response: ServerResponse, status: number, message: string) {
  send(response, status, { error: { message, status } })
}

async function body(request: IncomingMessage) {
  let raw = ''
  for await (const chunk of request) raw += chunk
  if (!raw) return {}
  try { return JSON.parse(raw) as Record<string, unknown> } catch { throw new Error('Request body must be valid JSON.') }
}

function auth(request: IncomingMessage, database: Database): Player | null {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  return playerForToken(database, token)
}

function requestToken(request: IncomingMessage): string {
  return request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? ''
}

/** Never leak the password hash (or the scrypt parameters) to a client. */
function publicPlayer(player: Player) {
  const { passwordHash: _passwordHash, ...rest } = player
  return rest
}

function ownedCompany(database: Database, player: Player, id: string) {
  return database.companies.find((company) => company.id === id && company.playerId === player.id) ?? null
}

function isInstructor(player: Player) {
  return player.role === 'instructor' || player.role === 'admin'
}

/** An instructor may read (never write) companies belonging to their own students. */
function taughtCompany(database: Database, player: Player, id: string) {
  if (!isInstructor(player)) return null
  const company = database.companies.find((item) => item.id === id)
  if (!company) return null
  const taught = database.classes.some((classroom) => classroom.lecturerId === player.id && classroom.studentIds.includes(company.playerId))
  return taught ? company : null
}

function sendFile(response: ServerResponse, status: number, contentType: string, payload: string, filename?: string) {
  const headers: Record<string, string> = { 'content-type': contentType, 'access-control-allow-origin': 'http://127.0.0.1:5173' }
  if (filename) headers['content-disposition'] = `attachment; filename="${filename}"`
  response.writeHead(status, headers)
  response.end(payload)
}

function required(input: Record<string, unknown>, keys: string[]) {
  const missing = keys.filter((key) => (typeof input[key] !== 'string' && typeof input[key] !== 'number') || !String(input[key]).trim())
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}`)
}

function amountKoboFrom(input: Record<string, unknown>) {
  const value = Number(input.amountKobo ?? Number(input.amount ?? 0) * 100)
  if (!Number.isFinite(value) || value <= 0) throw new Error('Amount must be greater than zero.')
  return Math.round(value)
}

function event(company: Company, type: string, detail: Record<string, unknown> = {}) {
  company.events.unshift({ id: newId('evt'), type, createdAt: now(), ...detail })
  company.balanceKobo = Math.round(company.balance * 100)
  company.revenueKobo = Math.round(company.revenue * 100)
  company.expensesKobo = Math.round(company.expenses * 100)
  company.updatedAt = now()
}

function progressionView(company: Company) {
  const current = ALL_LEVELS.find((level) => level.levelNumber === company.progression.currentLevel) ?? ALL_LEVELS[0]
  const completed = new Set(company.progression.completedMissions)
  return {
    stageId: current.stageId ?? 'beginner',
    chapter: current.chapter,
    currentLevel: company.progression.currentLevel,
    xp: company.progression.xp,
    reputation: company.progression.reputation,
    current: { ...current, missions: current.missions.map((mission) => ({ ...mission, status: completed.has(mission.id) ? 'completed' : 'available' })) },
    levels: ALL_LEVELS.map((level) => ({ levelId: level.levelId, stageId: level.stageId ?? 'beginner', chapter: level.chapter, levelNumber: level.levelNumber, name: level.name, description: level.description, learningObjective: level.learningObjective, status: level.levelNumber < company.progression.currentLevel ? 'completed' : level.levelNumber === company.progression.currentLevel ? 'active' : 'locked', missions: level.missions.map((mission) => ({ id: mission.id, name: mission.name, status: completed.has(mission.id) ? 'completed' : level.levelNumber === company.progression.currentLevel ? 'available' : 'locked' })) })),
  }
}

function ledger(company: Company, type: Company['transactions'][number]['type'], amount: number, description: string, source: string) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.')
  const amountKobo = Math.round(amount * 100)
  company.transactions.unshift({ id: newId('txn'), type, amount, amountKobo, currency: 'NGN', description, source, sourceAccount: source, destinationAccount: 'company:cash', category: type, status: 'posted', createdBy: company.playerId, createdAt: now() })
  company.journal.push({ id: newId('jrn'), account: 'cash', debit: amountKobo, credit: 0, source, currency: 'NGN', amountKobo, createdAt: now() })
  company.journal.push({ id: newId('jrn'), account: type, debit: 0, credit: amountKobo, source, currency: 'NGN', amountKobo, createdAt: now() })
}

/** Coerce an instructor-supplied seed to a positive 31-bit integer (0/blank = generate one). */
function scenarioSeed(raw: unknown): number {
  const value = Math.round(Number(raw))
  if (Number.isFinite(value) && value > 0) return Math.min(value, 2_147_483_647)
  return Math.floor(Math.random() * 2_000_000_000) + 1
}

function createCompany(playerId: string, input: Record<string, unknown>): Company {
  required(input, ['name', 'sector', 'problem', 'solution', 'businessModel', 'ambition'])
  const timestamp = now()
  const initialCashKobo = Math.round(Number(input.initialCapitalKobo ?? 0))
  return {
    id: newId('co'), playerId, name: String(input.name).trim(), sector: String(input.sector), businessModel: String(input.businessModel), problem: String(input.problem), solution: String(input.solution), ambition: String(input.ambition), status: 'draft', createdAt: timestamp, updatedAt: timestamp, revenue: 0, expenses: 0,
    ownership: [{ holder: 'founder', shares: 100 }], research: [], businessPlan: null, registration: null, compliance: [], bankApplication: null, employees: [], fundingRequests: [], pitchDeck: null, investorApplications: [], offers: [], brand: null, products: [], suppliers: [], campaigns: [], meetings: [], orders: [], transactions: [], journal: [], events: [], progression: { xp: 0, reputation: 0, currentLevel: 1, completedMissions: [] }, balanceKobo: Math.round(Number(input.initialCapitalKobo ?? 0)), revenueKobo: 0, expensesKobo: 0, balance: Math.round(Number(input.initialCapitalKobo ?? 0)) / 100, simulation: { day: 1, lastAdvancedAt: timestamp, processedSchedules: [] }, notifications: [], popups: [], socialPosts: [], socialComments: [], reputationIncidents: [], conversations: [], messages: [], reputationProfile: { customerTrust: 50, productQuality: 50, deliveryReliability: 50, paymentReliability: 50, employeeReputation: 50, publicSentiment: 50, businessCredibility: 50 },
    authority: { ...emptyAuthority(), cashKobo: initialCashKobo, updatedAt: timestamp },
    auditChain: [],
    aiTraces: [],
  }
}

async function handle(request: IncomingMessage, response: ServerResponse, database: Database) {
  if (request.method === 'OPTIONS') { response.writeHead(204, jsonHeaders); response.end(); return }
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  const path = url.pathname.replace(/\/$/, '')
  if (request.method === 'GET' && (path === '/health' || path === '/api/health')) { send(response, 200, { ok: true, service: 'businesslife-api', time: now() }); return }
  if (request.method === 'GET' && path === '/api/stages') { send(response, 200, { stages: allStageSummaries(stageSummary()) }); return }
  if (request.method === 'GET' && path === '/api/stages/beginner') { send(response, 200, stageSummary()); return }
  if (request.method === 'GET' && path === '/api/progression') { send(response, 200, { levels: ALL_LEVELS, stages: allStageSummaries(stageSummary()) }); return }
  if (request.method === 'GET' && path === '/api/rubric') { send(response, 200, { criteria: RUBRIC, minRationale: MIN_RATIONALE, levels: { 1: 'Emerging', 2: 'Developing', 3: 'Proficient', 4: 'Exemplary' } }); return }
  if (request.method === 'GET' && path === '/api/apps') { send(response, 200, { apps: IN_GAME_APPS, fictionalBrands: true, disclaimer: 'These are fictional simulator brands.' }); return }
  if (request.method === 'GET' && path === '/api/city') { send(response, 200, database.city); return }
  if (request.method === 'GET' && path === '/api/marketplace') { send(response, 200, { listings: searchMarketplace(database.marketplace, url.searchParams), categories: [...new Set(database.marketplace.businesses.map((business) => business.category))], districts: [...new Set(database.marketplace.businesses.map((business) => business.district))] }); return }
  const marketplaceBusinessMatch = path.match(/^\/api\/marketplace\/businesses\/([^/]+)$/)
  if (request.method === 'GET' && marketplaceBusinessMatch) { const business = database.marketplace.businesses.find((item) => item.id === marketplaceBusinessMatch[1]); if (!business) { error(response, 404, 'Business not found.'); return } send(response, 200, { business, listings: database.marketplace.listings.filter((listing) => listing.businessId === business.id) }); return }
  if (request.method === 'GET' && path === '/api/companies/name-availability') { const name = String(url.searchParams.get('name') ?? '').trim(); const available = name.length >= 2 && !database.companies.some((company) => company.name.trim().toLowerCase() === name.toLowerCase()); send(response, 200, { available, name }); return }
  if (request.method === 'POST' && path === '/api/auth/register') {
    const input = await body(request)
    const accountEmail = String(input.accountEmail ?? '').trim().toLowerCase()
    const password = String(input.password ?? '')
    const name = String(input.name ?? '').trim().slice(0, 80)
    if (!name) { error(response, 400, 'Tell us your name.'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(accountEmail)) { error(response, 400, 'A valid email address is required.'); return }
    if (password.length < 8) { error(response, 400, 'Choose a password of at least 8 characters.'); return }
    if (database.players.some((item) => item.accountEmail?.toLowerCase() === accountEmail)) {
      error(response, 409, 'An account already exists for that email. Sign in instead.'); return
    }
    const wantsInstructor = input.role === 'instructor' || input.role === 'admin'
    const expectedCode = instructorCode()
    if (wantsInstructor) {
      if (!expectedCode || String(input.instructorCode ?? '') !== expectedCode) {
        error(response, 403, 'Instructor accounts need a valid instructor code from your school.'); return
      }
    }
    const role: Player['role'] = wantsInstructor ? (input.role === 'admin' ? 'admin' : 'instructor') : 'learner'
    const player: Player = {
      id: newId('plr'), name, role,
      firstName: String(input.firstName ?? name.split(' ')[0] ?? ''), lastName: String(input.lastName ?? name.split(' ').slice(1).join(' ')), nickname: String(input.nickname ?? ''), avatar: String(input.avatar ?? 'founder-1'),
      accountEmail, passwordHash: hashPassword(password), createdAt: now(), wallet: 25_000_000, progression: { xp: 0, reputation: 0 },
    }
    database.players.push(player)
    const session = issueSession(database, player.id)
    await saveDatabase(database)
    send(response, 201, { player: publicPlayer(player), token: session.token, expiresAt: session.expiresAt }); return
  }
  if (request.method === 'POST' && path === '/api/auth/login') {
    const input = await body(request)
    const accountEmail = String(input.accountEmail ?? '').trim().toLowerCase()
    const password = String(input.password ?? '')
    const key = `login:${accountEmail}`
    const limit = throttleCheck(key)
    if (!limit.allowed) { response.setHeader('retry-after', String(limit.retryAfterSeconds)); error(response, 429, 'Too many attempts. Wait a few minutes before trying again.'); return }
    const player = database.players.find((item) => item.accountEmail?.toLowerCase() === accountEmail)
    const verdict = player ? verifyPassword(password, player.passwordHash) : { ok: false, needsRehash: false }
    if (!player || !verdict.ok) {
      throttleFail(key)
      error(response, 401, 'Email or password is incorrect.'); return
    }
    throttleReset(key)
    if (verdict.needsRehash) player.passwordHash = hashPassword(password)
    const session = issueSession(database, player.id)
    await saveDatabase(database)
    send(response, 200, { player: publicPlayer(player), token: session.token, expiresAt: session.expiresAt }); return
  }
  if (request.method === 'POST' && path === '/api/auth/dev-login') {
    if (!devLoginEnabled()) { error(response, 403, 'Development sign-in is disabled. Create an account or sign in.'); return }
    const input = await body(request); const requestedRole = String(input.role ?? 'learner'); const role: Player['role'] = requestedRole === 'instructor' || requestedRole === 'admin' ? requestedRole : 'learner'
    const accountEmail = String(input.accountEmail ?? '').trim().toLowerCase()
    const existing = accountEmail ? database.players.find((item) => item.accountEmail?.toLowerCase() === accountEmail) : undefined
    const player: Player = existing ?? { id: newId('plr'), name: String(input.name ?? 'Founder'), role, firstName: String(input.firstName ?? ''), lastName: String(input.lastName ?? ''), nickname: String(input.nickname ?? ''), avatar: String(input.avatar ?? 'founder-1'), accountEmail, passwordHash: input.password ? hashPassword(String(input.password)) : undefined, createdAt: now(), wallet: 25_000_000, progression: { xp: 0, reputation: 0 } }
    if (!existing) database.players.push(player)
    const session = issueSession(database, player.id)
    await saveDatabase(database); send(response, existing ? 200 : 201, { player: publicPlayer(player), token: session.token, expiresAt: session.expiresAt, dev: true }); return
  }
  if (request.method === 'POST' && path === '/api/auth/logout') {
    revokeSession(database, requestToken(request))
    await saveDatabase(database)
    send(response, 200, { signedOut: true }); return
  }
  const player = auth(request, database)
  if (!player) { error(response, 401, 'Authentication required. Sign in to continue.'); return }
  if (request.method === 'GET' && path === '/api/me') { send(response, 200, publicPlayer(player)); return }
  if (path === '/api/classes' && request.method === 'GET') {
    const classrooms = database.classes.filter((item) => item.lecturerId === player.id || item.studentIds.includes(player.id))
    send(response, 200, { classes: classrooms.map((item) => ({ ...item, roster: isInstructor(player) ? rosterFor(database, item) : undefined })) }); return
  }
  if (path === '/api/classes' && request.method === 'POST') {
    if (!isInstructor(player)) { error(response, 403, 'Instructor access required. Sign in with an instructor account to create cohorts.'); return }
    const input = await body(request); required(input, ['name']); const classroom = { id: newId('class'), lecturerId: player.id, name: String(input.name).trim().slice(0, 80), studentIds: [] as string[], scenario: null, createdAt: now(), records: [] }; database.classes.push(classroom)
    await saveDatabase(database); send(response, 201, classroom); return
  }
  const classMatch = path.match(/^\/api\/classes\/([^/]+)(?:\/(.*))?$/)
  if (classMatch) {
    const classroom = database.classes.find((item) => item.id === classMatch[1] && (item.lecturerId === player.id || item.studentIds.includes(player.id))); if (!classroom) { error(response, 404, 'Class not found.'); return }
    const action = classMatch[2] ?? ''
    const lecturer = classroom.lecturerId === player.id && isInstructor(player)
    if (request.method === 'GET' && !action) { send(response, 200, { ...classroom, roster: rosterFor(database, classroom) }); return }
    if (request.method === 'GET' && action === 'comparison') {
      if (!lecturer) { error(response, 403, 'Instructor access required.'); return }
      send(response, 200, comparisonFor(database, classroom)); return
    }
    if (request.method === 'GET' && (action === 'roster' || action === 'export.csv')) {
      const roster = rosterFor(database, classroom)
      if (action === 'export.csv') { sendFile(response, 200, 'text/csv; charset=utf-8', rosterCsv(classroom, roster), `${classroom.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-roster.csv`); return }
      send(response, 200, { class: classroom, roster }); return
    }
    if (request.method === 'POST' && action === 'invite') {
      if (!lecturer) { error(response, 403, 'Instructor access required.'); return }
      const input = await body(request)
      const student = input.studentId
        ? database.players.find((item) => item.id === String(input.studentId))
        : database.players.find((item) => item.accountEmail && item.accountEmail.toLowerCase() === String(input.email ?? '').toLowerCase())
      if (!student) { error(response, 404, 'No student account matches that id or email.'); return }
      if (student.id === player.id) { error(response, 409, 'The lecturer cannot join their own cohort.'); return }
      if (!classroom.studentIds.includes(student.id)) classroom.studentIds.push(student.id)
      recordFor(classroom, student.id)
      await saveDatabase(database); send(response, 200, { ...classroom, roster: rosterFor(database, classroom) }); return
    }
    if (request.method === 'POST' && action === 'scenario') {
      if (!lecturer) { error(response, 403, 'Instructor access required.'); return }
      const input = await body(request)
      classroom.scenario = {
        title: String(input.title ?? 'Cohort scenario').slice(0, 80),
        industry: String(input.industry ?? 'saas'),
        difficulty: String(input.difficulty ?? 'standard'),
        startingCash: Math.max(0, Number(input.startingCash ?? 5_000_000)),
        months: Math.max(1, Math.min(60, Number(input.months ?? 12))),
        deadline: input.deadline ? String(input.deadline) : null,
        objectives: Array.isArray(input.objectives) ? input.objectives.slice(0, 10).map((item) => String(item).slice(0, 160)) : [],
        // The seed is what makes the cohort comparable: every student gets the
        // same market, the same starting conditions and the same event stream.
        seed: scenarioSeed(input.seed),
        packId: input.packId ? String(input.packId).toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || null : null,
        assignedAt: now(),
        assignedBy: player.id,
      }
      const assignedSeed = classroom.scenario.seed as number
      for (const studentId of classroom.studentIds) {
        recordFor(classroom, studentId).assignedAt = classroom.scenario.assignedAt as string
        const studentCompany = database.companies.filter((item) => item.playerId === studentId).pop()
        if (studentCompany) studentCompany.simulation.scenarioSeed = assignedSeed
      }
      await saveDatabase(database); send(response, 200, classroom); return
    }
    if (request.method === 'POST' && action === 'grade') {
      if (!lecturer) { error(response, 403, 'Instructor access required.'); return }
      const input = await body(request); required(input, ['studentId'])
      const studentId = String(input.studentId)
      if (!classroom.studentIds.includes(studentId)) { error(response, 404, 'That student is not in this cohort.'); return }

      // A rubric grade replaces the raw number: it must be complete, and it must
      // be justified in writing.
      const rubric = input.rubric === undefined ? null : parseRubric(input.rubric)
      if (input.rubric !== undefined && !rubric) { error(response, 400, 'Every rubric criterion needs a level from 1 to 4.'); return }
      const rationale = String(input.rationale ?? input.feedback ?? '').trim().slice(0, 2000)
      if (rubric && rationale.length < MIN_RATIONALE) {
        error(response, 400, `A rubric grade needs a written rationale of at least ${MIN_RATIONALE} characters.`); return
      }
      const requested = input.grade === undefined ? undefined : Math.round(Number(input.grade))
      if (!rubric && (requested === undefined || !Number.isFinite(requested))) { error(response, 400, 'Provide a grade or a complete rubric.'); return }
      const grade = rubric ? rubricGrade(rubric) : (requested as number)
      if (!Number.isFinite(grade) || grade < 0 || grade > 100) { error(response, 400, 'Grade must be between 0 and 100.'); return }

      const record = recordFor(classroom, studentId)
      const gradedAt = now()
      const previousEngineScore = record.engineScoreAtGrade
      record.grade = grade
      record.feedback = String(input.feedback ?? rationale).slice(0, 1000)
      record.rubric = rubric ?? undefined
      record.rationale = rationale || undefined
      record.gradedBy = player.id
      record.gradedAt = gradedAt
      // Grade history is what makes a competency profile over time possible: the
      // latest rubric alone cannot show whether a student is improving.
      record.history = [
        ...(record.history ?? []),
        { gradedAt, grade, engineScore: previousEngineScore, rubric: rubric ?? undefined, rationale: rationale || undefined },
      ].slice(-20)
      const company = database.companies.filter((item) => item.playerId === studentId).pop()
      if (company) {
        const engineScore = authorityOf(company).score
        record.engineScoreAtGrade = engineScore
        const rationaleDigest = createHash('sha256').update(rationale).digest('hex').slice(0, 16)
        appendAudit(company, 'instructor_grade', player.id, {
          grade,
          cohortId: classroom.id,
          engineScore,
          rubric: rubric ?? null,
          rationaleLength: rationale.length,
          rationaleDigest,
        })
        company.notifications.unshift({ id: newId('note'), type: 'grade_recorded', priority: 'important', message: `Your instructor recorded a grade of ${grade}.`, createdAt: now() })
      }
      await saveDatabase(database); send(response, 200, { ...record, breakdown: rubric ? rubricBreakdown(rubric) : null, roster: rosterFor(database, classroom) }); return
    }
    if (request.method === 'POST' && action === 'reset') {
      if (!lecturer) { error(response, 403, 'Instructor access required.'); return }
      const input = await body(request); required(input, ['studentId'])
      const studentId = String(input.studentId)
      if (!classroom.studentIds.includes(studentId)) { error(response, 404, 'That student is not in this cohort.'); return }
      const company = database.companies.filter((item) => item.playerId === studentId).pop()
      if (!company) { error(response, 404, 'That student has not started a company yet.'); return }
      const start = scenarioStart(classroom.scenario)
      const authority = authorityOf(company)
      company.authority = {
        ...authority,
        version: 1,
        score: 0,
        month: start.month,
        day: start.day,
        cashKobo: start.startingCashKobo || authority.cashKobo,
        customers: 0,
        revenueKobo: 0,
        expensesKobo: 0,
        valuationKobo: 0,
        status: 'active',
        commits: 0,
        updatedAt: now(),
        lastViolationAt: undefined,
      }
      company.balanceKobo = company.authority.cashKobo
      company.balance = company.balanceKobo / 100
      company.revenueKobo = 0; company.revenue = 0
      company.expensesKobo = 0; company.expenses = 0
      company.authorityViolations = []
      company.simulation.day = start.day
      company.simulation.scenarioSeed = start.seed ?? company.simulation.scenarioSeed
      company.simulation.runSeed = start.seed ?? undefined
      company.simulation.replayInput = undefined
      company.simulation.replay = { status: 'none', checkedAt: now(), ops: 0, months: 0, diffs: 0 }
      recordFor(classroom, studentId).resetAt = now()
      appendAudit(company, 'cohort_run_reset', player.id, { cohortId: classroom.id, startingCashKobo: company.authority.cashKobo })
      company.notifications.unshift({ id: newId('note'), type: 'run_reset', priority: 'critical', message: 'Your instructor reset the scenario to its starting conditions.', createdAt: now() })
      await saveDatabase(database); send(response, 200, { reset: true, authority: publicAuthority(company.authority), roster: rosterFor(database, classroom) }); return
    }
    if (request.method === 'POST' && action === 'leave') {
      classroom.studentIds = classroom.studentIds.filter((id) => id !== player.id)
      classroom.records = (classroom.records ?? []).filter((item) => item.studentId !== player.id)
      await saveDatabase(database); send(response, 200, { left: true }); return
    }
    error(response, 404, 'Class endpoint not found.'); return
  }
  if (request.method === 'GET' && path === '/api/companies') { send(response, 200, { companies: database.companies.filter((company) => company.playerId === player.id) }); return }
  if (request.method === 'POST' && path === '/api/companies') { const input = await body(request); const requestedName = String(input.name ?? '').trim(); if (database.companies.some((item) => item.name.trim().toLowerCase() === requestedName.toLowerCase())) { error(response, 409, 'That business name is already taken. Choose another name.'); return } const company = createCompany(player.id, input); database.companies.push(company); database.npcs.push(...seedCompanyNpcs(company.id, company.sector)); appendAudit(company, 'company_created', player.id, { sector: company.sector, initialCapitalKobo: company.balanceKobo }); await saveDatabase(database); send(response, 201, company); return }
  const stage2CompanyMatch = path.match(/^\/api\/companies\/([^/]+)\/stage-02\/(report|enter)$/)
  if (stage2CompanyMatch) {
    const company = ownedCompany(database, player, stage2CompanyMatch[1]); if (!company) { error(response, 404, 'Company not found.'); return }
    const report = { revenueKobo: company.revenueKobo, expensesKobo: company.expensesKobo, profitLossKobo: company.revenueKobo - company.expensesKobo, cashAvailableKobo: company.balanceKobo, customers: company.orders.length, repeatCustomers: new Set(company.orders.map((order) => String(order.customer ?? ''))).size, orders: { completed: company.orders.filter((order) => order.status === 'paid' || order.status === 'completed').length, pending: company.orders.filter((order) => order.status === 'pending' || order.status === 'awaiting_delivery').length, failed: company.orders.filter((order) => order.status === 'failed').length }, inventory: { units: company.products.reduce((sum, product) => sum + Number(product.stock ?? 0), 0), lowStockItems: company.products.filter((product) => Number(product.stock ?? 0) < 5).map((product) => product.name) }, employees: { count: company.employees.length, monthlyPayrollKobo: company.employees.reduce((sum, employee) => sum + Number(employee.salaryKobo ?? 0), 0) }, suppliers: company.suppliers.length, reputation: company.progression.reputation, outstandingPaymentsKobo: 0, generatedAt: now() }
    if (stage2CompanyMatch[2] === 'report') { send(response, 200, report); return }
    if (company.status === 'draft') { error(response, 409, 'A company must be established before entering Early Growth.'); return }
    company.progression.currentLevel = Math.max(16, company.progression.currentLevel); company.notifications.unshift({ id: newId('note'), type: 'stage_02_entry', priority: 'high', report, createdAt: now() }); event(company, 'stage_02_entered', { report }); await saveDatabase(database); send(response, 200, { stageId: 'stage-2', currentLevel: company.progression.currentLevel, report }); return
  }
  const progressionMatch = path.match(/^\/api\/companies\/([^/]+)\/progression$/)
  if (request.method === 'GET' && progressionMatch) { const company = ownedCompany(database, player, progressionMatch[1]); if (!company) { error(response, 404, 'Company not found.'); return } send(response, 200, progressionView(company)); return }
  const storefrontMatch = path.match(/^\/api\/companies\/([^/]+)\/storefront$/)
  if (request.method === 'POST' && storefrontMatch) {
    const company = ownedCompany(database, player, storefrontMatch[1]); if (!company) { error(response, 404, 'Company not found.'); return }
    const input = await body(request); const existing = database.marketplace.businesses.find((business) => business.ownerCompanyId === company.id)
    const business = existing ?? { id: newId('biz'), ownerCompanyId: company.id, name: company.name, category: String(input.category ?? company.sector), district: String(input.district ?? 'central'), description: String(input.description ?? company.solution), rating: 5, reliability: 0.8, deliveryAvailable: Boolean(input.deliveryAvailable ?? true), paymentTerms: ['upfront'], balanceKobo: 0, createdAt: now() }
    Object.assign(business, { name: String(input.name ?? business.name), category: String(input.category ?? business.category), district: String(input.district ?? business.district), description: String(input.description ?? business.description), deliveryAvailable: Boolean(input.deliveryAvailable ?? business.deliveryAvailable) })
    if (!existing) database.marketplace.businesses.push(business)
    for (const product of company.products) { const listing = database.marketplace.listings.find((item) => item.businessId === business.id && item.product === product.name); if (listing) Object.assign(listing, { priceKobo: Number(product.priceKobo ?? listing.priceKobo), stock: Number(product.stock ?? listing.stock), updatedAt: now() }); else database.marketplace.listings.push({ id: newId('listing'), businessId: business.id, product: String(product.name), description: String(product.description ?? ''), priceKobo: Number(product.priceKobo ?? 0), stock: Number(product.stock ?? 0), minimumOrder: 1, deliveryFeeKobo: 0, active: true, updatedAt: now() }) }
    await saveDatabase(database); send(response, 200, { business, listings: database.marketplace.listings.filter((listing) => listing.businessId === business.id) }); return
  }
  const followMatch = path.match(/^\/api\/marketplace\/businesses\/([^/]+)\/follow$/)
  if (request.method === 'POST' && followMatch) { if (!database.marketplace.businesses.some((business) => business.id === followMatch[1])) { error(response, 404, 'Business not found.'); return } if (!database.marketplace.follows.some((follow) => follow.playerId === player.id && follow.businessId === followMatch[1])) database.marketplace.follows.push({ playerId: player.id, businessId: followMatch[1], createdAt: now() }); await saveDatabase(database); send(response, 200, { following: true, businessId: followMatch[1] }); return }
  const messageMatch = path.match(/^\/api\/marketplace\/businesses\/([^/]+)\/messages$/)
  if (request.method === 'POST' && messageMatch) { const input = await body(request); required(input, ['message']); const message = { id: newId('message'), playerId: player.id, businessId: messageMatch[1], message: String(input.message), createdAt: now() }; database.marketplace.messages.push(message); await saveDatabase(database); send(response, 201, message); return }
  if (request.method === 'POST' && path === '/api/marketplace/enquiries') { const input = await body(request); required(input, ['companyId', 'listingId', 'quantity']); const company = ownedCompany(database, player, String(input.companyId)); const listing = database.marketplace.listings.find((item) => item.id === input.listingId); if (!company || !listing) { error(response, 404, 'Company or listing not found.'); return } const enquiry = { id: newId('enquiry'), buyerCompanyId: company.id, businessId: listing.businessId, listingId: listing.id, quantity: Math.floor(Number(input.quantity)), message: String(input.message ?? ''), status: 'open', createdAt: now() }; database.marketplace.enquiries.push(enquiry); await saveDatabase(database); send(response, 201, enquiry); return }
  const quoteMatch = path.match(/^\/api\/marketplace\/enquiries\/([^/]+)\/quote$/)
  if (request.method === 'POST' && quoteMatch) { const enquiry = database.marketplace.enquiries.find((item) => item.id === quoteMatch[1]); if (!enquiry) { error(response, 404, 'Enquiry not found.'); return } const listing = database.marketplace.listings.find((item) => item.id === enquiry.listingId); if (!listing) { error(response, 404, 'Listing not found.'); return } const input = await body(request); const quantity = Math.max(1, Math.floor(Number(enquiry.quantity))); const unitPriceKobo = Math.max(1, Math.round(Number(input.unitPriceKobo ?? listing.priceKobo))); const quote = { id: newId('quote'), enquiryId: enquiry.id, listingId: listing.id, businessId: listing.businessId, buyerCompanyId: enquiry.buyerCompanyId, quantity, unitPriceKobo, deliveryFeeKobo: listing.deliveryFeeKobo, totalKobo: unitPriceKobo * quantity + listing.deliveryFeeKobo, paymentTerms: String(input.paymentTerms ?? 'upfront'), status: 'offered', createdAt: now() }; database.marketplace.quotations.push(quote); enquiry.status = 'quoted'; await saveDatabase(database); send(response, 201, quote); return }
  const acceptQuoteMatch = path.match(/^\/api\/marketplace\/quotations\/([^/]+)\/accept$/)
  if (request.method === 'POST' && acceptQuoteMatch) { const quote = database.marketplace.quotations.find((item) => item.id === acceptQuoteMatch[1]); if (!quote) { error(response, 404, 'Quotation not found.'); return } const company = ownedCompany(database, player, String(quote.buyerCompanyId)); const listing = database.marketplace.listings.find((item) => item.id === quote.listingId); const idem = request.headers['idempotency-key']?.toString(); if (!company || !listing) { error(response, 404, 'Company or listing not found.'); return } if (idem && database.marketplace.orders.some((order) => order.idempotencyKey === idem)) { send(response, 200, database.marketplace.orders.find((order) => order.idempotencyKey === idem)); return } if (listing.stock < Number(quote.quantity)) { error(response, 409, 'The supplier no longer has enough stock.'); return } if (company.balanceKobo < Number(quote.totalKobo)) { error(response, 409, 'Company cash cannot cover this purchase.'); return } ledger(company, 'expense', Number(quote.totalKobo) / 100, 'Marketplace purchase', `marketplace:${listing.id}`); company.balanceKobo -= Number(quote.totalKobo); company.balance -= Number(quote.totalKobo) / 100; company.expensesKobo += Number(quote.totalKobo); company.expenses += Number(quote.totalKobo) / 100; listing.stock -= Number(quote.quantity); listing.updatedAt = now(); const order = { id: newId('purchase-order'), quotationId: quote.id, buyerCompanyId: company.id, sellerBusinessId: quote.businessId, listingId: listing.id, quantity: quote.quantity, agreedUnitPriceKobo: quote.unitPriceKobo, totalKobo: quote.totalKobo, status: 'awaiting_delivery', paymentStatus: 'paid', idempotencyKey: idem, createdAt: now() }; database.marketplace.orders.push(order); quote.status = 'accepted'; await saveDatabase(database); send(response, 201, order); return }
  const communicationsMatch = path.match(/^\/api\/companies\/([^/]+)\/(social\/feed|social\/reputation|social\/posts|social\/posts\/([^/]+)\/(comments|react|share)|social\/posts\/([^/]+)\/report|social\/incidents\/([^/]+)\/(respond|report)|messages|conversations|conversations\/([^/]+)\/reply|notifications\/([^/]+)\/read)$/)
  if (communicationsMatch) {
    const company = ownedCompany(database, player, communicationsMatch[1]); if (!company) { error(response, 404, 'Company not found.'); return }
    ensureCommunications(company)
    const action = communicationsMatch[2]
    if (request.method === 'GET' && action === 'social/feed') { send(response, 200, { posts: company.socialPosts, comments: company.socialComments, incidents: company.reputationIncidents, reputation: reputation(company) }); return }
    if (request.method === 'GET' && action === 'social/reputation') { send(response, 200, { reputation: reputation(company), incidents: company.reputationIncidents }); return }
    if (request.method === 'GET' && action === 'messages') { send(response, 200, { conversations: company.conversations, messages: company.messages }); return }
    if (request.method === 'POST' && action === 'social/posts') { const post = createPost(company, await body(request), player.id, player.name); event(company, 'social_post_published', { postId: post.id }); await saveDatabase(database); send(response, 201, post); return }
    if (request.method === 'POST' && action.startsWith('social/posts/') && action.endsWith('/comments')) { const post = company.socialPosts.find((item) => item.id === communicationsMatch[3]); if (!post) { error(response, 404, 'Post not found.'); return } const comment = createComment(company, post, await body(request), player.id, player.name); await saveDatabase(database); send(response, 201, comment); return }
    if (request.method === 'POST' && action.startsWith('social/posts/') && (action.endsWith('/react') || action.endsWith('/share'))) { const postId = communicationsMatch[3]; const post = company.socialPosts.find((item) => item.id === postId); if (!post) { error(response, 404, 'Post not found.'); return } if (action.endsWith('/react')) post.views += 1; else post.shares += 1; await saveDatabase(database); send(response, 200, post); return }
    if (request.method === 'POST' && action.endsWith('/report')) { const input = await body(request); const postId = communicationsMatch[5]; const post = company.socialPosts.find((item) => item.id === postId); if (!post) { error(response, 404, 'Post not found.'); return } const incident = company.reputationIncidents.find((item) => item.postId === post.id) ?? createIncident(company, post, input); incident.moderation = { status: 'submitted', reason: String(input.reason ?? 'misleading or abusive content'), submittedAt: now() }; incident.updatedAt = now(); notification(company, { category: 'social_media', priority: 'important', title: 'Report submitted', message: 'The platform will review the reported post. Reporting does not guarantee removal.', relatedType: 'reputation_incident', relatedId: incident.id, action: 'view_incident' }); await saveDatabase(database); send(response, 200, incident); return }
    if (request.method === 'POST' && action.startsWith('social/incidents/') && action.endsWith('/respond')) { const incident = company.reputationIncidents.find((item) => item.id === communicationsMatch[6]); if (!incident) { error(response, 404, 'Reputation incident not found.'); return } const input = await body(request); const responseRecord = { action: String(input.action ?? 'contact_customer'), note: String(input.note ?? ''), createdAt: now() }; incident.responses.push(responseRecord); incident.status = input.resolved === true ? 'resolved' : 'investigating'; incident.updatedAt = now(); applyIncidentOutcome(company, incident, input.resolved === true); if (input.publicResponse) { const post = company.socialPosts.find((item) => item.id === incident.postId); if (post) createComment(company, post, { content: input.publicResponse }, player.id, player.name) } event(company, 'reputation_response_recorded', { incidentId: incident.id, responseAction: responseRecord.action }); await saveDatabase(database); send(response, 200, incident); return }
    if (request.method === 'POST' && action === 'messages') { const input = await body(request); const conversation = openConversation(company, input); const message = addMessage(company, conversation, input, 'outbound', player.id, player.name); await saveDatabase(database); send(response, 201, { conversation, message }); return }
    if (request.method === 'POST' && action === 'conversations') { const conversation = openConversation(company, await body(request)); await saveDatabase(database); send(response, 201, conversation); return }
    if (request.method === 'POST' && action.startsWith('conversations/') && action.endsWith('/reply')) { const conversation = company.conversations.find((item) => item.id === communicationsMatch[8]); if (!conversation) { error(response, 404, 'Conversation not found.'); return } const message = addMessage(company, conversation, await body(request), 'outbound', player.id, player.name); await saveDatabase(database); send(response, 201, message); return }
    if (request.method === 'POST' && action.startsWith('notifications/') && action.endsWith('/read')) { const item = company.notifications.find((value) => value.id === communicationsMatch[9]); if (!item) { error(response, 404, 'Notification not found.'); return } item.read = true; await saveDatabase(database); send(response, 200, item); return }
    error(response, 404, 'Communications endpoint not found.'); return
  }
  const runMatch = path.match(/^\/api\/companies\/([^/]+)\/run$/)
  if (runMatch) {
    const company = ownedCompany(database, player, runMatch[1]) ?? taughtCompany(database, player, runMatch[1])
    if (!company) { error(response, 404, 'Company not found.'); return }
    if (request.method === 'GET') {
      const authority = authorityOf(company)
      send(response, 200, {
        companyId: company.id,
        authority: publicAuthority(authority),
        canonical: {
          month: authority.month, day: authority.day, cashKobo: authority.cashKobo, customers: authority.customers,
          revenueKobo: authority.revenueKobo, expensesKobo: authority.expensesKobo, valuationKobo: authority.valuationKobo, status: authority.status,
        },
        score: authority.score,
        integrity: verifyChain(company),
        violations: (company.authorityViolations ?? []).slice(0, 10),
        readOnly: company.playerId !== player.id,
        replay: company.simulation.replay ?? { status: 'none' as const, checkedAt: '', ops: 0, months: 0, diffs: 0 },
      }); return
    }
    if (request.method === 'PUT') {
      if (company.playerId !== player.id) { error(response, 403, 'Only the company owner can commit a run.'); return }
      const input = await body(request) as Partial<RunSnapshot> & { replay?: ReplayInput }
      const runSeed = Number(input.seed)
      if (Number.isFinite(runSeed) && runSeed > 0) company.simulation.runSeed = Math.round(runSeed)

      // If the client sent its decision journal, re-execute the run here and
      // trust only what the server's own engine produces.
      let verdict: ReplayVerdict | null = null
      if (input.replay && Array.isArray(input.replay.journal) && input.replay.journal.length) {
        verdict = await runReplay(
          { profile: { ...input.replay.profile, seed: Number(input.replay.profile?.seed ?? company.simulation.runSeed ?? 0) }, journal: input.replay.journal },
          projectionFromSnapshot(input),
          MAX_REPLAY_OPS,
        )
        company.simulation.replay = {
          status: verdict.status,
          checkedAt: now(),
          ops: verdict.ops,
          months: verdict.months,
          diffs: verdict.diffs.length,
          error: verdict.error,
        }
        if (verdict.ok) {
          company.simulation.replayInput = {
            profile: { ...input.replay.profile, seed: Number(input.replay.profile?.seed ?? company.simulation.runSeed ?? 0) },
            journal: input.replay.journal.slice(0, MAX_REPLAY_OPS),
          }
          // The server's execution wins: validate and score the replayed values.
          Object.assign(input, verdict.snapshot ?? {})
        } else {
          verdict.status = 'error'
        }
      }

      const result = validateSnapshot(company, input)
      if (verdict?.ok) {
        // Use the score the server's own execution produced rather than
        // re-deriving it from bounded canonical values.
        result.score = verdict.score
        result.authority.score = verdict.score
      }
      if (verdict && verdict.status !== 'match') {
        const first = verdict.diffs[0]
        result.violations = [
          {
            code: verdict.status === 'error' ? 'replay_failed' : 'replay_mismatch',
            field: first?.field ?? 'journal',
            message:
              verdict.status === 'error'
                ? `Server replay could not complete: ${verdict.error ?? 'invalid journal'}`
                : `Server replay disagrees with the committed figures (${verdict.diffs.map((diff) => diff.field).join(', ')}).`,
            clientValue: first?.client ?? null,
            canonicalValue: first?.replay ?? null,
            at: now(),
          },
          ...result.violations,
        ]
        result.tampered = true
      }
      company.authority = result.authority
      if (result.violations.length) company.authorityViolations = [...result.violations, ...(company.authorityViolations ?? [])].slice(0, 20)
      applyCanonical(company, result.canonical)
      appendAudit(company, 'run_commit', player.id, {
        month: result.canonical.month,
        score: result.score,
        tampered: result.tampered,
        violations: result.violations.map((item) => item.code),
        seed: company.simulation.runSeed ?? null,
        replay: company.simulation.replay?.status ?? 'none',
        replayOps: company.simulation.replay?.ops ?? 0,
      })
      await saveDatabase(database)
      send(response, 200, {
        accepted: !result.tampered,
        tampered: result.tampered,
        canonical: result.canonical,
        authority: publicAuthority(result.authority),
        score: result.score,
        violations: result.violations,
        integrity: verifyChain(company),
        seed: company.simulation.runSeed ?? null,
        scenarioSeed: company.simulation.scenarioSeed ?? null,
        replay: company.simulation.replay ?? { status: 'none' as const, checkedAt: '', ops: 0, months: 0, diffs: 0 },
      }); return
    }
    error(response, 405, 'Use GET or PUT on a company run.'); return
  }
  const replayMatch = path.match(/^\/api\/companies\/([^/]+)\/replay$/)
  if (replayMatch) {
    if (request.method !== 'GET') { error(response, 405, 'Use GET on a company replay.'); return }
    const company = ownedCompany(database, player, replayMatch[1]) ?? taughtCompany(database, player, replayMatch[1])
    if (!company) { error(response, 404, 'Company not found.'); return }
    const stored = company.simulation.replayInput
    if (!stored) {
      send(response, 200, { status: 'none', message: 'No decision journal has been committed for this company yet.', replay: company.simulation.replay ?? null }); return
    }
    const verdict = await runReplay({ profile: stored.profile, journal: stored.journal }, undefined, MAX_REPLAY_OPS)
    company.simulation.replay = {
      status: verdict.status,
      checkedAt: now(),
      ops: verdict.ops,
      months: verdict.months,
      diffs: verdict.diffs.length,
      error: verdict.error,
    }
    appendAudit(company, 'replay_verified', player.id, {
      status: verdict.status,
      ops: verdict.ops,
      months: verdict.months,
      score: verdict.score,
      error: verdict.error ?? null,
    })
    await saveDatabase(database)
    send(response, 200, {
      status: verdict.status,
      ok: verdict.ok,
      error: verdict.error ?? null,
      ops: verdict.ops,
      months: verdict.months,
      score: verdict.score,
      projection: verdict.projection,
      authorityScore: authorityOf(company).score,
      replay: company.simulation.replay,
    }); return
  }
  const auditMatch = path.match(/^\/api\/companies\/([^/]+)\/audit$/)
  if (request.method === 'GET' && auditMatch) {
    const company = ownedCompany(database, player, auditMatch[1]) ?? taughtCompany(database, player, auditMatch[1])
    if (!company) { error(response, 404, 'Company not found.'); return }
    const chain = company.auditChain ?? []
    send(response, 200, { verification: verifyChain(company), records: chain.slice(-50), violations: (company.authorityViolations ?? []).slice(0, 20) }); return
  }
  const aiMatch = path.match(/^\/api\/companies\/([^/]+)\/ai(?:\/(characters|advice|dialogue))?$/)
  if (aiMatch) {
    const company = ownedCompany(database, player, aiMatch[1])
    if (!company) { error(response, 404, 'Company not found.'); return }
    const action = aiMatch[2] ?? 'characters'
    if (request.method === 'GET' && action === 'characters') {
      send(response, 200, {
        characters: Object.values(CHARACTERS).map((character) => ({ id: character.id, name: character.name, role: character.role, goals: character.goals, personality: character.personality, knowledge: character.knowledge })),
        provider: process.env.AI_PROVIDER === 'openai-compatible' && process.env.AI_API_KEY ? `openai-compatible:${process.env.AI_MODEL ?? 'default'}` : 'deterministic',
        guardrails: { tools: 'none', rateLimit: '20 per 10 minutes per company', stateChanges: 'forbidden', numericValidation: 'replies may only cite supplied figures' },
        traces: (company.aiTraces ?? []).slice(0, 10),
      }); return
    }
    if (request.method === 'POST' && (action === 'advice' || action === 'dialogue')) {
      const input = await body(request)
      const message = String(input.message ?? input.question ?? '').slice(0, 600)
      const character = action === 'advice' ? 'nova' : String(input.character ?? 'nova')
      const outcome = await runDialogue(company, character, message)
      const trace = traceDialogue(company, outcome, message)
      appendAudit(company, 'ai_dialogue', player.id, { character: outcome.character, provider: outcome.provider, blocked: outcome.blocked, reason: outcome.reason ?? null })
      await saveDatabase(database)
      send(response, 200, { ...outcome, facts: factsFor(company), trace }); return
    }
    error(response, 404, 'AI endpoint not found.'); return
  }
  const specialCompany = path.match(/^\/api\/companies\/([^/]+)\/(time\/advance|popups|notifications|forecast|evaluate-action|operations\/overview|products|suppliers|procurement|marketing\/campaigns|finance\/loan|finance\/repay|budget|supplier-selection|sales\/pipeline|sales\/funnel|operations\/orders|branches|npcs|npcs\/interview|npcs\/evaluate-investor|npcs\/select-supplier|npcs\/recruit)$/)
  if (specialCompany) {
    const company = ownedCompany(database, player, specialCompany[1]); if (!company) { error(response, 404, 'Company not found.'); return }
    ensureCommunications(company)
    const action = specialCompany[2]
    if (request.method === 'GET' && action === 'notifications') { send(response, 200, { notifications: company.notifications }); return }
    if (request.method === 'GET' && action === 'forecast') { send(response, 200, forecast(company, Number(url.searchParams.get('days') ?? 30))); return }
    if (request.method === 'GET' && action === 'operations/overview') { send(response, 200, operationsOverview(company)); return }
    if (request.method === 'GET' && action === 'npcs') { const type = url.searchParams.get('type'); send(response, 200, { npcs: database.npcs.filter((npc) => npc.companyId === company.id && (!type || npc.type === type)) }); return }
    if (request.method === 'POST' && action === 'evaluate-action') { const input = await body(request); required(input, ['action']); send(response, 200, evaluateAction(company, String(input.action), input)); return }
    if (request.method === 'POST' && action === 'time/advance') {
      const input = await body(request); const days = Math.max(1, Math.min(30, Number(input.days ?? 1))); company.simulation.day += days; company.simulation.lastAdvancedAt = now(); const scheduleKey = `day-${company.simulation.day}`
      if (!company.simulation.processedSchedules.includes(scheduleKey)) { company.simulation.processedSchedules.push(scheduleKey); const payroll = company.employees.reduce((total, employee) => total + Number(employee.salary ?? Number(employee.salaryKobo ?? 0) / 100), 0) * (days / 30); if (payroll > 0) { company.balance -= payroll; company.expenses += payroll; ledger(company, 'expense', Math.max(1, payroll), 'Scheduled payroll', 'time_scheduler') } const priority = company.balance < Math.max(payroll * 2, 0) ? 'high' : 'normal'; company.notifications.unshift({ id: newId('note'), type: 'time_advanced', priority, day: company.simulation.day, createdAt: now() }); if (company.progression.currentLevel >= 16) { const alerts = [company.balanceKobo < 1_000_000 && 'Cash available is low.', company.orders.length === 0 && 'No customer orders are recorded yet.', company.employees.length === 0 && 'The company has no employees; consider outsourcing or hiring.'].filter(Boolean); for (const message of alerts) company.notifications.unshift({ id: newId('note'), type: 'growth_alert', priority: 'high', message, day: company.simulation.day, createdAt: now() }); company.events.unshift({ id: newId('event'), type: 'monthly_business_report', day: company.simulation.day, revenueKobo: company.revenueKobo, expensesKobo: company.expensesKobo, profitLossKobo: company.revenueKobo - company.expensesKobo, createdAt: now() }) } generateNpcActivity(company, database.npcs.filter((npc) => npc.companyId === company.id && npc.type === 'customer'), company.simulation.day) }
    } else if (request.method === 'POST' && action === 'popups') {
      const input = await body(request); required(input, ['propertyId', 'name']); const property = database.city.properties.find((item) => item.id === input.propertyId && item.available); if (!property) { error(response, 409, 'Property is not available.'); return } const popup = { id: newId('popup'), status: 'draft', createdAt: now(), ...input }; company.popups.push(popup); property.available = false; event(company, 'popup_created', { popupId: popup.id })
    } else if (request.method === 'POST' && action === 'products') {
      const input = await body(request); required(input, ['name', 'priceKobo']); const product = { id: newId('product'), stock: 0, quality: 50, createdAt: now(), ...input, priceKobo: Math.round(Number(input.priceKobo)) }; company.products.push(product); event(company, 'product_created', { productId: product.id })
    } else if (request.method === 'POST' && action === 'suppliers') {
      const input = await body(request); required(input, ['name']); const supplier = { id: newId('supplier'), reliability: 0.8, createdAt: now(), ...input }; company.suppliers.push(supplier); event(company, 'supplier_added', { supplierId: supplier.id })
    } else if (request.method === 'POST' && action === 'procurement') {
      const input = await body(request); required(input, ['productId', 'units', 'unitCostKobo']); const units = Math.max(1, Math.floor(Number(input.units))); const unitCostKobo = Math.round(Number(input.unitCostKobo)); const totalKobo = units * unitCostKobo; if (company.balanceKobo < totalKobo) { error(response, 409, 'Company cash cannot cover this procurement.'); return } const product = company.products.find((item) => item.id === input.productId); if (!product) { error(response, 404, 'Product not found.'); return } ledger(company, 'expense', totalKobo / 100, 'Inventory procurement', 'supplier_procurement'); company.balanceKobo -= totalKobo; company.balance = company.balanceKobo / 100; company.expensesKobo += totalKobo; company.expenses = company.expensesKobo / 100; product.stock = Number(product.stock ?? 0) + units; event(company, 'inventory_procured', { productId: input.productId, units, totalKobo })
    } else if (request.method === 'POST' && action === 'marketing/campaigns') {
      const input = await body(request); required(input, ['name', 'budgetKobo']); const budgetKobo = Math.round(Number(input.budgetKobo)); if (company.balanceKobo < budgetKobo) { error(response, 409, 'Company cash cannot cover this campaign.'); return } ledger(company, 'expense', budgetKobo / 100, 'Marketing campaign', 'marketing_campaign'); company.balanceKobo -= budgetKobo; company.balance = company.balanceKobo / 100; company.expensesKobo += budgetKobo; company.expenses = company.expensesKobo / 100; const campaign = { id: newId('campaign'), status: 'active', createdAt: now(), ...input, budgetKobo }; company.campaigns.push(campaign); event(company, 'marketing_campaign_started', { campaignId: campaign.id })
    } else if (request.method === 'POST' && action === 'finance/loan') {
      const input = await body(request); const amountKobo = amountKoboFrom(input); ledger(company, 'loan', amountKobo / 100, 'Company loan', 'company_loan'); company.balance += amountKobo / 100; event(company, 'loan_received', { amountKobo }); appendAudit(company, 'loan_received', player.id, { amountKobo })
    } else if (request.method === 'POST' && action === 'finance/repay') {
      const input = await body(request); const amount = amountKoboFrom(input); if (company.balanceKobo < amount) { error(response, 409, 'Company cash cannot cover this repayment.'); return } company.balanceKobo -= amount; company.balance = company.balanceKobo / 100; ledger(company, 'expense', amount / 100, 'Debt repayment', 'debt_repayment'); event(company, 'debt_repaid', { amountKobo: amount }); appendAudit(company, 'debt_repaid', player.id, { amountKobo: amount })
    } else if (request.method === 'POST' && action === 'budget') {
      const input = await body(request); company.events.unshift({ id: newId('evt'), type: 'budget_updated', createdAt: now(), ...input });
    } else if (request.method === 'POST' && action === 'supplier-selection') {
      const input = await body(request); company.events.unshift({ id: newId('evt'), type: 'supplier_selected', createdAt: now(), ...input });
    } else if (request.method === 'POST' && action === 'sales/pipeline') {
      const input = await body(request); company.events.unshift({ id: newId('evt'), type: 'pipeline_updated', createdAt: now(), ...input });
    } else if (request.method === 'POST' && action === 'operations/orders') {
      // Purchase orders, expedites and capacity capex run in the engine and are
      // re-executed from the journal on commit; this records the decision.
      const input = await body(request); const orderAction = String(input.action ?? '');
      if (!['place', 'expedite', 'cancel', 'invest'].includes(orderAction)) { error(response, 400, 'Unknown operations action.'); return }
      if ((orderAction === 'expedite' || orderAction === 'cancel') && !input.orderId) { error(response, 400, 'An order id is required.'); return }
      company.events.unshift({ id: newId('evt'), type: 'purchase_order_updated', createdAt: now(), orderAction, orderId: input.orderId ? String(input.orderId).slice(0, 80) : null, cover: Number(input.cover ?? 0), amountKobo: Math.round(Number(input.amount ?? 0) * 100) });
    } else if (request.method === 'POST' && action === 'sales/funnel') {
      // The funnel runs in the engine (see src/game/sales.ts) and is re-executed
      // from the journal on commit; this records the decision on the company.
      const input = await body(request); const leadId = String(input.leadId ?? '').slice(0, 80);
      if (!leadId) { error(response, 400, 'A lead id is required.'); return }
      company.events.unshift({ id: newId('evt'), type: 'funnel_updated', createdAt: now(), leadId, funnelAction: String(input.action ?? 'update').slice(0, 40), value: Math.round(Number(input.value ?? 0)), discount: Number(input.discount ?? 0) });
    } else if (request.method === 'POST' && action === 'branches') {
      const input = await body(request); company.events.unshift({ id: newId('evt'), type: 'branch_opened', createdAt: now(), ...input });
    } else if (request.method === 'POST' && action === 'npcs/interview') {
      const input = await body(request); const customer = database.npcs.find((npc) => npc.id === input.npcId && npc.companyId === company.id && npc.type === 'customer'); if (!customer) { error(response, 404, 'Customer NPC not found.'); return } send(response, 200, interviewCustomer(customer, input.product as { priceKobo?: number; quality?: number } ?? {})); return
    } else if (request.method === 'POST' && action === 'npcs/evaluate-investor') {
      const input = await body(request); const investor = database.npcs.find((npc) => npc.id === input.npcId && npc.companyId === company.id && npc.type === 'investor'); if (!investor) { error(response, 404, 'Investor NPC not found.'); return } const evaluation = evaluateInvestor(investor, company, amountKoboFrom(input)); company.investorApplications.push({ id: newId('investor-application'), status: evaluation.decision, createdAt: now(), ...evaluation }); event(company, 'investor_evaluated', evaluation); await saveDatabase(database); send(response, 200, evaluation); return
    } else if (request.method === 'POST' && action === 'npcs/select-supplier') {
      const input = await body(request); const supplier = database.npcs.find((npc) => npc.id === input.npcId && npc.companyId === company.id && npc.type === 'supplier'); if (!supplier) { error(response, 404, 'Supplier NPC not found.'); return } const selection = selectNpcSupplier(supplier, company); company.suppliers.push({ npcId: supplier.id, name: supplier.name, ...selection, selectedAt: now() }); event(company, 'npc_supplier_selected', selection); await saveDatabase(database); send(response, 200, selection); return
    } else if (request.method === 'POST' && action === 'npcs/recruit') {
      const input = await body(request); const candidate = database.npcs.find((npc) => npc.id === input.npcId && npc.companyId === company.id && npc.type === 'employee'); if (!candidate) { error(response, 404, 'Employee NPC not found.'); return } const offeredSalaryKobo = amountKoboFrom(input); const desiredSalaryKobo = Number(candidate.profile.salaryKobo ?? 0); if (offeredSalaryKobo < desiredSalaryKobo * 0.9) { error(response, 409, 'Candidate declined: the offer is below their acceptable range.'); return } if (company.balanceKobo < offeredSalaryKobo * 3) { error(response, 409, 'Hiring would leave less than three months of payroll runway.'); return } const employee = { id: newId('emp'), npcId: candidate.id, name: candidate.name, role: candidate.profile.role, salaryKobo: offeredSalaryKobo, skill: candidate.profile.skill, reliability: candidate.profile.reliability, status: 'hired', hiredAt: now() }; company.employees.push(employee); event(company, 'npc_employee_hired', { npcId: candidate.id }); await saveDatabase(database); send(response, 200, employee); return
    } else { error(response, 404, 'Company endpoint not found.'); return }
    await saveDatabase(database); send(response, 200, company); return
  }
  const companyMatch = path.match(/^\/api\/companies\/([^/]+)(?:\/(.*))?$/)
  if (companyMatch) {
    const company = ownedCompany(database, player, companyMatch[1]); if (!company) { error(response, 404, 'Company not found.'); return }
    const action = companyMatch[2] ?? ''
    const input = request.method === 'GET' ? {} : await body(request)
    if (request.method === 'GET' && !action) { send(response, 200, company); return }
    if (request.method === 'GET' && action === 'financial-reports') { send(response, 200, { revenue: company.revenue, expenses: company.expenses, balance: company.balance, balanceKobo: company.balanceKobo, revenueKobo: company.revenueKobo, expensesKobo: company.expensesKobo, net: company.revenue - company.expenses, breakEven: breakEven(company), transactions: company.transactions, journal: company.journal }); return }
    const missionMatch = action.match(/^missions\/([^/]+)\/complete$/)
    if (request.method === 'POST' && missionMatch) {
      const missionId = missionMatch[1]; const level = ALL_LEVELS.find((item) => item.missions.some((mission) => mission.id === missionId)) ?? BEGINNER_LEVELS.find((item) => item.missions.some((mission) => mission.id === missionId)); const mission = level?.missions.find((item) => item.id === missionId)
      if (!level || !mission || level.levelNumber !== company.progression.currentLevel) { error(response, 409, 'Mission is not available in the current level.'); return }
      if (!company.progression.completedMissions.includes(missionId)) { company.progression.completedMissions.push(missionId); company.progression.xp += mission.reward.xp; company.progression.reputation += mission.reward.reputation }
      if (level.missions.every((item) => company.progression.completedMissions.includes(item.id)) && level.levelNumber < 75) company.progression.currentLevel = level.levelNumber + 1
      event(company, 'mission_completed', { missionId }); appendAudit(company, 'mission_completed', player.id, { missionId, xp: company.progression.xp }); await saveDatabase(database); send(response, 200, company.progression); return
    }
    if (request.method === 'POST' && action === 'research') { company.research.push({ id: newId('research'), ...input, createdAt: now() }); event(company, 'market_research_completed'); }
    else if (request.method === 'PUT' && action === 'business-plan') { company.businessPlan = { ...input, version: Number(company.businessPlan?.version ?? 0) + 1, updatedAt: now() }; event(company, 'business_plan_saved'); }
    else if (request.method === 'POST' && action === 'registration') { company.registration = { status: 'approved', reference: newId('reg'), submittedAt: now(), ...input }; company.status = 'registered'; event(company, 'company_registered'); }
    else if (request.method === 'GET' && action === 'compliance') { send(response, 200, { requirements: [{ id: 'tax', name: 'Tax registration', status: company.compliance.find((item) => item.id === 'tax')?.status ?? 'required' }, { id: 'sector', name: `${company.sector} operating permit`, status: company.compliance.find((item) => item.id === 'sector')?.status ?? 'required' }] }); return }
    else if (request.method === 'POST' && action === 'compliance/applications') { company.compliance.push({ id: String(input.requirementId ?? 'sector'), status: 'approved', submittedAt: now(), ...input }); event(company, 'compliance_completed'); }
    else if (request.method === 'POST' && action === 'banking/applications') { company.bankApplication = { status: 'approved', accountId: newId('acct'), submittedAt: now(), ...input }; event(company, 'corporate_account_opened'); }
    else if (request.method === 'POST' && action === 'founder-contributions') { const amount = amountKobo(input); transferFromFounder(player, company, amount, player.id, 'Founder contribution', request.headers['idempotency-key']?.toString()); company.balance = company.balanceKobo / 100; event(company, 'founder_contribution_recorded', { amountKobo: amount }); }
    else if (request.method === 'POST' && action === 'job-openings') { required(input, ['name', 'role', 'salaryKobo']); const salaryKobo = Math.round(Number(input.salaryKobo)); if (company.balanceKobo < salaryKobo * 3) { error(response, 409, 'Hiring would leave less than three months of payroll runway.'); return } company.employees.push({ id: newId('emp'), status: 'hired', salaryKobo, hiredAt: now(), ...input }); event(company, 'employee_hired'); appendAudit(company, 'employee_hired', player.id, { salaryKobo, role: String(input.role ?? '') }); }
    else if (request.method === 'PUT' && action === 'brand') { company.brand = { ...input, updatedAt: now() }; event(company, 'brand_profile_saved'); }
    else if (request.method === 'POST' && action === 'meetings') { company.meetings.push({ id: newId('meeting'), heldAt: now(), ...input }); event(company, 'board_meeting_completed'); }
    else if (request.method === 'POST' && action === 'launch') { if (!company.registration || !company.bankApplication) throw new Error('Registration and corporate banking must be complete before launch.'); company.status = 'launched'; event(company, 'business_launched'); }
    else if (request.method === 'POST' && action === 'orders') { required(input, ['customer']); const idempotencyKey = request.headers['idempotency-key']?.toString(); if (idempotencyKey && company.transactions.some((transaction) => transaction.idempotencyKey === idempotencyKey)) { send(response, 200, company); return } const product = input.productId ? company.products.find((item) => item.id === input.productId) : undefined; const quantity = Math.max(1, Math.floor(Number(input.quantity ?? 1))); if (product) { const demand = demandFor(company, product, quantity); consumeStock(company, String(input.productId), demand) } const amountKobo = Math.round(Number(input.amountKobo ?? (product ? Number(product.priceKobo) * quantity : Number(input.amount ?? 0) * 100))); if (amountKobo <= 0) { error(response, 400, 'Order amount must be greater than zero.'); return } ledger(company, 'sale', amountKobo / 100, `Sale to ${input.customer}`, 'customer_order'); company.transactions[0].idempotencyKey = idempotencyKey; company.balance += amountKobo / 100; company.revenue += amountKobo / 100; company.orders.push({ id: newId('order'), status: 'paid', paymentStatus: 'paid', amountKobo, quantity, createdAt: now(), ...input }); event(company, 'sale_processed', { amountKobo, quantity }); appendAudit(company, 'sale_recorded', player.id, { amountKobo, quantity }); }
    else if (request.method === 'POST' && action === 'expenses') { const amount = Number(input.amount); ledger(company, 'expense', amount, String(input.description ?? 'Operating expense'), 'operating_expense'); company.balance -= amount; company.expenses += amount; event(company, 'expense_recorded', { amount }); }
    else { error(response, 404, 'Company endpoint not found.'); return }
    await saveDatabase(database); send(response, 200, company); return
  }
  const fundingMatch = path.match(/^\/api\/funding\/([^/]+)(?:\/([^/]+))?(?:\/response)?$/)
  if (fundingMatch && request.method === 'POST') {
    const input = await body(request); const companyId = String(input.companyId ?? ''); const company = ownedCompany(database, player, companyId); if (!company) { error(response, 404, 'Company not found.'); return }
    const action = fundingMatch[1]
    const idempotencyKey = request.headers['idempotency-key']?.toString()
    if (idempotencyKey && company.transactions.some((transaction) => transaction.idempotencyKey === idempotencyKey)) { send(response, 200, company); return }
    if (action === 'requests') { required(input, ['amount', 'contributor']); const amount = Number(input.amount); company.fundingRequests.push({ id: newId('fund'), status: 'accepted', createdAt: now(), ...input }); ledger(company, 'funding', amount, 'Family and friends contribution', 'funding_request'); company.transactions[0].idempotencyKey = idempotencyKey; company.balance += amount }
    else if (action === 'pitch-decks') { company.pitchDeck = { id: newId('deck'), createdAt: now(), ...input } }
    else if (action === 'applications') { company.investorApplications.push({ id: newId('application'), status: 'under_review', createdAt: now(), ...input }); }
    else if (action === 'offers' && fundingMatch[2]) { const amount = Number(input.amount); company.offers.push({ id: fundingMatch[2], status: 'accepted', createdAt: now(), ...input }); ledger(company, 'investment', amount, 'Pre-seed investment', 'investment_agreement'); company.balance += amount; company.ownership.push({ holder: String(input.investor ?? 'investor'), shares: Number(input.equity ?? 10) }); company.ownership[0].shares -= Number(input.equity ?? 10); appendAudit(company, 'investment_accepted', player.id, { amount, equity: Number(input.equity ?? 10) }) }
    else { error(response, 404, 'Funding endpoint not found.'); return }
    event(company, `funding_${action}_completed`); await saveDatabase(database); send(response, 200, company); return
  }
  const missionMatch = path.match(/^\/api\/companies\/([^/]+)\/missions\/([^/]+)\/complete$/)
  if (missionMatch && request.method === 'POST') {
    const company = ownedCompany(database, player, missionMatch[1]); if (!company) { error(response, 404, 'Company not found.'); return }
    const missionId = missionMatch[2]; const level = ALL_LEVELS.find((item) => item.missions.some((mission) => mission.id === missionId)) ?? BEGINNER_LEVELS.find((item) => item.missions.some((mission) => mission.id === missionId)); const mission = level?.missions.find((item) => item.id === missionId)
    if (!level || !mission || level.levelNumber !== company.progression.currentLevel) { error(response, 409, 'Mission is not available in the current level.'); return }
    if (!company.progression.completedMissions.includes(missionId)) { company.progression.completedMissions.push(missionId); company.progression.xp += mission.reward.xp; company.progression.reputation += mission.reward.reputation }
    const completed = level.missions.every((item) => company.progression.completedMissions.includes(item.id)); if (completed && level.levelNumber < 75) company.progression.currentLevel = level.levelNumber + 1
    event(company, 'mission_completed', { missionId }); appendAudit(company, 'mission_completed', player.id, { missionId, xp: company.progression.xp }); await saveDatabase(database); send(response, 200, company.progression); return
  }
  if (request.method === 'GET' && /^\/api\/companies\/[^/]+\/financial-reports$/.test(path)) { const company = ownedCompany(database, player, path.split('/')[3]); if (!company) { error(response, 404, 'Company not found.'); return } send(response, 200, { revenue: company.revenue, expenses: company.expenses, balance: company.balance, balanceKobo: company.balanceKobo, revenueKobo: company.revenueKobo, expensesKobo: company.expensesKobo, net: company.revenue - company.expenses, breakEven: breakEven(company), transactions: company.transactions, journal: company.journal }); return }
  if (path.startsWith('/api/admin/')) {
    if (request.headers['x-admin-key'] !== (process.env.ADMIN_KEY ?? 'dev-admin')) { error(response, 403, 'Administrator access required.'); return }
    if (request.method === 'GET' && path === '/api/admin/config') { send(response, 200, { stage: stageSummary(), city: database.city }); return }
    if (request.method === 'GET' && path === '/api/admin/activity') { send(response, 200, { events: database.companies.flatMap((company) => company.events.map((item) => ({ companyId: company.id, ...item }))).slice(0, 500) }); return }
    if (request.method === 'POST' && path === '/api/admin/events') { const input = await body(request); database.city.events.unshift({ id: newId('city-event'), createdAt: now(), ...input }); await saveDatabase(database); send(response, 201, database.city.events[0]); return }
    if (request.method === 'PUT' && path === '/api/admin/city') { const input = await body(request); database.city = { ...database.city, ...input }; await saveDatabase(database); send(response, 200, database.city); return }
    error(response, 404, 'Admin endpoint not found.'); return
  }
  error(response, 404, 'Route not found.')
}

const database = await loadDatabase()
database.marketplace = seedMarketplace(database.marketplace)
await saveDatabase(database)
const server = createServer((request, response) => { handle(request, response, database).catch((caught: unknown) => error(response, 400, caught instanceof Error ? caught.message : 'Request failed.')) })
server.listen(port, host, () => console.log(`BUSINESSLIFE API listening on http://${host}:${port}`))
