/**
 * AI Image Labeling using GPT-4o with Context-Aware Enrichment
 * V6 - Uses structured outputs for guaranteed JSON parsing
 * S3 fallback for image fetching when imgix is unavailable
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { analyzeImageWithContext } = require('./shared/openrouter');

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'eu-north-1',
  credentials: process.env.S3_ACCESS_KEY_ID ? {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  } : undefined
});
const S3_BUCKET = process.env.S3_BUCKET;

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
  console.log(`[Labeler] Processing media ${media.id}: ${media.filename || 'unnamed'}`);
  console.log(`[Labeler] Context: ${context.propertyName || 'unknown'}, ${context.country || 'unknown'}`);

  try {
    // Get image data - try S3 first (reliable), fallback to imgix
    let base64;
    const s3Key = media.originalS3Key;

    if (s3Key && S3_BUCKET) {
      try {
        console.log(`[Labeler] Fetching from S3: ${s3Key}`);
        const s3Response = await s3Client.send(new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key
        }));
        const chunks = [];
        for await (const chunk of s3Response.Body) {
          chunks.push(chunk);
        }
        base64 = Buffer.concat(chunks).toString('base64');
      } catch (s3Error) {
        console.warn(`[Labeler] S3 fetch failed: ${s3Error.message}, trying imgix...`);
        base64 = null;
      }
    }

    if (!base64) {
      // Fallback to imgix/URL
      const imageUrl = media.imgixUrl || media.url;
      if (!imageUrl) {
        console.error(`[Labeler] No URL for media ${media.id}`);
        return { labelingStatus: 'failed', processingError: 'No image URL or S3 key' };
      }

      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      const imageBuffer = await imageResponse.arrayBuffer();
      base64 = Buffer.from(imageBuffer).toString('base64');
    }

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
