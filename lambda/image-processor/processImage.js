/**
 * Per-image processing with global deduplication
 */

const { uploadToS3, generateS3Key, getImgixUrl } = require('./shared/s3');
const payload = require('./shared/payload');

// iTrvl uses imgix CDN for their production media
const ITRVL_CDN_BASE = 'https://itrvl-production-media.imgix.net';

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

    // Note: We skip updating usedInItineraries here because:
    // 1. It causes 413 errors due to Payload returning full populated documents
    // 2. Usage tracking is better done via itinerary.images array anyway
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
 * Create Media record in Payload with metadata only
 * Image is already uploaded to S3, so we just need the record
 * Includes source context from imageStatus for enrichment
 */
async function createMediaRecord(buffer, sourceS3Key, s3Key, itineraryId, contentType, imageContext = {}) {
  // Use full sourceS3Key as filename to ensure uniqueness
  // (sourceS3Key includes UUID prefix, e.g., "abc123_filename.jpg")
  const filename = sourceS3Key || 'image.jpg';
  const displayName = (sourceS3Key.split('/').pop() || 'image.jpg').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');

  // Create media record with JSON metadata (no file upload)
  // Include source context from imageStatus for enrichment
  const mediaData = {
    alt: displayName,
    sourceS3Key: sourceS3Key,
    originalS3Key: s3Key,
    imgixUrl: getImgixUrl(s3Key),
    url: getImgixUrl(s3Key), // Set url field for Payload
    filename: filename,
    mimeType: contentType,
    filesize: buffer.length,
    sourceItinerary: itineraryId,
    processingStatus: 'complete',
    labelingStatus: 'pending',
    usedInItineraries: [itineraryId],
    // Source context from imageStatus (for AI enrichment)
    sourceProperty: imageContext.propertyName || null,
    sourceSegmentType: imageContext.segmentType || null,
    sourceSegmentTitle: imageContext.segmentTitle || null,
    sourceDayIndex: imageContext.dayIndex || null,
    country: imageContext.country || null,
  };

  // POST to Payload
  const response = await fetch(`${payload.PAYLOAD_API_URL}/api/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${payload.PAYLOAD_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(mediaData)
  });

  if (!response.ok) {
    const errorText = await response.text();

    // Handle race condition: another Lambda might have created this media
    if (response.status === 400 && errorText.includes('Value must be unique')) {
      console.log(`[ProcessImage] Race condition detected for: ${sourceS3Key}, retrying dedup lookup`);

      // Re-check for existing media (another instance likely just created it)
      const existingMedia = await payload.findMediaBySourceS3Key(sourceS3Key);
      if (existingMedia) {
        console.log(`[ProcessImage] Found existing media after race: ${existingMedia.id}`);
        return existingMedia.id;
      }

      // If still not found, throw the original error
      throw new Error(`Failed to create media: ${response.status} - ${errorText}`);
    }

    throw new Error(`Failed to create media: ${response.status} - ${errorText}`);
  }

  const media = await response.json();
  return media.doc?.id || media.id;
}

module.exports = { processImage };
