import type { ResearchQuery, PerplexityResponse, ExternalSource } from './types'

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions'
const MODEL = 'sonar-pro'

const SYSTEM_PROMPT = `You are a research assistant for Kiuli, a luxury African safari travel company targeting high-net-worth US individuals. Research the following topic thoroughly.

Focus on:
- Authoritative sources (national park authorities, government tourism boards, conservation organizations, academic publications)
- Recent information (prefer sources from the last 12 months)
- Specific facts, statistics, and data points that add depth
- Information that would be relevant to luxury travelers spending $25,000-$100,000+ on safari experiences

Provide a comprehensive synthesis with specific citations. Note any conflicting information between sources. Flag time-sensitive information that may change.`

function rateCredibility(url: string): ExternalSource['credibility'] {
  const lower = url.toLowerCase()

  // Government / authoritative
  if (lower.includes('.gov')) return 'authoritative'
  if (lower.includes('.edu')) return 'authoritative'

  // Known conservation orgs
  const authoritativeOrgs = [
    'iucn.org', 'worldwildlife.org', 'wwf.org', 'wcs.org',
    'conservation.org', 'fauna-flora.org', 'awf.org',
    'africanparks.org', 'unep.org', 'unesco.org',
    'nationalgeographic.com', 'nature.org',
  ]
  if (authoritativeOrgs.some((org) => lower.includes(org))) return 'authoritative'

  // Peer reviewed / academic
  if (lower.includes('.ac.uk') || lower.includes('.ac.za')) return 'peer_reviewed'
  const peerReviewedDomains = [
    'pubmed.ncbi', 'doi.org', 'jstor.org', 'springer.com',
    'wiley.com', 'nature.com', 'science.org', 'pnas.org',
    'journals.plos.org', 'frontiersin.org',
  ]
  if (peerReviewedDomains.some((d) => lower.includes(d))) return 'peer_reviewed'

  // Preprints
  if (lower.includes('arxiv.org') || lower.includes('biorxiv.org') || lower.includes('preprint')) {
    return 'preprint'
  }

  // Trade publications
  const tradeDomains = [
    'skift.com', 'travelweekly.com', 'travelpulse.com',
    'phocuswire.com', 'ttgmedia.com', 'safaribookings.com',
    'africageographic.com', 'travel-news.co.za',
  ]
  if (tradeDomains.some((d) => lower.includes(d))) return 'trade'

  // .org catch-all (many conservation orgs)
  if (lower.includes('.org')) return 'authoritative'

  return 'other'
}

export async function queryPerplexity(researchQuery: ResearchQuery): Promise<PerplexityResponse> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not set')
  }

  const userMessage = [
    `Topic: ${researchQuery.topic}`,
    `Angle: ${researchQuery.angle}`,
    `Destinations: ${researchQuery.destinations.join(', ')}`,
    `Content type: ${researchQuery.contentType}`,
  ].join('\n')

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_tokens: 4096,
    temperature: 0.3,
    return_citations: true,
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(PERPLEXITY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const data = await response.json()
      const answer: string = data.choices?.[0]?.message?.content || ''
      const citations: string[] = data.citations || []

      const sources: ExternalSource[] = citations.map((url: string, i: number) => ({
        title: `Source ${i + 1}`,
        url,
        snippet: '',
        credibility: rateCredibility(url),
      }))

      return {
        answer,
        sources,
        followUpQuestions: [],
      }
    }

    const status = response.status
    const errorBody = await response.text()

    // Non-retryable errors
    if (status === 400 || status === 401 || status === 403 || status === 404) {
      throw new Error(`Perplexity API error ${status}: ${errorBody}`)
    }

    // Retryable (429, 5xx)
    if (status === 429 || status >= 500) {
      lastError = new Error(`Perplexity API error ${status}: ${errorBody}`)
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 5000))
        continue
      }
    }

    throw new Error(`Perplexity API unexpected status ${status}: ${errorBody}`)
  }

  throw lastError ?? new Error('Perplexity API request failed after retry')
}
