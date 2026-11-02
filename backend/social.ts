import { newId, now } from './store.js'
import type { BusinessNotification, Company, Conversation, Message, Npc, ReputationIncident, ReputationProfile, SocialComment, SocialPost } from './types.js'

export function ensureCommunications(company: Company) {
  company.socialPosts ??= []
  company.socialComments ??= []
  company.reputationIncidents ??= []
  company.conversations ??= []
  company.messages ??= []
  company.notifications ??= []
  company.reputationProfile ??= { customerTrust: 50, productQuality: 50, deliveryReliability: 50, paymentReliability: 50, employeeReputation: 50, publicSentiment: 50, businessCredibility: 50 }
}

export function reputation(company: Company): ReputationProfile {
  ensureCommunications(company)
  return company.reputationProfile
}

export function notification(company: Company, input: Omit<BusinessNotification, 'id' | 'companyId' | 'createdAt' | 'read'>) {
  ensureCommunications(company)
  const item: BusinessNotification = { id: newId('note'), companyId: company.id, createdAt: now(), read: false, ...input }
  company.notifications.unshift(item as unknown as Record<string, unknown>)
  return item
}

function sentiment(content: string): SocialPost['sentiment'] {
  const lower = content.toLowerCase()
  if (/(scam|stole|late|damaged|terrible|refused|fraud|never arrived)/.test(lower)) return 'negative'
  if (/(thank|love|great|excellent|recommend|well done)/.test(lower)) return 'positive'
  return 'neutral'
}

export function createPost(company: Company, input: Record<string, unknown>, authorId: string, authorName: string) {
  ensureCommunications(company)
  const content = String(input.content ?? '').trim()
  if (!content) throw new Error('Post content is required.')
  const post: SocialPost = { id: newId('post'), companyId: company.id, authorId, authorName, platform: String(input.platform ?? 'Buzzly'), content, kind: (input.kind as SocialPost['kind']) ?? 'announcement', sentiment: sentiment(content), visibility: 'visible', views: 0, comments: 0, shares: 0, ...(input.rating ? { rating: Number(input.rating) } : {}), ...(input.relatedOrderId ? { relatedOrderId: String(input.relatedOrderId) } : {}), createdAt: now() }
  company.socialPosts.unshift(post)
  return post
}

export function createComment(company: Company, post: SocialPost, input: Record<string, unknown>, authorId: string, authorName: string) {
  ensureCommunications(company)
  const content = String(input.content ?? '').trim()
  if (!content) throw new Error('Comment content is required.')
  const comment: SocialComment = { id: newId('comment'), postId: post.id, companyId: company.id, authorId, authorName, content, createdAt: now() }
  company.socialComments.unshift(comment)
  post.comments += 1
  return comment
}

export function createIncident(company: Company, post: SocialPost, input: Record<string, unknown>) {
  ensureCommunications(company)
  const incident: ReputationIncident = { id: newId('incident'), companyId: company.id, postId: post.id, type: (input.type as ReputationIncident['type']) ?? 'genuine_complaint', status: 'open', allegation: post.content, evidence: [], responses: [], moderation: null, createdAt: now(), updatedAt: now() }
  company.reputationIncidents.unshift(incident)
  post.allegation = post.content
  return incident
}

export function applyIncidentOutcome(company: Company, incident: ReputationIncident, resolved: boolean) {
  const profile = reputation(company)
  const delta = resolved ? 2 : -2
  profile.publicSentiment = Math.max(0, Math.min(100, profile.publicSentiment + delta))
  if (incident.type === 'genuine_complaint') profile.customerTrust = Math.max(0, Math.min(100, profile.customerTrust + delta))
  if (incident.type === 'product_criticism') profile.productQuality = Math.max(0, Math.min(100, profile.productQuality + delta))
  company.progression.reputation = Math.round(Object.values(profile).reduce((sum, value) => sum + value, 0) / 7 - 50)
}

export function generateNpcActivity(company: Company, customers: Npc[], day: number) {
  ensureCommunications(company)
  if (customers.length === 0 || day <= 1 || (day - 1) % 7 !== 0) return null
  const customer = customers[day % customers.length]
  const hasOrders = company.orders.length > 0
  const content = hasOrders
    ? `I recently used ${company.name}. The experience was okay, but I would like clearer delivery updates.`
    : `Has anyone tried ${company.name}? I am interested, but I would like to hear from existing customers.`
  const post = createPost(company, { content, platform: 'Buzzly', kind: hasOrders ? 'review' : 'discussion' }, customer.id, customer.name)
  post.views = 10 + (day % 31)
  if (hasOrders) {
    const incident = createIncident(company, post, { type: 'product_criticism' })
    notification(company, { category: 'social_media', priority: 'attention', title: 'A customer mentioned your business', message: `${customer.name} posted feedback about ${company.name}.`, relatedType: 'reputation_incident', relatedId: incident.id, action: 'view_incident' })
    const conversation = openConversation(company, { participantId: customer.id, participantName: customer.name, category: 'social', relatedRecordId: incident.id })
    addMessage(company, conversation, { content: 'I saw your post and would like to understand what happened.' }, 'inbound', customer.id, customer.name)
    return { post, incident }
  }
  notification(company, { category: 'social_media', priority: 'informational', title: 'A customer discovered your business', message: `${customer.name} is asking about ${company.name}.`, relatedType: 'social_post', relatedId: post.id, action: 'view_post' })
  return { post }
}

export function openConversation(company: Company, input: Record<string, unknown>) {
  ensureCommunications(company)
  const participantId = String(input.participantId ?? 'customer')
  const conversation: Conversation = { id: newId('conversation'), companyId: company.id, participantId, participantName: String(input.participantName ?? 'Business contact'), category: (input.category as Conversation['category']) ?? 'customers', channel: (input.channel as Conversation['channel']) ?? 'in_app', ...(input.relatedRecordId ? { relatedRecordId: String(input.relatedRecordId) } : {}), unread: false, createdAt: now(), updatedAt: now() }
  company.conversations.unshift(conversation)
  return conversation
}

export function addMessage(company: Company, conversation: Conversation, input: Record<string, unknown>, direction: Message['direction'], senderId: string, senderName: string) {
  ensureCommunications(company)
  const content = String(input.content ?? '').trim()
  if (!content) throw new Error('Message content is required.')
  const message: Message = { id: newId('message'), conversationId: conversation.id, companyId: company.id, senderId, senderName, direction, content, read: direction === 'outbound', ...(input.action ? { action: String(input.action) } : {}), createdAt: now() }
  company.messages.unshift(message)
  conversation.unread = direction === 'inbound'
  conversation.updatedAt = now()
  return message
}
