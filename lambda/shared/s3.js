/**
 * S3 Service for V6 Pipeline
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    const credentials = process.env.S3_ACCESS_KEY_ID ? {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
    } : undefined;

    s3Client = new S3Client({
      region: process.env.S3_REGION || 'eu-north-1',
      credentials
    });
  }
  return s3Client;
}

/**
 * Upload buffer to S3
 */
async function uploadToS3(buffer, key, contentType) {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new Error('S3_BUCKET environment variable not set');
  }

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable'
  }));

  console.log(`[S3] Uploaded: s3://${bucket}/${key}`);
  return key;
}

/**
 * Check if object exists in S3
 */
async function objectExists(key) {
  const client = getS3Client();
  const bucket = process.env.S3_BUCKET;

  try {
    await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    }));
    return true;
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

/**
 * Generate imgix URL from S3 key
 */
function getImgixUrl(s3Key, transforms = {}) {
  const domain = process.env.IMGIX_DOMAIN || 'kiuli.imgix.net';
  const baseUrl = `https://${domain}/${s3Key}`;

  const defaultTransforms = {
    auto: 'format,compress',
    q: 80
  };

  const params = { ...defaultTransforms, ...transforms };
  const queryString = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');

  return `${baseUrl}?${queryString}`;
}

/**
 * Generate S3 key for an image
 */
function generateS3Key(sourceKey, itineraryId) {
  // Extract filename from source key
  const filename = sourceKey.split('/').pop();
  // Create path: media/originals/{itineraryId}/{filename}
  return `media/originals/${itineraryId}/${filename}`;
}

module.exports = {
  uploadToS3,
  objectExists,
  getImgixUrl,
  generateS3Key,
  getS3Client
};
