/**
 * S3 Service for direct uploads
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

let s3Client = null;

function getS3Client() {
  if (!s3Client) {
    // Use custom env var names since AWS_ACCESS_KEY_ID is reserved in Lambda
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
 * @param {Buffer} buffer - File content
 * @param {string} key - S3 object key (path)
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - S3 key
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
 * Generate imgix URL from S3 key
 * @param {string} s3Key - S3 object key
 * @param {object} transforms - imgix transformation parameters
 * @returns {string} - imgix URL
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

module.exports = { uploadToS3, getImgixUrl, getS3Client };
