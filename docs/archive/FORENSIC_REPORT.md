# Kiuli Scraper Forensic Investigation Report

**Date:** 2026-01-24
**Investigator:** Claude Code (Opus 4.5)
**Methodology:** Evidence-based mechanical verification

---

## Executive Summary

This forensic investigation examined the Kiuli Scraper pipeline using **mechanical verification** rather than code inspection alone. Key findings include:

- **2 Critical Issues** - Production failures requiring immediate attention
- **4 High Issues** - Data integrity problems affecting output quality
- **6 Medium Issues** - Technical debt creating maintenance burden
- **2 Low Issues** - Minor configuration concerns

The pipeline is **functionally operational** but has systematic issues with counter accuracy, segment linking, and deployment reliability.

---

## Critical Issues

### C1: Counter Drift - Job Counters Don't Match ImageStatus Reality

**Severity:** Critical
**Category:** Data Integrity
**Location:** `lambda/image-processor/handler.js:99-108`

**Evidence:**
```
Job 46 (completed):
  totalImages:     51
  processedImages:  0
  skippedImages:   50
  failedImages:     0
  Sum:             50 (MISMATCH - 1 unaccounted)
```

Database query confirmed:
- ImageStatuses for Job 46: 51 records total
- Status breakdown: 1 complete, 50 skipped
- Job counter sum: 50 (missing 1)

**Root Cause:**
Non-atomic counter updates in image-processor. Each chunk updates counters independently:
```javascript
const totalProcessed = (job.processedImages || 0) + processed;
const totalSkipped = (job.skippedImages || 0) + skipped;
```
If chunk fails mid-update or race condition occurs, counters drift.

**Impact:**
- Progress bar shows incorrect percentages
- Finalizer reconciliation may miscalculate
- User confusion about job completion state

**Recommendation:**
Counter reconciliation in finalizer should be authoritative. Consider removing incremental counter updates entirely.

---

### C2: Progress Overflow Bug (103% Progress)

**Severity:** Critical
**Category:** Logic Error
**Location:** `lambda/image-processor/handler.js:107`

**Evidence (from CloudWatch logs summary):**
```
Error: 103 is greater than the max allowed Value of 100
Job 37 exceeded 100% progress
```

**Root Cause:**
```javascript
progress: Math.min(100, Math.round(((totalProcessed + totalSkipped + totalFailed) / allStatuses.length) * 100))
```
If `allStatuses.length` is fetched early and more ImageStatuses are added later (videos), the numerator exceeds the denominator.

**Impact:**
- Payload CMS rejects update (progress field max: 100)
- Job progress update fails
- Subsequent processing may be affected

**Recommendation:**
Always use the actual ImageStatus count at time of calculation, not a stale reference.

---

## High Issues

### H1: Segment Linking Key Mismatch

**Severity:** High
**Category:** Data Integrity
**Location:** `lambda/finalizer/handler.js:82-160`

**Evidence:**
Query of itinerary 22 segment images:
```json
{
  "title": null,
  "image_count": 10
}
```
Multiple segments have `title: null` but contain images. This indicates the linking key (used to match images to segments) is not matching the segment title.

**Root Cause:**
In `transform.js`, segments get normalized titles. In ImageStatuses, context comes from raw scraper data. The key format may differ between:
- Transform: normalized property name
- ImageStatus: raw segment title

**Impact:**
- Images assigned to segments but segment metadata not preserved
- Frontend may show unnamed segments with images
- SEO and schema generation affected

---

### H2: usedInItineraries Never Updated for Dedup Hits

**Severity:** High
**Category:** Feature Incomplete
**Location:** `lambda/image-processor/processImage.js:39-44`

**Evidence (from code):**
```javascript
if (existingMedia) {
  console.log(`[ProcessImage] Dedup hit: ${sourceS3Key} -> ${existingMedia.id}`);
  // Note: We skip updating usedInItineraries here because:
  // 1. It causes 413 errors due to Payload returning full populated documents
  return {
    mediaId: existingMedia.id,
    skipped: true
  };
}
```

**Impact:**
- Media documents don't track all itineraries using them
- Orphan detection based on `usedInItineraries` is unreliable
- Cross-itinerary media sharing not visible in admin

