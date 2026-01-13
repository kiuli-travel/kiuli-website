# Kiuli Backend Architecture Investigation

**Date:** 2026-01-13
**Investigator:** Claude
**Status:** Complete

---

## 1. Current Collection Schemas

### 1.1 Media Collection (`src/collections/Media.ts`)

| Field | Type | Purpose | Status |
|-------|------|---------|--------|
| `alt` | text | Alt text for images | Working |
| `caption` | richText | Image caption | Working |
| `location` | text | AI-detected location | Working |
| `country` | select | Country (Tanzania, Kenya, etc.) | Working |
| `imageType` | select | wildlife/landscape/accommodation/etc | Working |
| `animals` | json | Array of detected animals | Working |
| `tags` | json | Searchable keywords array | Working |
| `altText` | text | AI-generated accessibility text | Working |
| `isHero` | checkbox | Hero/banner suitability | Working |
| `quality` | select | high/medium/low | Working |
| `sourceItinerary` | text | iTrvl itinerary ID (readonly) | Working |
| `s3Key` | text | Original iTrvl S3 key (readonly) | Working |
| `sourceUrl` | text | Original iTrvl CDN URL (readonly) | Working |
| `originalS3Key` | text | Our S3 path for original (readonly) | **NEW** |
| `imgixUrl` | text | imgix CDN URL (readonly) | **NEW** |

**Upload Config:**
- `staticDir`: `public/media` (local uploads)
- `imageSizes`: thumbnail (300), square (500x500), small (600), medium (900), large (1400), xlarge (1920), og (1200x630)

**Access:**
- Create/Update: `authenticatedOrApiKey` (allows Lambda pipeline)
- Read: `anyone`
- Delete: `authenticated` only

---

### 1.2 Itineraries Collection (`src/collections/Itineraries/index.ts`)

| Field | Type | Purpose | Status |
|-------|------|---------|--------|
| `title` | text | Itinerary title | Required |
| `itineraryId` | text | iTrvl unique ID | Required, unique, indexed |
| `price` | number | Price in cents | Working |
| `priceFormatted` | text | Human-readable price | Working |
| `images` | relationship→media | Array of media IDs | Working |
| **Content Tab** |
| `rawItinerary` | json | Phase 2 raw data | Working |
| `enhancedItinerary` | json | Phase 4 AI-enhanced data | Working |
| `schema` | json | Phase 5 JSON-LD | Working |
| `faq` | textarea | Phase 6 FAQ HTML | Working |
| **Metadata Tab** |
| `schemaStatus` | select | pending/pass/fail | Working |
| `googleInspectionStatus` | select | pending/pass/fail | Working |
| `buildTimestamp` | date | Processing timestamp | Working |
| `googleFailureLog` | textarea | Error details | Working |

**Access:**
- Create/Update: `authenticatedOrApiKey`
- Read: `authenticatedOrPublished`
- Delete: `authenticated`

**Current State:** 0 itineraries in production database

---

### 1.3 ItineraryJobs Collection (`src/collections/ItineraryJobs/index.ts`)

| Field | Type | Purpose |
|-------|------|---------|
| `itrvlUrl` | text | Full iTrvl portal URL |
| `itineraryId` | text | Auto-extracted from URL |
| `accessKey` | text | Auto-extracted from URL |
| **Status Tab** |
| `processButton` | UI component | Trigger button |
| `status` | select | pending/processing/completed/failed |
| `currentPhase` | text | Current pipeline phase |
| `progress` | number | 0-100 percentage |
| `totalImages` | number | Total to process |
| `processedImages` | number | Successfully processed |
| `skippedImages` | number | Already existed |
| `failedImages` | number | Failed to process |
| `progressLog` | textarea | Real-time logs |
| `errorMessage` | textarea | Error details |
| `errorPhase` | text | Where failure occurred |
| `failedAt` | date | Failure timestamp |
| **Results Tab** |
| `processedItinerary` | relationship→itineraries | Final result |
| `relatedArticles` | relationship→posts | Generated content |
| `payloadId` | text | Created entry ID |
| **Metrics Tab** |
| `startedAt` | date | Start timestamp |
| `completedAt` | date | Completion timestamp |
| `duration` | number | Seconds elapsed |
| `timings` | json | Per-phase breakdown |

