import { execSync, spawnSync } from 'child_process'
import { writeFileSync, readFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

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
- Render-blocking resources → defer/async scripts, inline critical CSS
- Missing lang → <html lang="en">
- Low contrast → increase ratio to 4.5:1+
- Missing viewport → <meta name="viewport" content="width=device-width, initial-scale=1">
- No canonical → <link rel="canonical" href="https://placeholder.vercel.app/">
- Missing h1 → ensure exactly one h1
- Font loading slow → font-display:swap

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

MANDATORY SEO (non-negotiable):
- <html lang="en">
- <meta charset="UTF-8">
- <meta name="viewport" content="width=device-width, initial-scale=1.0">
- <title> business name + category + Hyderabad (≤60 chars)
- <meta name="description"> (≤160 chars, includes category + city)
- <link rel="canonical" href="https://placeholder.vercel.app/">
- og:title, og:description, og:type
- Schema.org LocalBusiness JSON-LD (name, address, phone, city)
- All images: descriptive alt attributes
- Exactly one <h1> with business name
- Logical heading hierarchy
- Google Fonts: add &display=swap to the import URL (e.g. ?family=Roboto&display=swap)
- Google Fonts: add &display=swap to the import URL
- font-display: swap on all custom fonts
- <meta name="robots" content="index, follow"> on all custom fonts
- <meta name="robots" content="index, follow">

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
- Single HTML file, all CSS in <style> tags
- Strong hero with CTA
- Services section (infer 4-6 realistic services for this category in Hyderabad)
- About section (realistic professional copy — NO Lorem Ipsum)
- Why choose us (3-4 differentiators)
- Contact section with address, phone, CTA button
- Mobile-first responsive
- Single Google Font import
- Color scheme for ${business.category}

MANDATORY SEO:
- <html lang="en">
- <meta charset="UTF-8">
- <meta name="viewport" content="width=device-width, initial-scale=1.0">
- <title> (business name + category + Hyderabad, ≤60 chars)
- <meta name="description"> (≤160 chars)
- <link rel="canonical" href="https://placeholder.vercel.app/">
- Open Graph tags
- Schema.org LocalBusiness JSON-LD
- Descriptive alt on all images
- Exactly one <h1>
- Google Fonts: add &display=swap to the import URL
- font-display: swap on all custom fonts
- <meta name="robots" content="index, follow">

Return ONLY the complete HTML file. No explanation, no markdown fences.`
}

export async function buildSiteHTML(params) {
  const prompt = buildPrompt(params)
  const promptFile = join(tmpdir(), `claude-prompt-${Date.now()}.txt`)
  const outputFile = join(tmpdir(), `claude-output-${Date.now()}.html`)

  try {
    writeFileSync(promptFile, prompt)

    // Run claude headlessly — pin HOME so claude finds its auth + settings
    const result = spawnSync('claude', ['-p', prompt], {
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
