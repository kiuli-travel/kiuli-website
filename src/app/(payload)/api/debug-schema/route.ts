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
export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Find a media item for the hero background
    const mediaResult = await payload.find({
      collection: 'media',
      limit: 1,
      where: {
        mimeType: { contains: 'image' },
      },
    })

    if (mediaResult.docs.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No media found for hero image',
      }, { status: 400 })
    }

    const heroImageId = mediaResult.docs[0].id
    const mediaDoc = mediaResult.docs[0]

    // Return debug info first before trying save
    const urlParam = new URL(request.url).searchParams.get('action')
    if (urlParam !== 'save') {
      return NextResponse.json({
        action: 'debug',
        message: 'Add ?action=save to actually save',
        mediaFound: {
          id: heroImageId,
          filename: mediaDoc.filename,
          mimeType: mediaDoc.mimeType,
        },
      })
    }

    // Try with homeHero block
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageData: any = {
      title: 'Kiuli - Luxury Safaris',
      slug: 'home',
      _status: 'draft' as const,
      hero: {
        type: 'none' as const,
      },
      layout: [
        {
          blockType: 'homeHero',
          blockName: 'Hero',
          heading: 'Unforgettable African Adventures',
          subheading: 'Expertly crafted luxury safaris',
          backgroundImage: heroImageId,
          ctaLabel: 'Explore Safaris',
          ctaLink: '/safaris',
          overlayOpacity: 45,
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
