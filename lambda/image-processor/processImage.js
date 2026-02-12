/**
 * Per-image processing with global deduplication
 */

const { uploadToS3, generateS3Key, getImgixUrl } = require('./shared/s3');
const payload = require('./shared/payload');
const FormData = require('form-data');

// iTrvl uses imgix CDN for their production media
// Externalized for resilience if iTrvl changes their CDN
const ITRVL_CDN_BASE = process.env.ITRVL_IMAGE_CDN_BASE || 'https://itrvl-production-media.imgix.net';

/**
 * Process a single image
 * 1. Check global dedup (sourceS3Key in Media collection)
 * 2. If exists, return existing media ID
 * 3. Download from iTrvl CDN
 * 4. Upload to S3
 * 5. Create Media record via Payload (with context from imageStatus)
 * 6. Return media ID
 *
 * @param {string} sourceS3Key - Original S3 key from iTrvl CDN
 * @param {string} itineraryId - Payload itinerary ID
 * @param {Object} imageContext - Context from imageStatus (optional)
 * @param {string} imageContext.propertyName - Property/lodge name
 * @param {string} imageContext.segmentType - stay|activity|transfer
 * @param {string} imageContext.segmentTitle - Segment title
 * @param {number} imageContext.dayIndex - Day number in itinerary
 * @param {string} imageContext.country - Country from segment
 */
async function processImage(sourceS3Key, itineraryId, imageContext = {}) {
  console.log(`[ProcessImage] Processing: ${sourceS3Key}`);

  // 1. Check for existing media with this sourceS3Key (global dedup)
  const existingMedia = await payload.findMediaBySourceS3Key(sourceS3Key);

  if (existingMedia) {
    console.log(`[ProcessImage] Dedup hit: ${sourceS3Key} -> ${existingMedia.id}`);

    // Update usedInItineraries — use depth=0 to avoid 413 errors
    try {
      const existingItineraries = (existingMedia.usedInItineraries || [])
        .map(i => typeof i === 'object' ? i.id : i);

      const itineraryIdNum = typeof itineraryId === 'number' ? itineraryId : parseInt(itineraryId, 10);

      if (!existingItineraries.includes(itineraryIdNum)) {
        await fetch(`${payload.PAYLOAD_API_URL}/api/media/${existingMedia.id}?depth=0`, {
          method: 'PATCH',
          headers: {
            'Authorization': `users API-Key ${payload.PAYLOAD_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            usedInItineraries: [...existingItineraries, itineraryIdNum]
          })
        });
        console.log(`[ProcessImage] Updated usedInItineraries for media ${existingMedia.id}`);
      }
    } catch (linkError) {
      // Non-fatal — log but don't fail the pipeline
      console.warn(`[ProcessImage] Failed to update usedInItineraries: ${linkError.message}`);
    }

    return {
      mediaId: existingMedia.id,
      skipped: true
    };
  }

  // 2. Download from iTrvl CDN
  const imageUrl = `${ITRVL_CDN_BASE}/${sourceS3Key}`;
  console.log(`[ProcessImage] Downloading: ${imageUrl}`);

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  console.log(`[ProcessImage] Downloaded: ${buffer.length} bytes`);

  // 3. Upload to our S3
  const s3Key = generateS3Key(sourceS3Key, itineraryId);
  await uploadToS3(buffer, s3Key, contentType);

  // 4. Create Media record via Payload multipart upload (with context)
  const mediaId = await createMediaRecord(buffer, sourceS3Key, s3Key, itineraryId, contentType, imageContext);

  console.log(`[ProcessImage] Created media: ${mediaId}`);

  return {
    mediaId,
    skipped: false
  };
}

/**
 * Create Media record in Payload via multipart file upload.
 * Payload's upload collection requires the actual file — JSON-only POST returns 500.
 * Includes source context from imageStatus for enrichment.
 */
async function createMediaRecord(buffer, sourceS3Key, s3Key, itineraryId, contentType, imageContext = {}) {
  const filename = sourceS3Key || 'image.jpg';
  const displayName = (sourceS3Key.split('/').pop() || 'image.jpg').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

  const form = new FormData();

  // File upload (required by Payload upload collection)
  form.append('file', buffer, { filename, contentType });

  // Metadata fields
  form.append('alt', displayName);
  form.append('sourceS3Key', sourceS3Key);
  form.append('originalS3Key', s3Key);
  form.append('imgixUrl', getImgixUrl(s3Key));
  form.append('url', getImgixUrl(s3Key));
  form.append('sourceItinerary', String(itineraryId));
  form.append('processingStatus', 'complete');
  form.append('labelingStatus', 'pending');
  form.append('usedInItineraries', String(itineraryId));
  // Source context
  if (imageContext.propertyName) form.append('sourceProperty', imageContext.propertyName);
  if (imageContext.segmentType) form.append('sourceSegmentType', imageContext.segmentType);
  if (imageContext.segmentTitle) form.append('sourceSegmentTitle', imageContext.segmentTitle);
  if (imageContext.dayIndex) form.append('sourceDayIndex', String(imageContext.dayIndex));
  if (imageContext.country) form.append('country', imageContext.country);

  const response = await fetch(`${payload.PAYLOAD_API_URL}/api/media`, {
    method: 'POST',
    headers: {
      'Authorization': `users API-Key ${payload.PAYLOAD_API_KEY}`,
      ...form.getHeaders()
    },
    body: form
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Handle race condition: another Lambda might have created this media
    if (response.status === 400 && errorText.includes('Value must be unique')) {
      console.log(`[ProcessImage] Race condition detected for: ${sourceS3Key}, retrying dedup lookup`);
      const existingMedia = await payload.findMediaBySourceS3Key(sourceS3Key);
      if (existingMedia) {
        console.log(`[ProcessImage] Found existing media after race: ${existingMedia.id}`);
        return existingMedia.id;
      }
      throw new Error(`Failed to create media: ${response.status} - ${errorText}`);
    }

    throw new Error(`Failed to create media: ${response.status} - ${errorText}`);
  }

  const media = await response.json();
  return media.doc?.id || media.id;
}

module.exports = { processImage };
