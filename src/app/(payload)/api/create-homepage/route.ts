import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'

/**
 * API endpoint to create/update homepage with full content
 *
 * POST /api/create-homepage
 */
export async function POST(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Find a good hero image (landscape, high quality)
    const heroMediaResult = await payload.find({
      collection: 'media',
      limit: 10,
      where: {
        mimeType: { contains: 'image' },
      },
    })

    if (heroMediaResult.docs.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No media found for hero image' },
        { status: 400 }
      )
    }

    // Pick first image for hero
    const heroImageId = heroMediaResult.docs[0].id

    // Get published itineraries for featured section
    const itinerariesResult = await payload.find({
      collection: 'itineraries',
      limit: 6,
      where: {
        _status: { equals: 'published' },
      },
    })
    const featuredItineraryIds = itinerariesResult.docs.map(doc => doc.id)

    // Get destinations for highlights
    const destinationsResult = await payload.find({
      collection: 'destinations',
      limit: 4,
      where: {
        _status: { equals: 'published' },
      },
    })
    const featuredDestinationIds = destinationsResult.docs.map(doc => doc.id)

    // Get properties for featured section
    const propertiesResult = await payload.find({
      collection: 'properties',
      limit: 6,
    })
    const featuredPropertyIds = propertiesResult.docs.map(doc => doc.id)

    // Find an image for value proposition section
    const valueImageId = heroMediaResult.docs.length > 1
      ? heroMediaResult.docs[1].id
      : heroImageId

    // Build the layout blocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const layout: any[] = [
      // 1. Hero Section
      {
        blockType: 'homeHero',
        blockName: 'Hero',
        heading: 'Unforgettable African Adventures',
        subheading: 'Expertly crafted luxury safaris to Africa\'s most extraordinary destinations. Every journey designed by specialists who have walked the paths you\'ll travel.',
        backgroundImage: heroImageId,
        ctaLabel: 'Explore Safaris',
        ctaLink: '/safaris',
        overlayOpacity: 40,
      },
    ]

    // 2. Featured Itineraries (if we have any)
    if (featuredItineraryIds.length > 0) {
      layout.push({
        blockType: 'featuredItineraries',
        blockName: 'Featured Safaris',
        heading: 'Signature Safari Experiences',
        subheading: 'Hand-crafted journeys through Africa\'s most remarkable landscapes',
        itineraries: featuredItineraryIds,
      })
    }

    // 3. Value Proposition
    layout.push({
      blockType: 'valueProposition',
      blockName: 'Why Kiuli',
      heading: 'The Kiuli Difference',
      content: {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{
                type: 'text',
                text: 'Every Kiuli safari is designed by specialists who have walked the paths you\'ll travel. We don\'t just book trips—we craft transformative experiences that connect you with Africa\'s wild heart.'
              }],
              direction: 'ltr',
              format: '',
              indent: 0,
              textFormat: 0,
              version: 1,
            },
            {
              type: 'paragraph',
              children: [{
                type: 'text',
                text: 'From intimate gorilla encounters in Rwanda to vast migrations across the Serengeti, we curate moments that stay with you forever.'
              }],
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
      image: valueImageId,
      imagePosition: 'right',
    })

    // 4. Destination Highlights (if we have any)
    if (featuredDestinationIds.length > 0) {
      layout.push({
        blockType: 'destinationHighlights',
        blockName: 'Destinations',
        heading: 'Extraordinary Destinations',
        subheading: 'From the savannas of East Africa to the waterways of Botswana',
        destinations: featuredDestinationIds,
      })
    }

    // 5. Testimonial
    layout.push({
      blockType: 'testimonial',
      blockName: 'Testimonial',
      quote: 'Our safari with Kiuli exceeded every expectation. The attention to detail, the incredible guides, and the seamless logistics made this the trip of a lifetime. We\'ve already started planning our return.',
      attribution: 'The Morrison Family',
      context: 'Tanzania & Rwanda, 2024',
    })

    // 6. Featured Properties (if we have any)
    if (featuredPropertyIds.length > 0) {
      layout.push({
        blockType: 'featuredProperties',
        blockName: 'Featured Lodges',
        heading: 'Exceptional Places to Stay',
        subheading: 'Hand-selected lodges and camps that define luxury in the wild',
        properties: featuredPropertyIds,
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageData: any = {
      title: 'Kiuli - Luxury African Safaris',
      slug: 'home',
      _status: 'published' as const,
      hero: {
        type: 'none' as const,
      },
      layout,
      meta: {
        title: 'Kiuli | Luxury African Safaris',
        description: 'Expertly crafted luxury African safari experiences. Discover Tanzania, Rwanda, Kenya, Botswana and more with our specialist travel designers.',
      },
    }

    // Check if page 3 exists (existing homepage)
    let existingPage
    try {
      existingPage = await payload.findByID({
        collection: 'pages',
        id: 3,
      })
    } catch {
      existingPage = null
    }

    let result
    if (existingPage) {
      // Update existing
      result = await payload.update({
        collection: 'pages',
        id: 3,
        data: pageData,
      })
    } else {
      // Create new
      result = await payload.create({
        collection: 'pages',
        data: pageData,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Homepage seeded successfully',
      page: {
        id: result.id,
        title: result.title,
        slug: result.slug,
        status: result._status,
      },
      content: {
        itineraries: featuredItineraryIds.length,
        destinations: featuredDestinationIds.length,
        properties: featuredPropertyIds.length,
        blocks: layout.length,
      },
    })
  } catch (error) {
    console.error('Create homepage error:', error)
    return NextResponse.json(
      { success: false, message: String(error) },
      { status: 500 }
    )
  }
}

export async function GET(request: Request): Promise<Response> {
  return POST(request)
}
