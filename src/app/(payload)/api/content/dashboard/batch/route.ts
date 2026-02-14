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

  // Authenticate via Payload session
  const { user } = await payload.auth({ headers: request.headers })
  if (!user) {
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
          const updateData: Record<string, unknown> = { stage: nextStage }
          if (nextStage === 'published') {
            updateData.publishedAt = new Date().toISOString()
          }
          await payload.update({
            collection: 'content-projects',
            id,
            data: updateData,
          })
          updated++
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

    return NextResponse.json({ success: true, updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
