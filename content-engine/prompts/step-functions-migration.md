# Scraper Pipeline: Step Functions Migration & Complete Fix

**Date:** 2026-02-12
**Author:** Claude (Strategic)
**Executor:** Claude CLI (Tactical)
**Priority:** BLOCKER — Cannot launch without reliable pipeline processing 75-100 itineraries

---

## READ THIS BEFORE DOING ANYTHING

This prompt fixes 5 interconnected problems in the scraper pipeline. They MUST be fixed together because the fixes are interdependent. Do NOT cherry-pick individual fixes.

**Problems being fixed:**
1. AWS recursive loop detection kills Lambda self-invocation chains (BLOCKER)
2. Labeler depends on imgix for image fetching — imgix is currently down (BLOCKER)
3. Labeler queries `usedInItineraries` which is broken for dedup hits (BUG)
4. `processImage.js` doesn't update `usedInItineraries` on dedup (BUG)
5. Job 75 stuck in `processing` state blocking re-scrapes (CLEANUP)
6. Content engine tables created via raw SQL without Payload migration (DEBT)

**Architecture change:** Replace Lambda self-invocation with AWS Step Functions orchestration.

**AWS Account:** 405531875262
**Region:** eu-north-1
**IAM Role (existing):** kiuli-scraper-lambda-role

---

## Phase 1: Database Cleanup (Do First)

### 1A: Force-fail Job 75

Job 75 is stuck at `status='processing'`, `current_phase='Phase 3: Labeling Images'`. This blocks any future scrape of the Southern Africa itinerary due to the idempotency check in `scrape-itinerary/route.ts`.

```sql
UPDATE itinerary_jobs
SET status = 'failed',
    error_message = 'Force-failed: AWS recursive loop detection killed labeler chain at 99%',
    completed_at = NOW()
WHERE id = 75 AND status = 'processing';
```

**Verify:**
```sql
SELECT id, status, error_message FROM itinerary_jobs WHERE id = 75;
-- Expected: status = 'failed'
```

### 1B: Create Reconciliation Migration

The content engine Phase 1 scaffold added 4 collections to `payload.config.ts` but tables were created via raw ALTER TABLE on production. Payload's migration system doesn't know about them.

Create file `src/migrations/20260212_reconcile_content_engine_tables.ts`:

