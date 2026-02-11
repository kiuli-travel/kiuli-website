# Deploy Updated Lambdas & Re-scrape All Itineraries

**Date:** 2026-02-11
**Prerequisite:** Scraper audit & upgrade prompt completed (transform.js, handler.js, processImage.js changes committed)
**Scope:** Deploy 2 Lambda functions to AWS, re-scrape all 6 test itineraries, verify property extraction works

---

## Context

The scraper pipeline was upgraded to:
1. Create Property records during scraping (transform.js)
2. Set property relationship on stay blocks (transform.js)
3. Bidirectional property↔itinerary linking (handler.js)
4. Fix property-specific FAQ generation (transform.js)
5. Fix auth header inconsistency (processImage.js)

These changes are committed but only exist locally. The AWS Lambda functions still run the OLD code. We need to deploy the updated code and re-scrape all 6 itineraries to populate the database with Property records.

---

## Phase 1: Deploy Updated Lambdas

### 1A: Deploy Orchestrator

The orchestrator has the property extraction logic (transform.js) and bidirectional linking (handler.js).

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda/orchestrator

# Ensure shared files are synced (already done but verify)
cd /Users/grahamwallington/Projects/kiuli-website/lambda
./sync-shared.sh

# Install dependencies
cd /Users/grahamwallington/Projects/kiuli-website/lambda/orchestrator
npm ci

# Package — include handler.js, transform.js, shared/, node_modules/
zip -r function.zip handler.js transform.js shared/ node_modules/ -x "*.DS_Store"

# Deploy to AWS
aws lambda update-function-code \
  --function-name kiuli-v6-orchestrator \
  --zip-file fileb://function.zip \
  --region eu-north-1

# Verify deployment succeeded — check LastModified timestamp is NOW
aws lambda get-function-configuration \
  --function-name kiuli-v6-orchestrator \
  --region eu-north-1 \
  --query '{LastModified: LastModified, CodeSize: CodeSize, State: State}'
```

**STOP if deployment fails.** Report the error.

### 1B: Deploy Image Processor

The image processor has the auth header fix (processImage.js).

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda/image-processor

# Install dependencies
npm ci

# Package
zip -r function.zip handler.js processImage.js shared/ node_modules/ -x "*.DS_Store"

# Deploy to AWS
aws lambda update-function-code \
  --function-name kiuli-v6-image-processor \
  --zip-file fileb://function.zip \
  --region eu-north-1

# Verify deployment succeeded
aws lambda get-function-configuration \
  --function-name kiuli-v6-image-processor \
  --region eu-north-1 \
  --query '{LastModified: LastModified, CodeSize: CodeSize, State: State}'
```

**STOP if deployment fails.** Report the error.

### 1C: Verify Both Deployments

Both functions must show State: "Active" and LastModified within the last few minutes:

```bash
aws lambda get-function-configuration --function-name kiuli-v6-orchestrator --region eu-north-1 --query 'State' --output text
aws lambda get-function-configuration --function-name kiuli-v6-image-processor --region eu-north-1 --query 'State' --output text
```

Both must return `Active`. If either returns `Pending` or `Failed`, STOP.

---

## Phase 2: Re-scrape All 6 Itineraries

### Authentication

The scrape endpoint requires a Bearer token. Use the PAYLOAD_API_KEY from the local environment:

```bash
cd /Users/grahamwallington/Projects/kiuli-website
source .env.vercel-prod
```

If `.env.vercel-prod` doesn't exist or doesn't contain PAYLOAD_API_KEY, try:
```bash
source .env.local
```
Or check:
```bash
cat .env.vercel-prod | grep PAYLOAD_API_KEY
```

The token is used as: `Authorization: Bearer $PAYLOAD_API_KEY`

### Trigger Re-scrapes

Re-scrape all 6 itineraries. Use mode `update` since they already exist. Send requests ONE AT A TIME and wait for each pipeline to complete before starting the next — the Lambda functions share rate limits and concurrent processing could cause issues.

**Itinerary 1: Tanzania (Big Game)**
```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "update"}'
```

Capture the `jobId` from the response. Then poll for completion:

```bash
# Poll every 30 seconds until status is "completed" or "failed"
JOB_ID="<jobId from response>"
while true; do
  STATUS=$(curl -s https://admin.kiuli.com/api/job-status/$JOB_ID \
    -H "Authorization: Bearer $PAYLOAD_API_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','unknown'))")
  echo "Job $JOB_ID: $STATUS"
  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    break
  fi
  sleep 30
done
```

If status is "failed", check the error:
```bash
curl -s https://admin.kiuli.com/api/job-status/$JOB_ID \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))"
```

