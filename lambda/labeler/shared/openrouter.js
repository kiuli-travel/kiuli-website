/**
 * OpenRouter API Client for V6 Pipeline
 *
 * This is the CANONICAL version - all Lambda functions should use this.
 * Run sync-shared.sh to copy to Lambda-specific shared/ directories.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 3000;

/**
 * JSON Schema for image enrichment - GPT-4o structured outputs
 * This guarantees valid JSON responses
 */
const IMAGE_ENRICHMENT_SCHEMA = {
  type: 'object',
  properties: {
    scene: {
      type: 'string',
      description: 'Vivid 5-15 word description of what is shown'
    },
    mood: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['serene', 'adventurous', 'romantic', 'dramatic', 'intimate', 'luxurious', 'wild', 'peaceful']
      },
      description: '1-3 applicable moods'
    },
    timeOfDay: {
      type: 'string',
      enum: ['dawn', 'morning', 'midday', 'afternoon', 'golden-hour', 'dusk', 'night'],
      description: 'Time of day visible in image (best estimate from lighting)'
    },
    setting: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['lodge-interior', 'lodge-exterior', 'pool-deck', 'bedroom', 'dining', 'savanna', 'river-water', 'forest', 'mountain', 'bush-dinner', 'game-drive', 'walking-safari', 'aerial', 'spa']
      },
      description: '1-3 applicable settings'
    },
    composition: {
      type: 'string',
      enum: ['hero', 'establishing', 'detail', 'portrait', 'action', 'panoramic'],
      description: 'Composition style'
    },
    animals: {
      type: 'array',
      items: { type: 'string' },
      description: 'Specific animals visible, empty array if none'
    },
    altText: {
      type: 'string',
      description: 'SEO-optimized accessibility description, 15-25 words'
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: '8-12 searchable keywords'
    },
    suitableFor: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['hero-banner', 'article-feature', 'gallery', 'thumbnail', 'social', 'print']
      },
      description: 'Recommended usage contexts'
    },
    quality: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'Image quality assessment'
    },
    imageType: {
      type: 'string',
      enum: ['wildlife', 'landscape', 'accommodation', 'activity', 'people', 'food', 'aerial', 'detail'],
      description: 'Primary image category'
    }
  },
  required: ['scene', 'mood', 'timeOfDay', 'setting', 'composition', 'animals', 'altText', 'tags', 'suitableFor', 'quality', 'imageType'],
  additionalProperties: false
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callOpenRouter(payload, retries = MAX_RETRIES) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://kiuli.com',
          'X-Title': 'Kiuli Pipeline V6'
        },
        body: JSON.stringify(payload)
      });

      // Rate limited
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '0', 10);
        const delay = Math.max(retryAfter * 1000, BASE_DELAY_MS * Math.pow(2, attempt - 1));
        console.log(`[OpenRouter] Rate limited, waiting ${delay}ms (attempt ${attempt}/${retries})`);
        await sleep(delay);
        continue;
      }

      // Other errors
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';

    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      console.log(`[OpenRouter] Error, retrying: ${error.message}`);
      await sleep(BASE_DELAY_MS * attempt);
    }
  }

  throw new Error('OpenRouter: max retries exceeded');
}

/**
 * Text completion using Llama 3.3 70B
 */
async function completeText(prompt) {
  return callOpenRouter({
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    messages: [
      { role: 'user', content: prompt }
    ],
    max_tokens: 2000
  });
}

/**
 * Analyze image with GPT-4o using structured outputs and context
 * @param {string} imageBase64 - Base64 encoded image
 * @param {object} context - Ground truth context from scrape
 * @param {string} context.propertyName - Property/lodge name
 * @param {string} context.country - Country
 * @param {string} context.segmentType - stay/activity/transfer
 * @param {number} context.dayIndex - Day in itinerary
 * @returns {object} Enrichment data with guaranteed schema compliance
 */
async function analyzeImageWithContext(imageBase64, context = {}) {
  const prompt = buildEnrichmentPrompt(context);

  const response = await callOpenRouter({
    model: 'openai/gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an image analyst for Kiuli, a luxury African safari travel company. Analyze images to generate rich, searchable metadata for Travel Designers.'
      },
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'image_enrichment',
        strict: true,
        schema: IMAGE_ENRICHMENT_SCHEMA
      }
    },
    max_tokens: 800
  });

  // With structured outputs, response is guaranteed valid JSON
  return JSON.parse(response);
}

/**
 * Build context-aware enrichment prompt
 */
function buildEnrichmentPrompt(context) {
  const contextLines = [];

  if (context.propertyName) {
    contextLines.push(`Property: ${context.propertyName}`);
  }
  if (context.country) {
    contextLines.push(`Country: ${context.country}`);
  }
  if (context.segmentType) {
    contextLines.push(`Segment Type: ${context.segmentType}`);
  }
  if (context.dayIndex) {
    contextLines.push(`Day: ${context.dayIndex}`);
  }

  const contextSection = contextLines.length > 0
    ? `\nGROUND TRUTH (from booking system - accurate):\n${contextLines.join('\n')}\n`
    : '';

  return `${contextSection}
Analyze this safari/travel image and provide enrichment metadata.

Your response must include:
1. scene: Vivid 5-15 word description (e.g., "infinity pool overlooking golden savanna at sunset")
2. mood: 1-3 moods from the allowed list
3. timeOfDay: Best estimate from visual cues
4. setting: 1-3 settings from the allowed list
5. composition: How this image is composed/could be used
6. animals: Array of specific animals visible (empty if none)
7. altText: SEO-friendly accessibility text, 15-25 words. Include property name if known.
8. tags: 8-12 searchable keywords including property, country, and visual elements
9. suitableFor: Where this image works best
10. quality: Assess sharpness, lighting, composition
11. imageType: Primary category

${context.propertyName ? `Include "${context.propertyName}" in altText and tags.` : ''}
${context.country ? `Include "${context.country}" in tags.` : ''}`;
}

/**
 * Vision analysis using Nemotron 12B
 * @deprecated Use analyzeImageWithContext() instead
 */
async function analyzeImage(imageBase64, prompt) {
  console.warn('[DEPRECATED] analyzeImage() - use analyzeImageWithContext() instead');
  return callOpenRouter({
    model: 'nvidia/nemotron-nano-12b-v2-vl:free',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`
            }
          },
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ],
    max_tokens: 500
  });
}

module.exports = {
  callOpenRouter,
  completeText,
  analyzeImage,  // deprecated, kept for compatibility
  analyzeImageWithContext,  // NEW - use this
  IMAGE_ENRICHMENT_SCHEMA,  // exported for reference
};
