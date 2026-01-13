/**
 * Per-image processing with global deduplication
 */

const FormData = require('form-data');
const { uploadToS3, generateS3Key, getImgixUrl } = require('./shared/s3');
const payload = require('./shared/payload');

const ITRVL_CDN_BASE = 'https://dj1cfrkz8wfyi.cloudfront.net';

/**
 * Process a single image
 * 1. Check global dedup (sourceS3Key in Media collection)
 * 2. If exists, return existing media ID
 * 3. Download from iTrvl CDN
 * 4. Upload to S3
 * 5. Create Media record via Payload
 * 6. Return media ID
 */
async function processImage(sourceS3Key, itineraryId) {
  console.log(`[ProcessImage] Processing: ${sourceS3Key}`);

  // 1. Check for existing media with this sourceS3Key (global dedup)
  const existingMedia = await payload.findMediaBySourceS3Key(sourceS3Key);

  if (existingMedia) {
    console.log(`[ProcessImage] Dedup hit: ${sourceS3Key} -> ${existingMedia.id}`);

    // Update usedInItineraries to track usage
    const usedIn = existingMedia.usedInItineraries || [];
    if (!usedIn.includes(itineraryId)) {
      await payload.updateMedia(existingMedia.id, {
        usedInItineraries: [...usedIn, itineraryId]
      });
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

  // 4. Create Media record via Payload multipart upload
  const mediaId = await createMediaRecord(buffer, sourceS3Key, s3Key, itineraryId, contentType);

  console.log(`[ProcessImage] Created media: ${mediaId}`);

  return {
    mediaId,
    skipped: false
  };
}

/**
 * Create Media record in Payload via multipart form upload
 */
async function createMediaRecord(buffer, sourceS3Key, s3Key, itineraryId, contentType) {
  const filename = sourceS3Key.split('/').pop() || 'image.jpg';

  // Build form data
  const form = new FormData();

  // Add file
  form.append('file', buffer, {
    filename,
    contentType
  });

  // Add metadata fields
  form.append('alt', filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
  form.append('sourceS3Key', sourceS3Key);
  form.append('originalS3Key', s3Key);
  form.append('imgixUrl', getImgixUrl(s3Key));
  form.append('sourceItinerary', itineraryId);
  form.append('processingStatus', 'complete');
  form.append('labelingStatus', 'pending');
  form.append('usedInItineraries', itineraryId);

  // POST to Payload
  const response = await fetch(`${payload.PAYLOAD_API_URL}/api/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${payload.PAYLOAD_API_KEY}`,
      ...form.getHeaders()
    },
    body: form
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create media: ${response.status} - ${error}`);
  }

  const media = await response.json();
  return media.doc?.id || media.id;
}

module.exports = { processImage };
