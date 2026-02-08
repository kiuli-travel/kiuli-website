import type { GlobalConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const PropertyNameMappings: GlobalConfig = {
  slug: 'property-name-mappings',
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
        description: 'Maps iTrvl property names to canonical Properties records',
      },
      fields: [
        {
          name: 'canonical',
          type: 'text',
          required: true,
          admin: {
            description: 'Name used in Properties collection',
          },
        },
        {
          name: 'aliases',
          type: 'json',
          admin: {
            description: 'JSON array of alternative names from iTrvl, e.g. ["One&Only Cape Town", "One and Only Cape Town"]',
          },
        },
        {
          name: 'property',
          type: 'relationship',
          relationTo: 'properties',
          required: true,
        },
      ],
    },
  ],
}
