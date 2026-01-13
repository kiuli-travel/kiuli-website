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

export const Notifications: CollectionConfig = {
  slug: 'notifications',
  admin: {
    useAsTitle: 'message',
    defaultColumns: ['type', 'message', 'job', 'read', 'createdAt'],
    description: 'Pipeline notifications and alerts',
  },
  access: {
    create: authenticatedOrApiKey,
    delete: authenticated,
    read: authenticatedOrApiKey,
    update: authenticatedOrApiKey,
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: [
        { label: 'Success', value: 'success' },
        { label: 'Error', value: 'error' },
        { label: 'Warning', value: 'warning' },
        { label: 'Info', value: 'info' },
      ],
      admin: {
        description: 'Notification type/severity',
      },
    },
    {
      name: 'message',
      type: 'text',
      required: true,
      admin: {
        description: 'Notification message',
      },
    },
    {
      name: 'job',
      type: 'relationship',
      relationTo: 'itinerary-jobs',
      admin: {
        description: 'Related job (if applicable)',
      },
    },
    {
      name: 'itinerary',
      type: 'relationship',
      relationTo: 'itineraries',
      admin: {
        description: 'Related itinerary (if applicable)',
      },
    },
    {
      name: 'read',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Has this notification been read?',
      },
    },
    {
      name: 'readAt',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When the notification was read',
        condition: (data) => data?.read === true,
      },
    },
  ],
  timestamps: true,
}
