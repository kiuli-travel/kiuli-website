import type { Metadata } from 'next'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import React, { cache } from 'react'

import { generateMeta } from '@/utilities/generateMeta'

export async function generateStaticParams() {
  const payload = await getPayload({ config: configPromise })
  const itineraries = await payload.find({
    collection: 'itineraries',
    draft: false,
    limit: 1000,
    overrideAccess: true,
    pagination: false,
    select: {
      slug: true,
    },
  })

  return itineraries.docs?.map(({ slug }) => ({ slug })) || []
}

type Args = {
  params: Promise<{
    slug: string
  }>
}

export default async function ItineraryPage({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)

  const itinerary = await queryItineraryBySlug({ slug: decodedSlug })

  if (!itinerary) {
    notFound()
  }

  return (
    <article className="pt-16 pb-24 px-8">
      <h1 className="text-3xl font-heading font-semibold mb-8">{itinerary.title}</h1>
      <p className="text-kiuli-charcoal mb-4">
        Slug: <code className="bg-kiuli-gray px-2 py-1 rounded">{itinerary.slug}</code>
      </p>
      <p className="text-kiuli-charcoal mb-8">
        Draft mode: <code className="bg-kiuli-gray px-2 py-1 rounded">{draft ? 'enabled' : 'disabled'}</code>
      </p>
      <details open>
        <summary className="cursor-pointer text-kiuli-teal font-semibold mb-4">Raw JSON Data</summary>
        <pre className="bg-kiuli-ivory p-4 rounded overflow-auto text-sm max-h-[80vh]">
          {JSON.stringify(itinerary, null, 2)}
        </pre>
      </details>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug } = await paramsPromise
  const decodedSlug = decodeURIComponent(slug)
  const itinerary = await queryItineraryBySlug({ slug: decodedSlug })

  if (!itinerary) {
    return {
      title: 'Itinerary Not Found',
    }
  }

  return generateMeta({ doc: itinerary })
}

const queryItineraryBySlug = cache(async ({ slug }: { slug: string }) => {
  const { isEnabled: draft } = await draftMode()

  const payload = await getPayload({ config: configPromise })

  const result = await payload.find({
    collection: 'itineraries',
    draft,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    where: {
      slug: {
        equals: slug,
      },
    },
  })

  return result.docs?.[0] || null
})