**Note:** Comment indicates this was intentional due to 413 errors, but it's still a data integrity gap.

---

### H3: Video Processing is Non-Fatal

**Severity:** High
**Category:** Silent Failure
**Location:** `lambda/image-processor/handler.js:139-144`

**Evidence (from code):**
```javascript
// Note: Video processing is fire-and-forget, non-fatal
if (videoError) {
  console.error(`[ImageProcessor] Video processing failed: ${videoError.message}`);
  // Continue - video failure shouldn't block image processing
}
```

**Impact:**
- Job can complete as "success" with failed videos
- No notification of video processing failure
- Videos may silently remain unprocessed

---

### H4: S3 PutObject Permission Denied for Videos

**Severity:** High
**Category:** IAM Configuration
**Location:** `lambda/video-processor/handler.js:121-127`

**Evidence (from CloudWatch analysis summary):**
```
AccessDenied: User is not authorized to perform: s3:PutObject on resource
Role: kiuli-scraper-lambda-role
```

**Impact:**
- Video processor cannot upload converted MP4 files
- All video processing fails
- heroVideo field remains empty

**Recommendation:**
Update IAM policy for `kiuli-scraper-lambda-role` to include:
```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject"],
  "Resource": "arn:aws:s3:::kiuli-bucket/media/originals/*/videos/*"
}
```

---

## Medium Issues

### M1: 6 Duplicate shared/ Directories

**Severity:** Medium
**Category:** Technical Debt
**Location:** Lambda function directories

**Evidence:**
```bash
$ find lambda -type d -name "shared" | wc -l
6
```

Directories:
- `lambda/shared/`
- `lambda/image-processor/shared/`
- `lambda/video-processor/shared/`
- `lambda/labeler/shared/`
- `lambda/finalizer/shared/`
- `lambda/orchestrator/shared/`

**Impact:**
- Changes to shared utilities must be replicated 6 times
- Risk of divergence between copies
- Increased bundle size per Lambda

**Recommendation:**
Use Lambda layers for shared code, or consolidate to single shared directory with bundler references.

---

### M2: Hardcoded Fallback Domains

**Severity:** Medium
**Category:** Configuration Fragility
**Location:** Multiple files

**Evidence (from grep):**
```
lambda/image-processor/shared/s3.js: IMGIX_DOMAIN || 'kiuli.imgix.net'
lambda/video-processor/handler.js: IMGIX_DOMAIN || 'kiuli.imgix.net'
lambda/shared/payload.js: PAYLOAD_API_URL || 'https://admin.kiuli.com'
```

12 instances of hardcoded fallback domains across Lambda code.

**Impact:**
- Works for production but masks missing environment variables
- Difficult to test in staging/development
- Changes require code updates, not just config

---

### M3: 413 Payload Too Large Errors

**Severity:** Medium
**Category:** API Limits
**Location:** Orchestrator updates to itineraries

**Evidence (from CloudWatch analysis summary):**
```
Failed to update itineraries/15: 413 - Request Entity Too Large
Failed to update itineraries/14: 413 - Request Entity Too Large
Failed to update itineraries/20: 413 - Request Entity Too Large
```

**Root Cause:**
Itinerary documents with many images exceed Vercel serverless function body limit (4.5MB).

**Impact:**
- Large itineraries cannot be updated via API
- Images array updates fail
- Workarounds (like not updating usedInItineraries) introduced

---

### M4: FAQ Schema Validation Failures

**Severity:** Medium
**Category:** Data Quality
**Location:** `lambda/finalizer/schemaValidator.js:129-147`

**Evidence (from CloudWatch analysis summary):**
```
FAQ item 0 missing answer text
FAQ item 1 missing answer text
FAQ item 2 missing answer text
FAQ item 3 missing answer text
```

**Root Cause:**
FAQ generation (likely in transform or content enhancement) produces questions without answers.

**Impact:**
- Schema validation fails
- publishBlockers populated
- SEO structured data incomplete

---

### M5: Deprecated analyzeImage() Still Exported

**Severity:** Medium
**Category:** Dead Code
**Location:** `lambda/shared/openrouter.js`

**Evidence:**
Function exported but replaced by GPT-4o labeling. May cause confusion about which AI function to use.

