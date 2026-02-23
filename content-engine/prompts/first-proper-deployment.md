# First Proper Lambda Deployment

**Date:** 2026-02-23
**Prerequisite:** Round 2 bug fixes complete and committed (m2-bug-fixes-round2.md)
**Scope:** Activate the new deployment infrastructure, deploy orchestrator to AWS,
verify with evidence that the M2 + round 1 + round 2 fixes are actually running.

---

## Context

Every scraper code change since February 11 has existed only in git. The Lambda
running in AWS is the February 11 version — it has none of the M2 knowledge base
work, none of the round 1 bug fixes, none of the round 2 bug fixes.

This prompt activates the new deployment infrastructure and executes the first
proper deployment. After this prompt, we will have evidence — not assumptions —
that the correct code is running.

---

## Step 1: Make scripts executable

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda/scripts
chmod +x deploy.sh verify.sh
```

Verify:
```bash
ls -la deploy.sh verify.sh
```
Both must show `-rwxr-xr-x` (executable).

---

## Step 2: Restart the MCP server

The MCP server was updated with two new tools (`lambda_status` and `lambda_logs`).
The server must be restarted for these to be available.

Find and kill the existing server process:
```bash
pkill -f "node.*mcp-server" || true
pkill -f "server.mjs" || true
```

Wait 2 seconds, then start it fresh:
```bash
cd /Users/grahamwallington/Projects/kiuli-website/tools/mcp-server
node server.mjs &
```

Wait 3 seconds, then verify the server is running with the new tools:
```bash
curl -s http://localhost:3200/health
```
Must return JSON with `"status": "ok"`.

**STOP if health check fails. The MCP server must be running before proceeding.**

---

## Step 3: Confirm build passes

```bash
cd /Users/grahamwallington/Projects/kiuli-website
npm run build 2>&1 | tail -20
```

Must complete without errors. If the build fails, STOP and report the full error.

---

## Step 4: Confirm round 2 bug fixes are in the code

Read the actual code to confirm these 3 things exist. Do not assume — read.

```bash
# Confirm helicopter is in blockType condition
grep -n "helicopter" /Users/grahamwallington/Projects/kiuli-website/lambda/orchestrator/transform.js
```
Must show at least 3 matches: one in transferTypes Set, one in blockType condition,
one in transferType mapping.

```bash
# Confirm pendingActivityObs in handler.js
grep -n "pendingActivityObs\|Activity obs recorded\|observedInItineraries" \
  /Users/grahamwallington/Projects/kiuli-website/lambda/orchestrator/handler.js
```
Must show the activity observation block in handler.js.

```bash
# Confirm observedInItineraries field in Activities collection
grep -n "observedInItineraries" \
  /Users/grahamwallington/Projects/kiuli-website/src/collections/Activities.ts
```
Must return at least 1 match.

**If any of these checks fail, STOP. The round 2 bug fixes are not complete.
Do not deploy incomplete code. Return to m2-bug-fixes-round2.md.**

---

## Step 5: Deploy orchestrator

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda/scripts
./deploy.sh orchestrator
```

This takes 2-4 minutes. Do not interrupt it.

The script will print 9 numbered steps. It must complete with:
```
============================================================
  DEPLOYMENT SUCCESSFUL
  Function:     kiuli-v6-orchestrator
  State:        Active
  ...
============================================================
```

**STOP if the script exits with any error. Report the exact error message and
which step it failed on.**

---

## Step 6: Verify deployment via MCP

In a new Claude conversation or via direct MCP call, Claude (Strategic) will call
`lambda_status` to confirm. You do not need to do this — report the deploy.sh
output and Claude will verify.

However, you can also verify yourself:

```bash
aws lambda get-function-configuration \
  --function-name kiuli-v6-orchestrator \
  --region eu-north-1 \
  --query '{State:State,LastModified:LastModified,Description:Description}' \
  --output json
```

The Description must contain `git:` followed by the current HEAD hash:

```bash
git rev-parse --short HEAD
```

Both hashes must match.

---

## Step 7: Clear existing data

The database contains itinerary data processed by the old code. Before running a
proper test scrape we need a clean state.

**Delete all itinerary jobs:**
```bash
curl -s -X DELETE "https://admin.kiuli.com/api/itinerary-jobs?where[id][exists]=true" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" || true
```
(This endpoint may not support bulk delete — check Payload admin UI if needed.)

