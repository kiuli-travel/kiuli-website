# M2 Phase 2 — Sharp Fix v2 + Retry

**Date:** 2026-03-12
**Prerequisite:** deploy.sh fix v2 committed and pushed (combines `npm_config_os/cpu` + `--force` + strips non-linux binaries)
**Scope:** Redeploy image-processor, deploy Vercel, run verification scrape, verify all 3 M2 Phase 2 fixes.

---

## Context

v1 fix (`npm_config_os/cpu` without `--force`) failed with EBADPLATFORM because the linux-x64 sharp packages are direct dependencies, not optional. npm still enforces platform checks on direct deps regardless of npm_config env vars.

v2 fix uses all three mechanisms:
1. `npm_config_os=linux npm_config_cpu=x64` — resolution picks linux-x64 optional deps
2. `--force` — bypasses EBADPLATFORM on direct deps
3. Post-install cleanup — `rm -rf` of any darwin/win32/linuxmusl binaries that `--force` may have pulled as transitive deps

---

## Step 1: Pull latest

```bash
cd ~/Projects/kiuli-website
git pull origin main
git log --oneline -3
```

Must show the deploy.sh v2 fix at HEAD.

---

## Step 2: Redeploy image-processor

```bash
cd ~/Projects/kiuli-website/lambda/scripts
./deploy.sh image-processor
```

Must complete with `DEPLOYMENT SUCCESSFUL`.

After deployment, verify no darwin binaries made it into the package. This is informational — the rm step in deploy.sh should have handled it, but confirm:

```bash
cd ~/Projects/kiuli-website/lambda/image-processor
ls node_modules/@img/ 2>/dev/null
```

Should show only `sharp-linux-x64` and `sharp-libvips-linux-x64`. If darwin or win32 directories exist, the cleanup step failed — report it.

**STOP if deploy.sh fails.**

---

## Step 3: Deploy Vercel

```bash
cd ~/Projects/kiuli-website
npm run build 2>&1 | tail -20
echo "BUILD EXIT: $?"
```

Required: `BUILD EXIT: 0`.

```bash
vercel --prod --yes 2>&1 | tail -30
echo "VERCEL EXIT: $?"
```

Required: `VERCEL EXIT: 0`. **STOP if either fails.**

---

## Step 4: Run verification scrape (Tanzania)

```bash
cd ~/Projects/kiuli-website
source .env.vercel-prod 2>/dev/null || source .env.local

curl -s -X POST https://kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "update"}'
```

Capture `jobId`. Poll:

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

**If failed:** tail both Lambda logs and report:
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1 | tail -50
aws logs tail /aws/lambda/kiuli-v6-image-processor --since 30m --region eu-north-1 | tail -50
```

**STOP on failure.**

---

## Step 5: Verify Fix 1 — toDestination

```bash
source .env.vercel-prod 2>/dev/null || source .env.local
psql "$POSTGRES_URL" -c "
SELECT slug, \"fromDestination_id\", \"toDestination_id\", \"observationCount\"
FROM transfer_routes
ORDER BY \"updatedAt\" DESC
LIMIT 15;
"
```

---

## Step 6: Verify Fix 2 — seasonalityData

```bash
psql "$POSTGRES_URL" -c "
SELECT p.name, p.\"accumulatedData\"
FROM properties p
WHERE p.\"accumulatedData\" IS NOT NULL
ORDER BY p.\"updatedAt\" DESC
LIMIT 5;
"
```

Look for `seasonalityData` array with `month` and `observationCount`.

---

## Report Format

```
M2 PHASE 2 SHARP FIX v2 REPORT
================================

IMAGE-PROCESSOR REDEPLOYMENT
  deploy.sh completed: YES/NO
  node_modules/@img/ contents: [list]
  Deployed hash: [hash]
  Match HEAD: YES/NO

VERCEL
  Build: PASS/FAIL
  Deploy: PASS/FAIL

VERIFICATION SCRAPE
  Job ID: [id]
  Status: completed/failed

FIX 1: toDestination
  Transfer routes total: [n]
  With toDestination_id: [n]
  Without: [n]

FIX 2: seasonalityData
  seasonalityData present: YES/NO
  Sample: [data]

BLOCKERS
[Exact errors if any]

STATUS: ALL PASS / PARTIAL FAIL / BLOCKED
```

---

## Rules

- Execute in order. STOP on failure.
- Show raw output, not summaries.
- Do not attempt fixes.
