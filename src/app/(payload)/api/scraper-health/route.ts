import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Scraper Health Check Endpoint
 *
 * Returns pipeline status information:
 * - Last successful scrape timestamp
 * - Jobs by status
 * - Stuck jobs (processing > 30 minutes)
 * - Media statistics
 */

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

  // Check for API-Key auth format
  if (authHeader?.startsWith('users API-Key ')) {
    const token = authHeader.slice(14)
    if (token === process.env.PAYLOAD_API_KEY) {
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

export async function GET(request: NextRequest) {
  // Validate authentication (session or API key)
  if (!(await validateAuth(request))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    )
  }

  const payload = await getPayload({ config })

  try {
    // 1. Get job counts by status
    const [pendingJobs, processingJobs, completedJobs, failedJobs] = await Promise.all([
      payload.count({ collection: 'itinerary-jobs', where: { status: { equals: 'pending' } } }),
      payload.count({ collection: 'itinerary-jobs', where: { status: { equals: 'processing' } } }),
      payload.count({ collection: 'itinerary-jobs', where: { status: { equals: 'completed' } } }),
      payload.count({ collection: 'itinerary-jobs', where: { status: { equals: 'failed' } } }),
    ])

    // 2. Get last successful scrape
    const lastCompleted = await payload.find({
      collection: 'itinerary-jobs',
      where: { status: { equals: 'completed' } },
      sort: '-completedAt',
      limit: 1,
    })

    const lastSuccessfulScrape = lastCompleted.docs[0]?.completedAt || null

    // 3. Find stuck jobs (processing for > 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const stuckJobs = await payload.find({
      collection: 'itinerary-jobs',
      where: {
        and: [
          { status: { equals: 'processing' } },
          { startedAt: { less_than: thirtyMinutesAgo } },
        ],
      },
      limit: 10,
    })

    // 4. Get media statistics
    const [totalMedia, pendingLabeling, completedMedia] = await Promise.all([
      payload.count({ collection: 'media' }),
      payload.count({ collection: 'media', where: { labelingStatus: { equals: 'pending' } } }),
      payload.count({ collection: 'media', where: { processingStatus: { equals: 'complete' } } }),
    ])

    // 5. Get recent errors
    const recentFailures = await payload.find({
      collection: 'itinerary-jobs',
      where: { status: { equals: 'failed' } },
      sort: '-failedAt',
      limit: 5,
    })

    const recentErrors = recentFailures.docs.map((job) => ({
      jobId: job.id,
      error: job.errorMessage || 'Unknown error',
      phase: job.errorPhase || 'unknown',
      failedAt: job.failedAt,
    }))

    // Calculate health status
    const isHealthy = stuckJobs.docs.length === 0 && failedJobs.totalDocs < 3
    const healthStatus = isHealthy ? 'healthy' : stuckJobs.docs.length > 0 ? 'degraded' : 'warning'

    return NextResponse.json({
      status: healthStatus,
      timestamp: new Date().toISOString(),

      jobs: {
        pending: pendingJobs.totalDocs,
        processing: processingJobs.totalDocs,
        completed: completedJobs.totalDocs,
        failed: failedJobs.totalDocs,
      },

      lastSuccessfulScrape,

      stuckJobs: stuckJobs.docs.map((job) => ({
        jobId: job.id,
        currentPhase: job.currentPhase,
        startedAt: job.startedAt,
        progress: job.progress,
      })),

      media: {
        total: totalMedia.totalDocs,
        pendingLabeling: pendingLabeling.totalDocs,
        completed: completedMedia.totalDocs,
      },

      recentErrors: recentErrors.length > 0 ? recentErrors : undefined,
    })
  } catch (error) {
    console.error('[scraper-health] Error:', error)
    return NextResponse.json(
      {
        status: 'error',
        success: false,
        error: 'Failed to fetch health status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
