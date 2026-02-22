import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

async function validateAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (
      token === process.env.CONTENT_SYSTEM_SECRET ||
      token === process.env.PAYLOAD_API_KEY ||
      token === process.env.SCRAPER_API_KEY
    ) {
      return true
    }
  }
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user) return true
  } catch {}
  return false
}

export async function POST(request: NextRequest) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let projectId: number
  try {
    const body = await request.json()
    projectId = body.projectId
    if (!projectId || typeof projectId !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  let project: Record<string, unknown>
  try {
    project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: `Project ${projectId} not found` }, { status: 404 })
  }

  // Block if unresolved hard contradictions
  const consistencyResult = project.consistencyCheckResult as string
  if (consistencyResult === 'hard_contradiction') {
    const issues = Array.isArray(project.consistencyIssues) ? project.consistencyIssues as Record<string, unknown>[] : []
    const unresolvedHard = issues.filter((i) => i.issueType === 'hard' && i.resolution === 'pending')
    if (unresolvedHard.length > 0) {
      return NextResponse.json({
        error: `Cannot publish: ${unresolvedHard.length} unresolved hard contradiction(s)`,
      }, { status: 409 })
    }
  }

  // Block if quality gates failed and not overridden
  const gatesResult = project.qualityGatesResult as string
  const gatesOverridden = project.qualityGatesOverridden as boolean

  if (gatesResult === 'not_checked' || !gatesResult) {
    return NextResponse.json({
      error: 'Cannot publish: quality gates have not been run.',
    }, { status: 409 })
  }

  if (gatesResult === 'fail' && !gatesOverridden) {
    return NextResponse.json({
      error: 'Cannot publish: quality gates failed. Fix violations or override first.',
    }, { status: 409 })
  }

  // Set processing
  await payload.update({
    collection: 'content-projects',
    id: projectId,
    data: { processingStatus: 'processing', processingError: null, processingStartedAt: new Date().toISOString() },
  })

  try {
    const contentType = project.contentType as string
    let result: import('../../../../../../content-system/publishing/types').PublishResult

    switch (contentType) {
      case 'itinerary_cluster':
      case 'authority':
      case 'designer_insight': {
        const { publishArticle } = await import('../../../../../../content-system/publishing/article-publisher')
        result = await publishArticle(projectId)
        break
      }
      case 'destination_page': {
        const { publishDestinationPage } = await import('../../../../../../content-system/publishing/destination-page-publisher')
        result = await publishDestinationPage(projectId)
        break
      }
      case 'property_page': {
        const { publishPropertyPage } = await import('../../../../../../content-system/publishing/property-page-publisher')
        result = await publishPropertyPage(projectId)
        break
      }
      case 'itinerary_enhancement': {
        const { publishEnhancement } = await import('../../../../../../content-system/publishing/enhancement-publisher')
        result = await publishEnhancement(projectId)
        break
      }
      case 'page_update': {
        const { publishUpdate } = await import('../../../../../../content-system/publishing/update-publisher')
        result = await publishUpdate(projectId)
        break
      }
      default:
        throw new Error(`No publisher for content type: ${contentType}`)
    }

    // Update project to published
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        stage: 'published',
        publishedAt: result.publishedAt,
        processingStatus: 'completed',
        processingError: null,
      },
    })

    // Trigger embedding (fire and forget)
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
        }).catch((err) => {
          console.error(`[publish-route] Embedding trigger failed for project ${projectId}:`, err)
        })
      }
    } catch {}

    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[publish-route] Failed for project ${projectId}:`, message)

    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'failed', processingError: message },
      })
    } catch {}

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
