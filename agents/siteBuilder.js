import { spawnSync } from 'child_process'
import { writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import slugify from 'slugify'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'
import { getLeadsForSiteBuilding, updateLead } from '../lib/supabase.js'
import { scrapeSiteContent } from '../lib/scraper.js'
import { buildSiteHTML } from '../lib/builder.js'

const SCORE_THRESHOLD = 85
const MAX_ITERATIONS = 3

async function runLighthouse(url) {
  let chrome
  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    })
    const result = await lighthouse(url, {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance', 'seo', 'accessibility', 'best-practices'],
      logLevel: 'error'
    })

    const cats = result.lhr.categories
    const score = Math.round(
      ((cats.performance?.score ?? 0) +
       (cats.seo?.score ?? 0) +
       (cats.accessibility?.score ?? 0) +
       (cats['best-practices']?.score ?? 0)) / 4 * 100
    )

    // Extract failing audit titles for Claude to fix
    const failingAudits = Object.values(result.lhr.audits)
      .filter(a => a.score !== null && a.score < 0.9 && a.details?.type !== 'opportunity')
      .map(a => a.title)
      .slice(0, 15)

    return { score, failingAudits }
  } catch (err) {
    console.warn(`[SiteBuilder] Lighthouse failed on ${url}: ${err.message}`)
    return null
  } finally {
    if (chrome) await chrome.kill()
  }
}

function deployToVercel(siteDir, projectName) {
  const RUNNER_PATH = '/Users/aiagent/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin'
  const scope = process.env.VERCEL_SCOPE || 'smaranopenclaw-6475s-projects'
  const result = spawnSync('vercel', [siteDir, '--token', process.env.VERCEL_TOKEN, '--yes', '--scope', scope, '--name', projectName, '--prod'], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PATH: RUNNER_PATH },
  })
  if (result.error) throw new Error(`vercel spawn failed: ${result.error.message}`)
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim().slice(0, 1000)
    throw new Error(`Vercel deploy failed (exit ${result.status}):\n${detail || '(no output)'}`)
  }
  // Output is JSON when using --token
  try {
    const data = JSON.parse(result.stdout.trim())
    if (data?.deployment?.url) return `https://${data.deployment.url}`
    if (data?.url) return data.url.startsWith('https://') ? data.url : `https://${data.url}`
  } catch {}
  // Fallback: scan lines for a URL
  const lines = result.stdout.trim().split('\n').filter(Boolean)
  const urlLine = lines.reverse().find(l => l.includes('.vercel.app') || l.startsWith('https://'))
  if (!urlLine) throw new Error(`Could not parse Vercel URL:\n${result.stdout}`)
  return urlLine.trim()
}

export async function runSiteBuilder() {
  console.log('[SiteBuilder] Starting...')
  const leads = await getLeadsForSiteBuilding(3)
  console.log(`[SiteBuilder] Building sites for ${leads.length} leads`)

  for (const lead of leads) {
    const slug = slugify(lead.name, { lower: true, strict: true }).slice(0, 40)
    const projectName = `shravitech-demo-${slug}`
    const siteDir = join(tmpdir(), `site-${slug}`)

    try {
      // Step 1: Scrape existing site content if they have one
      let existingContent = null
      if (lead.has_website && lead.website) {
        console.log(`[SiteBuilder] Scraping existing site: ${lead.website}`)
        existingContent = await scrapeSiteContent(lead.website)
        if (existingContent) {
          console.log(`[SiteBuilder] Scraped: "${existingContent.title}" — ${existingContent.paragraphs.length} paragraphs, ${existingContent.nav.length} nav items`)
        }
      }

      // Step 2: Initial build
      console.log(`[SiteBuilder] Building initial site for ${lead.name}...`)
      let html = await buildSiteHTML({ business: lead, existingContent })

      mkdirSync(siteDir, { recursive: true })
      writeFileSync(join(siteDir, 'index.html'), html)

      // Step 3: Deploy first version
      console.log(`[SiteBuilder] Deploying initial version...`)
      const siteUrl = deployToVercel(siteDir, projectName)
      console.log(`[SiteBuilder] Live at ${siteUrl}`)

      // Wait for Vercel to propagate
      await new Promise(r => setTimeout(r, 8000))

      // Step 4: Iterate with Lighthouse until score >= threshold
      let finalScore = 0

      for (let i = 1; i <= MAX_ITERATIONS; i++) {
        console.log(`[SiteBuilder] Lighthouse pass ${i}/${MAX_ITERATIONS} on ${siteUrl}...`)
        const audit = await runLighthouse(siteUrl)

        if (!audit) {
          console.warn('[SiteBuilder] Lighthouse failed, keeping current version')
          break
        }

        finalScore = audit.score
        console.log(`[SiteBuilder] Pass ${i} score: ${finalScore}/100 — failing: ${audit.failingAudits.slice(0, 3).join(', ')}`)

        if (finalScore >= SCORE_THRESHOLD) {
          console.log(`[SiteBuilder] Score ${finalScore} ≥ ${SCORE_THRESHOLD} — done!`)
          break
        }

        if (i === MAX_ITERATIONS) {
          console.log(`[SiteBuilder] Max iterations reached, final score: ${finalScore}`)
          break
        }

        // Feed failing audits back to Claude to fix
        console.log(`[SiteBuilder] Asking Claude to fix ${audit.failingAudits.length} issues...`)
        audit.failingAudits._currentHTML = html
        html = await buildSiteHTML({
          business: lead,
          existingContent,
          lighthouseIssues: audit.failingAudits
        })

        writeFileSync(join(siteDir, 'index.html'), html)
        deployToVercel(siteDir, projectName)

        // Wait for redeploy to propagate
        await new Promise(r => setTimeout(r, 8000))
      }

      // Store final result
      await updateLead(lead.id, {
        demo_url: siteUrl,
        lighthouse_data: { demo_score: finalScore }
      })
      console.log(`[SiteBuilder] ✓ ${lead.name} → ${siteUrl} (score: ${finalScore})`)

    } catch (err) {
      console.error(`[SiteBuilder] Failed for ${lead.name}:`, err.message)
    } finally {
      try { rmSync(siteDir, { recursive: true, force: true }) } catch {}
    }
  }

  console.log('[SiteBuilder] Done')
}
