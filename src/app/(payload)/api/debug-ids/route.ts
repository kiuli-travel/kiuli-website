import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'

export async function GET(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Get itineraries
    const itineraries = await payload.find({
      collection: 'itineraries',
      limit: 5,
      select: {
        id: true,
        title: true,
        slug: true,
      },
    })

    // Get destinations
    const destinations = await payload.find({
      collection: 'destinations',
      limit: 5,
      select: {
        id: true,
        name: true,
        slug: true,
      },
    })

    // Get media
    const media = await payload.find({
      collection: 'media',
      limit: 5,
      select: {
        id: true,
        alt: true,
      },
    })

    return NextResponse.json({
      itineraries: itineraries.docs.map(d => ({ id: d.id, idType: typeof d.id, title: d.title })),
      destinations: destinations.docs.map(d => ({ id: d.id, idType: typeof d.id, name: d.name })),
      media: media.docs.map(d => ({ id: d.id, idType: typeof d.id, alt: d.alt })),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
