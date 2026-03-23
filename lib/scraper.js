import * as cheerio from 'cheerio'

const TIMEOUT = 15000

export async function scrapeSiteContent(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ShraviTech-Audit/1.0)' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const $ = cheerio.load(html)

    // Remove noise
    $('script, style, noscript, iframe, svg, img, link, meta').remove()

    const content = {
      title: $('title').text().trim(),
      metaDescription: $('meta[name="description"]').attr('content') || '',
      h1: $('h1').map((_, el) => $(el).text().trim()).get().filter(Boolean),
      h2: $('h2').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 10),
      nav: $('nav a, header a').map((_, el) => $(el).text().trim()).get().filter(Boolean),
      paragraphs: $('p').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 40).slice(0, 20),
      lists: $('ul li, ol li').map((_, el) => $(el).text().trim()).get().filter(Boolean).slice(0, 30),
      address: $('[class*="address"], [id*="address"], address').first().text().trim(),
      phone: extractPhone($),
      email: extractEmail($),
      footerText: $('footer').text().replace(/\s+/g, ' ').trim().slice(0, 500)
    }

    return content
  } catch (err) {
    console.warn(`[Scraper] Could not scrape ${url}: ${err.message}`)
    return null
  }
}

function extractPhone($) {
  const text = $('body').text()
  const match = text.match(/(\+91[\s-]?)?[6-9]\d{9}/)
  return match ? match[0].trim() : ''
}

function extractEmail($) {
  const text = $('body').text()
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  return match ? match[0] : ''
}
