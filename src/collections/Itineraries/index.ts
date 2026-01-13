import type { CollectionConfig, AccessArgs } from 'payload'
import { authenticated } from '../../access/authenticated'

// Allow authenticated users OR API key access for Lambda pipeline
const authenticatedOrApiKey = ({ req }: AccessArgs) => {
  if (req.user) return true
  const headers = req.headers as Headers | Record<string, string>
  const authHeader = typeof headers?.get === 'function'
    ? headers.get('authorization')
    : (headers as Record<string, string>)?.authorization
  if (authHeader?.startsWith('Bearer ')) return true
  return false
}

export const Itineraries: CollectionConfig<'itineraries'> = {
  slug: 'itineraries',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'overview.nights', '_status', 'updatedAt'],
  },
  access: {
    read: authenticatedOrApiKey,
    create: authenticatedOrApiKey,
    update: authenticatedOrApiKey,
    delete: authenticated,
  },
  versions: {
    drafts: true,
  },
  fields: [
    // === BASIC INFO ===
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly identifier (auto-generated from title)',
      },
    },
    {
      name: 'itineraryId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'iTrvl itinerary ID for deduplication',
        readOnly: true,
      },
    },

    // === SEO ===
    {
      name: 'metaTitle',
      type: 'text',
      maxLength: 60,
      admin: {
        description: 'SEO title (max 60 chars). Auto-generated if blank.',
      },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      maxLength: 160,
      admin: {
        description: 'SEO description (max 160 chars). Auto-generated if blank.',
      },
    },

    // === HERO ===
    {
      name: 'heroImage',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        description: 'Primary hero image for the itinerary page',
      },
    },

    // === OVERVIEW ===
    {
      name: 'overview',
      type: 'group',
      fields: [
        {
          name: 'summary',
          type: 'richText',
          admin: {
            description: '2-3 sentence hook describing the experience',
          },
        },
        {
          name: 'nights',
          type: 'number',
          min: 1,
          admin: {
            description: 'Total number of nights',
          },
        },
        {
          name: 'countries',
          type: 'array',
          fields: [
            {
              name: 'country',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'highlights',
          type: 'array',
          admin: {
            description: 'Key highlights/experiences',
          },
          fields: [
            {
              name: 'highlight',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    },

    // === INVESTMENT LEVEL ===
    {
      name: 'investmentLevel',
      type: 'group',
      admin: {
        description: 'Pricing information (revealed after value is established)',
      },
      fields: [
        {
          name: 'fromPrice',
          type: 'number',
          admin: {
            description: 'Starting price per person in dollars',
          },
        },
        {
          name: 'toPrice',
          type: 'number',
          admin: {
            description: 'Upper price range (optional)',
          },
        },
        {
          name: 'currency',
          type: 'text',
          defaultValue: 'USD',
        },
        {
          name: 'includes',
          type: 'richText',
          admin: {
            description: 'What the price includes',
          },
        },
      ],
    },

    // === STRUCTURED DAYS ===
    {
      name: 'days',
      type: 'array',
      admin: {
        description: 'Day-by-day itinerary',
      },
      fields: [
        {
          name: 'dayNumber',
          type: 'number',
          required: true,
        },
        {
          name: 'date',
          type: 'date',
          admin: {
            description: 'Specific date (if applicable)',
          },
        },
        {
          name: 'title',
          type: 'text',
          admin: {
            description: 'Day title, e.g., "Arrival in Nairobi"',
          },
        },
        {
          name: 'location',
          type: 'text',
        },
        {
          name: 'segments',
          type: 'blocks',
          blocks: [
            // STAY BLOCK
            {
              slug: 'stay',
              labels: {
                singular: 'Stay',
                plural: 'Stays',
              },
              fields: [
                {
                  name: 'accommodationName',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'description',
                  type: 'richText',
                },
                {
                  name: 'nights',
                  type: 'number',
                  min: 1,
                },
                {
                  name: 'location',
                  type: 'text',
                },
                {
                  name: 'country',
                  type: 'text',
                },
                {
                  name: 'images',
                  type: 'relationship',
                  relationTo: 'media',
                  hasMany: true,
                },
                {
                  name: 'inclusions',
                  type: 'richText',
                  admin: {
                    description: 'What is included at this property',
                  },
                },
                {
                  name: 'roomType',
                  type: 'text',
                },
              ],
            },
            // ACTIVITY BLOCK
            {
              slug: 'activity',
              labels: {
                singular: 'Activity',
                plural: 'Activities',
              },
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'description',
                  type: 'richText',
                },
                {
                  name: 'images',
                  type: 'relationship',
                  relationTo: 'media',
                  hasMany: true,
                },
              ],
            },
            // TRANSFER BLOCK
            {
              slug: 'transfer',
              labels: {
                singular: 'Transfer',
                plural: 'Transfers',
              },
              fields: [
                {
                  name: 'type',
                  type: 'select',
                  options: [
                    { label: 'Flight', value: 'flight' },
                    { label: 'Road', value: 'road' },
                    { label: 'Boat', value: 'boat' },
                  ],
                },
                {
                  name: 'title',
                  type: 'text',
                },
                {
                  name: 'from',
                  type: 'text',
                },
                {
                  name: 'to',
                  type: 'text',
                },
                {
                  name: 'description',
                  type: 'richText',
                },
                {
                  name: 'departureTime',
                  type: 'text',
                },
                {
                  name: 'arrivalTime',
                  type: 'text',
                },
              ],
            },
          ],
        },
      ],
    },

    // === FAQ ===
    {
      name: 'faqItems',
      type: 'array',
      admin: {
        description: 'FAQ questions and answers for SEO/AIO',
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
          required: true,
        },
      ],
    },

    // === WHY KIULI ===
    {
      name: 'whyKiuli',
      type: 'richText',
      admin: {
        description: 'Why book this through Kiuli (value proposition)',
      },
    },

    // === ALL IMAGES (for gallery) ===
    {
      name: 'images',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'All images associated with this itinerary',
      },
    },

    // === SCHEMA (JSON-LD) ===
    {
      name: 'schema',
      type: 'json',
      admin: {
        description: 'Product JSON-LD schema (auto-generated)',
        readOnly: true,
      },
    },
    {
      name: 'schemaStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Pass', value: 'pass' },
        { label: 'Fail', value: 'fail' },
      ],
      admin: {
        description: 'Google Rich Results Test status',
      },
    },

    // === SOURCE DATA (hidden in admin) ===
    {
      name: 'source',
      type: 'group',
      admin: {
        description: 'Original source data (for debugging)',
      },
      fields: [
        {
          name: 'itrvlUrl',
          type: 'text',
        },
        {
          name: 'lastScrapedAt',
          type: 'date',
        },
        {
          name: 'rawData',
          type: 'json',
          admin: {
            description: 'Original scraped JSON for debugging',
          },
        },
      ],
    },

    // === BUILD INFO ===
    {
      name: 'buildTimestamp',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When this was last built/scraped',
      },
    },
    {
      name: 'googleInspectionStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Pass', value: 'pass' },
        { label: 'Fail', value: 'fail' },
      ],
      admin: {
        description: 'Google Search Console inspection status',
      },
    },
  ],
}
