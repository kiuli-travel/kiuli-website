import type { Metadata } from 'next'
import type { Itinerary, Media } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import Breadcrumb from '@/components/Breadcrumb'
import ItineraryGrid from '@/components/ItineraryGrid'
import ItineraryCard from '@/components/ItineraryCard'
import { InquiryCTA } from '@/components/itinerary/InquiryCTA'

export const revalidate = 600
export const dynamic = 'force-static'

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

// Helper: Get nights from itinerary
function getNights(itinerary: Itinerary): number {
  return itinerary.overview?.nights || 0
}

// Helper: Get price from itinerary
function getPrice(itinerary: Itinerary): number {
  return itinerary.investmentLevel?.fromPrice || 0
}

// Generate BreadcrumbList JSON-LD
function generateBreadcrumbSchema() {
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
    ],
  }
}

// Generate ItemList JSON-LD for itineraries
function generateItemListSchema(
  itineraries: Array<{
    slug: string
    title: string
    heroImageUrl: string
    priceFrom: number
  }>,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Luxury African Safaris',
    description: 'Handpicked luxury safari itineraries across Africa',
    numberOfItems: itineraries.length,
    itemListElement: itineraries.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: item.title,
        url: `https://kiuli.com/safaris/${item.slug}`,
        image: item.heroImageUrl,
        offers: {
          '@type': 'Offer',
          priceCurrency: 'USD',
          price: item.priceFrom,
          availability: 'https://schema.org/InStock',
        },
      },
    })),
  }
}

export default async function SafarisPage() {
  const payload = await getPayload({ config: configPromise })

  // Fetch all published itineraries
  const result = await payload.find({
    collection: 'itineraries',
    limit: 100,
    overrideAccess: true,
    depth: 1,
    sort: '-createdAt',
  })

  const itineraries = result.docs || []

  // Extract data for cards
  const itineraryCards = itineraries
    .map((itinerary) => {
      const heroImage = getHeroImage(itinerary)
      if (!heroImage) return null

      const countries = extractCountries(itinerary)
      const nights = getNights(itinerary)
      const priceFrom = getPrice(itinerary)

      // Skip if missing essential data
      if (countries.length === 0 || nights === 0 || priceFrom === 0) return null

      return {
        slug: itinerary.slug,
        title: itinerary.title,
        heroImageUrl: heroImage.imgixUrl,
        heroImageAlt: heroImage.alt,
        nights,
        priceFrom,
        countries,
      }
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Safaris' },
  ]

  // Generate schemas
  const breadcrumbSchema = generateBreadcrumbSchema()
  const itemListSchema = generateItemListSchema(
    itineraryCards.map((c) => ({
      slug: c.slug,
      title: c.title,
      heroImageUrl: c.heroImageUrl,
      priceFrom: c.priceFrom,
    })),
  )

  return (
    <main>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      {/* Hero Section */}
      <section className="bg-[#F5F3EB] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <Breadcrumb items={breadcrumbItems} />
          <h1 className="mt-6 text-3xl font-bold text-[#404040] md:text-4xl">
            Luxury African Safaris
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#404040]/70">
            Discover our handpicked collection of transformative safari experiences across Africa&apos;s
            most extraordinary destinations.
          </p>
        </div>
      </section>

      {/* Safari Grid */}
      {itineraryCards.length > 0 ? (
        <ItineraryGrid>
          {itineraryCards.map((card) => (
            <ItineraryCard
              key={card.slug}
              title={card.title}
              slug={card.slug}
              heroImageUrl={card.heroImageUrl}
              heroImageAlt={card.heroImageAlt}
              nights={card.nights}
              priceFrom={card.priceFrom}
              countries={card.countries}
            />
          ))}
        </ItineraryGrid>
      ) : (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6 text-center md:px-8">
            <p className="text-lg text-[#404040]/70">
              No safaris available at the moment. Please check back soon.
            </p>
          </div>
        </section>
      )}

      {/* Inquiry CTA */}
      <InquiryCTA />
    </main>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Luxury African Safaris | Kiuli',
    description:
      'Discover handpicked luxury safari itineraries across Kenya, Tanzania, Botswana, Rwanda, and beyond. Expert-curated experiences for discerning travelers.',
    alternates: {
      canonical: 'https://kiuli.com/safaris',
    },
    openGraph: {
      title: 'Luxury African Safaris | Kiuli',
      description:
        'Discover handpicked luxury safari itineraries across Kenya, Tanzania, Botswana, Rwanda, and beyond.',
      url: 'https://kiuli.com/safaris',
    },
  }
}
