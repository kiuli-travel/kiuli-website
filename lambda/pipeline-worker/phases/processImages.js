/**
 * Phase 3: Image Processing with Multipart Upload
 *
 * Key change from V4: Uses multipart/form-data to upload to Payload's
 * Media collection. Payload's S3 plugin handles the actual S3 storage.
 */

const FormData = require('form-data');
const { labelImage } = require('../utils/imageLabeler');

const CONCURRENCY = 10;
const MAX_RETRIES = 2;

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processImages(imagesToProcess, itineraryId, existingMedia, tracker) {
  const mediaMapping = { ...existingMedia };
  let processed = 0;
  let failed = 0;
  const total = imagesToProcess.length;
  const errors = [];

  console.log(`[ProcessImages] Processing ${total} images with concurrency ${CONCURRENCY}`);

  const batches = chunkArray(imagesToProcess, CONCURRENCY);

  for (let batchNum = 0; batchNum < batches.length; batchNum++) {
    const batch = batches[batchNum];
    console.log(`[ProcessImages] Batch ${batchNum + 1}/${batches.length}`);

    const results = await Promise.allSettled(
      batch.map(s3Key => processWithRetry(() => processSingleImage(s3Key, itineraryId)))
    );

    results.forEach((result, i) => {
      const s3Key = batch[i];
      if (result.status === 'fulfilled') {
        mediaMapping[s3Key] = result.value;
        processed++;
      } else {
        console.error(`[ProcessImages] Failed: ${s3Key}: ${result.reason?.message}`);
        errors.push({ s3Key, error: result.reason?.message });
        failed++;
      }
    });

    // Update progress
    if (tracker) {
      await tracker.updateProgress(processed + failed, total, failed);
    }

    // Delay between batches for rate limiting
    if (batchNum < batches.length - 1) {
      await sleep(1000);
    }
  }

  console.log(`[ProcessImages] Complete: ${processed} succeeded, ${failed} failed`);

  return { mediaMapping, processed, failed, errors };
}

async function processWithRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt > retries) throw error;
      console.log(`[ProcessImages] Retry ${attempt}/${retries}...`);
      await sleep(2000 * attempt);
    }
  }
}

async function processSingleImage(s3Key, itineraryId) {
  const filename = `${itineraryId}_${s3Key.replace(/\//g, '_')}`;
  const sourceUrl = `https://itrvl-production-media.imgix.net/${s3Key}`;

  console.log(`[ProcessImages] Processing: ${filename}`);

  // 1. Download image
  const downloadResponse = await fetch(sourceUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Download failed: ${downloadResponse.status}`);
  }

  const buffer = Buffer.from(await downloadResponse.arrayBuffer());
  const contentType = downloadResponse.headers.get('content-type') || 'image/jpeg';

  console.log(`[ProcessImages] Downloaded: ${(buffer.length / 1024).toFixed(1)} KB`);

  // 2. Label with AI
  let labels;
  try {
    labels = await labelImage(buffer);
    console.log(`[ProcessImages] Labeled: ${labels.imageType}, ${labels.country}`);
  } catch (error) {
    console.error(`[ProcessImages] Labeling failed: ${error.message}`);
    labels = {
      location: 'Unknown',
      country: 'Unknown',
      imageType: 'landscape',
      animals: [],
      tags: ['safari', 'travel'],
      altText: filename,
      isHero: false,
      quality: 'medium'
    };
  }

  // 3. Upload to Payload via multipart/form-data
  const formData = new FormData();

  // File field
  formData.append('file', buffer, {
    filename: filename,
    contentType: contentType
  });

  // Metadata via _payload field
  formData.append('_payload', JSON.stringify({
    alt: labels.altText || filename,
    location: labels.location,
    country: labels.country,
    imageType: labels.imageType,
    animals: labels.animals,
    tags: labels.tags,
    altText: labels.altText,
    isHero: labels.isHero,
    quality: labels.quality,
    sourceItinerary: itineraryId,
    s3Key: s3Key,
    sourceUrl: sourceUrl
  }));

  const uploadResponse = await fetch(`${process.env.PAYLOAD_API_URL}/api/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PAYLOAD_API_KEY}`,
      ...formData.getHeaders()
    },
    body: formData
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Payload upload failed (${uploadResponse.status}): ${errorText}`);
  }

  const result = await uploadResponse.json();
  const mediaId = result.doc?.id || result.id;

  console.log(`[ProcessImages] Created Payload record: ${mediaId}`);

  return mediaId;
}

module.exports = { processImages, processSingleImage };
