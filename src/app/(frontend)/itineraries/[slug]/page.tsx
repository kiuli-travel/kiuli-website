import type { Metadata } from 'next'
import type { Itinerary, Media } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import React, { cache } from 'react'

import { generateMeta } from '@/utilities/generateMeta'
import { ItineraryHero } from '@/components/itinerary/ItineraryHero'
import { TripOverview } from '@/components/itinerary/TripOverview'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const itineraries = await payload.find({
    collection: 'itineraries',
    draft: false,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return itineraries.docs?.map(({ slug }) => ({ slug })) || []
}

type Args = {
  params: Promise<{
    slug: string
  }>
}

// Helper: Extract unique destinations from itinerary
function extractDestinations(itinerary: Itinerary): string[] {
  const destinations = new Set<string>()

  // First, try to get countries from overview
  if (itinerary.overview?.countries) {
    for (const c of itinerary.overview.countries) {
      if (c.country) destinations.add(c.country)
    }
  }

  // If no countries in overview, extract from stay segments
  if (destinations.size === 0 && itinerary.days) {
    for (const day of itinerary.days) {
      if (day.segments) {
        for (const segment of day.segments) {
          if (segment.blockType === 'stay') {
            // Add country if available
            if (segment.country) destinations.add(segment.country)
            // Or use location as fallback
            else if (segment.location) destinations.add(segment.location)
          }
        }
      }
    }
  }

  return Array.from(destinations)
}

// Helper: Calculate total nights from stay segments
function calculateNights(itinerary: Itinerary): number {
  // First check overview.nights
  if (itinerary.overview?.nights) {
    return itinerary.overview.nights
  }

  // Otherwise sum nights from stay segments
  let totalNights = 0
  if (itinerary.days) {
    for (const day of itinerary.days) {
      if (day.segments) {
        for (const segment of day.segments) {
          if (segment.blockType === 'stay' && segment.nights) {
            totalNights += segment.nights
          }
        }
      }
    }
  }

  return totalNights
}

// Helper: Get hero image data
function getHeroImage(itinerary: Itinerary): { imgixUrl: string; alt: string } | null {
  const heroImage = itinerary.heroImage
  if (!heroImage || typeof heroImage === 'number') return null

  const media = heroImage as Media
  if (!media.imgixUrl) return null

  return {
    imgixUrl: media.imgixUrl,
    alt: media.alt || media.altText || itinerary.title,
  }
}

export default async function ItineraryPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)

  const itinerary = await queryItineraryBySlug({ slug: decodedSlug })

  if (!itinerary) {
    notFound()
  }

  const heroImage = getHeroImage(itinerary)
  const destinations = extractDestinations(itinerary)
  const totalNights = calculateNights(itinerary)

  return (
    <article>
      <ItineraryHero
        title={itinerary.title}
        heroImage={heroImage}
        slug={itinerary.slug}
      />

      <TripOverview
        title={itinerary.title}
        destinations={destinations}
        totalNights={totalNights}
        investmentLevel={
          itinerary.investmentLevel?.fromPrice
            ? {
                fromPrice: itinerary.investmentLevel.fromPrice,
                currency: itinerary.investmentLevel.currency || 'USD',
              }
            : null
        }
      />

      {/* Temporarily keep JSON dump for remaining data */}
      <details className="mx-auto max-w-6xl px-6 py-8">
        <summary className="cursor-pointer text-kiuli-teal font-semibold mb-4">
          Raw Days Data (Debug)
        </summary>
        <pre className="bg-kiuli-ivory p-4 rounded overflow-auto text-xs max-h-[60vh]">
          {JSON.stringify(itinerary.days, null, 2)}
        </pre>
      </details>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const itinerary = await queryItineraryBySlug({ slug: decodedSlug })

  if (!itinerary) {
    return {
      title: 'Itinerary Not Found',
    }
  }

  return generateMeta({ doc: itinerary })
}

const queryItineraryBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'itineraries',
    draft,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
