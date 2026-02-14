import type { Payload } from 'payload'
import type { RawCandidate } from './types'
import { callModel } from '../openrouter-client'
import { semanticSearch } from '../embeddings/query'
import { extractTextFromLexical } from '../embeddings/lexical-text'

const SYSTEM_PROMPT = `You are Kiuli's content strategist. Kiuli is a luxury African safari travel company targeting high-net-worth US individuals. Generate article candidates from safari itineraries.

ARTICLE TYPES:
- itinerary_cluster: Destination deep-dives, experience preparation, wildlife/ecology, cultural/historical, practical logistics, comparison and decision support. These link strongly to the source itinerary.
- authority: Science-to-field translation, industry analysis, debunking, policy/operations. These build topical authority.

RULES:
- Generate 10-15 candidates total, mix of both types
- Each must have a specific angle that differentiates it from generic safari content
- Titles should be search-optimised (what would a HNWI Google?)
- Do NOT generate content about topics already well-covered in existing site content (provided below)
- Do NOT generate generic "Top 10 things to do in X" listicles
- Do NOT generate content comparing specific lodges against each other
- Every candidate must connect to at least one destination or property from the itinerary

TARGET AUDIENCE: High-net-worth US individuals planning luxury safaris ($25,000-$100,000+)

Respond with ONLY a JSON array of candidates matching this schema:
[
  {
    "title": "string",
    "contentType": "itinerary_cluster" or "authority",
    "briefSummary": "2-3 sentence summary of what this article covers and why it matters",
    "targetAngle": "The specific angle that makes this different from competitors",
    "targetAudience": ["customer"],
    "destinations": ["Country or region name"],
    "properties": ["Property name if relevant"],
    "species": ["wildlife species if relevant"],
    "freshnessCategory": "monthly" | "quarterly" | "annual" | "evergreen",
    "competitiveNotes": "Brief note on what competitors have published on this topic"
  }
]

No preamble, no markdown fences, no explanation. ONLY the JSON array.`

interface GenerateCandidatesOptions {
  itinerary: Record<string, unknown>
  payload: Payload
}

export async function generateCandidates(
  options: GenerateCandidatesOptions,
): Promise<RawCandidate[]> {
  const { itinerary } = options

  // Build itinerary summary
  const summary = buildItinerarySummary(itinerary)

  // Query embedding store for existing content about same destinations
  const existingContent = await getExistingContent(itinerary)

  const userMessage = `ITINERARY SUMMARY:
${summary}

EXISTING SITE CONTENT (avoid duplicating these topics):
${existingContent.length > 0 ? existingContent.join('\n') : 'No existing content found for these destinations.'}

Generate 10-15 article candidates based on this itinerary.`

  const response = await callModel('ideation', [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ], { temperature: 0.8, maxTokens: 4096 })

  return parseCandidates(response.content)
}

function buildItinerarySummary(itinerary: Record<string, unknown>): string {
  const parts: string[] = []

  // Title
  const title = itinerary.title as string | undefined
  if (title) parts.push(`Title: ${title}`)

  // Overview
  const overview = itinerary.overview as Record<string, unknown> | undefined
  if (overview) {
    const nights = overview.nights as number | undefined
    if (nights) parts.push(`Duration: ${nights} nights`)

    const countries = overview.countries as Array<{ country: string }> | undefined
    if (countries?.length) {
      parts.push(`Countries: ${countries.map((c) => c.country).join(', ')}`)
    }

    const summaryText = extractTextFromLexical(overview.summary)
    if (summaryText) parts.push(`Overview: ${summaryText.substring(0, 500)}`)

    const highlights = overview.highlights as Array<{ highlight: string }> | undefined
    if (highlights?.length) {
      parts.push(`Highlights: ${highlights.map((h) => h.highlight).join('; ')}`)
    }
  }

  // Investment level
  const investmentLevel = itinerary.investmentLevel as Record<string, unknown> | undefined
  if (investmentLevel) {
    const fromPrice = investmentLevel.fromPrice as number | undefined
    const toPrice = investmentLevel.toPrice as number | undefined
    const currency = (investmentLevel.currency as string) || 'USD'
    if (fromPrice) {
      parts.push(
        `Investment: From ${currency} ${fromPrice.toLocaleString()}${toPrice ? ` to ${currency} ${toPrice.toLocaleString()}` : ''} per person`,
      )
    }
  }

  // Days with stays and activities
  const days = itinerary.days as Array<Record<string, unknown>> | undefined
  if (days?.length) {
    const stays: string[] = []
    const activities: string[] = []

    for (const day of days) {
      const segments = day.segments as Array<Record<string, unknown>> | undefined
      if (!segments) continue

      for (const segment of segments) {
        const blockType = segment.blockType as string
        if (blockType === 'stay') {
          const name = segment.accommodationName as string | undefined
          const location = segment.location as string | undefined
          const country = segment.country as string | undefined
          const stayNights = segment.nights as number | undefined
          const descText = extractTextFromLexical(segment.description)

          let stayLine = name || 'Unknown property'
          if (location) stayLine += `, ${location}`
          if (country) stayLine += ` (${country})`
          if (stayNights) stayLine += ` — ${stayNights} nights`
          if (descText) stayLine += `\n  ${descText.substring(0, 300)}`
          stays.push(stayLine)
        } else if (blockType === 'activity') {
          const actTitle = segment.title as string | undefined
          if (actTitle) activities.push(actTitle)
        }
      }
    }

    if (stays.length) parts.push(`\nAccommodations:\n${stays.map((s) => `- ${s}`).join('\n')}`)
    if (activities.length)
      parts.push(`\nActivities:\n${activities.map((a) => `- ${a}`).join('\n')}`)
  }

  // FAQ questions
  const faqItems = itinerary.faqItems as Array<{ question: string }> | undefined
  if (faqItems?.length) {
    parts.push(
      `\nFAQ Questions:\n${faqItems.map((f) => `- ${f.question}`).join('\n')}`,
    )
  }

  return parts.join('\n')
}

