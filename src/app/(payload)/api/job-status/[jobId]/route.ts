import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { ItineraryJob } from '@/payload-types'

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

interface ImageStatus {
  sourceS3Key: string
  status: string
  mediaId?: number | string
  error?: string
  startedAt?: string
  completedAt?: string
}

// Extended interface for job with legacy/optional fields not in generated types
interface ItineraryJobExtended extends ItineraryJob {
  imageStatuses?: ImageStatus[]
  phase1CompletedAt?: string | null
  phase2CompletedAt?: string | null
  phase3CompletedAt?: string | null
  phase4CompletedAt?: string | null
  notes?: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // Validate authentication (session or API key)
  if (!(await validateAuth(request))) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    )
  }

  const { jobId } = await params

  const payload = await getPayload({ config })

  try {
    const job = await payload.findByID({
      collection: 'itinerary-jobs',
      id: jobId,
    }) as ItineraryJobExtended | null

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    // Extract failed images from imageStatuses
    const imageStatuses = job.imageStatuses || []
    const failedItems = imageStatuses
      .filter((img) => img.status === 'failed')
      .map((img) => ({
        sourceS3Key: img.sourceS3Key,
        error: img.error || 'Unknown error',
      }))

    // Calculate estimated time remaining
    let estimatedTimeRemaining: number | null = null
    const processedCount =
      (job.processedImages || 0) + (job.skippedImages || 0) + (job.failedImages || 0)
    const totalImages = job.totalImages || 0

    if (job.status === 'processing' && processedCount > 0 && totalImages > processedCount) {
      const startTime = job.startedAt ? new Date(job.startedAt).getTime() : new Date(job.createdAt).getTime()
      const elapsed = (Date.now() - startTime) / 1000
      const ratePerImage = elapsed / processedCount
      const remaining = totalImages - processedCount
      estimatedTimeRemaining = Math.round(ratePerImage * remaining)
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      currentPhase: job.currentPhase,

      // V6 detailed image tracking
      images: {
        total: job.totalImages || 0,
        processed: job.processedImages || 0,
        skipped: job.skippedImages || 0,
        failed: job.failedImages || 0,
        labeled: job.imagesLabeled || 0,
      },

      // Failed items for resolution
      failedItems: failedItems.length > 0 ? failedItems : undefined,

      // V6 phase timestamps
      phases: {
        phase1CompletedAt: job.phase1CompletedAt || null,
        phase2CompletedAt: job.phase2CompletedAt || null,
        phase3CompletedAt: job.phase3CompletedAt || null,
        phase4CompletedAt: job.phase4CompletedAt || null,
      },

      // Timing info
      timing: {
        startedAt: job.startedAt || job.createdAt,
        completedAt: job.completedAt || null,
        duration: job.duration || null,
        estimatedTimeRemaining,
      },

      // Result info
      payloadId: job.payloadId || null,
      processedItinerary: job.processedItinerary || null,

      // Error info
      error: job.errorMessage || null,
      errorPhase: job.errorPhase || null,

      // Notes (used for final status details)
      notes: job.notes || null,
    })
  } catch (error) {
    // Payload throws NotFound error when ID doesn't exist
    if (error instanceof Error &&
        (error.message.includes('not found') || error.message.includes('Not Found'))) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    console.error('[job-status] Error fetching job:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
