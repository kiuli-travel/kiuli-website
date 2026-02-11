import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'

export const SourceRegistry: CollectionConfig = {
  slug: 'source-registry',
  admin: {
    useAsTitle: 'name',
    group: 'Content Engine',
    defaultColumns: ['name', 'category', 'active', 'lastCheckedAt'],
    description: 'External data sources monitored for content triggers',
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
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable source name',
      },
    },
    {
      name: 'feedUrl',
      type: 'text',
      required: true,
      admin: {
        description: 'URL of RSS feed or API endpoint',
      },
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Science', value: 'science' },
        { label: 'Conservation', value: 'conservation' },
        { label: 'Industry', value: 'industry' },
        { label: 'Policy', value: 'policy' },
      ],
      admin: {
        description: 'Content category of this source',
      },
    },
    {
      name: 'checkMethod',
      type: 'select',
      options: [
        { label: 'RSS', value: 'rss' },
        { label: 'API', value: 'api' },
      ],
      admin: {
        description: 'How to check this source for new items',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this source is actively monitored',
      },
    },
    {
      name: 'lastCheckedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        readOnly: true,
        description: 'When this source was last checked for new items',
      },
    },
    {
      name: 'lastProcessedItemId',
      type: 'text',
      admin: {
        description: 'ID or URL of the last processed feed item — used as cursor',
      },
    },
    {
      name: 'lastProcessedItemTimestamp',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Timestamp of the last processed feed item',
      },
    },
    {
      name: 'recentProcessedIds',
      type: 'json',
      admin: {
        description:
          'JSON array of last 50 processed item IDs/URLs — used for deduplication',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Notes about this source — quirks, reliability, contact info',
      },
    },
  ],
}
