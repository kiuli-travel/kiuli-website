import React from 'react'

import type {
  FeaturedItinerariesBlock as FeaturedItinerariesBlockProps,
  Itinerary,
  Media,
} from '@/payload-types'

import ItineraryGrid from '@/components/ItineraryGrid'
import ItineraryCard from '@/components/ItineraryCard'

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

export const FeaturedItinerariesBlock: React.FC<FeaturedItinerariesBlockProps> = ({
  heading,
  subheading,
  itineraries,
  showPricing = true,
}) => {
  // Convert relationship to array of itineraries
  const itineraryList = (itineraries || []) as Itinerary[]

  // Build card data
  const cards = itineraryList
    .map((itinerary) => {
      const heroImage = getHeroImage(itinerary)
      if (!heroImage) return null

      const countries = extractCountries(itinerary)
      const nights = itinerary.overview?.nights || 0
      const priceFrom = itinerary.investmentLevel?.fromPrice || 0

      return {
        slug: itinerary.slug,
        title: itinerary.title,
        heroImageUrl: heroImage.imgixUrl,
        heroImageAlt: heroImage.alt,
        nights,
        priceFrom,
        countries,
        showPricing,
      }
    })
    .filter((card): card is NonNullable<typeof card> => card !== null)

  if (cards.length === 0) return null

  return (
    <section className="bg-[#F5F3EB] py-12 md:py-20">
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

        <ItineraryGrid>
          {cards.map((card) => (
            <ItineraryCard
              key={card.slug}
              title={card.title}
              slug={card.slug}
              heroImageUrl={card.heroImageUrl}
              heroImageAlt={card.heroImageAlt}
              nights={card.nights}
              priceFrom={card.showPricing ? card.priceFrom : 0}
              countries={card.countries}
            />
          ))}
        </ItineraryGrid>
      </div>
    </section>
  )
}
