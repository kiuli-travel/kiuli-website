import React from 'react'

import type {
  FeaturedPropertiesBlock as FeaturedPropertiesBlockProps,
  Property,
  Media,
  Destination,
} from '@/payload-types'

import PropertyCard from '@/components/PropertyCard'

export const FeaturedPropertiesBlock: React.FC<FeaturedPropertiesBlockProps> = ({
  heading,
  subheading,
  properties,
}) => {
  const propertyList = (properties || []) as Property[]

  if (propertyList.length === 0) return null

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
          {propertyList.map((property) => {
            const heroImage = property.heroImage as Media | null
            const destination = property.destination as Destination | null

            return (
              <PropertyCard
                key={property.id}
                slug={property.slug}
                name={property.name}
                type={property.type || undefined}
                imageUrl={heroImage?.imgixUrl || undefined}
                destinationName={destination?.name || undefined}
                priceTier={property.priceTier || undefined}
              />
            )
          })}
        </div>
      </div>
    </section>
  )
}
