import { NextRequest, NextResponse } from 'next/server'
import { getPayload, Payload } from 'payload'
import config from '@payload-config'
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'
import type { ItineraryJob } from '@/payload-types'

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

export async function POST(
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

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const { action } = body

  if (!action || !['cancel', 'retry', 'retry-failed'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'Invalid action. Must be: cancel, retry, or retry-failed' },
      { status: 400 }
    )
  }

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

    switch (action) {
      case 'cancel':
        return await handleCancel(payload, job)
      case 'retry':
        return await handleRetry(payload, job)
      case 'retry-failed':
        return await handleRetryFailed(payload, job)
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('[job-control] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process action' },
      { status: 500 }
    )
  }
}

async function handleCancel(payload: Payload, job: ItineraryJob) {
  // Only allow cancel for pending or processing jobs
  if (!['pending', 'processing'].includes(job.status)) {
    return NextResponse.json(
      { success: false, error: `Cannot cancel job with status: ${job.status}` },
      { status: 400 }
    )
  }

  await payload.update({
    collection: 'itinerary-jobs',
    id: job.id,
    data: {
      status: 'failed',
      errorMessage: 'Cancelled by user',
      errorPhase: job.currentPhase,
    },
  })

  // Create notification
  await payload.create({
    collection: 'notifications',
    data: {
      type: 'warning',
      message: `Job cancelled: ${job.itrvlUrl}`,
      job: job.id,
      read: false,
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Job cancelled',
    jobId: job.id,
  })
}

async function handleRetry(payload: Payload, job: ItineraryJob) {
  // Allow retry for failed or completed jobs
  if (job.status !== 'failed' && job.status !== 'completed') {
    return NextResponse.json(
      { success: false, error: `Cannot re-run job with status: ${job.status}. Only failed or completed jobs can be re-run.` },
      { status: 400 }
    )
  }

  // Save current run to history and increment version
  const currentVersion = job.version || 1
  const previousVersions = job.previousVersions || []

  // Add current run to history
  const previousRun = {
    version: currentVersion,
    completedAt: job.completedAt || job.failedAt || new Date().toISOString(),
    status: job.status,
  }

  // Reset job state with incremented version
  await payload.update({
    collection: 'itinerary-jobs',
    id: job.id,
    data: {
      status: 'pending',
      currentPhase: 'Queued (Re-run)',
      progress: 0,
      errorMessage: null,
      errorPhase: null,
      processedImages: 0,
      skippedImages: 0,
      failedImages: 0,
      startedAt: new Date().toISOString(),
      completedAt: null,
      failedAt: null,
      version: currentVersion + 1,
      previousVersions: [...previousVersions, previousRun],
    },
  })

  // Trigger Step Functions state machine
  const stateMachineArn = process.env.STEP_FUNCTION_ARN

  if (!stateMachineArn) {
    return NextResponse.json(
      { success: false, error: 'STEP_FUNCTION_ARN not configured' },
      { status: 500 }
    )
  }

  try {
    const executionName = `job-${job.id}-retry-${Date.now()}`

    await getSfnClient().send(
      new StartExecutionCommand({
        stateMachineArn,
        name: executionName,
        input: JSON.stringify({
          jobId: job.id,
          itrvlUrl: job.itrvlUrl,
          itineraryId: job.itineraryId,
          accessKey: job.accessKey,
          mode: 'create',
          retry: true,
        }),
      })
    )
  } catch (err) {
    console.error('[job-control] Failed to trigger re-run:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to trigger re-run' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: 'Job re-run started',
    jobId: job.id,
  })
}

interface ImageStatus {
  sourceS3Key: string
  status: string
  mediaId?: number | string
  error?: string
}

// Extended type for jobs that may still have legacy imageStatuses field
interface ItineraryJobWithImageStatuses extends ItineraryJob {
  imageStatuses?: ImageStatus[]
}

async function handleRetryFailed(payload: Payload, job: ItineraryJobWithImageStatuses) {
  // Only allow retry-failed for completed jobs with failed images
  if (job.status !== 'completed' && job.status !== 'failed') {
    return NextResponse.json(
      { success: false, error: 'Can only retry failed images on completed or failed jobs' },
      { status: 400 }
    )
  }

  const imageStatuses = job.imageStatuses || []
  const failedImages = imageStatuses.filter((img) => img.status === 'failed')

  if (failedImages.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No failed images to retry' },
      { status: 400 }
    )
  }

  // Reset failed images to pending
  const updatedStatuses = imageStatuses.map((img) => {
    if (img.status === 'failed') {
      return { ...img, status: 'pending', error: null }
    }
    return img
  })

  await payload.update({
    collection: 'itinerary-jobs',
    id: job.id,
    // imageStatuses may still exist on some legacy jobs even though it's been moved to separate collection
    data: {
      status: 'processing',
      currentPhase: 'Phase 2: Retrying Failed Images',
      imageStatuses: updatedStatuses,
      failedImages: 0,
    } as Record<string, unknown>,
  })

  // Trigger Step Functions for retry (starts at image processing step)
  const stateMachineArn = process.env.STEP_FUNCTION_ARN

  if (!stateMachineArn) {
    return NextResponse.json(
      { success: false, error: 'STEP_FUNCTION_ARN not configured' },
      { status: 500 }
    )
  }

  try {
    const executionName = `job-${job.id}-retry-failed-${Date.now()}`

    await getSfnClient().send(
      new StartExecutionCommand({
        stateMachineArn,
        name: executionName,
        input: JSON.stringify({
          jobId: job.id,
          itineraryId: job.processedItinerary || job.payloadId,
          retryFailed: true,
        }),
      })
    )
  } catch (err) {
    console.error('[job-control] Failed to trigger image retry:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to trigger image retry' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    message: `Retrying ${failedImages.length} failed images`,
    jobId: job.id,
    retryCount: failedImages.length,
  })
}

// Prevent this route from being statically optimized
export const dynamic = 'force-dynamic'
