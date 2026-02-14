import type { Payload } from 'payload'
import type { RawCandidate, FilteredCandidate } from './types'
import { semanticSearch } from '../embeddings/query'

interface FilterCandidatesOptions {
  candidates: RawCandidate[]
  payload: Payload
}

export async function filterCandidates(
  options: FilterCandidatesOptions,
): Promise<FilteredCandidate[]> {
  const { candidates, payload } = options

  // Load active editorial directives
  const directivesResult = await payload.find({
    collection: 'editorial-directives',
    where: { active: { equals: true } },
    limit: 100,
    depth: 0,
  })
  const directives = directivesResult.docs as unknown as Array<Record<string, unknown>>

  const results: FilteredCandidate[] = []

  for (const candidate of candidates) {
    const filtered: FilteredCandidate = {
      ...candidate,
      passed: true,
      directivesMatched: [],
      duplicateScore: 0,
    }

    // Check 1: Editorial Directives (short-circuit on first match)
    const directiveResult = checkDirectives(candidate, directives)
    if (directiveResult) {
      filtered.passed = false
      filtered.filterReason = directiveResult.reason
      filtered.directivesMatched = directiveResult.matched

      // Fire-and-forget: increment filterCount30d for matched directives
      for (const directiveId of directiveResult.matchedIds) {
        incrementDirectiveCount(payload, directiveId).catch(() => {})
      }

      results.push(filtered)
      continue
    }

    // Check 2: Embedding Duplicate Check
    try {
      const searchResults = await semanticSearch(
        candidate.title + ' ' + candidate.briefSummary,
        { topK: 3, minScore: 0.7 },
      )

      if (searchResults.length > 0 && searchResults[0].score > 0.85) {
        filtered.passed = false
        filtered.duplicateScore = searchResults[0].score
        filtered.duplicateTitle = searchResults[0].chunkText.substring(0, 100)
        filtered.filterReason = `Too similar to existing content: "${filtered.duplicateTitle}..." (score: ${searchResults[0].score.toFixed(3)})`
        results.push(filtered)
        continue
      }

      // Record the score even if it passes
      if (searchResults.length > 0) {
        filtered.duplicateScore = searchResults[0].score
      }
    } catch (err) {
      console.warn('[candidate-filter] Embedding search failed, skipping duplicate check:', err)
    }

    // Check 3: Existing ContentProject Check
    try {
      const existing = await payload.find({
        collection: 'content-projects',
        where: {
          title: { equals: candidate.title },
          stage: { not_equals: 'filtered' },
        },
        limit: 1,
        depth: 0,
      })

      if (existing.docs.length > 0) {
        const doc = existing.docs[0] as unknown as { id: number; title: string }
        filtered.passed = false
        filtered.filterReason = `ContentProject already exists: "${doc.title}" (ID: ${doc.id})`
        results.push(filtered)
        continue
      }
    } catch (err) {
      console.warn('[candidate-filter] ContentProject check failed:', err)
    }

    results.push(filtered)
  }

  return results
}

interface DirectiveCheckResult {
  reason: string
  matched: string[]
  matchedIds: number[]
}

function checkDirectives(
  candidate: RawCandidate,
  directives: Array<Record<string, unknown>>,
): DirectiveCheckResult | null {
  const matched: string[] = []
  const matchedIds: number[] = []

  for (const directive of directives) {
    const destinationTags = parseJsonArray(directive.destinationTags)
    const contentTypeTags = parseJsonArray(directive.contentTypeTags)
    const topicTags = parseJsonArray(directive.topicTags)

    // Each dimension that has tags must match (AND logic across dimensions)
    let dimensionsTested = 0
    let dimensionsMatched = 0

    // Destination dimension
    if (destinationTags.length > 0) {
      dimensionsTested++
      const candidateDests = candidate.destinations.map((d) => d.toLowerCase())
      const hasOverlap = destinationTags.some((tag) =>
        candidateDests.some((d) => d.includes(tag.toLowerCase())),
      )
      if (hasOverlap) dimensionsMatched++
    }

    // Content type dimension
    if (contentTypeTags.length > 0) {
      dimensionsTested++
      if (contentTypeTags.some((tag) => tag.toLowerCase() === candidate.contentType.toLowerCase())) {
        dimensionsMatched++
      }
    }

    // Topic dimension (keyword check in title + briefSummary)
    if (topicTags.length > 0) {
      dimensionsTested++
      const text = (candidate.title + ' ' + candidate.briefSummary).toLowerCase()
      const hasTopicMatch = topicTags.some((tag) => text.includes(tag.toLowerCase()))
      if (hasTopicMatch) dimensionsMatched++
    }

    // ALL applicable dimensions must match
    if (dimensionsTested > 0 && dimensionsTested === dimensionsMatched) {
      matched.push(directive.text as string)
      matchedIds.push(directive.id as number)
    }
  }

  if (matched.length > 0) {
    return {
      reason: `Filtered by directive: ${matched[0]}`,
      matched,
      matchedIds,
    }
  }

  return null
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v: unknown) => typeof v === 'string')
    } catch {
      // not valid JSON
    }
  }
  return []
}

async function incrementDirectiveCount(payload: Payload, directiveId: number): Promise<void> {
  try {
    const directive = await payload.findByID({
      collection: 'editorial-directives',
      id: directiveId,
      depth: 0,
    })
    const currentCount = ((directive as unknown as Record<string, unknown>).filterCount30d as number) || 0
    await payload.update({
      collection: 'editorial-directives',
      id: directiveId,
      data: { filterCount30d: currentCount + 1 },
    })
  } catch {
    // Non-critical — don't fail the pipeline
  }
}
