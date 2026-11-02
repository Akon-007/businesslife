import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { BEGINNER_LEVELS, stageSummary } from './stage.js'
import { ALL_LEVELS, allStageSummaries } from './stages.js'
import { loadDatabase, newId, now, saveDatabase } from './store.js'
import { amountKobo, breakEven, transferFromFounder } from './finance.js'
import { evaluateAction, forecast } from './simulation.js'
import { consumeStock, demandFor, operationsOverview } from './operations.js'
import { evaluateInvestor, interviewCustomer, seedCompanyNpcs, selectSupplier as selectNpcSupplier } from './npcs.js'
import { searchMarketplace, seedMarketplace } from './marketplace.js'
import { IN_GAME_APPS } from './apps.js'
import { addMessage, applyIncidentOutcome, createComment, createIncident, createPost, ensureCommunications, generateNpcActivity, notification, openConversation, reputation } from './social.js'
import type { Company, Database, Player } from './types.js'

const port = Number(process.env.PORT ?? 8787)
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
  const session = database.sessions.find((item) => item.token === token && item.expiresAt > now())
  return session ? database.players.find((player) => player.id === session.playerId) ?? null : null
}

function ownedCompany(database: Database, player: Player, id: string) {
  return database.companies.find((company) => company.id === id && company.playerId === player.id) ?? null
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

function ledger(company: Company, type: Company['transactions'][number]['type'], amount: number, description: string, source: string) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero.')
  const amountKobo = Math.round(amount * 100)
  company.transactions.unshift({ id: newId('txn'), type, amount, amountKobo, currency: 'NGN', description, source, sourceAccount: source, destinationAccount: 'company:cash', category: type, status: 'posted', createdBy: company.playerId, createdAt: now() })
  company.journal.push({ id: newId('jrn'), account: 'cash', debit: amountKobo, credit: 0, source, currency: 'NGN', amountKobo, createdAt: now() })
  company.journal.push({ id: newId('jrn'), account: type, debit: 0, credit: amountKobo, source, currency: 'NGN', amountKobo, createdAt: now() })
}

function createCompany(playerId: string, input: Record<string, unknown>): Company {
  required(input, ['name', 'sector', 'problem', 'solution', 'businessModel', 'ambition'])
  const timestamp = now()
  return {
    id: newId('co'), playerId, name: String(input.name).trim(), sector: String(input.sector), businessModel: String(input.businessModel), problem: String(input.problem), solution: String(input.solution), ambition: String(input.ambition), status: 'draft', createdAt: timestamp, updatedAt: timestamp, revenue: 0, expenses: 0,
    ownership: [{ holder: 'founder', shares: 100 }], research: [], businessPlan: null, registration: null, compliance: [], bankApplication: null, employees: [], fundingRequests: [], pitchDeck: null, investorApplications: [], offers: [], brand: null, products: [], suppliers: [], campaigns: [], meetings: [], orders: [], transactions: [], journal: [], events: [], progression: { xp: 0, reputation: 0, currentLevel: 1, completedMissions: [] }, balanceKobo: Math.round(Number(input.initialCapitalKobo ?? 0)), revenueKobo: 0, expensesKobo: 0, balance: Math.round(Number(input.initialCapitalKobo ?? 0)) / 100, simulation: { day: 1, lastAdvancedAt: timestamp, processedSchedules: [] }, notifications: [], popups: [], socialPosts: [], socialComments: [], reputationIncidents: [], conversations: [], messages: [], reputationProfile: { customerTrust: 50, productQuality: 50, deliveryReliability: 50, paymentReliability: 50, employeeReputation: 50, publicSentiment: 50, businessCredibility: 50 },
  }
}

