# Step Functions Migration — Phase 4-7 Execution

**Context:** All code changes are done (build passes). AWS IAM role and Step Functions state machine created manually. This prompt covers: commit, SQL, Vercel env, Lambda deploy, Vercel deploy, test.

**State Machine ARN:** `arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline`

**RULE 0:** STOP and report if anything fails. Do not proceed past errors.

---

## Step 1: Commit All Code Changes

All modified files from the Step Functions migration must be committed. Run `git status` first to see what's uncommitted, then commit everything in a single commit.

Commit message:
```
feat: Step Functions migration — replace Lambda self-invocation chain

- Orchestrator: remove Lambda client, return plain object for SF
- Image Processor: remove self-invoke/labeler trigger, add processVideosOnly mode
- Labeler: fix image discovery via ImageStatuses (not broken usedInItineraries),
  add S3 direct fetch (imgix fallback), remove self-invoke/finalizer trigger
- Finalizer: throw on error for SF catch
- processImage.js: fix usedInItineraries update on dedup hits
- scrape-itinerary route: Lambda invoke -> SF StartExecution
- job-control route: Lambda invoke -> SF StartExecution
- Added @aws-sdk/client-sfn, @aws-sdk/client-s3 (labeler)
- Removed @aws-sdk/client-lambda from orchestrator/labeler
- Created stepfunctions/ directory (definition, IAM policies)
- Created reconciliation migration for content engine tables
```

Push to main.

---

## Step 2: SQL — Force-fail Job 75 + Insert Migration Record

Use psql or the database connection from .env.vercel-prod / .env.local to execute:

```sql
-- Force-fail Job 75
UPDATE itinerary_jobs
SET status = 'failed',
    error_message = 'Force-failed: AWS recursive loop detection killed labeler chain at 99%',
    completed_at = NOW()
WHERE id = 75 AND status = 'processing';
```

Verify:
```sql
SELECT id, status, error_message FROM itinerary_jobs WHERE id = 75;
```

Then:
```sql
-- Insert migration record (so Payload doesn't try to re-run it)
INSERT INTO payload_migrations (name, batch, created_at, updated_at)
VALUES ('20260212_reconcile_content_engine_tables', 27, NOW(), NOW());
```

Verify:
```sql
SELECT name, batch FROM payload_migrations WHERE name LIKE '%reconcile%';
```

---

## Step 3: Add STEP_FUNCTION_ARN to Vercel

```bash
echo "arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline" | vercel env add STEP_FUNCTION_ARN production
```

If that doesn't work with pipe, use:
```bash
vercel env add STEP_FUNCTION_ARN production <<< "arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline"
```

If neither works, try the --force flag or the Vercel API directly.

Verify:
```bash
vercel env ls | grep STEP_FUNCTION
```

---

## Step 4: Deploy Lambdas

### 4A: Sync shared code
```bash
cd lambda && bash sync-shared.sh && cd ..
```

### 4B: Deploy Orchestrator
```bash
cd lambda/orchestrator
npm ci --omit=dev
zip -r function.zip handler.js transform.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-orchestrator \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
cd ../..
```

Verify: Check the response shows `LastModified` with today's date and `State: Active`.

### 4C: Deploy Image Processor
```bash
cd lambda/image-processor
npm ci --omit=dev
zip -r function.zip handler.js processImage.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-image-processor \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
cd ../..
```

### 4D: Deploy Labeler

IMPORTANT: The labeler now has `@aws-sdk/client-s3` as a new dependency. Must run npm ci.

```bash
cd lambda/labeler
npm ci --omit=dev
zip -r function.zip handler.js labelImage.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-labeler \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
cd ../..
```

After deploy, verify the labeler has S3 env vars:
```bash
aws lambda get-function-configuration \
  --function-name kiuli-v6-labeler \
  --region eu-north-1 \
  --query 'Environment.Variables' \
  --output json
```

If S3_BUCKET or S3_REGION are missing, get them from the image-processor:
```bash
aws lambda get-function-configuration \
  --function-name kiuli-v6-image-processor \
  --region eu-north-1 \
  --query 'Environment.Variables' \
  --output json
```

Then update the labeler's env vars to include ALL existing vars PLUS the S3 ones:
```bash
# Get ALL current labeler env vars as JSON, add S3 vars, update
# IMPORTANT: aws lambda update-function-configuration REPLACES all env vars
# So you must include ALL existing vars in the update
```

### 4E: Deploy Finalizer
```bash
cd lambda/finalizer
npm ci --omit=dev
zip -r function.zip handler.js selectHero.js generateSchema.js schemaValidator.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-finalizer \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
cd ../..
```

### 4F: Verify all deployments
```bash
for fn in kiuli-v6-orchestrator kiuli-v6-image-processor kiuli-v6-labeler kiuli-v6-finalizer; do
  echo "=== $fn ==="
  aws lambda get-function-configuration \
    --function-name $fn \
    --region eu-north-1 \
    --query '{State: State, LastModified: LastModified, CodeSize: CodeSize}' \
    --output table
done
```

ALL must show State: Active with today's LastModified.

---

## Step 5: Deploy Vercel

```bash
cd /Users/grahamwallington/Projects/kiuli-website
vercel --prod
```

After deploy, verify:
- https://kiuli.com loads
- https://admin.kiuli.com loads

---

## Step 6: Reset Failed Images

Reset the 71 failed + 27 pending images for re-labeling:

```sql
UPDATE media
SET labeling_status = 'pending',
    processing_error = NULL
WHERE media_type != 'video'
  AND labeling_status = 'failed';
```

Verify:
```sql
SELECT labeling_status, count(*)
FROM media
WHERE media_type != 'video'
GROUP BY labeling_status;
```

Report the counts.

---

## Step 7: Test with Tanzania Itinerary

Tanzania is the smallest/simplest itinerary. Use it as the test case.

iTrvl URL for Tanzania (itinerary 26): Look this up from the database:
```sql
SELECT id, itrvl_url, title FROM itineraries WHERE id = 26;
```

Trigger re-scrape:
```bash
source .env.vercel-prod  # or wherever PAYLOAD_API_KEY is

curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "<URL_FROM_DB>", "mode": "update"}'
```

The response should include a jobId and mention Step Functions.

Monitor the execution:
```bash
# List recent executions
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline \
  --region eu-north-1 \
  --max-results 1

# Get the execution ARN from above, then check status
aws stepfunctions describe-execution \
  --execution-arn <EXECUTION_ARN_FROM_ABOVE> \
  --region eu-north-1
```

Poll every 30 seconds until status is SUCCEEDED or FAILED.

If FAILED, get the history:
```bash
aws stepfunctions get-execution-history \
  --execution-arn <EXECUTION_ARN> \
  --region eu-north-1 \
  --reverse-order \
  --max-results 20
```

Also check CloudWatch:
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 10m --region eu-north-1 --format short
aws logs tail /aws/lambda/kiuli-v6-image-processor --since 10m --region eu-north-1 --format short
aws logs tail /aws/lambda/kiuli-v6-labeler --since 10m --region eu-north-1 --format short
aws logs tail /aws/lambda/kiuli-v6-finalizer --since 10m --region eu-north-1 --format short
```

**STOP and report if the test fails. Include the full execution history and CloudWatch output.**

---

## Step 8: Verify Test Results

```sql
-- Latest job status
SELECT id, status, current_phase, progress, total_images, processed_images, skipped_images, failed_images
FROM itinerary_jobs ORDER BY id DESC LIMIT 1;

-- Labeling status distribution
SELECT labeling_status, count(*)
FROM media WHERE media_type != 'video'
GROUP BY labeling_status;

-- No stuck jobs
SELECT count(*) FROM itinerary_jobs WHERE status IN ('pending', 'processing');
```

---

## Step 9: If Test Passes — Re-scrape All 6 Itineraries

Get all iTrvl URLs:
```sql
SELECT id, title, source_itrvl_url FROM itineraries ORDER BY id;
```

Re-scrape each one sequentially (wait for each to complete before starting the next):

```bash
for URL in <url1> <url2> <url3> <url4> <url5> <url6>; do
  echo "=== Scraping $URL ==="
  curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $PAYLOAD_API_KEY" \
    -d "{\"itrvlUrl\": \"$URL\", \"mode\": \"update\"}"
  echo ""
  
  # Poll for completion
  # ... (get job ID from response, poll job-status endpoint)
done
```

Between each scrape, verify the Step Functions execution completed successfully.

---

## Step 10: Final Verification

```sql
-- Properties count
SELECT count(*) FROM properties;

-- Stays without properties
SELECT count(*) FROM itineraries_blocks_stay WHERE property_id IS NULL;

-- Image labeling (should be mostly complete)
SELECT labeling_status, count(*) FROM media WHERE media_type != 'video' GROUP BY labeling_status;

-- All itineraries have images linked
SELECT i.id, i.title, array_length(i.images, 1) as image_count
FROM itineraries i ORDER BY i.id;

-- No stuck jobs
SELECT count(*) FROM itinerary_jobs WHERE status IN ('pending', 'processing');

-- Migration state
SELECT name FROM payload_migrations WHERE name LIKE '%reconcile%';
```

---

## Report Format

```
STEP FUNCTIONS DEPLOYMENT REPORT
=================================

Step 1 — Commit: DONE / FAILED
  Hash: [commit hash]

Step 2 — SQL:
  Job 75 force-failed: YES / NO
  Migration record inserted: YES / NO

Step 3 — STEP_FUNCTION_ARN: SET / FAILED

Step 4 — Lambda Deployments:
  orchestrator: DEPLOYED (LastModified: [ts], Size: [n]KB)
  image-processor: DEPLOYED (LastModified: [ts], Size: [n]KB)
  labeler: DEPLOYED (LastModified: [ts], Size: [n]KB)
  finalizer: DEPLOYED (LastModified: [ts], Size: [n]KB)
  Labeler S3 env vars: PRESENT / MISSING

Step 5 — Vercel: DEPLOYED / FAILED
  kiuli.com: LOADS / BROKEN
  admin.kiuli.com: LOADS / BROKEN

Step 6 — Image Reset: [n] images reset to pending

Step 7 — Test Scrape:
  SF Execution: SUCCEEDED / FAILED
  Job status: [status]
  Duration: [n]s

Step 8 — Verification:
  Latest job: status=[s], progress=[n]
  Labeling: complete=[n], pending=[n], failed=[n]
  Stuck jobs: [n]

Step 9 — All Re-scrapes: [n]/6 SUCCEEDED

Step 10 — Final:
  Properties: [n]
  Stays without property: [n]
  All itineraries have images: YES / NO
  Stuck jobs: [n]

STATUS: ALL PASS / PARTIAL / BLOCKED
```
