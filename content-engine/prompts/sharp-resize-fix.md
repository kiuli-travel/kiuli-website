# Image Resize Fix — Sharp Integration for Image Processor + Labeler

**Context:** Pipeline is operational via Step Functions. 32 images fail due to oversized files: 5 fail Payload upload (413 Request Entity Too Large), 27 fail OpenRouter labeling (>20MB API limit). Root cause: full-resolution images sent directly to Payload and OpenRouter. Fix: resize for each consumer, keep originals in S3.

**RULE 0:** STOP and report if anything fails.

---

## Architecture

```
iTrvl CDN → download full res → upload ORIGINAL to S3 (unchanged, keep forever)
                               → sharp resize to 2400x1600 JPEG 85 → upload to Payload (web quality)
                               → sharp resize to 1200x800 JPEG 75 → send to OpenRouter (labeling)
```

Three consumers, three sizes:
- **S3:** Full resolution original (no change)
- **Payload Media:** 2400x1600 max, JPEG 85 quality (~200KB-1MB) — imgix handles all further transforms
- **OpenRouter:** 1200x800 max, JPEG 75 quality (~100-300KB) — AI vision doesn't need more

---

## Step 1: Add sharp to Image Processor

```bash
cd lambda/image-processor
npm install sharp --platform=linux --arch=x64
```

The `--platform=linux --arch=x64` flags ensure the binary matches Lambda's runtime (Amazon Linux 2023, x86_64). This is critical — without these flags, sharp will install the macOS binary which won't work on Lambda.

Verify the install:
```bash
ls node_modules/sharp/build/Release/
# Should contain sharp-linux-x64.node or similar
# If it contains sharp-darwin-x64.node, the platform flag didn't work
```

If the platform flag doesn't work with npm, use:
```bash
npm install sharp
npx sharp install --platform=linux --arch=x64
```

Or as a last resort:
```bash
npm install @img/sharp-linux-x64
```

## Step 2: Modify processImage.js

In `lambda/image-processor/processImage.js`:

Add at the top:
```javascript
const sharp = require('sharp');
```

After the S3 upload of the original, add a resize step before `createMediaRecord()`. The key change is: `createMediaRecord()` receives the RESIZED buffer, not the original.

Find the section that calls `createMediaRecord()`:
```javascript
const mediaId = await createMediaRecord(buffer, sourceS3Key, s3Key, itineraryId, contentType, imageContext);
```

Replace with:
```javascript
// Resize for Payload upload (web quality — imgix handles further transforms)
let uploadBuffer = buffer;
let uploadContentType = contentType;
try {
  const metadata = await sharp(buffer).metadata();
  const needsResize = metadata.width > 2400 || metadata.height > 1600 || buffer.length > 4 * 1024 * 1024;
  
  if (needsResize) {
    console.log(`[ProcessImage] Resizing for Payload: ${metadata.width}x${metadata.height} (${buffer.length} bytes)`);
    uploadBuffer = await sharp(buffer)
      .resize(2400, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    uploadContentType = 'image/jpeg';
    console.log(`[ProcessImage] Resized: ${uploadBuffer.length} bytes`);
  }
} catch (resizeError) {
  console.warn(`[ProcessImage] Resize failed, using original: ${resizeError.message}`);
  // Fall through with original buffer
}

const mediaId = await createMediaRecord(uploadBuffer, sourceS3Key, s3Key, itineraryId, uploadContentType, imageContext);
```

This means:
- Small images (< 2400x1600 and < 4MB) pass through untouched
- Large images get resized to fit within 2400x1600, JPEG 85
- If sharp fails for any reason (corrupt image, unsupported format), the original is used as fallback
- The ORIGINAL is still in S3 at full resolution — we never lose quality

## Step 3: Add sharp to Labeler

```bash
cd lambda/labeler
npm install sharp --platform=linux --arch=x64
```

Same platform verification as Step 1.

## Step 4: Modify labelImage.js

In `lambda/labeler/labelImage.js`:

Add at the top:
```javascript
const sharp = require('sharp');
```

Find the section that converts to base64 (there are two paths: S3 and imgix fallback). After BOTH paths produce a buffer, add a resize step before base64 encoding.

The current code has something like:
```javascript
base64 = Buffer.from(imageBuffer).toString('base64');
// or
base64 = Buffer.concat(chunks).toString('base64');
```

Replace BOTH base64 encoding steps with a shared resize-then-encode pattern:

```javascript
// After obtaining the raw image buffer (from S3 or imgix)...
// Resize for AI labeling — vision models don't need high resolution
let labelBuffer = imageBuffer; // or Buffer.concat(chunks) for S3 path
try {
  const metadata = await sharp(labelBuffer).metadata();
  const needsResize = metadata.width > 1200 || metadata.height > 800 || labelBuffer.length > 10 * 1024 * 1024;
  
  if (needsResize) {
    console.log(`[Labeler] Resizing for AI: ${metadata.width}x${metadata.height} (${labelBuffer.length} bytes)`);
    labelBuffer = await sharp(labelBuffer)
      .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    console.log(`[Labeler] Resized: ${labelBuffer.length} bytes`);
  }
} catch (resizeError) {
  console.warn(`[Labeler] Resize failed, using original: ${resizeError.message}`);
  // Fall through with original buffer — may still fail at OpenRouter if too large
}

const base64 = labelBuffer.toString('base64');
```

