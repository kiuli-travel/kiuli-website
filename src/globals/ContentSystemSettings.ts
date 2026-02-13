import type { GlobalConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const ContentSystemSettings: GlobalConfig = {
  slug: 'content-system-settings',
  admin: {
    group: 'Configuration',
  },
  access: {
    read: () => true,
    update: authenticated,
  },
  fields: [
    {
      name: 'ideationModel',
      type: 'text',
      defaultValue: 'anthropic/claude-sonnet-4',
      admin: {
        description: 'OpenRouter model identifier for ideation and filtering',
      },
    },
    {
      name: 'researchModel',
      type: 'text',
      defaultValue: 'anthropic/claude-sonnet-4',
      admin: {
        description: 'OpenRouter model identifier for research synthesis',
      },
    },
    {
      name: 'draftingModel',
      type: 'text',
      defaultValue: 'anthropic/claude-sonnet-4',
      admin: {
        description: 'OpenRouter model identifier for content drafting',
      },
    },
    {
      name: 'editingModel',
      type: 'text',
      defaultValue: 'anthropic/claude-sonnet-4',
      admin: {
        description: 'OpenRouter model identifier for conversation editing',
      },
    },
    {
      name: 'imageModel',
      type: 'text',
      defaultValue: 'anthropic/claude-sonnet-4',
      admin: {
        description: 'OpenRouter model identifier for image prompt generation',
      },
    },
    {
      name: 'embeddingModel',
      type: 'text',
      defaultValue: 'openai/text-embedding-3-large',
      admin: {
        description: 'Model for generating embeddings (3072 dimensions)',
      },
    },
    {
      name: 'defaultImagePromptPrefix',
      type: 'textarea',
      admin: {
        description: 'Default prefix prepended to all image generation prompts',
      },
    },
    {
      name: 'consistencyCheckEnabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether consistency checking runs before publication',
      },
    },
    {
      name: 'autoPopulateRelationships',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether cascade auto-populates bidirectional relationships',
      },
    },
  ],
}
