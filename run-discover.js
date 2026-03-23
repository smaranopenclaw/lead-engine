import { runDiscovery } from './agents/discovery.js'
import { runScorer } from './agents/scorer.js'

const REQUIRED = ['APIFY_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
const missing = REQUIRED.filter(k => !process.env[k])
if (missing.length) { console.error('Missing:', missing.join(', ')); process.exit(1) }

console.log(`=== Discover + Score started ${new Date().toISOString()} ===`)
try { await runDiscovery() } catch (e) { console.error('Discovery failed:', e.message) }
try { await runScorer() }    catch (e) { console.error('Scorer failed:', e.message) }
console.log(`=== Done ${new Date().toISOString()} ===`)
