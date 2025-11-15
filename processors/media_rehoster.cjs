#!/usr/bin/env node

/**
 * Media Rehoster - Phase 3
 *
 * This script consumes raw-itinerary.json, downloads all images from iTrvl's CDN,
 * and uploads them to Payload CMS media library, creating a mapping file.
 *
 * Usage: node processors/media_rehoster.cjs
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Check if running in serverless environment
const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

// Helper function to get output directory (serverless uses /tmp, local uses current dir)
function getOutputDir() {
  const baseDir = isVercel ? '/tmp' : process.cwd();
  return path.join(baseDir, 'output');
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

// Helper function to log with color
function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Validate environment variables
function validateEnv() {
  const apiUrl = process.env.PAYLOAD_API_URL?.trim();
  const apiKey = process.env.PAYLOAD_API_KEY?.trim();

  if (!apiUrl) {
    throw new Error('PAYLOAD_API_URL environment variable not set');
  }

  if (!apiKey) {
    throw new Error('PAYLOAD_API_KEY environment variable not set');
  }

  return { apiUrl, apiKey };
}

// Download image from iTrvl CDN
async function downloadImage(s3Key) {
  const imageUrl = `https://itrvl-production-media.imgix.net/${s3Key}`;

  try {
    log(`    → Downloading: ${imageUrl}`, colors.cyan);

    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });

    const buffer = Buffer.from(response.data);
    const contentType = response.headers['content-type'] || 'image/jpeg';

    log(`    ✓ Downloaded: ${(buffer.length / 1024).toFixed(2)} KB`, colors.green);

    return { buffer, contentType };
  } catch (error) {
    throw new Error(`Failed to download image: ${error.message}`);
  }
}

// Upload image to Payload CMS
async function uploadToPayload(buffer, contentType, s3Key, apiUrl, apiKey) {
  try {
    log(`    → Uploading to Payload CMS...`, colors.cyan);

    // Extract filename from s3Key
    const filename = s3Key.split('/').pop() || `image-${Date.now()}.jpg`;

    // Create form data
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: filename,
      contentType: contentType,
    });

    // Make upload request
    const uploadUrl = `${apiUrl}/api/media`;

    const response = await axios.post(uploadUrl, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `users API-Key ${apiKey}`,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 60000,
    });

    if (response.status !== 200 && response.status !== 201) {
      throw new Error(`Unexpected response status: ${response.status}`);
    }

    const mediaDoc = response.data.doc || response.data;

    // Extract the uploaded file URL
    let newS3Url = null;

    // Check if S3 storage is configured
    const s3BaseUrl = process.env.PAYLOAD_PUBLIC_MEDIA_BASE_URL;
    const usingS3 = s3BaseUrl && (s3BaseUrl.includes('s3') || s3BaseUrl.includes('amazonaws'));

    if (usingS3) {
      // When using S3, always construct URL from filename
      // Don't use mediaDoc.url as it may contain API paths like /api/media/file/...
      if (mediaDoc.filename) {
        newS3Url = `${s3BaseUrl}/${mediaDoc.filename}`;
      } else if (mediaDoc.url && (mediaDoc.url.startsWith('http://') || mediaDoc.url.startsWith('https://'))) {
        // URL is already absolute
        newS3Url = mediaDoc.url;
      }
    } else {
      // Local storage - use URL paths
      if (mediaDoc.url) {
        if (mediaDoc.url.startsWith('http://') || mediaDoc.url.startsWith('https://')) {
          newS3Url = mediaDoc.url;
        } else {
          newS3Url = `${apiUrl}${mediaDoc.url}`;
        }
      } else if (mediaDoc.filename) {
        newS3Url = `${apiUrl}/api/media/file/${mediaDoc.filename}`;
      }
    }

    log(`    ✓ Uploaded successfully`, colors.green);
    log(`    → Payload Media ID: ${mediaDoc.id}`, colors.cyan);
    log(`    → New URL: ${newS3Url}`, colors.cyan);

    return {
      payloadMediaID: mediaDoc.id,
      newS3Url: newS3Url,
    };
  } catch (error) {
    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;
      throw new Error(
        `Upload failed (${statusCode}): ${JSON.stringify(errorData)}`
      );
    }
    throw new Error(`Failed to upload to Payload: ${error.message}`);
  }
}

// Process a single image
async function processImage(s3Key, apiUrl, apiKey) {
  try {
    // Download from iTrvl
    const { buffer, contentType } = await downloadImage(s3Key);

    // Upload to Payload
    const { payloadMediaID, newS3Url } = await uploadToPayload(
      buffer,
      contentType,
      s3Key,
      apiUrl,
      apiKey
    );

    return {
      s3Key,
      payloadMediaID,
      newS3Url,
      status: 'success',
    };
  } catch (error) {
    log(`    ✗ Error: ${error.message}`, colors.red);
    return {
      s3Key,
      payloadMediaID: null,
      newS3Url: null,
      status: 'failed',
      error: error.message,
    };
  }
}

// Main rehosting function
async function rehostMedia() {
  log('\n' + '='.repeat(60), colors.bright);
  log('  Media Rehoster - Phase 3', colors.bright);
  log('='.repeat(60), colors.bright);

  // Validate environment
  log('\n[1/5] Validating environment...', colors.blue);
  let apiUrl, apiKey;
  try {
    ({ apiUrl, apiKey } = validateEnv());
    log(`  ✓ PAYLOAD_API_URL: ${apiUrl}`, colors.green);
    log(`  ✓ PAYLOAD_API_KEY: ${apiKey.substring(0, 8)}...`, colors.green);
  } catch (error) {
    log(`  ✗ ${error.message}`, colors.red);
    process.exit(1);
  }

  // Load raw itinerary data
  log('\n[2/5] Loading raw itinerary data...', colors.blue);
  const outputDir = getOutputDir();
  const inputPath = path.join(outputDir, 'raw-itinerary.json');

  if (!fs.existsSync(inputPath)) {
    log(`  ✗ Input file not found: ${inputPath}`, colors.red);
    process.exit(1);
  }

  let rawData;
  try {
    const fileContent = fs.readFileSync(inputPath, 'utf8');
    rawData = JSON.parse(fileContent);
    log(`  ✓ Loaded: ${inputPath}`, colors.green);
  } catch (error) {
    log(`  ✗ Failed to parse JSON: ${error.message}`, colors.red);
    process.exit(1);
  }

  // Extract images array
  if (!rawData.images || !Array.isArray(rawData.images)) {
    log('  ✗ No images array found in raw data', colors.red);
    process.exit(1);
  }

  const images = rawData.images;
  log(`  ✓ Found ${images.length} images to process`, colors.green);

  if (images.length === 0) {
    log('  ⚠ No images to process', colors.yellow);
    // Still create an empty mapping file
    const outputPath = path.join(outputDir, 'media-mapping.json');
    fs.writeFileSync(outputPath, JSON.stringify([], null, 2));
    log(`  ✓ Created empty mapping file: ${outputPath}`, colors.green);
    process.exit(0);
  }

  // Process each image
  log('\n[3/5] Downloading and uploading images...', colors.blue);
  const mediaMapping = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < images.length; i++) {
    const s3Key = images[i];
    log(`\n  [${i + 1}/${images.length}] Processing: ${s3Key}`, colors.magenta);

    const result = await processImage(s3Key, apiUrl, apiKey);
    mediaMapping.push(result);

    if (result.status === 'success') {
      successCount++;
    } else {
      failCount++;
    }

    // Small delay between requests to avoid rate limiting
    if (i < images.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Summary
  log('\n[4/5] Processing summary...', colors.blue);
  log(`  ✓ Successful uploads: ${successCount}`, colors.green);
  if (failCount > 0) {
    log(`  ✗ Failed uploads: ${failCount}`, colors.red);
  }

  // Write mapping file
  log('\n[5/5] Writing media mapping file...', colors.blue);
  const outputPath = path.join(outputDir, 'media-mapping.json');

  try {
    fs.writeFileSync(outputPath, JSON.stringify(mediaMapping, null, 2));
    const fileSize = (fs.statSync(outputPath).size / 1024).toFixed(2);
    log(`  ✓ Mapping file written: ${outputPath}`, colors.green);
    log(`  → File size: ${fileSize} KB`, colors.cyan);
    log(`  → Total entries: ${mediaMapping.length}`, colors.cyan);
  } catch (error) {
    log(`  ✗ Failed to write mapping file: ${error.message}`, colors.red);
    process.exit(1);
  }

  log('\n' + '='.repeat(60), colors.bright);
  if (failCount === 0) {
    log('  ✓ Media rehosting completed successfully', colors.green);
  } else {
    log('  ⚠ Media rehosting completed with errors', colors.yellow);
  }
  log('='.repeat(60) + '\n', colors.bright);

  process.exit(failCount > 0 ? 1 : 0);
}

// Main execution
if (require.main === module) {
  rehostMedia().catch((error) => {
    log(`\n✗ Fatal error: ${error.message}`, colors.red);
    if (error.stack) {
      log(`\nStack trace:\n${error.stack}`, colors.red);
    }
    process.exit(1);
  });
}

module.exports = { rehostMedia };
