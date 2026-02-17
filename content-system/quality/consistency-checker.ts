import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { callModel } from '../openrouter-client'
import { semanticSearch } from '../embeddings/query'
import { extractTextFromLexical } from '../embeddings/lexical-text'
import type { ConsistencyResult, ConsistencyIssue } from './types'

export async function checkConsistency(projectId: number): Promise<ConsistencyResult> {
  const payload = await getPayload({ config: configPromise })
  const project = (await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  const contentType = project.contentType as string

  // ── Step 1: Extract text from draft ──────────────────────────────────────

  let draftText = ''

  const compoundTypes = new Set(['destination_page', 'property_page'])
  if (compoundTypes.has(contentType)) {
    // Extract from sections JSON
    if (project.sections && typeof project.sections === 'object') {
      const rawSections =
        typeof project.sections === 'string'
          ? JSON.parse(project.sections as string)
          : project.sections
      const parts: string[] = []
      for (const value of Object.values(rawSections as Record<string, unknown>)) {
        if (typeof value === 'string') {
          parts.push(value)
        } else {
          const extracted = extractTextFromLexical(value)
          if (extracted) parts.push(extracted)
        }
      }
      draftText = parts.join('\n\n')
    }
  } else {
    // Article types: extract from body (Lexical richText)
    if (project.body) {
      draftText = extractTextFromLexical(project.body)
    }
  }

  console.log(`[consistency-checker] Project ${projectId}: extracting text (${draftText.length} chars)`)

  if (!draftText || draftText.length < 100) {
    return { overallResult: 'pass', issues: [] }
  }

  // ── Step 2: Extract factual claims via LLM ──────────────────────────────

  let claims: Array<{ claim: string; category: string }> = []

  try {
    const claimResponse = await callModel(
      'editing',
      [
        {
          role: 'system',
          content: `You are a fact-checker for a luxury African safari travel company. Extract all factual claims from the following content. A factual claim is any statement that could be verified or contradicted — dates, distances, prices, names, counts, seasonal statements, access routes, lodge/property names, activity descriptions, wildlife behaviour, geographical facts.

Return a JSON array and NOTHING else (no markdown fences, no preamble):
[
  { "claim": "The exact factual claim", "category": "seasonal|geographical|wildlife|access|pricing|activity|property|other" }
]

If there are no factual claims, return an empty array: []`,
        },
        { role: 'user', content: draftText },
      ],
      { maxTokens: 2048, temperature: 0.2 },
    )

    claims = JSON.parse(claimResponse.content)
  } catch (error) {
    console.error(`[consistency-checker] Project ${projectId}: claim extraction parse error:`, error)
    return { overallResult: 'pass', issues: [] }
  }

  console.log(`[consistency-checker] Project ${projectId}: extracted ${claims.length} claims`)

  if (claims.length === 0) {
    return { overallResult: 'pass', issues: [] }
  }

  // ── Step 3: Search embeddings for related content ───────────────────────

  const claimsToSearch = claims.slice(0, 20)
  const relatedPairs: Array<{
    claim: { claim: string; category: string }
    relatedChunk: { chunkText: string; chunkType: string; id: string }
  }> = []
  const seenEmbeddingIds = new Set<string>()

  for (const claim of claimsToSearch) {
    const results = await semanticSearch(claim.claim, {
      topK: 3,
      minScore: 0.5,
      excludeProjectId: projectId,
    })

    for (const r of results) {
      if (!seenEmbeddingIds.has(r.id)) {
        seenEmbeddingIds.add(r.id)
        relatedPairs.push({
          claim,
          relatedChunk: { chunkText: r.chunkText, chunkType: r.chunkType, id: r.id },
        })
      }
    }
  }

  console.log(`[consistency-checker] Project ${projectId}: found ${relatedPairs.length} related chunks`)

  if (relatedPairs.length === 0) {
    return { overallResult: 'pass', issues: [] }
  }

  // ── Step 4: Detect contradictions via LLM ───────────────────────────────

  const claimsList = claimsToSearch
    .map((c, i) => `${i + 1}. [${c.category}] ${c.claim}`)
    .join('\n')
  const chunksList = relatedPairs
    .map((p, i) => `${i + 1}. [${p.relatedChunk.chunkType}] ${p.relatedChunk.chunkText}`)
    .join('\n\n')

  let rawIssues: Array<{
    issueType: 'hard' | 'soft' | 'staleness'
    newContent: string
    existingContent: string
    sourceRecord: string
  }> = []

  try {
    const contradictionResponse = await callModel(
      'editing',
      [
        {
          role: 'system',
          content: `You are a fact-checker for a luxury African safari travel company. Compare the NEW CLAIMS against EXISTING CONTENT and identify contradictions.

For each contradiction found, classify it:
- "hard": Directly conflicting facts (e.g., "best visited June-October" vs "November is the best month")
- "soft": Potentially conflicting tone or emphasis (e.g., "family-friendly" vs "adults-only atmosphere")
- "staleness": New content has more current information than existing (e.g., new content mentions a renovation that existing content doesn't reflect)

Return a JSON array and NOTHING else (no markdown fences, no preamble):
[
  {
    "issueType": "hard" | "soft" | "staleness",
    "newContent": "The specific claim from the new content",
    "existingContent": "The specific text from existing content that contradicts it",
    "sourceRecord": "A brief description of where the existing content comes from"
  }
]

If there are no contradictions, return an empty array: []
Be conservative — only flag genuine contradictions, not mere differences in detail or emphasis.`,
        },
        {
          role: 'user',
          content: `NEW CLAIMS:\n${claimsList}\n\nEXISTING CONTENT:\n${chunksList}`,
        },
      ],
      { maxTokens: 2048, temperature: 0.2 },
    )

    rawIssues = JSON.parse(contradictionResponse.content)
  } catch (error) {
    console.error(`[consistency-checker] Project ${projectId}: contradiction detection parse error:`, error)
    return { overallResult: 'pass', issues: [] }
  }

  // ── Step 5: Determine overall result and return ─────────────────────────

  const issues: ConsistencyIssue[] = rawIssues.map((raw) => ({
    issueType: raw.issueType,
    existingContent: raw.existingContent,
    newContent: raw.newContent,
    sourceRecord: raw.sourceRecord,
    resolution: 'pending' as const,
  }))

  let overallResult: ConsistencyResult['overallResult'] = 'pass'
  if (issues.some((i) => i.issueType === 'hard')) {
    overallResult = 'hard_contradiction'
  } else if (issues.some((i) => i.issueType === 'soft')) {
    overallResult = 'soft_contradiction'
  }

  console.log(
    `[consistency-checker] Project ${projectId}: detected ${issues.length} issues (result: ${overallResult})`,
  )

  // ── Step 5b: Generate page_update projects for staleness signals ──────

  const stalenessIssues = issues.filter(i => i.issueType === 'staleness')
  if (stalenessIssues.length > 0) {
    console.log(`[consistency-checker] Project ${projectId}: generating ${stalenessIssues.length} page_update project(s) for staleness`)

    for (const stale of stalenessIssues) {
      // Check if a page_update already exists for this specific staleness
      const existing = await payload.find({
        collection: 'content-projects',
        where: {
          contentType: { equals: 'page_update' },
          stage: { not_in: ['published', 'rejected', 'filtered'] },
          // Match by title pattern to avoid duplicates
          title: { contains: stale.sourceRecord.slice(0, 50) },
        },
        limit: 1,
      })

      if (existing.docs.length === 0) {
        await payload.create({
          collection: 'content-projects',
          data: {
            title: `Update: ${stale.sourceRecord}`.slice(0, 200),
            contentType: 'page_update',
            stage: 'proposed',
            processingStatus: 'idle',
            originPathway: 'cascade',
            briefSummary: `[Staleness from project ${projectId}] Existing content may be outdated. New content states: "${stale.newContent}". Existing content: "${stale.existingContent}". Source: ${stale.sourceRecord}.`,
          },
        })
      }
    }
  }

  return { overallResult, issues }
}
