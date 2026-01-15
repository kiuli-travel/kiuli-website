/**
 * Batch GPT-4o Image Enrichment
 * Processes all pending images with rate limiting and progress tracking
 */

const PAYLOAD_API = 'https://admin.kiuli.com/api';
const PAYLOAD_KEY = 'cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

const BATCH_SIZE = 5;        // Images per batch
const DELAY_BETWEEN = 2000;  // 2 seconds between images
const BATCH_DELAY = 5000;    // 5 seconds between batches

if (!OPENROUTER_KEY) {
  console.error('ERROR: Set OPENROUTER_API_KEY environment variable');
  process.exit(1);
}

const IMAGE_ENRICHMENT_SCHEMA = {
  type: 'object',
  properties: {
    scene: { type: 'string' },
    mood: { type: 'array', items: { type: 'string', enum: ['serene', 'adventurous', 'romantic', 'dramatic', 'intimate', 'luxurious', 'wild', 'peaceful'] } },
    timeOfDay: { type: 'string', enum: ['dawn', 'morning', 'midday', 'afternoon', 'golden-hour', 'dusk', 'night'] },
    setting: { type: 'array', items: { type: 'string', enum: ['lodge-interior', 'lodge-exterior', 'pool-deck', 'bedroom', 'dining', 'savanna', 'river-water', 'forest', 'mountain', 'bush-dinner', 'game-drive', 'walking-safari', 'aerial', 'spa'] } },
    composition: { type: 'string', enum: ['hero', 'establishing', 'detail', 'portrait', 'action', 'panoramic'] },
    animals: { type: 'array', items: { type: 'string' } },
    altText: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    suitableFor: { type: 'array', items: { type: 'string', enum: ['hero-banner', 'article-feature', 'gallery', 'thumbnail', 'social', 'print'] } },
    quality: { type: 'string', enum: ['high', 'medium', 'low'] },
    imageType: { type: 'string', enum: ['wildlife', 'landscape', 'accommodation', 'activity', 'people', 'food', 'aerial', 'detail'] }
  },
  required: ['scene', 'mood', 'timeOfDay', 'setting', 'composition', 'animals', 'altText', 'tags', 'suitableFor', 'quality', 'imageType'],
  additionalProperties: false
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enrichImage(media) {
  const imageUrl = media.imgixUrl || media.url;
  if (!imageUrl) {
    return { success: false, error: 'No image URL' };
  }

  try {
    // Fetch image
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error(`Fetch failed: ${imgRes.status}`);
    const imgBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(imgBuffer).toString('base64');

    // Call GPT-4o
    const gptRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          { role: 'system', content: 'You are an image analyst for Kiuli, a luxury African safari travel company.' },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
              { type: 'text', text: 'Analyze this safari/travel image. Provide scene description, mood, time of day, setting, composition style, any animals visible, alt text, searchable tags, suitable usage contexts, quality assessment, and image type.' }
            ]
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'image_enrichment', strict: true, schema: IMAGE_ENRICHMENT_SCHEMA }
        },
        max_tokens: 800
      })
    });

    const gptData = await gptRes.json();
    if (gptData.error) throw new Error(gptData.error.message || 'GPT error');

    const enrichment = JSON.parse(gptData.choices[0].message.content);

    // Update media
    const updateRes = await fetch(`${PAYLOAD_API}/media/${media.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${PAYLOAD_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        scene: enrichment.scene,
        mood: enrichment.mood,
        timeOfDay: enrichment.timeOfDay,
        setting: enrichment.setting,
        composition: enrichment.composition,
        suitableFor: enrichment.suitableFor,
        animals: enrichment.animals,
        tags: enrichment.tags,
        alt: enrichment.altText,
        altText: enrichment.altText,
        quality: enrichment.quality,
        imageType: enrichment.imageType,
        isHero: enrichment.composition === 'hero' && enrichment.quality === 'high',
        labelingStatus: 'complete',
        labeledAt: new Date().toISOString()
      })
    });

    if (!updateRes.ok) throw new Error(`Update failed: ${updateRes.status}`);

    return { success: true, scene: enrichment.scene.substring(0, 50) };

  } catch (error) {
    // Mark as failed
    await fetch(`${PAYLOAD_API}/media/${media.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${PAYLOAD_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        labelingStatus: 'failed',
        processingError: error.message
      })
    });

    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n=== GPT-4o Batch Enrichment ===\n');

  // Get all pending
  const res = await fetch(`${PAYLOAD_API}/media?limit=200&where[labelingStatus][equals]=pending`, {
    headers: { 'Authorization': `Bearer ${PAYLOAD_KEY}` }
  });
  const data = await res.json();
  const pending = data.docs || [];

  console.log(`Found ${pending.length} pending images\n`);

  if (pending.length === 0) {
    console.log('Nothing to process.');
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const startTime = Date.now();

  // Process in batches
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pending.length / BATCH_SIZE);

    console.log(`\n--- Batch ${batchNum}/${totalBatches} ---`);

    for (const media of batch) {
      const result = await enrichImage(media);
      processed++;

      if (result.success) {
        succeeded++;
        console.log(`✓ ${media.id}: ${result.scene}...`);
      } else {
        failed++;
        console.log(`✗ ${media.id}: ${result.error}`);
      }

      // Rate limit between images
      if (batch.indexOf(media) < batch.length - 1) {
        await sleep(DELAY_BETWEEN);
      }
    }

    // Progress update
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    const rate = processed / elapsed;
    const remaining = pending.length - processed;
    const eta = Math.round(remaining / rate);

    console.log(`\nProgress: ${processed}/${pending.length} (${succeeded} ok, ${failed} failed)`);
    console.log(`Elapsed: ${elapsed}s | ETA: ${eta}s`);

    // Delay between batches
    if (i + BATCH_SIZE < pending.length) {
      console.log(`Waiting ${BATCH_DELAY/1000}s before next batch...`);
      await sleep(BATCH_DELAY);
    }
  }

  // Final summary
  const totalTime = Math.round((Date.now() - startTime) / 1000);
  console.log('\n=== COMPLETE ===');
  console.log(`Total: ${processed} processed`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
  console.log(`Time: ${totalTime}s`);
  console.log(`Cost: ~$${(succeeded * 0.01).toFixed(2)}`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
