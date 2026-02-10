import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { sql } from '@payloadcms/db-vercel-postgres'

/**
 * TEMPORARY: Schema audit - DELETE IMMEDIATELY AFTER USE
 */
export async function GET(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    const db = payload.db.drizzle

    // Query 1: ALL block tables with ID column info
    const blockTables = await db.execute(sql`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name LIKE '%_blocks_%'
      AND column_name = 'id'
      ORDER BY table_name
    `)

    // Query 2: ALL version block tables with ID column info
    const versionBlockTables = await db.execute(sql`
      SELECT table_name, column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name LIKE '%_v_blocks_%'
      AND column_name = 'id'
      ORDER BY table_name
    `)

    return NextResponse.json({
      blockTables: blockTables.rows,
      versionBlockTables: versionBlockTables.rows,
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
    }, { status: 500 })
  }
}