```typescript
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Reconciliation migration for Content Engine Phase 1 tables.
 *
 * These tables were manually created via SQL during the deploy-and-rescrape
 * session on 2026-02-11. This migration formalizes them so Payload's migration
 * system is aware of the schema.
 *
 * Uses IF NOT EXISTS throughout — safe to run on both fresh and existing databases.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Content Engine collections — tables
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "content_projects" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "slug" varchar,
      "status" varchar DEFAULT 'active',
      "description" varchar,
      "config" jsonb DEFAULT '{}'::jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "content_jobs" (
      "id" serial PRIMARY KEY,
      "project_id" integer REFERENCES "content_projects"("id") ON DELETE SET NULL,
      "job_type" varchar NOT NULL,
      "status" varchar DEFAULT 'pending',
      "priority" integer DEFAULT 0,
      "input" jsonb DEFAULT '{}'::jsonb,
      "output" jsonb DEFAULT '{}'::jsonb,
      "error" varchar,
      "started_at" timestamp(3) with time zone,
      "completed_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "source_registry" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "source_type" varchar NOT NULL,
      "url" varchar,
      "config" jsonb DEFAULT '{}'::jsonb,
      "last_checked_at" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "editorial_directives" (
      "id" serial PRIMARY KEY,
      "name" varchar NOT NULL,
      "directive_type" varchar NOT NULL,
      "content" varchar,
      "scope" varchar,
      "config" jsonb DEFAULT '{}'::jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `);

  // Relationship columns in Payload internal tables
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "content_projects_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "content_jobs_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "source_registry_id" integer;
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "editorial_directives_id" integer;

    ALTER TABLE "payload_preferences_rels"
      ADD COLUMN IF NOT EXISTS "content_projects_id" integer;
    ALTER TABLE "payload_preferences_rels"
      ADD COLUMN IF NOT EXISTS "content_jobs_id" integer;
    ALTER TABLE "payload_preferences_rels"
      ADD COLUMN IF NOT EXISTS "source_registry_id" integer;
    ALTER TABLE "payload_preferences_rels"
      ADD COLUMN IF NOT EXISTS "editorial_directives_id" integer;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_content_projects_id_idx"
      ON "payload_locked_documents_rels" ("content_projects_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_content_jobs_id_idx"
      ON "payload_locked_documents_rels" ("content_jobs_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_source_registry_id_idx"
      ON "payload_locked_documents_rels" ("source_registry_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_editorial_directives_id_idx"
      ON "payload_locked_documents_rels" ("editorial_directives_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "content_jobs";
    DROP TABLE IF EXISTS "content_projects";
    DROP TABLE IF EXISTS "source_registry";
    DROP TABLE IF EXISTS "editorial_directives";

    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "content_projects_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "content_jobs_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "source_registry_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "editorial_directives_id";

    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "content_projects_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "content_jobs_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "source_registry_id";
    ALTER TABLE "payload_preferences_rels" DROP COLUMN IF EXISTS "editorial_directives_id";
  `);
}
```

Add to `src/migrations/index.ts`:
```typescript
import * as migration_20260212_reconcile_content_engine_tables from './20260212_reconcile_content_engine_tables';

// Add to migrations array:
{
  up: migration_20260212_reconcile_content_engine_tables.up,
  down: migration_20260212_reconcile_content_engine_tables.down,
  name: '20260212_reconcile_content_engine_tables'
},
```

Since the tables already exist on production, manually insert the migration record so Payload doesn't try to re-run it:

```sql
INSERT INTO payload_migrations (name, batch, created_at, updated_at)
VALUES ('20260212_reconcile_content_engine_tables', 27, NOW(), NOW());
```

**Verify:**
```sql
SELECT name, batch FROM payload_migrations WHERE name LIKE '%reconcile%';
-- Expected: 1 row
```

Then run `npm run build` to verify the migration compiles. Do NOT run `npx payload migrate` — the migration is already applied.

### Phase 1 Gate

Before proceeding:
- [ ] Job 75 status = 'failed'
- [ ] Migration file created and added to index.ts
- [ ] Migration record inserted in payload_migrations
- [ ] `npm run build` passes
- [ ] Committed and pushed

---

## Phase 2: Step Functions State Machine

### 2A: Create State Machine Definition

Create directory `stepfunctions/` in the repo root.

Create `stepfunctions/definition.json`:

```json
{
  "Comment": "Kiuli Scraper Pipeline - Orchestrates itinerary import from iTrvl",
  "StartAt": "Orchestrate",
  "States": {
    "Orchestrate": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-orchestrator",
      "ResultPath": "$",
      "TimeoutSeconds": 180,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "MaxAttempts": 1,
          "BackoffRate": 2,
          "IntervalSeconds": 10
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "PipelineFailed",
          "ResultPath": "$.error"
        }
      ],
      "Next": "ProcessImageChunk"
    },
    "ProcessImageChunk": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-image-processor",
      "ResultPath": "$.imageResult",
      "TimeoutSeconds": 360,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "MaxAttempts": 2,
          "BackoffRate": 2,
          "IntervalSeconds": 5
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "PipelineFailed",
          "ResultPath": "$.error"
        }
      ],
      "Next": "CheckImagesRemaining"
    },
    "CheckImagesRemaining": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.imageResult.remaining",
          "NumericGreaterThan": 0,
          "Next": "ImageProcessingWait"
        }
      ],
      "Default": "ProcessVideos"
    },
    "ImageProcessingWait": {
      "Type": "Wait",
      "Seconds": 1,
      "Next": "ProcessImageChunk"
    },
    "ProcessVideos": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-image-processor",
      "Parameters": {
        "jobId.$": "$.jobId",
        "itineraryId.$": "$.itineraryId",
        "processVideosOnly": true
      },
      "ResultPath": "$.videoResult",
      "TimeoutSeconds": 360,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "MaxAttempts": 2,
          "BackoffRate": 2,
          "IntervalSeconds": 10
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "LabelBatch",
          "ResultPath": "$.videoError",
          "Comment": "Video failures are non-fatal"
        }
      ],
      "Next": "LabelBatch"
    },
    "LabelBatch": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-labeler",
      "ResultPath": "$.labelResult",
      "TimeoutSeconds": 180,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "MaxAttempts": 2,
          "BackoffRate": 2,
          "IntervalSeconds": 5
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "PipelineFailed",
          "ResultPath": "$.error"
        }
      ],
      "Next": "CheckLabelsRemaining"
    },
    "CheckLabelsRemaining": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.labelResult.remaining",
          "NumericGreaterThan": 0,
          "Next": "LabelingWait"
        }
      ],
      "Default": "Finalize"
    },
    "LabelingWait": {
      "Type": "Wait",
      "Seconds": 2,
      "Next": "LabelBatch"
    },
    "Finalize": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-finalizer",
      "ResultPath": "$.finalResult",
      "TimeoutSeconds": 120,
      "Retry": [
        {
          "ErrorEquals": ["States.TaskFailed"],
          "MaxAttempts": 1,
          "BackoffRate": 2,
          "IntervalSeconds": 10
        }
      ],
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "PipelineFailed",
          "ResultPath": "$.error"
        }
      ],
      "End": true
    },
    "PipelineFailed": {
      "Type": "Fail",
      "Error": "PipelineError",
      "Cause": "Pipeline step failed — check CloudWatch logs"
    }
  }
}
```

### 2B: Create IAM Role for Step Functions

Create `stepfunctions/trust-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "states.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

Create `stepfunctions/policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": [
        "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-orchestrator",
        "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-image-processor",
        "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-labeler",
        "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-video-processor",
        "arn:aws:lambda:eu-north-1:405531875262:function:kiuli-v6-finalizer"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogDelivery",
        "logs:GetLogDelivery",
        "logs:UpdateLogDelivery",
        "logs:DeleteLogDelivery",
        "logs:ListLogDeliveries",
        "logs:PutResourcePolicy",
        "logs:DescribeResourcePolicies",
        "logs:DescribeLogGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

Deploy IAM role:

```bash
# Create role
aws iam create-role \
  --role-name kiuli-stepfunctions-role \
  --assume-role-policy-document file://stepfunctions/trust-policy.json

# Attach policy
aws iam put-role-policy \
  --role-name kiuli-stepfunctions-role \
  --policy-name KiuliStepFunctionsInvokeLambda \
  --policy-document file://stepfunctions/policy.json

# Get the role ARN — we need this for the state machine
aws iam get-role --role-name kiuli-stepfunctions-role --query 'Role.Arn' --output text
```

**STOP if role creation fails.** Check IAM permissions.

Wait 10 seconds for IAM propagation, then deploy state machine:

```bash
aws stepfunctions create-state-machine \
  --name kiuli-scraper-pipeline \
  --definition file://stepfunctions/definition.json \
  --role-arn "arn:aws:iam::405531875262:role/kiuli-stepfunctions-role" \
  --region eu-north-1 \
  --type STANDARD

# Capture the state machine ARN from the output
# It will be something like: arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline
```

**IMPORTANT:** Save the state machine ARN. It's needed for the Vercel env var.

Also update the existing Lambda IAM role to allow starting Step Functions executions (needed for the Vercel API route which uses the same AWS credentials):

```bash
# Check what policies the Lambda role has
aws iam list-role-policies --role-name kiuli-scraper-lambda-role

# Add Step Functions permission to existing Lambda policy
# First, get the current policy
aws iam get-role-policy --role-name kiuli-scraper-lambda-role --policy-name <policy-name-from-above>

# Then update it to add states:StartExecution
# Or create a new inline policy:
aws iam put-role-policy \
  --role-name kiuli-scraper-lambda-role \
  --policy-name KiuliStartStepFunctions \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "states:StartExecution",
        "Resource": "arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline"
      }
    ]
  }'
```

The AWS user whose credentials are in Vercel (AWS_ACCESS_KEY_ID) also needs `states:StartExecution` permission. Check what user/role those credentials belong to and add the permission there:

```bash
# The Vercel credentials are IAM user credentials, not Lambda role
# We need to add Step Functions permission to that IAM user
# Check current permissions
aws sts get-caller-identity
# Then add policy to whatever user/role is returned
```

### 2C: Update Lambda IAM — Remove Inter-Lambda Invoke

Currently each Lambda has permission to invoke other Lambdas (for self-invocation and chaining). With Step Functions handling orchestration, Lambdas no longer need `lambda:InvokeFunction`. However, leave this permission for now — it's not harmful and removing it is a separate cleanup task. The important thing is the code no longer uses it.

### Phase 2 Gate

Before proceeding:
- [ ] IAM role created
- [ ] State machine created and ARN captured
- [ ] Verified via: `aws stepfunctions describe-state-machine --state-machine-arn <ARN> --region eu-north-1`
- [ ] State machine status = "ACTIVE"
- [ ] Committed stepfunctions/ directory

---

## Phase 3: Lambda Code Changes

This is the critical phase. All 4 Lambdas need code changes to work with Step Functions instead of self-invocation.

### Key Principle

Each Lambda now:
1. Receives input from Step Functions (the previous step's output)
2. Does its work (one chunk/batch)
3. Returns a result object that Step Functions uses for flow control
4. Does NOT invoke other Lambdas
5. Does NOT self-invoke

The `jobId` and `itineraryId` must be passed through every step via the Step Functions state.

### 3A: Modify Orchestrator (`lambda/orchestrator/handler.js`)

**Changes:**
1. Remove `@aws-sdk/client-lambda` import and Lambda client initialization
2. Remove the image-processor invocation at the end
3. Return `jobId` and `itineraryId` in the response so Step Functions can pass them to the next step
4. Still keep all other logic: scraping, transforming, creating/updating itinerary, creating ImageStatuses, property linking

The orchestrator currently returns:
```javascript
{ statusCode: 200, body: JSON.stringify({ success, jobId, itineraryId, ... }) }
```

For Step Functions, it needs to return a plain object (not HTTP response):
```javascript
{ jobId, itineraryId, imagesFound, videosFound, mode }
```

**Implementation:** At the top of handler.js:
- Remove: `const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');`
- Remove: `const lambdaClient = new LambdaClient(...)` 
- Remove: The entire section 8 that invokes image-processor (lines ~346-371)

At the end of the handler, change the return to:
```javascript
return {
  jobId: String(jobId),
  itineraryId: String(payloadItinerary.id),
  imagesFound: imageList.length,
  videosFound: videoList.length,
  mode: existingItinerary ? 'update' : 'create',
  chunkIndex: 0
};
```

**IMPORTANT:** Also change the error return to throw instead of returning HTTP error:
```javascript
} catch (error) {
  console.error('[Orchestrator] Failed:', error);
  await payload.failJob(jobId, error.message, 'orchestrator');
  throw error; // Step Functions catches this
}
```

And remove the `errorResponse()` helper function.

### 3B: Modify Image Processor (`lambda/image-processor/handler.js`)

**Changes:**
1. Remove `@aws-sdk/client-lambda` import and Lambda client
2. Remove self-invocation logic
3. Remove labeler invocation
4. Add support for `processVideosOnly` flag (for the separate ProcessVideos step)
5. Accept `jobId`, `itineraryId`, `chunkIndex` from Step Functions input
6. Return `{ jobId, itineraryId, remaining, chunkIndex }` for Step Functions flow control
7. Fix `usedInItineraries` update on dedup hits

**Implementation:**

At the top:
- Remove: `const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');`
- Remove: `const lambdaClient = new LambdaClient(...)`

The handler now has two modes:
1. Normal mode: process one image chunk
2. Video mode: process all videos (when `processVideosOnly: true`)

Replace the entire handler with:

```javascript
exports.handler = async (event) => {
  console.log('[ImageProcessor] Invoked', JSON.stringify(event));

  const { jobId, itineraryId, chunkIndex = 0, processVideosOnly = false } = event;

  if (!jobId || !itineraryId) {
    throw new Error('Missing jobId or itineraryId');
  }

  // Video-only mode: process videos and return
  if (processVideosOnly) {
    console.log('[ImageProcessor] Video processing mode');
    try {
      await processVideos(jobId, itineraryId);
    } catch (videoError) {
      console.error(`[ImageProcessor] Video processing failed (non-fatal): ${videoError.message}`);
      try {
        await payload.updateJob(jobId, { videoProcessingError: videoError.message });
      } catch (updateErr) {
        console.error(`[ImageProcessor] Failed to record video error: ${updateErr.message}`);
      }
    }
    
    await payload.updateJob(jobId, {
      phase2CompletedAt: new Date().toISOString(),
      currentPhase: 'Phase 3: Labeling Images'
    });
    
    return { jobId: String(jobId), itineraryId: String(itineraryId), remaining: 0 };
  }

  console.log(`[ImageProcessor] Job: ${jobId}, Chunk: ${chunkIndex}`);

  try {
    const job = await payload.getJob(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    // Query image statuses
    const allStatusesResult = await payload.find('image-statuses', {
      'where[and][0][job][equals]': jobId,
      'where[and][1][mediaType][not_equals]': 'video',
      limit: '1000'
    });
    const allStatuses = allStatusesResult.docs || [];

    const pendingResult = await payload.find('image-statuses', {
      'where[and][0][job][equals]': jobId,
      'where[and][1][status][equals]': 'pending',
      'where[and][2][mediaType][not_equals]': 'video',
      limit: '1000'
    });
    const pendingImages = pendingResult.docs || [];

    console.log(`[ImageProcessor] Total: ${allStatuses.length}, Pending: ${pendingImages.length}`);

    if (pendingImages.length === 0) {
      console.log('[ImageProcessor] No pending images');
      return { jobId: String(jobId), itineraryId: String(itineraryId), remaining: 0, chunkIndex };
    }

    // Process chunk
    const chunk = pendingImages.slice(0, CHUNK_SIZE);
    console.log(`[ImageProcessor] Processing chunk of ${chunk.length} images`);

    let processed = 0, skipped = 0, failed = 0;

    for (const imageStatus of chunk) {
      const sourceS3Key = imageStatus.sourceS3Key;
      try {
        await updateImageStatus(jobId, sourceS3Key, 'processing', null, new Date().toISOString());
        const result = await processImage(sourceS3Key, itineraryId, imageStatus);

        if (result.skipped) {
          skipped++;
          await updateImageStatus(jobId, sourceS3Key, 'skipped', result.mediaId, null, new Date().toISOString());
        } else {
          processed++;
          await updateImageStatus(jobId, sourceS3Key, 'complete', result.mediaId, null, new Date().toISOString());
        }
      } catch (error) {
        console.error(`[ImageProcessor] Failed: ${sourceS3Key}`, error.message);
        failed++;
        await updateImageStatus(jobId, sourceS3Key, 'failed', null, null, new Date().toISOString(), error.message);
      }
    }

    // Update job progress
    const totalProcessed = (job.processedImages || 0) + processed;
    const totalSkipped = (job.skippedImages || 0) + skipped;
    const totalFailed = (job.failedImages || 0) + failed;
    const progressValue = allStatuses.length > 0
      ? Math.min(99, Math.round(((totalProcessed + totalSkipped + totalFailed) / allStatuses.length) * 100))
      : 0;

    await payload.updateJob(jobId, {
      processedImages: totalProcessed,
      skippedImages: totalSkipped,
      failedImages: totalFailed,
      progress: progressValue
    });

    const remainingPending = pendingImages.length - chunk.length;
    console.log(`[ImageProcessor] Chunk complete: ${processed} processed, ${skipped} skipped, ${failed} failed, ${remainingPending} remaining`);

    // Return for Step Functions flow control
    return {
      jobId: String(jobId),
      itineraryId: String(itineraryId),
      remaining: remainingPending,
      chunkIndex: chunkIndex + 1,
      processed,
      skipped,
      failed
    };

  } catch (error) {
    console.error('[ImageProcessor] Failed:', error);
    await payload.failJob(jobId, error.message, 'image-processor');
    throw error;
  }
};
```

Keep the `updateImageStatus()`, `updateItineraryMedia()` helper functions.

**CRITICAL:** Also modify `processVideos()` — remove the video-processor Lambda invocation. Instead, invoke it synchronously within the same Lambda:

Actually, the video processor needs FFmpeg layer which only exists on the video-processor Lambda. So we keep the Lambda invoke for videos. But since videos are processed in a separate Step Functions state, this is acceptable. The video processor does NOT self-invoke.

Wait — re-reading the architecture. The video processor is invoked per-video, not chunked. So we need to keep the Lambda client for the video-processor invocation. But ONLY for that.

**Revised approach for videos:** Keep `@aws-sdk/client-lambda` in image-processor BUT only for invoking video-processor. Remove self-invocation and labeler invocation. The `processVideos()` function already invokes video-processor per-video with `InvocationType: 'Event'` (async). This is NOT recursive (different function name), so AWS won't detect it as a loop.

So the video processing stays as-is: image-processor invokes video-processor for each video. This happens in the `ProcessVideos` step.

**Updated plan for image-processor:**
- Keep `@aws-sdk/client-lambda` (for video-processor invocation only)
- Remove self-invocation
- Remove labeler invocation  
- Remove the `triggerLabeler()` function
- Add `processVideosOnly` handling
- Return `remaining` count for Step Functions

### 3C: Modify Labeler (`lambda/labeler/handler.js`)

**Changes:**
1. Remove `@aws-sdk/client-lambda` import and Lambda client
2. Remove self-invocation
3. Remove finalizer invocation
4. **FIX:** Query ImageStatuses for media IDs instead of querying Media by `usedInItineraries`
5. **FIX:** Fetch images from S3 instead of imgix
6. Return `{ jobId, itineraryId, remaining }` for Step Functions

**3C.1: Fix image discovery**

Current broken code:
```javascript
const mediaResult = await payload.find('media', {
  'where[and][0][labelingStatus][equals]': 'pending',
  'where[and][1][usedInItineraries][contains]': itineraryId,
  'where[and][2][mediaType][not_equals]': 'video',
  limit: BATCH_SIZE.toString()
});
```

This fails for dedup hits because `usedInItineraries` is not updated.

**Replacement approach:** 
1. Get all mediaIds from ImageStatuses for this job
2. Query Media where `id in [mediaIds]` AND `labelingStatus = pending`

```javascript
// Get media IDs from ImageStatuses (authoritative source)
const imageStatusesResult = await payload.find('image-statuses', {
  'where[and][0][job][equals]': jobId,
  'where[and][1][mediaType][not_equals]': 'video',
  'where[and][2][mediaId][exists]': 'true',
  limit: '1000'
});
const imageStatuses = imageStatusesResult.docs || [];
const mediaIds = [...new Set(imageStatuses.map(s => s.mediaId).filter(Boolean))];

if (mediaIds.length === 0) {
  console.log('[Labeler] No media IDs found in ImageStatuses');
  // Trigger finalizer phase
  await payload.updateJob(jobId, {
    phase3CompletedAt: new Date().toISOString(),
    labelingCompletedAt: new Date().toISOString(),
    currentPhase: 'Phase 4: Finalizing'
  });
  return { jobId: String(jobId), itineraryId: String(itineraryId), remaining: 0 };
}

// Query unlabeled media from these IDs
const unlabeledResult = await payload.find('media', {
  'where[and][0][id][in]': mediaIds.join(','),
  'where[and][1][labelingStatus][equals]': 'pending',
  'where[and][2][mediaType][not_equals]': 'video',
  limit: BATCH_SIZE.toString()
});
const unlabeledMedia = unlabeledResult.docs || [];
```

For the remaining count check at the end, use the same approach:
```javascript
const remainingResult = await payload.find('media', {
  'where[and][0][id][in]': mediaIds.join(','),
  'where[and][1][labelingStatus][equals]': 'pending',
  'where[and][2][mediaType][not_equals]': 'video',
  limit: '1'
});
const remainingCount = remainingResult.totalDocs || 0;
```

**3C.2: Fix image fetching — use S3 instead of imgix**

Modify `lambda/labeler/labelImage.js` to fetch from S3 when imgix fails or is unavailable.

Add `@aws-sdk/client-s3` to the labeler's `package.json` dependencies.

In `labelImage.js`:
```javascript
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({ 
  region: process.env.S3_REGION || 'eu-north-1',
  credentials: process.env.S3_ACCESS_KEY_ID ? {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
  } : undefined
});
const S3_BUCKET = process.env.S3_BUCKET;
```

Replace the image fetch in `labelImage()`:
```javascript
// Get image data - try S3 first (reliable), fallback to imgix
let base64;
const s3Key = media.originalS3Key;

if (s3Key && S3_BUCKET) {
  try {
    console.log(`[Labeler] Fetching from S3: ${s3Key}`);
    const s3Response = await s3Client.send(new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key
    }));
    const chunks = [];
    for await (const chunk of s3Response.Body) {
      chunks.push(chunk);
    }
    base64 = Buffer.concat(chunks).toString('base64');
  } catch (s3Error) {
    console.warn(`[Labeler] S3 fetch failed: ${s3Error.message}, trying imgix...`);
    // Fall through to imgix
    base64 = null;
  }
}

if (!base64) {
  // Fallback to imgix/URL
  const imageUrl = media.imgixUrl || media.url;
  if (!imageUrl) {
    return { labelingStatus: 'failed', processingError: 'No image URL or S3 key' };
  }
  
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  base64 = Buffer.from(imageBuffer).toString('base64');
}
```

This means the labeler will work even when imgix is down, because images exist in S3.

**3C.3: Remove self-invocation and finalizer trigger**

The handler return changes to:
```javascript
return {
  jobId: String(jobId),
  itineraryId: String(itineraryId),
  remaining: remainingCount,
  labeled,
  failed
};
```

When `remainingCount === 0`, update job phase:
```javascript
if (remainingCount === 0) {
  await payload.updateJob(jobId, {
    phase3CompletedAt: new Date().toISOString(),
    labelingCompletedAt: new Date().toISOString(),
    currentPhase: 'Phase 4: Finalizing'
  });
}
```

### 3D: Modify Finalizer (`lambda/finalizer/handler.js`)

Minimal changes needed. The finalizer doesn't self-invoke or invoke other Lambdas. Just need to:
1. Accept input from Step Functions (not just `event.jobId`)
2. Return plain object instead of Lambda-formatted response

The finalizer currently accepts `{ jobId, itineraryId }` and returns `{ success, status, ... }`. This already works with Step Functions. No structural changes needed.

One minor fix: the finalizer should throw on error instead of returning `{ success: false }`:
```javascript
} catch (error) {
  console.error('[Finalizer] Failed:', error);
  await payload.failJob(jobId, error.message, 'finalizer');
  throw error; // Step Functions catches this
}
```

### 3E: Fix usedInItineraries in processImage.js

In `lambda/image-processor/processImage.js`, the dedup hit path currently skips updating `usedInItineraries`. Fix this:

```javascript
if (existingMedia) {
  console.log(`[ProcessImage] Dedup hit: ${sourceS3Key} -> ${existingMedia.id}`);
  
  // Update usedInItineraries — use depth=0 to avoid 413 errors
  try {
    const existingItineraries = (existingMedia.usedInItineraries || [])
      .map(i => typeof i === 'object' ? i.id : i);
    
    const itineraryIdNum = typeof itineraryId === 'number' ? itineraryId : parseInt(itineraryId, 10);
    
    if (!existingItineraries.includes(itineraryIdNum)) {
      await fetch(`${payload.PAYLOAD_API_URL}/api/media/${existingMedia.id}?depth=0`, {
        method: 'PATCH',
        headers: {
          'Authorization': `users API-Key ${payload.PAYLOAD_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          usedInItineraries: [...existingItineraries, itineraryIdNum]
        })
      });
      console.log(`[ProcessImage] Updated usedInItineraries for media ${existingMedia.id}`);
    }
  } catch (linkError) {
    // Non-fatal — log but don't fail the pipeline
    console.warn(`[ProcessImage] Failed to update usedInItineraries: ${linkError.message}`);
  }
  
  return { mediaId: existingMedia.id, skipped: true };
}
```

### 3F: Update Labeler package.json

Add S3 SDK dependency:

```json
{
  "name": "kiuli-labeler",
  "version": "6.0.0",
  "description": "V6 Labeler Lambda - AI image enrichment",
  "main": "handler.js",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.0.0"
  }
}
```

Note: Remove `@aws-sdk/client-lambda` from labeler since it no longer invokes other Lambdas.

### 3G: Update Orchestrator package.json

Remove `@aws-sdk/client-lambda`:

```json
{
  "name": "kiuli-orchestrator",
  "version": "6.1.0",
  "description": "V6 Orchestrator Lambda - Phase 1 (scrape, transform, create draft)",
  "main": "handler.js",
  "dependencies": {}
}
```

The orchestrator no longer invokes any other Lambda — Step Functions handles that.

### Phase 3 Gate

Before proceeding:
- [ ] All 4 Lambda handler files modified
- [ ] labelImage.js updated with S3 fetching
- [ ] processImage.js updated with usedInItineraries fix
- [ ] package.json files updated (labeler: +s3, -lambda; orchestrator: -lambda)
- [ ] All files pass `node -c` syntax check
- [ ] `cd lambda && ./sync-shared.sh` runs clean
- [ ] Committed and pushed

---

## Phase 4: Update Vercel API Endpoint

### 4A: Install Step Functions SDK

```bash
cd /Users/grahamwallington/Projects/kiuli-website
npm install @aws-sdk/client-sfn
```

### 4B: Modify scrape-itinerary route

In `src/app/(payload)/api/scrape-itinerary/route.ts`:

Replace the Lambda invocation with Step Functions execution:

```typescript
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn'