Also check CloudWatch for details:
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 10m --region eu-north-1
```

**STOP if any scrape fails. Report the error with CloudWatch logs.**

**Itinerary 2: Rwanda (Primate Adventure)**
```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/Kxumj57GjP1aL1rqFv0TBjIKfZzDhGo3m0RFa1UHbxC3DTngUzlymxtwFPNH3kAG/680df1803cf205005cf76e37", "mode": "update"}'
```
Poll until complete. Then proceed.

**Itinerary 3: Uganda (Unique Adventure)**
```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/AOQ7c4CoeBXGVXSr5XMoSveQz8wDJ8PMhTl4GYKd1QNkD4oU7vyRR3HXkn3ZHT8I/68053bf5dc322e005b17302f", "mode": "update"}'
```
Poll until complete.

**Itinerary 4: South Africa & Mozambique (Ultra-Luxury)**
```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/CEqcdG3NkjiaL5uyKsXXK6PWGAxxY5hcNNry4AxF59h9G1ocuL4ld1NYtOQSfgkH/680dfc35819f37005c255a29", "mode": "update"}'
```
Poll until complete.

**Itinerary 5: Kenya (Family-Fun)**
```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/ZRlTBuY2psmIEYkaQ9t0jW1U9ryAariFUis4JgHjS6J3P2cCglSMRqPGGwBQnDBL/680df8bb3cf205005cf76e57", "mode": "update"}'
```
Poll until complete.

**Itinerary 6: Southern Africa (Honeymoon)**
```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/EmB1XSkSzShrsZlfxWS88TA0nHYtBNMXKJjisEKMjOiP61E7Z3vC37ZX6aEJOuGa/68054c7302578e005b35c848", "mode": "update"}'
```
Poll until complete.

---

## Phase 3: Verification

After ALL 6 scrapes complete successfully, run these verification queries against the production database.

Use the Neon database connection or the Kiuli MCP db_query tool if available. If using psql directly:

```bash
# Connect using the DATABASE_URL from environment
source .env.vercel-prod
psql "$POSTGRES_URL"
```

### Query 1: Property count
```sql
SELECT count(*) as property_count FROM properties;
```
**Expected:** Approximately 29 (one per unique accommodation across all itineraries). Could be fewer if some accommodations share names.

### Query 2: All stays should have property_id
```sql
SELECT count(*) as stays_without_property FROM itineraries_blocks_stay WHERE property_id IS NULL;
```
**Expected:** 0. Every stay block should now have a property_id.

### Query 3: Properties should have destination relationships
```sql
SELECT p.name, d.name as destination
FROM properties p
LEFT JOIN destinations d ON d.id = p.destination_id
ORDER BY p.name;
```
**Expected:** All properties should have a destination. If any show NULL destination, that's a data quality issue to investigate.

### Query 4: Property-specific FAQs should exist
```sql
SELECT count(*) as property_faqs
FROM itineraries_faq_items
WHERE question LIKE 'What is included at%';
```
**Expected:** ~15-18 rows (up to 3 property-specific FAQs per itinerary × 6 itineraries, minus any that failed the name extraction).

### Query 5: Cross-itinerary property sharing
```sql
SELECT p.name, count(DISTINCT pr.itineraries_id) as itinerary_count
FROM properties p
JOIN properties_rels pr ON pr.parent_id = p.id AND pr.path = 'relatedItineraries'
GROUP BY p.name
HAVING count(DISTINCT pr.itineraries_id) > 1
ORDER BY itinerary_count DESC;
```
**Expected:** At least a few properties appearing in multiple itineraries (if any accommodations are shared across the 6 test itineraries).

### Query 6: Full property overview
```sql
SELECT
  p.name,
  p.slug,
  d.name as destination,
  p."_status",
  LENGTH(p.description_itrvl) as desc_length
FROM properties p
LEFT JOIN destinations d ON d.id = p.destination_id
ORDER BY d.name, p.name;
```
**Expected:** All properties in draft status, most with descriptions (desc_length > 0), all with destinations.

---

## Success Criteria

ALL of the following must be true:

1. Both Lambda deployments succeeded (State: Active)
2. All 6 re-scrapes completed (status: completed, not failed)
3. Property count is approximately 29
4. Zero stays without property_id
5. Property-specific FAQs exist (count > 0)
6. All properties have destination relationships

## Failure Protocol

If ANY step fails:
1. STOP immediately
2. Report the exact error
3. Include CloudWatch logs if Lambda-related
4. Include the full curl response if API-related
5. Do NOT attempt to fix — report back for instructions

---

## Report Format

After completion, provide:

```
DEPLOY & RESCRAPE REPORT
========================

LAMBDA DEPLOYMENTS
  orchestrator: DEPLOYED / FAILED — LastModified: [timestamp]
  image-processor: DEPLOYED / FAILED — LastModified: [timestamp]

RE-SCRAPES (6 itineraries)
  1. Tanzania:            COMPLETED / FAILED — Job ID: [id]
  2. Rwanda:              COMPLETED / FAILED — Job ID: [id]
  3. Uganda:              COMPLETED / FAILED — Job ID: [id]
  4. South Africa/Moz:    COMPLETED / FAILED — Job ID: [id]
  5. Kenya:               COMPLETED / FAILED — Job ID: [id]
  6. Southern Africa:     COMPLETED / FAILED — Job ID: [id]

VERIFICATION QUERIES
  Property count:           [n] (expected ~29)
  Stays without property:   [n] (expected 0)
  Properties with dest:     [n]/[total]
  Property-specific FAQs:   [n] (expected ~15-18)
  Cross-itin properties:    [n] shared across itineraries

STATUS: ALL PASS / PARTIAL FAIL / BLOCKED
```
