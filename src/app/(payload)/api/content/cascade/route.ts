import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { runCascade } from '../../../../../../content-system/cascade/cascade-orchestrator'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Auth: Bearer CONTENT_SYSTEM_SECRET
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== process.env.CONTENT_SYSTEM_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let itineraryId: number
  let dryRun = false
  try {
    const body = await request.json()
    itineraryId = body.itineraryId
    dryRun = body.dryRun === true
    if (!itineraryId || typeof itineraryId !== 'number') {
      return NextResponse.json({ error: 'itineraryId (number) is required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  // Create ContentJob
  let jobId: number | undefined
  try {
    const job = await payload.create({
      collection: 'content-jobs',
      data: {
        jobType: 'cascade',
        status: 'running',
        itineraryId,
        startedAt: new Date().toISOString(),
        createdBy: 'manual',
        progress: { totalSteps: 5, currentStep: 0 },
      },
    })
    jobId = (job as unknown as { id: number }).id
  } catch (err) {
    console.error('[cascade] Failed to create ContentJob:', err)
    // Continue without job tracking
  }

  try {
    const result = await runCascade({ itineraryId, dryRun, jobId })

    // Update job to completed if no error
    if (jobId && !result.error) {
      try {
        await payload.update({
          collection: 'content-jobs',
          id: jobId,
          data: {
            status: 'completed',
            completedAt: new Date().toISOString(),
          },
        })
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      success: !result.error,
      jobId,
      result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[cascade] Failed for itinerary ${itineraryId}:`, message)

    if (jobId) {
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
    }

    return NextResponse.json(
      { success: false, error: message, jobId },
      { status: 500 },
    )
  }
}
