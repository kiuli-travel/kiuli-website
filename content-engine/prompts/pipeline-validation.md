# Pipeline Validation — Investigate Failures, Fix, Then Test at Scale

**Context:** Step Functions pipeline is operational. Dedup linking confirmed working (itinerary 24: 0→91 images). Two problems remain before bulk processing:

1. Payload 500 on media creation — 16 failures across Jobs 85/86 (Bisate Lodge, The Silo)
2. 98 pending labels on itinerary 28 — may not exist in S3 (original imgix 402 failures from January)

**RULE 0:** STOP and report if anything unexpected happens. Do not skip investigation steps.

---

## Part A: Investigate Payload 500 on Media Creation

### A1: Get the failed source keys

```sql
SELECT source_s3_key, error
FROM image_statuses 
WHERE job_id = 85 AND status = 'failed'
LIMIT 3;
```

### A2: Reconstruct what createMediaRecord() sent

Look at `lambda/image-processor/processImage.js` — the `createMediaRecord()` function builds a JSON payload and POSTs to `/api/media`. For one of the failed source keys:

1. Derive the filename: `sourceS3Key` value (the full key is used as filename)
2. Derive the s3Key: `media/originals/23/<filename from sourceS3Key>`
3. Derive imgixUrl: `https://kiuli.imgix.net/<s3Key>?auto=format,compress&q=80`

### A3: Reproduce the failure manually

Using one of the failed source keys, POST the same JSON payload directly to the Payload API:

```bash
# Get one failed key
FAILED_KEY=$(psql "$DATABASE_URL" -t -c "SELECT source_s3_key FROM image_statuses WHERE job_id = 85 AND status = 'failed' LIMIT 1" | tr -d ' ')

# Build the payload exactly as createMediaRecord() would
# Look at the function — it sends: alt, sourceS3Key, originalS3Key, imgixUrl, url, filename, mimeType, filesize, sourceItinerary, processingStatus, labelingStatus, usedInItineraries, sourceProperty, sourceSegmentType, sourceSegmentTitle, sourceDayIndex, country

# First, check how long the filename is
echo "$FAILED_KEY" | wc -c

# POST it
curl -s -X POST "$PAYLOAD_API_URL/api/media" \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"alt\": \"test image\",
    \"sourceS3Key\": \"$FAILED_KEY\",
    \"originalS3Key\": \"media/originals/23/$FAILED_KEY\",
    \"imgixUrl\": \"https://kiuli.imgix.net/media/originals/23/$FAILED_KEY?auto=format,compress&q=80\",
    \"url\": \"https://kiuli.imgix.net/media/originals/23/$FAILED_KEY?auto=format,compress&q=80\",
    \"filename\": \"$FAILED_KEY\",
    \"mimeType\": \"image/jpeg\",
    \"filesize\": 100000,
    \"sourceItinerary\": \"23\",
    \"processingStatus\": \"complete\",
    \"labelingStatus\": \"pending\",
    \"usedInItineraries\": [23],
    \"sourceProperty\": \"Bisate Lodge\",
    \"sourceSegmentType\": \"stay\",
    \"sourceSegmentTitle\": \"Bisate Lodge\",
    \"sourceDayIndex\": 1,
    \"country\": \"Rwanda\"
  }"
```

Read the response carefully. If it's still a generic 500, try:
- Removing fields one at a time to isolate which field causes the 500
- Check if the filename is extremely long (>255 chars)
- Check if sourceS3Key contains characters that break Payload validation
- Try with `usedInItineraries: []` vs `usedInItineraries: [23]` — the integer-in-array might be the issue
- Try with `sourceItinerary: 23` (integer) vs `"23"` (string)

### A4: Check the filename pattern

```sql
SELECT source_s3_key, length(source_s3_key) as key_length
FROM image_statuses
WHERE job_id = 85 AND status = 'failed'
ORDER BY key_length DESC;
```

