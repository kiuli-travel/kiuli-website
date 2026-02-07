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
import { JourneyNarrative } from '@/components/itinerary/JourneyNarrative'
import { InvestmentLevel } from '@/components/itinerary/InvestmentLevel'
import { FAQSection } from '@/components/itinerary/FAQSection'
import { InquiryCTA } from '@/components/itinerary/InquiryCTA'

// Enable Incremental Static Regeneration - pages revalidate every 10 minutes
export const revalidate = 600
export const dynamic = 'force-static'

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

// Helper: Get hero video data
function getHeroVideo(itinerary: Itinerary): Media | null {
  const heroVideo = itinerary.heroVideo
  if (!heroVideo || typeof heroVideo === 'number') return null
  return heroVideo as Media
}

// Helper: Extract plain text from Lexical richText for FAQ answers
function extractTextFromRichText(richText: unknown): string {
  if (!richText || typeof richText !== 'object') return ''

  const root = (richText as { root?: { children?: unknown[] } }).root
  if (!root?.children) return ''

  const extractText = (nodes: unknown[]): string => {
    return nodes
      .map((node) => {
        if (!node || typeof node !== 'object') return ''
        const n = node as { type?: string; text?: string; children?: unknown[] }

        if (n.type === 'text' && n.text) {
          return n.text
        }
        if (n.children && Array.isArray(n.children)) {
          return extractText(n.children)
        }
        return ''
      })
      .join('')
  }

  return extractText(root.children)
}

// Helper: Extract FAQs from itinerary
function extractFAQs(itinerary: Itinerary): Array<{ question: string; answer: string }> {
  if (!itinerary.faqItems || itinerary.faqItems.length === 0) return []

  return itinerary.faqItems
    .map((item) => {
      // Get resolved question from hook
      const question = item.question || ''

      // Get resolved answer from hook, convert richText to plain text
      const answer = extractTextFromRichText(item.answer)

      if (!question || !answer) return null

      return { question, answer }
    })
    .filter((item): item is { question: string; answer: string } => item !== null)
}

// Helper: Generate TravelService JSON-LD schema
function generateTravelServiceSchema(
  itinerary: Itinerary,
  destinations: string[],
  totalNights: number,
  heroImage: { imgixUrl: string; alt: string } | null,
  slug: string,
) {
  const price = itinerary.investmentLevel?.fromPrice
  const currency = itinerary.investmentLevel?.currency || 'USD'
  // Use resolved metaDescription from hook, with fallback
  const description =
    itinerary.metaDescription ||
    `${totalNights}-night luxury safari in ${destinations.join(', ')}. Experience the best of African wildlife with Kiuli.`

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: itinerary.title,
    description,
    image: heroImage?.imgixUrl,
    url: `https://kiuli.com/safaris/${slug}`,
    brand: {
      '@type': 'Brand',
      name: 'Kiuli',
    },
    category: 'Safari Tours',
    ...(price && {
      offers: {
        '@type': 'Offer',
        priceCurrency: currency,
        price: price,
        priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        availability: 'https://schema.org/InStock',
        seller: {
          '@type': 'TravelAgency',
          name: 'Kiuli',
          url: 'https://kiuli.com',
        },
      },
    }),
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Duration',
        value: `${totalNights} nights`,
      },
      {
        '@type': 'PropertyValue',
        name: 'Destinations',
        value: destinations.join(', '),
      },
    ],
  }
}

// Helper: Generate FAQ JSON-LD schema
function generateFAQSchema(faqs: Array<{ question: string; answer: string }>) {
  if (faqs.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

// Helper: Generate Breadcrumb JSON-LD schema
function generateBreadcrumbSchema(title: string, slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://kiuli.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Safaris',
        item: 'https://kiuli.com/safaris',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: `https://kiuli.com/safaris/${slug}`,
      },
    ],
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
  const heroVideo = getHeroVideo(itinerary)
  const destinations = extractDestinations(itinerary)
  const totalNights = calculateNights(itinerary)
  const faqs = extractFAQs(itinerary)

  // Get investment level data
  const hasInvestmentLevel = itinerary.investmentLevel?.fromPrice

  // Get resolved includes from hook, convert richText to plain text
  const includesText = extractTextFromRichText(itinerary.investmentLevel?.includes)

  // Generate JSON-LD schemas for SEO and AI discoverability
  const travelServiceSchema = generateTravelServiceSchema(
    itinerary,
    destinations,
    totalNights,
    heroImage,
    decodedSlug,
  )
  const faqSchema = generateFAQSchema(faqs)
  const breadcrumbSchema = generateBreadcrumbSchema(itinerary.title, decodedSlug)

  return (
    <article>
      {/* JSON-LD Structured Data for SEO and AI */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(travelServiceSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <ItineraryHero
        title={itinerary.title}
        heroImage={heroImage}
        heroVideo={heroVideo}
        showHeroVideo={itinerary.showHeroVideo ?? false}
      />

      <TripOverview
        title={itinerary.title}
        destinations={destinations}
        totalNights={totalNights}
        investmentLevel={
          hasInvestmentLevel
            ? {
                fromPrice: itinerary.investmentLevel!.fromPrice!,
                currency: itinerary.investmentLevel!.currency || 'USD',
              }
            : null
        }
      />

      <JourneyNarrative days={itinerary.days} />

      {hasInvestmentLevel && (
        <InvestmentLevel
          price={itinerary.investmentLevel!.fromPrice!}
          currency={itinerary.investmentLevel!.currency || 'USD'}
          includedItems={includesText || undefined}
        />
      )}

      {faqs.length > 0 && <FAQSection faqs={faqs} />}

      <InquiryCTA />
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
    depth: 2,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
