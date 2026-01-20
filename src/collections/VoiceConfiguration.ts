import type { CollectionConfig } from 'payload'

export const VoiceConfiguration: CollectionConfig = {
  slug: 'voice-configuration',
  admin: {
    useAsTitle: 'name',
    group: 'Settings',
    description: 'Kiuli Voice settings for AI content enhancement',
  },
  access: {
    read: () => true,
    update: ({ req }) => !!req.user,
    create: () => false, // Only predefined configs via seed
    delete: () => false,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        description: 'Configuration identifier (e.g., segment-description)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'What this configuration controls',
      },
    },
    {
      name: 'systemPrompt',
      type: 'textarea',
      required: true,
      admin: {
        description: 'The system prompt for AI enhancement',
        rows: 15,
      },
    },
    {
      name: 'userPromptTemplate',
      type: 'textarea',
      required: true,
      admin: {
        description:
          'Template for user prompt. Use {{content}} for the text to enhance, {{propertyName}}, {{location}}, {{country}} for context.',
        rows: 8,
      },
    },
    {
      name: 'maxWords',
      type: 'number',
      admin: {
        description: 'Maximum word count for enhanced output',
      },
    },
    {
      name: 'temperature',
      type: 'number',
      min: 0,
      max: 1,
      defaultValue: 0.7,
      admin: {
        description: 'AI creativity level (0 = conservative, 1 = creative)',
        step: 0.1,
      },
    },
    {
      name: 'examples',
      type: 'array',
      admin: {
        description: 'Before/after examples to guide the AI',
      },
      fields: [
        {
          name: 'before',
          type: 'textarea',
          required: true,
          admin: {
            description: 'Original text',
            rows: 4,
          },
        },
        {
          name: 'after',
          type: 'textarea',
          required: true,
          admin: {
            description: 'Enhanced text',
            rows: 4,
          },
        },
      ],
    },
    {
      name: 'antiPatterns',
      type: 'array',
      admin: {
        description: 'Words and phrases to avoid in enhanced content',
      },
      fields: [
        {
          name: 'pattern',
          type: 'text',
          required: true,
          admin: {
            description: 'Word or phrase to avoid',
          },
        },
        {
          name: 'reason',
          type: 'text',
          admin: {
            description: 'Why this should be avoided',
          },
        },
      ],
    },
  ],
}
