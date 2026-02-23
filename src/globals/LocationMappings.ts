import type { GlobalConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const LocationMappings: GlobalConfig = {
  slug: 'location-mappings',
  admin: {
    group: 'Configuration',
  },
  access: {
    read: () => true,
    update: authenticated,
  },
  fields: [
    {
      name: 'mappings',
      type: 'array',
      fields: [
        {
          name: 'externalString',
          type: 'text',
          required: true,
          admin: { description: 'Exact string from the source system, e.g. "Serengeti Mobile"' },
        },
        {
          name: 'sourceSystem',
          type: 'select',
          required: true,
          options: [
            { label: 'iTrvl', value: 'itrvl' },
            { label: 'Wetu', value: 'wetu' },
            { label: 'Expert Africa', value: 'expert_africa' },
            { label: 'Any', value: 'any' },
            { label: 'Manual', value: 'manual' },
          ],
        },
        {
          name: 'resolvedAs',
          type: 'select',
          required: true,
          options: [
            { label: 'Destination', value: 'destination' },
            { label: 'Property', value: 'property' },
            { label: 'Airport', value: 'airport' },
            { label: 'Ignore', value: 'ignore' },
          ],
        },
        {
          name: 'destination',
          type: 'relationship',
          relationTo: 'destinations',
          admin: { description: 'Required when resolvedAs = destination' },
        },
        {
          name: 'property',
          type: 'relationship',
          relationTo: 'properties',
          admin: { description: 'Required when resolvedAs = property' },
        },
        {
          name: 'airport',
          type: 'relationship',
          relationTo: 'airports',
          admin: { description: 'Required when resolvedAs = airport' },
        },
        {
          name: 'notes',
          type: 'textarea',
          admin: { description: 'Why this mapping exists' },
        },
      ],
    },
  ],
}
