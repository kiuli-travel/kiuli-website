import React from 'react'
import Link from 'next/link'
import Image from 'next/image'

import type {
  DestinationHighlightsBlock as DestinationHighlightsBlockProps,
  Destination,
  Media,
} from '@/payload-types'

// Helper: Get destination URL based on type
function getDestinationUrl(destination: Destination): string {
  // Countries link directly
  if (destination.type === 'country') {
    return `/destinations/${destination.slug}`
  }

  // Destinations (non-countries) need parent country
  const country = destination.country as Destination | null
  if (country?.slug) {
    return `/destinations/${country.slug}/${destination.slug}`
  }

  // Fallback
  return `/destinations/${destination.slug}`
}

// Helper: Get type badge label
function getTypeBadge(type: string): string {
  switch (type) {
    case 'country':
      return 'Country'
    case 'destination':
      return 'Destination'
    default:
      return 'Destination'
  }
}

export const DestinationHighlightsBlock: React.FC<DestinationHighlightsBlockProps> = ({
  heading,
  subheading,
  destinations,
}) => {
  const destinationList = (destinations || []) as Destination[]

  if (destinationList.length === 0) return null

  return (
    <section className="bg-white py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-6 md:px-8">
        {(heading || subheading) && (
          <div className="mb-12 text-center">
            {heading && (
              <h2 className="text-2xl font-semibold text-[#404040] md:text-3xl">{heading}</h2>
            )}
            {subheading && (
              <p className="mx-auto mt-4 max-w-2xl text-base text-[#404040]/70 md:text-lg">
                {subheading}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {destinationList.map((destination) => {
            const heroImage = destination.heroImage as Media | null
            const imageUrl = heroImage?.imgixUrl || heroImage?.url || ''

            return (
              <Link
                key={destination.id}
                href={getDestinationUrl(destination)}
                className="group relative aspect-[4/3] overflow-hidden rounded-sm"
              >
                {/* Image */}
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={destination.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#F5F3EB]" />
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <span className="mb-2 inline-block rounded-sm bg-white/20 px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-white backdrop-blur-sm">
                    {getTypeBadge(destination.type)}
                  </span>
                  <h3 className="text-xl font-semibold text-white">{destination.name}</h3>
                </div>

                {/* Hover indicator */}
                <div className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                  <span className="text-white">&rarr;</span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
