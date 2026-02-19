'use server'

import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { handleMessage } from '../../../../../../../content-system/conversation/handler'
import { compileResearch } from '../../../../../../../content-system/research/research-compiler'
import { markdownToLexical } from '../../../../../../../content-system/conversation/lexical-utils'
import { dispatchDraft } from '../../../../../../../content-system/drafting'
import { transformProject, parseJsonArray } from '@/lib/transform-project'

import {
  isArticleType,
  isCompoundType,
  type WorkspaceProject,
  type FAQItem,
  type ArticleImage,
} from '@/components/content-system/workspace-types'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function authenticate() {
  const payload = await getPayload({ config: configPromise })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  return { payload, user }
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

    const project = transformProject(raw)

    // Resolve hero image media record (mirrors page.tsx server logic)
    if (project.heroImageId) {
      try {
        const heroMedia = await payload.findByID({
          collection: 'media',
          id: project.heroImageId,
          depth: 0,
        }) as unknown as Record<string, unknown>
        project.heroImageImgixUrl = (heroMedia.imgixUrl as string) || null
        project.heroImageAlt = (heroMedia.alt as string) || (heroMedia.altText as string) || null
      } catch {
        project.heroImageId = null
      }
    }

    // Resolve article image media records
    if (project.articleImages && project.articleImages.length > 0) {
      for (const img of project.articleImages) {
        try {
          const media = await payload.findByID({
            collection: 'media', id: img.mediaId, depth: 0,
          }) as unknown as Record<string, unknown>
          img.imgixUrl = (media.imgixUrl as string) || undefined
          img.alt = (media.alt as string) || (media.altText as string) || undefined
        } catch {
          // Image may have been deleted
        }
      }
    }

    return { project }
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

    // Block publish if unresolved hard contradictions
    if (nextStage === 'published') {
      const consistencyResult = project.consistencyCheckResult as string
      if (consistencyResult === 'hard_contradiction') {
        // Check if any issues are still pending
        const issues = Array.isArray(project.consistencyIssues) ? project.consistencyIssues : []
        const unresolvedHard = issues.filter(
          (i: Record<string, unknown>) => i.issueType === 'hard' && i.resolution === 'pending'
        )
        if (unresolvedHard.length > 0) {
          return {
            error: `Cannot publish: ${unresolvedHard.length} unresolved hard contradiction(s). Resolve them in the workspace first.`,
          }
        }
      }
    }

    const updateData: Record<string, unknown> = {
      stage: nextStage,
      processingStatus: 'idle',
      processingError: null,
      processingStartedAt: null,
    }
    if (nextStage === 'published') {
      updateData.publishedAt = new Date().toISOString()
    }

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: updateData,
    })

    // Auto-trigger consistency check when entering review stage
    if (nextStage === 'review') {
      try {
        await payload.update({
          collection: 'content-projects',
          id: projectId,
          data: { processingStatus: 'processing' },
        })

        const { checkConsistency } = await import(
          '../../../../../../../content-system/quality/consistency-checker'
        )
        const result = await checkConsistency(projectId)
        await payload.update({
          collection: 'content-projects',
          id: projectId,
          data: {
            consistencyCheckResult: result.overallResult,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            consistencyIssues: result.issues.map((issue: any) => ({
              issueType: issue.issueType,
              existingContent: issue.existingContent,
              newContent: issue.newContent,
              sourceRecord: issue.sourceRecord,
              resolution: issue.resolution,
              resolutionNote: issue.resolutionNote || null,
            })),
            processingStatus: 'completed',
            processingError: null,
          },
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[advanceProjectStage] Consistency check failed for project ${projectId}:`, message)
        try {
          await payload.update({
            collection: 'content-projects',
            id: projectId,
            data: { processingStatus: 'failed', processingError: `Consistency check failed: ${message}` },
          })
        } catch {}
      }
    }

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
    'articleImages',
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

// ── Action 9: Trigger Consistency Check ──────────────────────────────────────

export async function triggerConsistencyCheck(
  projectId: number,
): Promise<{ success: true; result: { overallResult: string; issueCount: number } } | { error: string }> {
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
    const { checkConsistency } = await import(
      '../../../../../../../content-system/quality/consistency-checker'
    )

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { processingStatus: 'processing', processingError: null },
    })

    const result = await checkConsistency(projectId)

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        consistencyCheckResult: result.overallResult,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        consistencyIssues: result.issues.map((issue: any) => ({
          issueType: issue.issueType,
          existingContent: issue.existingContent,
          newContent: issue.newContent,
          sourceRecord: issue.sourceRecord,
          resolution: issue.resolution,
          resolutionNote: issue.resolutionNote || null,
        })),
        processingStatus: 'completed',
        processingError: null,
      },
    })

    return {
      success: true,
      result: { overallResult: result.overallResult, issueCount: result.issues.length },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'failed', processingError: message },
      })
    } catch {}
    return { error: message }
  }
}

// ── Action 10: Resolve Consistency Issue ─────────────────────────────────────

export async function resolveConsistencyIssue(
  projectId: number,
  issueId: string,
  resolution: 'updated_draft' | 'updated_existing' | 'overridden',
  resolutionNote?: string,
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  if (resolution === 'overridden' && (!resolutionNote || resolutionNote.trim().length === 0)) {
    return { error: 'Override requires a note explaining why.' }
  }

  try {
    const project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    const issues = Array.isArray(project.consistencyIssues)
      ? (project.consistencyIssues as Record<string, unknown>[])
      : []

    const updatedIssues = issues.map((issue) => {
      if (issue.id === issueId) {
        return {
          ...issue,
          resolution,
          resolutionNote: resolutionNote || null,
        }
      }
      return issue
    })

    // Recalculate overall result
    const unresolvedHard = updatedIssues.filter(
      (i) => i.issueType === 'hard' && i.resolution === 'pending'
    )
    const unresolvedSoft = updatedIssues.filter(
      (i) => i.issueType === 'soft' && i.resolution === 'pending'
    )

    let newOverallResult: 'pass' | 'hard_contradiction' | 'soft_contradiction' = 'pass'
    if (unresolvedHard.length > 0) {
      newOverallResult = 'hard_contradiction'
    } else if (unresolvedSoft.length > 0) {
      newOverallResult = 'soft_contradiction'
    }

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        consistencyIssues: updatedIssues,
        consistencyCheckResult: newOverallResult,
      },
    })

    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

// ── Action 11: Trigger Publish ───────────────────────────────────────────────

export async function triggerPublish(
  projectId: number,
): Promise<{ success: true; result: { targetCollection: string; targetId: number } } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    const project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    // Must be in review stage
    if ((project.stage as string) !== 'review') {
      return { error: `Cannot publish from stage '${project.stage}'. Must be in review.` }
    }

    // Block if unresolved hard contradictions
    if ((project.consistencyCheckResult as string) === 'hard_contradiction') {
      const issues = Array.isArray(project.consistencyIssues) ? project.consistencyIssues as Record<string, unknown>[] : []
      const unresolvedHard = issues.filter((i) => i.issueType === 'hard' && i.resolution === 'pending')
      if (unresolvedHard.length > 0) {
        return { error: `${unresolvedHard.length} unresolved hard contradiction(s). Resolve them first.` }
      }
    }

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { processingStatus: 'processing', processingError: null },
    })

    const contentType = project.contentType as string
    let publishResult: import('../../../../../../../content-system/publishing/types').PublishResult

    switch (contentType) {
      case 'itinerary_cluster':
      case 'authority':
      case 'designer_insight': {
        const { publishArticle } = await import('../../../../../../../content-system/publishing/article-publisher')
        publishResult = await publishArticle(projectId)
        break
      }
      case 'destination_page': {
        const { publishDestinationPage } = await import('../../../../../../../content-system/publishing/destination-page-publisher')
        publishResult = await publishDestinationPage(projectId)
        break
      }
      case 'property_page': {
        const { publishPropertyPage } = await import('../../../../../../../content-system/publishing/property-page-publisher')
        publishResult = await publishPropertyPage(projectId)
        break
      }
      case 'itinerary_enhancement': {
        const { publishEnhancement } = await import('../../../../../../../content-system/publishing/enhancement-publisher')
        publishResult = await publishEnhancement(projectId)
        break
      }
      case 'page_update': {
        const { publishUpdate } = await import('../../../../../../../content-system/publishing/update-publisher')
        publishResult = await publishUpdate(projectId)
        break
      }
      default:
        return { error: `No publisher for content type: ${contentType}` }
    }

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        stage: 'published',
        publishedAt: publishResult.publishedAt,
        processingStatus: 'completed',
        processingError: null,
      },
    })

    // Trigger embedding
    try {
      const secret = process.env.CONTENT_SYSTEM_SECRET
      if (secret) {
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://kiuli.com'
        fetch(`${baseUrl}/api/content/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`,
          },
          body: JSON.stringify({ contentProjectId: projectId }),
        }).catch(() => {})
      }
    } catch {}

    return { success: true, result: { targetCollection: publishResult.targetCollection, targetId: publishResult.targetId } }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'failed', processingError: message },
      })
    } catch {}
    return { error: message }
  }
}

// ── Action 12: Save Article Images ────────────────────────────────────────────

export async function saveArticleImages(
  projectId: number,
  images: ArticleImage[],
): Promise<{ success: true } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  // Validate and sanitize
  const sanitized = images
    .filter((img) => img.mediaId && typeof img.mediaId === 'number')
    .map((img) => ({
      position: Number(img.position) || 0,
      mediaId: img.mediaId,
      caption: img.caption || undefined,
    }))

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { articleImages: sanitized } as any,
    })
    return { success: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
