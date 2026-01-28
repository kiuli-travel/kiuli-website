import type { CollectionConfig, AccessArgs } from 'payload'
import { authenticated } from '../../access/authenticated'
import { calculateChecklist, resolveFields, validatePublish } from './hooks'

// Allow authenticated users OR API key access for Lambda pipeline
const authenticatedOrApiKey = ({ req }: AccessArgs) => {
  if (req.user) return true
  const headers = req.headers as Headers | Record<string, string>
  const authHeader =
    typeof headers?.get === 'function'
      ? headers.get('authorization')
      : (headers as Record<string, string>)?.authorization
  // Accept both Bearer (legacy) and users API-Key (Payload native) formats
  if (authHeader?.startsWith('Bearer ') || authHeader?.startsWith('users API-Key ')) return true
  return false
}

// Only allow creation via API (not admin UI)
// Users should use the Import Itinerary page instead
const apiKeyOnlyCreate = ({ req }: AccessArgs) => {
  // Block logged-in users from creating via admin UI
  // Allow API key access for Lambda pipeline
  const headers = req.headers as Headers | Record<string, string>
  const authHeader =
    typeof headers?.get === 'function'
      ? headers.get('authorization')
      : (headers as Record<string, string>)?.authorization
  // Accept both Bearer (legacy) and users API-Key (Payload native) formats
  if (authHeader?.startsWith('Bearer ') || authHeader?.startsWith('users API-Key ')) return true
  return false
}

