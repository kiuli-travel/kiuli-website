import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (token !== process.env.CONTENT_SYSTEM_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const steps: string[] = []

  try {
    // Step 1: Minimal post create
    steps.push('step1: calling payload.create()')
    const created = await payload.create({
      collection: 'posts',
      data: {
        title: 'Diagnostic Test Post',
        slug: 'diagnostic-test-post-' + Date.now(),
        content: {
          root: {
            children: [
              {
                children: [{ text: 'Test content.', type: 'text', version: 1 }],
                type: 'paragraph',
                version: 1,
              },
            ],
            direction: 'ltr',
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        },
        _status: 'published',
        publishedAt: new Date().toISOString(),
      } as any,
      overrideAccess: true,
      context: { skipSearchSync: true, disableRevalidate: true },
    })
    steps.push(`step2: create returned id=${created.id}`)

    // Step 2: Immediately read back
    try {
      const readBack = await payload.findByID({
        collection: 'posts',
        id: created.id,
        depth: 0,
      })
      steps.push(`step3: findByID returned id=${readBack.id}, title=${readBack.title}`)
    } catch (readErr) {
      steps.push(`step3: findByID FAILED: ${readErr instanceof Error ? readErr.message : String(readErr)}`)
    }

    return NextResponse.json({ success: true, createdId: created.id, steps })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    steps.push(`FAILED: ${message}`)
    return NextResponse.json({ error: message, stack, steps }, { status: 500 })
  }
}
