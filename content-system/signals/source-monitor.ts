import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Parser from 'rss-parser'
import type { SourceMonitorOptions, SourceCheckResult, FeedItem } from './types'
import type { RawCandidate, FilteredCandidate } from '../ideation/types'
import { filterCandidates } from '../ideation/candidate-filter'
import { callModel } from '../openrouter-client'
import { embedChunks } from '../embeddings/embedder'
import type { ContentChunk } from '../embeddings/types'
import { slugify } from '../cascade/utils'

const rssParser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Kiuli Content Engine/1.0' },
})

const CANDIDATE_SYSTEM_PROMPT = `You are evaluating feed items for Kiuli, a luxury African safari travel company. Kiuli produces content about African safari destinations, lodges, wildlife, conservation, and luxury travel.

Given a feed item, determine if it is relevant to Kiuli's content strategy. An item is relevant if it relates to:
- African wildlife, conservation, or ecology
- Safari destinations in Africa (countries, parks, reserves)
- Luxury travel in Africa
- Safari lodge/camp news
- Tourism policy in African countries

If the item IS relevant, respond with a JSON object:
{
  "relevant": true,
  "title": "A compelling article title based on this topic",
  "contentType": "authority",
  "briefSummary": "2-3 sentences on what this article would cover",
  "targetAngle": "The unique angle Kiuli would take",
  "destinations": ["List", "of", "destinations"],
  "properties": [],
  "species": ["List", "of", "species if applicable"],
  "competitiveNotes": "Why this matters for Kiuli's audience"
}

If the item is NOT relevant (general travel news, not Africa-focused, not safari-related, purely academic with no travel angle), respond with:
{"relevant": false}

Respond ONLY with valid JSON.`

async function parseRSSFeed(feedUrl: string): Promise<FeedItem[]> {
  const feed = await rssParser.parseURL(feedUrl)
  return (feed.items || []).map((item) => ({
    id: item.link || item.guid || item.title || '',
    title: item.title || '',
    url: item.link || '',
    publishedAt: item.pubDate || item.isoDate || '',
    summary: item.contentSnippet || item.content || '',
    category: item.categories?.[0] || '',
  }))
}

async function checkAPIEndpoint(apiUrl: string): Promise<FeedItem[]> {
  const response = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Kiuli Content Engine/1.0' },
  })
  if (!response.ok) {
    throw new Error(`API endpoint returned ${response.status}`)
  }
  const data = await response.json()
  const items = Array.isArray(data) ? data : data.items || data.results || []
  return items.map((item: Record<string, unknown>) => ({
    id: String(item.id || item.url || item.link || ''),
    title: String(item.title || ''),
    url: String(item.url || item.link || ''),
    publishedAt: String(item.publishedAt || item.published_at || item.pubDate || ''),
    summary: String(item.summary || item.description || ''),
    category: String(item.category || ''),
  }))
}

async function generateCandidateFromSource(
  item: FeedItem,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source: any,
): Promise<RawCandidate | null> {
  const userMessage = [
    `Feed source: ${source.name} (${source.category || 'general'})`,
    `Title: ${item.title}`,
    `URL: ${item.url}`,
    `Published: ${item.publishedAt}`,
    `Summary: ${item.summary}`,
  ].join('\n')

  try {
    const result = await callModel(
      'ideation',
      [
        { role: 'system', content: CANDIDATE_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      { maxTokens: 1024, temperature: 0.3 },
    )

    // Extract JSON from the response
    const jsonMatch = result.content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])
    if (!parsed.relevant) return null

    return {
      title: parsed.title || item.title,
      contentType: parsed.contentType || 'authority',
      briefSummary: parsed.briefSummary || item.summary,
      targetAngle: parsed.targetAngle || '',
      targetAudience: ['customer'],
      destinations: Array.isArray(parsed.destinations) ? parsed.destinations : [],
      properties: Array.isArray(parsed.properties) ? parsed.properties : [],
      species: Array.isArray(parsed.species) ? parsed.species : [],
      freshnessCategory: 'quarterly',
      competitiveNotes: parsed.competitiveNotes || '',
    }
  } catch (err) {
    console.warn(`[source-monitor] Failed to generate candidate for "${item.title}":`, err)
    return null
  }
}

