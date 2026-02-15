import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { compileResearch } from '../../../../../../content-system/research/research-compiler'
import { markdownToLexical } from '../../../../../../content-system/conversation/lexical-utils'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

const ARTICLE_TYPES = ['itinerary_cluster', 'authority', 'designer_insight']

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })

  // Auth: Payload session or Bearer token
  const authHeader = request.headers.get('Authorization')
  const bearerOk =
    authHeader?.startsWith('Bearer ') &&
    authHeader.slice(7) === process.env.CONTENT_SYSTEM_SECRET
  if (!bearerOk) {
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let projectId: number
  try {
    const body = await request.json()
    projectId = body.projectId
    if (!projectId || typeof projectId !== 'number') {
      return NextResponse.json(
        { error: 'projectId (number) is required' },
        { status: 400 },
      )
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Fetch the project
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let project: any
  try {
    project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    })
  } catch {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  // Validate: must be article type at research stage
  if (!ARTICLE_TYPES.includes(project.contentType)) {
    return NextResponse.json(
      { error: `Invalid content type: ${project.contentType}. Only articles can be researched.` },
      { status: 400 },
    )
  }
  if (project.stage !== 'research') {
    return NextResponse.json(
      { error: `Project must be at 'research' stage, currently at '${project.stage}'` },
      { status: 400 },
    )
  }

  // Set processing status
  try {
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        processingStatus: 'processing',
        processingStartedAt: new Date().toISOString(),
        processingError: '',
      },
    })
  } catch {
    // continue anyway
  }

  try {
    // Build query from project fields
    const destinations: string[] = Array.isArray(project.destinations)
      ? project.destinations
      : typeof project.destinations === 'string'
        ? JSON.parse(project.destinations || '[]')
        : []

    const compilation = await compileResearch({
      projectId: String(projectId),
      query: {
        topic: project.title || '',
        angle: project.targetAngle || '',
        destinations,
        contentType: project.contentType || '',
      },
    })

    // Convert synthesis and existing content to Lexical richText
    const synthesisRichText = markdownToLexical(compilation.synthesis)
    const existingContentRichText = markdownToLexical(
      compilation.existingSiteContent || '(No existing content found)',
    )

    // Build sources array for Payload
    const sourcesArray = compilation.sources.map((s) => ({
      title: s.title,
      url: s.url,
      credibility: s.credibility,
      notes: s.snippet || '',
    }))

    // Build uncertainty map for Payload
    const uncertaintyArray = compilation.uncertaintyMap.map((u) => ({
      claim: u.claim,
      confidence: u.confidence,
      notes: u.notes,
    }))

    // Write results to ContentProject
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        synthesis: synthesisRichText,
        existingSiteContent: existingContentRichText,
        sources: sourcesArray,
        uncertaintyMap: uncertaintyArray,
        processingStatus: 'completed',
        processingError: '',
      },
    })

    return NextResponse.json({
      success: true,
      projectId,
      sourceCount: sourcesArray.length,
      uncertaintyCount: uncertaintyArray.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[research] Failed for project ${projectId}:`, message)

    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: {
          processingStatus: 'failed',
          processingError: message,
        },
      })
    } catch {
      // ignore
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    )
  }
}
