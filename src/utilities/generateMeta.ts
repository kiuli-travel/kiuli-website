import type { Metadata } from 'next'

import type { Media, Page, Post, Config } from '../payload-types'

import { mergeOpenGraph } from './mergeOpenGraph'
import { getServerSideURL } from './getURL'

const getImageURL = (image?: Media | Config['db']['defaultIDType'] | null) => {
  const serverUrl = getServerSideURL()

  // Default to Kiuli OG image
  let url = serverUrl + '/kiuli-og.jpg'

  if (image && typeof image === 'object') {
    // Prefer imgix URL for optimized images
    if ('imgixUrl' in image && image.imgixUrl) {
      url = image.imgixUrl
    } else if ('url' in image) {
      const ogUrl = image.sizes?.og?.url
      url = ogUrl ? serverUrl + ogUrl : serverUrl + image.url
    }
  }

  return url
}

export const generateMeta = async (args: {
  doc: Partial<Page> | Partial<Post> | null
}): Promise<Metadata> => {
  const { doc } = args

  const ogImage = getImageURL(doc?.meta?.image)

  // Build SEO-optimized title with Kiuli branding
  const title = doc?.meta?.title ? `${doc.meta.title} | Kiuli` : 'Kiuli | Luxury African Safaris'

  // Generate description with fallback
  const description =
    doc?.meta?.description ||
    'Discover transformative African safari experiences with Kiuli. Handpicked luxury itineraries curated by expert travel designers.'

  return {
    description,
    openGraph: mergeOpenGraph({
      description,
      images: ogImage
        ? [
            {
              url: ogImage,
              width: 1200,
              height: 630,
              alt: doc?.meta?.title || 'Kiuli Luxury Safari',
            },
          ]
        : undefined,
      title,
      url: Array.isArray(doc?.slug) ? doc?.slug.join('/') : '/',
    }),
    title,
  }
}
