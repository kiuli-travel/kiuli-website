import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { handleMessage } from '../../../../../../content-system/conversation/handler'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })

  // Auth: Payload session or Bearer CONTENT_SYSTEM_SECRET
  const authHeader = request.headers.get('Authorization')
  let authenticated = false

  if (
    authHeader?.startsWith('Bearer ') &&
    authHeader.slice(7) === process.env.CONTENT_SYSTEM_SECRET
  ) {
    authenticated = true
  } else {
    const { user } = await payload.auth({ headers: request.headers })
    if (user) authenticated = true
  }

  if (!authenticated) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { projectId?: number; message?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { projectId, message } = body
  if (!projectId || !message) {
    return NextResponse.json(
      { error: 'projectId and message are required' },
      { status: 400 },
    )
  }

  // Verify project exists
  let project: Record<string, unknown>
  try {
    project = (await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    })) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: `Project ${projectId} not found` },
      { status: 404 },
    )
  }

  // Set processing status
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
    const response = await handleMessage({ projectId, message })

    // Set processing status back to idle
    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'completed' },
      })
    } catch {
      // non-critical
    }

    return NextResponse.json({
      success: true,
      response: {
        message: response.message,
        actions: response.actions,
        suggestedNextStep: response.suggestedNextStep,
      },
    })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error)
    console.error('[conversation] Failed:', errorMessage)

    // Set processing status to failed
    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: {
          processingStatus: 'failed',
          processingError: errorMessage,
        },
      })
    } catch {
      // non-critical
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
