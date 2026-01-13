/**
 * AI Image Labeling using OpenRouter Vision
 */

const { analyzeImage } = require('./shared/openrouter');

const LABELING_PROMPT = `Analyze this safari/travel image. Return ONLY valid JSON with no markdown or explanation.

Required fields:
- location: Specific place if recognizable, otherwise describe landscape (e.g., "savanna plains", "Mara River crossing", "lodge interior"). Never say "Unknown" if you can describe what you see.
- country: Best guess from Tanzania, Kenya, Botswana, Rwanda, South Africa, Zimbabwe, Zambia, Namibia, Uganda. Use landscape clues. If truly impossible to determine, use "Tanzania" as default (most common safari destination).
- imageType: One of: wildlife, landscape, accommodation, activity, people, food, aerial, detail
- animals: Array of specific animals visible (e.g., ["African elephant", "zebra", "wildebeest"]). Empty array if no animals.
- tags: 5-8 searchable keywords describing the image
- altText: Accessibility description, 15-25 words, describe what a blind person would want to know
- isHero: true if this is a dramatic, high-quality image suitable for a page banner/hero
- quality: "high" (sharp, well-composed, dramatic), "medium" (acceptable), "low" (blurry, poorly composed)

Example response:
{"location":"Masai Mara savanna","country":"Kenya","imageType":"wildlife","animals":["lion","lioness"],"tags":["safari","lion","pride","wildlife","Kenya","Masai Mara","predator","big cat"],"altText":"A male lion and lioness resting together in golden savanna grass during afternoon light","isHero":true,"quality":"high"}

Return ONLY the JSON object:`;

/**
 * Label an image by URL
 */
async function labelImage(imageUrl) {
  try {
    // Download image and convert to base64
    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');

    // Call OpenRouter Vision API
    const result = await analyzeImage(base64, LABELING_PROMPT);

    // Parse JSON from response
    let jsonStr = result.trim();

    // Remove any markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

    // Find JSON object in response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const labels = JSON.parse(jsonStr);

    return {
      location: labels.location || 'African landscape',
      country: normalizeCountry(labels.country),
      imageType: normalizeImageType(labels.imageType),
      animals: Array.isArray(labels.animals) ? labels.animals : [],
      tags: Array.isArray(labels.tags) ? labels.tags : ['safari', 'travel', 'africa'],
      altText: labels.altText || 'Safari travel image',
      isHero: Boolean(labels.isHero),
      quality: normalizeQuality(labels.quality)
    };

  } catch (error) {
    console.error('[LabelImage] Failed:', error.message);
    return getDefaultLabels();
  }
}

function normalizeCountry(country) {
  const valid = ['Tanzania', 'Kenya', 'Botswana', 'Rwanda', 'South Africa',
                 'Zimbabwe', 'Zambia', 'Namibia', 'Uganda'];
  if (!country) return 'Tanzania';
  const match = valid.find(c => c.toLowerCase() === country.toLowerCase());
  return match || 'Tanzania';
}

function normalizeImageType(type) {
  const valid = ['wildlife', 'landscape', 'accommodation', 'activity',
                 'people', 'food', 'aerial', 'detail'];
  if (!type) return 'landscape';
  const match = valid.find(t => t.toLowerCase() === type.toLowerCase());
  return match || 'landscape';
}

function normalizeQuality(quality) {
  const valid = ['high', 'medium', 'low'];
  if (!quality) return 'medium';
  const match = valid.find(q => q.toLowerCase() === quality.toLowerCase());
  return match || 'medium';
}

function getDefaultLabels() {
  return {
    location: 'African safari landscape',
    country: 'Tanzania',
    imageType: 'landscape',
    animals: [],
    tags: ['safari', 'travel', 'africa', 'wildlife', 'adventure'],
    altText: 'African safari landscape image',
    isHero: false,
    quality: 'medium'
  };
}

module.exports = { labelImage, getDefaultLabels };
