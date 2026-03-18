import type { Metadata } from 'next'
import type { Destination, Media } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import Link from 'next/link'
import Image from 'next/image'

import Breadcrumb from '@/components/Breadcrumb'
import ItineraryGrid from '@/components/ItineraryGrid'
import { InquiryCTA } from '@/components/itinerary/InquiryCTA'

export const revalidate = 600

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
        name: 'Destinations',
        item: 'https://kiuli.com/destinations',
      },
    ],
  }
}

// Destination Card Component (inline since it's simpler for listing)
function DestinationListCard({
  name,
  slug,
  imageUrl,
  imageAlt,
}: {
  name: string
  slug: string
  imageUrl?: string
  imageAlt?: string
}) {
  return (
    <Link
      href={`/destinations/${slug}`}
      className="group relative block aspect-[4/3] overflow-hidden rounded-[2px]"
    >
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={imageAlt || name}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-[400ms] ease-in-out group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#486A6A] to-[#2d4444]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="text-xl font-semibold text-white drop-shadow-sm">{name}</h3>
        <p className="mt-1 text-sm text-white/80 transition-colors group-hover:text-white">
          Explore destinations in {name} →
        </p>
      </div>
    </Link>
  )
}

export default async function DestinationsPage() {
  const payload = await getPayload({ config: configPromise })

  // Fetch all published country-level destinations
  const result = await payload.find({
    collection: 'destinations',
    limit: 50,
    overrideAccess: true,
    depth: 1,
    where: {
      and: [
        { type: { equals: 'country' } },
        { _status: { equals: 'published' } },
      ],
    },
    sort: 'name',
  })

  const countries = result.docs || []

  // Extract data for cards — show all countries, with or without hero images
  const destinationCards = countries.map((destination) => {
    const heroImage = getHeroImage(destination)
    return {
      slug: destination.slug,
      name: destination.name,
      imageUrl: heroImage?.imgixUrl,
      imageAlt: heroImage?.alt,
    }
  })

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Where We Go' },
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
            Where We Go
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#404040]/70">
            Five extraordinary countries, each with world-class destinations and handpicked
            properties. Select a country to explore the destinations within it.
          </p>
        </div>
      </section>

      {/* Destinations Grid */}
      {destinationCards.length > 0 ? (
        <ItineraryGrid>
          {destinationCards.map((card) => (
            <DestinationListCard
              key={card.slug}
              name={card.name}
              slug={card.slug}
              imageUrl={card.imageUrl}
              imageAlt={card.imageAlt}
            />
          ))}
        </ItineraryGrid>
      ) : (
        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6 text-center md:px-8">
            <p className="text-lg text-[#404040]/70">
              No destinations available at the moment. Please check back soon.
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
    title: 'Where We Go — Safari Countries | Kiuli',
    description:
      'Five extraordinary African countries with world-class safari destinations and handpicked luxury properties. Kenya, Tanzania, Rwanda, South Africa, and Mozambique.',
    alternates: {
      canonical: 'https://kiuli.com/destinations',
    },
    openGraph: {
      title: 'Where We Go — Safari Countries | Kiuli',
      description:
        'Five extraordinary African countries with world-class safari destinations.',
      url: 'https://kiuli.com/destinations',
    },
  }
}
