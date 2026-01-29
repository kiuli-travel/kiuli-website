import type { Metadata } from 'next'
import { getServerSideURL } from './getURL'

const defaultOpenGraph: Metadata['openGraph'] = {
  type: 'website',
  description:
    'Discover transformative African safari experiences with Kiuli. Handpicked luxury itineraries across Kenya, Tanzania, Botswana, Rwanda, and beyond.',
  images: [
    {
      url: `${getServerSideURL()}/kiuli-og.jpg`,
      width: 1200,
      height: 630,
      alt: 'Kiuli - Luxury African Safaris',
    },
  ],
  siteName: 'Kiuli',
  title: 'Kiuli | Luxury African Safaris',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
    images: og?.images ? og.images : defaultOpenGraph.images,
  }
}