async function handle(request: IncomingMessage, response: ServerResponse, database: Database) {
  if (request.method === 'OPTIONS') { response.writeHead(204, jsonHeaders); response.end(); return }
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  const path = url.pathname.replace(/\/$/, '')
  if (request.method === 'GET' && (path === '/health' || path === '/api/health')) { send(response, 200, { ok: true, service: 'businesslife-api', time: now() }); return }
  if (request.method === 'GET' && path === '/api/stages') { send(response, 200, { stages: allStageSummaries(stageSummary()) }); return }
  if (request.method === 'GET' && path === '/api/stages/beginner') { send(response, 200, stageSummary()); return }
  if (request.method === 'GET' && path === '/api/apps') { send(response, 200, { apps: IN_GAME_APPS, fictionalBrands: true, disclaimer: 'These are fictional simulator brands.' }); return }
  if (request.method === 'GET' && path === '/api/city') { send(response, 200, database.city); return }
  if (request.method === 'GET' && path === '/api/marketplace') { send(response, 200, { listings: searchMarketplace(database.marketplace, url.searchParams), categories: [...new Set(database.marketplace.businesses.map((business) => business.category))], districts: [...new Set(database.marketplace.businesses.map((business) => business.district))] }); return }
  const marketplaceBusinessMatch = path.match(/^\/api\/marketplace\/businesses\/([^/]+)$/)
  if (request.method === 'GET' && marketplaceBusinessMatch) { const business = database.marketplace.businesses.find((item) => item.id === marketplaceBusinessMatch[1]); if (!business) { error(response, 404, 'Business not found.'); return } send(response, 200, { business, listings: database.marketplace.listings.filter((listing) => listing.businessId === business.id) }); return }
  if (request.method === 'POST' && path === '/api/auth/dev-login') {
    const input = await body(request); const player: Player = { id: newId('plr'), name: String(input.name ?? 'Founder'), createdAt: now(), wallet: 25_000_000, progression: { xp: 0, reputation: 0 } }; database.players.push(player)
    const token = newId('session'); database.sessions.push({ token, playerId: player.id, expiresAt: new Date(Date.now() + 86_400_000).toISOString() }); await saveDatabase(database); send(response, 201, { player, token }); return
  }
  const player = auth(request, database)
  if (!player) { error(response, 401, 'Authentication required. Use POST /api/auth/dev-login for a local session.'); return }
  if (request.method === 'GET' && path === '/api/me') { send(response, 200, player); return }
  if (path === '/api/classes' && request.method === 'POST') {
    const input = await body(request); required(input, ['name']); const classroom = { id: newId('class'), lecturerId: player.id, name: String(input.name), studentIds: [], scenario: null, createdAt: now() }; database.classes.push(classroom); await saveDatabase(database); send(response, 201, classroom); return
  }
  const classMatch = path.match(/^\/api\/classes\/([^/]+)(?:\/(.*))?$/)
  if (classMatch) {
    const classroom = database.classes.find((item) => item.id === classMatch[1] && item.lecturerId === player.id); if (!classroom) { error(response, 404, 'Class not found.'); return }
    const action = classMatch[2] ?? ''
    if (request.method === 'GET' && !action) { send(response, 200, classroom); return }
    if (request.method === 'POST' && action === 'invite') { const input = await body(request); required(input, ['studentId']); if (!classroom.studentIds.includes(String(input.studentId))) classroom.studentIds.push(String(input.studentId)); }
    else if (request.method === 'POST' && action === 'scenario') { classroom.scenario = await body(request) }
    else { error(response, 404, 'Class endpoint not found.'); return }
    await saveDatabase(database); send(response, 200, classroom); return
  }
  if (request.method === 'GET' && path === '/api/companies') { send(response, 200, { companies: database.companies.filter((company) => company.playerId === player.id) }); return }
  if (request.method === 'POST' && path === '/api/companies') { const company = createCompany(player.id, await body(request)); database.companies.push(company); database.npcs.push(...seedCompanyNpcs(company.id, company.sector)); await saveDatabase(database); send(response, 201, company); return }
  const stage2CompanyMatch = path.match(/^\/api\/companies\/([^/]+)\/stage-02\/(report|enter)$/)
  if (stage2CompanyMatch) {
    const company = ownedCompany(database, player, stage2CompanyMatch[1]); if (!company) { error(response, 404, 'Company not found.'); return }
    const report = { revenueKobo: company.revenueKobo, expensesKobo: company.expensesKobo, profitLossKobo: company.revenueKobo - company.expensesKobo, cashAvailableKobo: company.balanceKobo, customers: company.orders.length, repeatCustomers: new Set(company.orders.map((order) => String(order.customer ?? ''))).size, orders: { completed: company.orders.filter((order) => order.status === 'paid' || order.status === 'completed').length, pending: company.orders.filter((order) => order.status === 'pending' || order.status === 'awaiting_delivery').length, failed: company.orders.filter((order) => order.status === 'failed').length }, inventory: { units: company.products.reduce((sum, product) => sum + Number(product.stock ?? 0), 0), lowStockItems: company.products.filter((product) => Number(product.stock ?? 0) < 5).map((product) => product.name) }, employees: { count: company.employees.length, monthlyPayrollKobo: company.employees.reduce((sum, employee) => sum + Number(employee.salaryKobo ?? 0), 0) }, suppliers: company.suppliers.length, reputation: company.progression.reputation, outstandingPaymentsKobo: 0, generatedAt: now() }
    if (stage2CompanyMatch[2] === 'report') { send(response, 200, report); return }
    if (company.status === 'draft') { error(response, 409, 'A company must be established before entering Early Growth.'); return }
    company.progression.currentLevel = Math.max(16, company.progression.currentLevel); company.notifications.unshift({ id: newId('note'), type: 'stage_02_entry', priority: 'high', report, createdAt: now() }); event(company, 'stage_02_entered', { report }); await saveDatabase(database); send(response, 200, { stageId: 'stage-2', currentLevel: company.progression.currentLevel, report }); return
  }
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
  const specialCompany = path.match(/^\/api\/companies\/([^/]+)\/(time\/advance|popups|notifications|forecast|evaluate-action|operations\/overview|products|suppliers|procurement|marketing\/campaigns|finance\/loan|finance\/repay|budget|supplier-selection|sales\/pipeline|branches|npcs|npcs\/interview|npcs\/evaluate-investor|npcs\/select-supplier|npcs\/recruit)$/)
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
      const input = await body(request); const amountKobo = amountKoboFrom(input); ledger(company, 'loan', amountKobo / 100, 'Company loan', 'company_loan'); company.balance += amountKobo / 100; event(company, 'loan_received', { amountKobo })
    } else if (request.method === 'POST' && action === 'finance/repay') {
      const input = await body(request); const amount = amountKoboFrom(input); if (company.balanceKobo < amount) { error(response, 409, 'Company cash cannot cover this repayment.'); return } company.balanceKobo -= amount; company.balance = company.balanceKobo / 100; ledger(company, 'expense', amount / 100, 'Debt repayment', 'debt_repayment'); event(company, 'debt_repaid', { amountKobo: amount })
    } else if (request.method === 'POST' && action === 'budget') {
      const input = await body(request); company.events.unshift({ id: newId('evt'), type: 'budget_updated', createdAt: now(), ...input });
    } else if (request.method === 'POST' && action === 'supplier-selection') {
      const input = await body(request); company.events.unshift({ id: newId('evt'), type: 'supplier_selected', createdAt: now(), ...input });
    } else if (request.method === 'POST' && action === 'sales/pipeline') {
      const input = await body(request); company.events.unshift({ id: newId('evt'), type: 'pipeline_updated', createdAt: now(), ...input });
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
      event(company, 'mission_completed', { missionId }); await saveDatabase(database); send(response, 200, company.progression); return
    }
    if (request.method === 'POST' && action === 'research') { company.research.push({ id: newId('research'), ...input, createdAt: now() }); event(company, 'market_research_completed'); }
    else if (request.method === 'PUT' && action === 'business-plan') { company.businessPlan = { ...input, version: Number(company.businessPlan?.version ?? 0) + 1, updatedAt: now() }; event(company, 'business_plan_saved'); }
    else if (request.method === 'POST' && action === 'registration') { company.registration = { status: 'approved', reference: newId('reg'), submittedAt: now(), ...input }; company.status = 'registered'; event(company, 'company_registered'); }
    else if (request.method === 'GET' && action === 'compliance') { send(response, 200, { requirements: [{ id: 'tax', name: 'Tax registration', status: company.compliance.find((item) => item.id === 'tax')?.status ?? 'required' }, { id: 'sector', name: `${company.sector} operating permit`, status: company.compliance.find((item) => item.id === 'sector')?.status ?? 'required' }] }); return }
    else if (request.method === 'POST' && action === 'compliance/applications') { company.compliance.push({ id: String(input.requirementId ?? 'sector'), status: 'approved', submittedAt: now(), ...input }); event(company, 'compliance_completed'); }
    else if (request.method === 'POST' && action === 'banking/applications') { company.bankApplication = { status: 'approved', accountId: newId('acct'), submittedAt: now(), ...input }; event(company, 'corporate_account_opened'); }
    else if (request.method === 'POST' && action === 'founder-contributions') { const amount = amountKobo(input); transferFromFounder(player, company, amount, player.id, 'Founder contribution', request.headers['idempotency-key']?.toString()); company.balance = company.balanceKobo / 100; event(company, 'founder_contribution_recorded', { amountKobo: amount }); }
    else if (request.method === 'POST' && action === 'job-openings') { required(input, ['name', 'role', 'salaryKobo']); const salaryKobo = Math.round(Number(input.salaryKobo)); if (company.balanceKobo < salaryKobo * 3) { error(response, 409, 'Hiring would leave less than three months of payroll runway.'); return } company.employees.push({ id: newId('emp'), status: 'hired', salaryKobo, hiredAt: now(), ...input }); event(company, 'employee_hired'); }
    else if (request.method === 'PUT' && action === 'brand') { company.brand = { ...input, updatedAt: now() }; event(company, 'brand_profile_saved'); }
    else if (request.method === 'POST' && action === 'meetings') { company.meetings.push({ id: newId('meeting'), heldAt: now(), ...input }); event(company, 'board_meeting_completed'); }
    else if (request.method === 'POST' && action === 'launch') { if (!company.registration || !company.bankApplication) throw new Error('Registration and corporate banking must be complete before launch.'); company.status = 'launched'; event(company, 'business_launched'); }
    else if (request.method === 'POST' && action === 'orders') { required(input, ['customer']); const idempotencyKey = request.headers['idempotency-key']?.toString(); if (idempotencyKey && company.transactions.some((transaction) => transaction.idempotencyKey === idempotencyKey)) { send(response, 200, company); return } const product = input.productId ? company.products.find((item) => item.id === input.productId) : undefined; const quantity = Math.max(1, Math.floor(Number(input.quantity ?? 1))); if (product) { const demand = demandFor(company, product, quantity); consumeStock(company, String(input.productId), demand) } const amountKobo = Math.round(Number(input.amountKobo ?? (product ? Number(product.priceKobo) * quantity : Number(input.amount ?? 0) * 100))); if (amountKobo <= 0) { error(response, 400, 'Order amount must be greater than zero.'); return } ledger(company, 'sale', amountKobo / 100, `Sale to ${input.customer}`, 'customer_order'); company.transactions[0].idempotencyKey = idempotencyKey; company.balance += amountKobo / 100; company.revenue += amountKobo / 100; company.orders.push({ id: newId('order'), status: 'paid', paymentStatus: 'paid', amountKobo, quantity, createdAt: now(), ...input }); event(company, 'sale_processed', { amountKobo, quantity }); }
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
    else if (action === 'offers' && fundingMatch[2]) { const amount = Number(input.amount); company.offers.push({ id: fundingMatch[2], status: 'accepted', createdAt: now(), ...input }); ledger(company, 'investment', amount, 'Pre-seed investment', 'investment_agreement'); company.balance += amount; company.ownership.push({ holder: String(input.investor ?? 'investor'), shares: Number(input.equity ?? 10) }); company.ownership[0].shares -= Number(input.equity ?? 10) }
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
    event(company, 'mission_completed', { missionId }); await saveDatabase(database); send(response, 200, company.progression); return
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
server.listen(port, '127.0.0.1', () => console.log(`BUSINESSLIFE API listening on http://127.0.0.1:${port}`))
