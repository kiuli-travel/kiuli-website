# M2 Phase 2 — Sharp Fix + Retry Verification Scrape

**Date:** 2026-03-12
**Prerequisite:** deploy.sh fix committed and pushed (replaces `--force` with `npm_config_os=linux npm_config_cpu=x64`)
**Scope:** Redeploy image-processor Lambda with fixed native module resolution, then resume the verification scrape from `m2-phase2-deploy-and-verify.md` starting at Step 6.

---

## Context

The previous verification scrape failed because the image-processor Lambda crashed with:

```
Could not load the "sharp" module using the linux-x64 runtime
```

Root cause: `deploy.sh` used `npm ci --force` which installed macOS-native sharp binaries. Lambda runs linux-x64 and couldn't find compatible binaries.

Fix: `deploy.sh` now uses `npm_config_os=linux npm_config_cpu=x64 npm ci --silent` which tells npm to resolve platform-specific packages for linux-x64 regardless of host OS.

---

## Step 1: Pull latest

```bash
cd ~/Projects/kiuli-website
git pull origin main
git log --oneline -3
```

Must show the deploy.sh fix commit at HEAD.

---

## Step 2: Redeploy image-processor

```bash
cd ~/Projects/kiuli-website/lambda/scripts
./deploy.sh image-processor
```

Must complete with `DEPLOYMENT SUCCESSFUL`. **STOP if it fails.**

If npm ci fails with errors about platform resolution, report the exact error.

---

## Step 3: Verify image-processor deployment

```bash
aws lambda get-function-configuration \
  --function-name kiuli-v6-image-processor \
  --region eu-north-1 \
  --query '{State:State,Description:Description,CodeSize:CodeSize}' \
  --output json
```

- State must be `Active`
- Description must contain the current HEAD hash
- CodeSize should be larger than the previous deployment (linux-x64 binaries are ~18-20MB)

---

## Step 4: Deploy Vercel (if not already done)

Check if the previous prompt already deployed to Vercel:

```bash
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com
```

If returning 200, check if the Properties.ts schema change is live by verifying a recent Vercel deployment timestamp:

```bash
vercel ls --prod 2>&1 | head -5
```

If the most recent production deployment is before today, deploy now:

```bash
cd ~/Projects/kiuli-website
npm run build 2>&1 | tail -20
echo "BUILD EXIT: $?"
```

Required: `BUILD EXIT: 0`. Then:

```bash
vercel --prod --yes 2>&1 | tail -30
echo "VERCEL EXIT: $?"
```

**STOP if build or deploy fails.**

---

## Step 5: Run verification scrape (Tanzania)

```bash
cd ~/Projects/kiuli-website
source .env.vercel-prod 2>/dev/null || source .env.local

curl -s -X POST https://kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "update"}'
```

Capture the `jobId`. Poll for completion:

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
aws logs tail /aws/lambda/kiuli-v6-image-processor --since 30m --region eu-north-1 | tail -50
```
Report both log tails. **STOP.**

---

## Step 6: Verify Fix 1 — toDestination populated on transfer routes

```bash
source .env.vercel-prod 2>/dev/null || source .env.local
psql "$POSTGRES_URL" -c "
SELECT slug, \"fromDestination_id\", \"toDestination_id\", \"observationCount\"
FROM transfer_routes
ORDER BY \"updatedAt\" DESC
LIMIT 15;
"
```

Count how many have non-null `toDestination_id` vs total.

---

## Step 7: Verify Fix 2 — seasonalityData populated

```bash
psql "$POSTGRES_URL" -c "
SELECT p.name, p.\"accumulatedData\"
FROM properties p
WHERE p.\"accumulatedData\" IS NOT NULL
ORDER BY p.\"updatedAt\" DESC
LIMIT 5;
"
```

Look for `seasonalityData` array in the JSON with at least one entry containing `month` and `observationCount`.

---

## Step 8: Verify Fix 3 — availability.source 'manual' option

Confirm Vercel deployment is live (done in Step 4). The schema change is deployed — the 'manual' option will appear in admin when a designer edits a property.

---

## Report Format

```
M2 PHASE 2 SHARP FIX + VERIFY REPORT
======================================

IMAGE-PROCESSOR REDEPLOYMENT
  deploy.sh completed: YES/NO
  Deployed hash: [hash]
  HEAD hash: [hash]
  Match: YES/NO
  CodeSize: [bytes]

VERCEL DEPLOYMENT
  Deployed: YES/NO/ALREADY CURRENT
  Site responding (200): YES/NO

VERIFICATION SCRAPE
  Itinerary: Tanzania (Big Game)
  Job ID: [id]
  Status: completed/failed

FIX 1: toDestination
  Transfer routes total: [n]
  With toDestination_id: [n]
  Without toDestination_id: [n]
  VERDICT: FIXED / NOT FIXED / PARTIAL

FIX 2: seasonalityData
  Properties with accumulatedData: [n]
  seasonalityData present: YES/NO
  Sample: [month, observationCount]
  VERDICT: FIXED / NOT FIXED

FIX 3: availability.source 'manual'
  Vercel deployed: YES/NO
  VERDICT: CONFIRMED / UNCONFIRMED

BLOCKERS
[Exact errors if any]

STATUS: ALL PASS / PARTIAL FAIL / BLOCKED
```

---

## Rules

- Execute steps in order. STOP and report on any failure.
- Do not skip verification steps.
- Do not attempt fixes — report failures for instructions.
- Show raw command output, not summaries.