---

## 2. imgix Configuration Status

### 2.1 Current State: **CONFIGURED AND WORKING**

| Setting | Value |
|---------|-------|
| imgix Domain | `kiuli.imgix.net` |
| S3 Source Bucket | `kiuli-bucket` |
| Region | `eu-north-1` |
| Status | **Active** |

### 2.2 Environment Variables

**Lambda (kiuli-pipeline-worker):**
```
IMGIX_DOMAIN=kiuli.imgix.net
S3_BUCKET=kiuli-bucket
S3_REGION=eu-north-1
S3_ACCESS_KEY_ID=AKIAV...
S3_SECRET_ACCESS_KEY=mudb...
```

**Vercel:** No IMGIX env vars set (not needed - Lambda handles imgix)

### 2.3 imgix URL Generation

From `lambda/pipeline-worker/services/s3.js`:
```javascript
function getImgixUrl(s3Key, transforms = {}) {
  const domain = process.env.IMGIX_DOMAIN || 'kiuli.imgix.net';
  const baseUrl = `https://${domain}/${s3Key}`;
  const defaultTransforms = { auto: 'format,compress', q: 80 };
  // Returns: https://kiuli.imgix.net/{s3Key}?auto=format,compress&q=80&w={width}
}
```

### 2.4 Verified Working

```bash
curl -I "https://kiuli.imgix.net/media/originals/680df8bb3cf205005cf76e57/..."
# HTTP/2 200
# content-type: image/png
# x-imgix-id: fb144376716eb64a01af150389ce8b7543028826
```

---

## 3. S3 Storage Configuration

### 3.1 Payload S3 Plugin (`src/plugins/s3Storage.ts`)

```typescript
s3Storage({
  collections: { media: true },
  bucket: process.env.S3_BUCKET,  // kiuli-bucket
  config: {
    region: process.env.S3_REGION,  // eu-north-1
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },
})
```

**Note:** This plugin handles Payload's internal uploads, NOT the Lambda pipeline.

### 3.2 URL Patterns

| Source | URL Pattern |
|--------|-------------|
| Payload Upload | `/api/media/file/{filename}` (proxied through Payload) |
| Lambda → S3 Original | `s3://kiuli-bucket/media/originals/{itineraryId}/{filename}` |
| imgix CDN | `https://kiuli.imgix.net/media/originals/{itineraryId}/{filename}?{transforms}` |

### 3.3 Path Structure

**Lambda uploads originals to:**
```
kiuli-bucket/
└── media/
    └── originals/
        └── {itineraryId}/
            └── {itineraryId}_{originalS3Key_sanitized}.{ext}
```

**Example:**
```
media/originals/680df8bb3cf205005cf76e57/680df8bb3cf205005cf76e57_355a34d6_cd14_40f8_8f36_fb115dff0a44_Chongo_Mara_Reserve_Kenya_2025_D_Palmer_LR_png.png
```

---

## 4. Scraper-to-Payload Data Flow

### 4.1 Scraper Output Structure