Also check the successful ones for comparison:
```sql
SELECT source_s3_key, length(source_s3_key) as key_length
FROM image_statuses
WHERE job_id = 85 AND status IN ('complete', 'skipped')
ORDER BY key_length DESC
LIMIT 5;
```

If failed keys are significantly longer, that's the cause — Payload's varchar column has a limit.

### A5: Report findings

Before fixing anything, report:
- The exact response from the manual POST
- The filename lengths (failed vs successful)
- Which field (if any) caused the 500 when removed
- Your diagnosis of root cause

If the cause is clear and the fix is obvious (e.g., truncate filename), implement it. If not, STOP and report.

---

## Part B: Verify S3 Existence of 98 Pending Images

### B1: Get sample S3 keys

```sql
SELECT id, original_s3_key, source_s3_key, source_property, country
FROM media
WHERE labeling_status = 'pending' AND media_type != 'video'
LIMIT 10;
```

### B2: Check if they exist in S3

For each of the 10 sample keys:
```bash
aws s3api head-object --bucket kiuli-bucket --key "<original_s3_key>" --region eu-north-1 2>&1
```

If ALL return 404 (NoSuchKey), the images were never uploaded to S3 — the iTrvl download or S3 upload failed silently in January, and only the media record was created. In that case, the labeler CAN'T label them even with the S3 fallback, because the S3 objects don't exist.

If they DO exist, the labeler should work fine on them once itinerary 28 is re-scraped.

### B3: Check the full population

```bash
# Count how many of the 98 exist vs don't exist
psql "$DATABASE_URL" -t -c "
  SELECT original_s3_key FROM media
  WHERE labeling_status = 'pending' AND media_type != 'video'
" | while read -r key; do
  key=$(echo "$key" | tr -d ' ')
  [ -z "$key" ] && continue
  if aws s3api head-object --bucket kiuli-bucket --key "$key" --region eu-north-1 2>/dev/null; then
    echo "EXISTS: $key"
  else
    echo "MISSING: $key"
  fi
done 2>&1 | tee /tmp/s3-check-results.txt

# Summary
echo "=== SUMMARY ==="
grep -c "^EXISTS" /tmp/s3-check-results.txt || echo "0 exist"
grep -c "^MISSING" /tmp/s3-check-results.txt || echo "0 missing"
```

### B4: If images are missing from S3

If a significant number are missing, those media records are orphaned — they have a record in the database but no actual image file. These need to be either:
- Re-downloaded from iTrvl CDN and re-uploaded to S3 (if iTrvl CDN still has them)
- Or marked as failed and excluded from labeling

Check if iTrvl CDN still has them:
```bash
# Get one missing S3 key, derive the iTrvl CDN URL
MISSING_KEY=$(grep "^MISSING" /tmp/s3-check-results.txt | head -1 | sed 's/MISSING: //')
# source_s3_key is what iTrvl uses
SOURCE_KEY=$(psql "$DATABASE_URL" -t -c "SELECT source_s3_key FROM media WHERE original_s3_key = '$MISSING_KEY'" | tr -d ' ')
curl -sI "https://itrvl-production-media.imgix.net/$SOURCE_KEY" | head -5
```

If iTrvl CDN returns 200, the images can be re-downloaded. If 402/404, they're gone.

### B5: Report findings

Report:
- How many of 98 exist in S3
- How many are missing
- If missing: are they available on iTrvl CDN?
- Recommended approach (re-download, or mark failed)

---

## Part C: Fix and Re-scrape (Only After Parts A and B)

Do NOT start Part C until Parts A and B are complete and reported.

### C1: Apply any fix from Part A

If a fix was identified for the Payload 500 issue, implement it, commit, and deploy the affected Lambda (image-processor).

### C2: Handle missing S3 images from Part B

If images are missing from S3 but available on iTrvl CDN:
```sql
-- Mark them for re-processing (reset status so image-processor will re-download)
-- This depends on how many are missing and the remediation approach
```