// Replace LambdaClient with SFNClient
const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || 'eu-north-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
})
```

Replace the Lambda invoke section with:
```typescript
// Trigger Step Functions state machine
const stateMachineArn = process.env.STEP_FUNCTION_ARN

if (!stateMachineArn) {
  throw new Error('STEP_FUNCTION_ARN not configured')
}

try {
  const executionName = `job-${job.id}-${Date.now()}`
  
  await sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn,
      name: executionName,
      input: JSON.stringify({
        jobId: job.id,
        itrvlUrl,
        itineraryId: parsed.itineraryId,
        accessKey: parsed.accessKey,
        mode,
        existingItineraryId: existingItinerary?.id || null,
      }),
    })
  )

  console.log(`[scrape-itinerary] Started Step Functions execution: ${executionName}`)
} catch (err) {
  // ... error handling (same pattern as current Lambda error handling)
}
```

Remove the `LambdaClient` import and initialization.

### 4C: Also modify job-control route

Check `src/app/(payload)/api/job-control/[jobId]/route.ts` — if it also invokes Lambdas directly, update it too to use Step Functions.

### 4D: Add STEP_FUNCTION_ARN to Vercel

```bash
vercel env add STEP_FUNCTION_ARN production
# Paste the state machine ARN from Phase 2
```

### 4E: Build and Deploy

```bash
npm run build  # Must pass
vercel --prod  # Deploy to production
```

### Phase 4 Gate

Before proceeding:
- [ ] @aws-sdk/client-sfn installed
- [ ] scrape-itinerary route updated
- [ ] job-control route updated (if applicable)
- [ ] STEP_FUNCTION_ARN env var added to Vercel
- [ ] `npm run build` passes
- [ ] Deployed to production via `vercel --prod`
- [ ] Committed and pushed

---

## Phase 5: Deploy Updated Lambdas

### 5A: Sync shared code

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda
./sync-shared.sh
```

