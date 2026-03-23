import { execSync } from 'child_process'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import slugify from 'slugify'
import { getLeadsForSiteBuilding, updateLead } from '../lib/supabase.js'
import { generateSiteHTML } from '../lib/claude.js'

function deploy(siteDir, projectName) {
  const cmd = `vercel ${siteDir} --token ${process.env.VERCEL_TOKEN} --yes --name ${projectName} --prod 2>&1`
  const output = execSync(cmd, { encoding: 'utf8' })

  // Vercel outputs the URL on the last non-empty line
  const lines = output.trim().split('\n').filter(Boolean)
  const urlLine = lines.reverse().find(l => l.includes('.vercel.app') || l.startsWith('https://'))
  if (!urlLine) throw new Error(`Could not parse Vercel URL from output:\n${output}`)
  return urlLine.trim()
}

export async function runSiteBuilder() {
  console.log('[SiteBuilder] Starting...')
  const leads = await getLeadsForSiteBuilding(3)
  console.log(`[SiteBuilder] Building sites for ${leads.length} leads`)

  for (const lead of leads) {
    const slug = slugify(lead.name, { lower: true, strict: true }).slice(0, 40)
    const projectName = `shravitech-demo-${slug}`
    const siteDir = join(tmpdir(), `site-${slug}-${Date.now()}`)

    try {
      console.log(`[SiteBuilder] Generating HTML for ${lead.name}...`)
      const html = await generateSiteHTML(lead)

      mkdirSync(siteDir, { recursive: true })
      writeFileSync(join(siteDir, 'index.html'), html)

      console.log(`[SiteBuilder] Deploying ${projectName} to Vercel...`)
      const url = deploy(siteDir, projectName)

      await updateLead(lead.id, { demo_url: url })
      console.log(`[SiteBuilder] ${lead.name} → ${url}`)
    } catch (err) {
      console.error(`[SiteBuilder] Failed for ${lead.name}:`, err.message)
    } finally {
      try { rmSync(siteDir, { recursive: true, force: true }) } catch {}
    }
  }

  console.log('[SiteBuilder] Done')
}