**The correct approach: use Payload admin UI at admin.kiuli.com/admin to delete:**
- All records in Itinerary Jobs
- All records in Itineraries
- All records in Activities
- All records in Transfer Routes
- All records in Itinerary Patterns
- All records in Properties (except any manually created ones)

Do this via the admin UI. Confirm counts are 0 before proceeding.

Report the counts after deletion:
- Itineraries: N
- Jobs: N
- Activities: N
- Transfer Routes: N
- Itinerary Patterns: N
- Properties: N

---

## Step 8: Run test scrape

```bash
source /Users/grahamwallington/Projects/kiuli-website/.env.local
# or
source /Users/grahamwallington/Projects/kiuli-website/.env.vercel-prod

curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "create"}'
```

Capture the `jobId`. Poll for completion:

```bash
JOB_ID=<id>
while true; do
  RESULT=$(curl -s "https://admin.kiuli.com/api/itinerary-jobs/$JOB_ID?depth=0" \
    -H "Authorization: Bearer $PAYLOAD_API_KEY")
  STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))")
  PHASE=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('currentPhase',''))")
  echo "$(date -u +%H:%M:%S) — $STATUS — $PHASE"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 15
done
```

**If status is "failed": retrieve CloudWatch logs immediately:**
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1
```
Report the full error. Do not proceed.

---

## Step 9: Verify new code ran via CloudWatch

After the scrape completes, check for the 4 required log signatures.
Each must return at least 1 matching line.

```bash
# Check 1: TransferRoute observations written with itineraryId
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1 \
  | grep "TransferRoute obs saved"

# Check 2: Activity observations recorded  
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1 \
  | grep "Activity obs recorded"

# Check 3: Property accumulatedData updated
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1 \
  | grep "Updated accumulatedData"

# Check 4: ItineraryPattern created
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1 \
  | grep "ItineraryPattern"
```

All 4 must return results. If any return nothing, that code path did not run.
Report which checks passed and which failed.

---

## Step 10: Verify database state

```bash
PAYLOAD_API_KEY=<your key>

# Count of transfer routes with observations
curl -s "https://admin.kiuli.com/api/transfer-routes?where[observationCount][greater_than]=0&limit=1" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Transfer routes with obs: {d[\"totalDocs\"]}')"

# Count of activities with observationCount > 0
curl -s "https://admin.kiuli.com/api/activities?where[observationCount][greater_than]=0&limit=1" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Activities with obs: {d[\"totalDocs\"]}')"

# Count of properties
curl -s "https://admin.kiuli.com/api/properties?limit=1" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Properties: {d[\"totalDocs\"]}')"

# Count of itinerary patterns
curl -s "https://admin.kiuli.com/api/itinerary-patterns?limit=1" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Itinerary patterns: {d[\"totalDocs\"]}')"
```

Expected results for 1 itinerary:
- Transfer routes with obs: > 0
- Activities with obs: > 0
- Properties: > 0
- Itinerary patterns: 1

---

## Final Report Format

```
FIRST PROPER DEPLOYMENT REPORT
Date: [timestamp]

PREREQUISITES
  Round 2 bug fixes committed: YES/NO — hash: [hash]
  Build passed: YES/NO
  Helicopter in transform.js (3 matches): YES/NO
  pendingActivityObs in handler.js: YES/NO
  observedInItineraries in Activities.ts: YES/NO

DEPLOYMENT
  deploy.sh completed successfully: YES/NO
  Deployed git hash: [hash]
  Current HEAD: [hash]
  Hashes match: YES/NO
  Lambda state: Active / [other]

DATABASE CLEARED
  Itineraries: 0
  Jobs: 0
  Activities: 0
  Transfer Routes: 0
  Properties: 0

TEST SCRAPE
  Job ID: [id]
  Final status: completed / failed
  Duration: [seconds]

CLOUDWATCH VERIFICATION
  TransferRoute obs saved: FOUND / NOT FOUND
  Activity obs recorded: FOUND / NOT FOUND
  Updated accumulatedData: FOUND / NOT FOUND
  ItineraryPattern created/updated: FOUND / NOT FOUND

DATABASE STATE AFTER SCRAPE
  Transfer routes with observations: [n]
  Activities with obs count > 0: [n]
  Properties created: [n]
  Itinerary patterns: [n]

BLOCKERS
[Exact description of anything that did not pass, with error details]

STATUS: COMPLETE / FAILED / BLOCKED
```
