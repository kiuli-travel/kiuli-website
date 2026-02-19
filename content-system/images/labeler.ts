import { getPayload } from 'payload'
import configPromise from '@payload-config'

/**
 * IMAGE_ENRICHMENT_SCHEMA — identical to lambda/labeler/shared/openrouter.js
 * Uses GPT-4o structured outputs for guaranteed valid JSON.
 */
const IMAGE_ENRICHMENT_SCHEMA = {
  type: 'object' as const,
  properties: {
    scene: {
      type: 'string' as const,
      description: 'Vivid 5-15 word description of what is shown',
    },
    mood: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
        enum: ['serene', 'adventurous', 'romantic', 'dramatic', 'intimate', 'luxurious', 'wild', 'peaceful'],
      },
      description: '1-3 applicable moods',
    },
    timeOfDay: {
      type: 'string' as const,
      enum: ['dawn', 'morning', 'midday', 'afternoon', 'golden-hour', 'dusk', 'night'],
      description: 'Time of day visible in image',
    },
    setting: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
        enum: ['lodge-interior', 'lodge-exterior', 'pool-deck', 'bedroom', 'dining', 'savanna', 'river-water', 'forest', 'mountain', 'bush-dinner', 'game-drive', 'walking-safari', 'aerial', 'spa'],
      },
      description: '1-3 applicable settings',
    },
    composition: {
      type: 'string' as const,
      enum: ['hero', 'establishing', 'detail', 'portrait', 'action', 'panoramic'],
      description: 'Composition style',
    },
    animals: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Specific animals visible, empty array if none',
    },
    altText: {
      type: 'string' as const,
      description: 'SEO-optimized accessibility description, 15-25 words',
    },
    tags: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: '8-12 searchable keywords',
    },
    suitableFor: {
      type: 'array' as const,
      items: {
        type: 'string' as const,
        enum: ['hero-banner', 'article-feature', 'gallery', 'thumbnail', 'social', 'print'],
      },
      description: 'Recommended usage contexts',
    },
    quality: {
      type: 'string' as const,
      enum: ['high', 'medium', 'low'],
      description: 'Image quality assessment',
    },
    imageType: {
      type: 'string' as const,
      enum: ['wildlife', 'landscape', 'accommodation', 'activity', 'people', 'food', 'aerial', 'detail'],
      description: 'Primary image category',
    },
  },
  required: ['scene', 'mood', 'timeOfDay', 'setting', 'composition', 'animals', 'altText', 'tags', 'suitableFor', 'quality', 'imageType'] as const,
  additionalProperties: false as const,
}

function buildEnrichmentPrompt(context: {
  country?: string
  destination?: string
  species?: string[]
}): string {
  const contextLines: string[] = []
  if (context.country) contextLines.push(`Country: ${context.country}`)
  if (context.destination) contextLines.push(`Destination: ${context.destination}`)
  if (context.species?.length) contextLines.push(`Species: ${context.species.join(', ')}`)

  const contextSection = contextLines.length > 0
    ? `\nCONTEXT (known information about this image):\n${contextLines.join('\n')}\n`
    : ''

  return `${contextSection}
Analyze this image and provide enrichment metadata.

Your response must include:
1. scene: Vivid 5-15 word description
2. mood: 1-3 moods from the allowed list
3. timeOfDay: Best estimate from visual cues
4. setting: 1-3 settings from the allowed list
5. composition: How this image is composed/could be used
6. animals: Array of specific animals visible (empty if none)
7. altText: SEO-friendly accessibility text, 15-25 words
8. tags: 8-12 searchable keywords
9. suitableFor: Where this image works best
10. quality: Assess sharpness, lighting, composition
11. imageType: Primary category

${context.country ? `Include "${context.country}" in tags.` : ''}
${context.species?.length ? `Include species names in tags.` : ''}`
}

/**
 * Label a Media record using GPT-4o via OpenRouter.
 * Uses the same enrichment schema and prompt pattern as the Lambda labeler.
 */
export async function labelMediaRecord(
  mediaId: number,
  context?: {
    country?: string
    destination?: string
    species?: string[]
  },
): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set')
  }

  // Fetch the media record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const media = await payload.findByID({ collection: 'media', id: mediaId, depth: 0 }) as any

  // Get image URL — prefer imgix for CDN serving
  const imageUrl = media.imgixUrl || media.url
  if (!imageUrl) {
    throw new Error(`No URL for media ${mediaId}`)
  }

  // Fetch image and convert to base64
  const fullUrl = imageUrl.startsWith('http')
    ? imageUrl
    : `${process.env.NEXT_PUBLIC_SERVER_URL || 'https://admin.kiuli.com'}${imageUrl}`

  const imageResponse = await fetch(fullUrl)
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image for labeling: ${imageResponse.status}`)
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer())

  // Resize for AI — 1200x800 max, quality 75
  let base64: string
  try {
    const sharp = (await import('sharp')).default
    const metadata = await sharp(imageBuffer).metadata()
    const needsResize = (metadata.width && metadata.width > 1200) ||
      (metadata.height && metadata.height > 800) ||
      imageBuffer.length > 10 * 1024 * 1024

    if (needsResize) {
      const resized = await sharp(imageBuffer)
        .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer()
      base64 = resized.toString('base64')
    } else {
      base64 = imageBuffer.toString('base64')
    }
  } catch {
    base64 = imageBuffer.toString('base64')
  }

  // Call GPT-4o with structured outputs
  const prompt = buildEnrichmentPrompt(context || {})

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kiuli.com',
      'X-Title': 'Kiuli Content Engine',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an image analyst for Kiuli, a luxury African safari travel company. Analyze images to generate rich, searchable metadata.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` },
            },
            {
              type: 'text',
              text: prompt,
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'image_enrichment',
          strict: true,
          schema: IMAGE_ENRICHMENT_SCHEMA,
        },
      },
      max_tokens: 800,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter labeling error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('No content in labeling response')
  }

  const enrichment = JSON.parse(content)

  // Update media record with enrichment
  await payload.update({
    collection: 'media',
    id: mediaId,
    data: {
      scene: enrichment.scene,
      mood: enrichment.mood || [],
      timeOfDay: enrichment.timeOfDay,
      setting: enrichment.setting || [],
      composition: enrichment.composition,
      suitableFor: enrichment.suitableFor || [],
      animals: enrichment.animals || [],
      tags: enrichment.tags || [],
      alt: enrichment.altText,
      altText: enrichment.altText,
      quality: enrichment.quality,
      imageType: enrichment.imageType,
      isHero: enrichment.composition === 'hero' && enrichment.quality === 'high',
      labelingStatus: 'complete',
      // labeledAt not in schema — omit
    },
  })
}
