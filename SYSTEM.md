# ShraviTech Lead Engine — How It Works

An autonomous lead generation system that finds local businesses in Hyderabad, audits their web presence, builds demo sites, and drafts personalised outreach emails — 3 times a day, with zero human involvement.

---

## The Big Picture

```
Every day at 8am, 1pm, 6pm IST
            │
            ▼
   Find businesses on Google Maps
            │
            ▼
   Do they have a website?
   ┌─────────────────────────┐
   │ YES                     │ NO
   ▼                         ▼
Run Lighthouse audit    Score by category
(Performance/SEO/UX)    (how badly do they
Score: 0–100            need a site?)
   └──────────┬──────────────┘
              ▼
   Pick the worst performers
              ▼
   Scrape their existing site
   (or use Google Maps info)
              ▼
   Claude Code rebuilds the site
   ┌──────────────────────────┐
   │ Same content, new UI/UX  │
   │ + full SEO baked in      │
   └──────────────────────────┘
              ▼
   Deploy demo to Vercel
   (live URL in ~30 seconds)
              ▼
   Run Lighthouse on the demo
   Score still below 85?
   → Feed issues back to Claude
   → Fix and redeploy
   → Repeat until ≥ 85/100
              ▼
   Draft a personalised cold email
   "We built this for you. Here's the link."
              ▼
   Everything saved to database
   Email sits as DRAFT — Smaran reviews
   and sends manually
```

---

## Step by Step

### Step 1 — Discovery
**Where:** GitHub's servers
**Tool:** Apify (`compass/crawler-google-places`)

Searches Google Maps for businesses in Hyderabad across rotating categories — law firms, dental clinics, architects, gyms, travel agencies, etc. Each run picks 4 random categories, pulling ~20 businesses each. Results are saved to Supabase. Duplicates are ignored automatically.

---

### Step 2 — Scoring
**Where:** GitHub's servers
**Tool:** Google Lighthouse (headless Chrome)

Every new business gets a score from 0–100 representing how badly they need help.

**If they have a website:**
Lighthouse audits it across Performance, SEO, Accessibility, and Best Practices. A score of 35 means their site is slow, poorly optimised, and broken on mobile. A score of 90 means it's solid — low priority.

**If they don't have a website:**
A category-based score is assigned based on how critical an online presence is for that business type.

| Category | Score | Why |
|----------|-------|-----|
| Law Firm | 15 | Credibility is everything. No site = lost clients |
| Architect | 25 | Portfolio is their product |
| Restaurant | 55 | Zomato/Swiggy partially covers them |
| Street Food | 70 | Unlikely to invest |

Lower score = worse current state = better prospect for ShraviTech.

---

### Step 3 — Site Building (The Clever Part)
**Where:** Smaran's Mac (self-hosted runner)
**Tool:** Claude Code CLI + Vercel

The 3 lowest-scored businesses from each run get a demo site built for them.

**For businesses with an existing (bad) site:**
1. Their current site is scraped — all real content extracted (services, about text, contact info, navigation)
2. Claude Code rebuilds it from scratch: same content, completely new design, full SEO
3. The brief to Claude is explicit: modern layout, mobile-first, schema markup, meta tags, Core Web Vitals optimised

**For businesses with no site:**
1. Claude Code generates realistic content based on the business type and location
2. Full site built as if they were a real ShraviTech client

**The quality loop:**
After each build, Lighthouse audits the live demo. If it scores below 85:
- The failing audits are fed back to Claude ("fix these 12 issues")
- Site is patched and redeployed
- Lighthouse runs again
- Repeats up to 3 times until the score clears 85

The demo site ends up at a URL like `shravitech-demo-business-name.vercel.app` — polished, fast, and measurably better than what the business currently has.

---

### Step 4 — Email Drafting
**Where:** Smaran's Mac
**Tool:** Gemini 2.0 Flash

A personalised cold email is drafted for each business. Two versions:

**Business had a bad site:**
> "We audited your website and found it scores 34/100 — slow load times, not mobile-friendly, missing SEO basics. We took the initiative to show you what it could look like: [demo link]. Happy to walk you through it."

**Business had no site:**
> "We noticed [Business Name] doesn't have a website yet. For a [category] in Hyderabad, that's a real gap — most customers search online before visiting. We built a demo to show you what your online presence could look like: [demo link]."

Emails are stored in the database with status `draft`. Smaran reviews and sends them manually.

---

## Infrastructure

| Component | Service | Cost |
|-----------|---------|------|
| Business discovery | Apify Google Maps Scraper | ~$3–5/month |
| Database | Supabase | Free tier |
| Site building AI | Claude Code (Pro subscription) | Already paying |
| Email drafting AI | Google Gemini 2.0 Flash | Free tier |
| Demo site hosting | Vercel | Free tier |
| Cron scheduling | GitHub Actions | Free tier |
| Site building compute | Smaran's Mac | Already exists |

**Total additional cost: ~$5/month (Apify only)**

---

## What Lands in the Database

Every lead in Supabase has:
- Business name, address, phone, Google Maps URL
- Category and rating
- Current website (if any)
- Score (0–100)
- Lighthouse breakdown (performance, SEO, accessibility, best-practices)
- Demo site URL
- Drafted email (ready to send)

---

## The Human Role

The only thing done manually: **read the drafted email, hit send.**

Everything else — finding the businesses, auditing their sites, building demos, writing the pitch — happens automatically while Smaran is doing other things.

---

## Repo
`github.com/smaranopenclaw/lead-engine` (private)
