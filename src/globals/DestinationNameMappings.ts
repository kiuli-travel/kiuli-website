import type { GlobalConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const DestinationNameMappings: GlobalConfig = {
  slug: 'destination-name-mappings',
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
      admin: {
        description: 'Maps alternative destination names to canonical Destinations records',
      },
      fields: [
        {
          name: 'canonical',
          type: 'text',
          required: true,
          admin: {
            description: 'Name used in Destinations collection',
          },
        },
        {
          name: 'aliases',
          type: 'json',
          admin: {
            description:
              'JSON array of alternative names, e.g. ["Serengeti NP", "Serengeti National Park", "The Serengeti"]',
          },
        },
        {
          name: 'destination',
          type: 'relationship',
          relationTo: 'destinations',
          required: true,
        },
      ],
    },
  ],
}