The scraper (`phases/scrape.js`) produces:
```json
{
  "itinerary": {
    "greeting": "Welcome",
    "greetingName": "Oliver",
    "welcomeHero": "ce9db3e5-..._Elephant.jpeg",
    "itineraries": [{
      "id": "680df8bb3cf205005cf76e57",
      "bookingNumber": 828263,
      "itineraryName": "Family-Fun in Kenya",
      "name": "Family-Fun in Kenya",
      "travelers": "4 Travelers",
      "adults": 2,
      "children": 2,
      "pax": 4,
      "nights": 7,
      "startDate": "2026-07-05",
      "endDate": "2026-07-12",
      "accommodations": ["Giraffe Manor", "Lewa House", "..."],
      "segments": [
        { "type": "entry", "description": "..." },
        { "type": "point", "title": "Jomo Kenyatta Airport", "location": "Nairobi", "country": "Kenya" },
        { "type": "service", "name": "Meet and Assist", "description": "..." },
        { "type": "road", ... },
        { "type": "accommodation", "name": "Giraffe Manor", "images": [...], "description": "..." },
        ...
      ]
    }]
  },
  "images": ["uuid_filename.ext", ...],  // Array of S3 keys
  "price": 4588428  // Cents
}
```

### 4.2 Pipeline Phases

| Phase | Input | Output | Location |
|-------|-------|--------|----------|
| 1. Scrape | iTrvl URL | `rawData` | `phases/scrape.js` |
| 2. Deduplicate | `rawData.images` | `uniqueImages`, `existingMedia` | `phases/deduplicate.js` |
| 3. Process Images | `uniqueImages` | `mediaMapping` (s3Key → mediaId) | `phases/processImages.js` |
| 4. Enhance | `rawData` | `enhancedData` (with AI descriptions) | `phases/enhance.js` |
| 5. Schema | `enhancedData`, `price` | JSON-LD Product schema | `phases/schema.js` |
| 6. FAQ | `enhancedData` | HTML FAQ section | `phases/faq.js` |
| 7. Ingest | All above | Payload Itinerary record | `phases/ingest.js` |

### 4.3 What Ingest Actually Sends

From `phases/ingest.js`:
```javascript
const payload = {
  title,                    // From enhancedData.name or rawData
  itineraryId,              // iTrvl ID
  price: rawData.price,     // Cents
  priceFormatted: `$${(rawData.price / 100).toFixed(2)}`,
  images: mediaIds,         // Array of Payload Media IDs
  rawItinerary: rawData.itinerary,  // Full raw JSON
  enhancedItinerary: enhancedData,  // AI-enhanced JSON
  schema,                   // JSON-LD
  faq: faqHtml,            // HTML string
  schemaStatus: 'pass',
  googleInspectionStatus: 'pending',
  buildTimestamp: new Date().toISOString(),
  _status: 'draft'
};
```

---

## 5. AI Labeling Implementation

### 5.1 Location

`lambda/pipeline-worker/utils/imageLabeler.js`

### 5.2 Labels Generated

| Label | Type | Values |
|-------|------|--------|
| `location` | string | Specific place name or "Unknown" |
| `country` | enum | Tanzania, Kenya, Botswana, Rwanda, South Africa, Zimbabwe, Zambia, Namibia, Uganda, Unknown |
| `imageType` | enum | wildlife, landscape, accommodation, activity, people, food, aerial, detail |
| `animals` | array | List of detected animals |
| `tags` | array | 5-8 searchable keywords |
| `altText` | string | 10-20 word accessibility description |
| `isHero` | boolean | Suitable for hero/banner |
| `quality` | enum | high, medium, low |

### 5.3 AI Provider

- **Service:** OpenRouter
- **Model:** `nvidia/nemotron-nano-12b-v2-vl:free` (vision model)
- **Fallback:** Default labels if AI fails

### 5.4 Labels Are Being Stored

Verified in production Media record:
```json
{
  "id": 49,
  "location": "Unknown",
  "country": "Unknown",
  "imageType": "landscape",
  "animals": [],
  "tags": ["safari", "travel", "africa"],
  "isHero": false,
  "quality": "medium"
}
```

**Note:** Labels show defaults, suggesting AI labeling may have failed or returned defaults for this image.

---

## 6. Current State Summary

### 6.1 What Works

