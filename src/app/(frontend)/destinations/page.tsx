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
export const dynamic = 'force-static'

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
  imageUrl: string
  imageAlt: string
}) {
  return (
    <Link
      href={`/destinations/${slug}`}
      className="group relative block aspect-[4/3] overflow-hidden rounded-[2px]"
    >
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        className="object-cover transition-transform duration-[400ms] ease-in-out group-hover:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h3 className="text-xl font-semibold text-white drop-shadow-sm">{name}</h3>
        <p className="mt-1 text-sm text-white/80 transition-colors group-hover:text-white">
          Explore safaris in {name} →
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

  // Extract data for cards
  const destinationCards = countries
    .map((destination) => {
      const heroImage = getHeroImage(destination)
      if (!heroImage) return null

      return {
        slug: destination.slug,
        name: destination.name,
        imageUrl: heroImage.imgixUrl,
        imageAlt: heroImage.alt,
      }
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)

  // Build breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Destinations' },
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
            Safari Destinations
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-[#404040]/70">
            Explore Africa&apos;s most extraordinary safari destinations. From the vast plains of the
            Serengeti to the misty mountains of Rwanda, discover where your adventure awaits.
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
    title: 'Safari Destinations | Kiuli',
    description:
      'Explore Africa\'s most extraordinary safari destinations. From Kenya and Tanzania to Botswana and Rwanda, discover handpicked luxury safari experiences.',
    alternates: {
      canonical: 'https://kiuli.com/destinations',
    },
    openGraph: {
      title: 'Safari Destinations | Kiuli',
      description:
        'Explore Africa\'s most extraordinary safari destinations with Kiuli.',
      url: 'https://kiuli.com/destinations',
    },
  }
}
