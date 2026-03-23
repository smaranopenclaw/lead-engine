import { runSiteBuilder } from './agents/siteBuilder.js'
import { runEmailDrafter } from './agents/emailDrafter.js'

const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'VERCEL_TOKEN', 'GEMINI_API_KEY']
const missing = REQUIRED.filter(k => !process.env[k])
if (missing.length) { console.error('Missing:', missing.join(', ')); process.exit(1) }

console.log(`=== Build + Email started ${new Date().toISOString()} ===`)
try { await runSiteBuilder() }   catch (e) { console.error('SiteBuilder failed:', e.message) }
try { await runEmailDrafter() }  catch (e) { console.error('EmailDrafter failed:', e.message) }
console.log(`=== Done ${new Date().toISOString()} ===`)