If images are missing from both S3 and iTrvl CDN:
```sql
-- Mark them as permanently failed
UPDATE media
SET labeling_status = 'failed',
    processing_error = 'Image not found in S3 or iTrvl CDN — original upload failed January 2025'
WHERE labeling_status = 'pending'
  AND media_type != 'video'
  AND id IN (
    -- IDs of images confirmed missing from S3
  );
```

### C3: Re-scrape Uganda (itinerary 27)

Quick validation — same pattern as itinerary 24 (dedup linking):

```sql
SELECT id, title, source_itrvl_url FROM itineraries WHERE id = 27;
```

```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "<URL>", "mode": "update"}'
```

Wait for completion. Verify:
```sql
-- Should go from 0 to ~88 linked images
SELECT id, title, array_length(images, 1) FROM itineraries WHERE id = 27;
```

### C4: Re-scrape Southern Africa Honeymoon (itinerary 28)

This is the big test — 224 images, 98 pending labels, the one that killed the old pipeline.

```sql
SELECT id, title, source_itrvl_url FROM itineraries WHERE id = 28;
```

```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "<URL>", "mode": "update"}'
```

Monitor the Step Functions execution — this one will take longer (224 images). Poll every 60 seconds.

```bash
# Monitor
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline \
  --region eu-north-1 \
  --max-results 1

aws stepfunctions describe-execution \
  --execution-arn <ARN> \
  --region eu-north-1 \
  --query '{status: status, startDate: startDate}'
```

**If it fails, get the full execution history and CloudWatch logs. STOP and report.**

After completion, verify:
```sql
-- Job status
SELECT id, status, current_phase, progress, total_images, processed_images, skipped_images, failed_images, duration
FROM itinerary_jobs ORDER BY id DESC LIMIT 1;

-- Labeling status — the 98 pending should have decreased
SELECT labeling_status, count(*)
FROM media WHERE media_type != 'video'
GROUP BY labeling_status;

-- Itinerary 28 linked media
SELECT id, title, array_length(images, 1) FROM itineraries WHERE id = 28;
```

### C5: Final state of all itineraries

```sql
SELECT i.id, i.title, 
  array_length(i.images, 1) as linked_images,
  (SELECT count(*) FROM itinerary_jobs j WHERE j.processed_itinerary = i.id AND j.status = 'completed') as completed_jobs,
  (SELECT count(*) FROM itinerary_jobs j WHERE j.processed_itinerary = i.id AND j.status = 'failed') as failed_jobs
FROM itineraries i 
ORDER BY i.id;
```

```sql
-- Overall labeling
SELECT labeling_status, count(*) FROM media WHERE media_type != 'video' GROUP BY labeling_status;

-- Stuck jobs
SELECT count(*) FROM itinerary_jobs WHERE status IN ('pending', 'processing');
```

---

## Report Format

```
PIPELINE VALIDATION REPORT
===========================

PART A: Payload 500 Investigation
  Failed key lengths: [range]
  Manual POST result: [response]
  Root cause: [diagnosis]
  Fix applied: [description] / NEEDS INVESTIGATION

PART B: S3 Existence Check
  Total pending: 98
  Exist in S3: [n]
  Missing from S3: [n]
  Available on iTrvl CDN: [n] / NOT CHECKED
  Remediation: [action taken]

PART C: Re-scrapes
  Uganda (27):
    Job: [id], Status: [s]
    Linked images: 0 → [n]
    Failures: [n]

  Southern Africa (28):
    Job: [id], Status: [s]
    Duration: [n]s
    Total images: [n]
    Skipped: [n], Failed: [n], Processed: [n]
    Pending labels before: 98, after: [n]
    SF Execution: SUCCEEDED / FAILED

  All itineraries:
    23 Rwanda: [n] images
    24 SA & Moz: [n] images  
    25 Kenya: [n] images
    26 Tanzania: [n] images
    27 Uganda: [n] images
    28 Southern Africa: [n] images

  Labeling: complete=[n], pending=[n], failed=[n]
  Stuck jobs: [n]

STATUS: READY FOR BULK / PARTIAL / BLOCKED
```
