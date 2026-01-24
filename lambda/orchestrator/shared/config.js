/**
 * Centralized Configuration for V6 Pipeline
 *
 * All environment-dependent values should be imported from this file.
 * Fallback values are provided for local development but env vars
 * MUST be set in production.
 *
 * Run sync-shared.sh to copy to Lambda-specific shared/ directories.
 */

const CONFIG = {
  // CDN & Media
  IMGIX_DOMAIN: process.env.IMGIX_DOMAIN || 'kiuli.imgix.net',
  ITRVL_CDN_BASE: process.env.ITRVL_IMAGE_CDN_BASE || 'https://itrvl-production-media.imgix.net',

  // API Endpoints
  PAYLOAD_API_URL: process.env.PAYLOAD_API_URL || 'https://admin.kiuli.com',

  // S3 Storage
  S3_BUCKET: process.env.S3_BUCKET || 'kiuli-bucket',
  S3_REGION: process.env.AWS_REGION || 'eu-north-1',

  // Site URLs
  SITE_URL: 'https://kiuli.com',
  ADMIN_URL: 'https://admin.kiuli.com',

  // Processing Limits
  CHUNK_SIZE: 20,          // Images per Lambda invocation
  LABELER_BATCH_SIZE: 10,  // Images per labeling batch
  LABELER_CONCURRENT: 3,   // Concurrent AI calls
};

// Validate critical env vars on import (warning only)
const REQUIRED_ENV = ['PAYLOAD_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.warn(`[Config] WARNING: Missing env var: ${key}`);
  }
}

module.exports = CONFIG;
