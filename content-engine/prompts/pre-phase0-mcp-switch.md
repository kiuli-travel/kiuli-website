# CLI Prompt: Switch MCP Server to Enhanced Version

## Context

The Kiuli MCP server runs via launchd (`com.kiuli.mcp-server`). The current server points to `tools/mcp-filesystem-server/` which has been deleted from disk — the process is a zombie running from memory. The new enhanced server is at `tools/mcp-server/` with dependencies already installed.

You need to update the launchd plist and restart the service.

## Tasks

### Task 1: Read the current plist

```bash
cat ~/Library/LaunchAgents/com.kiuli.mcp-server.plist
```

### Task 2: Get the DATABASE_URL_UNPOOLED value

```bash
# Try .env.local first
grep -E "DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING" .env.local 2>/dev/null

# If not in .env.local, pull from Vercel
vercel env pull --environment=production /tmp/kiuli-env-check 2>/dev/null
grep -E "DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING" /tmp/kiuli-env-check 2>/dev/null
rm -f /tmp/kiuli-env-check
```

Pick whichever one exists. We need this for the db_query tool.

### Task 3: Update the plist

Write the updated plist to `~/Library/LaunchAgents/com.kiuli.mcp-server.plist`. The changes are:

1. All paths: `tools/mcp-filesystem-server` → `tools/mcp-server`
2. Add `PORT` = `3101` to EnvironmentVariables
3. Add `DATABASE_URL_UNPOOLED` to EnvironmentVariables (use the value from Task 2)
4. Keep `BASE_PATH=/kiuli` as-is
5. Keep KeepAlive, RunAtLoad as-is
6. Keep everything else as-is

Do NOT change the Tailscale Funnel plist — it doesn't need changes.

### Task 4: Restart the service

```bash
# Stop old zombie process
launchctl unload ~/Library/LaunchAgents/com.kiuli.mcp-server.plist

# Kill any orphaned process just in case
pkill -f "tools/mcp-filesystem-server/server.mjs" 2>/dev/null || true
pkill -f "tools/mcp-server/server.mjs" 2>/dev/null || true

# Small delay
sleep 2

# Start new service
launchctl load ~/Library/LaunchAgents/com.kiuli.mcp-server.plist

# Wait for startup
sleep 3
```

### Task 5: Verify

```bash
# Check process is running
ps aux | grep "mcp-server" | grep -v grep

# Check it's the NEW server (should show tools/mcp-server/, not tools/mcp-filesystem-server/)
ps aux | grep "mcp-server" | grep -v grep | grep "tools/mcp-server/"

# Health check
curl -s http://localhost:3101/kiuli/health

# Check Tailscale Funnel still works
curl -s https://grahams-macbook-air.tail2d6663.ts.net/kiuli/health

# Check server logs for any errors
cat tools/mcp-server/server-error.log 2>/dev/null || echo "No error log yet"
tail -5 tools/mcp-server/server.log 2>/dev/null || echo "No server log yet"
```

### Task 6: Report

Write results to `content-engine/reports/pre-phase0-mcp-switch.md`:

```markdown
# MCP Server Switch Report

**Date:** [timestamp]

## Process Status
- Old process killed: YES/NO
- New process running: YES/NO
- PID: [pid]
- Server path: [path shown in ps]

## Health Check
- Local (localhost:3101): [response]
- Tailscale Funnel: [response]

## Errors
[any error log contents, or "None"]

## Status: COMPLETE / FAILED
[if failed, explain what went wrong]
```

## Important

- Do NOT modify any project source code
- Do NOT commit anything to git
- Do NOT deploy anything
- The ONLY file you modify outside the project is the launchd plist
