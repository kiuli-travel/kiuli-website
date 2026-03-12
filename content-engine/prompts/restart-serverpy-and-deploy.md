# Restart server.py + Deploy Image-Processor + Vercel + Verify

**Date:** 2026-03-12
**Scope:** Restart the real MCP server (server.py, NOT server.mjs), deploy image-processor Lambda with sharp fix, deploy to Vercel, run verification scrape.

---

## Context

The Kiuli MCP server is `tools/mcp-server/server.py` — a Python FastMCP server on port 8420. NOT server.mjs (which has never been the running server). server.py was just killed. It needs restarting with the 6 new tools that were added to it (deploy_lambda, verify_lambdas, trigger_pipeline, pipeline_status, vercel_deploy, vercel_logs).

The image-processor Lambda also needs redeploying because previous deploys used macOS-native sharp binaries. deploy.sh has been fixed.

---

## Step 1: Pull latest

```bash
cd ~/Projects/kiuli-website
git pull origin main
git log --oneline -3
```

---

## Step 2: Restart server.py

The previous prompt killed it. Start it back up:

```bash
cd ~/Projects/kiuli-website/tools/mcp-server

# Confirm nothing is on 8420
lsof -i :8420 || echo "Port 8420 free"

# Start server.py with its required environment
source ~/Projects/kiuli-website/.env.local 2>/dev/null || source ~/Projects/kiuli-website/.env.vercel-prod 2>/dev/null || true
export PROJECT_ROOT=~/Projects/kiuli-website

nohup python3 server.py > server.log 2> server-error.log &
disown
sleep 3
```

Verify it's running:

```bash
lsof -i :8420
```

Must show a Python process listening on 8420. If it's not running, check the error log:

```bash
cat ~/Projects/kiuli-website/tools/mcp-server/server-error.log
```

**STOP if server.py fails to start. Report the error log contents.**

---

## Step 3: Deploy image-processor Lambda

```bash
cd ~/Projects/kiuli-website/lambda/scripts
./deploy.sh image-processor
```

Must complete with `DEPLOYMENT SUCCESSFUL`.

After deployment, confirm only linux binaries exist:

```bash
ls ~/Projects/kiuli-website/lambda/image-processor/node_modules/@img/ 2>/dev/null
```

Should show only `sharp-linux-x64` and `sharp-libvips-linux-x64`. No darwin directories.

**STOP if deploy fails.**

---

## Step 4: Deploy to Vercel

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

## Step 5: Run verification scrape (Tanzania)

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

**If failed:**
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1 | tail -50
aws logs tail /aws/lambda/kiuli-v6-image-processor --since 30m --region eu-north-1 | tail -50
```

**STOP on failure.**

---

## Step 6: Verify M2 Phase 2 fixes

```bash
source .env.vercel-prod 2>/dev/null || source .env.local

# Fix 1: toDestination populated
psql "$POSTGRES_URL" -c "
SELECT slug, \"fromDestination_id\", \"toDestination_id\", \"observationCount\"
FROM transfer_routes
ORDER BY \"updatedAt\" DESC
LIMIT 15;
"

# Fix 2: seasonalityData populated
psql "$POSTGRES_URL" -c "
SELECT p.name, p.\"accumulatedData\"
FROM properties p
WHERE p.\"accumulatedData\" IS NOT NULL
ORDER BY p.\"updatedAt\" DESC
LIMIT 5;
"
```

---

## Step 7: Commit and push server.py changes

The server.py file was updated with 6 new tools. Commit it:

```bash
cd ~/Projects/kiuli-website
git add tools/mcp-server/server.py
git commit -m "feat(mcp): add deploy_lambda, verify_lambdas, trigger_pipeline, pipeline_status, vercel_deploy, vercel_logs to server.py"
git push origin main
```

---

## Report Format

```
SERVER.PY RESTART + M2 PHASE 2 REPORT
=======================================

MCP SERVER
  server.py started: YES/NO
  Listening on port 8420: YES/NO

IMAGE-PROCESSOR DEPLOYMENT
  deploy.sh completed: YES/NO
  node_modules/@img/ contents: [list]
  Deployed hash: [hash]

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

GIT
  server.py committed and pushed: YES/NO

BLOCKERS
[Exact errors if any]

STATUS: ALL PASS / PARTIAL FAIL / BLOCKED
```

---

## Rules

- Execute in order. STOP on failure.
- Show raw output, not summaries.
- Do not attempt fixes — report failures for instructions.
