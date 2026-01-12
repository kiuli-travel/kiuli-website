/**
 * AI Image Labeling using OpenRouter Vision
 */

const { analyzeImage } = require('../services/openrouter');

const LABELING_PROMPT = `Analyze this safari/travel image. Respond with ONLY valid JSON, no explanation:

{
  "location": "Specific place name or region",
  "country": "Tanzania|Kenya|Botswana|Rwanda|South Africa|Zimbabwe|Zambia|Namibia|Uganda|Unknown",
  "imageType": "wildlife|landscape|accommodation|activity|people|food|aerial|detail",
  "animals": ["list", "of", "animals", "or empty array"],
  "tags": ["5-8", "searchable", "keywords"],
  "altText": "Descriptive alt text for accessibility, 10-20 words",
  "isHero": true or false,
  "quality": "high|medium|low"
}`;

async function labelImage(imageBuffer) {
  try {
    const base64 = imageBuffer.toString('base64');
    const response = await analyzeImage(base64, LABELING_PROMPT);

    // Parse JSON from response
    let jsonStr = response;
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const labels = JSON.parse(jsonStr);

    return {
      location: labels.location || 'Unknown',
      country: normalizeCountry(labels.country),
      imageType: normalizeImageType(labels.imageType),
      animals: Array.isArray(labels.animals) ? labels.animals : [],
      tags: Array.isArray(labels.tags) ? labels.tags : ['safari', 'travel'],
      altText: labels.altText || 'Safari travel image',
      isHero: Boolean(labels.isHero),
      quality: normalizeQuality(labels.quality)
    };

  } catch (error) {
    console.error('[ImageLabeler] Failed:', error.message);
    return getDefaultLabels();
  }
}

function normalizeCountry(country) {
  const valid = ['Tanzania', 'Kenya', 'Botswana', 'Rwanda', 'South Africa',
                 'Zimbabwe', 'Zambia', 'Namibia', 'Uganda'];
  if (!country) return 'Unknown';
  const match = valid.find(c => c.toLowerCase() === country.toLowerCase());
  return match || 'Unknown';
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
    location: 'Unknown',
    country: 'Unknown',
    imageType: 'landscape',
    animals: [],
    tags: ['safari', 'travel', 'africa'],
    altText: 'Safari travel image',
    isHero: false,
    quality: 'medium'
  };
}

module.exports = { labelImage, getDefaultLabels };
