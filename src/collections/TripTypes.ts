import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const TripTypes: CollectionConfig = {
  slug: 'trip-types',
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    description: 'Safari categories for filtering and recommendations',
    defaultColumns: ['name', 'slug', 'updatedAt'],
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name (e.g., "Great Migration", "Gorilla Trekking")',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL slug (e.g., "great-migration", "gorilla-trekking")',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'SEO-optimized description for trip type landing page',
      },
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      maxLength: 200,
      admin: {
        description: 'Brief description for cards and listings (max 200 chars)',
      },
    },
    {
      name: 'heroImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Hero image for trip type landing page',
      },
    },
    {
      name: 'icon',
      type: 'text',
      admin: {
        description: 'Icon identifier for UI (e.g., "binoculars", "gorilla", "heart")',
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
      name: 'sortOrder',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Display order in listings (lower numbers first)',
      },
    },
    {
      name: 'featured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Show in featured trip types on homepage',
      },
    },
  ],
}
