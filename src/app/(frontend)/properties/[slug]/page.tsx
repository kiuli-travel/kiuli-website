import type { Metadata } from 'next'
import type { Property, Destination, Media, Itinerary } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import Image from 'next/image'

import Breadcrumb from '@/components/Breadcrumb'
import AnswerCapsule from '@/components/AnswerCapsule'
import PropertyHero from '@/components/property/PropertyHero'
import ItineraryGrid from '@/components/ItineraryGrid'
import ItineraryCard from '@/components/ItineraryCard'
import { FAQSection } from '@/components/itinerary/FAQSection'
import { InquiryCTA } from '@/components/itinerary/InquiryCTA'
import RichText from '@/components/RichText'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

export const revalidate = 600
export const dynamic = 'force-static'
export const dynamicParams = false // Return 404 for slugs not in generateStaticParams

type Args = {
  params: Promise<{
    slug: string
  }>
}

// Helper: Extract plain text from Lexical richText
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
function getHeroImage(property: Property): { imgixUrl: string; alt: string } | null {
  const heroImage = property.heroImage
  if (!heroImage || typeof heroImage === 'number') return null

  const media = heroImage as Media
  if (!media.imgixUrl) return null

  return {
    imgixUrl: media.imgixUrl,
    alt: media.alt || media.altText || property.name,
  }
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

// Helper: Resolve property description (three-field pattern)
function resolveDescription(property: Property): { content: unknown; isPlainText: boolean } | null {
  // Priority: reviewed > enhanced > itrvl
  if (property.description_reviewed) {
    return { content: property.description_reviewed, isPlainText: false }
  }
  if (property.description_enhanced) {
    return { content: property.description_enhanced, isPlainText: false }
  }
  if (property.description_itrvl) {
    return { content: property.description_itrvl, isPlainText: true }
  }
  return null
}

// Helper: Get plain text description for meta/schema
function getPlainTextDescription(property: Property, maxLength?: number): string {
  const resolved = resolveDescription(property)
  if (!resolved) return ''

  let text: string
  if (resolved.isPlainText) {
    text = resolved.content as string
  } else {
    text = extractTextFromRichText(resolved.content)
  }

  if (maxLength && text.length > maxLength) {
    return text.substring(0, maxLength).trim() + '...'
  }
  return text
}

// Map price tier to schema.org priceRange
function mapPriceTierToRange(tier: string | null | undefined): string {
  if (!tier) return '$$'
  const map: Record<string, string> = {
    comfort: '$',
    premium: '$',
    luxury: '$$',
    ultra_luxury: '$$',
  }
  return map[tier] || '$$'
}

// Generate BreadcrumbList JSON-LD (4 levels for properties)
function generateBreadcrumbSchema(
  property: Property,
  destination: Destination | null,
  country: Destination | null,
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

  let position = 3

  // Add country level
  if (country) {
    items.push({
      '@type': 'ListItem',
      position: position++,
      name: country.name,
      item: `https://kiuli.com/destinations/${country.slug}`,
    })
  }

  // Add park/region level
  if (destination) {
    const destSlug = country
      ? `${country.slug}/${destination.slug}`
      : destination.slug
    items.push({
      '@type': 'ListItem',
      position: position++,
      name: destination.name,
      item: `https://kiuli.com/destinations/${destSlug}`,
    })
  }

  // Current page (property)
  items.push({
    '@type': 'ListItem',
    position: position,
    name: property.name,
    item: `https://kiuli.com/properties/${property.slug}`,
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items,
  }
}

// Generate LodgingBusiness JSON-LD
function generateLodgingBusinessSchema(
  property: Property,
  destination: Destination | null,
  country: Destination | null,
  heroImageUrl: string | null,
) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: property.name,
    url: `https://kiuli.com/properties/${property.slug}`,
    priceRange: mapPriceTierToRange(property.priceTier),
  }

  const description = getPlainTextDescription(property, 300)
  if (description) {
    schema.description = description
  }

  if (heroImageUrl) {
    schema.image = heroImageUrl
  }

  if (destination || country) {
    schema.containedInPlace = {
      '@type': 'Place',
      name: destination?.name || country?.name,
      address: {
        '@type': 'PostalAddress',
        addressCountry: country?.name || '',
      },
    }
  }

  return schema
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

  const properties = await payload.find({
    collection: 'properties',
    where: { _status: { equals: 'published' } },
    limit: 1000,
    select: { slug: true },
  })

  return properties.docs.map((p) => ({ slug: p.slug }))
}

