import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'
import { updateLastModified } from './Itineraries/hooks/updateLastModified'

export const Properties: CollectionConfig = {
  slug: 'properties',
  admin: {
    hidden: true,
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
    read: () => true,
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
            {
              name: 'wetuContentEntityItemId',
              type: 'text',
              admin: { description: 'Cross-reference to Wetu room type ID (Phase 2)' },
            },
          ],
        },
        {
          name: 'wetuContentEntityId',
          type: 'number',
          admin: { description: 'Wetu content entity ID (Phase 2 — Wetu integration)' },
        },
        {
          name: 'wetuContentRating',
          type: 'number',
          admin: { description: 'Wetu content completeness score as percentage (Phase 2)' },
        },
      ],
    },

    // === CANONICAL CONTENT ===
    {
      name: 'canonicalContent',
      type: 'group',
      admin: {
        description: 'Canonical content — partially from iTrvl scraper, enriched via Wetu in Phase 2',
      },
      fields: [
        {
          name: 'source',
          type: 'select',
          defaultValue: 'scraper',
          options: [
            { label: 'Scraper (iTrvl)', value: 'scraper' },
            { label: 'Wetu', value: 'wetu' },
            { label: 'Manual', value: 'manual' },
          ],
          admin: { description: 'Which source provided this canonical content — determines trust level' },
        },
        {
          name: 'lastSynced',
          type: 'date',
          admin: { description: 'When canonical content was last synced from its source' },
        },
        {
          name: 'description',
          type: 'richText',
          admin: {
            description: 'Canonical property description — supplier-authoritative text from Wetu, or scraper content before Wetu integration',
          },
        },
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
          name: 'address',
          type: 'text',
          admin: { description: 'Physical address or postal address of the property' },
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
        {
          name: 'website',
          type: 'text',
          admin: { description: "Property website URL from canonical source (Wetu preferred)" },
        },
        {
          name: 'starRating',
          type: 'number',
          admin: { description: 'Star rating (1–5) where applicable' },
        },
        {
          name: 'totalRooms',
          type: 'number',
          admin: { description: 'Total number of rooms / tents / suites at this property' },
        },
      ],
    },

    // === ROOM TYPES ===
    {
      name: 'roomTypes',
      type: 'array',
      admin: { description: 'Room types observed in scraped itineraries — enriched via Wetu in Phase 2' },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { description: 'e.g. "Bush Suite", "Family Tent"' },
        },
        {
          name: 'resRequestId',
          type: 'text',
          admin: { description: 'ResRequest accommodation type ID (Phase 3)' },
        },
        {
          name: 'wetuItemId',
          type: 'text',
          admin: { description: 'Wetu accommodation item ID (Phase 2)' },
        },
        {
          name: 'description',
          type: 'richText',
          admin: { description: 'Room type description — from Wetu in Phase 2' },
        },
        {
          name: 'maxOccupancy',
          type: 'number',
          admin: { description: 'Maximum occupancy for this room type' },
        },
        {
          name: 'images',
          type: 'array',
          admin: { description: 'Room type images — from Wetu in Phase 2' },
          fields: [
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              required: true,
            },
          ],
        },
        {
          name: 'observations',
          type: 'array',
          dbName: 'prop_room_obs',
          admin: { description: 'Price observations for this room type from scraped itineraries' },
          fields: [
            {
              name: 'itineraryId',
              type: 'relationship',
              relationTo: 'itineraries',
              admin: { description: 'Source itinerary' },
            },
            {
              name: 'nightsBooked',
              type: 'number',
              admin: { description: 'Nights booked in this room type' },
            },
            {
              name: 'priceObserved',
              type: 'number',
              admin: { description: 'Price observed for this stay in source currency' },
            },
            {
              name: 'currency',
              type: 'text',
              defaultValue: 'USD',
            },
            {
              name: 'dateObserved',
              type: 'date',
            },
          ],
        },
      ],
    },

    // === ACCUMULATED DATA ===
    {
      name: 'accumulatedData',
      type: 'group',
      admin: {
        description: 'Accumulated intelligence from scraped itineraries — grows with each scrape. Powers plan_safari() matching.',
      },
      fields: [
        {
          name: 'observationCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Total number of scraped itineraries featuring this property',
          },
        },
        {
          name: 'lastObservedAt',
          type: 'date',
          admin: {
            readOnly: true,
            description: 'Date of most recent scrape that included this property',
          },
        },
        {
          name: 'typicalNights',
          type: 'group',
          admin: { description: 'Typical stay length across all observations — used by itinerary builder' },
          fields: [
            {
              name: 'median',
              type: 'number',
              admin: { description: 'Median nights per stay' },
            },
            {
              name: 'min',
              type: 'number',
              admin: { description: 'Minimum nights observed' },
            },
            {
              name: 'max',
              type: 'number',
              admin: { description: 'Maximum nights observed' },
            },
          ],
        },
        {
          name: 'pricePositioning',
          type: 'group',
          fields: [
            {
              name: 'band',
              type: 'select',
              dbName: 'prop_pp_band',
              options: [
                { label: 'Ultra Premium', value: 'ultra_premium' },
                { label: 'Premium', value: 'premium' },
                { label: 'Mid Luxury', value: 'mid_luxury' },
                { label: 'Accessible Luxury', value: 'accessible_luxury' },
              ],
              admin: {
                description: 'Price band derived from observations — used by plan_safari() for tier matching',
              },
            },
            {
              name: 'avgPerNightUsd',
              type: 'number',
              admin: { description: 'Average price per night in USD across all observations' },
            },
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
                  name: 'source',
                  type: 'text',
                  admin: { description: 'Itinerary slug — for traceability' },
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
                  name: 'paxType',
                  type: 'select',
                  dbName: 'prop_obs_pax_type',
                  options: [
                    { label: 'Family', value: 'family' },
                    { label: 'Couple', value: 'couple' },
                    { label: 'Group', value: 'group' },
                    { label: 'Solo', value: 'solo' },
                    { label: 'Unknown', value: 'unknown' },
                  ],
                  admin: { description: 'Pax configuration observed in this itinerary' },
                },
                {
                  name: 'roomType',
                  type: 'text',
                  admin: { description: 'Room type booked in this observation' },
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
          name: 'inclusionPatterns',
          type: 'richText',
          admin: {
            description: 'What is typically included in the rate at this property — from scraper observations and manual review',
          },
        },
        {
          name: 'suitability',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Family', value: 'family' },
            { label: 'Couples', value: 'couples' },
            { label: 'Honeymoon', value: 'honeymoon' },
            { label: 'Group', value: 'group' },
            { label: 'Solo', value: 'solo' },
            { label: 'Multigenerational', value: 'multigenerational' },
            { label: 'Accessible', value: 'accessible' },
          ],
          admin: {
            description: 'Who this property is suited for — used by plan_safari() for trip type matching',
          },
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
                description: 'Whether the paired property appears before or after this one',
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
        {
          name: 'seasonalityData',
          type: 'array',
          admin: {
            description: 'Monthly observation counts — how many itineraries feature this property per month',
          },
          fields: [
            {
              name: 'month',
              type: 'number',
              required: true,
              admin: { description: '1 = January, 12 = December' },
            },
            {
              name: 'observationCount',
              type: 'number',
              defaultValue: 0,
            },
          ],
        },
        {
          name: 'activityPatterns',
          type: 'array',
          admin: {
            description: 'Activities observed at this property across scraped itineraries — used by plan_safari() to describe inclusions',
          },
          fields: [
            {
              name: 'activity',
              type: 'text',
              required: true,
              admin: { description: 'e.g. "game drive", "walking safari", "gorilla trek"' },
            },
            {
              name: 'frequency',
              type: 'number',
              defaultValue: 1,
              admin: { description: 'How many times this activity has been observed at this property' },
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
        description: 'Availability integration status — defaults to none until ResConnect live (Phase 3)',
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
        {
          name: 'lastChecked',
          type: 'date',
          admin: { description: 'When availability was last checked via the active source' },
        },
        {
          name: 'agentRelationship',
          type: 'select',
          defaultValue: 'none',
          options: [
            { label: 'Contracted', value: 'contracted' },
            { label: 'Registered', value: 'registered' },
            { label: 'None', value: 'none' },
          ],
          admin: { description: "Kiuli's commercial relationship with this property for booking purposes" },
        },
        {
          name: 'rateVisibility',
          type: 'select',
          defaultValue: 'unknown',
          options: [
            { label: 'Net', value: 'net' },
            { label: 'Rack', value: 'rack' },
            { label: 'Special', value: 'special' },
            { label: 'Unknown', value: 'unknown' },
          ],
          admin: { description: 'What rate type is visible via ResConnect for this property' },
        },
        {
          name: 'cachePolicy',
          type: 'group',
          admin: { description: 'How long to cache availability results from this property' },
          fields: [
            {
              name: 'ttlMinutes',
              type: 'number',
              defaultValue: 60,
              admin: { description: 'Cache time-to-live in minutes (default: 60)' },
            },
            {
              name: 'checkOnDraft',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Whether to check availability when generating a draft itinerary (vs only on confirm)' },
            },
          ],
        },
      ],
    },
  ],
}