### 5B: Deploy each modified Lambda

**Orchestrator:**
```bash
cd lambda/orchestrator
npm ci
zip -r function.zip handler.js transform.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-orchestrator \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
```

**Image Processor:**
```bash
cd ../image-processor
npm ci
zip -r function.zip handler.js processImage.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-image-processor \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
```

**Labeler:**
```bash
cd ../labeler
npm ci
zip -r function.zip handler.js labelImage.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-labeler \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
```

**Finalizer:**
```bash
cd ../finalizer
npm ci
zip -r function.zip handler.js selectHero.js generateSchema.js schemaValidator.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-finalizer \
  --zip-file fileb://function.zip \
  --region eu-north-1
rm function.zip
```

### 5C: Add S3 environment variables to Labeler Lambda

The labeler now needs S3 access. Check if these env vars already exist:

```bash
aws lambda get-function-configuration \
  --function-name kiuli-v6-labeler \
  --region eu-north-1 \
  --query 'Environment.Variables' \
  --output json
```

If S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY are missing, add them:

```bash
# Get current env vars first
CURRENT_ENV=$(aws lambda get-function-configuration \
  --function-name kiuli-v6-labeler \
  --region eu-north-1 \
  --query 'Environment.Variables' \
  --output json)

# Add the S3 vars (merge with existing)
# You'll need to construct the full env var JSON — check KIULI_LAMBDA_ARCHITECTURE.md for values
# The S3 values should match what other Lambdas use
```

