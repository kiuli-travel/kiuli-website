import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { sql } from '@payloadcms/db-vercel-postgres'

/**
 * TEMPORARY: Database schema audit endpoint
 * DELETE THIS AFTER AUDIT
 */
export async function GET(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    const db = payload.db.drizzle

    // 1. List ALL block tables and their ID column types
    const blockTables = await db.execute(sql`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name LIKE '%_blocks_%'
      AND column_name = 'id'
      ORDER BY table_name
    `)

    // 2. List ALL version block tables and their ID column types
    const versionBlockTables = await db.execute(sql`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name LIKE '%_v_blocks_%'
      AND column_name = 'id'
      ORDER BY table_name
    `)

    // 3. Check payload_locked_documents_rels columns
    const lockedDocumentsRels = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'payload_locked_documents_rels'
      ORDER BY column_name
    `)

    // 4. Check payload_preferences_rels columns
    const preferencesRels = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'payload_preferences_rels'
      ORDER BY column_name
    `)

    // 5. Get destinations data
    const destinations = await db.execute(sql`
      SELECT d.id, d.name, d.slug, d.type,
             pd.name as parent_name, pd.type as parent_type
      FROM destinations d
      LEFT JOIN destinations pd ON d.country_id = pd.id
      ORDER BY d.type, d.name
    `)

    // 6. Get properties data
    const properties = await db.execute(sql`
      SELECT p.id, p.name, p.slug, p.destination_id
      FROM properties p
      ORDER BY p.name
    `)

    // 7. Get authors
    const authors = await db.execute(sql`
      SELECT id, name, slug FROM authors ORDER BY name
    `)

    // 8. Get posts
    const posts = await db.execute(sql`
      SELECT id, title, slug, _status FROM posts ORDER BY title
    `)

    // 9. Get pages
    const pages = await db.execute(sql`
      SELECT id, title, slug, _status FROM pages ORDER BY title
    `)

    return NextResponse.json({
      blockTables: blockTables.rows,
      versionBlockTables: versionBlockTables.rows,
      lockedDocumentsRels: lockedDocumentsRels.rows,
      preferencesRels: preferencesRels.rows,
      destinations: destinations.rows,
      properties: properties.rows,
      authors: authors.rows,
      posts: posts.rows,
      pages: pages.rows,
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 })
  }
}
