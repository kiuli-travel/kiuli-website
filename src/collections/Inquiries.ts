import type { CollectionConfig } from 'payload'

export const Inquiries: CollectionConfig = {
  slug: 'inquiries',
  labels: {
    singular: 'Inquiry',
    plural: 'Inquiries',
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['firstName', 'lastName', 'email', 'budgetRange', 'status', 'createdAt'],
    listSearchableFields: ['firstName', 'lastName', 'email'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(user),
    create: () => true, // Public - API will create inquiries
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    // Contact Information Group
    {
      type: 'row',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          required: true,
          admin: { width: '50%' },
        },
        {
          name: 'lastName',
          type: 'text',
          required: true,
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'email',
      type: 'email',
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'phone',
          type: 'text',
          required: true,
          admin: { width: '70%' },
        },
        {
          name: 'phoneCountryCode',
          type: 'text',
          required: false,
          admin: { width: '30%', description: 'Deprecated - phone now includes country code' },
        },
      ],
    },

    // Destinations
    {
      name: 'destinations',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'code',
          type: 'text',
          required: true,
        },
      ],
    },

    // Timing
    {
      name: 'timingType',
      type: 'select',
      required: true,
      options: [
        { label: 'Specific dates', value: 'specific' },
        { label: 'Flexible window', value: 'flexible' },
        { label: 'Just exploring', value: 'exploring' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'travelDateStart',
          type: 'date',
          admin: {
            width: '50%',
            condition: (data) => data?.timingType === 'specific',
          },
        },
        {
          name: 'travelDateEnd',
          type: 'date',
          admin: {
            width: '50%',
            condition: (data) => data?.timingType === 'specific',
          },
        },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'travelWindowEarliest',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Format: YYYY-MM',
            condition: (data) => data?.timingType === 'flexible',
          },
        },
        {
          name: 'travelWindowLatest',
          type: 'text',
          admin: {
            width: '50%',
            description: 'Format: YYYY-MM',
            condition: (data) => data?.timingType === 'flexible',
          },
        },
      ],
    },

    // Travelers
    {
      name: 'partyType',
      type: 'select',
      required: true,
      options: [
        { label: 'Solo', value: 'solo' },
        { label: 'Couple', value: 'couple' },
        { label: 'Family', value: 'family' },
        { label: 'Multi-generational', value: 'multigenerational' },
        { label: 'Friends', value: 'friends' },
        { label: 'Multiple families', value: 'multiple_families' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'totalTravelers',
          type: 'number',
          required: true,
          min: 1,
          max: 21,
          admin: { width: '50%' },
        },
        {
          name: 'childrenCount',
          type: 'number',
          required: true,
          min: 0,
          max: 11,
          admin: { width: '50%' },
        },
      ],
    },

    // Interests (multi-select)
    {
      name: 'interests',
      type: 'select',
      hasMany: true,
      required: true,
      options: [
        { label: 'The Great Migration', value: 'migration' },
        { label: 'Gorilla & primate trekking', value: 'gorillas' },
        { label: 'Big cats & wildlife', value: 'big_cats' },
        { label: 'Beach & island escape', value: 'beach' },
        { label: 'Cultural immersion', value: 'culture' },
        { label: 'Walking & hiking safaris', value: 'walking' },
        { label: 'Wine & culinary experiences', value: 'wine_culinary' },
        { label: 'Luxury lodges & camps', value: 'luxury_camp' },
        { label: 'Honeymoon or celebration', value: 'celebration' },
        { label: 'Photography safari', value: 'photography' },
        { label: 'Horse riding safari', value: 'horse_riding' },
        { label: 'Something else', value: 'other' },
      ],
    },

    // Budget
    {
      name: 'budgetRange',
      type: 'select',
      required: true,
      options: [
        { label: '$10,000 - $15,000', value: '10k-15k' },
        { label: '$15,000 - $25,000', value: '15k-25k' },
        { label: '$25,000 - $40,000', value: '25k-40k' },
        { label: '$40,000 - $60,000', value: '40k-60k' },
        { label: '$60,000 - $80,000', value: '60k-80k' },
        { label: '$80,000 - $100,000', value: '80k-100k' },
        { label: '$100,000+', value: '100k+' },
        { label: 'Not sure yet', value: 'unsure' },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'statedBudgetCents',
          type: 'number',
          required: true,
          admin: { width: '50%', description: 'Budget midpoint in cents' },
        },
        {
          name: 'projectedProfitCents',
          type: 'number',
          required: true,
          admin: { width: '50%', description: '20% of stated budget' },
        },
      ],
    },

    // How Heard & Message
    {
      name: 'howHeard',
      type: 'select',
      required: true,
      options: [
        { label: 'Google search', value: 'google' },
        { label: 'ChatGPT / AI assistant', value: 'ai' },
        { label: 'Friend or family', value: 'referral' },
        { label: 'Travel advisor', value: 'advisor' },
        { label: 'Magazine or publication', value: 'press' },
        { label: 'Social media', value: 'social' },
        { label: 'Podcast', value: 'podcast' },
        { label: 'Returning customer', value: 'returning' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'message',
      type: 'textarea',
      maxLength: 500,
    },
    {
      name: 'marketingConsent',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'contactConsent',
      type: 'checkbox',
      defaultValue: false,
    },

    // Attribution - Collapsible Group
    {
      type: 'collapsible',
      label: 'Attribution Data',
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'sessionId',
          type: 'text',
        },
        {
          name: 'gclid',
          type: 'text',
          admin: { description: 'Google Click ID' },
        },
        {
          name: 'gbraid',
          type: 'text',
          admin: { description: 'Google Ads iOS attribution' },
        },
        {
          name: 'wbraid',
          type: 'text',
          admin: { description: 'Google Ads iOS attribution' },
        },
        {
          type: 'row',
          fields: [
            { name: 'utmSource', type: 'text', admin: { width: '33%' } },
            { name: 'utmMedium', type: 'text', admin: { width: '33%' } },
            { name: 'utmCampaign', type: 'text', admin: { width: '34%' } },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'utmContent', type: 'text', admin: { width: '50%' } },
            { name: 'utmTerm', type: 'text', admin: { width: '50%' } },
          ],
        },
        {
          name: 'referrer',
          type: 'text',
        },
        {
          name: 'landingPage',
          type: 'text',
        },
        {
          name: 'pageUrl',
          type: 'text',
        },
        {
          name: 'itinerarySlug',
          type: 'text',
          admin: { description: 'If submitted from an itinerary page' },
        },
        {
          name: 'userAgent',
          type: 'textarea',
          admin: { description: 'Browser user agent string' },
        },
      ],
    },

    // Integration IDs - Collapsible Group
    {
      type: 'collapsible',
      label: 'Integration IDs',
      admin: { initCollapsed: true },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'hubspotContactId',
              type: 'text',
              admin: { width: '50%', readOnly: true },
            },
            {
              name: 'hubspotDealId',
              type: 'text',
              admin: { width: '50%', readOnly: true },
            },
          ],
        },
      ],
    },

    // Status & Assignment
    {
      type: 'row',
      fields: [
        {
          name: 'inquiryType',
          type: 'select',
          required: true,
          defaultValue: 'form',
          options: [
            { label: 'Form', value: 'form' },
            { label: 'Phone', value: 'phone' },
            { label: 'Email', value: 'email' },
            { label: 'Chat', value: 'chat' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          defaultValue: 'new',
          options: [
            { label: 'New', value: 'new' },
            { label: 'Contacted', value: 'contacted' },
            { label: 'Qualified', value: 'qualified' },
            { label: 'Converted', value: 'converted' },
            { label: 'Lost', value: 'lost' },
          ],
          admin: { width: '33%' },
        },
        {
          name: 'assignedDesigner',
          type: 'text',
          admin: { width: '34%' },
        },
        {
          name: 'assignedDesignerId',
          type: 'text',
          admin: {
            width: '33%',
            description: 'ID of designer assigned to this inquiry',
            readOnly: true,
          },
        },
      ],
    },

    // Form Metadata
    {
      type: 'row',
      fields: [
        {
          name: 'formStartedAt',
          type: 'date',
          admin: { width: '50%', date: { pickerAppearance: 'dayAndTime' } },
        },
        {
          name: 'timeToCompleteSeconds',
          type: 'number',
          admin: { width: '50%' },
        },
      ],
    },
  ],
  timestamps: true,
}
