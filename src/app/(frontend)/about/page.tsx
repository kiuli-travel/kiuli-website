import type { Metadata } from 'next'
import type { Author, Media } from '@/payload-types'
import Image from 'next/image'
import Link from 'next/link'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import Breadcrumb from '@/components/Breadcrumb'

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
    body: "Graham has personally visited every lodge and park we recommend. Your safari is designed from real experience, not a database.",
  },
  {
    heading: 'Personal Service',
    body: "You work with a dedicated specialist from first inquiry to final day. No call centres, no handoffs — just people who know Africa intimately.",
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
  // Prefer imgix URL, fall back to Payload-served URL for directly uploaded images
  if (media.imgixUrl) return media.imgixUrl
  if (media.url) return media.url
  return undefined
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

  // Get founder for schema and display
  const founder = authors.length > 0 ? authors[0] : null
  const founderName = founder?.name || 'Graham Wallington'
  const founderSlug = founder?.slug || 'graham-wallington'
  const founderPhoto = founder ? getPhotoUrl(founder) : undefined

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

      {/* Hero Section — full-bleed image */}
      <section className="relative h-[50vh] w-full overflow-hidden md:h-[60vh]">
        <Image
          src="https://kiuli.imgix.net/media/originals/44/5ac8607a-c783-4bf0-adda-50cde4d51335__silverless_elewana_loisaba_lodo_springs_353-upscale.jpeg?auto=format,compress&q=80"
          alt="Travelers overlooking vast African savanna at Loisaba Conservancy"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-6xl px-6 pb-10 md:px-8 md:pb-14">
            <Breadcrumb items={breadcrumbItems} />
            <h1
              className="mt-4 text-3xl font-light text-white md:text-[42px]"
              style={{ letterSpacing: '0.11em' }}
            >
              About Kiuli
            </h1>
          </div>
        </div>
      </section>

      {/* Company Story Section */}
      <section className="bg-[#F5F3EB] py-12 md:py-16">
        <div className="mx-auto max-w-[720px] px-6 text-center">
          <h2 className="text-2xl font-semibold text-[#404040] md:text-3xl">Our Story</h2>
          <div className="mx-auto mt-4 h-px w-12 bg-[#486A6A]" />
          <div className="mt-8 space-y-6 text-base leading-relaxed text-[#404040]/80 md:text-lg">
            <p>
              Kiuli was born from a lifetime spent in the African bush. Not from a boardroom, not
              from a travel agency training programme — from the land itself.
            </p>
            <p>
              Too many safari companies sell destinations they&apos;ve never lived in. We took a
              different approach. Every itinerary on Kiuli shows you what to expect before you ever
              speak to us — because we believe informed travellers make the best clients.
            </p>
          </div>
        </div>
      </section>

      {/* Image Strip */}
      <section className="bg-white py-2">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <div className="grid grid-cols-3 gap-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2px]">
              <Image
                src="https://kiuli.imgix.net/media/originals/41/2cdcc21c-ef6e-46ea-a39b-ee52a59349ee_Usawa_10-23-7.jpg?auto=format,compress&q=80"
                alt="Hot air balloon over the Serengeti at sunrise"
                fill
                className="object-cover"
                sizes="33vw"
              />
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2px]">
              <Image
                src="https://kiuli.imgix.net/media/originals/43/ab5deaaa-5940-49b5-a194-afb1d732cc53_2.png?auto=format,compress&q=80"
                alt="Mountain gorilla in Rwanda"
                fill
                className="object-cover"
                sizes="33vw"
              />
            </div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2px]">
              <Image
                src="https://kiuli.imgix.net/media/originals/44/8c8c5a65-272d-482d-b104-3db2fafb52d5_7.jpg?auto=format,compress&q=80"
                alt="Sunset over the Masai Mara from Angama"
                fill
                className="object-cover"
                sizes="33vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto max-w-[1100px] px-6 md:px-12">
          <div className="flex flex-col gap-12 lg:flex-row lg:gap-20">
            {/* Photo */}
            <div className="flex-shrink-0 lg:w-[340px]">
              {founderPhoto ? (
                <div className="relative aspect-[3/4] overflow-hidden rounded-[2px]">
                  <Image
                    src={founderPhoto}
                    alt="Graham Wallington, Founder of Kiuli"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 340px"
                  />
                </div>
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center rounded-[2px] bg-[#F5F3EB]">
                  <span className="text-6xl font-light text-[#486A6A]">GW</span>
                </div>
              )}
            </div>

            {/* Bio */}
            <div className="flex-1">
              <p
                className="text-xs font-medium uppercase text-[#486A6A]/60"
                style={{ letterSpacing: '0.2em' }}
              >
                Founder
              </p>
              <h2 className="mt-3 text-[32px] font-light text-[#404040] md:text-[38px]" style={{ letterSpacing: '0.11em' }}>
                Graham Wallington
              </h2>

              <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-[#404040]/80">
                <p>
                  Born and raised in Africa, Graham has spent his career building bridges between
                  people and the continent&apos;s extraordinary wildlife. His journey began with
                  AfriCam, the world&apos;s first live wildlife cameras, which brought the African
                  bush into homes around the globe.
                </p>
                <p>
                  He went on to found WildEarth, pioneering live-streamed safaris that let millions
                  experience game drives in real time — long before live streaming became mainstream.
                  These ventures weren&apos;t just technology plays. They were built on a deep conviction
                  that connecting people to wild places changes how they think about conservation.
                </p>
                <p>
                  That same conviction drives Kiuli. Every safari we design reflects decades of
                  firsthand knowledge: which guides read landscapes with an almost supernatural
                  instinct, which lodges deliver genuine care rather than performative luxury, and
                  which routes reveal Africa at its most honest.
                </p>
                <p>
                  Graham also founded Xeroth AI, which is developing radar and artificial intelligence
                  systems to detect wire snares — one of the most devastating and indiscriminate forms
                  of poaching threatening Africa&apos;s wildlife. The goal is straightforward: make
                  snaring economically unviable by finding snares faster than poachers can set them.
                </p>
                <p>
                  Kiuli is where all of this comes together. Technology, conservation, and the kind of
                  intimate knowledge that only comes from a life lived on this continent.
                </p>
              </div>
            </div>
          </div>
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

      {/* CTA */}
      <section className="bg-[#486A6A] py-20 md:py-28">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-[36px] font-light text-white" style={{ letterSpacing: '0.11em' }}>
            Ready to Begin?
          </h2>
          <p className="mt-4 text-lg font-light text-white/70">
            Tell us about the safari you&apos;re imagining. We&apos;ll design something extraordinary.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex rounded-sm bg-[#DA7A5A] px-10 py-4 text-base font-medium text-white transition-colors hover:bg-[#C66A4A]"
          >
            Begin a Conversation
          </Link>
        </div>
      </section>
    </main>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'About Kiuli | Luxury African Safari Specialists',
    description:
      'Founded by Graham Wallington, creator of AfriCam and WildEarth. Kiuli designs luxury African safaris from a lifetime of firsthand experience on the continent.',
    alternates: {
      canonical: 'https://kiuli.com/about',
    },
  }
}
