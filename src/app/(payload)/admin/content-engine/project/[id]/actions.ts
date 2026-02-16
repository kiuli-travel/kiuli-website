'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { handleMessage } from '../../../../../../../content-system/conversation/handler'
import { extractTextFromLexical } from '../../../../../../../content-system/embeddings/lexical-text'
import { compileResearch } from '../../../../../../../content-system/research/research-compiler'
import { markdownToLexical } from '../../../../../../../content-system/conversation/lexical-utils'
import { dispatchDraft } from '../../../../../../../content-system/drafting'
import {
  isArticleType,
  isCompoundType,
  type WorkspaceProject,
  type WorkspaceStage,
  type WorkspaceContentType,
  type WorkspaceProcessingStatus,
  type ResearchSource,
  type UncertaintyItem,
  type FAQItem,
  type ConversationMessage,
} from '@/components/content-system/workspace-types'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function authenticate() {
  const payload = await getPayload({ config: configPromise })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  return { payload, user }
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v: unknown) => typeof v === 'string')
    } catch {
      // not JSON
    }
  }
  return []
}

// Stage transition maps (must match batch/route.ts)
const ARTICLE_ADVANCE: Record<string, string> = {
  idea: 'brief',
  brief: 'research',
  research: 'draft',
  draft: 'review',
  review: 'published',
}

const PAGE_ADVANCE: Record<string, string> = {
  idea: 'draft',
  draft: 'review',
  review: 'published',
}

const ENHANCEMENT_ADVANCE: Record<string, string> = {
  draft: 'review',
  review: 'published',
}

const PAGE_UPDATE_ADVANCE: Record<string, string> = {
  proposed: 'review',
  review: 'published',
}

function getNextStage(currentStage: string, contentType: string): string | null {
  if (isArticleType(contentType)) return ARTICLE_ADVANCE[currentStage] || null
  if (isCompoundType(contentType)) return PAGE_ADVANCE[currentStage] || null
  if (contentType === 'itinerary_enhancement') return ENHANCEMENT_ADVANCE[currentStage] || null
  if (contentType === 'page_update') return PAGE_UPDATE_ADVANCE[currentStage] || null
  return null
}

// ── Transform project to WorkspaceProject ────────────────────────────────────

