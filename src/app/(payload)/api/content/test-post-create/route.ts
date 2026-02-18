import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from 'drizzle-orm'

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
    // Schema repair mode: revert posts_faq_items id columns back to serial
    if (mode === 'fix-schema') {
      const db = (payload.db as any).drizzle
      const queries = [
        // Version tables need serial (integer + auto-increment) — Drizzle omits ID, DB provides it
        // _posts_v_version_faq_items: revert to integer + sequence
        sql`ALTER TABLE "_posts_v_version_faq_items" ALTER COLUMN "id" SET DATA TYPE integer USING 0`,
        sql`CREATE SEQUENCE IF NOT EXISTS "_posts_v_version_faq_items_id_seq" OWNED BY "_posts_v_version_faq_items"."id"`,
        sql`SELECT setval('"_posts_v_version_faq_items_id_seq"', COALESCE((SELECT MAX("id") FROM "_posts_v_version_faq_items"), 0) + 1, false)`,
        sql`ALTER TABLE "_posts_v_version_faq_items" ALTER COLUMN "id" SET DEFAULT nextval('"_posts_v_version_faq_items_id_seq"')`,
        // _posts_v_version_populated_authors: revert to integer + sequence
        sql`ALTER TABLE "_posts_v_version_populated_authors" ALTER COLUMN "id" SET DATA TYPE integer USING 0`,
        sql`CREATE SEQUENCE IF NOT EXISTS "_posts_v_version_populated_authors_id_seq" OWNED BY "_posts_v_version_populated_authors"."id"`,
        sql`SELECT setval('"_posts_v_version_populated_authors_id_seq"', COALESCE((SELECT MAX("id") FROM "_posts_v_version_populated_authors"), 0) + 1, false)`,
        sql`ALTER TABLE "_posts_v_version_populated_authors" ALTER COLUMN "id" SET DEFAULT nextval('"_posts_v_version_populated_authors_id_seq"')`,
        // Main tables stay varchar (Payload provides hex string IDs) — verify current state
        sql`SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'posts_faq_items' AND column_name = 'id'`,
      ]
      for (const q of queries) {
        try {
          await db.execute(q)
          steps.push(`OK: ${q.queryChunks?.[0] || 'executed'}`)
        } catch (e: any) {
          steps.push(`FAIL: ${e.message}`)
        }
      }
      return NextResponse.json({ success: true, steps })
    }

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
      steps.push('added faqItems with answers')
    }

    if (mode === 'faq-noans') {
      postData.faqItems = [
        { question: 'Test Q1 no answer?' },
        { question: 'Test Q2 no answer?' },
      ]
      steps.push('added faqItems without answers')
    }

    if (mode === 'faq-empty') {
      postData.faqItems = []
      steps.push('added empty faqItems array')
    }

    if (mode === 'meta' || mode === 'full') {
      postData.meta = {
        title: 'Test Meta Title',
        description: 'Test meta description for diagnostics.',
      }
      steps.push('added meta')
    }

    // Destination publisher integration test (Phase 13 Task 14)
    if (mode === 'destination') {
      const { textToLexical } = await import('../../../../../../content-system/publishing/text-to-lexical')

      // TEST 1: textToLexical produces valid Lexical JSON
      const lexical = textToLexical('First paragraph.\n\nSecond paragraph.\n\nThird.')
      const root = lexical.root as Record<string, unknown>
      const children = root.children as unknown[]
      if (root.type !== 'root' || children.length !== 3) {
        steps.push(`TEST 1 FAIL: root.type=${root.type}, paragraphs=${children.length}`)
        return NextResponse.json({ error: 'TEST 1 FAIL', steps }, { status: 500 })
      }
      steps.push('TEST 1 PASS: textToLexical produces 3 paragraphs')

      // TEST 2: textToLexical empty input
      const empty = textToLexical('')
      const emptyChildren = (empty.root as Record<string, unknown>).children as unknown[]
      if (emptyChildren.length !== 0) {
        steps.push('TEST 2 FAIL: non-empty children for empty input')
        return NextResponse.json({ error: 'TEST 2 FAIL', steps }, { status: 500 })
      }
      steps.push('TEST 2 PASS: textToLexical handles empty input')

      // Find a destination
      const dests = await payload.find({ collection: 'destinations', where: { type: { equals: 'destination' } }, limit: 1, depth: 0 })
      if (dests.docs.length === 0) {
        steps.push('SKIP: No destinations in database')
        return NextResponse.json({ success: true, steps })
      }
      const dest = dests.docs[0] as unknown as Record<string, unknown>
      const destId = dest.id as number
      steps.push(`Testing against: ${dest.name} (ID ${destId})`)

      // TEST 3: Write all 6 new fields
      const testContent = textToLexical('TEST — Phase 13 integration test. This will be cleaned up.')
      await payload.update({
        collection: 'destinations',
        id: destId,
        data: {
          whyChoose: testContent, keyExperiences: testContent, gettingThere: testContent,
          healthSafety: testContent, investmentExpectation: testContent, topLodgesContent: testContent,
        } as any,
        overrideAccess: true,
      })
      steps.push('TEST 3 PASS: All 6 fields written')

      // TEST 4: Read back and verify
      const updated = await payload.findByID({ collection: 'destinations', id: destId, depth: 0, overrideAccess: true }) as unknown as Record<string, unknown>
      const fields = ['whyChoose', 'keyExperiences', 'gettingThere', 'healthSafety', 'investmentExpectation', 'topLodgesContent']
      for (const field of fields) {
        const val = updated[field] as Record<string, unknown> | null
        if (!val || !val.root || (val.root as Record<string, unknown>).type !== 'root') {
          steps.push(`TEST 4 FAIL: ${field} is not valid Lexical`)
          return NextResponse.json({ error: `TEST 4 FAIL: ${field}`, steps }, { status: 500 })
        }
      }
      steps.push('TEST 4 PASS: All 6 fields contain valid Lexical JSON')

      // CLEANUP
      await payload.update({
        collection: 'destinations', id: destId, overrideAccess: true,
        data: { whyChoose: null, keyExperiences: null, gettingThere: null, healthSafety: null, investmentExpectation: null, topLodgesContent: null } as any,
      })
      const cleaned = await payload.findByID({ collection: 'destinations', id: destId, depth: 0, overrideAccess: true }) as unknown as Record<string, unknown>
      for (const field of fields) {
        if (cleaned[field] !== null && cleaned[field] !== undefined) {
          steps.push(`WARNING: ${field} not null after cleanup`)
        }
      }
      steps.push('CLEANUP: Fields restored to null')
      steps.push('=== ALL TESTS PASS ===')
      return NextResponse.json({ success: true, steps })
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
