# M2 Phase 2 — Deploy to Vercel + Verification Scrape

**Date:** 2026-03-12
**Prerequisite:** M2 Phase 2 code changes committed and pushed at `60b7d28`. Orchestrator Lambda already deployed at this hash.
**Scope:** Deploy website to Vercel (Properties.ts schema change), run a verification scrape, confirm the 3 M2 Phase 2 fixes are working.

---

## Context

Three M2 Phase 2 fixes were committed in `60b7d28`:

1. **toDestination look-ahead** (`lambda/orchestrator/transform.js`) — `linkTransferRoutes()` now resolves toDestination by looking ahead to the next stay segment when the transfer endpoint isn't a known property or airport. Previously, most transfers had null toDestination.

2. **seasonalityData monthly accumulation** (`lambda/orchestrator/handler.js`) — the accumulatedData PATCH block now increments a per-month observationCount in seasonalityData based on the itinerary's travel month.

3. **availability.source 'manual' option** (`src/collections/Properties.ts`) — added `{ label: 'Manual', value: 'manual' }` to the availability.source select field. This is a Payload CMS schema change that requires a Vercel deployment to take effect in production.

The orchestrator Lambda is already deployed at `60b7d28` (confirmed via `lambda_status`). The Vercel website still needs deploying for the Properties.ts change.

---

## Step 1: Pull latest

```bash
cd ~/Projects/kiuli-website
git pull origin main
```

Verify:
```bash
git log --oneline -3
```

Must show `60b7d28` as HEAD with message containing "M2 Phase 2".

---

## Step 2: Confirm build passes

```bash
cd ~/Projects/kiuli-website
npm run build 2>&1 | tail -20
echo "BUILD EXIT: $?"
```

Required: `BUILD EXIT: 0`. **STOP if build fails. Report the full error.**

---

## Step 3: Deploy to Vercel

```bash
cd ~/Projects/kiuli-website
vercel --prod --yes 2>&1 | tail -30
echo "VERCEL EXIT: $?"
```

Required: `VERCEL EXIT: 0`. Wait for the deployment to complete. The output should show a production URL.

**STOP if Vercel deploy fails. Report the error.**

---

## Step 4: Verify Vercel deployment

```bash
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com
```

Must return `200`.

---

## Step 5: Verify orchestrator Lambda is current

```bash
DEPLOYED_HASH=$(aws lambda get-function-configuration \
  --function-name kiuli-v6-orchestrator \
  --region eu-north-1 \
  --query 'Description' \
  --output text | grep -oP 'git:\K[a-f0-9]+')
HEAD_HASH=$(git rev-parse --short HEAD)
echo "Deployed: $DEPLOYED_HASH"
echo "HEAD:     $HEAD_HASH"
```

Both must match. If they don't, deploy the orchestrator:
```bash
cd ~/Projects/kiuli-website/lambda/scripts
./deploy.sh orchestrator
```

---

## Step 6: Run verification scrape

Use the Tanzania test itinerary. This is the itinerary with the most transfer segments, making it the best test for the toDestination fix.

```bash
cd ~/Projects/kiuli-website
source .env.vercel-prod 2>/dev/null || source .env.local

curl -s -X POST https://kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "update"}'
```

Capture the `jobId` from the response. Poll for completion:

```bash
JOB_ID="<jobId from response>"
while true; do
  RESULT=$(curl -s "https://kiuli.com/api/itinerary-jobs/$JOB_ID?depth=0" \
    -H "Authorization: Bearer $PAYLOAD_API_KEY")
  STATUS=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))")
  PHASE=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('currentPhase',''))")
  echo "$(date -u +%H:%M:%S) — $STATUS — $PHASE"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 15
done
```

**If status is "failed":**
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1 | tail -50
```
Report the error. **STOP. Do not proceed.**

---

## Step 7: Verify Fix 1 — toDestination populated on transfer routes

```bash
source .env.vercel-prod 2>/dev/null || source .env.local
psql "$POSTGRES_URL" -c "
SELECT slug, \"fromDestination_id\", \"toDestination_id\", \"observationCount\"
FROM transfer_routes
ORDER BY \"updatedAt\" DESC
LIMIT 15;
"
```

Check: transfer routes should have non-null `toDestination_id` values. Previously most were null. Count how many have non-null toDestination_id vs total.

---

## Step 8: Verify Fix 2 — seasonalityData populated

```bash
psql "$POSTGRES_URL" -c "
SELECT p.name, p.\"accumulatedData\"
FROM properties p
WHERE p.\"accumulatedData\" IS NOT NULL
ORDER BY p.\"updatedAt\" DESC
LIMIT 5;
"
```

Check: `accumulatedData` JSON should contain a `seasonalityData` array with at least one entry that has a `month` number and `observationCount >= 1`.

Alternative check via CloudWatch:
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1 \
  | grep -i "seasonality\|accumulatedData"
```

---

## Step 9: Verify Fix 3 — availability.source 'manual' option in admin

Open https://kiuli.com/admin/collections/properties in a browser.
- Click into any property record
- Scroll to the Availability section
- Confirm the Source dropdown includes "Manual" as an option

If you cannot visually check, run:
```bash
curl -s "https://kiuli.com/api/properties?limit=1" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" | python3 -c "import sys,json; print('API responding' if json.load(sys.stdin).get('docs') is not None else 'API ERROR')"
```

This confirms the Vercel deploy succeeded and the schema is live. The 'manual' option presence can be confirmed when a designer next uses the admin.

---

## Report Format

```
M2 PHASE 2 DEPLOY & VERIFY REPORT
===================================

VERCEL DEPLOYMENT
  Build passed: YES/NO
  Vercel deploy: DEPLOYED/FAILED
  Site responding (200): YES/NO

ORCHESTRATOR LAMBDA
  Deployed hash: [hash]
  HEAD hash: [hash]
  Match: YES/NO

VERIFICATION SCRAPE
  Itinerary: Tanzania (Big Game)
  Job ID: [id]
  Status: completed/failed
  Duration: [approximate]

FIX 1: toDestination
  Transfer routes total: [n]
  With toDestination_id: [n]
  Without toDestination_id: [n]
  VERDICT: FIXED / NOT FIXED / PARTIAL

FIX 2: seasonalityData
  Properties with accumulatedData: [n]
  seasonalityData array present: YES/NO
  Sample month + observationCount: [value]
  VERDICT: FIXED / NOT FIXED

FIX 3: availability.source 'manual'
  Vercel deployed (schema live): YES/NO
  VERDICT: CONFIRMED / UNCONFIRMED

BLOCKERS
[Exact description of anything that did not pass, with error details]

STATUS: ALL PASS / PARTIAL FAIL / BLOCKED
```

---

## Rules

- Execute steps in order. STOP and report on any failure.
- Do not skip verification steps.
- Do not attempt fixes — report failures for instructions.
- Show raw command output, not summaries.