function transformProject(raw: Record<string, unknown>): WorkspaceProject {
  const synthesisText = raw.synthesis ? extractTextFromLexical(raw.synthesis) : undefined
  const editorialNotesText = raw.editorialNotes
    ? extractTextFromLexical(raw.editorialNotes)
    : undefined
  const draftText = raw.body ? extractTextFromLexical(raw.body) : undefined
  const existingSiteText = raw.existingSiteContent
    ? extractTextFromLexical(raw.existingSiteContent)
    : undefined
  const targetCurrentText = raw.targetCurrentContent
    ? (typeof raw.targetCurrentContent === 'string'
        ? raw.targetCurrentContent
        : extractTextFromLexical(raw.targetCurrentContent))
    : undefined

  // Parse sections for compound types
  let sections: Record<string, string> | undefined
  if (raw.sections && typeof raw.sections === 'object') {
    sections = {}
    const rawSections =
      typeof raw.sections === 'string' ? JSON.parse(raw.sections as string) : raw.sections
    for (const [key, value] of Object.entries(rawSections as Record<string, unknown>)) {
      sections[key] = typeof value === 'string' ? value : extractTextFromLexical(value)
    }
  }

  // Parse FAQ
  const rawFaq = Array.isArray(raw.faqSection) ? raw.faqSection : []
  const faq: FAQItem[] = rawFaq.map((f: Record<string, unknown>) => ({
    question: (f.question as string) || '',
    answer: (f.answer as string) || '',
  }))

  // Parse sources
  const rawSources = Array.isArray(raw.sources) ? raw.sources : []
  const sources: ResearchSource[] = rawSources.map((s: Record<string, unknown>) => ({
    title: (s.title as string) || '',
    url: (s.url as string) || '',
    credibility: (s.credibility as ResearchSource['credibility']) || 'other',
    notes: (s.notes as string) || '',
  }))

  // Parse uncertainty map
  const rawUncertainty = Array.isArray(raw.uncertaintyMap) ? raw.uncertaintyMap : []
  const uncertaintyMap: UncertaintyItem[] = rawUncertainty.map(
    (u: Record<string, unknown>) => ({
      claim: (u.claim as string) || '',
      confidence: (u.confidence as UncertaintyItem['confidence']) || 'uncertain',
      notes: (u.notes as string) || '',
    }),
  )

  // Parse messages
  const rawMessages = Array.isArray(raw.messages) ? raw.messages : []
  const messages: ConversationMessage[] = rawMessages.map(
    (m: Record<string, unknown>) => ({
      role: m.role as 'designer' | 'kiuli',
      content: (m.content as string) || '',
      timestamp: (m.timestamp as string) || '',
      actions: m.actions
        ? typeof m.actions === 'string'
          ? JSON.parse(m.actions as string)
          : m.actions
        : undefined,
      suggestedNextStep: (m.suggestedNextStep as string) || undefined,
    }),
  )

  // Parse targetAudience
  const targetAudience = parseJsonArray(raw.targetAudience)

  return {
    id: raw.id as number,
    title: (raw.title as string) || '',
    contentType: (raw.contentType as WorkspaceContentType) || 'itinerary_cluster',
    stage: (raw.stage as WorkspaceStage) || 'idea',
    processingStatus: (raw.processingStatus as WorkspaceProcessingStatus) || 'idle',
    errorMessage: (raw.processingError as string) || undefined,
    destinations: parseJsonArray(raw.destinations),
    properties: parseJsonArray(raw.properties),
    species: parseJsonArray(raw.species),
    freshnessCategory: (raw.freshnessCategory as string) || undefined,
    publishedAt: (raw.publishedAt as string) || undefined,
    lastReviewedAt: (raw.lastReviewedAt as string) || undefined,
    originPathway: (raw.originPathway as string) || undefined,
    originSource: (raw.originSource as string) || undefined,

    // Brief
    briefSummary: (raw.briefSummary as string) || undefined,
    targetAngle: (raw.targetAngle as string) || undefined,
    targetAudience: targetAudience.length > 0 ? targetAudience : undefined,
    competitiveNotes: (raw.competitiveNotes as string) || undefined,

    // Research
    researchSynthesis: synthesisText || undefined,
    researchSources: sources.length > 0 ? sources : undefined,
    uncertaintyMap: uncertaintyMap.length > 0 ? uncertaintyMap : undefined,
    editorialNotes: editorialNotesText || undefined,
    existingSiteContent: existingSiteText || undefined,

    // Draft
    draftBody: draftText || undefined,
    sections,
    metaTitle: (raw.metaTitle as string) || undefined,
    metaDescription: (raw.metaDescription as string) || undefined,
    answerCapsule: (raw.answerCapsule as string) || undefined,

    // Page update
    targetCurrentContent: targetCurrentText || undefined,
    targetCollection: (raw.targetCollection as string) || undefined,
    targetField: (raw.targetField as string) || undefined,
    targetRecordId: (raw.targetRecordId as number) || undefined,

    // FAQ
    faq: faq.length > 0 ? faq : undefined,

    // Distribution
    distribution:
      raw.linkedinSummary || raw.facebookSummary
        ? {
            linkedinSummary: (raw.linkedinSummary as string) || '',
            facebookSummary: (raw.facebookSummary as string) || '',
            facebookPinnedComment: (raw.facebookPinnedComment as string) || '',
            linkedinPosted: (raw.linkedinPosted as boolean) || false,
            facebookPosted: (raw.facebookPosted as boolean) || false,
          }
        : undefined,

    // Conversation
    messages,
  }
}

// ── Action 1: Send Conversation Message ──────────────────────────────────────

export async function sendConversationMessage(projectId: number, message: string, activeTab?: string) {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated. Please log in at /admin first.' }
  }

  try {
    await payload.findByID({ collection: 'content-projects', id: projectId, depth: 0 })
  } catch {
    return { error: `Project ${projectId} not found` }
  }

  try {
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { processingStatus: 'processing' },
    })
  } catch {
    // non-critical
  }

  try {
    const response = await handleMessage({ projectId, message, activeTab })

    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'completed' },
      })
    } catch {
      // non-critical
    }

    return {
      success: true,
      response: {
        message: response.message,
        actions: response.actions,
        suggestedNextStep: response.suggestedNextStep,
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('[conversation] Failed:', errorMessage)

    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'failed', processingError: errorMessage },
      })
    } catch {
      // non-critical
    }

    return { error: errorMessage }
  }
}

// ── Action 2: Fetch Project Data ─────────────────────────────────────────────

export async function fetchProjectData(
  projectId: number,
): Promise<{ project: WorkspaceProject } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    const raw = (await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    })) as unknown as Record<string, unknown>

    return { project: transformProject(raw) }
  } catch {
    return { error: `Project ${projectId} not found` }
  }
}

// ── Action 3: Advance Project Stage ──────────────────────────────────────────

