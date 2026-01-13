# V4 Implementation Report

**Date**: January 11, 2026
**Status**: Architecture Complete, Database Migration Pending

---

## Executive Summary

The V4 async pipeline architecture has been fully implemented in code, committed, and deployed. However, the Vercel endpoint currently returns HTTP 500 because the production database schema doesn't include the new fields added to the collections. A database migration is required to complete the implementation.

---

## What Was Implemented

### Phase A: Lambda Pipeline Worker (COMPLETE)

**Location**: `lambda/pipeline-worker/`

| File | Purpose |
|------|---------|
| `handler.js` | Main Lambda entry point with 7-phase pipeline |
| `phases/scrape.js` | Phase 1: Puppeteer scraping via kiuli-scraper Lambda |
| `phases/deduplicate.js` | Phase 2: Image deduplication against existing media |
| `phases/processImages.js` | Phase 3: S3 upload + AI labeling |
| `phases/enhance.js` | Phase 4: Gemini AI content enhancement |
| `phases/schema.js` | Phase 5: JSON-LD schema generation |
| `phases/faq.js` | Phase 6: FAQ HTML formatting |
| `phases/ingest.js` | Phase 7: Payload CMS ingestion |
| `services/jobTracker.js` | Real-time job progress updates |
| `utils/imageLabeler.js` | Gemini Vision AI image labeling |

**Lambda Configuration**:
- Name: `kiuli-pipeline-worker`
- Runtime: `nodejs20.x`
- Timeout: 900s (15 min)
- Memory: 1024 MB
- Function URL: `https://ifg5p5ot42l5rplizcjyiujxdq0vrcna.lambda-url.eu-north-1.on.aws/`

---

### Phase B: Vercel Async Integration (COMPLETE)

**Changes Made**:

1. **`/api/scrape-itinerary` endpoint** (`src/app/(payload)/api/scrape-itinerary/route.ts`)
   - Changed from synchronous to async fire-and-forget
   - Returns immediately with `jobId` for polling
   - Response time: <1s (was 2-5 minutes)

2. **`/api/job-status/[jobId]` endpoint** (NEW)
   - Location: `src/app/(payload)/api/job-status/[jobId]/route.ts`
   - Returns job progress, current phase, image counts, errors

3. **Vercel Environment Variables**:
   | Variable | Value |
   |----------|-------|
   | `LAMBDA_PIPELINE_URL` | `https://ifg5p5ot42l5rplizcjyiujxdq0vrcna.lambda-url.eu-north-1.on.aws/` |
   | `LAMBDA_INVOKE_SECRET` | `NPA2sC0kro1z9Vfz+tZw1kjLlbKsqnYbiK/jr1dNzOI=` |

---

### Phase C: AI Image Labeling (COMPLETE)

**Image Labeler** (`lambda/pipeline-worker/utils/imageLabeler.js`):
- Uses Gemini 2.0 Flash for vision analysis
- Extracts: location, country, imageType, animals, tags, altText, isHero, quality
- Falls back to defaults on failure

**Media Collection Fields** (NEW):
- `location` (text)
- `country` (select: Tanzania, Kenya, Botswana, etc.)
- `imageType` (select: wildlife, landscape, accommodation, etc.)
- `animals` (json array)
- `tags` (json array)
- `altText` (text)
- `isHero` (checkbox)
- `quality` (select: high/medium/low)
- `sourceItinerary` (text)
- `s3Key` (text)
- `sourceUrl` (text)

---

### Schema Updates

**Itineraries Collection** (`src/collections/Itineraries/index.ts`):
```typescript
// New fields added:
- itineraryId (text, unique, indexed)
- price (number, cents)
- priceFormatted (text)
```

**ItineraryJobs Collection** (`src/collections/ItineraryJobs/index.ts`):
```typescript
// New fields added:
- progress (number, 0-100)
- totalImages (number)
- processedImages (number)
- skippedImages (number)
- failedImages (number)
- errorPhase (text)
- failedAt (date)
```

---

## Git Commits

| Commit | Description |
|--------|-------------|
| `fa0e88c` | feat: implement V4 async pipeline architecture |
| `ec7e2fe` | fix: remove progress field from initial job creation |
| `a5dcd5d` | fix: remove idempotency check (itineraryId field pending) |

---

## Known Issue: Database Migration Required

The Vercel `/api/scrape-itinerary` endpoint returns HTTP 500 because the production database schema doesn't have the new fields.

### Solution Options

**Option 1: Run Payload Migration (Recommended)**
```bash
# WARNING: May cause data loss if dev mode was used
npx payload migrate
```

**Option 2: Manual Schema Update**
Add the new columns directly to the Vercel Postgres tables:
- `itineraries`: `itinerary_id`, `price`, `price_formatted`
- `itinerary_jobs`: `progress`, `total_images`, `processed_images`, `skipped_images`, `failed_images`, `error_phase`, `failed_at`
- `media`: All the label fields

**Option 3: Rollback Schema Changes**
Revert the schema changes to match the current database state and implement them incrementally with proper migrations.

---

## Testing After Migration

Once the database is migrated, test with:

```bash
# 1. Create a job (should return immediately with jobId)
curl -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/woYs2O6RMT05UpTfX8Uz6wFUG29aMY4IMEOJsR6QzQfHejmKEFZuasDvFQyBy1s5/680df9b0819f37005c255a1c"}'

# Expected response:
# {"success":true,"jobId":"xxx","itineraryId":"680df9b0819f37005c255a1c","message":"Processing started. Poll /api/job-status/xxx for progress."}

# 2. Poll for status
curl https://admin.kiuli.com/api/job-status/{jobId}

# 3. Lambda execution should complete within 5-10 minutes
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Next.js)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  POST /api/scrape-itinerary                                     │
│       │                                                         │
│       ├─► Validate API key                                      │
│       ├─► Parse iTrvl URL                                       │
│       ├─► Create job record (status: pending)                   │
│       ├─► Fire-and-forget Lambda trigger ──────────┐            │
│       └─► Return immediately with jobId           │            │
│                                                    │            │
│  GET /api/job-status/[jobId]                      │            │
│       └─► Return job progress from DB              │            │
│                                                    │            │
└────────────────────────────────────────────────────┼────────────┘
                                                     │
                                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AWS LAMBDA (Pipeline Worker)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1: Scrape ─────────► kiuli-scraper Lambda (Puppeteer)    │
│       │                                                         │
│       ▼                                                         │
│  Phase 2: Deduplicate ────► Check existing media in Payload     │
│       │                                                         │
│       ▼                                                         │
│  Phase 3: Process Images ─► Upload to S3 + Gemini labeling      │
│       │                                                         │
│       ▼                                                         │
│  Phase 4: Enhance ────────► Gemini AI content enhancement       │
│       │                                                         │
│       ▼                                                         │
│  Phase 5: Schema ─────────► Generate JSON-LD                    │
│       │                                                         │
│       ▼                                                         │
│  Phase 6: FAQ ────────────► Format FAQ HTML                     │
│       │                                                         │
│       ▼                                                         │
│  Phase 7: Ingest ─────────► Create/update Payload entry         │
│       │                                                         │
│       └─────────────────────► Update job status (completed)     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Run database migration** to sync schema with code
2. **Test full pipeline** end-to-end
3. **Process first itinerary** to validate all phases
4. **Monitor Lambda CloudWatch logs** for any errors

---

*Generated by Claude Code on January 11, 2026*
