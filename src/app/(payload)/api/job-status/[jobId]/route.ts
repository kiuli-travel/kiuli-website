import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  const payload = await getPayload({ config })

  try {
    const job = await payload.findByID({
      collection: 'itinerary-jobs',
      id: jobId,
    })

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      currentPhase: job.currentPhase,
      detail: {
        totalImages: job.totalImages,
        processedImages: job.processedImages,
        skippedImages: job.skippedImages,
        failedImages: job.failedImages,
      },
      timing: job.timings,
      payloadId: job.payloadId,
      error: job.errorMessage,
      errorPhase: job.errorPhase,
      startedAt: job.createdAt,
      completedAt: job.completedAt,
      duration: job.duration,
    })
  } catch (error) {
    console.error('[job-status] Error fetching job:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
