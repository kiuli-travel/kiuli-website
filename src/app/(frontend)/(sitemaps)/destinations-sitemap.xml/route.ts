import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'
import type { Destination } from '@/payload-types'

const getDestinationsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'https://kiuli.com')

    const results = await payload.find({
      collection: 'destinations',
      overrideAccess: true,
      draft: false,
      depth: 1,
      limit: 1000,
      pagination: false,
      where: {
        _status: {
          equals: 'published',
        },
      },
      select: {
        slug: true,
        type: true,
        country: true,
        lastModified: true,
        updatedAt: true,
      },
    })

    const dateFallback = new Date().toISOString()

    const sitemap = results.docs
      ? results.docs
          .filter((dest) => Boolean(dest?.slug))
          .map((dest) => {
            let url: string
            if (dest.type === 'country') {
              url = `${SITE_URL}/destinations/${dest.slug}`
            } else {
              // Destination (non-country) - need parent country slug
              const country = dest.country as Destination | null
              if (country && country.slug) {
                url = `${SITE_URL}/destinations/${country.slug}/${dest.slug}`
              } else {
                // Fallback if country not populated
                url = `${SITE_URL}/destinations/${dest.slug}`
              }
            }

            return {
              loc: url,
              lastmod: dest.lastModified || dest.updatedAt || dateFallback,
            }
          })
      : []

    return sitemap
  },
  ['destinations-sitemap'],
  {
    tags: ['destinations-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getDestinationsSitemap()

  return getServerSideSitemap(sitemap)
}