export const Itineraries: CollectionConfig<'itineraries'> = {
  slug: 'itineraries',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'overview.nights', '_status', 'updatedAt'],
    description:
      'Safari itineraries imported from iTrvl. To import a new itinerary, use the "Import Itinerary" button in the sidebar or go to /admin/scrape',
    hideAPIURL: true,
  },
  access: {
    read: authenticatedOrApiKey,
    create: apiKeyOnlyCreate, // Only allow API-based creation (via Lambda pipeline)
    update: authenticatedOrApiKey,
    delete: authenticated,
  },
  hooks: {
    beforeChange: [calculateChecklist, validatePublish],
    afterRead: [resolveFields],
  },
  versions: {
    drafts: true,
  },
  fields: [
    // === ADMIN UI COMPONENTS ===
    {
      name: 'sideNavUI',
      type: 'ui',
      admin: {
        components: {
          Field: '@/collections/Itineraries/components/ItinerarySideNav#ItinerarySideNav',
        },
      },
    },
    {
      name: 'enhanceAllUI',
      type: 'ui',
      admin: {
        components: {
          Field: '@/collections/Itineraries/components/EnhanceAll#EnhanceAll',
        },
      },
    },
    {
      name: 'rescrapeUI',
      type: 'ui',
      admin: {
        components: {
          Field: '@/collections/Itineraries/components/RescrapeButton#RescrapeButton',
        },
      },
    },
    {
      name: 'imageStatusUI',
      type: 'ui',
      admin: {
        components: {
          Field: '@/collections/Itineraries/components/ImageStatusGrid#ImageStatusGrid',
        },
      },
    },
    {
      name: 'publishChecklistUI',
      type: 'ui',
      admin: {
        components: {
          Field: '@/collections/Itineraries/components/PublishChecklist#PublishChecklist',
        },
      },
    },

    // === BASIC INFO ===
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    // Title two-field pattern (V7)
    {
      name: 'titleItrvl',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Original title from iTrvl (read-only)',
      },
    },
    {
      name: 'titleEnhanced',
      type: 'text',
      admin: {
        description: 'Enhanced title (editable)',
      },
    },
    {
      name: 'titleReviewed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Title has been reviewed',
      },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'URL-friendly identifier (auto-generated from title)',
      },
    },
    {
      name: 'itineraryId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'iTrvl itinerary ID for deduplication',
        readOnly: true,
      },
    },

    // === SEO ===
    {
      name: 'metaTitle',
      type: 'text',
      maxLength: 60,
      admin: {
        description: 'SEO title (max 60 chars). Auto-generated if blank.',
      },
    },
    // MetaTitle two-field pattern (V7)
    {
      name: 'metaTitleItrvl',
      type: 'text',
      maxLength: 60,
      admin: {
        readOnly: true,
        description: 'Original meta title from iTrvl (read-only)',
      },
    },
    {
      name: 'metaTitleEnhanced',
      type: 'text',
      maxLength: 60,
      admin: {
        description: 'Enhanced meta title (editable)',
      },
    },
    {
      name: 'metaTitleReviewed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Meta title has been reviewed',
      },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      maxLength: 160,
      admin: {
        description: 'SEO description (max 160 chars). Auto-generated if blank.',
      },
    },
    // MetaDescription two-field pattern (V7)
    {
      name: 'metaDescriptionItrvl',
      type: 'textarea',
      maxLength: 160,
      admin: {
        readOnly: true,
        description: 'Original meta description from iTrvl (read-only)',
      },
    },
    {
      name: 'metaDescriptionEnhanced',
      type: 'textarea',
      maxLength: 160,
      admin: {
        description: 'Enhanced meta description (editable)',
      },
    },
    {
      name: 'metaDescriptionReviewed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Meta description has been reviewed',
      },
    },

    // === HERO ===
    {
      name: 'heroImage',
      type: 'relationship',
      relationTo: 'media',
      admin: {
        description: 'Primary hero image for the itinerary page',
        components: {
          Field: '@/components/admin/ImageSelectorField#ImageSelectorField',
        },
      },
    },
    {
      name: 'heroImageLocked',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Lock hero image to prevent auto-replacement on re-scrape',
      },
    },
    {
      name: 'heroImageReviewed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Hero image selection has been reviewed',
      },
    },

    // === HERO VIDEO ===
    {
      name: 'heroVideoSectionUI',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/SectionHeader#HeroVideoSectionHeader',
        },
      },
    },
    {
      name: 'heroVideo',
      type: 'relationship',
      relationTo: 'media',
      filterOptions: {
        mediaType: {
          equals: 'video',
        },
      },
      admin: {
        description: 'Hero video for itinerary header (background video)',
        components: {
          Field: '@/components/admin/VideoSelectorField#VideoSelectorField',
        },
      },
    },
    {
      name: 'heroVideoLocked',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Lock hero video to prevent auto-replacement on re-scrape',
      },
    },
    {
      name: 'heroVideoReviewed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Hero video selection has been reviewed',
      },
    },
    {
      name: 'showHeroVideo',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Include hero video on the published page (when frontend is built)',
      },
    },
    {
      name: 'videoScrapedFromSource',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'Whether videos were found during iTrvl scraping (set by pipeline)',
      },
    },
    {
      name: 'videoScrapingError',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Error message if video scraping failed',
      },
    },

    // === CATEGORIZATION ===
    {
      name: 'destinations',
      type: 'relationship',
      relationTo: 'destinations',
      hasMany: true,
      admin: {
        description: 'Countries, regions, and parks featured in this itinerary',
      },
    },
    {
      name: 'tripTypes',
      type: 'relationship',
      relationTo: 'trip-types',
      hasMany: true,
      admin: {
        description: 'Safari categories (e.g., Great Migration, Gorilla Trekking)',
      },
    },

    // === OVERVIEW ===
    {
      name: 'overview',
      type: 'group',
      fields: [
        // Legacy field (kept for backward compatibility)
        {
          name: 'summaryOriginal',
          type: 'richText',
          admin: {
            description: 'Original summary from scrape (legacy)',
          },
        },
        {
          name: 'summaryEnhanced',
          type: 'richText',
          admin: {
            description: 'AI-enhanced summary (editable)',
          },
        },
        // V7 two-field pattern
        {
          name: 'summaryItrvl',
          type: 'richText',
          admin: {
            readOnly: true,
            description: 'Original summary from iTrvl (read-only)',
          },
        },
        {
          name: 'summaryReviewed',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Summary has been reviewed',
          },
        },
        {
          name: 'enhanceOverviewUI',
          type: 'ui',
          admin: {
            components: {
              Field: '@/collections/Itineraries/components/EnhanceButton#EnhanceOverviewButton',
            },
          },
        },
        {
          name: 'nights',
          type: 'number',
          min: 1,
          admin: {
            description: 'Total number of nights',
          },
        },
        {
          name: 'countries',
          type: 'array',
          fields: [
            {
              name: 'country',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'highlights',
          type: 'array',
          admin: {
            description: 'Key highlights/experiences',
          },
          fields: [
            {
              name: 'highlight',
              type: 'text',
              required: true,
            },
          ],
        },
      ],
    },

    // === INVESTMENT LEVEL ===
    {
      name: 'investmentLevel',
      type: 'group',
      admin: {
        description: 'Pricing information (revealed after value is established)',
      },
      fields: [
        {
          name: 'fromPrice',
          type: 'number',
          admin: {
            description: 'Starting price per person in dollars',
          },
        },
        {
          name: 'toPrice',
          type: 'number',
          admin: {
            description: 'Upper price range (optional)',
          },
        },
        {
          name: 'currency',
          type: 'text',
          defaultValue: 'USD',
        },
        // Legacy field (kept for backward compatibility)
        {
          name: 'includes',
          type: 'richText',
          admin: {
            description: 'What the price includes (legacy)',
          },
        },
        // V7 two-field pattern
        {
          name: 'includesItrvl',
          type: 'richText',
          admin: {
            readOnly: true,
            description: 'Original includes from iTrvl (read-only)',
          },
        },
        {
          name: 'includesEnhanced',
          type: 'richText',
          admin: {
            description: 'Enhanced includes text (editable)',
          },
        },
        {
          name: 'includesReviewed',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Includes text has been reviewed',
          },
        },
      ],
    },

    // === STRUCTURED DAYS ===
    {
      name: 'days',
      type: 'array',
      admin: {
        description: 'Day-by-day itinerary',
      },
      fields: [
        {
          name: 'dayNumber',
          type: 'number',
          required: true,
        },
        {
          name: 'date',
          type: 'date',
          admin: {
            description: 'Specific date (if applicable)',
          },
        },
        {
          name: 'title',
          type: 'text',
          admin: {
            description: 'Day title, e.g., "Arrival in Nairobi"',
          },
        },
        {
          name: 'titleItrvl',
          type: 'text',
          admin: {
            readOnly: true,
            description: 'Original day title from iTrvl (read-only)',
          },
        },
        {
          name: 'titleEnhanced',
          type: 'text',
          admin: {
            description: 'Enhanced day title (editable)',
          },
        },
        {
          name: 'titleReviewed',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'location',
          type: 'text',
        },
        {
          name: 'segments',
          type: 'blocks',
          blocks: [
            // STAY BLOCK
            {
              slug: 'stay',
              labels: {
                singular: 'Stay',
                plural: 'Stays',
              },
              fields: [
                {
                  name: 'reviewUI',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/collections/Itineraries/components/ReviewToggle#ReviewToggle',
                    },
                  },
                },
                {
                  name: 'reviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description: 'Mark as reviewed after checking AI-enhanced content',
                    condition: () => false, // Hide raw checkbox - use reviewUI instead
                  },
                },
                {
                  name: 'accommodationName',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'accommodationNameEditor',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/StayFieldEditors#AccommodationNameEditor',
                    },
                  },
                },
                {
                  name: 'accommodationNameItrvl',
                  type: 'text',
                  admin: {
                    readOnly: true,
                    description: 'Original accommodation name from iTrvl (read-only)',
                    condition: () => false, // Hidden - use accommodationNameEditor UI
                  },
                },
                {
                  name: 'accommodationNameEnhanced',
                  type: 'text',
                  admin: {
                    description: 'Enhanced accommodation name (editable)',
                    condition: () => false, // Hidden - use accommodationNameEditor UI
                  },
                },
                {
                  name: 'accommodationNameReviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    condition: () => false, // Hidden - use accommodationNameEditor UI
                  },
                },
                {
                  name: 'descriptionEditor',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/StayFieldEditors#StayDescriptionEditor',
                    },
                  },
                },
                {
                  name: 'descriptionOriginal',
                  type: 'richText',
                  admin: {
                    description: 'Original description from scrape',
                    condition: () => false, // Hidden - legacy field
                  },
                },
                {
                  name: 'descriptionItrvl',
                  type: 'richText',
                  admin: {
                    readOnly: true,
                    description: 'Original description from iTrvl (read-only)',
                    condition: () => false, // Hidden - use descriptionEditor UI
                  },
                },
                {
                  name: 'descriptionEnhanced',
                  type: 'richText',
                  admin: {
                    description: 'AI-enhanced description (editable)',
                    condition: () => false, // Hidden - use descriptionEditor UI
                  },
                },
                {
                  name: 'descriptionReviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    condition: () => false, // Hidden - use descriptionEditor UI
                  },
                },
                {
                  name: 'nights',
                  type: 'number',
                  min: 1,
                },
                {
                  name: 'location',
                  type: 'text',
                },
                {
                  name: 'country',
                  type: 'text',
                },
                {
                  name: 'imagePreviewUI',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/ImageThumbnailsPreview#ImageThumbnailsPreview',
                    },
                  },
                },
                {
                  name: 'images',
                  type: 'relationship',
                  relationTo: 'media',
                  hasMany: true,
                },
                {
                  name: 'imagesReviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description: 'Images have been reviewed',
                  },
                },
                {
                  name: 'inclusionsEditor',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/StayFieldEditors#InclusionsEditor',
                    },
                  },
                },
                {
                  name: 'inclusions',
                  type: 'richText',
                  admin: {
                    description: 'What is included at this property',
                    condition: () => false, // Hidden - legacy field
                  },
                },
                {
                  name: 'inclusionsItrvl',
                  type: 'richText',
                  admin: {
                    readOnly: true,
                    description: 'Original inclusions from iTrvl (read-only)',
                    condition: () => false, // Hidden - use inclusionsEditor UI
                  },
                },
                {
                  name: 'inclusionsEnhanced',
                  type: 'richText',
                  admin: {
                    description: 'Enhanced inclusions (editable)',
                    condition: () => false, // Hidden - use inclusionsEditor UI
                  },
                },
                {
                  name: 'inclusionsReviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    condition: () => false, // Hidden - use inclusionsEditor UI
                  },
                },
                {
                  name: 'roomType',
                  type: 'text',
                },
              ],
            },
            // ACTIVITY BLOCK
            {
              slug: 'activity',
              labels: {
                singular: 'Activity',
                plural: 'Activities',
              },
              fields: [
                {
                  name: 'reviewUI',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/collections/Itineraries/components/ReviewToggle#ReviewToggle',
                    },
                  },
                },
                {
                  name: 'reviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description: 'Mark as reviewed after checking AI-enhanced content',
                    condition: () => false, // Hide raw checkbox - use reviewUI instead
                  },
                },
                {
                  name: 'title',
                  type: 'text',
                  required: true,
                },
                {
                  name: 'titleEditor',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/ActivityFieldEditors#ActivityTitleEditor',
                    },
                  },
                },
                {
                  name: 'titleItrvl',
                  type: 'text',
                  admin: {
                    readOnly: true,
                    description: 'Original title from iTrvl (read-only)',
                    condition: () => false, // Hidden - use titleEditor UI
                  },
                },
                {
                  name: 'titleEnhanced',
                  type: 'text',
                  admin: {
                    description: 'Enhanced title (editable)',
                    condition: () => false, // Hidden - use titleEditor UI
                  },
                },
                {
                  name: 'titleReviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    condition: () => false, // Hidden - use titleEditor UI
                  },
                },
                {
                  name: 'descriptionEditor',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/ActivityFieldEditors#ActivityDescriptionEditor',
                    },
                  },
                },
                {
                  name: 'descriptionOriginal',
                  type: 'richText',
                  admin: {
                    description: 'Original description from scrape',
                    condition: () => false, // Hidden - legacy field
                  },
                },
                {
                  name: 'descriptionItrvl',
                  type: 'richText',
                  admin: {
                    readOnly: true,
                    description: 'Original description from iTrvl (read-only)',
                    condition: () => false, // Hidden - use descriptionEditor UI
                  },
                },
                {
                  name: 'descriptionEnhanced',
                  type: 'richText',
                  admin: {
                    description: 'AI-enhanced description (editable)',
                    condition: () => false, // Hidden - use descriptionEditor UI
                  },
                },
                {
                  name: 'descriptionReviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    condition: () => false, // Hidden - use descriptionEditor UI
                  },
                },
                {
                  name: 'imagePreviewUI',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/ImageThumbnailsPreview#ImageThumbnailsPreview',
                    },
                  },
                },
                {
                  name: 'images',
                  type: 'relationship',
                  relationTo: 'media',
                  hasMany: true,
                },
                {
                  name: 'imagesReviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description: 'Images have been reviewed',
                  },
                },
              ],
            },
            // TRANSFER BLOCK
            {
              slug: 'transfer',
              labels: {
                singular: 'Transfer',
                plural: 'Transfers',
              },
              fields: [
                {
                  name: 'reviewUI',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/collections/Itineraries/components/ReviewToggle#ReviewToggle',
                    },
                  },
                },
                {
                  name: 'reviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    description: 'Mark as reviewed after checking AI-enhanced content',
                    condition: () => false, // Hide raw checkbox - use reviewUI instead
                  },
                },
                {
                  name: 'type',
                  type: 'select',
                  options: [
                    { label: 'Flight', value: 'flight' },
                    { label: 'Road', value: 'road' },
                    { label: 'Boat', value: 'boat' },
                    { label: 'Entry', value: 'entry' },
                    { label: 'Exit', value: 'exit' },
                    { label: 'Point', value: 'point' },
                  ],
                },
                {
                  name: 'title',
                  type: 'text',
                },
                {
                  name: 'titleEditor',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/TransferFieldEditors#TransferTitleEditor',
                    },
                  },
                },
                {
                  name: 'titleItrvl',
                  type: 'text',
                  admin: {
                    readOnly: true,
                    description: 'Original title from iTrvl (read-only)',
                    condition: () => false, // Hidden - use titleEditor UI
                  },
                },
                {
                  name: 'titleEnhanced',
                  type: 'text',
                  admin: {
                    description: 'Enhanced title (editable)',
                    condition: () => false, // Hidden - use titleEditor UI
                  },
                },
                {
                  name: 'titleReviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    condition: () => false, // Hidden - use titleEditor UI
                  },
                },
                {
                  name: 'from',
                  type: 'text',
                },
                {
                  name: 'to',
                  type: 'text',
                },
                {
                  name: 'descriptionEditor',
                  type: 'ui',
                  admin: {
                    components: {
                      Field: '@/components/admin/TransferFieldEditors#TransferDescriptionEditor',
                    },
                  },
                },
                {
                  name: 'descriptionOriginal',
                  type: 'richText',
                  admin: {
                    description: 'Original description from scrape',
                    condition: () => false, // Hidden - legacy field
                  },
                },
                {
                  name: 'descriptionItrvl',
                  type: 'richText',
                  admin: {
                    readOnly: true,
                    description: 'Original description from iTrvl (read-only)',
                    condition: () => false, // Hidden - use descriptionEditor UI
                  },
                },
                {
                  name: 'descriptionEnhanced',
                  type: 'richText',
                  admin: {
                    description: 'AI-enhanced description (editable)',
                    condition: () => false, // Hidden - use descriptionEditor UI
                  },
                },
                {
                  name: 'descriptionReviewed',
                  type: 'checkbox',
                  defaultValue: false,
                  admin: {
                    condition: () => false, // Hidden - use descriptionEditor UI
                  },
                },
                {
                  name: 'departureTime',
                  type: 'text',
                },
                {
                  name: 'arrivalTime',
                  type: 'text',
                },
              ],
            },
          ],
        },
      ],
    },

    // === FAQ ===
    {
      name: 'faqItems',
      type: 'array',
      admin: {
        description: 'FAQ questions and answers for SEO/AIO',
      },
      fields: [
        {
          name: 'reviewUI',
          type: 'ui',
          admin: {
            components: {
              Field: '@/collections/Itineraries/components/ReviewToggle#ReviewToggle',
            },
          },
        },
        {
          name: 'reviewed',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Mark as reviewed after checking AI-generated content',
            condition: () => false, // Hide raw checkbox - use reviewUI instead
          },
        },
        {
          name: 'question',
          type: 'text',
          required: true,
        },
        {
          name: 'questionEditor',
          type: 'ui',
          admin: {
            components: {
              Field: '@/components/admin/FAQFieldEditors#FAQQuestionEditor',
            },
          },
        },
        {
          name: 'questionItrvl',
          type: 'text',
          admin: {
            description: 'Original question from iTrvl',
            condition: () => false, // Hidden - use questionEditor UI
          },
        },
        {
          name: 'questionEnhanced',
          type: 'text',
          admin: {
            description: 'Enhanced question (editable)',
            condition: () => false, // Hidden - use questionEditor UI
          },
        },
        {
          name: 'questionReviewed',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            condition: () => false, // Hidden - use questionEditor UI
          },
        },
        {
          name: 'answerEditor',
          type: 'ui',
          admin: {
            components: {
              Field: '@/components/admin/FAQFieldEditors#FAQAnswerEditor',
            },
          },
        },
        {
          name: 'answerOriginal',
          type: 'richText',
          admin: {
            description: 'Original answer from scrape',
            condition: () => false, // Hidden - legacy field
          },
        },
        {
          name: 'answerItrvl',
          type: 'richText',
          admin: {
            description: 'Original answer from iTrvl',
            condition: () => false, // Hidden - use answerEditor UI
          },
        },
        {
          name: 'answerEnhanced',
          type: 'richText',
          admin: {
            description: 'AI-enhanced answer (editable)',
            condition: () => false, // Hidden - use answerEditor UI
          },
        },
        {
          name: 'answerReviewed',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            condition: () => false, // Hidden - use answerEditor UI
          },
        },
      ],
    },

    // === WHY KIULI ===
    // Legacy fields (kept for backward compatibility)
    {
      name: 'whyKiuliOriginal',
      type: 'richText',
      admin: {
        description: 'Original "Why Kiuli" content (legacy)',
      },
    },
    {
      name: 'whyKiuliEnhanced',
      type: 'richText',
      admin: {
        description: 'AI-enhanced "Why Kiuli" content (legacy)',
      },
    },
    // V7 two-field pattern
    {
      name: 'whyKiuliItrvl',
      type: 'richText',
      admin: {
        readOnly: true,
        description: 'Original Why Kiuli text from iTrvl (read-only)',
      },
    },
    {
      name: 'whyKiuliReviewed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Why Kiuli content has been reviewed',
      },
    },
    {
      name: 'enhanceWhyKiuliUI',
      type: 'ui',
      admin: {
        components: {
          Field: '@/collections/Itineraries/components/EnhanceButton#EnhanceWhyKiuliButton',
        },
      },
    },

    // === ALL IMAGES (for gallery) ===
    {
      name: 'imagesGalleryUI',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/RootImagesGallery#RootImagesGallery',
        },
      },
    },
    {
      name: 'images',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      admin: {
        description: 'All images associated with this itinerary (use gallery above to preview)',
      },
    },

    // === ALL VIDEOS ===
    {
      name: 'videosGalleryUI',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/admin/VideosGallery#VideosGallery',
        },
      },
    },
    {
      name: 'videos',
      type: 'relationship',
      relationTo: 'media',
      hasMany: true,
      filterOptions: {
        mediaType: {
          equals: 'video',
        },
      },
      admin: {
        description: 'All videos associated with this itinerary',
      },
    },

    // === PUBLISH CHECKLIST (V6) ===
    {
      name: 'publishChecklist',
      type: 'group',
      admin: {
        description: 'Gated publishing checklist - all must be true to publish',
        condition: () => false, // Hide raw fields - use publishChecklistUI component instead
      },
      fields: [
        {
          name: 'allImagesProcessed',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'All images have been processed and uploaded',
          },
        },
        {
          name: 'noFailedImages',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'No images in failed state',
          },
        },
        {
          name: 'heroImageSelected',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Hero image has been selected',
          },
        },
        {
          name: 'contentEnhanced',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Content has been enhanced or reviewed',
          },
        },
        {
          name: 'schemaGenerated',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'JSON-LD schema has been generated',
          },
        },
        {
          name: 'schemaValid',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Schema passes validation for Google Rich Results',
          },
        },
        {
          name: 'metaFieldsFilled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Meta title and description are set',
          },
        },
        {
          name: 'tripTypesSelected',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'At least one trip type has been selected',
          },
        },
      ],
    },

    // === PUBLISH BLOCKERS (V6) ===
    {
      name: 'publishBlockers',
      type: 'array',
      admin: {
        description: 'List of issues blocking publication',
        readOnly: true,
      },
      fields: [
        {
          name: 'reason',
          type: 'text',
          required: true,
        },
        {
          name: 'severity',
          type: 'select',
          options: [
            { label: 'Error', value: 'error' },
            { label: 'Warning', value: 'warning' },
          ],
          defaultValue: 'error',
        },
      ],
    },

    // === VERSIONING (V6) ===
    {
      name: 'version',
      type: 'number',
      defaultValue: 1,
      admin: {
        description: 'Content version number',
        readOnly: true,
      },
    },
    {
      name: 'previousVersions',
      type: 'array',
      admin: {
        description: 'History of previous versions',
        readOnly: true,
      },
      fields: [
        {
          name: 'versionNumber',
          type: 'number',
        },
        {
          name: 'scrapedAt',
          type: 'date',
        },
        {
          name: 'data',
          type: 'json',
          admin: {
            description: 'Snapshot of previous version data',
          },
        },
      ],
    },

    // === SCHEMA (JSON-LD) ===
    {
      name: 'schema',
      type: 'json',
      admin: {
        description: 'Product JSON-LD schema (auto-generated)',
        readOnly: true,
      },
    },
    {
      name: 'schemaStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Pass', value: 'pass' },
        { label: 'Warning', value: 'warn' },
        { label: 'Fail', value: 'fail' },
      ],
      admin: {
        description: 'Schema validation status (pass/warn/fail)',
      },
    },

    // === SOURCE DATA ===
    {
      name: 'source',
      type: 'group',
      admin: {
        description: 'Original source data (for debugging)',
      },
      fields: [
        {
          name: 'itrvlUrl',
          type: 'text',
        },
        {
          name: 'lastScrapedAt',
          type: 'date',
        },
        {
          name: 'rawData',
          type: 'json',
          admin: {
            description: 'Original scraped JSON for debugging',
          },
        },
      ],
    },

    // === BUILD INFO ===
    {
      name: 'buildTimestamp',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'When this was last built/scraped',
      },
    },
    {
      name: 'googleInspectionStatus',
      type: 'select',
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Pass', value: 'pass' },
        { label: 'Fail', value: 'fail' },
      ],
      admin: {
        description: 'Google Search Console inspection status',
      },
    },
  ],
}
