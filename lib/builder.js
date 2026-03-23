import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function buildSiteHTML({ business, existingContent, lighthouseIssues = null }) {
  const isRebuild = !!existingContent
  const isIteration = !!lighthouseIssues

  let prompt

  if (isIteration) {
    // Iteration pass — fix specific Lighthouse failures
    prompt = `You are an expert web developer fixing a website to pass a Lighthouse audit.

The current HTML is below. Fix ONLY the issues listed — do not change the content or overall design.

FAILING LIGHTHOUSE AUDITS:
${lighthouseIssues.map(i => `- ${i}`).join('\n')}

COMMON FIXES:
- Missing meta description → add <meta name="description" content="...">
- Images missing alt text → add descriptive alt attributes
- Render-blocking resources → add defer/async to scripts, inline critical CSS
- Missing lang attribute → add lang="en" to <html>
- Low contrast text → increase contrast ratio
- Missing viewport meta → add <meta name="viewport" content="width=device-width, initial-scale=1">
- No canonical URL → add <link rel="canonical" href="...">
- Missing h1 → ensure exactly one h1 tag
- Slow font loading → add font-display:swap to @font-face

Return ONLY the complete fixed HTML file.

CURRENT HTML:
${lighthouseIssues._currentHTML}`

  } else if (isRebuild) {
    // Rebuild existing site — keep content, redesign everything
    prompt = `You are an expert web designer and SEO specialist at ShraviTech, a digital agency.

Rebuild this business website with a completely new, modern UI/UX while keeping ALL the original content intact.

BUSINESS INFO:
- Name: ${business.name}
- Category: ${business.category}
- Address: ${business.address}
- Phone: ${business.phone || existingContent.phone || 'Not listed'}
- Rating: ${business.rating || 'N/A'}/5 on Google
- City: Hyderabad, India

EXISTING SITE CONTENT TO PRESERVE:
- Page title: ${existingContent.title}
- Services/Nav items: ${existingContent.nav.join(', ')}
- Main headings: ${existingContent.h1.join(' | ')}
- Sub headings: ${existingContent.h2.slice(0, 6).join(' | ')}
- Key content: ${existingContent.paragraphs.slice(0, 8).join(' | ')}
- Listed items: ${existingContent.lists.slice(0, 15).join(', ')}
- Contact: ${existingContent.address || business.address} | ${existingContent.phone || business.phone} | ${existingContent.email || ''}

DESIGN REQUIREMENTS:
- Single HTML file, all CSS in <style> tags, no external CSS frameworks
- Modern hero section with gradient/bold typography fitting the business category
- Clear services/features section using the original service list
- About/story section using the original content
- Contact section with address, phone, embedded Google Maps iframe
- Mobile-first responsive (CSS Grid + Flexbox)
- One Google Font import only
- Professional color palette suited to the business type

MANDATORY SEO (this is non-negotiable):
- <html lang="en">
- <meta charset="UTF-8">
- <meta name="viewport" content="width=device-width, initial-scale=1.0">
- <title> tag with business name + category + Hyderabad (under 60 chars)
- <meta name="description"> (under 160 chars, includes category + city)
- <link rel="canonical" href="#">
- Open Graph tags (og:title, og:description, og:type)
- Schema.org LocalBusiness JSON-LD with name, address, phone, geo (Hyderabad)
- All images must have descriptive alt attributes
- Exactly one <h1> with the business name
- Logical heading hierarchy (h1 → h2 → h3)
- font-display: swap on all custom fonts

Return ONLY the complete HTML file, no explanation.`

  } else {
    // New site — no existing website
    prompt = `You are an expert web designer and SEO specialist at ShraviTech.

Build a complete, professional website for this local Hyderabad business that has no online presence yet.

BUSINESS INFO:
- Name: ${business.name}
- Category: ${business.category}
- Address: ${business.address}
- Phone: ${business.phone || 'Not listed'}
- Rating: ${business.rating || 'N/A'}/5 on Google

DESIGN REQUIREMENTS:
- Single HTML file, all CSS in <style> tags
- Modern hero section with a strong headline and CTA
- Services section (infer 4-6 realistic services for this type of business in Hyderabad)
- About section (write realistic, professional copy — NO Lorem Ipsum)
- Why choose us section (3-4 differentiators)
- Contact section with address, phone, call-to-action
- Mobile-first responsive
- One Google Font import only
- Color scheme appropriate for the business category

MANDATORY SEO:
- <html lang="en">
- <meta charset="UTF-8">
- <meta name="viewport" content="width=device-width, initial-scale=1.0">
- <title> (business name + category + Hyderabad, under 60 chars)
- <meta name="description"> (under 160 chars)
- <link rel="canonical" href="#">
- Open Graph tags
- Schema.org LocalBusiness JSON-LD
- All images: descriptive alt attributes
- Exactly one <h1>
- font-display: swap

Return ONLY the complete HTML file, no explanation.`
  }

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  })

  return msg.content[0].text
}
