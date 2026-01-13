# KIULI SCRAPER DEEP FORENSIC AUDIT

**Audit Date:** January 10, 2026
**Evidence Files:** /tmp/audit-evidence/
**Principle:** Show, don't tell. Every claim backed by code or output.

---

## 1. Uncommitted Changes - ACTUAL DIFFS

### 1.1 itrvl_scraper.cjs

**File:** `/tmp/audit-evidence/diff-itrvl_scraper.txt`

```diff
-function extractS3Keys(obj, keys = []) {
+function extractS3Keys(obj, keys = [], path = '') {
   if (!obj || typeof obj !== 'object') {
     return keys;
   }

   if (Array.isArray(obj)) {
-    obj.forEach((item) => extractS3Keys(item, keys));
+    obj.forEach((item, idx) => extractS3Keys(item, keys, `${path}[${idx}]`));
   } else {
     Object.keys(obj).forEach((key) => {
+      const newPath = path ? `${path}.${key}` : key;
+
+      // Skip agency branding assets
+      if (newPath.includes('.agency.')) {
+        return;
+      }
+
+      // Case 1: Standard s3Key fields
       if (key === 's3Key' && typeof obj[key] === 'string') {
         keys.push(obj[key]);
-      } else if (typeof obj[key] === 'object') {
-        extractS3Keys(obj[key], keys);
+      }
+      // Case 2: 'images' arrays (contain s3Key strings directly)
+      else if (key === 'images' && Array.isArray(obj[key])) {
+        obj[key].forEach((imageKey) => {
+          if (typeof imageKey === 'string') {
+            keys.push(imageKey);
+          }
+        });
+      }
+      // Case 3: 'headerImage' fields (s3Key strings directly)
+      else if (key === 'headerImage' && typeof obj[key] === 'string') {
+        keys.push(obj[key]);
+      }
+      // Recurse into nested objects/arrays
+      else if (typeof obj[key] === 'object') {
+        extractS3Keys(obj[key], keys, newPath);
       }
     });
   }
```

**OLD Behavior:**
- Recursively extracted ALL s3Key fields from itinerary data
- Included agency branding assets (logos, terms and conditions)

**NEW Behavior:**
- Skips paths containing `.agency.` (agency branding)
- Handles `images` arrays directly (contain s3Key strings)
- Handles `headerImage` fields directly
- Tracks path during recursion for filtering

**Problem Solved:** Prevents downloading agency logos and T&C documents

**New Risk:** None identified

---

### 1.2 media_rehoster.cjs (MAJOR REWRITE)

**File:** `/tmp/audit-evidence/diff-media_rehoster.txt`

**OLD Code (COMMITTED):**
```javascript
async function uploadToPayload(buffer, contentType, s3Key, apiUrl, apiKey) {
  // Create form data
  const formData = new FormData();
  formData.append('file', buffer, { filename, contentType });

  // Upload via Payload API
  const response = await axios.post(`${apiUrl}/api/media`, formData, {
    headers: { ...formData.getHeaders(), 'Authorization': `users API-Key ${apiKey}` },
    maxBodyLength: Infinity,
  });
}
```

**NEW Code (UNCOMMITTED):**
```javascript
// NEW: Direct S3 upload function
async function uploadDirectlyToS3(buffer, contentType, s3Key, itineraryId) {
  // Prefix filename with itineraryId for uniqueness
  const filename = `${itineraryId}_${s3Key.replace(/\//g, '_')}`;

  const s3Client = new S3Client({
    region: process.env.S3_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: filename,
    Body: buffer,
    ContentType: contentType,
  }));

  return { filename, s3Url: `${process.env.PAYLOAD_PUBLIC_MEDIA_BASE_URL}/${filename}` };
}

