import type { CollectionConfig } from 'payload';

export const ImageStatuses: CollectionConfig = {
  slug: 'image-statuses',
  labels: {
    singular: 'Image Status',
    plural: 'Image Statuses',
  },
  admin: {
    group: 'Pipeline',
    useAsTitle: 'sourceS3Key',
    defaultColumns: ['sourceS3Key', 'status', 'job', 'propertyName'],
    description: 'Per-image processing status for pipeline jobs',
  },
  access: {
    read: () => true,
    create: () => true,
    update: () => true,
    delete: () => true,
  },
  fields: [
    // Relationship to parent job
    {
      name: 'job',
      type: 'relationship',
      relationTo: 'itinerary-jobs',
      required: true,
      hasMany: false,
      index: true,
      admin: {
        description: 'Parent itinerary job',
      },
    },
    // Original fields from embedded array
    {
      name: 'sourceS3Key',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Original S3 key from iTrvl CDN',
      },
    },
    {
      name: 'mediaId',
      type: 'text',
      index: true,
      admin: {
        description: 'Payload Media ID if created',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Processing', value: 'processing' },
        { label: 'Complete', value: 'complete' },
        { label: 'Failed', value: 'failed' },
        { label: 'Skipped', value: 'skipped' },
      ],
    },
    // Media type (image or video)
    {
      name: 'mediaType',
      type: 'select',
      defaultValue: 'image',
      index: true,
      options: [
        { label: 'Image', value: 'image' },
        { label: 'Video', value: 'video' },
      ],
      admin: {
        description: 'Type of media being processed',
      },
    },
    {
      name: 'videoContext',
      type: 'text',
      admin: {
        description: 'Video usage context (hero, background, etc.)',
        condition: (data) => data?.mediaType === 'video',
      },
    },
    {
      name: 'error',
      type: 'text',
      admin: {
        description: 'Error message if failed',
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
      },
    },
    // Source context (preserved from scrape)
    {
      name: 'propertyName',
      type: 'text',
      admin: {
        description: 'Property/lodge name from segment',
      },
    },
    {
      name: 'segmentType',
      type: 'select',
      options: [
        { label: 'Stay', value: 'stay' },
        { label: 'Activity', value: 'activity' },
        { label: 'Transfer', value: 'transfer' },
      ],
      admin: {
        description: 'Type of segment this image belongs to',
      },
    },
    {
      name: 'segmentTitle',
      type: 'text',
      admin: {
        description: 'Title of the segment',
      },
    },
    {
      name: 'dayIndex',
      type: 'number',
      admin: {
        description: 'Day number in itinerary (1-indexed)',
      },
    },
    {
      name: 'segmentIndex',
      type: 'number',
      admin: {
        description: 'Segment position within day (0-indexed)',
      },
    },
    {
      name: 'country',
      type: 'text',
      admin: {
        description: 'Country from segment/itinerary context',
      },
    },
  ],
};
