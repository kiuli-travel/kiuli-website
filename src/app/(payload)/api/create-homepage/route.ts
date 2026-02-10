import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'

/**
 * API endpoint to create/update homepage bypassing admin UI
 *
 * POST /api/create-homepage
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Check authentication
    const { user } = await payload.auth({ headers: request.headers })
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Find a media item for the hero background
    const mediaResult = await payload.find({
      collection: 'media',
      limit: 1,
      where: {
        mimeType: { contains: 'image' },
      },
    })

    if (mediaResult.docs.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No media found for hero image' },
        { status: 400 }
      )
    }

    const heroImageId = mediaResult.docs[0].id

    // Check if page 3 exists
    let page
    try {
      page = await payload.findByID({
        collection: 'pages',
        id: 3,
      })
    } catch (e) {
      page = null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageData: any = {
      title: 'Kiuli - Luxury Safaris',
      slug: 'home',
      _status: 'published' as const,
      hero: {
        type: 'none' as const,
      },
      layout: [
        {
          blockType: 'homeHero',
          blockName: 'Hero',
          heading: 'Unforgettable African Adventures',
          subheading: 'Expertly crafted luxury safaris to Africa\'s most extraordinary destinations',
          backgroundImage: heroImageId,
          ctaLabel: 'Explore Safaris',
          ctaLink: '/safaris',
          overlayOpacity: 45,
        },
        {
          blockType: 'valueProposition',
          blockName: 'Why Kiuli',
          heading: 'The Kiuli Difference',
          content: {
            root: {
              type: 'root',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Every Kiuli safari is designed by specialists who have walked the paths you\'ll travel.' }],
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
          imagePosition: 'right',
        },
        {
          blockType: 'testimonial',
          blockName: 'Testimonial',
          quote: 'Our safari with Kiuli exceeded every expectation. The attention to detail made this the trip of a lifetime.',
          attribution: 'The Morrison Family',
          context: 'Tanzania & Rwanda, 2024',
        },
      ],
      meta: {
        title: 'Kiuli | Luxury African Safaris',
        description: 'Expertly crafted luxury African safari experiences.',
      },
    }

    let result
    if (page) {
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
      message: 'Homepage created/updated successfully',
      page: {
        id: result.id,
        title: result.title,
        slug: result.slug,
        status: result._status,
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
