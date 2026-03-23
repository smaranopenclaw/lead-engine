import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function upsertLeads(leads) {
  const { data, error } = await supabase
    .from('leads')
    .upsert(leads, { onConflict: 'place_id', ignoreDuplicates: true })
    .select()
  if (error) throw error
  return data
}

export async function getUnscoredLeads(limit = 100) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .is('score', null)
    .limit(limit)
  if (error) throw error
  return data
}

export async function updateLead(id, updates) {
  const { data, error } = await supabase
    .from('leads')
    .update({ ...updates, processed_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, demo_url, score, processed_at')
  if (error) throw error
  const rows = data?.length ?? 0
  console.log(`[Supabase] updateLead id=${id} → ${rows} row(s) updated`, rows > 0 ? JSON.stringify(data[0]) : '(no match)')
  if (rows === 0) throw new Error(`updateLead: no row matched id=${id} — check column name`)
}

export async function getLeadsForSiteBuilding(limit = 3) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .not('score', 'is', null)
    .is('demo_url', null)
    .order('score', { ascending: true })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getLeadsForEmailDrafting() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .not('demo_url', 'is', null)
    .is('email_draft', null)
  if (error) throw error
  return data
}
