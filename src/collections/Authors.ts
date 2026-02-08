import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
    group: 'Content',
    defaultColumns: ['name', 'role', 'updatedAt'],
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
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Full display name',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'URL slug',
      },
    },
    {
      name: 'role',
      type: 'text',
      admin: {
        description: 'e.g., "Safari Specialist", "Travel Designer"',
      },
    },
    {
      name: 'bio',
      type: 'richText',
      admin: {
        description: 'Full biography for author page',
      },
    },
    {
      name: 'shortBio',
      type: 'textarea',
      maxLength: 200,
      admin: {
        description: '1-2 sentence bio for article bylines (max 200 chars)',
      },
    },
    {
      name: 'credentials',
      type: 'array',
      admin: {
        description: 'Professional credentials for E-E-A-T',
      },
      fields: [
        {
          name: 'text',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Headshot',
      },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        description: 'Contact email (admin only, not displayed on frontend)',
      },
    },
    {
      name: 'linkedIn',
      type: 'text',
      admin: {
        description: 'LinkedIn profile URL',
      },
    },
    {
      name: 'metaTitle',
      type: 'text',
      maxLength: 60,
      admin: {
        description: 'SEO title override (max 60 chars)',
      },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      maxLength: 160,
      admin: {
        description: 'SEO description (max 160 chars)',
      },
    },
    {
      name: 'canonicalUrl',
      type: 'text',
      admin: {
        description: 'Canonical URL override',
      },
    },
  ],
}
