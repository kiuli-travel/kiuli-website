import type { CollectionConfig, AccessArgs } from 'payload'
import { authenticated } from '../access/authenticated'
import { updateLastModified } from './Itineraries/hooks/updateLastModified'

// Allow authenticated users OR API key access for Lambda pipeline
const authenticatedOrApiKey = ({ req }: AccessArgs) => {
  if (req.user) return true
  const headers = req.headers as Headers | Record<string, string>
  const authHeader = typeof headers?.get === 'function'
    ? headers.get('authorization')
    : (headers as Record<string, string>)?.authorization
  if (authHeader?.startsWith('Bearer ') || authHeader?.startsWith('users API-Key ')) {
    return true
  }
  return false
}

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
    create: authenticatedOrApiKey,
    update: authenticatedOrApiKey,
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
  ],
}
