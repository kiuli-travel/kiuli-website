import type { CollectionConfig, AccessArgs } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import path from 'path'
import { fileURLToPath } from 'url'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

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

export const Media: CollectionConfig = {
  slug: 'media',
  folders: true,
  access: {
    create: authenticatedOrApiKey,
    delete: authenticated,
    read: anyone,
    update: authenticatedOrApiKey,
  },
  fields: [
    // === V6 DEDUPLICATION ===
    {
      name: 'sourceS3Key',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Original S3 key from iTrvl CDN - CRITICAL for global deduplication',
      },
    },

    // === V6 PROCESSING STATUS ===
    {
      name: 'processingStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Complete', value: 'complete' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Image processing status',
      },
    },
    {
      name: 'processingError',
      type: 'text',
      admin: {
        description: 'Error message if processing failed',
        condition: (data) => data?.processingStatus === 'failed',
      },
    },

    // === V6 LABELING STATUS ===
    {
      name: 'labelingStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Complete', value: 'complete' },
        { label: 'Failed', value: 'failed' },
        { label: 'Skipped', value: 'skipped' },
      ],
      admin: {
        position: 'sidebar',
        description: 'AI labeling status',
      },
    },

    // === V6 USAGE TRACKING ===
    {
      name: 'usedInItineraries',
      type: 'relationship',
      relationTo: 'itineraries',
      hasMany: true,
      admin: {
        readOnly: true,
        description: 'Itineraries using this image (for orphan detection)',
      },
    },

    // === EXISTING FIELDS ===
    {
      name: 'alt',
      type: 'text',
      //required: true,
    },
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
    {
      name: 'location',
      type: 'text',
      admin: {
        position: 'sidebar',
        description: 'AI-detected location',
      },
    },
    {
      name: 'country',
      type: 'select',
      options: [
        { label: 'Tanzania', value: 'Tanzania' },
        { label: 'Kenya', value: 'Kenya' },
        { label: 'Botswana', value: 'Botswana' },
        { label: 'Rwanda', value: 'Rwanda' },
        { label: 'South Africa', value: 'South Africa' },
        { label: 'Zimbabwe', value: 'Zimbabwe' },
        { label: 'Zambia', value: 'Zambia' },
        { label: 'Namibia', value: 'Namibia' },
        { label: 'Uganda', value: 'Uganda' },
        { label: 'Mozambique', value: 'Mozambique' },
        { label: 'Unknown', value: 'Unknown' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'imageType',
      type: 'select',
      options: [
        { label: 'Wildlife', value: 'wildlife' },
        { label: 'Landscape', value: 'landscape' },
        { label: 'Accommodation', value: 'accommodation' },
        { label: 'Activity', value: 'activity' },
        { label: 'People', value: 'people' },
        { label: 'Food', value: 'food' },
        { label: 'Aerial', value: 'aerial' },
        { label: 'Detail', value: 'detail' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'animals',
      type: 'json',
      admin: {
        description: 'Array of detected animals',
      },
    },
    {
      name: 'tags',
      type: 'json',
      admin: {
        description: 'Array of searchable tags',
      },
    },
    {
      name: 'altText',
      type: 'text',
      admin: {
        description: 'AI-generated alt text for accessibility',
      },
    },
    {
      name: 'isHero',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Suitable for hero/banner usage',
        position: 'sidebar',
      },
    },
    {
      name: 'quality',
      type: 'select',
      options: [
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
        { label: 'Low', value: 'low' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'sourceItinerary',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Itinerary ID this image came from',
      },
    },
    {
      name: 's3Key',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Original iTrvl S3 key',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Original iTrvl CDN URL',
      },
    },
    {
      name: 'originalS3Key',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Original image path in S3 bucket',
      },
    },
    {
      name: 'imgixUrl',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'imgix URL for optimized serving',
      },
    },
  ],
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    staticDir: path.resolve(dirname, '../../public/media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
      },
      {
        name: 'square',
        width: 500,
        height: 500,
      },
      {
        name: 'small',
        width: 600,
      },
      {
        name: 'medium',
        width: 900,
      },
      {
        name: 'large',
        width: 1400,
      },
      {
        name: 'xlarge',
        width: 1920,
      },
      {
        name: 'og',
        width: 1200,
        height: 630,
        crop: 'center',
      },
    ],
  },
}
