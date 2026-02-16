import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { callModel } from '../openrouter-client'
import { semanticSearch } from '../embeddings/query'
import { loadFullVoice } from '../voice/loader'
import { buildVoicePrompt } from '../voice/prompt-builder'
import type { VoiceContext, SectionGuidanceEntry } from '../voice/loader'

const DESTINATION_SECTIONS = [
  'overview',
  'when_to_visit',
  'why_choose',
  'key_experiences',
  'getting_there',
  'health_safety',
  'investment_expectation',
  'top_lodges',
  'faq',
]

export async function draftDestinationPage(projectId: number): Promise<void> {
  const payload = await getPayload({ config: configPromise })

  // 1. Fetch project
  const project = (await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  // 2. Validate
  if (project.contentType !== 'destination_page') {
    throw new Error(`Destination page drafter got contentType: ${project.contentType}`)
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
    // 4. Load full voice (Layers 1+2+3)
    const voice = await loadFullVoice('destination_page')

    // 5. Extract project context
    const title = project.title as string
    const destinations = parseJsonArray(project.destinations) || [title]
    const properties = parseJsonArray(project.properties) || []
    const briefSummary = (project.briefSummary as string) || ''
    const targetAngle = (project.targetAngle as string) || ''
    const destinationName = destinations[0] || title

    // 6. Load editorial directives
    let directives = ''
    try {
      const dirResult = await payload.find({
        collection: 'editorial-directives',
        where: { active: { equals: true } },
        limit: 50,
        depth: 0,
      })
      if (dirResult.docs.length > 0) {
        directives = dirResult.docs
          .map((d) => `- ${(d as unknown as Record<string, unknown>).text}`)
          .join('\n')
      }
    } catch (err) {
      console.warn('[destination-drafter] Directive load failed:', err)
    }

    // 7. Draft each section
    const sections: Record<string, string> = {}
    const faqItems: Array<{ question: string; answer: string }> = []

    for (const sectionKey of DESTINATION_SECTIONS) {
      console.log(`[destination-drafter] Drafting section: ${sectionKey} for "${destinationName}"`)

      const sectionContent = await draftSection(
        voice,
        sectionKey,
        destinationName,
        destinations,
        properties,
        briefSummary,
        targetAngle,
        directives,
        projectId,
      )

      if (sectionKey === 'faq') {
        // Parse FAQ section into structured items
        const parsed = parseFaqFromText(sectionContent)
        for (const item of parsed) {
          faqItems.push(item)
        }
        sections[sectionKey] = sectionContent
      } else {
        sections[sectionKey] = sectionContent
      }
    }

    // 8. Generate meta fields
    const meta = await generateMeta(voice, destinationName, sections, projectId)

    // 9. Write to project
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        sections,
        faqSection: faqItems.length > 0 ? faqItems : undefined,
        metaTitle: meta.metaTitle,
        metaDescription: meta.metaDescription,
        answerCapsule: meta.answerCapsule,
        processingStatus: 'completed',
        processingError: null,
      },
    })

    console.log(`[destination-drafter] Successfully drafted destination page for project ${projectId}`)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[destination-drafter] Failed for project ${projectId}:`, errorMessage)

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

async function draftSection(
  voice: VoiceContext,
  sectionKey: string,
  destinationName: string,
  destinations: string[],
  properties: string[],
  briefSummary: string,
  targetAngle: string,
  directives: string,
  projectId: number,
): Promise<string> {
  // Find section guidance
  const sectionGuidance = voice.sections?.find((s) => s.sectionKey === sectionKey)

  // Build section-specific voice context for the prompt
  const sectionVoice: VoiceContext = {
    core: voice.core,
    contentType: voice.contentType,
    sections: sectionGuidance ? [sectionGuidance] : [],
  }
  const voicePrompt = buildVoicePrompt(sectionVoice)

  // Query embedding store for section-relevant content
  const searchTerms = buildSectionSearchQuery(sectionKey, destinationName, destinations)
  let embeddingContext = ''
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
    console.warn(`[destination-drafter] Embedding search failed for ${sectionKey}:`, err)
  }

  // Build system prompt
  const systemParts: string[] = [
    `You are writing the "${sectionGuidance?.sectionLabel || sectionKey}" section for the ${destinationName} destination page on Kiuli's luxury safari website.`,
    voicePrompt,
  ]

  if (briefSummary) systemParts.push(`PAGE BRIEF:\n${briefSummary}`)
  if (targetAngle) systemParts.push(`ANGLE:\n${targetAngle}`)
  if (properties.length > 0) systemParts.push(`KEY PROPERTIES: ${properties.join(', ')}`)
  if (embeddingContext) systemParts.push(`EXISTING KIULI CONTENT (for consistency):\n${embeddingContext}`)
  if (directives) systemParts.push(`EDITORIAL DIRECTIVES:\n${directives}`)

  const systemPrompt = systemParts.join('\n\n')

  // Build user prompt
  let userPrompt: string
  if (sectionGuidance?.promptTemplate) {
    userPrompt = sectionGuidance.promptTemplate
      .replace(/\{\{destination\}\}/g, destinationName)
      .replace(/\{\{context\}\}/g, embeddingContext || 'No additional context available')
      .replace(/\{\{properties\}\}/g, properties.join(', ') || 'Not specified')
  } else {
    userPrompt = `Write the ${sectionGuidance?.sectionLabel || sectionKey} section for the ${destinationName} destination page.`
    if (sectionGuidance?.wordCountRange) {
      userPrompt += `\n\nTarget length: ${sectionGuidance.wordCountRange} words.`
    }
    userPrompt += `\n\nReturn ONLY the section content, no explanations or section headers.`
  }

  // Call model
  const temperature = voice.contentType?.temperature ?? 0.6
  const result = await callModel('drafting', [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    maxTokens: 2048,
    temperature,
  })

  return result.content.trim()
}

