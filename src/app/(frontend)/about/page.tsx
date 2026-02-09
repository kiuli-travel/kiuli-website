import type { Metadata } from 'next'
import type { Author, Media } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import Breadcrumb from '@/components/Breadcrumb'
import TeamMemberCard from '@/components/about/TeamMemberCard'
import { InquiryCTA } from '@/components/itinerary/InquiryCTA'

export const revalidate = 600
export const dynamic = 'force-static'

// Why Kiuli differentiators
const differentiators = [
  {
    heading: 'Transparent Pricing',
    body: "Every safari on our site shows the investment level upfront. No hidden costs, no surprises — just honest pricing from the start.",
  },
  {
    heading: 'Firsthand Expertise',
    body: "Our team has personally visited every lodge and park we recommend. We design your safari from real experience, not a database.",
  },
  {
    heading: 'Dedicated Specialists',
    body: "You work with one dedicated safari specialist from first inquiry to final day. No call centres, no handoffs.",
  },
]

// JSON-LD: Organization
function generateOrganizationSchema(founderName: string, founderSlug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Kiuli',
    url: 'https://kiuli.com',
    description:
      'Luxury African safari specialists designing bespoke wildlife experiences based on firsthand expertise.',
    founder: {
      '@type': 'Person',
      name: founderName,
      url: `https://kiuli.com/authors/${founderSlug}`,
    },
  }
}

// JSON-LD: BreadcrumbList
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
        name: 'About',
        item: 'https://kiuli.com/about',
      },
    ],
  }
}

// Helper: Get photo URL from author
function getPhotoUrl(author: Author): string | undefined {
  const photo = author.photo
  if (!photo || typeof photo === 'number') return undefined

  const media = photo as Media
  return media.imgixUrl || undefined
}

export default async function AboutPage() {
  const payload = await getPayload({ config: configPromise })

  // Fetch all published authors
  const result = await payload.find({
    collection: 'authors',
    limit: 50,
    overrideAccess: true,
    depth: 1,
    where: {
      _status: {
        equals: 'published',
      },
    },
  })

  const authors = result.docs || []

  // Build breadcrumb items
  const breadcrumbItems = [{ label: 'Home', href: '/' }, { label: 'About' }]

  // Get founder for schema (first author, or use Graham Wallington as default)
  const founder = authors.length > 0 ? authors[0] : null
  const founderName = founder?.name || 'Graham Wallington'
  const founderSlug = founder?.slug || 'graham-wallington'

  // Generate schemas
  const organizationSchema = generateOrganizationSchema(founderName, founderSlug)
  const breadcrumbSchema = generateBreadcrumbSchema()

  return (
    <main>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* Hero Section */}
      <section className="bg-[#F5F3EB] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <Breadcrumb items={breadcrumbItems} />
          <h1 className="mt-6 text-3xl font-bold text-[#404040] md:text-4xl">About Kiuli</h1>
          <p className="mt-4 max-w-2xl text-lg text-[#404040]/70">
            Luxury African safaris, designed by people who know Africa
          </p>
        </div>
      </section>

      {/* Company Story Section */}
      <section className="bg-[#F5F3EB] py-12 md:py-16">
        <div className="mx-auto max-w-[720px] px-6 text-center">
          <h2 className="text-2xl font-semibold text-[#404040] md:text-3xl">Our Story</h2>
          <div className="mx-auto mt-4 h-px w-12 bg-[#486A6A]" />
          <div className="mt-8 space-y-6 text-base leading-relaxed text-[#404040]/80 md:text-lg">
            <p>
              Kiuli was born from a simple belief: that Africa&apos;s most extraordinary wildlife
              experiences should be accessible to discerning travellers who value transparency as
              much as luxury.
            </p>
            <p>
              Too many safari companies hide behind vague pricing and impersonal service. We took a
              different approach. Every itinerary on Kiuli shows you what to expect before you ever
              speak to us — because we believe informed travellers make the best clients.
            </p>
            <p>
              Our team has collectively spent decades living, working, and exploring across Africa.
              We don&apos;t sell safaris from a catalogue. We design experiences based on firsthand
              knowledge of every lodge, every park, and every route we recommend.
            </p>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="bg-white py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-[#404040] md:text-3xl">Meet the Team</h2>
            <div className="mx-auto mt-4 h-px w-12 bg-[#486A6A]" />
          </div>

          {authors.length > 0 ? (
            <div className="mt-12 flex justify-center">
              <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3">
                {authors.map((author) => (
                  <TeamMemberCard
                    key={author.id}
                    name={author.name}
                    slug={author.slug}
                    role={author.role || undefined}
                    photoUrl={getPhotoUrl(author)}
                    photoAlt={author.name}
                    shortBio={author.shortBio || undefined}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-8 text-center text-[#404040]/70">Team information coming soon.</p>
          )}
        </div>
      </section>

      {/* Why Kiuli Section */}
      <section className="bg-[#F5F3EB] py-12 md:py-16">
        <div className="mx-auto max-w-6xl px-6 md:px-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-[#404040] md:text-3xl">Why Kiuli</h2>
            <div className="mx-auto mt-4 h-px w-12 bg-[#486A6A]" />
          </div>

          <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3">
            {differentiators.map((item, index) => (
              <div key={index} className="text-center">
                <div className="mx-auto mb-4 h-2 w-2 rounded-full bg-[#486A6A]" />
                <h3 className="text-lg font-semibold text-[#404040]">{item.heading}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[#404040]/80">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Inquiry CTA */}
      <InquiryCTA />
    </main>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'About Kiuli | Luxury African Safari Specialists',
    description:
      'Meet the team behind Kiuli. We design luxury African safari experiences based on firsthand knowledge of every lodge, park, and route we recommend.',
    alternates: {
      canonical: 'https://kiuli.com/about',
    },
  }
}
