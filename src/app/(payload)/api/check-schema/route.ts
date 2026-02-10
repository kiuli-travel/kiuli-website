import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { sql } from '@payloadcms/db-vercel-postgres'

export async function GET(): Promise<Response> {
  const payload = await getPayload({ config: configPromise })
  const db = payload.db.drizzle

  // Exclude _rels junction tables - those correctly use integer IDs
  const result = await db.execute(sql`
    SELECT table_name, column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_name LIKE '%blocks%'
    AND table_name NOT LIKE '%_rels'
    AND column_name = 'id'
    AND data_type != 'character varying'
    ORDER BY table_name
  `)

  return NextResponse.json({ rows: result.rows })
}
