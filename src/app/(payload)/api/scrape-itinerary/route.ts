import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const maxDuration = 30 // Only need 30s now - just creates job and triggers Lambda

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

function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }
  const token = authHeader.slice(7)
  return token === process.env.SCRAPER_API_KEY
}

export async function POST(request: NextRequest) {
  // Validate authentication
  if (!validateApiKey(request)) {
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

  // Check idempotency - does this itinerary already exist?
  if (mode === 'create') {
    const existing = await payload.find({
      collection: 'itineraries',
      where: { itineraryId: { equals: parsed.itineraryId } },
      limit: 1,
    })

    if (existing.docs.length > 0) {
      return NextResponse.json({
        success: true,
        exists: true,
        payloadId: existing.docs[0].id,
        message: 'Itinerary already processed. Use mode="update" to reprocess.',
      })
    }
  }

  // Create job record
  const job = await payload.create({
    collection: 'itinerary-jobs',
    data: {
      itrvlUrl,
      itineraryId: parsed.itineraryId,
      accessKey: parsed.accessKey,
      status: 'pending',
      currentPhase: 'queued',
    },
  })

  console.log(`[scrape-itinerary] Created job ${job.id} for itinerary ${parsed.itineraryId}`)

  // Trigger Lambda asynchronously
  const lambdaUrl = process.env.LAMBDA_PIPELINE_URL
  const invokeSecret = process.env.LAMBDA_INVOKE_SECRET

  if (!lambdaUrl) {
    // Fallback: update job to failed
    await payload.update({
      collection: 'itinerary-jobs',
      id: job.id,
      data: {
        status: 'failed',
        errorMessage: 'LAMBDA_PIPELINE_URL not configured',
      },
    })

    return NextResponse.json(
      { success: false, error: 'Pipeline not configured' },
      { status: 500 }
    )
  }

  // Fire and forget - don't await the Lambda
  fetch(lambdaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-invoke-secret': invokeSecret || '',
    },
    body: JSON.stringify({
      jobId: job.id,
      itrvlUrl,
      itineraryId: parsed.itineraryId,
      accessKey: parsed.accessKey,
    }),
  }).catch((err) => {
    console.error('[scrape-itinerary] Failed to trigger Lambda:', err)
  })

  // Return immediately with job ID
  return NextResponse.json({
    success: true,
    jobId: job.id,
    itineraryId: parsed.itineraryId,
    message: `Processing started. Poll /api/job-status/${job.id} for progress.`,
  })
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
