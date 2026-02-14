import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { query } from '../../../../../../content-system/db'

export const dynamic = 'force-dynamic'

const DB_STAGE_TO_DISPLAY: Record<string, string> = {
  idea: 'ideas',
  brief: 'briefs',
  research: 'research',
  draft: 'drafts',
  review: 'review',
  published: 'published',
  filtered: 'filtered',
}

function computeDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '--'
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const seconds = Math.floor((end - start) / 1000)
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m ${String(remaining).padStart(2, '0')}s`
}

export async function GET(request: Request) {
  const payload = await getPayload({ config: configPromise })

  // Authenticate via Payload session or Bearer token (for content-system scripts)
  const authHeader = request.headers.get('Authorization')
  const bearerOk = authHeader?.startsWith('Bearer ') && authHeader.slice(7) === process.env.CONTENT_SYSTEM_SECRET
  if (!bearerOk) {
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // 1. Fetch projects
    const projectsResult = await payload.find({
      collection: 'content-projects',
      limit: 500,
      sort: '-updatedAt',
      depth: 0,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projects = (projectsResult.docs as any[]).map((doc) => {
      const dbStage = (doc.stage as string) || 'idea'
      const destinations = doc.destinations as string[] | null
      let destinationNames: string[] = []
      if (Array.isArray(destinations)) {
        destinationNames = destinations
      } else if (typeof destinations === 'string') {
        try {
          destinationNames = JSON.parse(destinations)
        } catch {
          destinationNames = []
        }
      }

      return {
        id: String(doc.id),
        title: (doc.title as string) || 'Untitled',
        contentType: doc.contentType || 'itinerary_cluster',
        stage: DB_STAGE_TO_DISPLAY[dbStage] || 'ideas',
        origin: (doc.originPathway as string) || 'itinerary',
        processingStatus: (doc.processingStatus as string) || 'idle',
        errorMessage: (doc.processingError as string) || undefined,
        filterReason: (doc.filterReason as string) || undefined,
        destinationNames,
        createdAt: doc.updatedAt || doc.createdAt,
      }
    })

    // 2. Compute stage counts
    const stageCounts: Record<string, number> = {
      ideas: 0,
      briefs: 0,
      research: 0,
      drafts: 0,
      review: 0,
      published: 0,
      filtered: 0,
    }
    for (const p of projects) {
      if (stageCounts[p.stage] !== undefined) {
        stageCounts[p.stage]++
      }
    }

    // 3. Fetch jobs
    const jobsResult = await payload.find({
      collection: 'content-jobs',
      limit: 20,
      sort: '-createdAt',
      depth: 0,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jobs = (jobsResult.docs as any[]).map((doc) => {
      const itineraryId = typeof doc.itineraryId === 'number'
        ? doc.itineraryId
        : typeof doc.itineraryId === 'object' && doc.itineraryId !== null
          ? (doc.itineraryId as { id: number }).id
          : null

      return {
        id: String(doc.id),
        type: doc.jobType || 'cascade',
        status: doc.status === 'pending' ? 'running' : (doc.status || 'completed'),
        itinerary: itineraryId ? `Itinerary #${itineraryId}` : '--',
        duration: computeDuration(
          doc.startedAt as string | null,
          doc.completedAt as string | null,
        ),
        error: (doc.error as string) || undefined,
      }
    })

    // 4. Embeddings — raw SQL
    let embeddingsTotal = 0
    let embeddingsGroups: { type: string; count: number }[] = []
    let embeddingsLastUpdated: string | null = null

    try {
      const embGroupResult = await query(
        'SELECT chunk_type, COUNT(*)::int as count FROM content_embeddings GROUP BY chunk_type',
      )
      embeddingsGroups = embGroupResult.rows.map((r) => ({
        type: String(r.chunk_type),
        count: Number(r.count),
      }))
      embeddingsTotal = embeddingsGroups.reduce((sum, g) => sum + g.count, 0)

      const embLastResult = await query(
        'SELECT created_at FROM content_embeddings ORDER BY created_at DESC LIMIT 1',
      )
      if (embLastResult.rows.length > 0) {
        embeddingsLastUpdated = embLastResult.rows[0].created_at
      }
    } catch {
      // Embeddings table may not exist yet
    }

    // 5. Stale projects — raw SQL (not updated in 7+ days)
    let staleTotal = 0
    let staleBreakdown: { stage: string; count: number }[] = []

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const staleResult = await query(
        `SELECT stage, COUNT(*)::int as count FROM content_projects
         WHERE stage NOT IN ('published', 'rejected', 'filtered')
         AND updated_at < $1 GROUP BY stage`,
        [sevenDaysAgo],
      )
      staleBreakdown = staleResult.rows.map((r) => ({
        stage: DB_STAGE_TO_DISPLAY[r.stage] || r.stage,
        count: Number(r.count),
      }))
      staleTotal = staleBreakdown.reduce((sum, b) => sum + b.count, 0)
    } catch {
      // Table may not exist
    }

    // 6. Failed operations count
    let failedOperations = 0
    try {
      const failedResult = await query(
        `SELECT COUNT(*)::int as count FROM content_projects WHERE processing_status = 'failed'`,
      )
      failedOperations = Number(failedResult.rows[0]?.count || 0)
    } catch {
      // ignore
    }

    // 7. Directives
    let directivesTotal = 0
    let pastReviewDate = 0
    let zeroFilterHits = 0

    try {
      const directivesResult = await payload.find({
        collection: 'editorial-directives',
        where: { active: { equals: true } },
        limit: 200,
        depth: 0,
      })

      directivesTotal = directivesResult.totalDocs
      const now = new Date()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const doc of directivesResult.docs as any[]) {
        if (doc.reviewAfter && new Date(doc.reviewAfter as string) < now) {
          pastReviewDate++
        }
        if (doc.filterCount30d === 0) {
          zeroFilterHits++
        }
      }
    } catch {
      // ignore
    }

    return NextResponse.json({
      projects,
      stageCounts,
      jobs,
      metrics: {
        embeddings: {
          total: embeddingsTotal,
          groups: embeddingsGroups,
          lastUpdated: embeddingsLastUpdated,
        },
        staleProjects: {
          total: staleTotal,
          breakdown: staleBreakdown,
        },
        failedOperations,
        directives: {
          totalActive: directivesTotal,
          pastReviewDate,
          zeroFilterHits,
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
