# Kiuli Lambda Scraper Architecture

**Version:** 7.0
**Last Updated:** January 22, 2026
**Status:** Production
**Owner:** Graham Wallington

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Lambda Functions](#3-lambda-functions)
4. [Data Flow](#4-data-flow)
5. [Payload CMS Collections](#5-payload-cms-collections)
6. [Shared Modules](#6-shared-modules)
7. [External Services](#7-external-services)
8. [Environment Variables](#8-environment-variables)
9. [Design Patterns](#9-design-patterns)
10. [Error Handling](#10-error-handling)
11. [Deployment](#11-deployment)
12. [Debugging & Monitoring](#12-debugging--monitoring)
13. [Common Operations](#13-common-operations)

---

## 1. Overview

The Kiuli Lambda scraper is a **4-phase asynchronous pipeline** that transforms iTrvl travel itinerary data into production-ready luxury safari content for the Kiuli website.

### What It Does

1. **Scrapes** itinerary data from iTrvl portal URLs
2. **Processes** and re-hosts all images to Kiuli's S3/imgix CDN
3. **Enriches** images with AI-generated metadata (scene descriptions, alt text, tags)
4. **Finalizes** the itinerary with hero image selection, JSON-LD schema, and publish checklist

### Key Technologies

| Component | Technology |
|-----------|------------|
| Compute | AWS Lambda (Node.js 20.x) |
| Web Scraping | Puppeteer + Chromium |
| Storage | AWS S3 + imgix CDN |
| Database | Payload CMS (PostgreSQL) |
| AI Enrichment | Nemotron (via OpenRouter) |
| Region | eu-north-1 (Stockholm) |

### Pipeline Duration

- Small itinerary (20 images): ~2 minutes
- Medium itinerary (50 images): ~5 minutes
- Large itinerary (200+ images): ~15-20 minutes

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KIULI SCRAPER PIPELINE                            │
└─────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │   Admin UI   │
    │  or API Call │
    └──────┬───────┘
           │ POST /api/scrape-itinerary
           ▼
┌──────────────────────┐
│   ORCHESTRATOR       │  Phase 1
│   (kiuli-v6-         │  ─────────────────────────────────────────────────
│    orchestrator)     │  • Validates iTrvl URL
│                      │  • Calls Scraper Lambda (HTTP)
│                      │  • Transforms data to V7 schema
│                      │  • Creates draft Itinerary in Payload
│                      │  • Creates ImageStatus records
│                      │  • Triggers Image Processor
└──────────┬───────────┘
           │ HTTP call
           ▼
┌──────────────────────┐
│   SCRAPER            │  Phase 0 (called by Orchestrator)
│   (kiuli-scraper)    │  ─────────────────────────────────────────────────
│                      │  • Launches headless Chrome
│                      │  • Navigates to iTrvl portal
│                      │  • Intercepts API responses
│                      │  • Extracts itinerary + image URLs
│                      │  • Returns structured data
└──────────────────────┘
           │
           │ Async invoke
           ▼
┌──────────────────────┐
│   IMAGE PROCESSOR    │  Phase 2
│   (kiuli-v6-image-   │  ─────────────────────────────────────────────────
│    processor)        │  • Processes 20 images per invocation
│                      │  • Checks global deduplication
│                      │  • Downloads from iTrvl CDN
│                      │  • Uploads to Kiuli S3
│                      │  • Creates Media records in Payload
│                      │  • Self-invokes for remaining images
│                      │  • Triggers Labeler when complete
└──────────┬───────────┘
           │ Self-invoke (if more images)
           │ OR async invoke Labeler
           ▼
┌──────────────────────┐
│   LABELER            │  Phase 3
│   (kiuli-v6-labeler) │  ─────────────────────────────────────────────────
│                      │  • Processes 10 images per batch
│                      │  • Fetches image via imgix
│                      │  • Calls Nemotron with context
│                      │  • Parses structured JSON response
│                      │  • Updates Media with enrichment
│                      │  • Self-invokes for remaining images
│                      │  • Triggers Finalizer when complete
└──────────┬───────────┘
           │ Async invoke
           ▼
┌──────────────────────┐
│   FINALIZER          │  Phase 4
│   (kiuli-v6-         │  ─────────────────────────────────────────────────
│    finalizer)        │  • Links images to itinerary segments
│                      │  • Selects hero image
│                      │  • Generates JSON-LD schema
│                      │  • Validates against Google requirements
│                      │  • Calculates publish checklist
│                      │  • Updates Itinerary + Job
│                      │  • Sends completion notification
└──────────────────────┘
           │
           ▼
    ┌──────────────┐
    │   COMPLETE   │
    │  Itinerary   │
    │  ready for   │
    │   review     │
    └──────────────┘
```

---

## 3. Lambda Functions

### 3.1 Scraper Lambda

**Function Name:** `kiuli-scraper`
**Handler:** `lambda/handler.js`
**Invocation:** HTTP (Function URL)
**Timeout:** 120 seconds
**Memory:** 1024 MB

**Purpose:** Web scraping of iTrvl portal using headless Chrome.

**Dependencies:**
- `puppeteer-core` - Browser automation
- `@sparticuz/chromium` - Chromium binary for Lambda (via Layer)

**Input:**
```json
{
  "itrvlUrl": "https://itrvl.com/client/portal/{accessKey}/{itineraryId}",
  "secret": "your-scraper-secret"
}
```

**Output:**
```json
{
  "success": true,
  "data": {
    "itinerary": { /* Full renderDataClient response */ },
    "images": ["s3key1", "s3key2", ...],
    "price": 450000
  },
  "itineraryId": "680dff493cf205005cf76e8f"
}
```

**Key Functions:**
- `parseItrvlUrl(url)` - Extracts accessKey and itineraryId
- `scrapeItrvl(browser, url)` - Main scraping logic with API interception
- `extractS3Keys(obj)` - Recursively extracts image URLs from response

---

### 3.2 Orchestrator Lambda

**Function Name:** `kiuli-v6-orchestrator`
**Handler:** `lambda/orchestrator/handler.js`
**Invocation:** Async (from Vercel API)
**Timeout:** 900 seconds (15 min)
**Memory:** 512 MB

**Purpose:** Pipeline coordination - scraping, transformation, and job setup.

**Input:**
```json
{
  "jobId": 30,
  "itrvlUrl": "https://itrvl.com/client/portal/...",
  "mode": "create"
}
```

**Output:**
```json
{
  "success": true,
  "jobId": 30,
  "itineraryId": 19,
  "imagesFound": 50,
  "mode": "create",
  "duration": 78.5
}
```

**Key Functions:**
- `transform(rawData, mediaMapping, itrvlUrl)` - Converts scraped data to V7 schema
- `mapSegmentType(type)` - Normalizes iTrvl segment types
- `groupSegmentsByDay(segments)` - Groups segments for day-based structure

**Side Effects:**
- Creates Itinerary record in Payload
- Creates ImageStatus records (1 per image)
- Invokes Image Processor Lambda

---

### 3.3 Image Processor Lambda

**Function Name:** `kiuli-v6-image-processor`
**Handler:** `lambda/image-processor/handler.js`
**Invocation:** Async
**Timeout:** 900 seconds
**Memory:** 1024 MB

**Purpose:** Download, re-host, and catalog images.

**Constants:**
- `CHUNK_SIZE = 20` - Images per invocation

**Input:**
```json
{
  "jobId": 30,
  "itineraryId": 19,
  "chunkIndex": 0
}
```

**Output:**
```json
{
  "success": true,
  "processed": 18,
  "skipped": 2,
  "failed": 0,
  "remaining": 30
}
```

**Key Functions:**
- `processImage(sourceS3Key, itineraryId, context)` - Per-image processing
- `createMediaRecord(buffer, sourceS3Key, ...)` - Creates Payload Media entry
- `updateImageStatus(jobId, sourceS3Key, status, mediaId)` - Tracks progress

**Side Effects:**
- Uploads images to S3
- Creates Media records in Payload
- Updates ImageStatus records
- Self-invokes for next chunk OR invokes Labeler

---

### 3.4 Labeler Lambda

**Function Name:** `kiuli-v6-labeler`
**Handler:** `lambda/labeler/handler.js`
**Invocation:** Async
**Timeout:** 900 seconds
**Memory:** 512 MB

**Purpose:** AI-powered image enrichment using Nemotron (via OpenRouter).

**Constants:**
- `BATCH_SIZE = 10` - Images per batch
- `CONCURRENT = 3` - Parallel AI calls

**Input:**
```json
{
  "jobId": 30,
  "itineraryId": 19,
  "batchIndex": 0
}
```

**Output:**
```json
{
  "success": true,
  "labeled": 10,
  "failed": 0,
  "remaining": 40
}
```

**Key Functions:**
- `labelImage(media, context)` - Calls Nemotron for enrichment
- `processMediaLabeling(media, imageStatuses)` - Wrapper with context lookup

**Enrichment Fields Generated:**
```json
{
  "scene": "Elephants crossing golden savanna at sunset",
  "mood": ["serene", "majestic"],
  "timeOfDay": "golden-hour",
  "setting": ["savanna", "wildlife-viewing"],
  "composition": "establishing",
  "animals": ["elephant", "zebra"],
  "altText": "Family of elephants crossing the Masai Mara at sunset",
  "tags": ["wildlife", "elephant", "sunset", "safari", "kenya"],
  "suitableFor": ["hero-banner", "gallery"],
  "quality": "high",
  "imageType": "wildlife"
}
```

---

### 3.5 Finalizer Lambda

**Function Name:** `kiuli-v6-finalizer`
**Handler:** `lambda/finalizer/handler.js`
**Invocation:** Async
**Timeout:** 300 seconds
**Memory:** 256 MB

**Purpose:** Final processing - image linking, hero selection, schema generation.

**Input:**
```json
{
  "jobId": 30,
  "itineraryId": 19
}
```

**Output:**
```json
{
  "success": true,
  "status": "ready_for_review",
  "heroImage": 722,
  "publishChecklist": {
    "allImagesProcessed": true,
    "noFailedImages": true,
    "heroImageSelected": true,
    "contentEnhanced": false,
    "schemaGenerated": true,
    "schemaValid": true,
    "metaFieldsFilled": true
  },
  "blockers": 1,
  "duration": 12.5
}
```

**Key Functions:**
- `linkImagesToSegments(itinerary, imageStatuses)` - Matches images to segments
- `selectHeroImage(mediaRecords)` - Priority-based hero selection
- `generateSchema(itinerary, mediaRecords, heroImageId)` - JSON-LD generation
- `validateSchema(schema)` - Google Rich Results validation

---

## 4. Data Flow

### 4.1 Scrape Request Flow

```
1. User clicks "Import Itinerary" in Admin UI
2. Frontend POST to /api/scrape-itinerary with iTrvl URL
3. API creates Job record (status: pending)
4. API invokes Orchestrator Lambda (async)
5. API returns jobId immediately
6. Frontend polls /api/job-status/{jobId} for progress
```

### 4.2 Image Context Preservation

Images maintain context throughout the pipeline:

```
Scrape → segment has images[] with s3Keys
         ↓
Orchestrator → ImageStatus records created with:
               - sourceS3Key
               - propertyName (accommodation name)
               - segmentType (stay/activity/transfer)
               - dayIndex
               - country
         ↓
Image Processor → Media records created with:
                  - sourceS3Key (for dedup)
                  - sourceProperty, sourceSegmentType, etc.
         ↓
Labeler → AI enrichment uses context for better results:
          "This is an image from Angama Mara lodge in Kenya"
         ↓
Finalizer → Links images back to segments by matching:
            segmentType + propertyName
```

### 4.3 Deduplication Strategy

```
Image Processor checks BEFORE processing:

1. Query: Media.findOne({ sourceS3Key: key })
2. If exists:
   - Mark ImageStatus as 'skipped'
   - Reuse existing mediaId
   - Skip download/upload
3. If not exists:
   - Download from iTrvl
   - Upload to S3
   - Create Media record
   - Update ImageStatus with new mediaId
```

---

## 5. Payload CMS Collections

### 5.1 itineraries

Main content collection for safari itineraries.

**Key Fields:**
```typescript
{
  // Identity
  title: string
  slug: string
  itineraryId: string          // Source iTrvl ID

  // V7 Two-Field Pattern (example)
  titleItrvl: string           // Original from scrape
  titleEnhanced: string | null // Human/AI enhanced
  titleReviewed: boolean       // Review status

  // Structure
  overview: {
    summaryItrvl: RichText
    summaryEnhanced: RichText | null
    nights: number
    countries: [{ country: string }]
    highlights: [{ highlight: string }]
  }

  days: [{
    dayNumber: number
    date: string
    titleItrvl: string
    segments: [StayBlock | ActivityBlock | TransferBlock]
  }]

  // Media
  images: Relationship<Media>[]    // All images (flat)
  heroImage: Relationship<Media>   // Selected hero

  // SEO
  metaTitle: string
  metaDescription: string
  schema: JSON                     // JSON-LD

  // Status
  _status: 'draft' | 'published'
  publishChecklist: {...}
  publishBlockers: [{reason, severity}]
}
```

### 5.2 itinerary-jobs

Pipeline execution tracking.

**Key Fields:**
```typescript
{
  itrvlUrl: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  currentPhase: string

  // Counters
  totalImages: number
  processedImages: number
  skippedImages: number
  failedImages: number
  progress: number              // 0-100

  // Timing
  startedAt: Date
  completedAt: Date
  duration: number              // seconds
  phase1CompletedAt: Date
  phase2CompletedAt: Date
  phase3CompletedAt: Date
  phase4CompletedAt: Date

  // Relations
  processedItinerary: Relationship<Itinerary>
}
```

### 5.3 media

Image storage and metadata.

**Key Fields:**
```typescript
{
  filename: string
  mimeType: string
  filesize: number

  // S3/CDN
  url: string                   // S3 URL
  imgixUrl: string              // Optimized CDN URL
  originalS3Key: string         // Key in Kiuli S3
  sourceS3Key: string           // Key from iTrvl (for dedup)

  // Source Context
  sourceProperty: string        // e.g., "Angama Mara"
  sourceSegmentType: 'stay' | 'activity' | 'transfer'
  sourceSegmentTitle: string
  sourceDayIndex: number
  country: string

  // AI Enrichment
  scene: string
  mood: string[]
  timeOfDay: string
  setting: string[]
  composition: string
  animals: string[]
  altText: string
  tags: string[]
  suitableFor: string[]
  quality: 'high' | 'medium' | 'low'
  imageType: string
  isHero: boolean

  // Status
  processingStatus: 'pending' | 'complete' | 'failed'
  labelingStatus: 'pending' | 'processing' | 'complete' | 'failed'

  // Relations
  usedInItineraries: Relationship<Itinerary>[]
}
```

### 5.4 image-statuses

Per-image tracking (separate from Media for performance).

**Key Fields:**
```typescript
{
  job: Relationship<ItineraryJob>
  sourceS3Key: string
  status: 'pending' | 'processing' | 'complete' | 'skipped' | 'failed'
  mediaId: string | null
  error: string | null

  // Context (for segment linking)
  propertyName: string
  segmentType: string
  segmentTitle: string
  dayIndex: number
  segmentIndex: number
  country: string

  // Timing
  startedAt: Date
  completedAt: Date
}
```

---

## 6. Shared Modules

Located in `lambda/shared/` and copied to each Lambda function.

### 6.1 payload.js

Payload CMS API client.

```javascript
// Core CRUD
await payload.find('media', { 'where[status][equals]': 'pending' })
await payload.findOne('media', { 'where[sourceS3Key][equals]': key })
await payload.create('itineraries', data)
await payload.update('itineraries', id, data)
await payload.getById('media', 123)

// Job helpers
await payload.getJob(jobId)
await payload.updateJob(jobId, { status: 'processing' })
await payload.updateJobPhase(jobId, 'Phase 2: Processing Images')
await payload.failJob(jobId, 'Error message', 'phase-name')

// Itinerary helpers
await payload.getItinerary(id)
await payload.createItinerary(data)
await payload.updateItinerary(id, data)
await payload.findItineraryByItineraryId(itrvlId)

// Media helpers
await payload.getMedia(id)
await payload.updateMedia(id, data)
await payload.findMediaBySourceS3Key(s3Key)
```

### 6.2 s3.js

AWS S3 operations.

```javascript
// Upload image
await s3.uploadToS3(buffer, 'media/originals/19/image.jpg', 'image/jpeg')

// Generate optimized URL
const url = s3.getImgixUrl('media/originals/19/image.jpg', { w: 800, h: 600 })
// Returns: https://kiuli.imgix.net/media/originals/19/image.jpg?w=800&h=600&auto=format,compress

// Generate S3 key
const key = s3.generateS3Key('uuid_1.jpg', 19)
// Returns: media/originals/19/uuid_1.jpg

// Check existence
const exists = await s3.objectExists('media/originals/19/image.jpg')
```

### 6.3 openrouter.js

AI image analysis via OpenRouter.

```javascript
const enrichment = await analyzeImageWithContext(base64Image, {
  propertyName: 'Angama Mara',
  country: 'Kenya',
  segmentType: 'stay',
  dayIndex: 3
})
// Returns structured enrichment object (see Labeler section)
```

### 6.4 notifications.js

Pipeline event notifications.

```javascript
await notifyJobStarted(jobId, 'Safari Itinerary Title')
await notifyJobCompleted(jobId, itineraryId, 'Safari Itinerary Title')
await notifyJobFailed(jobId, 'Error message')
await notifyImagesProcessed(jobId, processed, failed)
```

---

## 7. External Services

| Service | Purpose | Endpoint/Config |
|---------|---------|-----------------|
| **iTrvl API** | Source data | `itrvl.com/client/portal/...` |
| **iTrvl CDN** | Image source | `itrvl-production-media.imgix.net` |
| **AWS S3** | Image storage | `kiuli-bucket` in `eu-north-1` |
| **imgix** | Image CDN | `kiuli.imgix.net` |
| **Payload CMS** | Database | `admin.kiuli.com/api/*` |
| **OpenRouter** | AI enrichment | `openrouter.ai/api/v1` (Nemotron) |

---

## 8. Environment Variables

### All Lambda Functions
```bash
AWS_REGION=eu-north-1
PAYLOAD_API_URL=https://admin.kiuli.com
PAYLOAD_API_KEY=your-payload-api-key
```

### Scraper Lambda
```bash
SCRAPER_SECRET=your-scraper-secret
```

### Orchestrator Lambda
```bash
LAMBDA_SCRAPER_URL=https://xxx.lambda-url.eu-north-1.on.aws/
LAMBDA_SCRAPER_SECRET=your-scraper-secret
LAMBDA_IMAGE_PROCESSOR_ARN=arn:aws:lambda:eu-north-1:xxx:function:kiuli-v6-image-processor
```

### Image Processor Lambda
```bash
S3_BUCKET=kiuli-bucket
S3_REGION=eu-north-1
S3_ACCESS_KEY_ID=AKIA...
S3_SECRET_ACCESS_KEY=your-secret-key
IMGIX_DOMAIN=kiuli.imgix.net
LAMBDA_LABELER_ARN=arn:aws:lambda:eu-north-1:xxx:function:kiuli-v6-labeler
```

### Labeler Lambda
```bash
OPENROUTER_API_KEY=sk-or-v1-...
LAMBDA_FINALIZER_ARN=arn:aws:lambda:eu-north-1:xxx:function:kiuli-v6-finalizer
```

---

## 9. Design Patterns

### 9.1 Chunked Processing

Large itineraries are processed in chunks to avoid Lambda timeouts:

```javascript
// Image Processor: 20 images per invocation
const CHUNK_SIZE = 20;

// If more images remain, self-invoke
if (remaining > 0) {
  await lambdaClient.send(new InvokeCommand({
    FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
    InvocationType: 'Event',
    Payload: JSON.stringify({ jobId, itineraryId, chunkIndex: chunkIndex + 1 })
  }));
}
```

### 9.2 V7 Two-Field Pattern

Content fields have three versions for editorial workflow:

```typescript
// Original from scrape
descriptionItrvl: RichText

// Enhanced by AI or human
descriptionEnhanced: RichText | null

// Review status
descriptionReviewed: boolean
```

### 9.3 Context-Driven AI Enrichment

AI labeling uses booking context for better results:

```javascript
const prompt = `You are analyzing an image from ${context.propertyName},
a safari lodge in ${context.country}. This is from day ${context.dayIndex}
of the itinerary, during a ${context.segmentType} segment.`
```

### 9.4 Global Deduplication

Images are deduplicated globally across all itineraries:

```javascript
// Check if image already exists
const existing = await payload.findMediaBySourceS3Key(sourceS3Key);
if (existing) {
  return { mediaId: existing.id, skipped: true };
}
```

### 9.5 Publish Checklist

Automated quality gates before publishing:

```javascript
const publishChecklist = {
  allImagesProcessed: processedCount >= totalCount,
  noFailedImages: failedCount === 0,
  heroImageSelected: !!heroImageId,
  contentEnhanced: false,  // Manual step
  schemaGenerated: !!schema,
  schemaValid: validation.status !== 'fail',
  metaFieldsFilled: !!(metaTitle && metaDescription)
};
```

---

## 10. Error Handling

| Error Type | Handling Strategy |
|------------|-------------------|
| Scraper timeout | 2-minute timeout, error logged to job |
| iTrvl CDN 404 | Image marked as failed, continues pipeline |
| S3 upload failure | Retries, then marks as failed |
| Dedup race condition | Retries lookup after create failure |
| OpenRouter rate limit | Exponential backoff, max 5 retries |
| OpenRouter API error | Image marked as labeling failed |
| Payload API error | Logged, finalizer reconciles counts |
| Lambda timeout | Self-invoking pattern prevents this |

---

## 11. Deployment

### 11.1 Lambda Function Names

| Function | AWS Name | Trigger |
|----------|----------|---------|
| Scraper | `kiuli-scraper` | HTTP Function URL |
| Orchestrator | `kiuli-v6-orchestrator` | Async invoke |
| Image Processor | `kiuli-v6-image-processor` | Async invoke |
| Labeler | `kiuli-v6-labeler` | Async invoke |
| Finalizer | `kiuli-v6-finalizer` | Async invoke |

### 11.2 Deploy a Lambda

```bash
cd lambda/orchestrator
zip -r function.zip handler.js transform.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-orchestrator \
  --zip-file fileb://function.zip \
  --region eu-north-1
```

### 11.3 Required IAM Permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "lambda:InvokeFunction",
    "s3:PutObject",
    "s3:GetObject",
    "logs:CreateLogGroup",
    "logs:CreateLogStream",
    "logs:PutLogEvents"
  ],
  "Resource": "*"
}
```

### 11.4 Chromium Layer (Scraper Only)

The Scraper Lambda requires the `@sparticuz/chromium` layer for headless browser support.

---

## 12. Debugging & Monitoring

### 12.1 CloudWatch Logs

```bash
# View recent orchestrator logs
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 1h --region eu-north-1

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/kiuli-v6-finalizer \
  --filter-pattern "ERROR" \
  --region eu-north-1
```

### 12.2 Job Status API

```bash
# Check job progress
curl https://admin.kiuli.com/api/itinerary-jobs/30 \
  -H "Authorization: Bearer $PAYLOAD_API_KEY"
```

### 12.3 Common Issues

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| Job stuck at "Processing Images" | Lambda timeout or error | Check CloudWatch logs |
| Images not linked to segments | ImageStatus missing context | Re-scrape itinerary |
| Schema validation failed | Missing required fields | Check publishBlockers |
| 0 images processed | S3 credentials invalid | Verify env vars |
| Labeling stuck | OpenRouter rate limit | Wait and retry |

---

## 13. Common Operations

### 13.1 Import New Itinerary

**Via Admin UI:**
1. Go to Admin → Import Itinerary (sidebar link)
2. Paste iTrvl URL
3. Click "Import"
4. Monitor progress in Jobs list

**Via API:**
```bash
curl -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/xxx/yyy"}'
```

### 13.2 Re-scrape Existing Itinerary

Same as import - the system detects existing itinerary by `itineraryId` and switches to update mode.

### 13.3 Re-run Finalizer

If image linking failed, re-run finalizer:

```bash
aws lambda invoke \
  --function-name kiuli-v6-finalizer \
  --invocation-type Event \
  --payload '{"jobId": 30, "itineraryId": 19}' \
  --region eu-north-1 \
  response.json
```

### 13.4 Check Image Status

```bash
curl "https://admin.kiuli.com/api/image-statuses?where[job][equals]=30" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY"
```

---

## Appendix: File Structure

```
lambda/
├── handler.js                    # Scraper Lambda
├── shared/                       # Base shared modules
│   ├── notifications.js
│   ├── openrouter.js
│   ├── payload.js
│   └── s3.js
├── orchestrator/
│   ├── handler.js                # Orchestrator Lambda
│   ├── transform.js              # Data transformation
│   └── shared/                   # Copied shared modules
├── image-processor/
│   ├── handler.js                # Image Processor Lambda
│   ├── processImage.js           # Per-image logic
│   └── shared/
├── labeler/
│   ├── handler.js                # Labeler Lambda
│   ├── labelImage.js             # AI enrichment logic
│   └── shared/
└── finalizer/
    ├── handler.js                # Finalizer Lambda
    ├── generateSchema.js         # JSON-LD generation
    ├── selectHero.js             # Hero image selection
    ├── schemaValidator.js        # Schema validation
    └── shared/
```

---

*Documentation generated January 22, 2026*
