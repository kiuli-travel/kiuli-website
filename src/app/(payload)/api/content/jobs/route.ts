import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import { runCascade } from '../../../../../../content-system/cascade/cascade-orchestrator'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

function authenticate(request: Request): boolean {
  const authHeader = request.headers.get('Authorization')
  return !!(authHeader?.startsWith('Bearer ') && authHeader.slice(7) === process.env.CONTENT_SYSTEM_SECRET)
}

/** GET: List jobs with optional filters (?type=cascade&status=failed&limit=20) */
export async function GET(request: Request) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const type = url.searchParams.get('type')
  const status = url.searchParams.get('status')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100)

  const payload = await getPayload({ config: configPromise })

  const conditions: Where[] = []
  if (type) conditions.push({ jobType: { equals: type } })
  if (status) conditions.push({ status: { equals: status } })

  const where: Where = conditions.length > 0 ? { and: conditions } : {}

  const result = await payload.find({
    collection: 'content-jobs',
    where,
    limit,
    sort: '-createdAt',
    depth: 0,
  })

  return NextResponse.json({
    jobs: result.docs,
    totalDocs: result.totalDocs,
  })
}

/** PATCH: Retry a failed job by ID (body: { jobId }) */
export async function PATCH(request: Request) {
  if (!authenticate(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let jobId: number
  try {
    const body = await request.json()
    jobId = body.jobId
    if (!jobId || typeof jobId !== 'number') {
      return NextResponse.json({ error: 'jobId (number) is required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  // Load the job
  let job: Record<string, unknown>
  try {
    job = await payload.findByID({
      collection: 'content-jobs',
      id: jobId,
      depth: 0,
    }) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: `Job ${jobId} not found` }, { status: 404 })
  }

  if (job.status !== 'failed') {
    return NextResponse.json({ error: 'Only failed jobs can be retried' }, { status: 400 })
  }

  const retriedCount = (job.retriedCount as number) || 0
  const maxRetries = (job.maxRetries as number) || 2
  if (retriedCount >= maxRetries) {
    return NextResponse.json({ error: `Max retries (${maxRetries}) reached` }, { status: 400 })
  }

  // Get itinerary ID from the job
  const itineraryId = typeof job.itineraryId === 'number'
    ? job.itineraryId
    : typeof job.itineraryId === 'object' && job.itineraryId !== null
      ? (job.itineraryId as { id: number }).id
      : null

  if (!itineraryId) {
    return NextResponse.json({ error: 'Job has no itineraryId' }, { status: 400 })
  }

  // Reset job for retry
  await payload.update({
    collection: 'content-jobs',
    id: jobId,
    data: {
      status: 'running',
      error: null,
      retriedCount: retriedCount + 1,
      startedAt: new Date().toISOString(),
      completedAt: null,
    },
  })

  try {
    const result = await runCascade({
      itineraryId: itineraryId as number,
      jobId,
    })

    if (!result.error) {
      await payload.update({
        collection: 'content-jobs',
        id: jobId,
        data: {
          status: 'completed',
          completedAt: new Date().toISOString(),
        },
      })
    }

    return NextResponse.json({
      success: !result.error,
      jobId,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await payload.update({
        collection: 'content-jobs',
        id: jobId,
        data: {
          status: 'failed',
          error: message,
          completedAt: new Date().toISOString(),
        },
      })
    } catch {
      // ignore
    }
    return NextResponse.json(
      { success: false, error: message, jobId },
      { status: 500 },
    )
  }
}