| Component | Status | Notes |
|-----------|--------|-------|
| Payload Collections | ✅ Working | All schemas defined and deployed |
| S3 Plugin | ✅ Working | Payload uploads go to S3 |
| imgix Integration | ✅ Working | HTTP 200 confirmed |
| Lambda Pipeline | ✅ Working | 44 images processed, 0 failed |
| AI Image Labeling | ⚠️ Partial | Labels exist but many default values |
| Media Records | ✅ Working | 49 records in production |
| Itinerary Records | ❌ Empty | 0 itineraries despite job completion |

### 6.2 What's Missing

1. **Itinerary Creation Failing Silently**
   - Job 9 shows `payloadId: "2"` but no itinerary exists
   - Ingest phase may be failing after media processing

2. **AI Labels Often Default**
   - Many images have `location: Unknown`, empty animals
   - Vision model may be struggling or prompts need tuning

3. **No Front-End Fields**
   - Missing: `slug`, `heroImage`, `summary`, `metaDescription`
   - Missing: Structured `days[]` array for rendering
   - Missing: SEO fields

---

## 7. Recommendations

### 7.1 Immediate Investigation Needed

1. **Debug Itinerary Creation**
   ```bash
   # Check Lambda logs for ingest phase
   aws logs tail /aws/lambda/kiuli-pipeline-worker --since 1h
   ```

2. **Verify Payload API Accepts Data**
   - Test POST to `/api/itineraries` manually
   - Check for validation errors

### 7.2 Collection Schema Changes Needed

**Add to Itineraries:**
```typescript
// SEO & Routing
{ name: 'slug', type: 'text', required: true, unique: true },
{ name: 'metaTitle', type: 'text' },
{ name: 'metaDescription', type: 'textarea' },

// Hero
{ name: 'heroImage', type: 'relationship', relationTo: 'media' },

// Structured Content (for front-end rendering)
{
  name: 'days',
  type: 'array',
  fields: [
    { name: 'dayNumber', type: 'number' },
    { name: 'title', type: 'text' },
    { name: 'location', type: 'text' },
    { name: 'accommodation', type: 'text' },
    { name: 'description', type: 'richText' },
    { name: 'activities', type: 'array', fields: [...] },
    { name: 'images', type: 'relationship', relationTo: 'media', hasMany: true },
  ]
}
```

### 7.3 imgix Setup: Complete

No additional setup needed. imgix is fully configured:
- Domain: `kiuli.imgix.net`
- Source: `kiuli-bucket` (S3)
- Working with transforms

### 7.4 Phase 7 Refactor Scope

1. **Transform raw segments into structured days**
   - Parse segment types (accommodation, activity, transfer)
   - Group by date
   - Extract accommodation per night

2. **Generate slug from title**
   - `"Family-Fun in Kenya"` → `"family-fun-in-kenya"`

3. **Select hero image**
   - Use `isHero: true` from AI labels
   - Fallback to first high-quality wildlife/landscape image

4. **Generate meta fields**
   - Meta title from itinerary name + location
   - Meta description from first enhanced segment

---

## 8. File References

| File | Purpose |
|------|---------|
| `src/collections/Media.ts` | Media collection schema |
| `src/collections/Itineraries/index.ts` | Itineraries collection schema |
| `src/collections/ItineraryJobs/index.ts` | Jobs collection schema |
| `src/plugins/s3Storage.ts` | Payload S3 storage config |
| `lambda/pipeline-worker/handler.js` | Main Lambda handler |
| `lambda/pipeline-worker/phases/ingest.js` | Phase 7: Payload ingestion |
| `lambda/pipeline-worker/phases/processImages.js` | Phase 3: Image processing + imgix |
| `lambda/pipeline-worker/services/s3.js` | S3 upload + imgix URL generation |
| `lambda/pipeline-worker/utils/imageLabeler.js` | AI image labeling |

---

*Investigation complete. Priority: Debug why itineraries are not being created despite successful job completion.*
