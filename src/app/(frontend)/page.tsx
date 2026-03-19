import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { Itinerary, Destination, Media } from '@/payload-types'
// InquiryCTA not used — CTA section built inline

export const revalidate = 600

// ── Data helpers ──────────────────────────────────────────────────────────

function getImgixUrl(media: number | Media | null | undefined): string | null {
  if (!media || typeof media === 'number') return null
  return media.imgixUrl || media.url || null
}

function getAlt(media: number | Media | null | undefined, fallback: string): string {
  if (!media || typeof media === 'number') return fallback
  return media.alt || media.altText || fallback
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

// ── Page component ────────────────────────────────────────────────────────

export default async function HomePage() {
  const payload = await getPayload({ config: configPromise })

  // Fetch itineraries for featured safaris
  const itineraryResult = await payload.find({
    collection: 'itineraries',
    where: { _status: { equals: 'published' } },
    limit: 6,
    depth: 2,
    overrideAccess: true,
    sort: '-createdAt',
  })
  const itineraries = itineraryResult.docs as Itinerary[]

  // Fetch countries for "Where We Go"
  const countryResult = await payload.find({
    collection: 'destinations',
    where: {
      and: [
        { type: { equals: 'country' } },
        { _status: { equals: 'published' } },
      ],
    },
    limit: 10,
    depth: 1,
    overrideAccess: true,
    sort: 'name',
  })
  const countries = countryResult.docs as Destination[]

  // Count child destinations per country
  const countryCounts: Record<number, number> = {}
  for (const country of countries) {
    const childResult = await payload.count({
      collection: 'destinations',
      where: {
        and: [
          { country: { equals: country.id } },
          { _status: { equals: 'published' } },
        ],
      },
      overrideAccess: true,
    })
    countryCounts[country.id] = childResult.totalDocs
  }

  // Hero image: giraffe sunset (media 1333) — use direct URL to avoid encoding issues
  const HERO_IMAGE_URL = 'https://kiuli.imgix.net/media/originals/41/44af81ff-fc8f-42d1-bed2-9004f40e7943_chem_chem_-_wildlife_10-upscale.jpeg?auto=format,compress&q=80'

  return (
    <main>
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Kiuli',
            url: 'https://kiuli.com',
            description: 'Handcrafted luxury African safari experiences.',
          }),
        }}
      />

      {/* ─── HERO ─── */}
      <section className="relative h-screen w-full overflow-hidden">
        {HERO_IMAGE_URL && (
          <Image
            src={HERO_IMAGE_URL}
            alt="Giraffe silhouetted against golden African sunset"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        )}
        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.0) 40%, rgba(0,0,0,0.5) 100%)',
          }}
        />
        {/* Content — bottom left */}
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-[1280px] px-6 pb-16 md:px-12 md:pb-20">
            <p
              className="text-xs font-medium uppercase text-white/60"
              style={{ letterSpacing: '0.2em', fontFamily: 'var(--font-satoshi, sans-serif)' }}
            >
              Luxury African Safaris
            </p>
            <h1
              className="mt-4 max-w-[700px] text-[36px] font-light leading-[1.15] text-white md:text-[56px]"
              style={{ letterSpacing: '0.11em' }}
            >
              Experience Travel
              <br />
              <span style={{ fontFamily: 'var(--font-waterfall, serif)', fontWeight: 400, letterSpacing: '0.02em' }}>
                Redefined.
              </span>
            </h1>
            <p
              className="mt-4 max-w-[500px] text-base font-light text-white/75 md:text-lg"
              style={{ fontFamily: 'var(--font-satoshi, sans-serif)' }}
            >
              Handcrafted journeys through Africa&apos;s wild heart
            </p>
            <Link
              href="/safaris"
              className="mt-8 inline-flex rounded-sm bg-[#DA7A5A] px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-[#C66A4A]"
            >
              Explore Safaris
            </Link>
          </div>
        </div>
      </section>

      {/* ─── FEATURED SAFARIS ─── */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          {/* Section header */}
          <div className="mb-16 text-center">
            <div className="mb-4 flex items-center justify-center gap-4">
              <span className="h-px w-10 bg-[#DADADA]" />
              <span
                className="text-xs font-medium uppercase text-[#486A6A]/60"
                style={{ letterSpacing: '0.2em', fontFamily: 'var(--font-satoshi, sans-serif)' }}
              >
                Curated Experiences
              </span>
              <span className="h-px w-10 bg-[#DADADA]" />
            </div>
            <h2
              className="text-[42px] font-light text-[#404040]"
              style={{ letterSpacing: '0.11em' }}
            >
              Our Safaris
            </h2>
          </div>

          {/* Safari cards grid */}
          {itineraries.length > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {itineraries.map((itin, index) => {
                const heroUrl = getImgixUrl(itin.heroImage)
                const alt = getAlt(itin.heroImage, itin.title)
                const price = itin.investmentLevel?.fromPrice
                const currency = itin.investmentLevel?.currency || 'USD'
                const isHero = index === 0

                return (
                  <Link
                    key={itin.id}
                    href={`/safaris/${itin.slug}`}
                    className={`group relative block overflow-hidden rounded-[2px] ${
                      isHero ? 'md:col-span-2 aspect-[2/1]' : 'aspect-[4/3]'
                    }`}
                  >
                    {heroUrl ? (
                      <Image
                        src={heroUrl}
                        alt={alt}
                        fill
                        className="object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.02]"
                        sizes={isHero ? '100vw' : '50vw'}
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#486A6A] to-[#2d4444]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-6 md:p-8">
                      <p
                        className="text-[11px] font-medium uppercase tracking-wider text-white/60"
                        style={{ fontFamily: 'var(--font-satoshi, sans-serif)' }}
                      >
                        {itin.destinations?.map((d) => (typeof d === 'object' ? d.name : '')).filter(Boolean).join(' · ') || 'Africa'}
                      </p>
                      <h3
                        className={`mt-1 font-medium text-white ${
                          isHero ? 'text-[28px] md:text-[36px]' : 'text-xl md:text-2xl'
                        }`}
                      >
                        {itin.title}
                      </h3>
                      <div className="mt-2 flex items-center gap-4 text-sm text-white/70">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(itin as any).totalNights && <span>{String((itin as any).totalNights)} nights</span>}
                        {price && <span>From {formatPrice(price, currency)}</span>}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ─── VALUE PROPOSITION ─── */}
      <section className="bg-[#F5F3EB] py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <div className="flex flex-col gap-12 lg:flex-row lg:gap-20">
            {/* Left: text */}
            <div className="flex-1">
              <p
                className="text-xs font-medium uppercase text-[#486A6A]/60"
                style={{ letterSpacing: '0.2em', fontFamily: 'var(--font-satoshi, sans-serif)' }}
              >
                Why Kiuli
              </p>
              <h2
                className="mt-4 text-[36px] font-light text-[#404040] md:text-[42px]"
                style={{ letterSpacing: '0.11em' }}
              >
                The Kiuli Difference
              </h2>

              <div className="mt-10 space-y-8">
                {[
                  {
                    title: 'Specialists, Not Agents',
                    description:
                      'Every designer has lived and worked in the destinations they craft.',
                  },
                  {
                    title: 'No Compromises',
                    description:
                      "We don't book what's available. We secure what's extraordinary.",
                  },
                  {
                    title: 'Invisible Logistics',
                    description:
                      'Every transfer, every detail, handled before you think to ask.',
                  },
                ].map((point) => (
                  <div key={point.title} className="flex gap-4">
                    <div className="mt-2 h-[2px] w-6 flex-shrink-0 bg-[#486A6A]" />
                    <div>
                      <h3 className="text-base font-medium text-[#404040]">{point.title}</h3>
                      <p
                        className="mt-1 text-[15px] font-light text-[#404040]/70"
                        style={{ fontFamily: 'var(--font-satoshi, sans-serif)' }}
                      >
                        {point.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: image */}
            <div className="flex-1 lg:max-w-[45%]">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[2px] shadow-lg">
                <Image
                  src="https://kiuli.imgix.net/media/originals/41/2cdcc21c-ef6e-46ea-a39b-ee52a59349ee_Usawa_10-23-7.jpg?auto=format%2Ccompress&q=80"
                  alt="Hot air balloon over the Serengeti at sunrise"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHERE WE GO ─── */}
      <section className="bg-white py-24 md:py-32">
        <div className="mx-auto max-w-[1280px] px-6 md:px-12">
          <div className="mb-16 text-center">
            <p
              className="text-xs font-medium uppercase text-[#486A6A]/60"
              style={{ letterSpacing: '0.2em', fontFamily: 'var(--font-satoshi, sans-serif)' }}
            >
              Five Countries
            </p>
            <h2
              className="mt-4 text-[42px] font-light text-[#404040]"
              style={{ letterSpacing: '0.11em' }}
            >
              Where We Go
            </h2>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
            {countries.map((country) => {
              const heroUrl = getImgixUrl(country.heroImage)
              return (
                <Link
                  key={country.id}
                  href={`/destinations/${country.slug}`}
                  className="group relative block min-w-[200px] flex-shrink-0 overflow-hidden rounded-[2px] md:min-w-0"
                >
                  <div className="aspect-[2/3]">
                    {heroUrl ? (
                      <Image
                        src={heroUrl}
                        alt={country.name}
                        fill
                        className="object-cover transition-transform duration-[400ms] ease-out group-hover:scale-[1.03]"
                        sizes="(max-width: 768px) 200px, 20vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-[#486A6A] to-[#2d4444]" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <h3 className="text-lg font-medium text-white">{country.name}</h3>
                    </div>
                  </div>
                  <p
                    className="mt-2 text-[13px] text-[#404040]/50"
                    style={{ fontFamily: 'var(--font-satoshi, sans-serif)' }}
                  >
                    {countryCounts[country.id] || 0} destinations
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIAL ─── */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <span className="text-[72px] leading-none text-[#DADADA]">&ldquo;</span>
          <p className="mt-4 text-xl leading-relaxed text-[#404040] md:text-2xl" style={{ fontStyle: 'italic' }}>
            Our safari with Kiuli exceeded every expectation. The attention to detail, the incredible guides, and the
            seamless logistics made this the trip of a lifetime.
          </p>
          <p className="mt-8 text-base font-medium text-[#404040]">The Morrison Family</p>
          <p
            className="mt-1 text-sm text-[#404040]/50"
            style={{ fontFamily: 'var(--font-satoshi, sans-serif)' }}
          >
            Tanzania & Rwanda, 2024
          </p>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="bg-[#486A6A] py-20 md:py-28">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-[36px] font-light text-white" style={{ letterSpacing: '0.11em' }}>
            Ready to Begin?
          </h2>
          <p
            className="mt-4 text-lg font-light text-white/70"
            style={{ fontFamily: 'var(--font-satoshi, sans-serif)' }}
          >
            Our safari experts will craft a personalised itinerary tailored to your dreams.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex rounded-sm bg-[#DA7A5A] px-10 py-4 text-base font-medium text-white transition-colors hover:bg-[#C66A4A]"
          >
            Begin a Conversation
          </Link>
          <p className="mt-4 text-sm text-white/40">
            Or email{' '}
            <a href="mailto:hello@kiuli.com" className="underline underline-offset-2 hover:text-white/60">
              hello@kiuli.com
            </a>
          </p>
        </div>
      </section>

      {/* Footer is rendered by layout — no need to repeat */}
    </main>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'Kiuli | Luxury African Safaris',
    description:
      'Handcrafted luxury African safari experiences across Kenya, Tanzania, Rwanda, South Africa, and Mozambique.',
    alternates: { canonical: 'https://kiuli.com' },
    openGraph: {
      title: 'Kiuli | Luxury African Safaris',
      description: 'Handcrafted luxury African safari experiences.',
      url: 'https://kiuli.com',
    },
  }
}
