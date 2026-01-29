import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

const getSafarisSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      process.env.VERCEL_PROJECT_PRODUCTION_URL ||
      'https://kiuli.com'

    const results = await payload.find({
      collection: 'itineraries',
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1000,
      pagination: false,
      where: {
        _status: {
          equals: 'published',
        },
      },
      select: {
        slug: true,
        updatedAt: true,
      },
    })

    const dateFallback = new Date().toISOString()

    const sitemap = results.docs
      ? results.docs
          .filter((itinerary) => Boolean(itinerary?.slug))
          .map((itinerary) => ({
            loc: `${SITE_URL}/safaris/${itinerary?.slug}`,
            lastmod: itinerary.updatedAt || dateFallback,
          }))
      : []

    return sitemap
  },
  ['safaris-sitemap'],
  {
    tags: ['safaris-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getSafarisSitemap()

  return getServerSideSitemap(sitemap)
}
