# Kiuli Lambda Deployment Process

**Version:** 2.0 — authoritative, replaces all previous deployment documentation  
**Last Updated:** 2026-02-23  

---

## The Core Principle

A code change in git means nothing until it is deployed and verified running in AWS.
Every previous deployment approach failed because there was no way to confirm what
was actually executing. This document closes that gap permanently.

The verification mechanism is a git hash stamped into the Lambda function's
Description field at deploy time. Claude (Strategic) can read this at any time via
`lambda_status` and compare it against the current git HEAD. If they match, the
code that's running is the code that was reviewed.

---

## Files

```
lambda/
├── scripts/
│   ├── deploy.sh      — canonical deploy script (use this for everything)
│   └── verify.sh      — check deployed state without deploying
└── DEPLOYMENT.md      — this file
```

---

## Prerequisites

Before running any deployment, confirm these are in place:

```bash
# AWS CLI is installed and configured
aws sts get-caller-identity --region eu-north-1

# Node.js 20.x
node --version  # must be 20.x

# Git working directory is clean
git status      # no uncommitted changes
```

If `aws sts get-caller-identity` fails, AWS credentials are not configured.
Do not proceed.

---

## Deploying a Single Function

This is the command for every Lambda deployment. No exceptions, no variations.

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda/scripts
./deploy.sh <function>
```

Where `<function>` is one of: `scraper`, `orchestrator`, `image-processor`,
`labeler`, `finalizer`.

### What deploy.sh does (9 steps)

1. Verifies AWS credentials
2. Confirms the Lambda function exists in eu-north-1
3. Runs sync-shared.sh (copies shared modules to all Lambda directories)
4. Runs npm ci in the function directory
5. Creates a deployment zip
6. Deploys to AWS (update-function-code)
7. Waits for update-function-code to complete (aws lambda wait function-updated)
8. Stamps the function Description with `git:<hash> deployed:<timestamp>`
9. Waits for configuration update to complete, then verifies State=Active and
   hash is present in Description

The script exits non-zero on any failure. If it exits 0, deployment succeeded and
the function is verified active with the correct git hash.

### Example output (success)

```
============================================================
  KIULI LAMBDA DEPLOYMENT
============================================================
  Function:  orchestrator
  AWS name:  kiuli-v6-orchestrator
  Region:    eu-north-1
  Git hash:  a4f2c1d
  Commit:    a4f2c1d fix(scraper): Helicopter visibility; activity obs dedup
  Timestamp: 2026-02-23T14:30:00Z
============================================================

[1/9] Verifying AWS credentials...
             OK — Account 123456789012
[2/9] Verifying Lambda function exists...
             OK — kiuli-v6-orchestrator found
[3/9] Syncing shared modules...
             OK — Shared modules in sync
[4/9] Installing dependencies (npm ci)...
             OK — Dependencies installed
[5/9] Creating deployment package...
             OK — Package created: orchestrator-deploy.zip (12M)
[6/9] Deploying code to AWS Lambda...
             OK — Code uploaded
[7/9] Waiting for code update to complete...
             OK — Code update complete
[8/9] Stamping function with git hash (a4f2c1d)...
             OK — Description stamped
[9/9] Verifying deployment...
             OK — Zip cleaned up

============================================================
  DEPLOYMENT SUCCESSFUL
  Function:     kiuli-v6-orchestrator
  State:        Active
  Git hash:     a4f2c1d
  Code size:    12345678 bytes
  Last modified: 2026-02-23T14:30:45.000+0000
  Description:  git:a4f2c1d deployed:2026-02-23T14:30:00Z
============================================================
```

---

## Verifying Without Deploying

To check what is currently deployed against the current HEAD without deploying:

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda/scripts
./verify.sh          # all functions
./verify.sh orchestrator  # one function
```

Claude (Strategic) can also do this at any time via the `lambda_status` MCP tool.
The `lambda_status` tool is the primary way Claude verifies deployment — it reads
the Description field from AWS and compares the git hash to current HEAD.

---

## Post-Deploy Test Protocol

Deployment is not complete until a test scrape confirms the new code executed.
The distinction is critical: `deploy.sh` confirms the correct binary is in Lambda.
The test scrape confirms it actually runs correctly.

### Step 1: Trigger a test scrape

Use the Tanzania itinerary (shortest pipeline, known good):

```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "create"}'
```

Capture the `jobId` from the response and poll until complete:

```bash
JOB_ID=<id from response>
while true; do
  STATUS=$(curl -s "https://admin.kiuli.com/api/itinerary-jobs/$JOB_ID?depth=0" \
    -H "Authorization: Bearer $PAYLOAD_API_KEY" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))")
  echo "$(date -u +%H:%M:%S) — $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 15
done
```

### Step 2: Check CloudWatch logs for new code signatures

Claude (Strategic) runs `lambda_logs` with these filters. Each one confirms a
specific code path ran. All must return results for the deployment to be considered
valid.

