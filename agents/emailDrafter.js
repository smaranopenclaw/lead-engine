import { getLeadsForEmailDrafting, updateLead } from '../lib/supabase.js'
import { generateEmail } from '../lib/claude.js'

export async function runEmailDrafter() {
  console.log('[EmailDrafter] Starting...')
  const leads = await getLeadsForEmailDrafting()
  console.log(`[EmailDrafter] Drafting emails for ${leads.length} leads`)

  for (const lead of leads) {
    try {
      console.log(`[EmailDrafter] Drafting for ${lead.name}...`)
      const email = await generateEmail(lead)
      await updateLead(lead.id, {
        email_draft: email,
        email_status: 'draft'
      })
      console.log(`[EmailDrafter] Done: ${lead.name}`)
    } catch (err) {
      console.error(`[EmailDrafter] Failed for ${lead.name}:`, err.message)
    }
  }

  console.log('[EmailDrafter] Done')
}
