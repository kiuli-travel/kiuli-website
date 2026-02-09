import type { Block } from 'payload'

export const Testimonial: Block = {
  slug: 'testimonial',
  interfaceName: 'TestimonialBlock',
  fields: [
    {
      name: 'quote',
      type: 'textarea',
      required: true,
      admin: {
        description: 'The testimonial text',
      },
    },
    {
      name: 'attribution',
      type: 'text',
      required: true,
      admin: {
        description: 'Customer name or identifier, e.g. "Sarah M., New York"',
      },
    },
    {
      name: 'context',
      type: 'text',
      admin: {
        description: 'e.g. "Kenya & Tanzania, October 2025"',
      },
    },
  ],
  labels: {
    plural: 'Testimonials',
    singular: 'Testimonial',
  },
}
