import { ApifyClient } from 'apify-client'
import { upsertLeads } from '../lib/supabase.js'

const client = new ApifyClient({ token: process.env.APIFY_TOKEN })

// Rotate categories per run to avoid always finding the same businesses
const ALL_CATEGORIES = [
  'restaurants', 'law firms', 'dental clinics', 'gyms', 'beauty salons',
  'hotels', 'chartered accountants', 'architects', 'interior designers',
  'real estate agents', 'travel agencies', 'event planners',
  'photography studios', 'coaching centers', 'physiotherapy clinics',
  'veterinary clinics', 'car dealers', 'jewellery stores', 'diagnostic labs',
  'software companies', 'marketing agencies', 'wedding planners'
]

function pickCategories(n = 4) {
  const shuffled = [...ALL_CATEGORIES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

export async function runDiscovery() {
  console.log('[Discovery] Starting...')
  const categories = pickCategories(4)
  const searchStrings = categories.map(c => `${c} in Hyderabad`)
  console.log('[Discovery] Searching:', searchStrings)

  // compass/crawler-google-places input schema
  const run = await client.actor('compass/crawler-google-places').call({
    searchStringsArray: searchStrings,
    maxCrawledPlacesPerSearch: 20,
    language: 'en',
    countryCode: 'in',
    maxImages: 0,
    maxReviews: 0,
    exportPlaceUrls: false
  })

  const { items } = await client.dataset(run.defaultDatasetId).listItems()
  console.log(`[Discovery] Found ${items.length} businesses from Apify`)

  // compass/crawler-google-places output field mapping
  const leads = items
    .filter(item => item.placeId || item.id)
    .map(item => ({
      place_id: item.placeId || item.id,
      name: item.title || item.name,
      address: item.address || item.street,
      phone: item.phone || item.phoneUnformatted,
      website: item.website || item.url2 || null,
      category: item.categoryName || item.categories?.[0] || item.category,
      rating: item.totalScore || item.stars || item.rating,
      maps_url: item.url,
      has_website: !!(item.website || item.url2),
      city: 'Hyderabad'
    }))

  const inserted = await upsertLeads(leads)
  console.log(`[Discovery] Upserted ${leads.length} leads (${inserted?.length ?? 0} new)`)
  return leads.length
}
