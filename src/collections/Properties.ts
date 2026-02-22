import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'
import { updateLastModified } from './Itineraries/hooks/updateLastModified'

export const Properties: CollectionConfig = {
  slug: 'properties',
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    defaultColumns: ['name', 'type', 'destination', 'priceTier', 'updatedAt'],
  },
  versions: {
    drafts: true,
  },
  access: {
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    read: () => true, // Public read — property pages are public
  },
  hooks: {
    beforeChange: [updateLastModified],
  },
  fields: [
    // === IDENTITY ===
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name: "Angama Mara", "Singita Grumeti"',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly: "angama-mara"',
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Lodge', value: 'lodge' },
        { label: 'Camp', value: 'camp' },
        { label: 'Hotel', value: 'hotel' },
        { label: 'Villa', value: 'villa' },
        { label: 'Mobile Camp', value: 'mobile_camp' },
        { label: 'Tented Camp', value: 'tented_camp' },
      ],
      admin: {
        description: 'Property type',
      },
    },

    // === HIERARCHY ===
    {
      name: 'destination',
      type: 'relationship',
      relationTo: 'destinations',
      required: true,
      admin: {
        description: 'The destination this property is located in',
      },
    },

    // === DESCRIPTION (Three-field editorial pattern) ===
    // Resolution order: description_reviewed || description_enhanced || description_itrvl
    {
      name: 'description_itrvl',
      type: 'textarea',
      admin: {
        description: 'Original text from iTrvl stay segments',
      },
    },
    {
      name: 'description_enhanced',
      type: 'richText',
      admin: {
        description: 'AI-enhanced version',
      },
    },
    {
      name: 'description_reviewed',
      type: 'richText',
      admin: {
        description: "Designer-reviewed final version (takes precedence)",
      },
    },

    // === SEO ===
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
      name: 'canonicalUrl',
      type: 'text',
      admin: {
        description: 'Canonical URL override',
      },
    },
    {
      name: 'answerCapsule',
      type: 'textarea',
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
      admin: {
        description: 'Primary SEO keyword',
      },
    },
    {
      name: 'lastModified',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Auto-updated on every save',
      },
    },
    {
      name: 'faqItems',
      type: 'array',
      admin: {
        description: 'Frequently asked questions about this property',
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

    // === MEDIA ===
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Hero image for property page',
      },
    },
    {
      name: 'gallery',
      type: 'array',
      admin: {
        description: 'Property image gallery',
      },
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },

    // === RELATIONSHIPS ===
    {
      name: 'relatedItineraries',
      type: 'relationship',
      relationTo: 'itineraries',
      hasMany: true,
      admin: {
        description: 'Which itineraries feature this property',
      },
    },
    {
      name: 'relatedArticles',
      type: 'relationship',
      relationTo: 'posts',
      hasMany: true,
      admin: {
        description: 'Related articles',
      },
    },

    // === PROPERTY-SPECIFIC ===
    {
      name: 'websiteUrl',
      type: 'text',
      admin: {
        description: "External link to property's own website",
      },
    },
    {
      name: 'priceTier',
      type: 'select',
      options: [
        { label: 'Comfort', value: 'comfort' },
        { label: 'Premium', value: 'premium' },
        { label: 'Luxury', value: 'luxury' },
        { label: 'Ultra Luxury', value: 'ultra_luxury' },
      ],
      admin: {
        description: 'Price tier classification',
      },
    },

    // === EXTERNAL IDS ===
    {
      name: 'externalIds',
      type: 'group',
      admin: {
        description: 'External system identifiers — populated progressively as integrations go live',
      },
      fields: [
        {
          name: 'itrvlSupplierCode',
          type: 'text',
          admin: { description: 'supplierCode from iTrvl API — may be the ResRequest property ID' },
        },
        {
          name: 'itrvlPropertyName',
          type: 'text',
          admin: { description: 'Property name as it appears in iTrvl (for dedup detection)' },
        },
        {
          name: 'resRequestPropertyId',
          type: 'text',
          admin: { description: 'ResRequest property ID (Phase 3 — ResConnect integration)' },
        },
        {
          name: 'resRequestPrincipalId',
          type: 'text',
          admin: { description: 'ResRequest principal / lodge group ID (Phase 3)' },
        },
        {
          name: 'resRequestAccommTypes',
          type: 'array',
          admin: { description: 'Accommodation type IDs in ResRequest (Phase 3)' },
          fields: [
            {
              name: 'id',
              type: 'text',
              admin: { description: 'Accommodation type ID in ResRequest' },
            },
            {
              name: 'name',
              type: 'text',
              admin: { description: 'e.g. "Bush Suite", "Tent"' },
            },
          ],
        },
        {
          name: 'wetuContentEntityId',
          type: 'number',
          admin: { description: 'Wetu content entity ID (Phase 2 — Wetu integration)' },
        },
      ],
    },

    // === CANONICAL CONTENT ===
    {
      name: 'canonicalContent',
      type: 'group',
      admin: {
        description: 'Canonical content — partially from iTrvl, enriched via Wetu in Phase 2',
      },
      fields: [
        {
          name: 'coordinates',
          type: 'group',
          admin: { description: 'GPS coordinates — from iTrvl where available, Wetu sync in Phase 2' },
          fields: [
            { name: 'latitude', type: 'number' },
            { name: 'longitude', type: 'number' },
          ],
        },
        {
          name: 'contactEmail',
          type: 'email',
          admin: { description: 'Property contact email from iTrvl notes.contactEmail' },
        },
        {
          name: 'contactPhone',
          type: 'text',
          admin: { description: 'Property contact phone from iTrvl notes.contactNumber' },
        },
      ],
    },

    // === ROOM TYPES ===
    {
      name: 'roomTypes',
      type: 'array',
      admin: { description: 'Room types — populated from Wetu in Phase 2, manual entry before that' },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { description: 'e.g. "Bush Suite", "Family Tent"' },
        },
        {
          name: 'maxPax',
          type: 'number',
          admin: { description: 'Maximum occupancy' },
        },
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Room type image' },
        },
      ],
    },

    // === ACCUMULATED DATA ===
    {
      name: 'accumulatedData',
      type: 'group',
      admin: {
        description: 'Accumulated intelligence from scraped itineraries — grows with each scrape',
      },
      fields: [
        {
          name: 'pricePositioning',
          type: 'group',
          fields: [
            {
              name: 'observations',
              type: 'array',
              dbName: 'prop_price_obs',
              admin: { description: 'One entry per scraped itinerary that features this property' },
              fields: [
                {
                  name: 'itineraryId',
                  type: 'relationship',
                  relationTo: 'itineraries',
                  admin: { description: 'Source itinerary' },
                },
                {
                  name: 'pricePerNight',
                  type: 'number',
                  admin: { description: 'USD — total itinerary price divided by total nights' },
                },
                {
                  name: 'priceTier',
                  type: 'select',
                  dbName: 'prop_obs_price_tier',
                  options: [
                    { label: 'Ultra Premium', value: 'ultra_premium' },
                    { label: 'Premium', value: 'premium' },
                    { label: 'Mid Luxury', value: 'mid_luxury' },
                    { label: 'Accessible Luxury', value: 'accessible_luxury' },
                  ],
                },
                {
                  name: 'observedAt',
                  type: 'date',
                },
              ],
            },
            {
              name: 'observationCount',
              type: 'number',
              defaultValue: 0,
              admin: { readOnly: true, description: 'Total number of price observations' },
            },
          ],
        },
        {
          name: 'commonPairings',
          type: 'array',
          admin: {
            description: 'Properties that appear immediately before or after this one across scraped itineraries',
          },
          fields: [
            {
              name: 'property',
              type: 'relationship',
              relationTo: 'properties',
              admin: { description: 'The paired property' },
            },
            {
              name: 'position',
              type: 'select',
              dbName: 'prop_pairing_pos',
              options: [
                { label: 'Before', value: 'before' },
                { label: 'After', value: 'after' },
              ],
              admin: {
                description: 'Whether the paired property appears before or after this one in the itinerary',
              },
            },
            {
              name: 'count',
              type: 'number',
              defaultValue: 1,
              admin: { description: 'How many times this pairing has been observed' },
            },
          ],
        },
      ],
    },

    // === AVAILABILITY ===
    {
      name: 'availability',
      type: 'group',
      admin: {
        description: 'Availability integration status',
      },
      fields: [
        {
          name: 'source',
          type: 'select',
          defaultValue: 'none',
          options: [
            { label: 'None', value: 'none' },
            { label: 'ResConnect', value: 'resconnect' },
            { label: 'Direct', value: 'direct' },
          ],
          admin: { description: 'Which source provides live availability for this property' },
        },
      ],
    },
  ],
}
