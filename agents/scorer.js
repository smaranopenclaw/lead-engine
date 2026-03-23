import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { getUnscoredLeads, updateLead } from '../lib/supabase.js'

// How much each category needs a website (lower = more urgent need for web presence)
const CATEGORY_SCORES = {
  'law firm': 15,
  'lawyer': 15,
  'advocate': 15,
  'chartered accountant': 20,
  'accountant': 20,
  'architect': 25,
  'interior designer': 25,
  'marketing agency': 20,
  'software company': 15,
  'consultant': 25,
  'coaching center': 30,
  'physiotherapy': 30,
  'clinic': 30,
  'doctor': 30,
  'hospital': 25,
  'diagnostic': 28,
  'veterinary': 35,
  'event planner': 30,
  'wedding planner': 25,
  'travel agency': 30,
  'hotel': 25,
  'real estate': 20,
  'photography': 30,
  'beauty salon': 40,
  'spa': 40,
  'gym': 40,
  'fitness': 40,
  'jewellery': 35,
  'car dealer': 30,
  'restaurant': 55,
  'cafe': 55,
  'food': 60,
  'grocery': 65,
  'default': 45
}

function getCategoryScore(category) {
  if (!category) return CATEGORY_SCORES.default
  const cat = category.toLowerCase()
  for (const [key, score] of Object.entries(CATEGORY_SCORES)) {
    if (cat.includes(key)) return score
  }
  return CATEGORY_SCORES.default
}

async function runLighthouse(url, port) {
  try {
    const result = await lighthouse(url, {
      port,
      output: 'json',
      onlyCategories: ['performance', 'seo', 'accessibility', 'best-practices'],
      logLevel: 'error'
    })
    const cats = result.lhr.categories
    const scores = {
      performance: Math.round((cats.performance?.score ?? 0) * 100),
      seo: Math.round((cats.seo?.score ?? 0) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      best_practices: Math.round((cats['best-practices']?.score ?? 0) * 100)
    }
    const avg = Math.round(
      (scores.performance + scores.seo + scores.accessibility + scores.best_practices) / 4
    )
    return { score: avg, lighthouse_data: scores }
  } catch (err) {
    console.warn(`[Scorer] Lighthouse failed for ${url}:`, err.message)
    return null
  }
}

const BATCH_SIZE = 30 // max leads per run to stay within timeout

export async function runScorer() {
  console.log('[Scorer] Starting...')
  const leads = await getUnscoredLeads(BATCH_SIZE)
  console.log(`[Scorer] ${leads.length} unscored leads (batch of ${BATCH_SIZE})`)

  // Score no-website leads instantly (no Chrome needed)
  const noSiteLeads = leads.filter(l => !l.has_website || !l.website)
  for (const lead of noSiteLeads) {
    const score = getCategoryScore(lead.category)
    await updateLead(lead.id, { score })
    console.log(`[Scorer] ${lead.name} (no site): ${score}/100`)
  }

  // Score website leads with a single shared Chrome instance
  const siteLeads = leads.filter(l => l.has_website && l.website)
  if (siteLeads.length === 0) { console.log('[Scorer] Done'); return }

  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  })
  try {
    for (const lead of siteLeads) {
      console.log(`[Scorer] Lighthouse → ${lead.website}`)
      const result = await runLighthouse(lead.website, chrome.port)
      if (result) {
        await updateLead(lead.id, result)
        console.log(`[Scorer] ${lead.name}: ${result.score}/100`)
      } else {
        await updateLead(lead.id, { score: 20, lighthouse_data: { error: 'audit_failed' } })
      }
    }
  } finally {
    await chrome.kill()
  }

  console.log('[Scorer] Done')
}