export async function advanceProjectStage(
  projectId: number,
): Promise<{ success: true; newStage: string } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    const project = (await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    })) as unknown as Record<string, unknown>

    const nextStage = getNextStage(
      project.stage as string,
      project.contentType as string,
    )

    if (!nextStage) {
      return {
        error: `Cannot advance from '${project.stage}' for content type '${project.contentType}'`,
      }
    }

    const updateData: Record<string, unknown> = { stage: nextStage }
    if (nextStage === 'published') {
      updateData.publishedAt = new Date().toISOString()
    }

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: updateData,
    })

    return { success: true, newStage: nextStage }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ── Action 4: Reject Project ─────────────────────────────────────────────────

export async function rejectProject(
  projectId: number,
  reason: string,
  createDirective: boolean,
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        stage: 'rejected',
        filterReason: reason || 'Rejected via workspace',
      },
    })

    if (createDirective && reason) {
      const reviewAfter = new Date()
      reviewAfter.setMonth(reviewAfter.getMonth() + 6)
      await payload.create({
        collection: 'editorial-directives',
        data: {
          text: reason,
          active: true,
          reviewAfter: reviewAfter.toISOString(),
          filterCount30d: 0,
        },
      })
    }

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ── Action 5: Save Project Fields ────────────────────────────────────────────

export async function saveProjectFields(
  projectId: number,
  fields: Record<string, unknown>,
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Allowlist of directly-editable fields
  const allowedFields = new Set([
    'title',
    'briefSummary',
    'targetAngle',
    'targetAudience',
    'competitiveNotes',
    'metaTitle',
    'metaDescription',
    'answerCapsule',
    'linkedinSummary',
    'facebookSummary',
    'facebookPinnedComment',
  ])

  const safeData: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.has(key)) {
      safeData[key] = value
    }
  }

  if (Object.keys(safeData).length === 0) {
    return { error: 'No valid fields to update' }
  }

  try {
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: safeData,
    })
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ── Action 6: Trigger Research ───────────────────────────────────────────────

export async function triggerResearch(
  projectId: number,
): Promise<{ success: true; sourceCount: number; uncertaintyCount: number } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let project: any
  try {
    project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    })
  } catch {
    return { error: 'Project not found' }
  }

  if (!isArticleType(project.contentType)) {
    return { error: `Only articles can be researched (type: ${project.contentType})` }
  }
  if (project.stage !== 'research') {
    return { error: `Project must be at 'research' stage (currently: ${project.stage})` }
  }

  try {
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { processingStatus: 'processing', processingError: '' },
    })
  } catch {
    // continue
  }

  try {
    const destinations: string[] = parseJsonArray(project.destinations)

    const compilation = await compileResearch({
      projectId: String(projectId),
      query: {
        topic: project.title || '',
        angle: project.targetAngle || '',
        destinations,
        contentType: project.contentType || '',
      },
    })

    const synthesisRichText = markdownToLexical(compilation.synthesis)
    const existingContentRichText = markdownToLexical(
      compilation.existingSiteContent || '(No existing content found)',
    )

    const sourcesArray = compilation.sources.map((s) => ({
      title: s.title,
      url: s.url,
      credibility: s.credibility,
      notes: s.snippet || '',
    }))

    const uncertaintyArray = compilation.uncertaintyMap.map((u) => ({
      claim: u.claim,
      confidence: u.confidence,
      notes: u.notes,
    }))

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        synthesis: synthesisRichText,
        existingSiteContent: existingContentRichText,
        sources: sourcesArray,
        uncertaintyMap: uncertaintyArray,
        processingStatus: 'completed',
        processingError: '',
      },
    })

    return {
      success: true,
      sourceCount: sourcesArray.length,
      uncertaintyCount: uncertaintyArray.length,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'failed', processingError: message },
      })
    } catch {
      // ignore
    }
    return { error: message }
  }
}

// ── Action 7: Trigger Draft ──────────────────────────────────────────────────

export async function triggerDraft(
  projectId: number,
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    await payload.findByID({ collection: 'content-projects', id: projectId, depth: 0 })
  } catch {
    return { error: 'Project not found' }
  }

  try {
    // dispatchDraft handles processingStatus internally
    await dispatchDraft(projectId)
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    // processingStatus is already set to 'failed' by the drafter
    return { error: errorMessage }
  }
}

// ── Action 8: Save FAQ Items ─────────────────────────────────────────────────

export async function saveFaqItems(
  projectId: number,
  items: FAQItem[],
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        faqSection: items.map((item) => ({
          question: item.question,
          answer: item.answer,
        })),
      },
    })
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
