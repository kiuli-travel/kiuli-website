# Re-scrape Itinerary 28 — Southern Africa Honeymoon

**Context:** Step Functions timeouts updated (Orchestrate: 900s, ProcessImageChunk: 900s, LabelBatch: 600s). IAM permissions updated. The Payload 500 media creation bug is fixed (FormData restore). All 98 pending-label images confirmed to exist in S3. This is the final validation test.

**RULE 0:** STOP and report if anything fails.

---

## Step 1: Verify State Machine Update

```bash
aws stepfunctions describe-state-machine \
  --state-machine-arn arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline \
  --region eu-north-1 \
  --query 'definition' \
  --output text | python3 -c "import sys,json; d=json.load(sys.stdin); print('Orchestrate timeout:', d['States']['Orchestrate']['TimeoutSeconds']); print('ImageChunk timeout:', d['States']['ProcessImageChunk']['TimeoutSeconds']); print('LabelBatch timeout:', d['States']['LabelBatch']['TimeoutSeconds'])"
```

Expected: Orchestrate 900, ProcessImageChunk 900, LabelBatch 600. If any still show old values, STOP.

## Step 2: Update Local Definition to Match

Update `stepfunctions/definition.json` to match what's deployed (900/900/600). Commit and push.

## Step 3: Clean Up Job 88

Job 88 failed due to the timeout. It created ImageStatus records for itinerary 28 but the orchestrator was killed mid-run. Before re-scraping:

```sql
-- Check Job 88 state
SELECT id, status, current_phase, total_images, processed_images FROM itinerary_jobs WHERE id = 88;

-- Check if ImageStatus records from Job 88 exist
SELECT count(*), status FROM image_statuses WHERE job_id = 88 GROUP BY status;
```

If Job 88 left partial ImageStatus records, they'll cause problems on re-scrape (duplicate records). Clean them up:

```sql
-- Delete orphaned ImageStatus records from the failed Job 88
DELETE FROM image_statuses WHERE job_id = 88;

-- Verify
SELECT count(*) FROM image_statuses WHERE job_id = 88;
-- Expected: 0
```

Also ensure Job 88 is marked as failed (Claude CLI force-failed it earlier, but verify):
```sql
SELECT id, status FROM itinerary_jobs WHERE id = 88;
-- Must be: status = 'failed'
```

## Step 4: Reset Previously Failed Images

The Payload 500 bug (now fixed) caused failures on Jobs 85 and 86. Reset their ImageStatus records so the image processor will retry them:

```sql
-- Check how many failed statuses exist from the fixed bug
SELECT job_id, count(*) FROM image_statuses WHERE status = 'failed' GROUP BY job_id;
```

These don't need deletion — they're from completed jobs. The image processor uses dedup on sourceS3Key, so on re-scrape it will either find existing media (dedup hit) or try to create new media (which should now work with the FormData fix).

## Step 5: Re-scrape Southern Africa Honeymoon (Itinerary 28)

Get the iTrvl URL:
```sql
SELECT id, title, source_itrvl_url FROM itineraries WHERE id = 28;
```

Trigger:
```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "<URL_FROM_DB>", "mode": "update"}'
```

## Step 6: Monitor Execution

This is the big one — 224 images. Monitor actively.

```bash
# Get latest execution
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline \
  --region eu-north-1 \
  --max-results 1 \
  --query 'executions[0].{arn:executionArn,status:status,start:startDate}'

# Poll status every 60 seconds until SUCCEEDED or FAILED
# Use the execution ARN from above
```

If status becomes FAILED:
```bash
aws stepfunctions get-execution-history \
  --execution-arn <ARN> \
  --region eu-north-1 \
  --reverse-order \
  --max-results 20

# Also check CloudWatch for the specific Lambda that failed
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 15m --region eu-north-1 --format short
aws logs tail /aws/lambda/kiuli-v6-image-processor --since 15m --region eu-north-1 --format short
aws logs tail /aws/lambda/kiuli-v6-labeler --since 15m --region eu-north-1 --format short
aws logs tail /aws/lambda/kiuli-v6-finalizer --since 15m --region eu-north-1 --format short
```

**STOP and report full details if it fails.**

## Step 7: Verify Results

After SUCCEEDED:

```sql
-- Job status
SELECT id, status, current_phase, progress, total_images, processed_images, skipped_images, failed_images, duration
FROM itinerary_jobs ORDER BY id DESC LIMIT 1;

-- THE KEY METRIC: pending labels should have decreased from 98
SELECT labeling_status, count(*)
FROM media WHERE media_type != 'video'
GROUP BY labeling_status;

-- Itinerary 28 image count
SELECT id, title, array_length(images, 1) as linked_images FROM itineraries WHERE id = 28;

-- All itineraries final state
SELECT i.id, i.title, array_length(i.images, 1) as linked_images
FROM itineraries i ORDER BY i.id;

-- Stuck jobs
SELECT count(*) FROM itinerary_jobs WHERE status IN ('pending', 'processing');
```

## Step 8: Report

```
ITINERARY 28 RE-SCRAPE REPORT
===============================

State machine timeouts verified: YES / NO
Job 88 cleanup: DONE / SKIPPED
ImageStatus orphans deleted: [n]

Job [id]:
  Status: [s]
  Duration: [n]s
  Total images: [n]
  Processed (new): [n]
  Skipped (dedup): [n]
  Failed: [n]
  SF Execution: SUCCEEDED / FAILED

Labeling:
  Before: complete=509, pending=98
  After:  complete=[n], pending=[n], failed=[n]

All itineraries:
  23 Rwanda: [n] images
  24 SA & Moz: [n] images
  25 Kenya: [n] images
  26 Tanzania: [n] images
  27 Uganda: [n] images
  28 Southern Africa: [n] images

Stuck jobs: [n]

STATUS: READY FOR BULK / BLOCKED
```
