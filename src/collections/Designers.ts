import type { CollectionConfig } from 'payload'

export const Designers: CollectionConfig = {
  slug: 'designers',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'active', 'totalAssigned', 'lastAssignedAt'],
    group: 'System',
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Full name (e.g., "Catherine Miller")',
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      unique: true,
      admin: {
        description: 'Email address for notifications',
      },
    },
    {
      name: 'active',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Only active designers receive new inquiries',
      },
    },
    {
      name: 'hubspotUserId',
      type: 'text',
      admin: {
        description: 'HubSpot user ID for deal owner assignment (optional)',
      },
    },
    {
      name: 'lastAssignedAt',
      type: 'date',
      admin: {
        description: 'Last time an inquiry was assigned to this designer',
        readOnly: true,
      },
    },
    {
      name: 'totalAssigned',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: {
        description: 'Total number of inquiries assigned',
        readOnly: true,
      },
    },
  ],
}
