import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

// Stage transition maps
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

const PAGE_TYPES = new Set(['destination_page', 'property_page'])

function getNextStage(currentDbStage: string, contentType: string): string | null {
  if (PAGE_TYPES.has(contentType)) {
    return PAGE_ADVANCE[currentDbStage] || null
  }
  return ARTICLE_ADVANCE[currentDbStage] || null
}

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })

  // Authenticate via Bearer token or Payload session
  let authenticated = false
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (
      token === process.env.CONTENT_SYSTEM_SECRET ||
      token === process.env.PAYLOAD_API_KEY
    ) {
      authenticated = true
    }
  }
  if (!authenticated) {
    try {
      const { user } = await payload.auth({ headers: request.headers })
      if (user) authenticated = true
    } catch {}
  }
  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { action: string; projectIds: number[]; reason?: string; createDirective?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action, projectIds, reason, createDirective } = body

  if (!action || !Array.isArray(projectIds) || projectIds.length === 0) {
    return NextResponse.json(
      { error: 'action and projectIds[] are required' },
      { status: 400 },
    )
  }

  let updated = 0

  try {
    const skipped: Array<{ id: number; reason: string }> = []

    if (action === 'advance') {
      for (const id of projectIds) {
        const project = await payload.findByID({
          collection: 'content-projects',
          id,
          depth: 0,
        }) as unknown as Record<string, unknown>

        const nextStage = getNextStage(
          project.stage as string,
          project.contentType as string,
        )

        if (nextStage) {
          if (nextStage === 'published') {
            const consistencyResult = (project as Record<string, unknown>).consistencyCheckResult as string
            if (consistencyResult === 'hard_contradiction') {
              const issues = Array.isArray((project as Record<string, unknown>).consistencyIssues)
                ? (project as Record<string, unknown>).consistencyIssues as Record<string, unknown>[]
                : []
              const unresolvedHard = issues.filter(
                (i) => i.issueType === 'hard' && i.resolution === 'pending'
              )
              if (unresolvedHard.length > 0) {
                skipped.push({
                  id,
                  reason: `${unresolvedHard.length} unresolved hard contradiction(s)`,
                })
                continue
              }
            }

            // Block if quality gates failed and not overridden
            const gatesResult = (project as Record<string, unknown>).qualityGatesResult as string
            const gatesOverridden = (project as Record<string, unknown>).qualityGatesOverridden as boolean

            if (gatesResult === 'not_checked' || !gatesResult) {
              skipped.push({ id, reason: 'Quality gates have not been run' })
              continue
            }

            if (gatesResult === 'fail' && !gatesOverridden) {
              skipped.push({ id, reason: 'Quality gates failed — not overridden' })
              continue
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
            id,
            data: updateData,
          })
          updated++

          // Auto-trigger consistency check when entering review
          if (nextStage === 'review') {
            try {
              await payload.update({
                collection: 'content-projects',
                id,
                data: { processingStatus: 'processing' },
              })
              const { checkConsistency } = await import(
                '../../../../../../../content-system/quality/consistency-checker'
              )
              const result = await checkConsistency(id)
              await payload.update({
                collection: 'content-projects',
                id,
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
              const msg = error instanceof Error ? error.message : String(error)
              console.error(`[batch-advance] Consistency check failed for project ${id}:`, msg)
              try {
                await payload.update({
                  collection: 'content-projects',
                  id,
                  data: { processingStatus: 'failed', processingError: `Consistency check failed: ${msg}` },
                })
              } catch {}
            }

            // Auto-trigger quality gates (separate from consistency — non-fatal)
            try {
              const { checkHardGates } = await import(
                '../../../../../../../content-system/quality/hard-gates'
              )
              const { extractTextFromLexical } = await import(
                '../../../../../../../content-system/embeddings/lexical-text'
              )

              const freshProject = await payload.findByID({
                collection: 'content-projects',
                id,
                depth: 0,
              }) as unknown as Record<string, unknown>

              let bodyText = ''
              if (freshProject.body) {
                bodyText = extractTextFromLexical(freshProject.body)
              } else if (freshProject.sections) {
                const sections = typeof freshProject.sections === 'string'
                  ? JSON.parse(freshProject.sections as string)
                  : freshProject.sections
                bodyText = Object.values(sections || {}).map((v) => String(v || '')).join('\n\n')
              }

              const gateResult = await checkHardGates({
                projectId: String(id),
                body: bodyText,
                metaTitle: (freshProject.metaTitle as string) || undefined,
                metaDescription: (freshProject.metaDescription as string) || undefined,
              })

              await payload.update({
                collection: 'content-projects',
                id,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data: {
                  qualityGatesResult: gateResult.passed ? 'pass' : 'fail',
                  qualityGatesViolations: gateResult.violations,
                  qualityGatesCheckedAt: new Date().toISOString(),
                  qualityGatesOverridden: false,
                  qualityGatesOverrideNote: null,
                } as any,
              })
            } catch (gateError) {
              console.error(`[batch-advance] Quality gates failed for project ${id}:`,
                gateError instanceof Error ? gateError.message : gateError)
              // Non-fatal — don't block stage advance
            }
          }
        }
      }
    } else if (action === 'reject') {
      for (const id of projectIds) {
        await payload.update({
          collection: 'content-projects',
          id,
          data: {
            stage: 'rejected',
            filterReason: reason || 'Rejected via dashboard',
          },
        })
        updated++
      }

      // Optionally create an editorial directive
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
    } else if (action === 'retry') {
      for (const id of projectIds) {
        await payload.update({
          collection: 'content-projects',
          id,
          data: {
            processingStatus: 'idle',
            processingError: null,
          },
        })
        updated++
      }
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      )
    }

    return NextResponse.json({ success: true, updated, skipped })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
