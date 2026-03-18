import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export const dynamic = 'force-dynamic'

/**
 * Content Engine project management endpoint.
 * POST: Create a new content project
 * GET: Fetch a project by ID (?id=123) or list projects (?stage=idea)
 * PATCH: Update project fields (?id=123)
 */

async function authenticate(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const authHeader = request.headers.get('Authorization')
  const bearerOk =
    authHeader?.startsWith('Bearer ') &&
    authHeader.slice(7) === process.env.CONTENT_SYSTEM_SECRET
  if (!bearerOk) {
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) return null
  }
  return payload
}

export async function POST(request: Request) {
  const payload = await authenticate(request)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const project = await payload.create({
      collection: 'content-projects',
      data: body,
      overrideAccess: true,
    })
    return NextResponse.json({ id: project.id, slug: project.slug, stage: project.stage })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function GET(request: Request) {
  const payload = await authenticate(request)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    try {
      const project = await payload.findByID({
        collection: 'content-projects',
        id: Number(id),
        overrideAccess: true,
        depth: 1,
      })
      return NextResponse.json(project)
    } catch (error) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
  }

  // List projects with optional stage filter
  const stage = searchParams.get('stage')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (stage) {
    where.stage = { equals: stage }
  }

  const result = await payload.find({
    collection: 'content-projects',
    where,
    overrideAccess: true,
    limit: 100,
    sort: '-createdAt',
  })

  return NextResponse.json({ docs: result.docs, totalDocs: result.totalDocs })
}

export async function PATCH(request: Request) {
  const payload = await authenticate(request)
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'id query parameter required' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const project = await payload.update({
      collection: 'content-projects',
      id: Number(id),
      data: body,
      overrideAccess: true,
    })
    return NextResponse.json({ id: project.id, stage: project.stage, processingStatus: project.processingStatus })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