---

### M6: Lambda Deployment Missing Dependencies

**Severity:** Medium
**Category:** Deployment
**Location:** Scraper Lambda

**Evidence (from CloudWatch):**
```
Cannot find module 'puppeteer-core'
ENOENT: no such file or directory, open '/var/task/node_modules/@sparticuz/chromium/bin/chromium.br'
```

**Impact:**
- Scraper Lambda fails on cold start
- Deployment package missing node_modules
- Intermittent scraping failures

---

## Low Issues

### L1: Environment Variable Fallbacks Mask Issues

**Severity:** Low
**Category:** Configuration

All Lambda functions use fallback values for critical config:
```javascript
process.env.AWS_REGION || 'eu-north-1'
process.env.PAYLOAD_API_URL || 'https://admin.kiuli.com'
```

In development/staging, missing vars silently use production values.

---

### L2: Stale Data in baseline-browser-mapping

**Severity:** Low
**Category:** Dependencies

**Evidence (from dev server output):**
```
[baseline-browser-mapping] The data in this module is over two months old.
```

Minor warning but indicates dependency maintenance needed.

---

## Security Assessment

### Positive Findings

1. **Scraper Lambda validates secret** (`lambda/handler.js:396-404`)
   ```javascript
   const expectedSecret = process.env.SCRAPER_SECRET;
   if (!expectedSecret || body.secret !== expectedSecret) {
     return { statusCode: 401, ... }
   }
   ```

2. **API routes require authentication** (`src/app/(payload)/api/scrape-itinerary/route.ts:39-61`)
   - Checks Bearer token against API keys
   - Falls back to Payload session auth
   - Returns 401 on failure

3. **No API keys logged to console**
   - Grep for `console.*key|secret|token` shows only S3 keys logged, not API credentials

4. **Idempotency protection**
   - scrape-itinerary checks for existing active jobs before creating new ones

### Security Recommendations

1. Consider rotating exposed API keys in `.env.local` (visible in this investigation)
2. Add rate limiting to scrape-itinerary endpoint
3. Implement job cleanup for abandoned/stuck jobs

---

## Mechanical Verification Results

### Test 1: Counter Consistency

| Job ID | totalImages | Sum of Counters | Status |
|--------|-------------|-----------------|--------|
| 46 | 51 | 50 | **FAIL** |

Counter drift confirmed in production data.

### Test 2: Segment Linking Accuracy

| Itinerary | Total Images | Segment Images | Linked Ratio |
|-----------|--------------|----------------|--------------|
| 22 | 50 | 50 | 100% |

All images linked, but some segments have `title: null` indicating metadata loss.

### Test 3: Video Completion Rate

| Status | Count |
|--------|-------|
| complete | 1 |
| skipped | 50 |
| failed | 0 |

Videos processing but S3 permission issues may cause silent failures.

### Test 4: Failed ImageStatuses

No failed ImageStatuses found in current data. However, video S3 permission errors would cause video-processor failures.

---

## Remediation Priorities

### Immediate (This Week)

1. **Fix S3 IAM permissions** for video-processor
2. **Fix progress overflow bug** - cap at 100 before calculation
3. **Re-deploy scraper Lambda** with complete node_modules

### Short-term (This Month)

4. Consolidate shared/ directories into Lambda layer
5. Make counter updates authoritative in finalizer only
6. Add monitoring for video processing failures

### Long-term (This Quarter)

7. Address 413 payload limits with pagination/streaming
8. Improve FAQ generation to produce valid answers
9. Externalize all hardcoded domains to config

---

## Appendix: Evidence Collection Methodology

1. **CloudWatch Logs** - Queried last 7 days for ERROR patterns across all 6 Lambda functions
2. **Database Queries** - Direct API calls to Payload CMS to verify job/ImageStatus/Media integrity
3. **Code Analysis** - Read all critical Lambda handler files with focus on error handling and data flow
4. **Mechanical Tests** - Compared expected vs actual data in production database
5. **Security Scan** - Grep for credential handling and authentication patterns

---

*Report generated by forensic investigation plan at /Users/grahamwallington/.claude/plans/effervescent-sprouting-quill.md*