The 10MB threshold for labeler is more generous than the 4MB for Payload because OpenRouter's limit is 20MB (base64). But resizing anything over 1200x800 ensures we're well within limits.

## Step 5: Update package.json files

Verify sharp is in both package.json files:

```bash
cat lambda/image-processor/package.json | grep sharp
cat lambda/labeler/package.json | grep sharp
```

Both should show `"sharp": "^0.33.x"` or similar.

## Step 6: Test sharp locally (quick sanity check)

```bash
cd lambda/image-processor
node -e "const sharp = require('sharp'); sharp(Buffer.from('not an image')).metadata().catch(e => console.log('Sharp works, error expected:', e.message))"
```

If this prints "Sharp works, error expected: ..." then sharp loads correctly. If it throws a different error about loading the binary, the platform flag didn't work.

## Step 7: Deploy Both Lambdas

Sync shared code first:
```bash
cd lambda && bash sync-shared.sh && cd ..
```

Image processor:
```bash
cd lambda/image-processor
npm ci --omit=dev
# Re-install sharp with correct platform after npm ci
npm install sharp --platform=linux --arch=x64
zip -r function.zip handler.js processImage.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-image-processor \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
cd ../..
```

Labeler:
```bash
cd lambda/labeler
npm ci --omit=dev
npm install sharp --platform=linux --arch=x64
zip -r function.zip handler.js labelImage.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-labeler \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
cd ../..
```

Verify both deployed:
```bash
for fn in kiuli-v6-image-processor kiuli-v6-labeler; do
  echo "=== $fn ==="
  aws lambda get-function-configuration \
    --function-name $fn \
    --region eu-north-1 \
    --query '{State: State, LastModified: LastModified, CodeSize: CodeSize}' \
    --output table
done
```

Both must show today's date and Active state. CodeSize will be larger now due to sharp binary (~30-50MB).

NOTE: Lambda has a 50MB zip upload limit and 250MB uncompressed limit. Sharp is large. If the zip exceeds 50MB:
```bash
# Check zip size before uploading
ls -lh function.zip
```

If over 50MB, upload via S3 instead:
```bash
aws s3 cp function.zip s3://kiuli-bucket/lambda-deploy/image-processor.zip
aws lambda update-function-code \
  --function-name kiuli-v6-image-processor \
  --s3-bucket kiuli-bucket \
  --s3-key lambda-deploy/image-processor.zip \
  --region eu-north-1
```

## Step 8: Commit

```
feat: add sharp image resize for Payload upload and AI labeling

- processImage.js: resize to 2400x1600 JPEG 85 before Payload upload (fixes 413 errors)
- labelImage.js: resize to 1200x800 JPEG 75 before OpenRouter API (fixes 20MB limit)
- Originals preserved at full resolution in S3
- Graceful fallback: if sharp fails, original buffer used
```

## Step 9: Re-scrape Itinerary 28

This will pick up the 5 failed uploads (no media record → fresh download → resize → upload) and the 27 failed labels (media exists with labelingStatus=failed → labeler picks up → resize → label).

First, reset the 27 failed labeling statuses:
```sql
UPDATE media
SET labeling_status = 'pending',
    processing_error = NULL
WHERE labeling_status = 'failed'
  AND media_type != 'video';
```

Then trigger:
```sql
SELECT source_itrvl_url FROM itineraries WHERE id = 28;
```

```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "<URL>", "mode": "update"}'
```

Monitor via Step Functions. Wait for SUCCEEDED.

## Step 10: Verify

```sql
-- Job status
SELECT id, status, total_images, processed_images, skipped_images, failed_images, duration
FROM itinerary_jobs ORDER BY id DESC LIMIT 1;

-- THE KEY METRIC: failed should be 0 or near-0
-- Pending should be 0 or near-0
SELECT labeling_status, count(*)
FROM media WHERE media_type != 'video'
GROUP BY labeling_status;

-- All itineraries
SELECT i.id, i.title, array_length(i.images, 1) as linked_images
FROM itineraries i ORDER BY i.id;

-- Any remaining failures?
SELECT processing_error, count(*)
FROM media
WHERE labeling_status = 'failed' AND media_type != 'video'
GROUP BY processing_error;
```

## Report

```
SHARP RESIZE FIX REPORT
========================

Sharp installed: image-processor [size]MB, labeler [size]MB
Deployed: image-processor [ts], labeler [ts]

Job [id] (itinerary 28 re-scrape):
  Status: [s]
  Duration: [n]s
  Processed (new — previously failed uploads): [n]
  Skipped: [n]
  Failed: [n]

Labeling:
  Before: complete=[n], pending=[n], failed=[n]
  After:  complete=[n], pending=[n], failed=[n]

Previously failed images:
  5 upload failures: [n] now uploaded / [n] still failing
  27 labeling failures: [n] now labeled / [n] still failing

All itineraries:
  23: [n]  24: [n]  25: [n]  26: [n]  27: [n]  28: [n]

STATUS: READY FOR BULK / BLOCKED
```
