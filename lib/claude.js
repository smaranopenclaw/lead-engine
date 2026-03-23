import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function generateSiteHTML(business) {
  const prompt = `You are an expert web designer. Generate a complete, beautiful, single-page HTML website for this local business.

Business details:
- Name: ${business.name}
- Category: ${business.category}
- Address: ${business.address}
- Phone: ${business.phone || 'Not provided'}
- Rating: ${business.rating || 'N/A'}/5
- City: Hyderabad, India

Requirements:
- Single HTML file with all CSS inline in <style> tags
- Modern, professional design with a hero section, services/about, contact
- Mobile responsive using CSS flexbox/grid (no frameworks)
- Fast loading - no external dependencies except Google Fonts (one import)
- Strong SEO: proper meta tags, Open Graph, schema.org JSON-LD for LocalBusiness
- Include a clear CTA (Call Now / Get Quote)
- Color scheme should fit the business category
- Footer with address and phone
- DO NOT use placeholder Lorem Ipsum — write realistic copy for this type of business in Hyderabad

Return ONLY the complete HTML file, no explanation.`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }]
  })

  return msg.content[0].text
}

export async function generateEmail(business) {
  const hasWebsite = !!business.website
  const prompt = `You are a senior sales consultant at ShraviTech, a digital agency in Hyderabad.

Write a cold outreach email to this business owner/manager. Be concise, professional, and genuinely helpful — NOT salesy.

Business:
- Name: ${business.name}
- Category: ${business.category}
- Address: ${business.address}
- Phone: ${business.phone || 'N/A'}
- Current website: ${hasWebsite ? business.website : 'NONE'}
${hasWebsite ? `- Website score: ${business.score}/100 (issues: slow load, poor SEO, bad mobile UX)` : ''}
- Demo site we built for them: ${business.demo_url}

${hasWebsite
  ? `Angle: We audited their site and found serious issues. We\'ve built a preview of what a better site would look like. Link them to the demo. Mention 1-2 specific issues we found (slow speed, poor mobile, missing SEO). Offer a free consultation.`
  : `Angle: We noticed they don\'t have a website. We\'ve taken the initiative to build a demo site for them at no cost. This is what their online presence could look like. Explain why a website matters for their category of business in Hyderabad specifically. Offer to discuss.`
}

Format:
Subject: [write a subject line]
---
[email body — 3-4 short paragraphs, conversational tone, end with a soft CTA]

Sign off as: ShraviTech Team | smaranopenclaw@shravitech.in`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }]
  })

  return msg.content[0].text
}
