import { execSync, spawnSync } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir, homedir } from 'os'

function loadDesignSkill() {
  const skillPath = join(homedir(), '.claude/skills/bencium-impact-designer/skill.md')
  if (!existsSync(skillPath)) return ''
  const raw = readFileSync(skillPath, 'utf8')
  // Strip frontmatter, keep the design guidance
  return raw.replace(/^---[\s\S]*?---\n/, '').trim()
}

const HEADER_RULES = `MANDATORY HEADER (non-negotiable):
- Sticky top navbar: position:sticky; top:0; z-index:1000
- Solid opaque background — never transparent, never blending into the hero
- Logo/business name on the LEFT in bold
- Nav links horizontal on the RIGHT (flexbox row, gap between items)
- Minimum height 64px, padding 0 24px
- On mobile (<768px): logo left, hamburger icon right — nav links collapse into a vertical dropdown or hidden menu
- The navbar must be fully visible and usable on first load — no broken layout`

const SEO_RULES = `MANDATORY SEO (non-negotiable):
- <html lang="en">
- <meta charset="UTF-8">
- <meta name="viewport" content="width=device-width, initial-scale=1.0">
- <meta name="robots" content="index, follow">
- <title> (business name + category + Hyderabad, ≤60 chars)
- <meta name="description"> (≤160 chars, includes category + city)
- <link rel="canonical" href="https://placeholder.vercel.app/">
- og:title, og:description, og:type
- Schema.org LocalBusiness JSON-LD (name, address, phone, city)
- All images: descriptive alt attributes
- Exactly one <h1> with business name
- Logical heading hierarchy (h1 → h2 → h3, never skip levels)
- Google Fonts URL must include &display=swap (e.g. ?family=Roboto&display=swap)
- font-display: swap on any @font-face declarations`

function buildPrompt({ business, existingContent, lighthouseIssues }) {
  const isIteration = !!lighthouseIssues
  const isRebuild = !!existingContent

  if (isIteration) {
    return `You are fixing a website to pass a Lighthouse audit. Fix ONLY the listed issues — do not change content or overall design.

FAILING LIGHTHOUSE AUDITS:
${lighthouseIssues.map(i => `- ${i}`).join('\n')}

COMMON FIXES REFERENCE:
- Missing meta description → <meta name="description" content="...">
- Images missing alt → add descriptive alt attributes
- Render-blocking resources → defer/async scripts, add &display=swap to Google Fonts URL
- Missing lang → <html lang="en">
- Low contrast → increase ratio to 4.5:1+
- Missing viewport → <meta name="viewport" content="width=device-width, initial-scale=1">
- No canonical → <link rel="canonical" href="https://placeholder.vercel.app/">
- Missing h1 → ensure exactly one h1
- Font loading slow → add &display=swap to Google Fonts URL, font-display:swap
- Broken header → sticky navbar, solid background, logo left, links right, z-index:1000

Return ONLY the complete fixed HTML. No explanation, no markdown fences.

CURRENT HTML TO FIX:
${lighthouseIssues._currentHTML}`
  }

  if (isRebuild) {
    return `You are an expert web designer and SEO specialist. Rebuild this business website with a completely new, modern UI/UX while keeping ALL original content intact.

BUSINESS:
- Name: ${business.name}
- Category: ${business.category}
- Address: ${business.address}
- Phone: ${business.phone || existingContent.phone || ''}
- Rating: ${business.rating || 'N/A'}/5 Google
- City: Hyderabad, India

ORIGINAL CONTENT TO PRESERVE (use all of this):
- Title: ${existingContent.title}
- Nav/Services: ${existingContent.nav.join(', ')}
- H1: ${existingContent.h1.join(' | ')}
- H2s: ${existingContent.h2.slice(0, 8).join(' | ')}
- Content: ${existingContent.paragraphs.slice(0, 10).join(' || ')}
- Listed items: ${existingContent.lists.slice(0, 20).join(', ')}
- Contact: ${existingContent.address || business.address} | ${existingContent.phone || business.phone} | ${existingContent.email || ''}

DESIGN:
- Single HTML file, all CSS in <style> tags, zero external CSS frameworks
- Modern hero with gradient/bold typography for this business type
- Services section using original service list
- About section using original copy
- Contact section with address, phone, Google Maps iframe
- Mobile-first (CSS Grid + Flexbox)
- Single Google Font import
- Color palette suited to ${business.category}

${HEADER_RULES}

${SEO_RULES}

Return ONLY the complete HTML file. No explanation, no markdown fences.`
  }

  return `You are an expert web designer and SEO specialist. Build a complete professional website for this Hyderabad business that currently has no online presence.

BUSINESS:
- Name: ${business.name}
- Category: ${business.category}
- Address: ${business.address}
- Phone: ${business.phone || ''}
- Rating: ${business.rating || 'N/A'}/5 Google
- City: Hyderabad, India

DESIGN:
- Single HTML file, all CSS in <style> tags, zero external CSS frameworks
- Strong hero with CTA
- Services section (infer 4-6 realistic services for this category in Hyderabad)
- About section (realistic professional copy — NO Lorem Ipsum)
- Why choose us (3-4 differentiators)
- Contact section with address, phone, CTA button
- Mobile-first responsive (CSS Grid + Flexbox)
- Single Google Font import
- Color scheme for ${business.category}

${HEADER_RULES}

${SEO_RULES}

Return ONLY the complete HTML file. No explanation, no markdown fences.`
}

export async function buildSiteHTML(params) {
  const prompt = buildPrompt(params)
  const promptFile = join(tmpdir(), `claude-prompt-${Date.now()}.txt`)
  const outputFile = join(tmpdir(), `claude-output-${Date.now()}.html`)

  const designSkill = loadDesignSkill()
  const args = ['-p', prompt]
  if (designSkill) args.push('--append-system-prompt', designSkill)

  try {
    writeFileSync(promptFile, prompt)

    // Run claude headlessly — pin HOME so claude finds its auth + settings
    const result = spawnSync('claude', args, {
      encoding: 'utf8',
      timeout: 480000,
      maxBuffer: 10 * 1024 * 1024,
      input: '',
      env: {
        ...process.env,
        HOME: '/Users/aiagent',
        PATH: '/Users/aiagent/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin',
      },
    })

    if (result.error) throw new Error(`claude spawn failed: ${result.error.message}`)
    if (result.status !== 0) {
      const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').slice(0, 800)
      throw new Error(`claude exited ${result.status}: ${detail}`)
    }
    if (!result.stdout?.trim()) throw new Error('claude returned empty output')

    // Strip any accidental markdown fences if Claude added them
    const html = result.stdout
      .replace(/^```html\n?/i, '')
      .replace(/^```\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim()

    writeFileSync(outputFile, html)
    return html
  } finally {
    try { execSync(`rm -f ${promptFile} ${outputFile}`) } catch {}
  }
}
