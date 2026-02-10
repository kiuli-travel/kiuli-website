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