Get the S3 env vars from another Lambda that already has them:
```bash
aws lambda get-function-configuration \
  --function-name kiuli-v6-image-processor \
  --region eu-north-1 \
  --query 'Environment.Variables.{S3_BUCKET: S3_BUCKET, S3_REGION: S3_REGION}' \
  --output json
```

### 5D: Verify all deployments

```bash
for fn in kiuli-v6-orchestrator kiuli-v6-image-processor kiuli-v6-labeler kiuli-v6-finalizer; do
  echo -n "$fn: "
  aws lambda get-function-configuration \
    --function-name $fn \
    --region eu-north-1 \
    --query '{State: State, LastModified: LastModified}' \
    --output json
done
```

All must show `State: "Active"`.

### Phase 5 Gate

- [ ] All 4 Lambdas deployed
- [ ] All showing State: Active
- [ ] Labeler has S3 env vars
- [ ] Committed and pushed

---

## Phase 6: Reset Failed Images and Test

### 6A: Reset failed/pending images for re-labeling

```sql
-- Reset the 71 failed images (402 errors from imgix)
UPDATE media
SET labeling_status = 'pending',
    processing_error = NULL
WHERE media_type != 'video'
  AND labeling_status = 'failed';

-- Verify
SELECT labeling_status, count(*) FROM media
WHERE media_type != 'video'
GROUP BY labeling_status;
-- Expected: pending count should be 98 (71 + 27)
```

