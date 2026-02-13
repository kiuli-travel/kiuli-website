import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { chunkContent } from '../../../../../../content-system/embeddings/chunker'
import { embedChunks, deleteProjectEmbeddings } from '../../../../../../content-system/embeddings/embedder'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== process.env.CONTENT_SYSTEM_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let contentProjectId: number
  try {
    const body = await request.json()
    contentProjectId = body.contentProjectId
    if (!contentProjectId || typeof contentProjectId !== 'number') {
      return NextResponse.json({ error: 'contentProjectId (number) is required' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = await getPayload({ config: configPromise })

  let project: Record<string, unknown>
  try {
    project = await payload.findByID({
      collection: 'content-projects',
      id: contentProjectId,
      depth: 0,
    }) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: `ContentProject ${contentProjectId} not found` }, { status: 404 })
  }

  try {
    await payload.updateGlobal({
      slug: 'content-system-settings',
      data: {},
    }).catch(() => {})

    await payload.update({
      collection: 'content-projects',
      id: contentProjectId,
      data: {
        processingStatus: 'processing',
        processingStartedAt: new Date().toISOString(),
        processingError: null,
      },
    })

    const deleted = await deleteProjectEmbeddings(contentProjectId)
    if (deleted > 0) {
      console.log(`Deleted ${deleted} existing embeddings for project ${contentProjectId}`)
    }

    const chunks = chunkContent({
      sourceCollection: 'content-projects',
      sourceId: String(contentProjectId),
      content: project,
    })

    let records: Awaited<ReturnType<typeof embedChunks>> = []
    if (chunks.length > 0) {
      records = await embedChunks({ chunks })
    }

    await payload.update({
      collection: 'content-projects',
      id: contentProjectId,
      data: {
        processingStatus: 'completed',
        processingError: null,
      },
    })

    return NextResponse.json({
      contentProjectId,
      chunks: records.length,
      chunkTypes: chunks.map(c => c.chunkType),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`Embed failed for project ${contentProjectId}:`, message)

    try {
      await payload.update({
        collection: 'content-projects',
        id: contentProjectId,
        data: {
          processingStatus: 'failed',
          processingError: message,
        },
      })
    } catch {
      // ignore update failure
    }

    return NextResponse.json(
      { status: 'error', error: message, contentProjectId },
      { status: 500 },
    )
  }
}
