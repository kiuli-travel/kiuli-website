import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { callModel } from '../openrouter-client'
import { semanticSearch } from '../embeddings/query'
import { loadFullVoice } from '../voice/loader'
import { buildVoicePrompt } from '../voice/prompt-builder'
import type { VoiceContext } from '../voice/loader'

const PROPERTY_SECTIONS = ['overview', 'faq']

export async function draftPropertyPage(projectId: number): Promise<void> {
  const payload = await getPayload({ config: configPromise })

  // 1. Fetch project
  const project = (await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  })) as unknown as Record<string, unknown>

  // 2. Validate
  if (project.contentType !== 'property_page') {
    throw new Error(`Property page drafter got contentType: ${project.contentType}`)
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
    // 4. Load full voice
    const voice = await loadFullVoice('property_page')

    // 5. Extract project context
    const title = project.title as string
    const properties = parseJsonArray(project.properties) || [title]
    const destinations = parseJsonArray(project.destinations) || []
    const briefSummary = (project.briefSummary as string) || ''
    const propertyName = properties[0] || title

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
      console.warn('[property-drafter] Directive load failed:', err)
    }

    // 7. Query embedding store for property-specific content (itinerary segments, etc.)
    let embeddingContext = ''
    try {
      const results = await semanticSearch(`${propertyName} lodge camp safari`, {
        topK: 10,
        minScore: 0.25,
        excludeProjectId: projectId,
      })
      if (results.length > 0) {
        embeddingContext = results
          .map((r) => `[${r.chunkType}] ${r.chunkText.substring(0, 400)}`)
          .join('\n\n')
      }
    } catch (err) {
      console.warn('[property-drafter] Embedding search failed:', err)
    }

    // 8. Draft each section
    const sections: Record<string, string> = {}
    const faqItems: Array<{ question: string; answer: string }> = []

    for (const sectionKey of PROPERTY_SECTIONS) {
      console.log(`[property-drafter] Drafting section: ${sectionKey} for "${propertyName}"`)

      const sectionGuidance = voice.sections?.find((s) => s.sectionKey === sectionKey)
      const sectionVoice: VoiceContext = {
        core: voice.core,
        contentType: voice.contentType,
        sections: sectionGuidance ? [sectionGuidance] : [],
      }
      const voicePrompt = buildVoicePrompt(sectionVoice)

      const systemParts: string[] = [
        `You are writing the "${sectionGuidance?.sectionLabel || sectionKey}" section for the ${propertyName} property page on Kiuli's luxury safari website.`,
        voicePrompt,
      ]

      if (briefSummary) systemParts.push(`PAGE BRIEF:\n${briefSummary}`)
      if (destinations.length > 0) systemParts.push(`DESTINATION: ${destinations.join(', ')}`)
      if (embeddingContext) systemParts.push(`EXISTING KIULI CONTENT ABOUT THIS PROPERTY:\n${embeddingContext}`)
      if (directives) systemParts.push(`EDITORIAL DIRECTIVES:\n${directives}`)

      const systemPrompt = systemParts.join('\n\n')

      let userPrompt: string
      if (sectionKey === 'faq') {
        userPrompt = `Write 6-8 FAQ items for the ${propertyName} property page. Cover: room types, dining, activities, children, connectivity, accessibility.

Return a JSON array and NOTHING else:
[{ "question": "...", "answer": "..." }]

Each answer should be 40-80 words, direct and specific to this property.`
      } else {
        userPrompt = `Write the ${sectionGuidance?.sectionLabel || sectionKey} section for the ${propertyName} property page.`
        if (sectionGuidance?.wordCountRange) {
          userPrompt += `\n\nTarget length: ${sectionGuidance.wordCountRange} words.`
        }
        userPrompt += `\n\nReturn ONLY the section content, no explanations or section headers.`
      }

      const result = await callModel('drafting', [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], {
        maxTokens: 2048,
        temperature: voice.contentType?.temperature ?? 0.6,
      })

      const content = result.content.trim()
      sections[sectionKey] = content

      if (sectionKey === 'faq') {
        try {
          let faqText = content
          if (faqText.startsWith('```')) {
            faqText = faqText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
          }
          const parsed = JSON.parse(faqText)
          if (Array.isArray(parsed)) {
            for (const f of parsed) {
              faqItems.push({
                question: String(f.question || ''),
                answer: String(f.answer || ''),
              })
            }
          }
        } catch {
          console.warn('[property-drafter] Could not parse FAQ as JSON, storing as text')
        }
      }
    }

    // 9. Generate meta fields
    const overview = sections.overview || ''
    const metaResult = await callModel('drafting', [
      {
        role: 'system',
        content: `You write SEO metadata for luxury safari properties. Be specific and compelling.`,
      },
      {
        role: 'user',
        content: `Based on this property overview:

${overview.substring(0, 1000)}

Property: ${propertyName}
Destination: ${destinations.join(', ') || 'Africa'}

Generate a JSON object with NOTHING else:
{
  "metaTitle": "Max 60 chars. Include property name.",
  "metaDescription": "Max 160 chars. Compelling, specific.",
  "answerCapsule": "50-70 words describing what makes this property special."
}`,
      },
    ], {
      maxTokens: 512,
      temperature: 0.3,
    })

    let metaText = metaResult.content.trim()
    if (metaText.startsWith('```')) {
      metaText = metaText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    const meta = JSON.parse(metaText)

    // 10. Write to project
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        sections,
        faqSection: faqItems.length > 0 ? faqItems : undefined,
        metaTitle: String(meta.metaTitle || '').substring(0, 60),
        metaDescription: String(meta.metaDescription || '').substring(0, 160),
        answerCapsule: String(meta.answerCapsule || ''),
        processingStatus: 'completed',
        processingError: null,
        stage: 'draft',
      },
    })

    console.log(`[property-drafter] Successfully drafted property page for project ${projectId}`)
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[property-drafter] Failed for project ${projectId}:`, errorMessage)

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
