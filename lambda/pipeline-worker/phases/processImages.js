const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const CONCURRENCY = 20;
const MAX_RETRIES = 2;

let s3Client = null;
function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({ region: process.env.S3_REGION || 'eu-north-1' });
  }
  return s3Client;
}

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

async function processWithRetry(fn, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt > retries) throw err;
      console.log(`[ProcessImages] Retry ${attempt}/${retries}...`);
      await sleep(1000 * attempt);
    }
  }
}

async function processSingleImage(s3Key, itineraryId, labelImage) {
  const filename = `${itineraryId}_${s3Key.replace(/\//g, '_')}`;
  const sourceUrl = `https://itrvl-production-media.imgix.net/${s3Key}`;

  console.log(`[ProcessImages] Processing: ${filename}`);

  // 1. Download
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/jpeg';

  console.log(`[ProcessImages] Downloaded: ${(buffer.length / 1024).toFixed(1)} KB`);

  // 2. Upload to S3
  const s3 = getS3Client();
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: `media/${filename}`,
    Body: buffer,
    ContentType: contentType
  }));

  const s3Url = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION || 'eu-north-1'}.amazonaws.com/media/${filename}`;
  console.log(`[ProcessImages] Uploaded to S3`);

  // 3. Label with AI (if function provided)
  let labels = {};
  if (labelImage) {
    try {
      labels = await labelImage(buffer);
    } catch (err) {
      console.error(`[ProcessImages] Labeling failed: ${err.message}`);
      labels = getDefaultLabels();
    }
  } else {
    labels = getDefaultLabels();
  }

  // 4. Create Payload record
  const payloadResponse = await fetch(`${process.env.PAYLOAD_API_URL}/api/media`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.PAYLOAD_API_KEY}`
    },
    body: JSON.stringify({
      filename,
      url: s3Url,
      s3Key,
      sourceItinerary: itineraryId,
      sourceUrl,
      ...labels
    })
  });

  if (!payloadResponse.ok) {
    const errorText = await payloadResponse.text();
    throw new Error(`Payload failed (${payloadResponse.status}): ${errorText}`);
  }

  const media = await payloadResponse.json();
  console.log(`[ProcessImages] Created Payload record: ${media.doc?.id || media.id}`);

  return media.doc?.id || media.id;
}

function getDefaultLabels() {
  return {
    location: 'Unknown',
    country: 'Unknown',
    imageType: 'landscape',
    animals: [],
    tags: ['safari', 'travel'],
    altText: 'Safari travel image',
    isHero: false,
    quality: 'medium'
  };
}

async function processImages(imagesToProcess, itineraryId, existingMedia, tracker, labelImage = null) {
  const mediaMapping = { ...existingMedia };
  let processed = 0;
  let failed = 0;
  const total = imagesToProcess.length;
  const errors = [];

  console.log(`[ProcessImages] Starting batch processing of ${total} images with concurrency ${CONCURRENCY}`);

  const batches = chunkArray(imagesToProcess, CONCURRENCY);
  let batchNum = 0;

  for (const batch of batches) {
    batchNum++;
    console.log(`[ProcessImages] Processing batch ${batchNum}/${batches.length}`);

    const results = await Promise.allSettled(
      batch.map(s3Key =>
        processWithRetry(() => processSingleImage(s3Key, itineraryId, labelImage))
      )
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

    // Small delay between batches to avoid rate limits
    if (batchNum < batches.length) {
      await sleep(500);
    }
  }

  console.log(`[ProcessImages] Complete: ${processed} succeeded, ${failed} failed`);

  return { mediaMapping, processed, failed, errors };
}

module.exports = { processImages, processSingleImage, getDefaultLabels };
