import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { checkSources } from '../../../../../../content-system/signals/source-monitor'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // Auth: Bearer CONTENT_SYSTEM_SECRET
  const authHeader = request.headers.get('Authorization')
  if (
    !authHeader?.startsWith('Bearer ') ||
    authHeader.slice(7) !== process.env.CONTENT_SYSTEM_SECRET
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config: configPromise })

  // Create ContentJob to track this execution (matching cascade/decompose pattern)
  let jobId: number | undefined
  try {
    const job = await payload.create({
      collection: 'content-jobs',
      data: {
        jobType: 'source_monitor',
        status: 'running',
        startedAt: new Date().toISOString(),
        createdBy: 'schedule',
        progress: { totalSteps: 1, currentStep: 0 },
      },
    })
    jobId = (job as unknown as { id: number }).id
  } catch (err) {
    console.error('[source-monitor] Failed to create ContentJob:', err)
  }

  try {
    const results = await checkSources()

    const totalItemsFound = results.reduce((s, r) => s + r.itemsFound, 0)
    const totalNewItems = results.reduce((s, r) => s + r.newItems, 0)
    const totalProjectsCreated = results.reduce((s, r) => s + r.projectsCreated, 0)
    const errors = results.filter((r) => r.error)

    // Update job to completed
    if (jobId) {
      try {
        await payload.update({
          collection: 'content-jobs',
          id: jobId,
          data: {
            status: errors.length > 0 && errors.length === results.length ? 'failed' : 'completed',
            completedAt: new Date().toISOString(),
            error: errors.length > 0
              ? errors.map((e) => `${e.sourceName}: ${e.error}`).join('; ')
              : null,
          },
        })
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      success: true,
      jobId,
      summary: {
        sourcesChecked: results.length,
        totalItemsFound,
        totalNewItems,
        totalProjectsCreated,
        errors: errors.length,
      },
      results,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[source-monitor] Failed:', message)

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

    return NextResponse.json({ error: message, jobId }, { status: 500 })
  }
}
