import type { Block } from 'payload'

export const FeaturedProperties: Block = {
  slug: 'featuredProperties',
  interfaceName: 'FeaturedPropertiesBlock',
  fields: [
    {
      name: 'heading',
      type: 'text',
      admin: {
        description: 'e.g. "Where You\'ll Stay"',
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
      name: 'properties',
      type: 'relationship',
      relationTo: 'properties',
      hasMany: true,
      required: false, // Made optional to allow saving without selection
      admin: {
        description: 'Properties to feature (select at least one for the block to render)',
      },
    },
  ],
  labels: {
    plural: 'Featured Properties',
    singular: 'Featured Properties',
  },
}
