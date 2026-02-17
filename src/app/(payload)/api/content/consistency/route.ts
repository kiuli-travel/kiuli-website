import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { checkConsistency } from '../../../../../../content-system/quality/consistency-checker'

export const maxDuration = 120

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
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId || typeof projectId !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid projectId (must be a number)' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })

    // Set processing status
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { processingStatus: 'processing', processingError: null },
    })

    const result = await checkConsistency(projectId)

    // Write results to project
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        consistencyCheckResult: result.overallResult,
        consistencyIssues: result.issues.map(issue => ({
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

    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[consistency-route] Failed:', message)

    // Try to set failed status
    try {
      const { projectId } = await request.clone().json()
      if (projectId) {
        const payload = await getPayload({ config })
        await payload.update({
          collection: 'content-projects',
          id: projectId,
          data: { processingStatus: 'failed', processingError: message },
        })
      }
    } catch {}

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