### 6B: Test with one itinerary

Pick the Tanzania itinerary (smallest, simplest):

```bash
# Source env vars
source .env.vercel-prod

# Trigger scrape via the updated API endpoint
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "update"}'
```

Monitor the Step Functions execution:
```bash
# Get the execution ARN (from the most recent execution)
aws stepfunctions list-executions \
  --state-machine-arn <STATE_MACHINE_ARN> \
  --region eu-north-1 \
  --max-results 1 \
  --query 'executions[0]'

# Check execution status
aws stepfunctions describe-execution \
  --execution-arn <EXECUTION_ARN> \
  --region eu-north-1 \
  --query '{status: status, startDate: startDate, stopDate: stopDate}'
```

Also monitor CloudWatch:
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 10m --region eu-north-1
aws logs tail /aws/lambda/kiuli-v6-image-processor --since 10m --region eu-north-1
aws logs tail /aws/lambda/kiuli-v6-labeler --since 10m --region eu-north-1
aws logs tail /aws/lambda/kiuli-v6-finalizer --since 10m --region eu-north-1
```

**Wait for completion.** The execution should show `status: SUCCEEDED`.

If it fails: check execution history for which step failed:
```bash
aws stepfunctions get-execution-history \
  --execution-arn <EXECUTION_ARN> \
  --region eu-north-1 \
  --reverse-order \
  --max-results 10
