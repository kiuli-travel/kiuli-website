import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { dispatchDraft } from '../../../../../../content-system/drafting'

export const maxDuration = 300 // 5 minutes — compound drafters make multiple LLM calls

/**
 * Validate authentication via Payload session OR CONTENT_SYSTEM_SECRET Bearer token
 */
async function validateAuth(request: NextRequest): Promise<boolean> {
  // Check for Bearer token
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

  // Check for Payload session
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user) return true
  } catch {
    // Session check failed
  }

  return false
}

export async function POST(request: NextRequest) {
  if (!(await validateAuth(request))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    )
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

    // Dispatch to appropriate drafter — runs synchronously within this request
    await dispatchDraft(projectId)

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[draft-route] Draft failed:', message)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}

export const dynamic = 'force-dynamic'
