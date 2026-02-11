import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'

export const ContentJobs: CollectionConfig = {
  slug: 'content-jobs',
  admin: {
    useAsTitle: 'jobType',
    group: 'Content Engine',
    defaultColumns: ['jobType', 'status', 'createdAt', 'completedAt'],
    description: 'Background processing jobs — cascade, decompose, embed, monitor',
  },
  access: {
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    read: () => true,
  },
  timestamps: true,
  fields: [
    {
      name: 'jobType',
      type: 'select',
      required: true,
      options: [
        { label: 'Cascade', value: 'cascade' },
        { label: 'Decompose', value: 'decompose' },
        { label: 'Source Monitor', value: 'source_monitor' },
        { label: 'Batch Embed', value: 'batch_embed' },
        { label: 'Bootstrap', value: 'bootstrap' },
      ],
      admin: {
        description: 'Type of background job',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Running', value: 'running' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
      ],
      admin: {
        description: 'Current job status',
      },
    },
    {
      name: 'itineraryId',
      type: 'relationship',
      relationTo: 'itineraries',
      hasMany: false,
      admin: {
        description: 'Source itinerary (for cascade and decompose jobs)',
      },
    },
    {
      name: 'progress',
      type: 'json',
      admin: {
        description: 'Structured step tracking — see V6 spec Section 11.3 for schema',
      },
    },
    {
      name: 'error',
      type: 'text',
      admin: {
        description: 'Human-readable error summary',
        condition: (data) => data?.status === 'failed',
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When this job started executing',
      },
    },
    {
      name: 'completedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When this job completed or failed',
      },
    },
    {
      name: 'retriedCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of retry attempts made',
      },
    },
    {
      name: 'maxRetries',
      type: 'number',
      defaultValue: 2,
      admin: {
        description: 'Maximum retry attempts before permanent failure',
      },
    },
    {
      name: 'createdBy',
      type: 'select',
      options: [
        { label: 'Hook', value: 'hook' },
        { label: 'Manual', value: 'manual' },
        { label: 'Schedule', value: 'schedule' },
      ],
      admin: {
        description: 'How this job was triggered',
      },
    },
  ],
}
