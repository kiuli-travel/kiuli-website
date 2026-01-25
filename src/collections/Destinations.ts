import type { AccessArgs, CollectionConfig } from 'payload'

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
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    description: 'Countries, regions, and parks for itinerary cross-linking',
    defaultColumns: ['name', 'type', 'country', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: authenticatedOrApiKey,
    update: authenticatedOrApiKey,
    delete: ({ req }) => !!req.user,
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
    {
      name: 'highlights',
      type: 'array',
      admin: {
        description: 'Key highlights of this destination',
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
      type: 'textarea',
      admin: {
        description: 'Best time to visit information',
      },
    },
  ],
}
