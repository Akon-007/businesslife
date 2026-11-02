import { newId, now } from './store.js'
import type { MarketplaceBusiness, MarketplaceListing, MarketplaceState } from './types.js'

export function seedMarketplace(state: MarketplaceState): MarketplaceState {
  if (state.businesses.length) return state
  const seeds: Array<[string, string, string, string, string, number, number]> = [
    ['Ade\'s Food Distribution', 'Food & Agriculture', 'market', 'Fresh food and packaged groceries for restaurants and retailers.', 'Rice, 50kg', 8_500_000, 45],
    ['Kora Packaging Works', 'Manufacturing', 'harbour', 'Boxes, food packaging and branded containers.', 'Carton packaging', 1_800_000, 220],
    ['Mosaic Electronics Supply', 'Electronics', 'central', 'Computer accessories, POS equipment and repair parts.', 'POS terminal', 12_500_000, 18],
    ['Palmline Furniture', 'Hospitality', 'central', 'Tables, chairs and fit-outs for hospitality businesses.', 'Commercial table', 7_500_000, 32],
    ['Greenfield Produce Co.', 'Food & Agriculture', 'market', 'Locally sourced tomatoes, vegetables and grains.', 'Tomatoes carton', 2_800_000, 60],
    ['SwiftRoute Logistics', 'Logistics', 'harbour', 'Same-city delivery and scheduled freight services.', 'Delivery service', 750_000, 500],
    ['Brightline Studio', 'Professional Services', 'university', 'Branding, design and launch campaigns for growing businesses.', 'Brand sprint', 15_000_000, 12],
    ['Northgate IT Services', 'Technology', 'central', 'Business software, support and cloud setup.', 'Support retainer', 25_000_000, 20],
  ]
  const businesses: MarketplaceBusiness[] = []
  const listings: MarketplaceListing[] = []
  for (const [name, category, district, description, product, priceKobo, stock] of seeds) {
    const businessId = newId('biz')
    businesses.push({ id: businessId, name, category, district, description, rating: 4.1 + (businessId.charCodeAt(4) % 9) / 10, reliability: 0.68 + (businessId.charCodeAt(5) % 25) / 100, deliveryAvailable: true, paymentTerms: ['upfront', 'pay_on_delivery'], balanceKobo: 0, createdAt: now() })
    listings.push({ id: newId('listing'), businessId, product, description, priceKobo, stock, minimumOrder: category === 'Professional Services' ? 1 : 5, deliveryFeeKobo: category === 'Professional Services' ? 0 : 2_500_000, active: true, updatedAt: now() })
  }
  return { ...state, businesses, listings }
}

export function searchMarketplace(state: MarketplaceState, query: URLSearchParams) {
  const term = (query.get('q') ?? '').toLowerCase()
  const category = query.get('category')?.toLowerCase()
  const district = query.get('district')?.toLowerCase()
  const minPrice = Number(query.get('minPriceKobo') ?? 0)
  const maxPrice = Number(query.get('maxPriceKobo') ?? Number.MAX_SAFE_INTEGER)
  const delivery = query.get('delivery')
  return state.listings.filter((listing) => {
    const business = state.businesses.find((item) => item.id === listing.businessId)
    if (!business || !listing.active || listing.stock <= 0) return false
    const haystack = `${business.name} ${business.category} ${business.description} ${listing.product}`.toLowerCase()
    return (!term || haystack.includes(term)) && (!category || business.category.toLowerCase() === category) && (!district || business.district.toLowerCase() === district) && listing.priceKobo >= minPrice && listing.priceKobo <= maxPrice && (!delivery || delivery !== 'true' || business.deliveryAvailable)
  }).map((listing) => ({ ...listing, business: state.businesses.find((item) => item.id === listing.businessId) }))
}
