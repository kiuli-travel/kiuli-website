import type { Metadata } from 'next'
import type { Property, Media, Destination } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import Breadcrumb from '@/components/Breadcrumb'
import ItineraryGrid from '@/components/ItineraryGrid'
import PropertyCard from '@/components/PropertyCard'
import { InquiryCTA } from '@/components/itinerary/InquiryCTA'

export const revalidate = 600
export const dynamic = 'force-static'

// Helper: Get hero image URL
function getHeroImageUrl(property: Property): string | undefined {
  const heroImage = property.heroImage
  if (!heroImage || typeof heroImage === 'number') return undefined

  const media = heroImage as Media
  return media.imgixUrl || undefined
}

// Helper: Get destination name
function getDestinationName(property: Property): string | undefined {
  const destination = property.destination
  if (!destination || typeof destination === 'number') return undefined

  return (destination as Destination).name || undefined
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
        name: 'Properties',
        item: 'https://kiuli.com/properties',
      },
    ],
  }
}

export default async function PropertiesPage() {
  const payload = await getPayload({ config: configPromise })

  // Fetch all published properties
  const result = await payload.find({
    collection: 'properties',
    limit: 200,
    overrideAccess: true,
    depth: 1,
    where: {
      _status: { equals: 'published' },
    },
    sort: 'name',
  })

  const properties = result.docs || []

  // Extract data for cards
  const propertyCards = properties.map((property) => ({
    name: property.name,
    slug: property.slug,
    imageUrl: getHeroImageUrl(property),
    type: property.type || undefined,
    priceTier: property.priceTier || undefined,
    destinationName: getDestinationName(property),
  }))

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Properties' },
  ]

  // Generate schemas
  const breadcrumbSchema = generateBreadcrumbSchema()

  return (
    <main>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero Section */}
      <section className="bg-[#F5F3EB] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <Breadcrumb items={breadcrumbItems} />
          <h1 className="mt-6 text-3xl font-bold text-[#404040] md:text-4xl">
            Safari Properties
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#404040]/70">
            Explore the finest safari lodges, camps, and hotels across Africa. Each property
            is handpicked for exceptional service, stunning locations, and authentic experiences.
          </p>
        </div>
      </section>

      {/* Properties Grid */}
      {propertyCards.length > 0 ? (
        <ItineraryGrid>
          {propertyCards.map((card) => (
            <PropertyCard
              key={card.slug}
              name={card.name}
              slug={card.slug}
              imageUrl={card.imageUrl}
              type={card.type}
              priceTier={card.priceTier}
              destinationName={card.destinationName}
            />
          ))}
        </ItineraryGrid>
      ) : (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6 text-center md:px-8">
            <p className="text-lg text-[#404040]/70">
              Our curated collection of safari properties is coming soon. Please check back later.
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
    title: 'Safari Properties | Kiuli',
    description:
      'Explore the finest safari lodges, camps, and hotels across Africa. Handpicked properties offering exceptional service and authentic experiences.',
    alternates: {
      canonical: 'https://kiuli.com/properties',
    },
    openGraph: {
      title: 'Safari Properties | Kiuli',
      description:
        'Explore the finest safari lodges, camps, and hotels across Africa.',
      url: 'https://kiuli.com/properties',
    },
  }
}
