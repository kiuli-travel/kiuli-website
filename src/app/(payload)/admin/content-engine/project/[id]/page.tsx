import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { notFound } from 'next/navigation'
import { extractTextFromLexical } from '../../../../../../../content-system/embeddings/lexical-text'
import type {
  WorkspaceProject,
  WorkspaceStage,
  WorkspaceContentType,
  WorkspaceProcessingStatus,
  ResearchSource,
  UncertaintyItem,
  FAQItem,
  ConversationMessage,
  ConsistencyIssueDisplay,
} from '@/components/content-system/workspace-types'
import { ProjectWorkspace } from '@/components/content-system/workspace/ProjectWorkspace'

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
    ? typeof raw.targetCurrentContent === 'string'
      ? raw.targetCurrentContent
      : extractTextFromLexical(raw.targetCurrentContent)
    : undefined

  let sections: Record<string, string> | undefined
  if (raw.sections && typeof raw.sections === 'object') {
    sections = {}
    const rawSections =
      typeof raw.sections === 'string' ? JSON.parse(raw.sections as string) : raw.sections
    for (const [key, value] of Object.entries(rawSections as Record<string, unknown>)) {
      sections[key] = typeof value === 'string' ? value : extractTextFromLexical(value)
    }
  }

  const rawFaq = Array.isArray(raw.faqSection) ? raw.faqSection : []
  const faq: FAQItem[] = rawFaq.map((f: Record<string, unknown>) => ({
    question: (f.question as string) || '',
    answer: (f.answer as string) || '',
  }))

  const rawSources = Array.isArray(raw.sources) ? raw.sources : []
  const sources: ResearchSource[] = rawSources.map((s: Record<string, unknown>) => ({
    title: (s.title as string) || '',
    url: (s.url as string) || '',
    credibility: (s.credibility as ResearchSource['credibility']) || 'other',
    notes: (s.notes as string) || '',
  }))

  const rawUncertainty = Array.isArray(raw.uncertaintyMap) ? raw.uncertaintyMap : []
  const uncertaintyMap: UncertaintyItem[] = rawUncertainty.map(
    (u: Record<string, unknown>) => ({
      claim: (u.claim as string) || '',
      confidence: (u.confidence as UncertaintyItem['confidence']) || 'uncertain',
      notes: (u.notes as string) || '',
    }),
  )

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

  const targetAudience = parseJsonArray(raw.targetAudience)

  // Parse consistency issues
  const rawConsistencyIssues = Array.isArray(raw.consistencyIssues) ? raw.consistencyIssues : []
  const consistencyIssues: ConsistencyIssueDisplay[] = rawConsistencyIssues.map(
    (ci: Record<string, unknown>) => ({
      id: (ci.id as string) || '',
      issueType: (ci.issueType as ConsistencyIssueDisplay['issueType']) || 'soft',
      existingContent: (ci.existingContent as string) || '',
      newContent: (ci.newContent as string) || '',
      sourceRecord: (ci.sourceRecord as string) || '',
      resolution: (ci.resolution as ConsistencyIssueDisplay['resolution']) || 'pending',
      resolutionNote: (ci.resolutionNote as string) || undefined,
    }),
  )

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
    briefSummary: (raw.briefSummary as string) || undefined,
    targetAngle: (raw.targetAngle as string) || undefined,
    targetAudience: targetAudience.length > 0 ? targetAudience : undefined,
    competitiveNotes: (raw.competitiveNotes as string) || undefined,
    researchSynthesis: synthesisText || undefined,
    researchSources: sources.length > 0 ? sources : undefined,
    uncertaintyMap: uncertaintyMap.length > 0 ? uncertaintyMap : undefined,
    editorialNotes: editorialNotesText || undefined,
    existingSiteContent: existingSiteText || undefined,
    draftBody: draftText || undefined,
    sections,
    metaTitle: (raw.metaTitle as string) || undefined,
    metaDescription: (raw.metaDescription as string) || undefined,
    answerCapsule: (raw.answerCapsule as string) || undefined,
    targetCurrentContent: targetCurrentText || undefined,
    targetCollection: (raw.targetCollection as string) || undefined,
    targetField: (raw.targetField as string) || undefined,
    targetRecordId: (raw.targetRecordId as number) || undefined,
    faq: faq.length > 0 ? faq : undefined,
    consistencyCheckResult: (raw.consistencyCheckResult as WorkspaceProject['consistencyCheckResult']) || undefined,
    consistencyIssues: consistencyIssues.length > 0 ? consistencyIssues : undefined,
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
    messages,
  }
}

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const projectId = Number(id)

  if (!projectId || isNaN(projectId)) {
    notFound()
  }

  const payload = await getPayload({ config: configPromise })

  let raw: Record<string, unknown>
  try {
    raw = (await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    })) as unknown as Record<string, unknown>
  } catch {
    notFound()
  }

  const project = transformProject(raw)

  return <ProjectWorkspace project={project} projectId={projectId} />
}