// NEW: Create Payload record with metadata only
async function createPayloadMediaRecord(filename, s3Url, filesize, mimeType, apiUrl, apiKey) {
  await axios.post(`${apiUrl}/api/media`, {
    filename, url: s3Url, filesize, mimeType,
  }, {
    headers: { 'Authorization': `users API-Key ${apiKey}`, 'Content-Type': 'application/json' },
  });
}
```

**OLD Behavior:**
- Downloaded image from iTrvl CDN
- Uploaded image data via Payload API multipart form
- Payload handled S3 upload internally

**NEW Behavior:**
- Downloaded image from iTrvl CDN
- **Uploads directly to S3** using AWS SDK
- Creates Payload media record with **metadata only** (no file upload)
- Prefixes filename with `itineraryId_` for cross-itinerary uniqueness

**Problem Solved:** Bypasses Payload API body size limits

**NEW DEPENDENCY ADDED:**
```diff
+"@aws-sdk/client-s3": "^3.932.0",
```

---

### 1.3 run_full_pipeline.cjs

**File:** `/tmp/audit-evidence/diff-run_full_pipeline.txt`

```diff
-require('dotenv').config({ path: '.env.local' });
+require('dotenv').config({ path: '.env.local', override: true });
```

**Problem Solved:** Ensures .env.local values override any existing environment variables

---

## 2. API Route Authentication - ACTUAL CODE

**File:** `src/app/(payload)/api/scrape-itinerary/route.ts`

```typescript
export async function POST(request: NextRequest) {
  let jobId: string | null = null

  try {
    // Parse request body
    const body = await request.json()
    const { itrvlUrl } = body

    // Validate input
    if (!itrvlUrl || typeof itrvlUrl !== 'string') {
      return NextResponse.json({ success: false, error: '...' }, { status: 400 })
    }

    // NO AUTHENTICATION CHECK HERE
    // Anyone can POST to this endpoint

    // Proceeds directly to pipeline execution
    const { runFullPipeline } = await import('../../../../../pipelines/run_full_pipeline.cjs')
    const result = await runFullPipeline(itrvlUrl, { silent: false })
    // ...
  }
}
```

**EVIDENCE: NO AUTHENTICATION**

The route has:
- NO API key validation
- NO session check
- NO middleware protection
- NO rate limiting

**Middleware file (`middleware.ts`) only handles redirects:**
```typescript
export function middleware(request: NextRequest) {
  // Only handles www redirect and admin.kiuli.com root redirect
  // NO authentication
}
```

---

## 3. Phase 3 Failure - ROOT CAUSE ANALYSIS

### 3.1 Media Mapping Analysis

**Total Images:** 244
**Successful:** 125 (51%)
**Failed:** 119 (49%)

### 3.2 Error Breakdown

| Error Type | Count | Cause |
|------------|-------|-------|
| "Value must be unique" (filename) | ~115 | Database unique constraint |
| "timeout of 30000ms exceeded" | 2 | API timeout |
| "stream has been aborted" | 1 | Download failure |
| "time difference too large" | 1 | S3 clock skew |

### 3.3 Unique Constraint Source

**Found in:** `src/migrations/20251107_183848_initial.ts:1008`

```sql
CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
```

**This is a database-level unique constraint on the `filename` column in the `media` table.**

### 3.4 Why Errors Occurred

The prior run processed itinerary `680dff493cf205005cf76e8f` **TWICE**:

1. **First run:** Uploaded images with filenames like `680dff493cf205005cf76e8f_99b7916c-0d51-401f-b55c-08aceee38d90_1.png`
2. **Second run (or retry):** Tried to upload the SAME filenames, hit unique constraint

**The uncommitted code DOES add `itineraryId_` prefix, but that doesn't help when re-processing the SAME itinerary.**

### 3.5 Sample Failure Evidence

```json
{
  "s3Key": "99b7916c-0d51-401f-b55c-08aceee38d90_1.png",
  "payloadMediaID": null,
  "newS3Url": null,
  "status": "failed",
  "error": "Failed to create Payload record (400): {\"errors\":[{\"name\":\"h\",\"data\":{\"errors\":[{\"message\":\"Value must be unique\",\"path\":\"filename\"}]}...}",
  "attempts": 3
}
```

### 3.6 Why Pipeline Stopped

Looking at the media-mapping.json - the pipeline **DID complete Phase 3**. It processed all 244 images (125 success, 119 failed).

**The pipeline stopped because:**
- Phase 4 requires `raw-itinerary.json` (exists)
- Phase 4 outputs `enhanced-itinerary.json` (MISSING)
- **The run was likely manually interrupted or the script crashed**

---

## 4. Validation Scripts - ACTUAL RESULTS

### 4.1 Phase 0 Validation (EXECUTED)

```
============================================================
  PHASE 0: ENVIRONMENT & PREREQUISITE VALIDATION
============================================================

[1/5] Checking Node.js version...
  ✓ Node.js version: v24.4.1 (>= 18.x)

[2/5] Checking Vercel CLI...
  ✓ Vercel CLI installed: 48.9.0

[3/5] Checking Payload CMS API...
  ✓ PAYLOAD_API_URL: https://admin.kiuli.com
  ✓ PAYLOAD_API_KEY: 4ea3d6c7...
  → Testing API connection...
  ✓ Payload API responded with status 200

[4/5] Checking Gemini AI API...
  ✓ GEMINI_API_KEY: AIzaSyCN...

