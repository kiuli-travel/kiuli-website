import type { Metadata } from 'next'
import type { Destination, Itinerary, Media } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import React, { cache } from 'react'

import Breadcrumb from '@/components/Breadcrumb'
import AnswerCapsule from '@/components/AnswerCapsule'
import DestinationHero from '@/components/DestinationHero'
import HighlightsList from '@/components/HighlightsList'
import BestTimeToVisit from '@/components/BestTimeToVisit'
import ItineraryGrid from '@/components/ItineraryGrid'
import ItineraryCard from '@/components/ItineraryCard'
import DestinationCard from '@/components/DestinationCard'
import { FAQSection } from '@/components/itinerary/FAQSection'
import RichText from '@/components/RichText'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

export const revalidate = 600
export const dynamic = 'force-static'

type Args = {
  params: Promise<{
    slug: string[]
  }>
}

// Helper: Extract plain text from Lexical richText for FAQ answers (JSON-LD)
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

// Helper: Get hero image data
function getHeroImage(destination: Destination): { imgixUrl: string; alt: string } | null {
  const heroImage = destination.heroImage
  if (!heroImage || typeof heroImage === 'number') return null

  const media = heroImage as Media
  if (!media.imgixUrl) return null

  return {
    imgixUrl: media.imgixUrl,
    alt: media.alt || media.altText || destination.name,
  }
}

// Helper: Extract countries from itinerary
function extractCountries(itinerary: Itinerary): string[] {
  const countries: string[] = []
  if (itinerary.overview?.countries) {
    for (const c of itinerary.overview.countries) {
      if (c.country) countries.push(c.country)
    }
  }
  return countries
}

// Helper: Calculate nights from itinerary
function calculateNights(itinerary: Itinerary): number {
  if (itinerary.overview?.nights) {
    return itinerary.overview.nights
  }
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

// Helper: Get itinerary hero image
function getItineraryHeroImage(itinerary: Itinerary): { imgixUrl: string; alt: string } | null {
  const heroImage = itinerary.heroImage
  if (!heroImage || typeof heroImage === 'number') return null

  const media = heroImage as Media
  if (!media.imgixUrl) return null

  return {
    imgixUrl: media.imgixUrl,
    alt: media.alt || media.altText || itinerary.title,
  }
}

// Helper: Extract description plain text for DestinationCard
function extractDescriptionText(description: unknown): string | undefined {
  if (!description) return undefined
  const text = extractTextFromRichText(description)
  return text.length > 0 ? text.substring(0, 150) : undefined
}

// Generate BreadcrumbList JSON-LD
function generateBreadcrumbSchema(
  destination: Destination,
  parentCountry: Destination | null,
  slugPath: string,
) {
  const items = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: 'https://kiuli.com',
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Destinations',
      item: 'https://kiuli.com/destinations',
    },
  ]

  if (parentCountry) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: parentCountry.name,
      item: `https://kiuli.com/destinations/${parentCountry.slug}`,
    })
    items.push({
      '@type': 'ListItem',
      position: 4,
      name: destination.name,
      item: `https://kiuli.com/destinations/${slugPath}`,
    })
  } else {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: destination.name,
      item: `https://kiuli.com/destinations/${slugPath}`,
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

// Generate FAQPage JSON-LD
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

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })

  // Fetch all published destinations
  const destinations = await payload.find({
    collection: 'destinations',
    draft: false,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    where: {
      _status: {
        equals: 'published',
      },
    },
    select: {
      slug: true,
      type: true,
      country: true,
    },
    depth: 1,
  })

  const params: { slug: string[] }[] = []

  for (const dest of destinations.docs) {
    if (dest.type === 'country') {
      params.push({ slug: [dest.slug] })
    } else if (dest.country && typeof dest.country === 'object') {
      params.push({ slug: [dest.country.slug, dest.slug] })
    }
  }

  return params
}