```

**STOP if the test fails. Report the execution history and CloudWatch logs.**

### 6C: Verify test results

```sql
-- Check the latest job
SELECT id, status, current_phase, progress, total_images, failed_images
FROM itinerary_jobs
ORDER BY id DESC LIMIT 1;
-- Expected: status = 'completed', progress = 100

-- Check labeling status across all images
SELECT labeling_status, count(*)
FROM media WHERE media_type != 'video'
GROUP BY labeling_status;
-- pending count should have decreased
```

### 6D: Re-scrape all 6 itineraries

After successful test, re-scrape remaining 5 itineraries. These can potentially run concurrently since Step Functions handles orchestration — but start sequentially to verify stability.

Use the same curl pattern from the deploy-and-rescrape.md prompt for each URL. Monitor each via Step Functions execution status.

### Phase 6 Gate

- [ ] Test scrape completed via Step Functions
- [ ] All 6 itineraries re-scraped successfully
- [ ] 0 stuck jobs
- [ ] Image labeling count reduced from 98 pending to near-zero

---

## Phase 7: Final Verification

### 7A: Full database verification

```sql
-- Properties
SELECT count(*) FROM properties;  -- Expected: ~29

-- Stay blocks with properties
SELECT count(*) FROM itineraries_blocks_stay WHERE property_id IS NULL;  -- Expected: 0