export default async function PropertyPage({ params: paramsPromise }: Args) {
  const { slug } = await paramsPromise
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  // Fetch property with depth 2 to get destination.country
  const result = await payload.find({
    collection: 'properties',
    draft,
    limit: 1,
    overrideAccess: true,
    depth: 3, // Need depth for destination.country and media
    where: {
      and: [
        { slug: { equals: slug } },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
  })

  const property = result.docs?.[0]

  if (!property) {
    notFound()
  }

  // Extract destination and country
  const destination = typeof property.destination === 'object' ? property.destination : null
  const country =
    destination && typeof destination.country === 'object' ? destination.country : null

  // Get hero image
  const heroImage = getHeroImage(property)

  // Resolve description
  const resolvedDesc = resolveDescription(property)

  // Build breadcrumb items (4 levels)
  const breadcrumbItems: Array<{ label: string; href?: string }> = [
    { label: 'Home', href: '/' },
    { label: 'Destinations', href: '/destinations' },
  ]

  if (country) {
    breadcrumbItems.push({
      label: country.name,
      href: `/destinations/${country.slug}`,
    })
  }

  if (destination) {
    const destHref = country
      ? `/destinations/${country.slug}/${destination.slug}`
      : `/destinations/${destination.slug}`
    breadcrumbItems.push({
      label: destination.name,
      href: destHref,
    })
  }

  breadcrumbItems.push({ label: property.name })

  // Extract FAQs
  const faqs: Array<{ question: string; answer: string }> = []
  if (property.faqItems && property.faqItems.length > 0) {
    for (const item of property.faqItems) {
      const question = item.question || ''
      const answerText = extractTextFromRichText(item.answer)
      if (question && answerText) {
        faqs.push({ question, answer: answerText })
      }
    }
  }

  // Fetch related itineraries
  const relatedItineraries: Itinerary[] = []
  if (property.relatedItineraries && property.relatedItineraries.length > 0) {
    const itinIds = property.relatedItineraries
      .map((r) => (typeof r === 'object' ? r.id : r))
      .filter((id): id is number => typeof id === 'number')

    if (itinIds.length > 0) {
      const itinResult = await payload.find({
        collection: 'itineraries',
        draft,
        limit: 20,
        overrideAccess: true,
        depth: 2,
        where: {
          and: [
            { id: { in: itinIds } },
            ...(draft ? [] : [{ _status: { equals: 'published' } }]),
          ],
        },
      })
      relatedItineraries.push(...itinResult.docs)
    }
  }

  // Generate schemas
  const breadcrumbSchema = generateBreadcrumbSchema(property, destination, country)
  const lodgingSchema = generateLodgingBusinessSchema(
    property,
    destination,
    country,
    heroImage?.imgixUrl || null,
  )
  const faqSchema = generateFAQSchema(faqs)

  // Get gallery images
  const galleryImages: Array<{ imgixUrl: string; alt: string }> = []
  if (property.gallery && property.gallery.length > 0) {
    for (const item of property.gallery) {
      const img = typeof item.image === 'object' ? item.image : null
      if (img && img.imgixUrl) {
        galleryImages.push({
          imgixUrl: img.imgixUrl,
          alt: img.alt || img.altText || property.name,
        })
      }
    }
  }

  return (
    <article>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(lodgingSchema) }}
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

      {/* Hero */}
      {heroImage ? (
        <PropertyHero
          name={property.name}
          heroImageUrl={heroImage.imgixUrl}
          heroImageAlt={heroImage.alt}
          destinationName={destination?.name}
          countryName={country?.name}
          type={property.type || undefined}
          priceTier={property.priceTier || undefined}
        />
      ) : (
        <section className="w-full py-12 md:py-16">
          <div className="mx-auto max-w-[1280px] px-6">
            {property.type && (
              <span className="block text-xs uppercase tracking-[0.1em] text-[#486A6A] mb-2">
                {property.type.replace('_', ' ')}
              </span>
            )}
            <h1 className="text-4xl md:text-5xl font-bold text-[#404040] leading-tight">
              {property.name}
            </h1>
            {destination && (
              <p className="mt-2 text-base md:text-lg text-[#404040]/70">
                {destination.name}
                {country && `, ${country.name}`}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Answer Capsule */}
      {property.answerCapsule && (
        <AnswerCapsule
          text={property.answerCapsule}
          focusKeyword={property.focusKeyword || undefined}
        />
      )}

      {/* Description */}
      {resolvedDesc && (
        <section className="w-full py-8 px-6 md:py-12">
          <div className="mx-auto max-w-[720px]">
            <div className="prose prose-lg max-w-none text-[#404040] leading-[1.6]">
              {resolvedDesc.isPlainText ? (
                <p>{resolvedDesc.content as string}</p>
              ) : (
                <RichText
                  data={resolvedDesc.content as DefaultTypedEditorState}
                  enableGutter={false}
                  enableProse={false}
                />
              )}
            </div>
          </div>
        </section>
      )}

      {/* Gallery */}
      {galleryImages.length > 0 && (
        <section className="w-full py-8 px-6 md:py-12 bg-[#F5F3EB]">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl md:text-3xl font-bold text-[#404040] mb-8">Gallery</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {galleryImages.map((img, index) => (
                <div key={index} className="relative aspect-[3/2] overflow-hidden rounded-lg">
                  <Image
                    src={`${img.imgixUrl}?w=600&h=400&fit=crop`}
                    alt={img.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured in These Itineraries */}
      {relatedItineraries.length > 0 && (
        <ItineraryGrid heading="Featured in These Itineraries">
          {relatedItineraries.map((itinerary) => {
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

      {/* FAQ Section */}
      {faqs.length > 0 && <FAQSection faqs={faqs} />}

      {/* Inquiry CTA */}
      <InquiryCTA />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug } = await paramsPromise
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'properties',
    draft,
    limit: 1,
    overrideAccess: true,
    depth: 2,
    where: {
      and: [
        { slug: { equals: slug } },
        ...(draft ? [] : [{ _status: { equals: 'published' } }]),
      ],
    },
  })

  const property = result.docs?.[0]

  if (!property) {
    return {
      title: 'Property Not Found',
    }
  }

  // Get hero image for OG
  const heroImage = getHeroImage(property)
  const ogImageUrl = heroImage
    ? `${heroImage.imgixUrl}?w=1200&h=630&fit=crop`
    : undefined

  // Get description
  const description =
    property.metaDescription || getPlainTextDescription(property, 160)

  return {
    title: property.metaTitle || `${property.name} | Kiuli`,
    description: description || `Discover ${property.name} with Kiuli.`,
    alternates: {
      canonical: property.canonicalUrl || `https://kiuli.com/properties/${property.slug}`,
    },
    openGraph: ogImageUrl
      ? {
          images: [{ url: ogImageUrl, width: 1200, height: 630 }],
        }
      : undefined,
  }
}