export default async function DestinationPage({ params: paramsPromise }: Args) {
  const { slug: slugArray } = await paramsPromise
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  let destination: Destination | null = null
  let parentCountry: Destination | null = null

  if (slugArray.length === 1) {
    // Country page: /destinations/kenya
    const result = await payload.find({
      collection: 'destinations',
      draft,
      limit: 1,
      overrideAccess: true,
      depth: 2,
      where: {
        and: [
          { slug: { equals: slugArray[0] } },
          { type: { equals: 'country' } },
          ...(draft ? [] : [{ _status: { equals: 'published' } }]),
        ],
      },
    })
    destination = result.docs?.[0] || null
  } else if (slugArray.length === 2) {
    // Region/park page: /destinations/kenya/masai-mara
    const countryResult = await payload.find({
      collection: 'destinations',
      draft,
      limit: 1,
      overrideAccess: true,
      depth: 1,
      where: {
        and: [
          { slug: { equals: slugArray[0] } },
          { type: { equals: 'country' } },
          ...(draft ? [] : [{ _status: { equals: 'published' } }]),
        ],
      },
    })
    parentCountry = countryResult.docs?.[0] || null

    if (parentCountry) {
      const destResult = await payload.find({
        collection: 'destinations',
        draft,
        limit: 1,
        overrideAccess: true,
        depth: 2,
        where: {
          and: [
            { slug: { equals: slugArray[1] } },
            { country: { equals: parentCountry.id } },
            ...(draft ? [] : [{ _status: { equals: 'published' } }]),
          ],
        },
      })
      destination = destResult.docs?.[0] || null
    }
  }

  if (!destination) {
    notFound()
  }

  // Fetch child destinations (for country pages only)
  let childDestinations: Destination[] = []
  if (destination.type === 'country') {
    const childResult = await payload.find({
      collection: 'destinations',
      draft,
      limit: 100,
      overrideAccess: true,
      depth: 1,
      where: {
        and: [
          { country: { equals: destination.id } },
          ...(draft ? [] : [{ _status: { equals: 'published' } }]),
        ],
      },
    })
    childDestinations = childResult.docs || []
  }

  // Fetch itineraries that reference this destination
  const itineraryResult = await payload.find({
    collection: 'itineraries',
    draft,
    limit: 100,
    overrideAccess: true,
    depth: 2,
    where: {
      and: [
        { destinations: { contains: destination.id } },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
  })
  const itineraries = itineraryResult.docs || []

  // Build data for rendering
  const heroImage = getHeroImage(destination)
  const slugPath = slugArray.join('/')

  // Build breadcrumb items
  const breadcrumbItems: Array<{ label: string; href?: string }> = [
    { label: 'Home', href: '/' },
    { label: 'Destinations', href: '/destinations' },
  ]
  if (parentCountry) {
    breadcrumbItems.push({ label: parentCountry.name, href: `/destinations/${parentCountry.slug}` })
  }
  breadcrumbItems.push({ label: destination.name })

  // Extract FAQs for rendering and schema
  const faqs: Array<{ question: string; answer: string }> = []
  if (destination.faqItems && destination.faqItems.length > 0) {
    for (const item of destination.faqItems) {
      const question = item.question || ''
      const answerText = extractTextFromRichText(item.answer)
      if (question && answerText) {
        faqs.push({ question, answer: answerText })
      }
    }
  }

  // Generate schemas
  const breadcrumbSchema = generateBreadcrumbSchema(destination, parentCountry, slugPath)
  const faqSchema = generateFAQSchema(faqs)

  // Heading for itineraries section
  const itinerariesHeading =
    destination.type === 'country'
      ? `Safaris in ${destination.name}`
      : `Safaris featuring ${destination.name}`

  return (
    <article>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      {/* Breadcrumb */}
      <div className="mx-auto max-w-6xl px-6 pt-4 pb-2 md:px-8">
        <Breadcrumb items={breadcrumbItems} />
      </div>

      {/* Hero or Plain Title */}
      {heroImage ? (
        <DestinationHero
          name={destination.name}
          imageUrl={heroImage.imgixUrl}
          imageAlt={heroImage.alt}
          type={destination.type}
          parentName={parentCountry?.name}
        />
      ) : (
        <section className="w-full py-12 md:py-16">
          <div className="mx-auto max-w-[1280px] px-6">
            {parentCountry && (
              <span className="block text-xs uppercase tracking-[0.1em] text-[#486A6A] mb-2">
                {parentCountry.name}
              </span>
            )}
            <h1 className="text-4xl md:text-5xl font-bold text-[#404040] leading-tight">
              {destination.name}
            </h1>
          </div>
        </section>
      )}

      {/* Answer Capsule */}
      {destination.answerCapsule && (
        <AnswerCapsule
          text={destination.answerCapsule}
          focusKeyword={destination.focusKeyword || undefined}
        />
      )}

      {/* Description */}
      {destination.description && (
        <section className="w-full py-8 px-6 md:py-12">
          <div className="mx-auto max-w-[720px]">
            <div className="prose prose-lg max-w-none text-[#404040] leading-[1.6]">
              <RichText
                data={destination.description as DefaultTypedEditorState}
                enableGutter={false}
                enableProse={false}
              />
            </div>
          </div>
        </section>
      )}

      {/* Highlights */}
      {destination.highlights && destination.highlights.length > 0 && (
        <HighlightsList items={destination.highlights} />
      )}

      {/* Best Time to Visit */}
      {destination.bestTimeToVisit && (
        <BestTimeToVisit content={destination.bestTimeToVisit as DefaultTypedEditorState} />
      )}

      {/* Itineraries Grid */}
      {itineraries.length > 0 && (
        <ItineraryGrid heading={itinerariesHeading}>
          {itineraries.map((itinerary) => {
            const itinHeroImage = getItineraryHeroImage(itinerary)
            const countries = extractCountries(itinerary)
            const nights = calculateNights(itinerary)
            const price = itinerary.investmentLevel?.fromPrice || 0

            if (!itinHeroImage) return null

            return (
              <ItineraryCard
                key={itinerary.id}
                title={itinerary.title}
                slug={itinerary.slug}
                heroImageUrl={itinHeroImage.imgixUrl}
                heroImageAlt={itinHeroImage.alt}
                nights={nights}
                priceFrom={price}
                countries={countries}
              />
            )
          })}
        </ItineraryGrid>
      )}

      {/* Child Destinations (country pages only) */}
      {childDestinations.length > 0 && (
        <ItineraryGrid heading={`Explore ${destination.name}`}>
          {childDestinations.map((child) => {
            const childHeroImage = getHeroImage(child)
            const descText = extractDescriptionText(child.description)

            return (
              <DestinationCard
                key={child.id}
                name={child.name}
                slug={child.slug}
                countrySlug={destination.slug}
                imageUrl={childHeroImage?.imgixUrl}
                description={descText}
              />
            )
          })}
        </ItineraryGrid>
      )}

      {/* FAQ Section */}
      {faqs.length > 0 && <FAQSection faqs={faqs} />}
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug: slugArray } = await paramsPromise
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  let destination: Destination | null = null

  if (slugArray.length === 1) {
    const result = await payload.find({
      collection: 'destinations',
      draft,
      limit: 1,
      overrideAccess: true,
      depth: 1,
      where: {
        and: [
          { slug: { equals: slugArray[0] } },
          { type: { equals: 'country' } },
          ...(draft ? [] : [{ _status: { equals: 'published' } }]),
        ],
      },
    })
    destination = result.docs?.[0] || null
  } else if (slugArray.length === 2) {
    const countryResult = await payload.find({
      collection: 'destinations',
      draft,
      limit: 1,
      overrideAccess: true,
      depth: 1,
      where: {
        and: [
          { slug: { equals: slugArray[0] } },
          { type: { equals: 'country' } },
          ...(draft ? [] : [{ _status: { equals: 'published' } }]),
        ],
      },
    })
    const parentCountry = countryResult.docs?.[0] || null

    if (parentCountry) {
      const destResult = await payload.find({
        collection: 'destinations',
        draft,
        limit: 1,
        overrideAccess: true,
        depth: 1,
        where: {
          and: [
            { slug: { equals: slugArray[1] } },
            { country: { equals: parentCountry.id } },
            ...(draft ? [] : [{ _status: { equals: 'published' } }]),
          ],
        },
      })
      destination = destResult.docs?.[0] || null
    }
  }

  if (!destination) {
    return {
      title: 'Destination Not Found',
    }
  }

  const slugPath = slugArray.join('/')

  return {
    title: destination.metaTitle || `${destination.name} Safari Holidays | Kiuli`,
    description:
      destination.metaDescription ||
      `Discover luxury safari experiences in ${destination.name} with Kiuli.`,
    alternates: {
      canonical: destination.canonicalUrl || `https://kiuli.com/destinations/${slugPath}`,
    },
  }
}
