import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'

export const maxDuration = 30 // Only need 30s now - just creates job and triggers Step Functions

// Lazy-init Step Functions client (env vars may not be available at import time)
// Use KIULI_AWS_* to avoid Vercel overriding AWS_* env vars
let _sfnClient: SFNClient | null = null
function getSfnClient(): SFNClient {
  if (!_sfnClient) {
    _sfnClient = new SFNClient({
      region: (process.env.KIULI_AWS_REGION || process.env.AWS_REGION || 'eu-north-1').trim(),
      credentials: {
        accessKeyId: (process.env.KIULI_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '').trim(),
        secretAccessKey: (process.env.KIULI_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
      },
    })
  }
  return _sfnClient
}

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
  try {
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

    // Idempotency check: Prevent duplicate jobs for same URL
    const existingActiveJob = await payload.find({
      collection: 'itinerary-jobs',
      where: {
        and: [
          { itrvlUrl: { equals: itrvlUrl } },
          {
            or: [
              { status: { equals: 'pending' } },
              { status: { equals: 'processing' } },
            ],
          },
        ],
      },
      limit: 1,
    })

    if (existingActiveJob.docs.length > 0) {
      const activeJob = existingActiveJob.docs[0]
      return NextResponse.json(
        {
          success: false,
          error: 'A job is already running for this URL',
          existingJobId: activeJob.id,
          existingJobStatus: activeJob.status,
          existingJobProgress: activeJob.progress,
          message: `Poll /api/job-status/${activeJob.id} for progress.`,
        },
        { status: 409 } // Conflict
      )
    }

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

    // Trigger Step Functions state machine
    const stateMachineArn = process.env.STEP_FUNCTION_ARN

    if (!stateMachineArn) {
      throw new Error('STEP_FUNCTION_ARN not configured')
    }

    try {
      const executionName = `job-${job.id}-${Date.now()}`

      // Create fresh client per request to ensure correct credentials
      const client = new SFNClient({
        region: (process.env.KIULI_AWS_REGION || process.env.AWS_REGION || 'eu-north-1').trim(),
        credentials: {
          accessKeyId: (process.env.KIULI_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '').trim(),
          secretAccessKey: (process.env.KIULI_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '').trim(),
        },
      })

      console.log(`[scrape-itinerary] SFN client config: region=${(process.env.KIULI_AWS_REGION || process.env.AWS_REGION || 'eu-north-1').trim()}, keyId=${(process.env.KIULI_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '').substring(0, 8)}...`)

      await client.send(
        new StartExecutionCommand({
          stateMachineArn,
          name: executionName,
          input: JSON.stringify({
            jobId: job.id,
            itrvlUrl,
            itineraryId: parsed.itineraryId,
            accessKey: parsed.accessKey,
            mode,
            existingItineraryId: existingItinerary?.id || null,
          }),
        })
      )

      console.log(`[scrape-itinerary] Started Step Functions execution: ${executionName}`)
    } catch (err) {
      console.error('[scrape-itinerary] Failed to trigger Step Functions:', err)

      // Update job to failed
      await payload.update({
        collection: 'itinerary-jobs',
        id: job.id,
        data: {
          status: 'failed',
          errorMessage: `Failed to trigger pipeline: ${(err as Error).message} [keyPrefix=${(process.env.KIULI_AWS_ACCESS_KEY_ID || '').substring(0, 8) || 'NONE'},region=${(process.env.KIULI_AWS_REGION || 'NONE')}]`,
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
  } catch (err) {
    console.error('[scrape-itinerary] Unhandled error:', err)
    return NextResponse.json(
      { success: false, error: `Server error: ${(err as Error).message}` },
      { status: 500 }
    )
  }
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
