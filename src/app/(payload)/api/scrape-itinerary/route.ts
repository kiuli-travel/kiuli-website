import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/scrape-itinerary
 *
 * Executes the full itinerary processing pipeline (Phases 2-7):
 * Scrape → Rehost → Enhance → SchemaGen → Validate → FAQ → PayloadIngest
 *
 * Input: { itrvlUrl: string }
 * Output: { success: boolean, payloadId: string, duration: number }
 *
 * This endpoint does NOT call the Google Search Console API (Phase 9).
 */
export async function POST(request: NextRequest) {
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

    // Log request
    console.log(`[scrape-itinerary] Starting pipeline for URL: ${itrvlUrl}`)

    // Import and execute the pipeline
    // Using dynamic import to load CommonJS module
    const { runFullPipeline } = await import(
      '../../../../../pipelines/run_full_pipeline.cjs'
    )

    // Execute pipeline with silent mode disabled to see timing logs
    const result = await runFullPipeline(itrvlUrl, { silent: false })

    console.log(`[scrape-itinerary] Pipeline completed: ${JSON.stringify(result)}`)

    // Return success response
    if (result.success) {
      return NextResponse.json(
        {
          success: true,
          payloadId: result.payloadId,
          duration: result.duration,
          timings: result.timings,
          message: 'Itinerary processed successfully',
        },
        { status: 200 }
      )
    } else {
      // Partial success (validation failed but entry created)
      return NextResponse.json(
        {
          success: false,
          payloadId: result.payloadId,
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

    // Return error response
    return NextResponse.json(
      {
        success: false,
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
