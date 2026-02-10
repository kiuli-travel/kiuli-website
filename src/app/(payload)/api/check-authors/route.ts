import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'

/**
 * TEMPORARY: Check authors and revalidate cache - DELETE AFTER USE
 */
export async function GET(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Get all authors
    const authors = await payload.find({
      collection: 'authors',
      overrideAccess: true,
      limit: 100,
    })

    // Revalidate the authors-sitemap cache
    revalidateTag('authors-sitemap')

    return NextResponse.json({
      authors: authors.docs.map(a => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        status: a._status,
      })),
      cacheRevalidated: true,
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
