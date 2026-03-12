import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { callModel } from '../openrouter-client'
import { semanticSearch } from '../embeddings/query'
import { loadVoiceForSection } from '../voice/loader'
import { buildVoicePrompt } from '../voice/prompt-builder'
import { markdownToLexical } from '../conversation/lexical-utils'

export async function enhanceSegment(projectId: number): Promise<void> {
  const payload = await getPayload({ config: configPromise })

  // 1. Fetch project
  const project = (await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  // 2. Validate
  if (project.contentType !== 'itinerary_enhancement') {
    throw new Error(`Segment enhancer got contentType: ${project.contentType}`)
  }

  // 3. Set processing status
  await payload.update({
    collection: 'content-projects',
    id: projectId,
    data: {
      processingStatus: 'processing',
      processingStartedAt: new Date().toISOString(),
      processingError: null,
    },
  })

  try {
    // 4. Load voice for segment description
    const voice = await loadVoiceForSection('itinerary_enhancement', 'segment_description')
    const voicePrompt = buildVoicePrompt(voice)

    // 5. Extract context
    const title = project.title as string
    const properties = parseJsonArray(project.properties) || []
    const destinations = parseJsonArray(project.destinations) || []
    const briefSummary = (project.briefSummary as string) || ''

    // 6. Query embedding store for related content about this property/destination
    const searchTerms = [...properties, ...destinations, title].filter(Boolean).join(' ')
    let embeddingContext = ''
    if (searchTerms) {
      try {
        const results = await semanticSearch(searchTerms, {
          topK: 8,
          minScore: 0.25,
          excludeProjectId: projectId,
        })
        if (results.length > 0) {
          embeddingContext = results
            .map((r) => `[${r.chunkType}] ${r.chunkText.substring(0, 400)}`)
            .join('\n\n')
        }
      } catch (err) {
        console.warn('[segment-enhancer] Embedding search failed:', err)
      }
    }

    // 7. Build prompts
    const systemParts: string[] = [
      `You are enhancing an itinerary segment description for Kiuli's luxury safari website.`,
      voicePrompt,
    ]

    if (briefSummary) systemParts.push(`CONTEXT:\n${briefSummary}`)
    if (properties.length > 0) systemParts.push(`PROPERTY: ${properties.join(', ')}`)
    if (destinations.length > 0) systemParts.push(`DESTINATION: ${destinations.join(', ')}`)
    if (embeddingContext) systemParts.push(`EXISTING KIULI CONTENT:\n${embeddingContext}`)

    const systemPrompt = systemParts.join('\n\n')

    const userPrompt = `Enhance this itinerary segment description.

TITLE: ${title}
${briefSummary ? `BRIEF: ${briefSummary}` : ''}

Write a compelling, specific description of 100-200 words that sells this component of the journey.

Return ONLY the enhanced description, no explanations.`

    // 8. Call model
    const temperature = voice.contentType?.temperature ?? 0.7
    const result = await callModel('drafting', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      maxTokens: 1024,
      temperature,
    })

    // 9. Write to project body
    const lexicalBody = markdownToLexical(result.content.trim())

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        body: lexicalBody,
        processingStatus: 'completed',
        processingError: null,
        stage: 'draft',
      },
    })

    console.log(`[segment-enhancer] Successfully enhanced segment for project ${projectId}`)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[segment-enhancer] Failed for project ${projectId}:`, errorMessage)

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        processingStatus: 'failed',
        processingError: errorMessage,
      },
    })

    throw err
  }
}

function parseJsonArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v: unknown) => typeof v === 'string')
    } catch { /* not JSON */ }
  }
  return undefined
}
