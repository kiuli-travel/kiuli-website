/**
 * Test GPT-4o enrichment on a single image
 * Usage: OPENROUTER_API_KEY=xxx MEDIA_ID=xxx node test-single-enrichment.js
 */

const PAYLOAD_API = 'https://admin.kiuli.com/api';
const PAYLOAD_KEY = 'cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=';
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const MEDIA_ID = process.env.MEDIA_ID;

if (!OPENROUTER_KEY) {
  console.error('ERROR: Set OPENROUTER_API_KEY environment variable');
  process.exit(1);
}

if (!MEDIA_ID) {
  console.error('ERROR: Set MEDIA_ID environment variable');
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

async function main() {
  console.log(`\n=== Testing GPT-4o Enrichment on Media ${MEDIA_ID} ===\n`);

  // 1. Fetch media document
  console.log('1. Fetching media document...');
  const mediaRes = await fetch(`${PAYLOAD_API}/media/${MEDIA_ID}`, {
    headers: { 'Authorization': `Bearer ${PAYLOAD_KEY}` }
  });
  const media = await mediaRes.json();

  if (!media.id) {
    console.error('Failed to fetch media:', media);
    process.exit(1);
  }

  const imageUrl = media.imgixUrl || media.url;
  console.log(`   Filename: ${media.filename}`);
  console.log(`   URL: ${imageUrl}`);

  // 2. Fetch image and convert to base64
  console.log('\n2. Fetching image...');
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    console.error(`Failed to fetch image: ${imgRes.status}`);
    process.exit(1);
  }
  const imgBuffer = await imgRes.arrayBuffer();
  const base64 = Buffer.from(imgBuffer).toString('base64');
  console.log(`   Size: ${Math.round(base64.length / 1024)} KB (base64)`);

  // 3. Call GPT-4o with structured outputs
  console.log('\n3. Calling GPT-4o...');
  const startTime = Date.now();

  const gptRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an image analyst for Kiuli, a luxury African safari travel company.'
        },
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
        json_schema: {
          name: 'image_enrichment',
          strict: true,
          schema: IMAGE_ENRICHMENT_SCHEMA
        }
      },
      max_tokens: 800
    })
  });

  const gptData = await gptRes.json();
  const elapsed = Date.now() - startTime;
  console.log(`   Response time: ${elapsed}ms`);

  if (gptData.error) {
    console.error('\nGPT-4o ERROR:', gptData.error);
    process.exit(1);
  }

  // 4. Parse response
  console.log('\n4. Parsing response...');
  let enrichment;
  try {
    const content = gptData.choices[0].message.content;
    enrichment = JSON.parse(content);
    console.log('   JSON parse: SUCCESS');
  } catch (e) {
    console.error('   JSON parse: FAILED', e.message);
    console.error('   Raw content:', gptData.choices?.[0]?.message?.content);
    process.exit(1);
  }

  // 5. Display results
  console.log('\n=== ENRICHMENT RESULTS ===\n');
  console.log(`scene: ${enrichment.scene}`);
  console.log(`mood: [${enrichment.mood.join(', ')}]`);
  console.log(`timeOfDay: ${enrichment.timeOfDay}`);
  console.log(`setting: [${enrichment.setting.join(', ')}]`);
  console.log(`composition: ${enrichment.composition}`);
  console.log(`animals: [${enrichment.animals.join(', ')}]`);
  console.log(`altText: ${enrichment.altText}`);
  console.log(`tags: [${enrichment.tags.join(', ')}]`);
  console.log(`suitableFor: [${enrichment.suitableFor.join(', ')}]`);
  console.log(`quality: ${enrichment.quality}`);
  console.log(`imageType: ${enrichment.imageType}`);

  // 6. Update media document
  console.log('\n5. Updating media document...');
  const updateRes = await fetch(`${PAYLOAD_API}/media/${MEDIA_ID}`, {
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

  const updateData = await updateRes.json();
  if (updateData.errors) {
    console.error('   Update FAILED:', updateData.errors);
    process.exit(1);
  }

  console.log('   Update: SUCCESS');
  console.log(`\n=== TEST COMPLETE ===`);
  console.log(`Cost: ~$0.01`);
  console.log(`Time: ${elapsed}ms`);
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
