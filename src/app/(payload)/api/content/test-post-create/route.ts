import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const dynamic = 'force-dynamic'

function makeTextLexical(text: string) {
  return {
    root: {
      type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
      children: [{
        type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr',
        textFormat: 0, textStyle: '',
        children: [{ type: 'text', format: 0, text, detail: 0, mode: 'normal', style: '', version: 1 }],
      }],
    },
  }
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (token !== process.env.CONTENT_SYSTEM_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const mode = (body as Record<string, unknown>).mode || 'minimal'
  const payload = await getPayload({ config })
  const steps: string[] = []
  const ts = Date.now()

  try {
    const postData: Record<string, unknown> = {
      title: `Diag ${mode} ${ts}`,
      slug: `diag-${mode}-${ts}`,
      content: makeTextLexical('Test content paragraph.'),
      _status: 'published',
      publishedAt: new Date().toISOString(),
    }

    if (mode === 'faq' || mode === 'full') {
      postData.faqItems = [
        { question: 'Test Q1?', answer: makeTextLexical('Answer one.') },
        { question: 'Test Q2?', answer: makeTextLexical('Answer two.') },
      ]
      steps.push('added faqItems')
    }

    if (mode === 'meta' || mode === 'full') {
      postData.meta = {
        title: 'Test Meta Title',
        description: 'Test meta description for diagnostics.',
      }
      steps.push('added meta')
    }

    if (mode === 'publisher') {
      steps.push('calling publishArticle via dynamic import')
      const { publishArticle } = await import('../../../../../../content-system/publishing/article-publisher')
      const result = await publishArticle(79)
      steps.push(`publishArticle returned: ${JSON.stringify(result)}`)

      // Verify persistence
      try {
        const readBack = await payload.findByID({ collection: 'posts', id: result.targetId, depth: 0 })
        steps.push(`findByID OK: id=${readBack.id}, title=${readBack.title}`)
      } catch (readErr) {
        steps.push(`findByID FAILED: ${readErr instanceof Error ? readErr.message : String(readErr)}`)
      }
      return NextResponse.json({ success: true, result, steps })
    }

    steps.push(`calling payload.create() mode=${mode}`)
    const created = await payload.create({
      collection: 'posts',
      data: postData as any,
      overrideAccess: true,
      context: { skipSearchSync: true, disableRevalidate: true },
    })
    steps.push(`create returned id=${created.id}`)

    try {
      const readBack = await payload.findByID({ collection: 'posts', id: created.id, depth: 0 })
      steps.push(`findByID OK: id=${readBack.id}, title=${readBack.title}`)
    } catch (readErr) {
      steps.push(`findByID FAILED: ${readErr instanceof Error ? readErr.message : String(readErr)}`)
    }

    return NextResponse.json({ success: true, createdId: created.id, steps })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack?.split('\n').slice(0, 8).join('\n') : undefined
    steps.push(`FAILED: ${message}`)
    return NextResponse.json({ error: message, stack, steps }, { status: 500 })
  }
}
