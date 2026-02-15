import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { extractTextFromLexical } from '../embeddings/lexical-text'
import { semanticSearch } from '../embeddings/query'
import type {
  ContextBuilderOptions,
  ConversationContext,
  ConversationMessage,
} from './types'

function parseJsonArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v: unknown) => typeof v === 'string')
    } catch {
      // not JSON
    }
  }
  return undefined
}

export async function buildContext(
  options: ContextBuilderOptions,
): Promise<ConversationContext> {
  const { projectId, maxMessages = 20 } = options

  const payload = await getPayload({ config: configPromise })

  const project = (await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  // Extract plain text from richText fields
  const synthesisText = project.synthesis
    ? extractTextFromLexical(project.synthesis)
    : undefined

  const draftText = project.body
    ? extractTextFromLexical(project.body)
    : undefined

  // Format sources
  const sources = Array.isArray(project.sources) ? project.sources : []
  const sourcesSummary =
    sources.length > 0
      ? sources
          .map(
            (s: Record<string, unknown>) =>
              `- ${s.title} (${s.credibility}): ${s.url}`,
          )
          .join('\n')
      : undefined

  // Extract sections for compound types
  let sections: Record<string, string> | undefined
  if (project.sections && typeof project.sections === 'object') {
    sections = {}
    const rawSections =
      typeof project.sections === 'string'
        ? JSON.parse(project.sections as string)
        : project.sections
    for (const [key, value] of Object.entries(
      rawSections as Record<string, unknown>,
    )) {
      sections[key] =
        typeof value === 'string' ? value : extractTextFromLexical(value)
    }
  }

  // Parse FAQ items
  const rawFaq = Array.isArray(project.faqSection) ? project.faqSection : []
  const faqItems = rawFaq.map((f: Record<string, unknown>) => ({
    question: (f.question as string) || '',
    answer: (f.answer as string) || '',
  }))

  // Parse metadata arrays
  const destinations = parseJsonArray(project.destinations)
  const properties = parseJsonArray(project.properties)
  const species = parseJsonArray(project.species)

  // Query embedding store for related content
  const searchQuery = [
    project.title,
    project.targetAngle,
    ...(destinations || []),
  ]
    .filter(Boolean)
    .join(' ')
  let relatedContent: string | undefined
  if (searchQuery) {
    try {
      const results = await semanticSearch(searchQuery, {
        topK: 5,
        minScore: 0.3,
        excludeProjectId: projectId,
      })
      if (results.length > 0) {
        relatedContent = results
          .map(
            (r) =>
              `[${r.chunkType}] (score: ${r.score.toFixed(2)}) ${r.chunkText.substring(0, 300)}`,
          )
          .join('\n\n')
      }
    } catch (err) {
      console.warn('[context-builder] Embedding search failed:', err)
    }
  }

  // Load active editorial directives
  let activeDirectives: string | undefined
  try {
    const dirResult = await payload.find({
      collection: 'editorial-directives',
      where: { active: { equals: true } },
      limit: 50,
      depth: 0,
    })
    if (dirResult.docs.length > 0) {
      activeDirectives = dirResult.docs
        .map((d) => `- ${(d as unknown as Record<string, unknown>).text}`)
        .join('\n')
    }
  } catch (err) {
    console.warn('[context-builder] Directive load failed:', err)
  }

  // Extract recent messages
  const allMessages = Array.isArray(project.messages) ? project.messages : []
  const recentMessages: ConversationMessage[] = allMessages
    .slice(-maxMessages)
    .map((m: Record<string, unknown>) => ({
      role: m.role as 'designer' | 'kiuli',
      content: m.content as string,
      timestamp: m.timestamp as string,
      actions: m.actions
        ? typeof m.actions === 'string'
          ? JSON.parse(m.actions as string)
          : m.actions
        : undefined,
    }))

  return {
    projectId,
    title: project.title as string,
    stage: project.stage as string,
    contentType: project.contentType as string,
    briefSummary: project.briefSummary as string | undefined,
    targetAngle: project.targetAngle as string | undefined,
    competitiveNotes: project.competitiveNotes as string | undefined,
    synthesisText,
    sourcesSummary,
    draftText,
    sections,
    faqItems: faqItems.length > 0 ? faqItems : undefined,
    metaTitle: project.metaTitle as string | undefined,
    metaDescription: project.metaDescription as string | undefined,
    answerCapsule: project.answerCapsule as string | undefined,
    destinations,
    properties,
    species,
    relatedContent,
    activeDirectives,
    recentMessages,
  }
}
