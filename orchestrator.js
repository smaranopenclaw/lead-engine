import { runDiscovery } from './agents/discovery.js'
import { runScorer } from './agents/scorer.js'
import { runSiteBuilder } from './agents/siteBuilder.js'
import { runEmailDrafter } from './agents/emailDrafter.js'

const REQUIRED_ENV = [
  'APIFY_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY',
  'VERCEL_TOKEN', 'ANTHROPIC_API_KEY'
]

function checkEnv() {
  const missing = REQUIRED_ENV.filter(k => !process.env[k])
  if (missing.length) {
    console.error('Missing required env vars:', missing.join(', '))
    process.exit(1)
  }
}

async function main() {
  checkEnv()
  console.log(`\n=== Lead Engine run started at ${new Date().toISOString()} ===\n`)

  try { await runDiscovery() } catch (e) { console.error('[Orchestrator] Discovery failed:', e.message) }
  try { await runScorer() }    catch (e) { console.error('[Orchestrator] Scorer failed:', e.message) }
  try { await runSiteBuilder() } catch (e) { console.error('[Orchestrator] SiteBuilder failed:', e.message) }
  try { await runEmailDrafter() } catch (e) { console.error('[Orchestrator] EmailDrafter failed:', e.message) }

  console.log(`\n=== Run complete at ${new Date().toISOString()} ===\n`)
}

main()
