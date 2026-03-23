import { runScorer } from './agents/scorer.js'

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
const missing = REQUIRED.filter(k => !process.env[k])
if (missing.length) { console.error('Missing:', missing.join(', ')); process.exit(1) }

console.log(`=== Fallback Scorer started ${new Date().toISOString()} ===`)
await runScorer()
console.log(`=== Done ${new Date().toISOString()} ===`)