[5/5] Checking Google Service Account...
  ✗ GOOGLE_SERVICE_ACCOUNT_JSON_PATH environment variable not set
  ℹ Note: This check is expected to fail in Phase 0 (Human Gate)

============================================================
  VALIDATION SUMMARY
============================================================

✓ PASSED (4):
  • Node.js Version
  • Vercel CLI
  • Payload CMS API
  • Gemini AI API

✗ FAILED (1):
  • Google Service Account

============================================================
  ✓ VALIDATION PASSED
  Ready to proceed to Phase 2
============================================================
```

### 4.2 Vercel CLI State

```
Error: No existing credentials found. Please run `vercel login`
```

**Note:** Phase 0 validation checks `vercel --version`, not `vercel whoami`

---

## 5. Environment State - VERIFIED

### 5.1 .env.local Variables (NAMES ONLY)

```
POSTGRES_URL: SET
PAYLOAD_SECRET: SET
PAYLOAD_API_URL: SET
PAYLOAD_API_KEY: SET
GEMINI_API_KEY: SET
AWS_ACCESS_KEY_ID: SET
AWS_SECRET_ACCESS_KEY: SET
S3_BUCKET: SET
S3_REGION: SET
PAYLOAD_PUBLIC_MEDIA_BASE_URL: SET
```

### 5.2 Missing Variables

- `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` - Expected (Phase 9 not implemented)

---

## 6. Pipeline Code - KEY LOGIC

### 6.1 Execution Sequence (run_full_pipeline.cjs)

```javascript
// Phase 2: Scraping
const { scrapeItrvl } = require('../scrapers/itrvl_scraper.cjs');
await scrapeItrvl(itrvlUrl);

// Phase 3: Media Rehosting
const { rehostMedia } = require('../processors/media_rehoster.cjs');
await rehostMedia(itineraryId);

// Phase 4: Content Enhancement
const { enhanceContent } = require('../processors/content_enhancer.cjs');
await enhanceContent(itineraryId);

// Phase 5: Schema Generation with 3 RETRY ATTEMPTS
const MAX_VALIDATION_ATTEMPTS = 3;
for (let attempt = 1; attempt <= MAX_VALIDATION_ATTEMPTS; attempt++) {
  await generateSchema(itineraryId);
  await validateSchema(itineraryId);  // Uses Ajv
}

// Phase 6: FAQ Formatting
const { formatFAQ } = require('../processors/faq_formatter.cjs');
await formatFAQ(itineraryId);

// Phase 7: Payload Ingestion
const { ingestToPayload } = require('../loaders/payload_ingester.cjs');
await ingestToPayload(itineraryId);
```

### 6.2 Error Handling Summary

| Component | Has Retry | Has Fallback | Errors Thrown |
|-----------|-----------|--------------|---------------|
| Scraper | No | No | Yes |
| Media Rehoster | Yes (3x per image) | No | Yes |
| Content Enhancer | No | Skips segment | No |
| Schema Generator | Yes (3x in pipeline) | Creates failed entry | Yes |
| FAQ Formatter | No | No | Yes |
| Payload Ingester | No | No | Yes |

### 6.3 Gemini Rate Limiting

**NO RATE LIMITING IMPLEMENTED** in content_enhancer.cjs

```javascript
// NO retry/backoff logic found
const result = await model.generateContent(prompt);
```

All segments are processed in **parallel** with `Promise.all`:
```javascript
const enhancementPromises = segments.map((segment, index) => {
  return processSegment(segment, index, segments.length, genAI);
});
const enhanced = await Promise.all(enhancementPromises);
```

**Risk:** May hit Gemini API rate limits with large itineraries

---

## 7. Collection Schemas - FIELDS

### 7.1 Media Collection

```typescript
export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    staticDir: path.resolve(dirname, '../../public/media'),
    // imageSizes defined...
  },
  fields: [
    { name: 'alt', type: 'text' },
    { name: 'caption', type: 'richText' },
  ],
}
```

**Note:** `filename` field is managed automatically by Payload upload collections.
**UNIQUE constraint enforced at database level.**

### 7.2 Itineraries Collection

| Field | Type | Required |
|-------|------|----------|
| title | text | Yes |
| images | relationship (media) | No |
| rawItinerary | json | No |
| enhancedItinerary | json | No |
| schema | json | No |
| faq | textarea | No |
| schemaStatus | select | Yes |
| googleInspectionStatus | select | Yes |
| buildTimestamp | date | Yes |
| googleFailureLog | textarea | No |

### 7.3 S3 Storage Plugin

**File:** `src/plugins/s3Storage.ts`

```typescript
export const makeS3StoragePlugin = () =>
  s3Storage({
    collections: { media: true },
    bucket: process.env.S3_BUCKET,
    config: {
      region: process.env.S3_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    },
  })
