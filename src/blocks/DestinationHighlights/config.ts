import type { Block } from 'payload'

export const DestinationHighlights: Block = {
  slug: 'destinationHighlights',
  interfaceName: 'DestinationHighlightsBlock',
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: {
        description: 'e.g. "Explore Destinations"',
      },
    },
    {
      name: 'subheading',
      type: 'textarea',
      admin: {
        description: 'Brief intro',
      },
    },
    {
      name: 'destinations',
      type: 'relationship',
      relationTo: 'destinations',
      hasMany: true,
      required: true,
      admin: {
        description: 'Destinations to highlight (select at least one for the block to render)',
      },
    },
  ],
  labels: {
    plural: 'Destination Highlights',
    singular: 'Destination Highlights',
  },
}
