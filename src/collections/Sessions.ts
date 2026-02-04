import type { CollectionConfig } from 'payload'

export const Sessions: CollectionConfig = {
  slug: 'sessions',
  labels: {
    singular: 'Session',
    plural: 'Sessions',
  },
  admin: {
    useAsTitle: 'sessionId',
    defaultColumns: ['sessionId', 'trafficSource', 'landingPage', 'status', 'createdAt'],
    listSearchableFields: ['sessionId', 'gclid'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true, // Public - API will create sessions
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  timestamps: true,
  fields: [
    {
      name: 'sessionId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'UUID v4, generated server-side' },
    },
    {
      name: 'trafficSource',
      type: 'text',
      required: true,
      admin: { description: 'Output of detectTrafficSource()' },
    },

    // Attribution - Collapsible Group
    {
      type: 'collapsible',
      label: 'Attribution',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'gclid',
          type: 'text',
          admin: { description: 'Google Click ID' },
        },
        {
          name: 'gbraid',
          type: 'text',
          admin: { description: 'Google Ads iOS attribution' },
        },
        {
          name: 'wbraid',
          type: 'text',
          admin: { description: 'Google Ads iOS attribution' },
        },
        {
          type: 'row',
          fields: [
            { name: 'utmSource', type: 'text', admin: { width: '33%' } },
            { name: 'utmMedium', type: 'text', admin: { width: '33%' } },
            { name: 'utmCampaign', type: 'text', admin: { width: '34%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'utmContent', type: 'text', admin: { width: '50%' } },
            { name: 'utmTerm', type: 'text', admin: { width: '50%' } },
          ],
        },
        {
          name: 'referrer',
          type: 'text',
          admin: { description: 'Full referrer URL' },
        },
        {
          name: 'landingPage',
          type: 'text',
          required: true,
          admin: { description: 'Path only (no domain, no query string)' },
        },
      ],
    },

    // Browser Context - Collapsible Group
    {
      type: 'collapsible',
      label: 'Browser Context',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'userAgent',
          type: 'textarea',
          admin: { description: 'From request User-Agent header' },
        },
        {
          name: 'ipAddress',
          type: 'text',
          admin: { description: 'From x-forwarded-for header' },
        },
      ],
    },

    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'createdAt + 90 days',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Expired', value: 'expired' },
      ],
    },
  ],
}
