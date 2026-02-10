import type { Block } from 'payload'

export const FeaturedItineraries: Block = {
  slug: 'featuredItineraries',
  interfaceName: 'FeaturedItinerariesBlock',
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: {
        description: 'Section heading, e.g. "Featured Safaris"',
      },
    },
    {
      name: 'subheading',
      type: 'textarea',
      admin: {
        description: 'Brief intro text',
      },
    },
    {
      name: 'itineraries',
      type: 'relationship',
      relationTo: 'itineraries',
      hasMany: true,
      required: true,
      admin: {
        description: 'Hand-picked itineraries to feature (select at least one for the block to render)',
      },
    },
    {
      name: 'showPricing',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether to show investment level on cards',
      },
    },
  ],
  labels: {
    plural: 'Featured Itineraries',
    singular: 'Featured Itineraries',
  },
}
