import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'

export const ContentProjects: CollectionConfig = {
  slug: 'content-projects',
  admin: {
    useAsTitle: 'title',
    group: 'Content Engine',
    defaultColumns: ['title', 'contentType', 'stage', 'processingStatus', 'updatedAt'],
    listSearchableFields: ['title', 'slug'],
    description: 'Content production projects — from idea through to publication',
  },
  versions: {
    drafts: true,
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
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Working title for this content project',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly identifier — auto-generated or manual',
      },
    },
    {
      type: 'tabs',
      tabs: [
        // Tab 1: Overview
        {
          label: 'Overview',
          fields: [
            {
              name: 'stage',
              type: 'select',
              required: true,
              defaultValue: 'idea',
              options: [
                { label: 'Idea', value: 'idea' },
                { label: 'Brief', value: 'brief' },
                { label: 'Research', value: 'research' },
                { label: 'Draft', value: 'draft' },
                { label: 'Review', value: 'review' },
                { label: 'Published', value: 'published' },
                { label: 'Proposed', value: 'proposed' },
                { label: 'Rejected', value: 'rejected' },
                { label: 'Filtered', value: 'filtered' },
              ],
              admin: {
                description: 'Current workflow stage',
              },
            },
            {
              name: 'contentType',
              type: 'select',
              required: true,
              options: [
                { label: 'Itinerary Cluster', value: 'itinerary_cluster' },
                { label: 'Authority Article', value: 'authority' },
                { label: 'Designer Insight', value: 'designer_insight' },
                { label: 'Destination Page', value: 'destination_page' },
                { label: 'Property Page', value: 'property_page' },
                { label: 'Itinerary Enhancement', value: 'itinerary_enhancement' },
                { label: 'Page Update', value: 'page_update' },
              ],
              admin: {
                description: 'Type of content this project produces',
              },
            },
            {
              name: 'originPathway',
              type: 'select',
              options: [
                { label: 'Itinerary Decomposition', value: 'itinerary' },
                { label: 'External Source', value: 'external' },
                { label: 'Designer Suggestion', value: 'designer' },
                { label: 'Cascade', value: 'cascade' },
              ],
              admin: {
                description: 'How this project was created',
              },
            },
            {
              name: 'originItinerary',
              type: 'relationship',
              relationTo: 'itineraries',
              hasMany: false,
              admin: {
                description: 'Source itinerary (if origin is itinerary or cascade)',
                condition: (data) =>
                  data?.originPathway === 'itinerary' || data?.originPathway === 'cascade',
              },
            },
            {
              name: 'originSource',
              type: 'relationship',
              relationTo: 'source-registry',
              hasMany: false,
              admin: {
                description: 'Source feed entry (if origin is external)',
                condition: (data) => data?.originPathway === 'external',
              },
            },
            {
              name: 'originUrl',
              type: 'text',
              admin: {
                description: 'External URL that triggered this project',
                condition: (data) => data?.originPathway === 'external',
              },
            },
            {
              name: 'filterReason',
              type: 'text',
              admin: {
                description: 'Why this project was filtered during ideation',
                condition: (data) => data?.stage === 'filtered',
              },
            },
          ],
        },
        // Tab 2: Processing
        {
          label: 'Processing',
          fields: [
            {
              name: 'processingStatus',
              type: 'select',
              defaultValue: 'idle',
              options: [
                { label: 'Idle', value: 'idle' },
                { label: 'Processing', value: 'processing' },
                { label: 'Completed', value: 'completed' },
                { label: 'Failed', value: 'failed' },
              ],
              admin: {
                description:
                  'Status of current async operation (draft generation, research, etc.)',
              },
            },
            {
              name: 'processingError',
              type: 'text',
              admin: {
                description: 'Human-readable error from last failed operation',
                condition: (data) => data?.processingStatus === 'failed',
              },
            },
            {
              name: 'processingStartedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When the current async operation started',
                readOnly: true,
              },
            },
          ],
        },
        // Tab 3: Target
        {
          label: 'Target',
          fields: [
            {
              name: 'targetCollection',
              type: 'select',
              options: [
                { label: 'Destinations', value: 'destinations' },
                { label: 'Itineraries', value: 'itineraries' },
                { label: 'Posts (Articles)', value: 'posts' },
                { label: 'Properties', value: 'properties' },
              ],
              admin: {
                description: 'Which Payload collection this content publishes to',
              },
            },
            {
              name: 'targetRecordId',
              type: 'text',
              admin: {
                description: 'Payload ID of the target record (for updates and enhancements)',
              },
            },
            {
              name: 'targetField',
              type: 'text',
              admin: {
                description:
                  'Specific field or block name being updated (for page_update type)',
                condition: (data) => data?.contentType === 'page_update',
              },
            },
            {
              name: 'targetCurrentContent',
              type: 'richText',
              admin: {
                description:
                  'Snapshot of existing content at read time (for page_update type)',
                condition: (data) => data?.contentType === 'page_update',
              },
            },
            {
              name: 'targetUpdatedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description:
                  'updatedAt of target record at read time — used for optimistic locking on publish',
              },
            },
          ],
        },
        // Tab 4: Brief
        {
          label: 'Brief',
          fields: [
            {
              name: 'briefSummary',
              type: 'textarea',
              admin: {
                description: 'What this article will cover and why it matters',
              },
            },
            {
              name: 'targetAngle',
              type: 'textarea',
              admin: {
                description:
                  'The specific angle or perspective — what makes this different from competitors',
              },
            },
            {
              name: 'targetAudience',
              type: 'select',
              hasMany: true,
              options: [
                { label: 'Customer', value: 'customer' },
                { label: 'Professional', value: 'professional' },
                { label: 'Guide', value: 'guide' },
              ],
              admin: {
                description: 'Who this content is for',
              },
            },
            {
              name: 'competitiveNotes',
              type: 'textarea',
              admin: {
                description:
                  'What competitors have published on this topic and how we differ',
              },
            },
          ],
        },
        // Tab 5: Research
        {
          label: 'Research',
          fields: [
            {
              name: 'synthesis',
              type: 'richText',
              admin: {
                description: 'Compiled research findings — editable by designer',
              },
            },
            {
              name: 'existingSiteContent',
              type: 'richText',
              admin: {
                description:
                  'Relevant content already on kiuli.com (from embedding store query)',
              },
            },
            {
              name: 'sources',
              type: 'array',
              admin: {
                description: 'External sources used in research',
              },
              fields: [
                {
                  name: 'title',
                  type: 'text',
                  admin: {
                    description: 'Source title or headline',
                  },
                },
                {
                  name: 'url',
                  type: 'text',
                  admin: {
                    description: 'Source URL',
                  },
                },
                {
                  name: 'credibility',
                  type: 'select',
                  options: [
                    { label: 'Authoritative', value: 'authoritative' },
                    { label: 'Peer Reviewed', value: 'peer_reviewed' },
                    { label: 'Preprint', value: 'preprint' },
                    { label: 'Trade Publication', value: 'trade' },
                    { label: 'Other', value: 'other' },
                  ],
                  admin: {
                    description: 'Source credibility rating',
                  },
                },
                {
                  name: 'notes',
                  type: 'textarea',
                  admin: {
                    description: 'Key takeaways from this source',
                  },
                },
              ],
            },
            {
              name: 'proprietaryAngles',
              type: 'array',
              admin: {
                description: 'Unique angles from Kiuli internal sources',
              },
              fields: [
                {
                  name: 'angle',
                  type: 'textarea',
                  admin: {
                    description: 'The proprietary insight or angle',
                  },
                },
                {
                  name: 'source',
                  type: 'select',
                  options: [
                    { label: 'Designer', value: 'designer' },
                    { label: 'Client Feedback', value: 'client' },
                    { label: 'Booking Data', value: 'booking' },
                    { label: 'Supplier', value: 'supplier' },
                  ],
                  admin: {
                    description: 'Where this insight came from',
                  },
                },
              ],
            },
            {
              name: 'uncertaintyMap',
              type: 'array',
              admin: {
                description: 'Claims that need verification or have varying confidence',
              },
              fields: [
                {
                  name: 'claim',
                  type: 'text',
                  admin: {
                    description: 'The factual claim',
                  },
                },
                {
                  name: 'confidence',
                  type: 'select',
                  options: [
                    { label: 'Verified Fact', value: 'fact' },
                    { label: 'Reasonable Inference', value: 'inference' },
                    { label: 'Uncertain', value: 'uncertain' },
                  ],
                  admin: {
                    description: 'Confidence level',
                  },
                },
                {
                  name: 'notes',
                  type: 'textarea',
                  admin: {
                    description: 'Verification notes or sources',
                  },
                },
              ],
            },
            {
              name: 'editorialNotes',
              type: 'richText',
              admin: {
                description: 'Designer notes on research — context, corrections, additions',
              },
            },
          ],
        },
        // Tab 6: Draft
        {
          label: 'Draft',
          fields: [
            {
              name: 'body',
              type: 'richText',
              admin: {
                description:
                  'Full article body (Lexical editor). For compound types, use sections field instead.',
              },
            },
            {
              name: 'sections',
              type: 'json',
              admin: {
                description:
                  'Structured section content for compound types (destination_page, property_page). JSON object keyed by section name.',
              },
            },
            {
              name: 'faqSection',
              type: 'array',
              admin: {
                description: 'FAQ items for this content',
              },
              fields: [
                {
                  name: 'question',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'answer',
                  type: 'textarea',
                  required: true,
                },
              ],
            },
            {
              name: 'metaTitle',
              type: 'text',
              maxLength: 60,
              admin: {
                description: 'SEO meta title (max 60 chars)',
              },
            },
            {
              name: 'metaDescription',
              type: 'textarea',
              maxLength: 160,
              admin: {
                description: 'SEO meta description (max 160 chars)',
              },
            },
            {
              name: 'answerCapsule',
              type: 'textarea',
              admin: {
                description: 'AI Overview optimised summary (50-70 words)',
              },
            },
          ],
        },
        // Tab 7: Images
        {
          label: 'Images',
          fields: [
            {
              name: 'heroImage',
              type: 'relationship',
              relationTo: 'media',
              hasMany: false,
              admin: {
                description: 'Selected hero image for this content',
              },
            },
            {
              name: 'libraryMatches',
              type: 'json',
              admin: {
                description: 'Auto-populated matches from media library search',
                readOnly: true,
              },
            },
            {
              name: 'generatedCandidates',
              type: 'array',
              admin: {
                description: 'AI-generated image candidates',
              },
              fields: [
                {
                  name: 'imageUrl',
                  type: 'text',
                  admin: {
                    description: 'URL of generated image',
                  },
                },
                {
                  name: 'prompt',
                  type: 'textarea',
                  admin: {
                    description: 'Generation prompt used',
                  },
                },
                {
                  name: 'status',
                  type: 'select',
                  defaultValue: 'candidate',
                  options: [
                    { label: 'Candidate', value: 'candidate' },
                    { label: 'Selected', value: 'selected' },
                    { label: 'Rejected', value: 'rejected' },
                  ],
                },
              ],
            },
          ],
        },
        // Tab 8: Distribution
        {
          label: 'Distribution',
          fields: [
            {
              name: 'linkedinSummary',
              type: 'textarea',
              admin: {
                description: 'LinkedIn post text',
              },
            },
            {
              name: 'facebookSummary',
              type: 'textarea',
              admin: {
                description: 'Facebook post text',
              },
            },
            {
              name: 'facebookPinnedComment',
              type: 'textarea',
              admin: {
                description: 'Facebook pinned comment (often a call to action)',
              },
            },
            {
              name: 'postedToLinkedin',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Whether this has been posted to LinkedIn',
              },
            },
            {
              name: 'postedToFacebook',
              type: 'checkbox',
              defaultValue: false,
              admin: {
                description: 'Whether this has been posted to Facebook',
              },
            },
            {
              name: 'linkedinPostId',
              type: 'text',
              admin: {
                description: 'LinkedIn post ID (for tracking)',
                condition: (data) => data?.postedToLinkedin === true,
              },
            },
            {
              name: 'facebookPostId',
              type: 'text',
              admin: {
                description: 'Facebook post ID (for tracking)',
                condition: (data) => data?.postedToFacebook === true,
              },
            },
          ],
        },
        // Tab 9: Linking
        {
          label: 'Linking',
          fields: [
            {
              name: 'internalLinks',
              type: 'relationship',
              relationTo: 'content-projects',
              hasMany: true,
              admin: {
                description: 'Other content projects this links to',
              },
            },
            {
              name: 'itineraryLinks',
              type: 'relationship',
              relationTo: 'itineraries',
              hasMany: true,
              admin: {
                description: 'Itineraries this content links to',
              },
            },
            {
              name: 'destinationLinks',
              type: 'relationship',
              relationTo: 'destinations',
              hasMany: true,
              admin: {
                description: 'Destinations this content links to',
              },
            },
            {
              name: 'propertyLinks',
              type: 'relationship',
              relationTo: 'properties',
              hasMany: true,
              admin: {
                description: 'Properties this content links to',
              },
            },
          ],
        },
        // Tab 10: Consistency
        {
          label: 'Consistency',
          fields: [
            {
              name: 'consistencyCheckResult',
              type: 'select',
              defaultValue: 'not_checked',
              options: [
                { label: 'Pass', value: 'pass' },
                { label: 'Hard Contradiction', value: 'hard_contradiction' },
                { label: 'Soft Contradiction', value: 'soft_contradiction' },
                { label: 'Not Checked', value: 'not_checked' },
              ],
              admin: {
                description:
                  'Result of last consistency check against existing site content',
              },
            },
            {
              name: 'consistencyIssues',
              type: 'array',
              admin: {
                description: 'Specific contradictions or staleness issues found',
              },
              fields: [
                {
                  name: 'issueType',
                  type: 'select',
                  options: [
                    { label: 'Hard Contradiction', value: 'hard' },
                    { label: 'Soft Contradiction', value: 'soft' },
                    { label: 'Staleness', value: 'staleness' },
                  ],
                },
                {
                  name: 'existingContent',
                  type: 'textarea',
                  admin: {
                    description: 'The existing content that conflicts',
                  },
                },
                {
                  name: 'newContent',
                  type: 'textarea',
                  admin: {
                    description: 'The new content that conflicts',
                  },
                },
                {
                  name: 'sourceRecord',
                  type: 'text',
                  admin: {
                    description: 'ID and collection of the conflicting record',
                  },
                },
                {
                  name: 'resolution',
                  type: 'select',
                  defaultValue: 'pending',
                  options: [
                    { label: 'Pending', value: 'pending' },
                    { label: 'Updated Draft', value: 'updated_draft' },
                    { label: 'Updated Existing', value: 'updated_existing' },
                    { label: 'Overridden', value: 'overridden' },
                  ],
                },
                {
                  name: 'resolutionNote',
                  type: 'textarea',
                  admin: {
                    description: 'How this was resolved',
                  },
                },
              ],
            },
          ],
        },
        // Tab 11: Metadata
        {
          label: 'Metadata',
          fields: [
            {
              name: 'destinations',
              type: 'json',
              admin: {
                description: 'String array of destination names this content covers',
              },
            },
            {
              name: 'properties',
              type: 'json',
              admin: {
                description: 'String array of property names this content covers',
              },
            },
            {
              name: 'species',
              type: 'json',
              admin: {
                description: 'String array of wildlife species mentioned',
              },
            },
            {
              name: 'freshnessCategory',
              type: 'select',
              options: [
                { label: 'Monthly', value: 'monthly' },
                { label: 'Quarterly', value: 'quarterly' },
                { label: 'Annual', value: 'annual' },
                { label: 'Evergreen', value: 'evergreen' },
              ],
              admin: {
                description: 'How frequently this content needs freshness review',
              },
            },
            {
              name: 'publishedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When this content was published to its target collection',
              },
            },
            {
              name: 'lastReviewedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayAndTime' },
                description: 'When a designer last reviewed this content',
              },
            },
          ],
        },
        // Tab 12: Conversation
        {
          label: 'Conversation',
          fields: [
            {
              name: 'messages',
              type: 'array',
              admin: {
                description: 'Conversation thread between designer and Kiuli AI',
              },
              fields: [
                {
                  name: 'role',
                  type: 'select',
                  required: true,
                  options: [
                    { label: 'Designer', value: 'designer' },
                    { label: 'Kiuli', value: 'kiuli' },
                  ],
                },
                {
                  name: 'content',
                  type: 'textarea',
                  required: true,
                  admin: {
                    description: 'Message text',
                  },
                },
                {
                  name: 'timestamp',
                  type: 'date',
                  required: true,
                  admin: {
                    date: { pickerAppearance: 'dayAndTime' },
                  },
                },
                {
                  name: 'actions',
                  type: 'json',
                  admin: {
                    description:
                      'Structured record of edits or operations performed in response to this message',
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
