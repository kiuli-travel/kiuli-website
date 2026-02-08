import type { AccessArgs, CollectionConfig } from 'payload'
import { updateLastModified } from './Itineraries/hooks/updateLastModified'

// Allow authenticated users OR API key access
const authenticatedOrApiKey = ({ req }: AccessArgs) => {
  if (req.user) return true
  const headers = req.headers as Headers | Record<string, string>
  const authHeader =
    typeof headers?.get === 'function'
      ? headers.get('authorization')
      : (headers as Record<string, string>)?.authorization
  if (authHeader?.startsWith('Bearer ') || authHeader?.startsWith('users API-Key ')) return true
  return false
}

export const Destinations: CollectionConfig = {
  slug: 'destinations',
  versions: {
    drafts: true,
  },
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    description: 'Countries, regions, and parks for itinerary cross-linking',
    defaultColumns: ['name', 'type', 'updatedAt'],
    baseListFilter: () => ({}),
  },
  access: {
    read: () => true,
    create: authenticatedOrApiKey,
    update: authenticatedOrApiKey,
    delete: ({ req }) => !!req.user,
  },
  hooks: {
    beforeChange: [updateLastModified],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name (e.g., "Masai Mara", "Kenya", "Serengeti National Park")',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL slug (e.g., "masai-mara", "kenya")',
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Country', value: 'country' },
        { label: 'Region', value: 'region' },
        { label: 'Park', value: 'park' },
      ],
      admin: {
        description: 'Destination type for filtering and hierarchy',
      },
    },
    {
      name: 'country',
      type: 'relationship',
      relationTo: 'destinations',
      admin: {
        description: 'Parent country (for regions and parks)',
        condition: (data) => data.type !== 'country',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'SEO-optimized description for destination landing page',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Hero image for destination landing page',
      },
    },
    {
      name: 'metaTitle',
      type: 'text',
      maxLength: 60,
      admin: {
        description: 'SEO meta title (max 60 chars)',
      },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      maxLength: 160,
      admin: {
        description: 'SEO meta description (max 160 chars)',
      },
    },
    // === SEO FIELDS ===
    {
      name: 'canonicalUrl',
      type: 'text',
      label: 'Canonical URL',
      admin: {
        description: 'Optional override. Leave empty to use default',
      },
    },
    {
      name: 'answerCapsule',
      type: 'textarea',
      label: 'Answer Capsule',
      admin: {
        description: 'Summary optimized for AI extraction (40-60 words)',
      },
      validate: (value: string | null | undefined) => {
        if (!value || value.trim() === '') return true
        const words = value.trim().split(/\s+/).filter((w) => w.length > 0)
        const wordCount = words.length
        if (wordCount < 40) return `Answer capsule must be at least 40 words. Current count: ${wordCount}`
        if (wordCount > 60) return `Answer capsule must not exceed 60 words. Current count: ${wordCount}`
        return true
      },
    },
    {
      name: 'focusKeyword',
      type: 'text',
      label: 'Focus Keyword',
      admin: {
        description: 'Primary SEO keyword this destination targets',
      },
    },
    {
      name: 'lastModified',
      type: 'date',
      label: 'Last Modified',
      admin: {
        readOnly: true,
        description: 'Auto-updated on every save',
      },
    },
    // === CONTENT FIELDS ===
    {
      name: 'highlights',
      type: 'array',
      label: 'Key Highlights',
      admin: {
        description:
          "Notable features of this destination (e.g., 'Home to the Great Migration', 'Year-round gorilla trekking')",
      },
      fields: [
        {
          name: 'highlight',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'bestTimeToVisit',
      type: 'richText',
      label: 'Best Time to Visit',
      admin: {
        description: 'Seasonal guide for visiting this destination',
      },
    },
    {
      name: 'faqItems',
      type: 'array',
      label: 'FAQ Items',
      admin: {
        description: 'Frequently asked questions about this destination',
      },
      fields: [
        {
          name: 'question',
          type: 'text',
          required: true,
        },
        {
          name: 'answer',
          type: 'richText',
        },
      ],
    },
    // === RELATIONSHIPS ===
    {
      name: 'relatedItineraries',
      type: 'relationship',
      relationTo: 'itineraries',
      hasMany: true,
      label: 'Related Itineraries',
      admin: {
        description: 'Curated itineraries for this destination. Supplements automatic reverse lookup.',
      },
    },
  ],
}
