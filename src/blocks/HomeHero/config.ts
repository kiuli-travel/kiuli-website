import type { Block } from 'payload'

export const HomeHero: Block = {
  slug: 'homeHero',
  interfaceName: 'HomeHeroBlock',
  fields: [
    {
      name: 'heading',
      type: 'text',
      required: true,
      admin: {
        description: 'Main headline, e.g. "Africa\'s Finest Safari Experiences"',
      },
    },
    {
      name: 'subheading',
      type: 'textarea',
      admin: {
        description: 'Supporting text below headline',
      },
    },
    {
      name: 'backgroundImage',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Full-bleed background image',
      },
    },
    {
      name: 'backgroundVideo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Optional video (takes priority over image if present)',
      },
    },
    {
      name: 'ctaLabel',
      type: 'text',
      admin: {
        description: 'CTA button text, e.g. "Explore Safaris"',
      },
    },
    {
      name: 'ctaLink',
      type: 'text',
      admin: {
        description: 'CTA button URL, e.g. "/safaris"',
      },
    },
    {
      name: 'overlayOpacity',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 40,
      admin: {
        description: 'Controls gradient overlay darkness (0-100)',
      },
    },
  ],
  labels: {
    plural: 'Home Heroes',
    singular: 'Home Hero',
  },
}
