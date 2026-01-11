import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Validate API key from Authorization header
 */
function validateApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const expectedKey = process.env.SCRAPER_API_KEY

  if (!expectedKey) {
    console.error('[scrape-itinerary] SCRAPER_API_KEY not configured')
    return false
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const providedKey = authHeader.substring(7) // Remove "Bearer " prefix
  return providedKey === expectedKey
}

/**
 * POST /api/scrape-itinerary
 *
 * Executes the full itinerary processing pipeline (Phases 2-7):
 * Scrape → Rehost → Enhance → SchemaGen → Validate → FAQ → PayloadIngest
 *
 * Input: { itrvlUrl: string }
 * Output: { success: boolean, payloadId: string, jobId: string, duration: number }
 *
 * This endpoint also creates and updates a job tracking record in the
 * 'itinerary-jobs' collection to enable monitoring and admin UI management.
 *
 * This endpoint does NOT call the Google Search Console API (Phase 9).
 */
export async function POST(request: NextRequest) {
  // Check authentication
  if (!validateApiKey(request)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Unauthorized: Invalid or missing API key',
      },
      { status: 401 }
    )
  }

  let jobId: number | string | null = null

  try {
    // Parse request body
    const body = await request.json()
    const { itrvlUrl } = body

    // Validate input
    if (!itrvlUrl || typeof itrvlUrl !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: itrvlUrl is required and must be a string',
        },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(itrvlUrl)
    } catch (e) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: itrvlUrl must be a valid URL',
        },
        { status: 400 }
      )
    }

    // Extract itineraryId from URL for job tracking
    const { parseItrvlUrl } = await import(
      '../../../../../scrapers/itrvl_scraper.cjs'
    )
    const { itineraryId } = parseItrvlUrl(itrvlUrl)

    // Log request
    console.log(`[scrape-itinerary] Starting pipeline for URL: ${itrvlUrl}`)
    console.log(`[scrape-itinerary] Itinerary ID: ${itineraryId}`)

    // Get Payload instance
    const payload = await getPayload({ config })

    // Create job record in Payload CMS
    console.log('[scrape-itinerary] Creating job record...')
    const job = await payload.create({
      collection: 'itinerary-jobs',
      data: {
        itineraryId: itineraryId,
        itrvlUrl: itrvlUrl,
        status: 'processing',
        startedAt: new Date().toISOString(),
      },
    })

    jobId = job.id
    console.log(`[scrape-itinerary] Job created with ID: ${jobId}`)

    // Import and execute the pipeline
    // Using dynamic import to load CommonJS module
    const { runFullPipeline } = await import(
      '../../../../../pipelines/run_full_pipeline.cjs'
    )

    // Execute pipeline with silent mode disabled to see timing logs
    const result = await runFullPipeline(itrvlUrl, { silent: false })

    console.log(`[scrape-itinerary] Pipeline completed: ${JSON.stringify(result)}`)

    // Update job record with results
    if (result.success) {
      await payload.update({
        collection: 'itinerary-jobs',
        id: jobId,
        data: {
          status: 'completed',
          completedAt: new Date().toISOString(),
          payloadId: result.payloadId,
          duration: result.duration,
          timings: result.timings as unknown as Record<string, unknown>,
        },
      })

      console.log(`[scrape-itinerary] Job ${jobId} marked as completed`)

      // Return success response
      return NextResponse.json(
        {
          success: true,
          payloadId: result.payloadId,
          jobId: jobId,
          duration: result.duration,
          timings: result.timings,
          message: 'Itinerary processed successfully',
        },
        { status: 200 }
      )
    } else {
      // Partial success (validation failed but entry created)
      await payload.update({
        collection: 'itinerary-jobs',
        id: jobId,
        data: {
          status: 'failed',
          completedAt: new Date().toISOString(),
          payloadId: result.payloadId,
          errorMessage: result.error,
          duration: result.duration,
          timings: result.timings as unknown as Record<string, unknown>,
        },
      })

      console.log(`[scrape-itinerary] Job ${jobId} marked as failed (validation)`)

      return NextResponse.json(
        {
          success: false,
          payloadId: result.payloadId,
          jobId: jobId,
          phase: result.phase,
          error: result.error,
          duration: result.duration,
          timings: result.timings,
          message: 'Pipeline completed with validation errors',
        },
        { status: 200 } // Still return 200 because entry was created
      )
    }
  } catch (error: any) {
    // Log error
    console.error('[scrape-itinerary] Pipeline error:', error)

    // Update job record if it was created
    if (jobId) {
      try {
        const payload = await getPayload({ config })
        await payload.update({
          collection: 'itinerary-jobs',
          id: jobId,
          data: {
            status: 'failed',
            completedAt: new Date().toISOString(),
            errorMessage: error.message || 'Internal server error',
          },
        })
        console.log(`[scrape-itinerary] Job ${jobId} marked as failed (exception)`)
      } catch (updateError) {
        console.error('[scrape-itinerary] Failed to update job record:', updateError)
      }
    }

    // Return error response
    return NextResponse.json(
      {
        success: false,
        jobId: jobId,
        error: error.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for Vercel Pro plan
