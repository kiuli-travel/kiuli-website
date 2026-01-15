/**
 * Standalone GPT-4o Image Enrichment Script
 * Runs directly against Media documents without requiring jobs
 */

const PAYLOAD_API = 'https://admin.kiuli.com/api';
const API_KEY = 'cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const BATCH_SIZE = 5;  // Process 5 at a time
const DELAY_MS = 2000; // 2 seconds between batches

/**
 * JSON Schema for image enrichment - GPT-4o structured outputs
 */
const IMAGE_ENRICHMENT_SCHEMA = {
  type: 'object',
  properties: {
    scene: { type: 'string', description: 'Vivid 5-15 word description of what is shown' },
    mood: {
      type: 'array',
      items: { type: 'string', enum: ['serene', 'adventurous', 'romantic', 'dramatic', 'intimate', 'luxurious', 'wild', 'peaceful'] },
      description: '1-3 applicable moods'
    },
    timeOfDay: {
      type: 'string',
      enum: ['dawn', 'morning', 'midday', 'afternoon', 'golden-hour', 'dusk', 'night', 'unknown'],
      description: 'Time of day visible in image'
    },
    setting: {
      type: 'array',
      items: { type: 'string', enum: ['lodge-interior', 'lodge-exterior', 'pool-deck', 'bedroom', 'dining', 'savanna', 'river-water', 'forest', 'mountain', 'bush-dinner', 'game-drive', 'walking-safari', 'aerial', 'spa', 'other'] },
      description: '1-3 applicable settings'
    },
    composition: {
      type: 'string',
      enum: ['hero', 'establishing', 'detail', 'portrait', 'action', 'panoramic'],
      description: 'Composition style'
    },
    animals: { type: 'array', items: { type: 'string' }, description: 'Specific animals visible, empty array if none' },
    altText: { type: 'string', description: 'SEO-optimized accessibility description, 15-25 words' },
    tags: { type: 'array', items: { type: 'string' }, description: '8-12 searchable keywords' },
    suitableFor: {
      type: 'array',
      items: { type: 'string', enum: ['hero-banner', 'article-feature', 'gallery', 'thumbnail', 'social', 'print'] },
      description: 'Recommended usage contexts'
    },
    quality: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Image quality assessment' },
    imageType: {
      type: 'string',
      enum: ['wildlife', 'landscape', 'property', 'room', 'dining', 'activity', 'people', 'aerial', 'detail', 'other'],
      description: 'Primary image category'
    }
  },
  required: ['scene', 'mood', 'timeOfDay', 'setting', 'composition', 'animals', 'altText', 'tags', 'suitableFor', 'quality', 'imageType'],
  additionalProperties: false
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPendingMedia() {
  const res = await fetch(`${PAYLOAD_API}/media?limit=${BATCH_SIZE}&where[labelingStatus][equals]=pending`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });
  return res.json();
}

async function patchMedia(id, data) {
  const res = await fetch(`${PAYLOAD_API}/media/${id}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return res.json();
}

async function analyzeImage(imageUrl, context = {}) {
  // Fetch image and convert to base64
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    throw new Error(`Failed to fetch image: ${imageRes.status}`);
  }
  const buffer = await imageRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  // Build prompt with context
  const contextLines = [];
  if (context.country) contextLines.push(`Country: ${context.country}`);

  const contextSection = contextLines.length > 0
    ? `\nGROUND TRUTH (accurate):\n${contextLines.join('\n')}\n`
    : '';

  const prompt = `${contextSection}
Analyze this safari/travel image and provide enrichment metadata.

Your response must include:
1. scene: Vivid 5-15 word description
2. mood: 1-3 moods from the allowed list
3. timeOfDay: Best estimate from visual cues
4. setting: 1-3 settings from the allowed list
5. composition: How this image is composed
6. animals: Array of specific animals visible (empty if none)
7. altText: SEO-friendly accessibility text, 15-25 words
8. tags: 8-12 searchable keywords
9. suitableFor: Where this image works best
10. quality: Assess sharpness, lighting, composition
11. imageType: Primary category

${context.country ? `Include "${context.country}" in tags.` : ''}`;

  // Call OpenRouter with GPT-4o
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://kiuli.com',
      'X-Title': 'Kiuli Enrichment Script'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an image analyst for Kiuli, a luxury African safari travel company. Analyze images to generate rich, searchable metadata for Travel Designers.'
        },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
            { type: 'text', text: prompt }
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
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  return JSON.parse(content);
}

async function processMedia(media) {
  const imageUrl = media.imgixUrl || media.url;
  if (!imageUrl) {
    return { success: false, error: 'No image URL' };
  }

  try {
    // Mark as processing
    await patchMedia(media.id, { labelingStatus: 'processing' });

    // Analyze with GPT-4o
    const context = { country: media.country };
    const enrichment = await analyzeImage(imageUrl, context);

    // Update media with enrichment
    await patchMedia(media.id, {
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
      labeledAt: new Date().toISOString(),
    });

    return { success: true, scene: enrichment.scene };

  } catch (error) {
    await patchMedia(media.id, {
      labelingStatus: 'failed',
      processingError: error.message
    });
    return { success: false, error: error.message };
  }
}

async function main() {
  if (!OPENROUTER_API_KEY) {
    console.error('ERROR: OPENROUTER_API_KEY environment variable not set');
    console.error('Run: export OPENROUTER_API_KEY=your_key_here');
    process.exit(1);
  }

  console.log('Starting GPT-4o Image Enrichment...\n');

  let totalProcessed = 0;
  let totalSuccess = 0;
  let totalFailed = 0;

  while (true) {
    const pending = await fetchPendingMedia();

    if (!pending.docs || pending.docs.length === 0) {
      console.log('\nNo more pending images.');
      break;
    }

    console.log(`\nProcessing batch of ${pending.docs.length} images...`);

    for (const media of pending.docs) {
      console.log(`  ${media.id}: ${media.filename?.slice(0, 40) || 'unnamed'}...`);

      const result = await processMedia(media);
      totalProcessed++;

      if (result.success) {
        totalSuccess++;
        console.log(`    ✓ ${result.scene?.slice(0, 50)}...`);
      } else {
        totalFailed++;
        console.log(`    ✗ ${result.error}`);
      }

      // Rate limit
      await sleep(500);
    }

    console.log(`Progress: ${totalSuccess} success, ${totalFailed} failed`);

    // Delay between batches
    await sleep(DELAY_MS);
  }

  console.log('\n=== ENRICHMENT COMPLETE ===');
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Success: ${totalSuccess}`);
  console.log(`Failed: ${totalFailed}`);
}

main().catch(console.error);
