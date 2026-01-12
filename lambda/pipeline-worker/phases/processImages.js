/**
 * Phase 3: Image Processing
 *
 * Production pipeline:
 * 1. Download original from iTrvl CDN
 * 2. Upload original to kiuli-bucket/media/originals/
 * 3. Get optimized version via imgix for AI labeling
 * 4. Label with OpenRouter Vision
 * 5. Upload optimized version to Payload (for CMS thumbnail)
 * 6. Create Media record with all URLs and labels
 */

const FormData = require('form-data');
const { uploadToS3, getImgixUrl } = require('../services/s3');
const { labelImage } = require('../utils/imageLabeler');

const CONCURRENCY = 5;  // Lower concurrency for larger operations
const MAX_RETRIES = 3;

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

    // Delay between batches
    if (batchNum < batches.length - 1) {
      await sleep(2000);
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
      console.log(`[ProcessImages] Retry ${attempt}/${retries}: ${error.message}`);
      await sleep(3000 * attempt);
    }
  }
}

async function processSingleImage(s3Key, itineraryId) {
  // Generate consistent filename
  const extension = s3Key.includes('.') ? s3Key.split('.').pop() : 'jpg';
  const baseFilename = s3Key.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `${itineraryId}_${baseFilename}.${extension}`;

  // S3 path for original
  const originalS3Key = `media/originals/${itineraryId}/${filename}`;

  // iTrvl source URL
  const itrvlSourceUrl = `https://itrvl-production-media.imgix.net/${s3Key}`;

  console.log(`[ProcessImages] Processing: ${filename}`);

  // 1. Download original from iTrvl
  console.log(`[ProcessImages] Downloading original...`);
  const downloadResponse = await fetch(itrvlSourceUrl);
  if (!downloadResponse.ok) {
    throw new Error(`Download failed: ${downloadResponse.status}`);
  }

  const originalBuffer = Buffer.from(await downloadResponse.arrayBuffer());
  const contentType = downloadResponse.headers.get('content-type') || 'image/jpeg';

  console.log(`[ProcessImages] Downloaded: ${(originalBuffer.length / 1024 / 1024).toFixed(2)} MB`);

  // 2. Upload original to S3
  console.log(`[ProcessImages] Uploading original to S3...`);
  await uploadToS3(originalBuffer, originalS3Key, contentType);

  // 3. Get imgix URL for this image
  const imgixUrl = getImgixUrl(originalS3Key, { w: 1920 });
  const imgixUrlForLabeling = getImgixUrl(originalS3Key, { w: 1200, q: 70 });

  // 4. Download optimized version for AI labeling (smaller = faster)
  console.log(`[ProcessImages] Fetching optimized for labeling...`);
  const optimizedResponse = await fetch(imgixUrlForLabeling);
  if (!optimizedResponse.ok) {
    throw new Error(`imgix fetch failed: ${optimizedResponse.status}`);
  }
  const optimizedBuffer = Buffer.from(await optimizedResponse.arrayBuffer());
  const optimizedContentType = optimizedResponse.headers.get('content-type') || 'image/jpeg';

  console.log(`[ProcessImages] Optimized size: ${(optimizedBuffer.length / 1024).toFixed(0)} KB`);

  // 5. Label with AI
  let labels;
  try {
    labels = await labelImage(optimizedBuffer);
    console.log(`[ProcessImages] Labeled: ${labels.imageType}, ${labels.country}`);
  } catch (error) {
    console.error(`[ProcessImages] Labeling failed: ${error.message}`);
    labels = getDefaultLabels();
  }

  // 6. Upload optimized version to Payload via multipart
  console.log(`[ProcessImages] Creating Payload Media record...`);
  const formData = new FormData();

  formData.append('file', optimizedBuffer, {
    filename: filename.replace(/\.[^.]+$/, '.jpg'),  // Always jpg from imgix
    contentType: optimizedContentType
  });

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
    sourceUrl: itrvlSourceUrl,
    originalS3Key: originalS3Key,
    imgixUrl: imgixUrl
  }));

  const uploadResponse = await fetch(`${process.env.PAYLOAD_API_URL}/api/media`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PAYLOAD_API_KEY}`,
      ...formData.getHeaders()
    },
    body: formData.getBuffer()
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Payload upload failed (${uploadResponse.status}): ${errorText}`);
  }

  const result = await uploadResponse.json();
  const mediaId = result.doc?.id || result.id;

  console.log(`[ProcessImages] Created Media record: ${mediaId}`);

  return mediaId;
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

module.exports = { processImages, processSingleImage };
