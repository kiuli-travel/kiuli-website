import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

const getPropertiesSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'https://kiuli.com')

    const results = await payload.find({
      collection: 'properties',
      overrideAccess: true,
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
        lastModified: true,
        updatedAt: true,
      },
    })

    const dateFallback = new Date().toISOString()

    const sitemap = results.docs
      ? results.docs
          .filter((property) => Boolean(property?.slug))
          .map((property) => ({
            loc: `${SITE_URL}/properties/${property.slug}`,
            lastmod: property.lastModified || property.updatedAt || dateFallback,
          }))
      : []

    return sitemap
  },
  ['properties-sitemap'],
  {
    tags: ['properties-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getPropertiesSitemap()

  return getServerSideSitemap(sitemap)
}