async function getExistingContent(itinerary: Record<string, unknown>): Promise<string[]> {
  const overview = itinerary.overview as Record<string, unknown> | undefined
  const countries = (overview?.countries as Array<{ country: string }>) || []
  const existingContent: string[] = []

  for (const c of countries) {
    try {
      const results = await semanticSearch(c.country, { topK: 5, minScore: 0.4 })
      existingContent.push(
        ...results.map((r) => `[${r.chunkType}] ${r.chunkText.substring(0, 200)}`),
      )
    } catch (err) {
      console.warn(`[candidate-generator] Failed to search embeddings for ${c.country}:`, err)
    }
  }

  return existingContent
}

function parseCandidates(content: string): RawCandidate[] {
  // Strip markdown fences if present
  let cleaned = content.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.warn('[candidate-generator] Failed to parse LLM response as JSON:', err)
    console.warn('[candidate-generator] Raw response:', content.substring(0, 500))
    return []
  }

  if (!Array.isArray(parsed)) {
    console.warn('[candidate-generator] LLM response is not an array')
    return []
  }

  const valid: RawCandidate[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') {
      console.warn('[candidate-generator] Skipping non-object candidate')
      continue
    }

    const c = item as Record<string, unknown>

    // Validate required fields
    if (
      typeof c.title !== 'string' ||
      !c.title ||
      !['itinerary_cluster', 'authority'].includes(c.contentType as string) ||
      typeof c.briefSummary !== 'string' ||
      !c.briefSummary ||
      typeof c.targetAngle !== 'string' ||
      !c.targetAngle
    ) {
      console.warn('[candidate-generator] Skipping invalid candidate:', c.title || 'no title')
      continue
    }

    valid.push({
      title: c.title as string,
      contentType: c.contentType as 'itinerary_cluster' | 'authority',
      briefSummary: c.briefSummary as string,
      targetAngle: c.targetAngle as string,
      targetAudience: validateAudience(c.targetAudience),
      destinations: asStringArray(c.destinations),
      properties: asStringArray(c.properties),
      species: asStringArray(c.species),
      freshnessCategory: validateFreshness(c.freshnessCategory),
      competitiveNotes: (c.competitiveNotes as string) || '',
    })
  }

  return valid
}

function validateAudience(
  value: unknown,
): ('customer' | 'professional' | 'guide')[] {
  const validValues = ['customer', 'professional', 'guide']
  if (!Array.isArray(value)) return ['customer']
  const filtered = value.filter((v) => validValues.includes(v as string))
  return filtered.length > 0
    ? (filtered as ('customer' | 'professional' | 'guide')[])
    : ['customer']
}

function validateFreshness(
  value: unknown,
): 'monthly' | 'quarterly' | 'annual' | 'evergreen' {
  const validValues = ['monthly', 'quarterly', 'annual', 'evergreen']
  if (typeof value === 'string' && validValues.includes(value)) {
    return value as 'monthly' | 'quarterly' | 'annual' | 'evergreen'
  }
  return 'evergreen'
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v) => typeof v === 'string' && v.length > 0)
}
