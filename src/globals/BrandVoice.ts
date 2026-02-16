import type { GlobalConfig } from 'payload'
import { authenticated } from '../access/authenticated'

export const BrandVoice: GlobalConfig = {
  slug: 'brand-voice',
  admin: {
    group: 'Configuration',
    description: 'The Kiuli Way — voice, principles, and content guidance that shapes all content production',
  },
  access: {
    read: () => true,
    update: authenticated,
  },
  fields: [
    // ── Layer 1: Core Identity ───────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Layer 1: Core Identity',
      admin: {
        description: 'Who Kiuli is as a writer. Loaded into every LLM call that produces content.',
        initCollapsed: false,
      },
      fields: [
        {
          name: 'voiceSummary',
          type: 'textarea',
          admin: {
            description: 'Who Kiuli is as a writer — 2-3 sentences that anchor every piece of content',
            rows: 4,
          },
        },
        {
          name: 'principles',
          type: 'array',
          admin: {
            description: 'Core voice principles that apply to all Kiuli content',
          },
          fields: [
            {
              name: 'principle',
              type: 'text',
              required: true,
              admin: {
                description: 'The principle name, e.g. "Specificity over generality"',
              },
            },
            {
              name: 'explanation',
              type: 'textarea',
              required: true,
              admin: {
                description: 'What this principle means in practice',
                rows: 3,
              },
            },
            {
              name: 'example',
              type: 'textarea',
              admin: {
                description: 'Optional concrete example of the principle in action',
                rows: 3,
              },
            },
          ],
        },
        {
          name: 'audience',
          type: 'textarea',
          admin: {
            description: 'Who we are writing for — their expectations, sophistication level, what they respond to',
            rows: 4,
          },
        },
        {
          name: 'positioning',
          type: 'textarea',
          admin: {
            description: 'How Kiuli differentiates from competitors — what we can say that they cannot',
            rows: 4,
          },
        },
        {
          name: 'bannedPhrases',
          type: 'array',
          admin: {
            description: 'Words and phrases that must never appear in Kiuli content',
          },
          fields: [
            {
              name: 'phrase',
              type: 'text',
              required: true,
              admin: {
                description: 'The banned word or phrase',
              },
            },
            {
              name: 'reason',
              type: 'text',
              required: true,
              admin: {
                description: 'Why this should be avoided',
              },
            },
            {
              name: 'alternative',
              type: 'text',
              admin: {
                description: 'What to use instead (optional)',
              },
            },
          ],
        },
        {
          name: 'antiPatterns',
          type: 'array',
          admin: {
            description: 'Writing patterns to avoid — broader than single phrases',
          },
          fields: [
            {
              name: 'pattern',
              type: 'text',
              required: true,
              admin: {
                description: 'The pattern to avoid, e.g. "Opening with a question"',
              },
            },
            {
              name: 'explanation',
              type: 'textarea',
              required: true,
              admin: {
                description: 'Why this pattern is problematic',
                rows: 2,
              },
            },
          ],
        },
        {
          name: 'goldStandard',
          type: 'array',
          admin: {
            description: 'Exemplary Kiuli writing — excerpts that define "what good looks like". Grows over time.',
          },
          fields: [
            {
              name: 'excerpt',
              type: 'textarea',
              required: true,
              admin: {
                description: 'The actual text that exemplifies great Kiuli writing',
                rows: 5,
              },
            },
            {
              name: 'contentType',
              type: 'select',
              defaultValue: 'general',
              options: [
                { label: 'General', value: 'general' },
                { label: 'Article', value: 'article' },
                { label: 'Destination Page', value: 'destination_page' },
                { label: 'Property Page', value: 'property_page' },
                { label: 'Itinerary Enhancement', value: 'itinerary_enhancement' },
              ],
              admin: {
                description: 'Which content type this example best represents',
              },
            },
            {
              name: 'context',
              type: 'text',
              admin: {
                description: 'Where this came from and why it is good',
              },
            },
            {
              name: 'addedAt',
              type: 'date',
              admin: {
                date: { pickerAppearance: 'dayOnly' },
                description: 'When this was added',
              },
            },
          ],
        },
      ],
    },

    // ── Layer 2: Content Type Objectives ──────────────────────────────────
    {
      type: 'collapsible',
      label: 'Layer 2: Content Type Objectives',
      admin: {
        description: 'How Kiuli\'s voice adapts for different content types. Loaded alongside core identity when producing content.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'contentTypeGuidance',
          type: 'array',
          admin: {
            description: 'Per-content-type voice guidance — objective, tone, structure, temperature',
          },
          fields: [
            {
              name: 'contentType',
              type: 'select',
              required: true,
              options: [
                { label: 'Itinerary Cluster (Article)', value: 'itinerary_cluster' },
                { label: 'Authority Article', value: 'authority' },
                { label: 'Designer Insight', value: 'designer_insight' },
                { label: 'Destination Page', value: 'destination_page' },
                { label: 'Property Page', value: 'property_page' },
                { label: 'Itinerary Enhancement', value: 'itinerary_enhancement' },
              ],
              admin: {
                description: 'Which content type this guidance applies to',
              },
            },
            {
              name: 'label',
              type: 'text',
              required: true,
              admin: {
                description: 'Human-readable name, e.g. "Destination Page"',
              },
            },
            {
              name: 'objective',
              type: 'textarea',
              required: true,
              admin: {
                description: 'What this content type exists to achieve — its job in the funnel',
                rows: 4,
              },
            },
            {
              name: 'toneShift',
              type: 'textarea',
              admin: {
                description: 'How tone shifts for this type relative to core voice',
                rows: 3,
              },
            },
            {
              name: 'structuralNotes',
              type: 'textarea',
              admin: {
                description: 'Structural expectations — length, sections, pacing',
                rows: 3,
              },
            },
            {
              name: 'temperature',
              type: 'number',
              min: 0,
              max: 1,
              defaultValue: 0.6,
              admin: {
                description: 'LLM temperature for this content type (0 = conservative, 1 = creative)',
                step: 0.1,
              },
            },
          ],
        },
      ],
    },

    // ── Layer 3: Section Guidance ─────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Layer 3: Section Guidance',
      admin: {
        description: 'Section-level guidance for compound types and scraper enhancement. Replaces the voice-configuration collection.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'sectionGuidance',
          type: 'array',
          admin: {
            description: 'Section-specific objectives, tone, word counts, do/don\'t lists, examples, and prompt templates',
          },
          fields: [
            {
              name: 'contentType',
              type: 'select',
              required: true,
              options: [
                { label: 'Destination Page', value: 'destination_page' },
                { label: 'Property Page', value: 'property_page' },
                { label: 'Itinerary Enhancement', value: 'itinerary_enhancement' },
              ],
              admin: {
                description: 'Which content type this section belongs to',
              },
            },
            {
              name: 'sectionKey',
              type: 'text',
              required: true,
              admin: {
                description: 'Machine key: overview, when_to_visit, segment_description, faq_answer, etc.',
              },
            },
            {
              name: 'sectionLabel',
              type: 'text',
              required: true,
              admin: {
                description: 'Human-readable label: Overview, When to Visit, etc.',
              },
            },
            {
              name: 'objective',
              type: 'textarea',
              required: true,
              admin: {
                description: 'What this section must achieve',
                rows: 3,
              },
            },
            {
              name: 'toneNotes',
              type: 'textarea',
              admin: {
                description: 'Section-specific tone shifts',
                rows: 2,
              },
            },
            {
              name: 'wordCountRange',
              type: 'text',
              admin: {
                description: 'Target word count range, e.g. "150-200"',
              },
            },
            {
              name: 'doList',
              type: 'array',
              admin: {
                description: 'Things to do when writing this section',
              },
              fields: [
                {
                  name: 'item',
                  type: 'text',
                  required: true,
                },
              ],
            },
            {
              name: 'dontList',
              type: 'array',
              admin: {
                description: 'Things to avoid when writing this section',
              },
              fields: [
                {
                  name: 'item',
                  type: 'text',
                  required: true,
                },
              ],
            },
            {
              name: 'examples',
              type: 'array',
              admin: {
                description: 'Before/after pairs showing the transformation this section should achieve',
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
              name: 'promptTemplate',
              type: 'textarea',
              admin: {
                description: 'User prompt template with {{content}}, {{context}} etc. placeholders. Used by scraper enhance and section drafters.',
                rows: 8,
              },
            },
          ],
        },
      ],
    },

    // ── Layer 4: Evolution Log ────────────────────────────────────────────
    {
      type: 'collapsible',
      label: 'Layer 4: Evolution Log',
      admin: {
        description: 'How the Kiuli voice has evolved over time. Written by conversation handler and manual edits.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'evolutionLog',
          type: 'array',
          admin: {
            description: 'Chronological record of voice changes',
          },
          fields: [
            {
              name: 'date',
              type: 'date',
              required: true,
              admin: {
                date: { pickerAppearance: 'dayOnly' },
              },
            },
            {
              name: 'change',
              type: 'textarea',
              required: true,
              admin: {
                description: 'What was changed',
                rows: 2,
              },
            },
            {
              name: 'reason',
              type: 'textarea',
              required: true,
              admin: {
                description: 'Why it was changed',
                rows: 2,
              },
            },
            {
              name: 'source',
              type: 'select',
              required: true,
              options: [
                { label: 'Designer Conversation', value: 'designer_conversation' },
                { label: 'Direct Edit', value: 'direct_edit' },
                { label: 'Performance Insight', value: 'performance_insight' },
                { label: 'Initial Setup', value: 'initial_setup' },
              ],
              admin: {
                description: 'How this change originated',
              },
            },
          ],
        },
      ],
    },
  ],
}
