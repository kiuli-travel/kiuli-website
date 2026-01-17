import type { CollectionConfig, AccessArgs } from 'payload'
import { authenticated } from '../../access/authenticated'

// Allow authenticated users OR API key access for updates
const authenticatedOrApiKey = ({ req }: AccessArgs) => {
  // Check if user is authenticated (via session or API key)
  if (req.user) return true

  // Check for Authorization header with API key format
  const headers = req.headers as Headers | Record<string, string>
  const authHeader = typeof headers?.get === 'function'
    ? headers.get('authorization')
    : (headers as Record<string, string>)?.authorization
  if (authHeader?.startsWith('Bearer ')) {
    // API key auth - always allow for Lambda pipeline worker
    return true
  }

  return false
}

export const ItineraryJobs: CollectionConfig<'itinerary-jobs'> = {
  slug: 'itinerary-jobs',
  access: {
    create: authenticatedOrApiKey,
    delete: authenticated,
    read: authenticatedOrApiKey,
    update: authenticatedOrApiKey,
  },
  admin: {
    defaultColumns: ['itrvlUrl', 'status', 'itineraryId', 'duration', 'createdAt'],
    useAsTitle: 'itrvlUrl',
    description: 'Manage iTrvl itinerary processing jobs. Paste an iTrvl URL to create a job, then use the "Trigger Processing" button to start the pipeline.',
    listSearchableFields: ['itrvlUrl', 'itineraryId', 'payloadId'],
  },
  fields: [
    {
      name: 'itrvlUrl',
      type: 'text',
      required: true,
      label: 'iTrvl URL',
      admin: {
        description: 'Paste the full iTrvl client portal URL (e.g., https://itrvl.com/client/portal/{accessKey}/{itineraryId})',
        placeholder: 'https://itrvl.com/client/portal/...',
      },
    },
    {
      name: 'itineraryId',
      type: 'text',
      required: false,
      label: 'Itinerary ID',
      admin: {
        description: 'Unique iTrvl itinerary identifier (auto-extracted from URL)',
        readOnly: true,
      },
    },
    {
      name: 'accessKey',
      type: 'text',
      required: false,
      label: 'Access Key',
      admin: {
        description: 'iTrvl access key (auto-extracted from URL)',
        readOnly: true,
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Status',
          fields: [
            {
              name: 'processButton',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/collections/ItineraryJobs/components/ProcessButton#ProcessButton',
                },
              },
            },
            {
              name: 'jobControlPanel',
              type: 'ui',
              admin: {
                components: {
                  Field: '@/collections/ItineraryJobs/components/JobControlPanel#JobControlPanel',
                },
              },
            },
            {
              name: 'status',
              type: 'select',
              required: true,
              defaultValue: 'pending',
              options: [
                {
                  label: 'Pending',
                  value: 'pending',
                },
                {
                  label: 'Processing',
                  value: 'processing',
                },
                {
                  label: 'Completed',
                  value: 'completed',
                },
                {
                  label: 'Failed',
                  value: 'failed',
                },
              ],
              label: 'Processing Status',
              admin: {
                description: 'Current status of the itinerary processing job',
              },
            },
            {
              name: 'currentPhase',
              type: 'text',
              label: 'Current Phase',
              admin: {
                description: 'Current pipeline phase (e.g., "Phase 2: Scraping", "Phase 3: Media Rehosting")',
                readOnly: true,
              },
            },
            {
              name: 'progress',
              type: 'number',
              min: 0,
              max: 100,
              defaultValue: 0,
              label: 'Progress %',
              admin: {
                description: 'Processing progress percentage',
                readOnly: true,
              },
            },
            {
              name: 'totalImages',
              type: 'number',
              label: 'Total Images',
              admin: {
                description: 'Total images to process',
                readOnly: true,
              },
            },
            {
              name: 'processedImages',
              type: 'number',
              label: 'Processed Images',
              admin: {
                description: 'Successfully processed images',
                readOnly: true,
              },
            },
            {
              name: 'skippedImages',
              type: 'number',
              label: 'Skipped Images',
              admin: {
                description: 'Images skipped (already existed)',
                readOnly: true,
              },
            },
            {
              name: 'failedImages',
              type: 'number',
              label: 'Failed Images',
              admin: {
                description: 'Images that failed to process',
                readOnly: true,
              },
            },
            // V6: imageStatuses moved to separate collection (image-statuses)
            // See src/collections/ImageStatuses.ts
            // V6: Labeling progress
            {
              name: 'imagesLabeled',
              type: 'number',
              defaultValue: 0,
              label: 'Images Labeled',
              admin: {
                description: 'Number of images that have been AI-labeled',
                readOnly: true,
              },
            },
            {
              name: 'imagesToLabel',
              type: 'number',
              label: 'Images to Label',
              admin: {
                description: 'Total images requiring labeling',
                readOnly: true,
              },
            },
            {
              name: 'labelingStartedAt',
              type: 'date',
              label: 'Labeling Started',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When AI labeling phase started',
                readOnly: true,
              },
            },
            {
              name: 'labelingCompletedAt',
              type: 'date',
              label: 'Labeling Completed',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When AI labeling phase completed',
                readOnly: true,
              },
            },
            // V6: Estimated time
            {
              name: 'estimatedTimeRemaining',
              type: 'number',
              label: 'Est. Time Remaining (sec)',
              admin: {
                description: 'Estimated seconds until completion',
                readOnly: true,
              },
            },
            {
              name: 'progressLog',
              type: 'textarea',
              label: 'Progress Log',
              admin: {
                description: 'Real-time processing logs and progress updates',
                readOnly: true,
              },
            },
            {
              name: 'errorMessage',
              type: 'textarea',
              label: 'Error Message',
              admin: {
                description: 'Error details if processing failed',
                readOnly: true,
              },
            },
            {
              name: 'errorPhase',
              type: 'text',
              label: 'Error Phase',
              admin: {
                description: 'Pipeline phase where error occurred',
                readOnly: true,
              },
            },
            {
              name: 'failedAt',
              type: 'date',
              label: 'Failed At',
              admin: {
                date: {
                  pickerAppearance: 'dayAndTime',
                },
                description: 'Timestamp when processing failed',
                readOnly: true,
              },
            },
          ],
        },
        {
          label: 'Results',
          fields: [
            {
              name: 'processedItinerary',
              type: 'relationship',
              relationTo: 'itineraries',
              hasMany: false,
              label: 'Processed Itinerary',
              admin: {
                description: 'The final Payload itinerary created from this job',
              },
            },
            {
              name: 'relatedArticles',
              type: 'relationship',
              relationTo: 'posts',
              hasMany: true,
              label: 'Related Articles',
              admin: {
                description: 'AI-generated articles and content related to this itinerary',
              },
            },
            {
              name: 'payloadId',
              type: 'text',
              label: 'Payload Entry ID',
              admin: {
                description: 'The Payload CMS entry ID created during ingestion (Phase 7)',
                readOnly: true,
              },
            },
          ],
        },
        {
          label: 'Metrics',
          fields: [
            {
              name: 'startedAt',
              type: 'date',
              label: 'Processing Started',
              admin: {
                date: {
                  pickerAppearance: 'dayAndTime',
                },
                description: 'Timestamp when processing started',
                readOnly: true,
              },
            },
            {
              name: 'completedAt',
              type: 'date',
              label: 'Processing Completed',
              admin: {
                date: {
                  pickerAppearance: 'dayAndTime',
                },
                description: 'Timestamp when processing completed or failed',
                readOnly: true,
              },
            },
            {
              name: 'duration',
              type: 'number',
              label: 'Duration (seconds)',
              admin: {
                description: 'Total processing time in seconds',
                readOnly: true,
              },
            },
            {
              name: 'timings',
              type: 'json',
              label: 'Phase Timings',
              admin: {
                description: 'Breakdown of time spent in each pipeline phase',
                readOnly: true,
              },
            },
            // V6: Phase timestamps
            {
              name: 'phase1CompletedAt',
              type: 'date',
              label: 'Phase 1 (Ingest) Completed',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When Phase 1 (ingest/scrape) completed',
                readOnly: true,
              },
            },
            {
              name: 'phase2CompletedAt',
              type: 'date',
              label: 'Phase 2 (Images) Completed',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When Phase 2 (image processing) completed',
                readOnly: true,
              },
            },
            {
              name: 'phase3CompletedAt',
              type: 'date',
              label: 'Phase 3 (Labeling) Completed',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When Phase 3 (AI labeling) completed',
                readOnly: true,
              },
            },
            {
              name: 'phase4CompletedAt',
              type: 'date',
              label: 'Phase 4 (Enhance) Completed',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When Phase 4 (content enhancement) completed',
                readOnly: true,
              },
            },
            {
              name: 'phase5CompletedAt',
              type: 'date',
              label: 'Phase 5 (Finalize) Completed',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When Phase 5 (finalization) completed',
                readOnly: true,
              },
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // Auto-extract itineraryId and accessKey from URL on create
        if (operation === 'create' && data.itrvlUrl) {
          try {
            const url = new URL(data.itrvlUrl)
            const pathParts = url.pathname.split('/').filter(part => part.length > 0)
            const portalIndex = pathParts.indexOf('portal')

            if (portalIndex !== -1 && pathParts.length >= portalIndex + 3) {
              data.accessKey = pathParts[portalIndex + 1]
              data.itineraryId = pathParts[portalIndex + 2]
            }
          } catch (error) {
            // URL parsing failed, leave fields empty
            console.error('Failed to parse iTrvl URL:', error)
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}
