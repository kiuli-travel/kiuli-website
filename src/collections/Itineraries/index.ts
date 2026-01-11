import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'

export const Itineraries: CollectionConfig<'itineraries'> = {
  slug: 'itineraries',
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['title', 'schemaStatus', 'googleInspectionStatus', 'updatedAt'],
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Itinerary Title',
    },
    {
      name: 'itineraryId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'iTrvl Itinerary ID',
      admin: {
        description: 'Unique identifier from iTrvl',
        readOnly: true,
      },
    },
    {
      name: 'price',
      type: 'number',
      label: 'Price (cents)',
      admin: {
        description: 'Price in cents (e.g., 1000000 = $10,000)',
        readOnly: true,
      },
    },
    {
      name: 'priceFormatted',
      type: 'text',
      label: 'Price (formatted)',
      admin: {
        description: 'Human-readable price string',
        readOnly: true,
      },
    },
    {
      name: 'images',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      label: 'Itinerary Images',
      admin: {
        description: 'Rehosted images from the itinerary',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'rawItinerary',
              type: 'json',
              label: 'Raw Itinerary Data',
              admin: {
                description: 'Raw itinerary JSON from Phase 2',
              },
            },
            {
              name: 'enhancedItinerary',
              type: 'json',
              label: 'Enhanced Itinerary Data',
              admin: {
                description: 'AI-enhanced itinerary JSON from Phase 4',
              },
            },
            {
              name: 'schema',
              type: 'json',
              label: 'JSON-LD Schema',
              admin: {
                description: 'Product schema from Phase 5',
              },
            },
            {
              name: 'faq',
              type: 'textarea',
              label: 'FAQ HTML',
              admin: {
                description: 'Formatted FAQ HTML from Phase 6',
              },
            },
          ],
        },
        {
          label: 'Metadata',
          fields: [
            {
              name: 'schemaStatus',
              type: 'select',
              required: true,
              defaultValue: 'pending',
              options: [
                {
                  label: 'Pending',
                  value: 'pending',
                },
                {
                  label: 'Pass',
                  value: 'pass',
                },
                {
                  label: 'Fail',
                  value: 'fail',
                },
              ],
              label: 'Schema Validation Status',
              admin: {
                description: 'Internal schema validation status from Phase 5',
              },
            },
            {
              name: 'googleInspectionStatus',
              type: 'select',
              required: true,
              defaultValue: 'pending',
              options: [
                {
                  label: 'Pending',
                  value: 'pending',
                },
                {
                  label: 'Pass',
                  value: 'pass',
                },
                {
                  label: 'Fail',
                  value: 'fail',
                },
              ],
              label: 'Google Rich Results Test Status',
              admin: {
                description: 'External Google Rich Results Test validation status',
              },
            },
            {
              name: 'buildTimestamp',
              type: 'date',
              required: true,
              admin: {
                date: {
                  pickerAppearance: 'dayAndTime',
                },
                description: 'Timestamp when this itinerary was processed',
              },
              label: 'Build Timestamp',
            },
            {
              name: 'googleFailureLog',
              type: 'textarea',
              label: 'Failure Log',
              admin: {
                description: 'Error details if pipeline or validation failed',
              },
            },
          ],
        },
      ],
    },
  ],
  versions: {
    drafts: {
      autosave: false,
    },
    maxPerDoc: 20,
  },
}
