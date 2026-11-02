export type Id = string

export interface Player {
  id: Id
  name: string
  createdAt: string
  wallet: number
  progression: { xp: number; reputation: number }
}

export interface Session {
  token: string
  playerId: Id
  expiresAt: string
}

export interface JournalEntry {
  id: Id
  account: string
  debit: number
  credit: number
  source: string
  createdAt: string
  currency: 'NGN'
  amountKobo: number
}

export interface Transaction {
  id: Id
  type: 'funding' | 'sale' | 'expense' | 'loan' | 'investment'
  amount: number
  description: string
  source: string
  createdAt: string
  currency: 'NGN'
  amountKobo: number
  sourceAccount: string
  destinationAccount?: string
  category: string
  status: 'posted' | 'reversed'
  createdBy: string
  relatedObject?: string
  idempotencyKey?: string
}

export type NotificationPriority = 'informational' | 'attention' | 'important' | 'critical'

export interface SocialPost {
  id: Id
  companyId: Id
  authorId: string
  authorName: string
  platform: string
  content: string
  kind: 'announcement' | 'complaint' | 'review' | 'discussion' | 'promotion'
  sentiment: 'positive' | 'neutral' | 'negative'
  visibility: 'visible' | 'limited' | 'removed'
  views: number
  comments: number
  shares: number
  rating?: number
  allegation?: string
  relatedOrderId?: string
  createdAt: string
}

export interface SocialComment {
  id: Id
  postId: Id
  companyId: Id
  authorId: string
  authorName: string
  content: string
  createdAt: string
}

export interface ReputationIncident {
  id: Id
  companyId: Id
  postId: Id
  type: 'genuine_complaint' | 'product_criticism' | 'misunderstanding' | 'false_accusation' | 'competitor_attack' | 'employee_complaint' | 'harassment' | 'impersonation'
  status: 'open' | 'investigating' | 'resolved' | 'unsubstantiated'
  allegation: string
  evidence: Array<Record<string, unknown>>
  responses: Array<Record<string, unknown>>
  moderation: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface Conversation {
  id: Id
  companyId: Id
  participantId: string
  participantName: string
  category: 'customers' | 'suppliers' | 'employees' | 'delivery' | 'investors' | 'banks' | 'government' | 'social'
  channel: 'in_app' | 'sms' | 'email' | 'phone'
  relatedRecordId?: string
  unread: boolean
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: Id
  conversationId: Id
  companyId: Id
  senderId: string
  senderName: string
  direction: 'inbound' | 'outbound'
  content: string
  read: boolean
  action?: string
  createdAt: string
}

export interface BusinessNotification {
  id: Id
  companyId: Id
  category: string
  priority: NotificationPriority
  title: string
  message: string
  read: boolean
  relatedType?: string
  relatedId?: string
  action?: string
  expiresAt?: string
  createdAt: string
}

export interface ReputationProfile {
  customerTrust: number
  productQuality: number
  deliveryReliability: number
  paymentReliability: number
  employeeReputation: number
  publicSentiment: number
  businessCredibility: number
}

export interface Company {
  id: Id
  playerId: Id
  name: string
  sector: string
  businessModel: string
  problem: string
  solution: string
  ambition: string
  status: 'draft' | 'registered' | 'operating' | 'launched'
  createdAt: string
  updatedAt: string
  balance: number
  revenue: number
  expenses: number
  balanceKobo: number
  revenueKobo: number
  expensesKobo: number
  ownership: Array<{ holder: string; shares: number }>
  research: Array<Record<string, unknown>>
  businessPlan: Record<string, unknown> | null
  registration: Record<string, unknown> | null
  compliance: Array<Record<string, unknown>>
  bankApplication: Record<string, unknown> | null
  employees: Array<Record<string, unknown>>
  fundingRequests: Array<Record<string, unknown>>
  pitchDeck: Record<string, unknown> | null
  investorApplications: Array<Record<string, unknown>>
  offers: Array<Record<string, unknown>>
  brand: Record<string, unknown> | null
  products: Array<Record<string, unknown>>
  suppliers: Array<Record<string, unknown>>
  campaigns: Array<Record<string, unknown>>
  meetings: Array<Record<string, unknown>>
  orders: Array<Record<string, unknown>>
  transactions: Transaction[]
  journal: JournalEntry[]
  events: Array<Record<string, unknown>>
  progression: {
    xp: number
    reputation: number
    currentLevel: number
    completedMissions: string[]
  }
  simulation: { day: number; lastAdvancedAt: string; processedSchedules: string[] }
  notifications: Array<Record<string, unknown>>
  popups: Array<Record<string, unknown>>
  socialPosts: SocialPost[]
  socialComments: SocialComment[]
  reputationIncidents: ReputationIncident[]
  conversations: Conversation[]
  messages: Message[]
  reputationProfile: ReputationProfile
}

export interface CityState {
  districts: Array<Record<string, unknown>>
  properties: Array<Record<string, unknown>>
  businesses: Array<Record<string, unknown>>
  events: Array<Record<string, unknown>>
}

export interface ClassRoom {
  id: Id
  lecturerId: Id
  name: string
  studentIds: Id[]
  scenario: Record<string, unknown> | null
  createdAt: string
}

export type NpcType = 'employee' | 'customer' | 'supplier' | 'investor'

export interface Npc {
  id: Id
  companyId: Id
  type: NpcType
  name: string
  profile: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface MarketplaceBusiness {
  id: Id
  ownerCompanyId?: Id
  name: string
  category: string
  district: string
  description: string
  rating: number
  reliability: number
  deliveryAvailable: boolean
  paymentTerms: string[]
  balanceKobo: number
  createdAt: string
}

export interface MarketplaceListing {
  id: Id
  businessId: Id
  product: string
  description: string
  priceKobo: number
  stock: number
  minimumOrder: number
  deliveryFeeKobo: number
  active: boolean
  updatedAt: string
}

export interface MarketplaceState {
  businesses: MarketplaceBusiness[]
  listings: MarketplaceListing[]
  follows: Array<{ playerId: Id; businessId: Id; createdAt: string }>
  messages: Array<Record<string, unknown>>
  enquiries: Array<Record<string, unknown>>
  quotations: Array<Record<string, unknown>>
  orders: Array<Record<string, unknown>>
}

export interface Database {
  players: Player[]
  sessions: Session[]
  companies: Company[]
  city: CityState
  classes: ClassRoom[]
  idempotency: Array<{ key: string; playerId: string; response: unknown; createdAt: string }>
  npcs: Npc[]
  marketplace: MarketplaceState
}
