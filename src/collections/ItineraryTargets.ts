import type { CollectionConfig } from 'payload'

export const ItineraryTargets: CollectionConfig = {
  slug: 'itinerary-targets',
  labels: { singular: 'Itinerary Target', plural: 'Itinerary Targets' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['number', 'name', 'priority', 'set', 'status', 'countries'],
    group: 'Itineraries',
    description: 'Target itineraries for website launch — 80 planned safaris to build in iTrvl and scrape into Kiuli.',
    listSearchableFields: ['name', 'countries', 'category'],
  },
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => !!req.user,
    update: ({ req }) => !!req.user,
    delete: ({ req }) => !!req.user,
  },
  fields: [
    // === IDENTITY ===
    {
      name: 'number',
      type: 'number',
      required: true,
      unique: true,
      admin: {
        description: 'Briefing document number (1–80)',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Exact itinerary name from briefing — do not change (SEO/Google Ads targeting)',
      },
    },
    {
      name: 'priority',
      type: 'select',
      required: true,
      options: [
        { label: 'Primary (Google Ads)', value: 'primary' },
        { label: 'Secondary (SEO)', value: 'secondary' },
      ],
      admin: {
        description: 'Primary itineraries are Google Ads landing pages. Build these first.',
      },
    },
    {
      name: 'set',
      type: 'select',
      required: true,
      options: [
        { label: 'Set A', value: 'A' },
        { label: 'Set B', value: 'B' },
      ],
      admin: {
        description: 'Designer assignment set — one designer per set.',
      },
    },

    // === BRIEFING DETAILS ===
    {
      name: 'duration',
      type: 'text',
      admin: {
        description: 'Duration guidance from briefing (e.g., "10–14 nights")',
      },
    },
    {
      name: 'countries',
      type: 'text',
      admin: {
        description: 'Countries covered (e.g., "Tanzania, Kenya")',
      },
    },
    {
      name: 'seasonality',
      type: 'text',
      admin: {
        description: 'Seasonality guidance from briefing (e.g., "June–October")',
      },
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Migration', value: 'migration' },
        { label: 'Gorilla & Primate', value: 'gorilla_primate' },
        { label: 'Honeymoon & Romance', value: 'honeymoon' },
        { label: 'Family', value: 'family' },
        { label: 'Classic Circuit', value: 'classic' },
        { label: 'Multi-Country', value: 'multi_country' },
        { label: 'Photography', value: 'photography' },
        { label: 'Specialist', value: 'specialist' },
        { label: 'Beach & Island', value: 'beach' },
        { label: 'Walking & Adventure', value: 'walking' },
        { label: 'Conservation', value: 'conservation' },
      ],
      admin: {
        description: 'Itinerary category for grouping and filtering.',
      },
    },
    {
      name: 'experienceDescription',
      type: 'textarea',
      admin: {
        description: 'Experience description from briefing — what this safari delivers.',
      },
    },
    {
      name: 'propertyGuidance',
      type: 'textarea',
      admin: {
        description: 'Property guidance from briefing — what type of lodges to use.',
      },
    },
    {
      name: 'seoKeywords',
      type: 'text',
      admin: {
        description: 'Primary SEO keywords (primary itineraries only).',
        condition: (data) => data?.priority === 'primary',
      },
    },

    // === WORKFLOW STATUS ===
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'not_started',
      options: [
        { label: 'Not Started', value: 'not_started' },
        { label: 'Building in iTrvl', value: 'building' },
        { label: 'Ready to Scrape', value: 'ready_to_scrape' },
        { label: 'Scraped', value: 'scraped' },
        { label: 'Enhancing', value: 'enhancing' },
        { label: 'In Review', value: 'in_review' },
        { label: 'Published', value: 'published' },
      ],
    },
    {
      name: 'assignedDesigner',
      type: 'relationship',
      relationTo: 'designers',
      admin: {
        description: 'Which designer is building this in iTrvl.',
      },
    },

    // === LINKING ===
    {
      name: 'itrvlUrl',
      type: 'text',
      admin: {
        description: 'iTrvl URL once the itinerary has been built.',
      },
    },
    {
      name: 'linkedItinerary',
      type: 'relationship',
      relationTo: 'itineraries',
      admin: {
        description: 'Linked Kiuli itinerary once scraped.',
      },
    },

    // === NOTES ===
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Designer notes, issues, or flags.',
      },
    },
  ],
}
