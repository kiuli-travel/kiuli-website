# CLI Prompt: Pre-Phase 0 — MCP Server Setup & Reconnaissance

## Context

You are in ~/Projects/kiuli-website. We are setting up enhanced tooling before starting the Content Engine build. An enhanced MCP server has been written at `tools/mcp-server/server.mjs` that adds git, build, database, and Payload tools to Claude.ai's visibility.

## Tasks

### Task 1: Install MCP Server Dependencies

```bash
cd tools/mcp-server
npm install
cd ../..
```

Report: Confirm all dependencies installed without errors.

### Task 2: Discover Current MCP Server Process

The Kiuli MCP server is currently accessible at:
`https://grahams-macbook-air.tail2d6663.ts.net/kiuli/sse`

Find how it's currently running:

```bash
# Check for running MCP/node processes
ps aux | grep -i "mcp\|kiuli.*server" | grep -v grep

# Check if there's a launchctl service
launchctl list | grep -i "mcp\|kiuli"

# Check for pm2 processes
pm2 list 2>/dev/null || echo "pm2 not installed"

# Check Tailscale Funnel configuration
tailscale funnel status 2>/dev/null || tailscale serve status 2>/dev/null

# Look for startup scripts or configs
find /Users/grahamwallington -name "*.plist" -path "*kiuli*" 2>/dev/null
find /Users/grahamwallington -name "*.service" -path "*kiuli*" 2>/dev/null
```

Report: Write findings to `content-engine/reports/pre-phase0-mcp-discovery.md` including:
- How the current server process is managed
- What port it's on
- What PROJECT_ROOT it uses
- How Tailscale Funnel routes to it
- Exact steps Graham needs to take to switch to the new server

### Task 3: Git Status

```bash
git status
git log --oneline -5
```

Report: Include in the same report file.

### Task 4: Build Verification

```bash
npm run build 2>&1 | tail -30
echo "Exit code: $?"
```

Report: Include in the same report file.

### Task 5: Vercel Environment Check

```bash
vercel whoami 2>/dev/null || echo "Vercel CLI not authenticated"
vercel env ls 2>/dev/null || echo "Could not list env vars"
```

Report: Include in the same report file. Specifically check for:
- OPENROUTER_API_KEY (should exist)
- DATABASE_URL_UNPOOLED or POSTGRES_URL_NON_POOLING (needed for Content Engine)
- PERPLEXITY_API_KEY (needed for Phase 8)
- OPENAI_API_KEY (needed for Phase 2)
- CONTENT_SYSTEM_SECRET (needed for Phase 1+)
- CONTENT_LAMBDA_API_KEY (needed for Phase 5+)

### Task 6: neonctl Check

```bash
neonctl --version 2>/dev/null || echo "neonctl not installed"
neonctl projects list --output json 2>/dev/null || echo "neonctl not authenticated or not installed"
```

Report: Include in the same report file.

### Task 7: Database Connection Check

```bash
# Try to connect to the database (read the URL from .env.local or Vercel)
# If .env.local exists and has POSTGRES_URL:
if [ -f .env.local ]; then
  POSTGRES_URL=$(grep "^POSTGRES_URL=" .env.local | cut -d'=' -f2-)
  if [ -n "$POSTGRES_URL" ]; then
    psql "$POSTGRES_URL" -c "SELECT count(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';" 2>&1
    psql "$POSTGRES_URL" -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" 2>&1
  fi
fi
```

Report: Include in the same report file.

## Report Format

Write all findings to `content-engine/reports/pre-phase0-mcp-discovery.md` using this structure:

```markdown
# Pre-Phase 0 Reconnaissance Report

**Date:** [timestamp]
**Reporter:** Claude CLI

## 1. MCP Server Discovery
[findings]

## 2. Git Status
[findings]

## 3. Build Status
[pass/fail + relevant output]

## 4. Vercel Environment
[which keys exist, which are missing]

## 5. neonctl
[available/not available]

## 6. Database
[connection status, table count, table list]

## 7. Recommended Actions for Graham
[exact steps to switch MCP server]
```

## Important

- Do NOT modify any source code
- Do NOT commit anything to git
- Do NOT deploy anything
- This is reconnaissance only — read and report
