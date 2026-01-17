import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'

export const maxDuration = 30 // Only need 30s now - just creates job and triggers Lambda

// Initialize Lambda client
const lambdaClient = new LambdaClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})

function parseItrvlUrl(url: string): { accessKey: string; itineraryId: string } | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter((p) => p)
    const portalIndex = pathParts.indexOf('portal')

    if (portalIndex === -1 || pathParts.length < portalIndex + 3) {
      return null
    }

    return {
      accessKey: pathParts[portalIndex + 1],
      itineraryId: pathParts[portalIndex + 2],
    }
  } catch {
    return null
  }
}

/**
 * Validate authentication via Payload session OR API key
 */
async function validateAuth(request: NextRequest): Promise<boolean> {
  // First check for Bearer token (Lambda/external calls)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (token === process.env.SCRAPER_API_KEY || token === process.env.PAYLOAD_API_KEY) {
      return true
    }
  }

  // Then check for Payload session (admin UI)
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user) {
      return true
    }
  } catch {
    // Session check failed
  }

  return false
}

export async function POST(request: NextRequest) {
  // Validate authentication (session or API key)
  if (!(await validateAuth(request))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    )
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { itrvlUrl, mode = 'create' } = body

  if (!itrvlUrl) {
    return NextResponse.json(
      { success: false, error: 'itrvlUrl is required' },
      { status: 400 }
    )
  }

  // Parse URL
  const parsed = parseItrvlUrl(itrvlUrl)
  if (!parsed) {
    return NextResponse.json(
      { success: false, error: 'Invalid iTrvl URL format' },
      { status: 400 }
    )
  }

  const payload = await getPayload({ config })

  // Check for existing itinerary if mode is 'update'
  let existingItinerary = null
  if (mode === 'update') {
    const existing = await payload.find({
      collection: 'itineraries',
      where: {
        itineraryId: { equals: parsed.itineraryId },
      },
      limit: 1,
    })
    existingItinerary = existing.docs[0] || null
  }

  // Create job record
  const job = await payload.create({
    collection: 'itinerary-jobs',
    data: {
      itrvlUrl,
      itineraryId: parsed.itineraryId,
      accessKey: parsed.accessKey,
      status: 'pending',
      currentPhase: 'Queued',
      startedAt: new Date().toISOString(),
    },
  })

  console.log(`[scrape-itinerary] Created job ${job.id} for itinerary ${parsed.itineraryId} (mode: ${mode})`)

  // Trigger V6 Orchestrator Lambda asynchronously
  const orchestratorArn = process.env.LAMBDA_ORCHESTRATOR_ARN || 'kiuli-v6-orchestrator'

  try {
    // Invoke Lambda asynchronously (Event invocation type)
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: orchestratorArn,
        InvocationType: 'Event', // Async - returns immediately
        Payload: JSON.stringify({
          jobId: job.id,
          itrvlUrl,
          itineraryId: parsed.itineraryId,
          accessKey: parsed.accessKey,
          mode,
          existingItineraryId: existingItinerary?.id || null,
        }),
      })
    )

    console.log(`[scrape-itinerary] Triggered orchestrator for job ${job.id}`)
  } catch (err) {
    console.error('[scrape-itinerary] Failed to trigger Lambda:', err)

    // Update job to failed
    await payload.update({
      collection: 'itinerary-jobs',
      id: job.id,
      data: {
        status: 'failed',
        errorMessage: `Failed to trigger orchestrator: ${(err as Error).message}`,
        errorPhase: 'initialization',
      },
    })

    return NextResponse.json(
      { success: false, error: 'Failed to start processing pipeline' },
      { status: 500 }
    )
  }

  // Return immediately with job ID
  return NextResponse.json({
    success: true,
    jobId: job.id,
    itineraryId: parsed.itineraryId,
    mode,
    existingItineraryId: existingItinerary?.id || null,
    message: `Processing started. Poll /api/job-status/${job.id} for progress.`,
  })
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