| Filter | Confirms |
|--------|----------|
| `TransferRoute obs saved` | Bug 1 fix — pending obs written with itineraryId |
| `Activity obs recorded` | Bug B fix — activity count incremented in handler.js |
| `accumulatedData` | Property price observations recorded |
| `ItineraryPattern` | Knowledge base pattern captured |

If any filter returns no results, that code path did not execute. This is a
deployment failure even though the Lambda is technically active.

### Step 3: Verify database state

```sql
-- Transfer routes should have observations with valid itineraryId
SELECT slug, "observationCount", jsonb_array_length(observations) as obs_count
FROM transfer_routes
ORDER BY "observationCount" DESC
LIMIT 10;

-- Activities should have observedInItineraries populated
SELECT name, "observationCount"
FROM activities
WHERE "observationCount" > 0
ORDER BY "observationCount" DESC
LIMIT 10;

-- Properties should have accumulatedData
SELECT name,
  jsonb_array_length(
    accumulated_data->'pricePositioning'->'observations'
  ) as price_obs_count
FROM properties
WHERE accumulated_data IS NOT NULL
LIMIT 10;
```

---

## Which Functions to Deploy and When

### After any change to orchestrator/handler.js or orchestrator/transform.js

Deploy: `orchestrator`

This covers: all M2 knowledge base work, all bug fixes from rounds 1 and 2.

### After any change to lambda/shared/*.js

Deploy all functions that use shared:
```bash
./deploy.sh orchestrator
./deploy.sh image-processor
./deploy.sh labeler
./deploy.sh finalizer
```

sync-shared.sh runs automatically inside deploy.sh — you do not need to run it
separately.

### After any change to image-processor/processImage.js or handler.js

Deploy: `image-processor`

### After any change to labeler/labelImage.js or handler.js

Deploy: `labeler`

### After any change to finalizer/*.js

Deploy: `finalizer`

### The scraper (kiuli-scraper)

The scraper source is at `lambda/handler.js` (the root handler, not a subdirectory).
Deploy: `scraper`

---

## First Deployment After This Document Was Created

The orchestrator has not been deployed since before M2 (February 11, 2026). All M2
schema work, all round 1 bug fixes, and all round 2 bug fixes exist only in git.
The Lambda running in AWS is the February 11 version.

The correct sequence for the first deployment under this process:

1. Confirm round 2 bug fixes are complete and committed (CLI task, in progress)
2. Confirm build passes: `npm run build` from project root
3. Deploy orchestrator: `./deploy.sh orchestrator`
4. Verify via `lambda_status` (MCP tool) — syncStatus must show `CURRENT`
5. Delete all existing itineraries and knowledge base records from the database
6. Run test scrape (Tanzania itinerary)
7. Check CloudWatch logs via `lambda_logs` for all 4 required signatures
8. Check database state with the 3 SQL queries above
9. Only after all checks pass: scrape remaining itineraries

---

## Rollback

If a deployment produces broken behaviour, deploy the previous working commit:

```bash
# Find the last known good commit
git log --oneline lambda/orchestrator/

# Checkout that commit's files (does not move HEAD)
git checkout <hash> -- lambda/orchestrator/handler.js lambda/orchestrator/transform.js

# Deploy
cd lambda/scripts && ./deploy.sh orchestrator

# Restore HEAD
git checkout HEAD -- lambda/orchestrator/handler.js lambda/orchestrator/transform.js
```

---

## Environment Variables

The Lambda functions require these environment variables. They are set in the AWS
Lambda console — not in git, not in .env files.

### All functions
- `PAYLOAD_API_URL` — `https://admin.kiuli.com`
- `PAYLOAD_API_KEY` — Payload CMS API key

### Orchestrator only
- `LAMBDA_SCRAPER_URL` — Function URL of kiuli-scraper
- `LAMBDA_SCRAPER_SECRET` — Shared secret for scraper authentication

### Image Processor only
- `S3_BUCKET` — `kiuli-bucket`
- `S3_REGION` — `eu-north-1`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `IMGIX_DOMAIN` — `kiuli.imgix.net`
- `LAMBDA_LABELER_ARN` — ARN of kiuli-v6-labeler

### Labeler only
- `OPENROUTER_API_KEY`
- `LAMBDA_FINALIZER_ARN` — ARN of kiuli-v6-finalizer

If a Lambda fails immediately after deployment and logs show a missing environment
variable, check these in the AWS Lambda console under Configuration → Environment
variables.

---

## Lambda Function Summary

| Logical name | AWS function name | What it does |
|---|---|---|
| scraper | kiuli-scraper | Headless Chrome, iTrvl API interception |
| orchestrator | kiuli-v6-orchestrator | Transform, Payload save, knowledge base |
| image-processor | kiuli-v6-image-processor | Download images, upload to S3 |
| labeler | kiuli-v6-labeler | AI image enrichment via OpenRouter |
| finalizer | kiuli-v6-finalizer | Hero selection, JSON-LD schema, publish checklist |

All functions are in region `eu-north-1`.
