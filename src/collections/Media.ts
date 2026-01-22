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

    // === MEDIA TYPE ===
    {
      name: 'mediaType',
      type: 'select',
      defaultValue: 'image',
      options: [
        { label: 'Image', value: 'image' },
        { label: 'Video', value: 'video' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Type of media (image or video)',
      },
    },
    {
      name: 'videoContext',
      type: 'select',
      options: [
        { label: 'Hero/Header', value: 'hero' },
        { label: 'Background', value: 'background' },
        { label: 'Gallery', value: 'gallery' },
      ],
      admin: {
        position: 'sidebar',
        description: 'Video usage context',
        condition: (data) => data?.mediaType === 'video',
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

    // === SOURCE CONTEXT (from scrape - read only) ===
    {
      name: 'sourceProperty',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Property/lodge name from iTrvl (e.g., Angama Mara)',
      },
    },
    {
      name: 'sourceSegmentType',
      type: 'select',
      options: [
        { label: 'Stay', value: 'stay' },
        { label: 'Activity', value: 'activity' },
        { label: 'Transfer', value: 'transfer' },
      ],
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Segment type where image was found',
      },
    },
    {
      name: 'sourceSegmentTitle',
      type: 'text',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Segment title (e.g., Kigali City Tour)',
      },
    },
    {
      name: 'sourceDayIndex',
      type: 'number',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Day number in itinerary (1-indexed)',
      },
    },

    // === ENRICHMENT (AI-generated, searchable) ===
    {
      name: 'scene',
      type: 'text',
      admin: {
        description: 'Scene description (e.g., "infinity pool overlooking savanna at sunset")',
      },
    },
    {
      name: 'mood',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Serene', value: 'serene' },
        { label: 'Adventurous', value: 'adventurous' },
        { label: 'Romantic', value: 'romantic' },
        { label: 'Dramatic', value: 'dramatic' },
        { label: 'Intimate', value: 'intimate' },
        { label: 'Luxurious', value: 'luxurious' },
        { label: 'Wild', value: 'wild' },
        { label: 'Peaceful', value: 'peaceful' },
      ],
      admin: {
        description: 'Mood/atmosphere of the image',
      },
    },
    {
      name: 'timeOfDay',
      type: 'select',
      options: [
        { label: 'Dawn', value: 'dawn' },
        { label: 'Morning', value: 'morning' },
        { label: 'Midday', value: 'midday' },
        { label: 'Afternoon', value: 'afternoon' },
        { label: 'Golden Hour', value: 'golden-hour' },
        { label: 'Dusk', value: 'dusk' },
        { label: 'Night', value: 'night' },
      ],
      admin: {
        description: 'Time of day visible in image',
      },
    },
    {
      name: 'setting',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Lodge Interior', value: 'lodge-interior' },
        { label: 'Lodge Exterior', value: 'lodge-exterior' },
        { label: 'Pool/Deck', value: 'pool-deck' },
        { label: 'Bedroom/Suite', value: 'bedroom' },
        { label: 'Dining', value: 'dining' },
        { label: 'Savanna', value: 'savanna' },
        { label: 'River/Water', value: 'river-water' },
        { label: 'Forest', value: 'forest' },
        { label: 'Mountain', value: 'mountain' },
        { label: 'Bush Dinner', value: 'bush-dinner' },
        { label: 'Game Drive', value: 'game-drive' },
        { label: 'Walking Safari', value: 'walking-safari' },
        { label: 'Aerial', value: 'aerial' },
        { label: 'Spa', value: 'spa' },
      ],
      admin: {
        description: 'Physical setting/location type',
      },
    },
    {
      name: 'composition',
      type: 'select',
      options: [
        { label: 'Hero', value: 'hero' },
        { label: 'Establishing', value: 'establishing' },
        { label: 'Detail', value: 'detail' },
        { label: 'Portrait', value: 'portrait' },
        { label: 'Action', value: 'action' },
        { label: 'Panoramic', value: 'panoramic' },
      ],
      admin: {
        description: 'Composition style - how the image could be used',
      },
    },
    {
      name: 'suitableFor',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Hero Banner', value: 'hero-banner' },
        { label: 'Article Feature', value: 'article-feature' },
        { label: 'Gallery', value: 'gallery' },
        { label: 'Thumbnail', value: 'thumbnail' },
        { label: 'Social Media', value: 'social' },
        { label: 'Print', value: 'print' },
      ],
      admin: {
        description: 'Recommended usage contexts',
      },
    },
  ],
  upload: {
    // Upload to the public/media directory in Next.js making them publicly accessible even outside of Payload
    staticDir: path.resolve(dirname, '../../public/media'),
    adminThumbnail: 'thumbnail',
    focalPoint: true,
    mimeTypes: ['image/*', 'video/mp4', 'video/webm', 'video/quicktime'],
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
