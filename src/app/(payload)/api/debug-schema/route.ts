import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { sql } from '@payloadcms/db-vercel-postgres'

/**
 * Debug endpoint to check database schema for block tables
 */
export async function GET(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    const db = payload.db.drizzle

    // Check column types for block tables
    const result = await db.execute(sql`
      SELECT
        table_name,
        column_name,
        data_type,
        column_default
      FROM information_schema.columns
      WHERE table_name LIKE '%blocks%'
        AND column_name IN ('id', 'parent_id')
      ORDER BY table_name, column_name
    `)

    // Also check if we can read the page
    let pageData = null
    let pageError = null
    try {
      pageData = await payload.findByID({
        collection: 'pages',
        id: 3,
        depth: 0,
      })
    } catch (e) {
      pageError = String(e)
    }

    return NextResponse.json({
      success: true,
      schema: result.rows,
      page: pageData ? { id: pageData.id, title: pageData.title } : null,
      pageError,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}

/**
 * POST: Try to save a simple homepage and capture any errors
 */
export async function POST(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Try to update page 3 with a simple content block (no relationships)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageData: any = {
      title: 'Kiuli - Luxury Safaris Test',
      slug: 'home',
      _status: 'draft' as const,
      hero: {
        type: 'none' as const,
      },
      layout: [
        {
          blockType: 'content',
          columns: [
            {
              size: 'full',
              richText: {
                root: {
                  type: 'root',
                  children: [
                    {
                      type: 'paragraph',
                      children: [{ type: 'text', text: 'Hello World' }],
                      direction: 'ltr',
                      format: '',
                      indent: 0,
                      textFormat: 0,
                      version: 1,
                    },
                  ],
                  direction: 'ltr',
                  format: '',
                  indent: 0,
                  version: 1,
                },
              },
            },
          ],
        },
      ],
      meta: {
        title: 'Kiuli | Luxury African Safaris',
        description: 'Expertly crafted luxury African safari experiences.',
      },
    }

    const result = await payload.update({
      collection: 'pages',
      id: 3,
      data: pageData,
    })

    return NextResponse.json({
      success: true,
      message: 'Homepage saved successfully',
      page: {
        id: result.id,
        title: result.title,
        slug: result.slug,
        status: result._status,
      },
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
