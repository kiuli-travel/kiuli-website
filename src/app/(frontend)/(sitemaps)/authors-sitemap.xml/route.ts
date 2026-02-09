import { getServerSideSitemap } from 'next-sitemap'
import { getPayload } from 'payload'
import config from '@payload-config'
import { unstable_cache } from 'next/cache'

const getAuthorsSitemap = unstable_cache(
  async () => {
    const payload = await getPayload({ config })
    const SITE_URL =
      process.env.NEXT_PUBLIC_SERVER_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'https://kiuli.com')

    const results = await payload.find({
      collection: 'authors',
      overrideAccess: true,
      draft: false,
      depth: 0,
      limit: 500,
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
          .filter((author) => Boolean(author?.slug))
          .map((author) => ({
            loc: `${SITE_URL}/authors/${author?.slug}`,
            lastmod: author.updatedAt || dateFallback,
          }))
      : []

    return sitemap
  },
  ['authors-sitemap'],
  {
    tags: ['authors-sitemap'],
  },
)

export async function GET() {
  const sitemap = await getAuthorsSitemap()

  return getServerSideSitemap(sitemap)
}