async function embedBrief(
  projectId: number,
  candidate: RawCandidate,
): Promise<void> {
  const chunkText = [
    candidate.title,
    candidate.briefSummary,
    candidate.targetAngle,
    candidate.destinations.length > 0
      ? `Destinations: ${candidate.destinations.join(', ')}`
      : '',
    candidate.properties.length > 0
      ? `Properties: ${candidate.properties.join(', ')}`
      : '',
    candidate.species.length > 0
      ? `Species: ${candidate.species.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const chunk: ContentChunk = {
    id: `brief-${projectId}`,
    sourceCollection: 'content-projects',
    sourceId: String(projectId),
    sourceField: 'brief',
    chunkType: 'article_section',
    text: chunkText,
    metadata: {
      title: candidate.title,
      contentType: candidate.contentType,
      destinations: candidate.destinations,
      properties: candidate.properties,
      species: candidate.species,
      freshnessCategory: candidate.freshnessCategory,
      wordCount: chunkText.split(/\s+/).length,
    },
  }

  await embedChunks({ chunks: [chunk] })
}

export async function checkSources(
  options?: SourceMonitorOptions,
): Promise<SourceCheckResult[]> {
  const payload = await getPayload({ config: configPromise })

  // Build source query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { active: { equals: true } }
  if (options?.sourceIds && options.sourceIds.length > 0) {
    where.id = { in: options.sourceIds.map(Number) }
  }

  const sourcesResult = await payload.find({
    collection: 'source-registry',
    where,
    limit: 100,
    depth: 0,
  })

  const results: SourceCheckResult[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const source of sourcesResult.docs as any[]) {
    try {
      // 1. Fetch items from source
      let items: FeedItem[]
      if (source.checkMethod === 'api') {
        items = await checkAPIEndpoint(source.feedUrl)
      } else {
        items = await parseRSSFeed(source.feedUrl)
      }

      // 2. Deduplicate — only new items
      const recentIds: string[] = Array.isArray(source.recentProcessedIds)
        ? source.recentProcessedIds
        : (() => {
            try {
              return JSON.parse(source.recentProcessedIds || '[]')
            } catch {
              return []
            }
          })()

      const newItems = items.filter((item) => {
        if (recentIds.includes(item.id)) return false
        if (source.lastProcessedItemTimestamp && item.publishedAt) {
          try {
            return (
              new Date(item.publishedAt) >
              new Date(source.lastProcessedItemTimestamp)
            )
          } catch {
            return true
          }
        }
        return true
      })

      // 3. Limit to 10 per source per check
      const processItems = newItems.slice(0, 10)
      let projectsCreated = 0

      // 4. For each item: generate candidate, filter, create project
      for (const item of processItems) {
        const candidate = await generateCandidateFromSource(item, source)
        if (!candidate) continue

        // Filter using the same logic as ideation
        const rawWithPassed: FilteredCandidate[] = await filterCandidates({
          candidates: [candidate],
          payload,
        })

        if (rawWithPassed.length > 0 && rawWithPassed[0].passed) {
          // Create ContentProject at brief stage
          try {
            const slug = slugify(candidate.title)
            const created = await payload.create({
              collection: 'content-projects',
              data: {
                title: candidate.title,
                slug,
                stage: 'brief',
                contentType: candidate.contentType,
                originPathway: 'external',
                originSource: source.id,
                originUrl: item.url,
                targetCollection: 'posts',
                briefSummary: candidate.briefSummary,
                targetAngle: candidate.targetAngle,
                targetAudience: candidate.targetAudience,
                competitiveNotes: candidate.competitiveNotes,
                destinations: candidate.destinations,
                properties: candidate.properties,
                species: candidate.species,
                freshnessCategory: candidate.freshnessCategory,
              },
            })

            const createdId = (created as unknown as { id: number }).id
            projectsCreated++

            // Embed the brief (non-critical)
            await embedBrief(createdId, candidate).catch((err) => {
              console.warn(
                `[source-monitor] Failed to embed brief for project ${createdId}:`,
                err,
              )
            })
          } catch (err) {
            // Slug uniqueness conflict — try with suffix
            if (
              String(err).includes('unique') ||
              String(err).includes('duplicate')
            ) {
              try {
                const created = await payload.create({
                  collection: 'content-projects',
                  data: {
                    title: candidate.title,
                    slug: `${slugify(candidate.title)}-${Date.now()}`,
                    stage: 'brief',
                    contentType: candidate.contentType,
                    originPathway: 'external',
                    originSource: source.id,
                    originUrl: item.url,
                    targetCollection: 'posts',
                    briefSummary: candidate.briefSummary,
                    targetAngle: candidate.targetAngle,
                    targetAudience: candidate.targetAudience,
                    competitiveNotes: candidate.competitiveNotes,
                    destinations: candidate.destinations,
                    properties: candidate.properties,
                    species: candidate.species,
                    freshnessCategory: candidate.freshnessCategory,
                  },
                })
                const createdId = (created as unknown as { id: number }).id
                projectsCreated++
                await embedBrief(createdId, candidate).catch(() => {})
              } catch (retryErr) {
                console.error(
                  `[source-monitor] Failed to create project for "${candidate.title}":`,
                  retryErr,
                )
              }
            } else {
              console.error(
                `[source-monitor] Failed to create project for "${candidate.title}":`,
                err,
              )
            }
          }
        }
      }

      // 5. Update source deduplication fields
      const updatedRecentIds = [
        ...processItems.map((i) => i.id),
        ...recentIds,
      ].slice(0, 50)

      await payload.update({
        collection: 'source-registry',
        id: source.id,
        data: {
          lastCheckedAt: new Date().toISOString(),
          lastProcessedItemId:
            processItems[0]?.id ?? source.lastProcessedItemId,
          lastProcessedItemTimestamp:
            processItems[0]?.publishedAt ?? source.lastProcessedItemTimestamp,
          recentProcessedIds: updatedRecentIds,
        },
      })

      results.push({
        sourceId: source.id,
        sourceName: source.name,
        itemsFound: items.length,
        newItems: processItems.length,
        projectsCreated,
        error: null,
      })
    } catch (error) {
      results.push({
        sourceId: source.id,
        sourceName: source.name,
        itemsFound: 0,
        newItems: 0,
        projectsCreated: 0,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return results
}
