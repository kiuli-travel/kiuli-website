import type { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const EditorialDirectives: CollectionConfig = {
  slug: 'editorial-directives',
  admin: {
    useAsTitle: 'text',
    group: 'Content Engine',
    defaultColumns: ['text', 'active', 'filterCount30d', 'reviewAfter'],
    description:
      'Rules learned from designer decisions — persist across all content production',
  },
  access: {
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    read: () => true,
  },
  timestamps: true,
  fields: [
    {
      name: 'text',
      type: 'textarea',
      required: true,
      admin: {
        description:
          'The editorial rule — e.g. "Do not produce comparison articles between specific lodges"',
      },
    },
    {
      name: 'topicTags',
      type: 'json',
      admin: {
        description: 'JSON string array of topic tags this directive applies to',
      },
    },
    {
      name: 'destinationTags',
      type: 'json',
      admin: {
        description: 'JSON string array of destination names this directive applies to',
      },
    },
    {
      name: 'contentTypeTags',
      type: 'json',
      admin: {
        description:
          'JSON string array of content types this directive applies to (e.g. ["authority", "designer_insight"])',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this directive is currently enforced',
      },
    },
    {
      name: 'reviewAfter',
      type: 'date',
      admin: {
        description:
          'When this directive should be reviewed for continued relevance. Default: 6 months from creation.',
      },
    },
    {
      name: 'lastReviewedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When a designer last confirmed this directive is still relevant',
      },
    },
    {
      name: 'filterCount30d',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description:
          'Number of candidates this directive filtered in the last 30 days — updated by system',
      },
    },
    {
      name: 'originProject',
      type: 'relationship',
      relationTo: 'content-projects',
      hasMany: false,
      admin: {
        description: 'The content project whose rejection led to this directive',
      },
    },
    {
      name: 'originRejectionReason',
      type: 'textarea',
      admin: {
        description:
          'The designer original rejection text that inspired this directive',
      },
    },
  ],
}