async function generateMeta(
  voice: VoiceContext,
  destinationName: string,
  sections: Record<string, string>,
  projectId: number,
): Promise<{ metaTitle: string; metaDescription: string; answerCapsule: string }> {
  const overview = sections.overview || ''

  const systemPrompt = `You are writing SEO metadata for the ${destinationName} destination page on Kiuli's luxury safari website. You write with quiet confidence and specificity.`

  const userPrompt = `Based on this page overview:

${overview.substring(0, 1000)}

Generate a JSON object with NOTHING else:

{
  "metaTitle": "SEO title, max 60 chars. Include destination name and 'Safari' or 'Travel Guide'",
  "metaDescription": "SEO description, max 160 chars. Compelling, specific, includes destination name",
  "answerCapsule": "50-70 word direct answer to 'What is a safari in ${destinationName} like?' — optimised for AI Overview"
}`

  const result = await callModel('drafting', [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    maxTokens: 512,
    temperature: 0.3,
  })

  let text = result.content.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  const parsed = JSON.parse(text)
  return {
    metaTitle: String(parsed.metaTitle || '').substring(0, 60),
    metaDescription: String(parsed.metaDescription || '').substring(0, 160),
    answerCapsule: String(parsed.answerCapsule || ''),
  }
}

function buildSectionSearchQuery(sectionKey: string, destinationName: string, destinations: string[]): string {
  const base = destinations.join(' ')
  const sectionTerms: Record<string, string> = {
    overview: `${base} safari overview`,
    when_to_visit: `${destinationName} best time visit season`,
    why_choose: `${destinationName} safari why choose vs`,
    key_experiences: `${destinationName} safari experiences activities`,
    getting_there: `${destinationName} flights transfer logistics`,
    health_safety: `${destinationName} health safety malaria visa`,
    investment_expectation: `${destinationName} safari cost price per night`,
    top_lodges: `${destinationName} best lodges camps properties`,
    faq: `${destinationName} safari frequently asked questions`,
  }
  return sectionTerms[sectionKey] || `${destinationName} safari ${sectionKey}`
}

function parseFaqFromText(text: string): Array<{ question: string; answer: string }> {
  const items: Array<{ question: string; answer: string }> = []

  // Try JSON parse first (model may return structured)
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      return parsed.map((f: Record<string, unknown>) => ({
        question: String(f.question || ''),
        answer: String(f.answer || ''),
      }))
    }
  } catch { /* not JSON, parse as text */ }

  // Parse Q&A patterns from text
  const lines = text.split('\n')
  let currentQuestion = ''
  let currentAnswer: string[] = []

  for (const line of lines) {
    const qMatch = line.match(/^\*?\*?Q[:.]?\*?\*?\s*(.+)/i) || line.match(/^(?:\d+\.\s*)?(?:\*\*)?(.+\?)\s*(?:\*\*)?$/)
    if (qMatch) {
      if (currentQuestion && currentAnswer.length > 0) {
        items.push({
          question: currentQuestion,
          answer: currentAnswer.join(' ').trim(),
        })
      }
      currentQuestion = qMatch[1].replace(/\*\*/g, '').trim()
      currentAnswer = []
    } else {
      const aMatch = line.match(/^\*?\*?A[:.]?\*?\*?\s*(.+)/i)
      if (aMatch) {
        currentAnswer.push(aMatch[1].trim())
      } else if (currentQuestion && line.trim()) {
        currentAnswer.push(line.trim())
      }
    }
  }

  // Flush last item
  if (currentQuestion && currentAnswer.length > 0) {
    items.push({
      question: currentQuestion,
      answer: currentAnswer.join(' ').trim(),
    })
  }

  return items
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
