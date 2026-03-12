# Restart MCP Server + Deploy Image-Processor + Vercel + Verify

**Date:** 2026-03-12
**Scope:** Restart the Kiuli MCP server so Cowork gets all 21 tools, then deploy the image-processor Lambda with the sharp fix, deploy to Vercel, and run the M2 Phase 2 verification scrape.

---

## Context

The Kiuli MCP server (`tools/mcp-server/server.mjs`) runs as a standalone HTTP server on port 3200. It was last started before 6 new tools were added (deploy_lambda, verify_lambdas, trigger_pipeline, pipeline_status, vercel_deploy, vercel_logs). The running process still serves the old 15-tool version. Cowork connects to this server and can only see those 15 tools.

After restarting the server, Cowork will pick up all 21 tools on its next MCP session. This is the blocker preventing Cowork from deploying Lambdas and running pipelines directly.

Additionally, the image-processor Lambda needs redeploying because the previous deploy used macOS-native sharp binaries. deploy.sh has been fixed to use `npm_config_os=linux npm_config_cpu=x64` + `--force` + post-install cleanup of non-linux binaries.

---

## Step 1: Pull latest

```bash
cd ~/Projects/kiuli-website
git pull origin main
git log --oneline -5
```

---

## Step 2: Restart the MCP server

Find and kill the existing server process:

```bash
# Find the process
lsof -i :3200

# Kill it
kill $(lsof -ti :3200) 2>/dev/null || true
sleep 2

# Verify it's dead
lsof -i :3200
```

The second `lsof` must return nothing. If the port is still in use, try `kill -9`.

Start the server fresh:

```bash
cd ~/Projects/kiuli-website/tools/mcp-server
nohup node server.mjs > server.log 2> server-error.log &
disown
sleep 3
```

Verify it's running with all tools:

```bash
curl -s http://localhost:3200/health
```

Must return JSON with `"status": "ok"`. If it fails, check server-error.log:

```bash
cat ~/Projects/kiuli-website/tools/mcp-server/server-error.log
```

**STOP if the server fails to start.**

---

## Step 3: Deploy image-processor Lambda

```bash
cd ~/Projects/kiuli-website/lambda/scripts
./deploy.sh image-processor
```

Must complete with `DEPLOYMENT SUCCESSFUL`.

After deployment, confirm only linux binaries are present:

```bash
ls ~/Projects/kiuli-website/lambda/image-processor/node_modules/@img/ 2>/dev/null
```

Should show only `sharp-linux-x64` and `sharp-libvips-linux-x64`. No darwin, win32, or linuxmusl directories.

**STOP if deploy fails. Report exact error and which step it failed on.**

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

**STOP on failure. Report both log tails.**

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

## Report Format

```
MCP RESTART + M2 PHASE 2 VERIFY REPORT
========================================

MCP SERVER RESTART
  Old process killed: YES/NO
  New process started: YES/NO
  Health check passed: YES/NO

IMAGE-PROCESSOR DEPLOYMENT
  deploy.sh completed: YES/NO
  node_modules/@img/ contents: [list]
  Deployed hash: [hash]
  HEAD hash: [hash]
  Match: YES/NO

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
- Do not attempt fixes — report failures for instructions.
