import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'

import { seedKiuliHomepage } from '@/endpoints/seed/home-kiuli'

/**
 * API endpoint to seed the Kiuli homepage
 *
 * POST /api/seed-homepage
 *
 * Requires authentication (admin user must be logged in)
 *
 * Creates or updates the homepage with:
 * - HomeHero block with background image
 * - FeaturedItineraries showcasing available safaris
 * - DestinationHighlights with available destinations
 * - ValueProposition explaining the Kiuli difference
 * - Testimonial from a satisfied traveler
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Check authentication - only admins can seed
    // Get user from cookie/session
    const { user } = await payload.auth({ headers: request.headers })

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - please log in to the admin panel first' },
        { status: 401 }
      )
    }

    // Run the seed
    const result = await seedKiuliHomepage(payload)

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Homepage seed error:', error)
    return NextResponse.json(
      { success: false, message: `Seed failed: ${message}` },
      { status: 500 }
    )
  }
}

// Also support GET for easy browser testing (still requires auth)
export async function GET(request: Request): Promise<Response> {
  return POST(request)
}
