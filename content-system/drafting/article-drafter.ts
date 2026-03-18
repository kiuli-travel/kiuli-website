import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { callModel } from '../openrouter-client'
import { extractTextFromLexical } from '../embeddings/lexical-text'
import { semanticSearch } from '../embeddings/query'
import { loadVoiceForContentType } from '../voice/loader'
import { buildVoicePrompt } from '../voice/prompt-builder'
import { markdownToLexical } from '../conversation/lexical-utils'
import type { ArticleDraftOutput } from './types'

const VALID_CONTENT_TYPES = ['itinerary_cluster', 'authority', 'designer_insight']
const VALID_STAGES = ['research', 'draft', 'brief']

export async function draftArticle(projectId: number): Promise<void> {
  const payload = await getPayload({ config: configPromise })

  // 1. Fetch project
  const project = (await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  // 2. Validate
  const contentType = project.contentType as string
  const stage = project.stage as string

  if (!VALID_CONTENT_TYPES.includes(contentType)) {
    throw new Error(`Article drafter cannot handle contentType: ${contentType}`)
  }
  if (!VALID_STAGES.includes(stage)) {
    throw new Error(`Article drafter requires stage research, draft, or brief — got: ${stage}`)
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
    // 4. Load voice context
    const voice = await loadVoiceForContentType(contentType)
    const voicePrompt = buildVoicePrompt(voice)

    // 5. Extract project context
    const briefSummary = (project.briefSummary as string) || ''
    const targetAngle = (project.targetAngle as string) || ''
    const competitiveNotes = (project.competitiveNotes as string) || ''
    const synthesisText = project.synthesis
      ? extractTextFromLexical(project.synthesis)
      : ''

    const sources = Array.isArray(project.sources) ? project.sources : []
    const sourcesSummary = sources
      .map((s: Record<string, unknown>) =>
        `- ${s.title} (${s.credibility}): ${s.url}${s.notes ? ` — ${s.notes}` : ''}`,
      )
      .join('\n')

    const proprietaryAngles = Array.isArray(project.proprietaryAngles)
      ? project.proprietaryAngles
          .map((a: Record<string, unknown>) => `- ${a.angle} (source: ${a.source})`)
          .join('\n')
      : ''

    // 6. Query embedding store for related content
    const title = project.title as string
    const destinations = parseJsonArray(project.destinations)
    const searchQuery = [title, targetAngle, ...(destinations || [])].filter(Boolean).join(' ')

    let relatedContent = ''
    if (searchQuery) {
      try {
        const results = await semanticSearch(searchQuery, {
          topK: 10,
          minScore: 0.3,
          excludeProjectId: projectId,
        })
        if (results.length > 0) {
          relatedContent = results
            .map((r) => `[${r.chunkType}] ${r.chunkText.substring(0, 400)}`)
            .join('\n\n')
        }
      } catch (err) {
        console.warn('[article-drafter] Embedding search failed:', err)
      }
    }

    // 7. Load editorial directives
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
      console.warn('[article-drafter] Directive load failed:', err)
    }

    // 8. Build system prompt
    const systemParts: string[] = [
      `You are drafting an article for Kiuli's luxury safari website.`,
      voicePrompt,
    ]

    if (briefSummary) systemParts.push(`BRIEF:\n${briefSummary}`)
    if (targetAngle) systemParts.push(`TARGET ANGLE:\n${targetAngle}`)
    if (competitiveNotes) systemParts.push(`COMPETITIVE NOTES:\n${competitiveNotes}`)
    if (synthesisText) systemParts.push(`RESEARCH SYNTHESIS:\n${synthesisText}`)
    if (sourcesSummary) systemParts.push(`SOURCES:\n${sourcesSummary}`)
    if (proprietaryAngles) systemParts.push(`PROPRIETARY ANGLES:\n${proprietaryAngles}`)
    if (relatedContent) systemParts.push(`EXISTING KIULI CONTENT (for consistency, do not contradict):\n${relatedContent}`)
    if (directives) systemParts.push(`EDITORIAL DIRECTIVES (must respect):\n${directives}`)

    const systemPrompt = systemParts.join('\n\n')

    // 9. Build user prompt
    const userPrompt = `Write a complete article based on the brief and research above.

TITLE: ${title}

Return a JSON object with these fields and NOTHING else (no markdown fences, no preamble):

{
  "body": "Full article body in markdown format. Use ## for H2 headings, ### for H3. Write substantive paragraphs, not bullet lists.",
  "faqSection": [
    { "question": "...", "answer": "..." }
  ],
  "metaTitle": "SEO meta title, max 60 characters",
  "metaDescription": "SEO meta description, max 160 characters",
  "answerCapsule": "Direct answer to the article's central question, 50-70 words. Optimised for AI Overview extraction."
}

REQUIREMENTS:
- Body must be 800-1,200 words. Be punchy. Cut ruthlessly. Every sentence must earn its place.
- Do NOT include research statistics, F1-scores, technical jargon, or academic citations. Write for affluent travelers, not researchers.
- Do NOT pad with filler. If a section doesn't add value for someone deciding whether to book a $40,000+ safari, cut it.
- FAQ section must have 5-7 questions with answers of 30-50 words each. Direct, practical answers only.
- Answer capsule must directly answer the implied search query in 40-60 words.
- Do NOT include [IMAGE: ...] placeholders. Images will be added separately.
- Include [LINK: destination-slug] placeholders where relevant itineraries or destinations should be linked.
- Do not use any banned phrases from the voice guidelines.
- Every claim must be supportable from the research provided.
- Tone: confident, understated luxury. Like a knowledgeable friend who happens to know Africa intimately. Not a brochure. Not a textbook.`

    // 10. Call model
    const temperature = voice.contentType?.temperature ?? 0.5
    const result = await callModel('drafting', [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      maxTokens: 8192,
      temperature,
    })

    // 11. Parse response
    const output = parseArticleOutput(result.content)

    // 12. Convert body to Lexical
    const lexicalBody = markdownToLexical(output.body)

    // 13. Write to project
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        body: lexicalBody,
        faqSection: output.faqSection,
        metaTitle: output.metaTitle,
        metaDescription: output.metaDescription,
        answerCapsule: output.answerCapsule,
        processingStatus: 'completed',
        processingError: null,
        stage: 'draft',
      },
    })

    console.log(`[article-drafter] Successfully drafted article for project ${projectId}`)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[article-drafter] Failed for project ${projectId}:`, errorMessage)

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

function parseArticleOutput(raw: string): ArticleDraftOutput {
  let text = raw.trim()

  // Strip markdown fences
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  console.log(`[article-drafter] Raw LLM response (${text.length} chars):`, text.substring(0, 500))

  const parsed = JSON.parse(text)

  // Validate body
  if (!parsed.body || typeof parsed.body !== 'string') {
    throw new Error('Article draft missing body field')
  }
  if (parsed.body.length < 500) {
    throw new Error(`Article draft body too short: ${parsed.body.length} chars (minimum 500)`)
  }

  // Validate FAQ
  if (!Array.isArray(parsed.faqSection) || parsed.faqSection.length < 5) {
    throw new Error(`Article draft has ${Array.isArray(parsed.faqSection) ? parsed.faqSection.length : 0} FAQ items (minimum 5)`)
  }
  for (let i = 0; i < parsed.faqSection.length; i++) {
    const f = parsed.faqSection[i]
    if (!f.question || typeof f.question !== 'string' || f.question.trim().length === 0) {
      throw new Error(`FAQ item ${i} has empty question`)
    }
    if (!f.answer || typeof f.answer !== 'string' || f.answer.trim().length === 0) {
      throw new Error(`FAQ item ${i} has empty answer`)
    }
  }

  // Validate meta fields
  if (!parsed.metaTitle || typeof parsed.metaTitle !== 'string' || parsed.metaTitle.trim().length === 0) {
    throw new Error('Article draft missing metaTitle')
  }
  if (!parsed.metaDescription || typeof parsed.metaDescription !== 'string' || parsed.metaDescription.trim().length === 0) {
    throw new Error('Article draft missing metaDescription')
  }
  if (!parsed.answerCapsule || typeof parsed.answerCapsule !== 'string' || parsed.answerCapsule.trim().length === 0) {
    throw new Error('Article draft missing answerCapsule')
  }

  return {
    body: parsed.body,
    faqSection: parsed.faqSection.map((f: Record<string, unknown>) => ({
      question: String(f.question).trim(),
      answer: String(f.answer).trim(),
    })),
    metaTitle: String(parsed.metaTitle).trim().substring(0, 60),
    metaDescription: String(parsed.metaDescription).trim().substring(0, 160),
    answerCapsule: String(parsed.answerCapsule).trim(),
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
