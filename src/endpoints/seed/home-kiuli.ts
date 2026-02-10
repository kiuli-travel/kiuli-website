import type { Payload } from 'payload'
import type { Destination, Itinerary, Media } from '@/payload-types'

/**
 * Kiuli Homepage Seed
 *
 * Creates or updates the homepage with Kiuli-specific blocks:
 * - HomeHero with background image
 * - FeaturedItineraries showcasing top safaris
 * - DestinationHighlights showing destinations
 * - ValueProposition explaining the Kiuli difference
 * - Testimonial from a satisfied traveler
 *
 * This seed queries existing data (itineraries, destinations, media)
 * and builds the homepage from what's available.
 */

// Rich text helper for creating Lexical content
function createRichText(paragraphs: string[]) {
  return {
    root: {
      type: 'root',
      children: paragraphs.map((text) => ({
        type: 'paragraph',
        children: [
          {
            type: 'text',
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            text,
            version: 1,
          },
        ],
        direction: 'ltr',
        format: '',
        indent: 0,
        textFormat: 0,
        version: 1,
      })),
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

export async function seedKiuliHomepage(payload: Payload): Promise<{ success: boolean; message: string }> {
  try {
    payload.logger.info('Starting Kiuli homepage seed...')

    // 1. Find existing itineraries with hero images (for FeaturedItineraries block)
    const itinerariesResult = await payload.find({
      collection: 'itineraries',
      where: {
        _status: { equals: 'published' },
        heroImage: { exists: true },
      },
      limit: 6,
      sort: '-createdAt',
    })
    const itineraries = itinerariesResult.docs as Itinerary[]
    payload.logger.info(`Found ${itineraries.length} published itineraries with hero images`)

    // 2. Find existing destinations (for DestinationHighlights block)
    const destinationsResult = await payload.find({
      collection: 'destinations',
      where: {
        heroImage: { exists: true },
      },
      limit: 6,
      sort: '-createdAt',
    })
    const destinations = destinationsResult.docs as Destination[]
    payload.logger.info(`Found ${destinations.length} destinations with hero images`)

    // 3. Find a suitable hero image from media
    // First try to find media with 'hero' or 'safari' in alt text
    const heroImageResult = await payload.find({
      collection: 'media',
      where: {
        or: [
          { alt: { contains: 'hero' } },
          { alt: { contains: 'safari' } },
          { alt: { contains: 'landscape' } },
          { altText: { contains: 'hero' } },
          { altText: { contains: 'safari' } },
        ],
      },
      limit: 1,
    })

    // Fallback: use the first itinerary's hero image if available
    let heroImageId: number | null = null
    if (heroImageResult.docs.length > 0) {
      heroImageId = heroImageResult.docs[0].id
    } else if (itineraries.length > 0 && itineraries[0].heroImage) {
      const heroImg = itineraries[0].heroImage as Media
      heroImageId = heroImg.id
    }

    // 4. Find an image for the value proposition block
    let valuePropImageId: number | null = null
    if (itineraries.length > 1 && itineraries[1].heroImage) {
      const img = itineraries[1].heroImage as Media
      valuePropImageId = img.id
    } else if (destinations.length > 0 && destinations[0].heroImage) {
      const img = destinations[0].heroImage as Media
      valuePropImageId = img.id
    }

    // 5. Build the homepage blocks
    const layout: any[] = []

    // HomeHero Block
    if (heroImageId) {
      layout.push({
        blockType: 'homeHero',
        blockName: 'Hero',
        heading: 'Unforgettable African Safaris',
        subheading: 'Expertly crafted journeys to Africa\'s most extraordinary destinations. Every detail considered, every moment extraordinary.',
        backgroundImage: heroImageId,
        ctaLabel: 'Explore Safaris',
        ctaLink: '/safaris',
        overlayOpacity: 45,
      })
    }

    // FeaturedItineraries Block
    if (itineraries.length > 0) {
      layout.push({
        blockType: 'featuredItineraries',
        blockName: 'Featured Safaris',
        heading: 'Featured Safari Experiences',
        subheading: 'Hand-selected journeys showcasing the best of African wildlife and landscapes',
        itineraries: itineraries.slice(0, 3).map((it) => it.id),
        showPricing: true,
      })
    }

    // DestinationHighlights Block
    if (destinations.length > 0) {
      layout.push({
        blockType: 'destinationHighlights',
        blockName: 'Destinations',
        heading: 'Explore Our Destinations',
        subheading: 'From the Serengeti\'s endless plains to Rwanda\'s misty mountains',
        destinations: destinations.slice(0, 3).map((d) => d.id),
      })
    }

    // ValueProposition Block
    layout.push({
      blockType: 'valueProposition',
      blockName: 'Why Kiuli',
      heading: 'The Kiuli Difference',
      content: createRichText([
        'Every Kiuli safari is designed by specialists who have walked the paths you\'ll travel. We don\'t just book trips—we craft experiences that transform.',
        'Our relationships with Africa\'s finest lodges and guides mean you\'ll enjoy access and insights that others simply can\'t offer.',
        'From the moment you enquire until you return home with stories to last a lifetime, our team is with you every step of the way.',
      ]),
      image: valuePropImageId,
      imagePosition: 'right',
    })

    // Testimonial Block
    layout.push({
      blockType: 'testimonial',
      blockName: 'Testimonial',
      quote: 'Our safari with Kiuli exceeded every expectation. The attention to detail, the incredible guides, and the lodges they selected made this the trip of a lifetime. We\'ve already started planning our return.',
      attribution: 'The Morrison Family',
      context: 'Tanzania & Rwanda, 2024',
    })

    // Second FeaturedItineraries Block (if we have more itineraries)
    if (itineraries.length > 3) {
      layout.push({
        blockType: 'featuredItineraries',
        blockName: 'More Safaris',
        heading: 'More Extraordinary Journeys',
        subheading: 'Discover more of our carefully curated safari experiences',
        itineraries: itineraries.slice(3, 6).map((it) => it.id),
        showPricing: true,
      })
    }

    // 6. Check if home page exists
    const existingHome = await payload.find({
      collection: 'pages',
      where: {
        slug: { equals: 'home' },
      },
      limit: 1,
    })

    // 7. Create or update the homepage
    if (existingHome.docs.length > 0) {
      // Update existing
      const homeId = existingHome.docs[0].id
      await payload.update({
        collection: 'pages',
        id: homeId,
        data: {
          title: 'Home',
          slug: 'home',
          _status: 'published',
          hero: {
            type: 'none',
          },
          layout,
          meta: {
            title: 'Kiuli | Luxury African Safaris',
            description: 'Kiuli connects discerning travellers with expertly crafted luxury African safari experiences. From the Serengeti to the Okavango, discover Africa with those who know it best.',
          },
        },
        context: {
          disableRevalidate: false,
        },
      })
      payload.logger.info(`Updated existing homepage (id: ${homeId})`)
    } else {
      // Create new
      const newHome = await payload.create({
        collection: 'pages',
        data: {
          title: 'Home',
          slug: 'home',
          _status: 'published',
          hero: {
            type: 'none',
          },
          layout,
          meta: {
            title: 'Kiuli | Luxury African Safaris',
            description: 'Kiuli connects discerning travellers with expertly crafted luxury African safari experiences. From the Serengeti to the Okavango, discover Africa with those who know it best.',
          },
        },
        context: {
          disableRevalidate: false,
        },
      })
      payload.logger.info(`Created new homepage (id: ${newHome.id})`)
    }

    const summary = [
      `Homepage seeded successfully!`,
      `- ${layout.length} blocks created`,
      `- ${itineraries.length} itineraries available for featuring`,
      `- ${destinations.length} destinations available`,
      heroImageId ? '- Hero image set' : '- No hero image found (upload media with "hero" or "safari" in alt text)',
    ].join('\n')

    payload.logger.info(summary)

    return {
      success: true,
      message: summary,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    payload.logger.error(`Homepage seed failed: ${message}`)
    return {
      success: false,
      message: `Failed to seed homepage: ${message}`,
    }
  }
}