```

---

## 8. Documentation Accuracy

### 8.1 CLAUDE.md Claims vs Code Reality

| Claim | Code Evidence | Status |
|-------|---------------|--------|
| gemini-2.0-flash | `model: 'gemini-2.0-flash'` at line 81 | ✓ ACCURATE |
| GEMINI_API_KEY | `process.env.GEMINI_API_KEY` at line 39 | ✓ ACCURATE |
| S3_BUCKET | `process.env.S3_BUCKET` in s3Storage.ts | ✓ ACCURATE |
| S3_REGION | `process.env.S3_REGION` in s3Storage.ts | ✓ ACCURATE |
| kiuli-bucket | Confirmed in media-mapping URLs | ✓ ACCURATE |
| eu-north-1 | Confirmed in media-mapping URLs | ✓ ACCURATE |
| Direct S3 upload | **UNCOMMITTED** - code exists but not committed | ⚠ INACCURATE |

### 8.2 Discrepancies Found

1. **CLAUDE.md says direct S3 upload is implemented** - But the code is UNCOMMITTED
2. **No mention of unique filename constraint** - Critical operational detail missing

---

## 9. Can Phase 4+ Run Standalone?

**YES.** Each processor accepts `itineraryId` and reads from output directory:

```javascript
// content_enhancer.cjs
async function enhanceContent(itineraryId) {
  const inputPath = getOutputFilePath(itineraryId, 'raw-itinerary.json');
  // Reads raw-itinerary.json, outputs enhanced-itinerary.json
}
```

**To run Phase 4 on existing data:**
```bash
node -e "require('./processors/content_enhancer.cjs').enhanceContent('680dff493cf205005cf76e8f')"
```

**Prerequisites:**
- `output/680dff493cf205005cf76e8f/raw-itinerary.json` exists (YES)
- `GEMINI_API_KEY` is set (YES)

---

## 10. Evidence Files Created

| File | Location |
|------|----------|
| diff-itrvl_scraper.txt | /tmp/audit-evidence/ |
| diff-media_rehoster.txt | /tmp/audit-evidence/ |
| diff-run_full_pipeline.txt | /tmp/audit-evidence/ |
| diff-package.txt | /tmp/audit-evidence/ |
| route-ts-full.txt | /tmp/audit-evidence/ |
| media-mapping-sample.txt | /tmp/audit-evidence/ |
| validate-phase-0.txt | /tmp/audit-evidence/ |
| env-check.txt | /tmp/audit-evidence/ |

---

## 11. Recommended Actions (Ordered)

### IMMEDIATE (Do Now)

1. **COMMIT UNCOMMITTED CHANGES**
   ```bash
   git add -A
   git commit -m "feat: direct S3 upload, agency asset filtering, dotenv override"
   git push origin main
   ```

2. **DELETE EXISTING MEDIA RECORDS** for itinerary 680dff493cf205005cf76e8f
   - This clears the unique constraint violation
   - Can be done via Payload admin or API

### SHORT-TERM (To Complete First Pipeline)

3. **CLEAR OUTPUT DIRECTORY**
   ```bash
   rm -rf output/680dff493cf205005cf76e8f
   ```

4. **RUN FULL PIPELINE**
   ```bash
   node pipelines/run_full_pipeline.cjs "https://itrvl.com/client/portal/ACCESS_KEY/680dff493cf205005cf76e8f"
   ```

5. **VERIFY COMPLETION**
   - Check all files in output/
   - Check Payload admin for new itinerary entry

### BEFORE PRODUCTION

6. **ADD API AUTHENTICATION**
   ```typescript
   // In route.ts, add:
   const authHeader = request.headers.get('x-api-key');
   if (authHeader !== process.env.SCRAPER_API_KEY) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
   }
   ```

7. **ADD RATE LIMITING**
   - Consider implementing for Gemini API calls
   - Consider implementing for the scrape endpoint

8. **LOGIN TO VERCEL**
   ```bash
   vercel login
   ```

---

## 12. Key Findings Summary

| Finding | Severity | Evidence |
|---------|----------|----------|
| 5 files uncommitted | CRITICAL | git status |
| No API authentication | CRITICAL | route.ts has no auth check |
| 119/244 images failed | HIGH | media-mapping.json analysis |
| Unique filename constraint | HIGH | migrations SQL |
| No Gemini rate limiting | MEDIUM | No retry/backoff in code |
| Vercel CLI not logged in | LOW | vercel whoami error |
| Documentation accurate (mostly) | INFO | Code matches claims |

---

**This audit is complete. All findings backed by code evidence or command output.**
