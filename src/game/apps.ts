export type InGameApp = {
  id: string
  name: string
  category: string
  purpose: string
  panel?: 'market' | 'bank' | 'investors' | 'talent' | 'company' | 'nova'
  accent: string
}

export const IN_GAME_APPS: InGameApp[] = [
  { id: 'tiktak', name: 'TikTak', category: 'Social', purpose: 'Posts, trends and comments', accent: '#ec4899' },
  { id: 'whatsup', name: 'WhatsUp', category: 'Social', purpose: 'Messages, calls and groups', accent: '#16a34a' },
  { id: 'buzzly', name: 'Buzzly', category: 'Social', purpose: 'City news and trends', accent: '#f59e0b' },
  { id: 'linkd', name: 'Linkd', category: 'Social', purpose: 'Professional networking', accent: '#2563eb' },
  { id: 'adz', name: 'Adz', category: 'Social', purpose: 'Promotions and influencers', accent: '#f97316' },
  { id: 'trustbank', name: 'TrustBank', category: 'Finance', purpose: 'Personal and business banking', panel: 'bank', accent: '#0b8550' },
  { id: 'fundly', name: 'Fundly', category: 'Finance', purpose: 'Investment opportunities', panel: 'investors', accent: '#2563eb' },
  { id: 'surecover', name: 'SureCover', category: 'Finance', purpose: 'Insurance', accent: '#7c3aed' },
  { id: 'billup', name: 'BillUp', category: 'Finance', purpose: 'Bills and utilities', accent: '#64748b' },
  { id: 'tradely', name: 'Tradely', category: 'Business', purpose: 'Wholesale and B2B trading', panel: 'market', accent: '#0b8550' },
  { id: 'buynow', name: 'BuyNow', category: 'Business', purpose: 'Everyday shopping', panel: 'market', accent: '#e05a3f' },
  { id: 'dropit', name: 'DropIt', category: 'Business', purpose: 'Dispatch and delivery', accent: '#0891b2' },
  { id: 'jobber', name: 'Jobber', category: 'Business', purpose: 'Recruitment and employment', panel: 'talent', accent: '#7c3aed' },
  { id: 'filebox', name: 'FileBox', category: 'Business', purpose: 'Documents and contracts', panel: 'company', accent: '#475569' },
  { id: 'houseup', name: 'HouseUp', category: 'City', purpose: 'Property and rentals', accent: '#b45309' },
  { id: 'chopnow', name: 'ChopNow', category: 'City', purpose: 'Food ordering', accent: '#dc2626' },
  { id: 'moveit', name: 'MoveIt', category: 'City', purpose: 'Transportation', accent: '#0284c7' },
  { id: 'stayinn', name: 'StayInn', category: 'City', purpose: 'Hotels and stays', accent: '#9333ea' },
  { id: 'carzy', name: 'Carzy', category: 'City', purpose: 'Cars and maintenance', accent: '#334155' },
  { id: 'vibez', name: 'Vibez', category: 'City', purpose: 'Events and networking', accent: '#db2777' },
  { id: 'dayly', name: 'Dayly', category: 'City', purpose: 'Calendar and tasks', panel: 'nova', accent: '#ca8a04' },
  { id: 'skillup', name: 'SkillUp', category: 'City', purpose: 'Learning and education', accent: '#4f46e5' },
  { id: 'fixer', name: 'Fixer', category: 'City', purpose: 'Repairs and services', accent: '#16a34a' },
]
