/**
 * AI Image Labeling using GPT-4o with Context-Aware Enrichment
 * V6 - Uses structured outputs for guaranteed JSON parsing
 */

const { analyzeImageWithContext } = require('./shared/openrouter');

/**
 * Label a single image using GPT-4o with context-aware enrichment
 *
 * @param {object} media - Payload Media document
 * @param {object} context - Ground truth context from scrape
 * @param {string} context.propertyName - Property/lodge name
 * @param {string} context.country - Country
 * @param {string} context.segmentType - stay/activity/transfer
 * @param {string} context.segmentTitle - Segment title
 * @param {number} context.dayIndex - Day in itinerary
 * @returns {object} Fields to update on Media document
 */
async function labelImage(media, context = {}) {
  // Get image URL (prefer imgix for optimization)
  const imageUrl = media.imgixUrl || media.url;
  if (!imageUrl) {
    console.error(`[Labeler] No URL for media ${media.id}`);
    return { labelingStatus: 'failed', processingError: 'No image URL' };
  }

  console.log(`[Labeler] Processing media ${media.id}: ${media.filename || 'unnamed'}`);
  console.log(`[Labeler] Context: ${context.propertyName || 'unknown'}, ${context.country || 'unknown'}`);

  try {
    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');

    // Call GPT-4o with context (structured outputs guarantees valid JSON)
    const enrichment = await analyzeImageWithContext(base64, context);

    // Map enrichment to Media fields
    return {
      // Source context (ground truth from scrape)
      sourceProperty: context.propertyName || null,
      sourceSegmentType: context.segmentType || null,
      sourceSegmentTitle: context.segmentTitle || context.propertyName || null,
      sourceDayIndex: context.dayIndex || null,
      country: context.country || null,

      // AI enrichment fields
      scene: enrichment.scene,
      mood: enrichment.mood || [],
      timeOfDay: enrichment.timeOfDay,
      setting: enrichment.setting || [],
      composition: enrichment.composition,
      suitableFor: enrichment.suitableFor || [],
      animals: enrichment.animals || [],
      tags: enrichment.tags || [],

      // Standard fields
      alt: enrichment.altText,
      altText: enrichment.altText,
      quality: enrichment.quality,
      imageType: enrichment.imageType,
      isHero: enrichment.composition === 'hero' && enrichment.quality === 'high',

      // Status
      labelingStatus: 'complete',
      labeledAt: new Date().toISOString(),
      processingError: null,
    };

  } catch (error) {
    console.error(`[Labeler] Error processing media ${media.id}:`, error.message);
    return {
      labelingStatus: 'failed',
      processingError: error.message,
      labeledAt: new Date().toISOString(),
    };
  }
}

/**
 * Get default labels when AI fails (fallback)
 * @deprecated With structured outputs, this should rarely be needed
 */
function getDefaultLabels() {
  return {
    scene: 'African safari scene',
    mood: ['adventurous'],
    timeOfDay: 'unknown',
    setting: ['savanna'],
    composition: 'establishing',
    suitableFor: ['gallery'],
    animals: [],
    tags: ['safari', 'travel', 'africa', 'wildlife', 'adventure'],
    alt: 'African safari landscape image',
    altText: 'African safari landscape image',
    quality: 'medium',
    imageType: 'landscape',
    isHero: false,
    labelingStatus: 'complete',
  };
}

module.exports = { labelImage, getDefaultLabels };