-- Image labeling
SELECT labeling_status, count(*) FROM media WHERE media_type != 'video' GROUP BY labeling_status;
-- Expected: vast majority 'complete', minimal 'failed', zero 'pending'

-- All itinerary media links
SELECT i.id, i.title,
  (SELECT count(*) FROM media_rels mr WHERE mr.itineraries_id = i.id AND mr.path = 'usedInItineraries') as media_linked
FROM itineraries i ORDER BY i.id;
-- Expected: ALL itineraries should have media_linked > 0

-- No stuck jobs
SELECT count(*) FROM itinerary_jobs WHERE status IN ('pending', 'processing');
-- Expected: 0

-- Migration state is clean
SELECT count(*) FROM payload_migrations WHERE name LIKE '%reconcile%';
-- Expected: 1
```

### 7B: Step Functions verification

```bash
# All executions should be SUCCEEDED
aws stepfunctions list-executions \
  --state-machine-arn <STATE_MACHINE_ARN> \
  --region eu-north-1 \
  --status-filter SUCCEEDED \
  --query 'executions | length(@)'
```

---

## Documentation Updates

After all phases complete, update:

1. `CLAUDE.md` — Update Lambda section to mention Step Functions, remove self-invocation references
2. `KIULI_LAMBDA_ARCHITECTURE.md` — Document new Step Functions orchestration
3. `lambda/DEPLOYMENT.md` — Add Step Functions deployment procedures
4. `SYSTEM_ARCHITECTURE.md` — Update pipeline flow diagram

---

## Report Format

```
STEP FUNCTIONS MIGRATION REPORT
================================

PHASE 1: Database Cleanup
  Job 75 force-failed: YES / NO
  Migration created: YES / NO
  Migration record inserted: YES / NO
  Build passes: YES / NO

PHASE 2: Step Functions
  IAM role created: YES / NO
  State machine created: YES / NO
  State machine ARN: [arn]
  State machine status: ACTIVE / FAILED

PHASE 3: Lambda Code Changes
  Orchestrator: MODIFIED / FAILED
  Image Processor: MODIFIED / FAILED
  Labeler: MODIFIED / FAILED
  Finalizer: MODIFIED / FAILED
  Syntax checks: ALL PASS / FAILURES
  sync-shared: CLEAN / ERRORS

PHASE 4: Vercel Update
  @aws-sdk/client-sfn installed: YES / NO
  Route updated: YES / NO
  STEP_FUNCTION_ARN set: YES / NO
  Build passes: YES / NO
  Deployed: YES / NO

PHASE 5: Lambda Deployment
  orchestrator: DEPLOYED / FAILED — LastModified: [timestamp]
  image-processor: DEPLOYED / FAILED — LastModified: [timestamp]
  labeler: DEPLOYED / FAILED — LastModified: [timestamp]
  finalizer: DEPLOYED / FAILED — LastModified: [timestamp]
  Labeler S3 env vars: SET / MISSING

PHASE 6: Testing
  Test scrape (Tanzania): SUCCEEDED / FAILED
  Step Functions execution: SUCCEEDED / FAILED / [ARN]
  All 6 re-scrapes: [n]/6 SUCCEEDED
  Failed images reset: [n] reset

PHASE 7: Verification
  Properties: [n]
  Stays without property: [n]
  Labeling status: complete=[n], pending=[n], failed=[n]
  All itineraries have media: YES / NO
  Stuck jobs: [n]

STATUS: ALL PASS / PARTIAL FAIL / BLOCKED
```

---

## Failure Protocol

If ANY phase fails:
1. STOP immediately
2. Report exact error with full context
3. Include CloudWatch logs if Lambda-related
4. Include Step Functions execution history if orchestration-related
5. Include the full curl response if API-related
6. Do NOT attempt to fix — report back for instructions
7. Commit whatever work is done so far (clean state)
