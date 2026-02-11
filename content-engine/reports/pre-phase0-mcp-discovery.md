# Pre-Phase 0 Reconnaissance Report

**Date:** 2026-02-11
**Reporter:** Claude CLI

---

## 1. MCP Server Discovery

### Current Running Process
- **PID:** 71728
- **Command:** `/opt/homebrew/bin/node /Users/grahamwallington/Projects/kiuli-website/tools/mcp-filesystem-server/server.mjs`
- **Working Directory:** `/Users/grahamwallington/Projects/kiuli-website/tools/mcp-filesystem-server`
- **Status:** Running, but the source directory (`tools/mcp-filesystem-server/`) has been **deleted from disk**. The process continues to run because Node loaded the file into memory before deletion.

### Process Management: launchd (macOS)
Two plist files manage the Kiuli MCP infrastructure:

**1. `com.kiuli.mcp-server`** (`~/Library/LaunchAgents/com.kiuli.mcp-server.plist`)
- Runs: `/opt/homebrew/bin/node .../tools/mcp-filesystem-server/server.mjs`
- ENV: `BASE_PATH=/kiuli`
- KeepAlive: true, RunAtLoad: true
- Logs: `tools/mcp-filesystem-server/server.log` and `server-error.log`

**2. `com.kiuli.tailscale-funnel`** (`~/Library/LaunchAgents/com.kiuli.tailscale-funnel.plist`)
- Runs: `tailscale funnel --https=8443 3101`
- KeepAlive: true, RunAtLoad: true
- Logs: `tools/mcp-filesystem-server/funnel.log` and `funnel-error.log`

### Tailscale Funnel Configuration
```
https://grahams-macbook-air.tail2d6663.ts.net (Funnel on)
|-- /      proxy http://localhost:3100
|-- /kiuli proxy http://localhost:3101
```

### Port Mapping
| Service | Local Port | Tailscale Path |
|---------|-----------|----------------|
| Avatarix MCP | 3100 | / |
| Kiuli MCP (old) | 3101 | /kiuli |
| Kiuli MCP (new) | 3200 (default in new server.mjs) | /kiuli (needs reconfiguration) |

### New Server (`tools/mcp-server/server.mjs`)
- **PORT:** 3200 (default, configurable via `PORT` env var)
- **PROJECT_ROOT:** `/Users/grahamwallington/Projects/kiuli-website` (default)
- **BASE_PATH:** configurable via env var
- **Dependencies:** Installed (122 packages, 0 vulnerabilities)

---

## 2. Git Status

**Branch:** `main` (up to date with `origin/main`)

**Uncommitted changes:**
- Modified: `tsconfig.tsbuildinfo` (unstaged)
- Untracked: `content-engine/` directory
- Untracked: `tools/` directory

**Recent commits:**
```
1deb875 chore: remove template residue, dead dependencies, fix stale docs
34f11de chore: rotate API key, delete dead files, clean repo for Content Engine build
e8d7eb5 cleanup: remove schema check endpoint
20ed479 temp: exclude rels tables from check
a3cea95 temp: schema check endpoint
```

---

## 3. Build Status

**Result: PASS** (exit code 0)

Build completes successfully with:
- Static pages prerendered (safaris, properties, destinations, posts)
- Dynamic routes (API, search, admin)
- Sitemap generation completed
- No build errors or warnings

---

## 4. Vercel Environment

**Authenticated as:** `grahamkiuli`
**Organization:** Kiuli (org-long-rice-46985810)

### Content Engine Required Keys — Status

| Variable | Required For | Status |
|----------|-------------|--------|
| `OPENROUTER_API_KEY` | AI Enhancement | **EXISTS** (all environments) |
| `DATABASE_URL_UNPOOLED` | Content Engine DB | **EXISTS** (all environments) |
| `POSTGRES_URL_NON_POOLING` | Content Engine DB | **EXISTS** (all environments) |
| `PERPLEXITY_API_KEY` | Phase 8 | **MISSING** |
| `OPENAI_API_KEY` | Phase 2 | **MISSING** |
| `CONTENT_SYSTEM_SECRET` | Phase 1+ | **MISSING** |
| `CONTENT_LAMBDA_API_KEY` | Phase 5+ | **MISSING** |

### Other Notable Keys Present
- `PAYLOAD_API_KEY`, `PAYLOAD_API_URL`, `PAYLOAD_SECRET`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION`
- `LAMBDA_PIPELINE_URL`, `LAMBDA_INVOKE_SECRET`, `LAMBDA_SCRAPER_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`
- `HUBSPOT_ACCESS_TOKEN`, `HUBSPOT_PORTAL_ID`
- `GA4_API_SECRET`, `GOOGLE_ADS_CUSTOMER_ID`
- `NEON_PROJECT_ID`
- `GEMINI_API_KEY`
- `CRON_SECRET`

---

## 5. neonctl

**Version:** 2.20.2 (installed and available)
**Authentication:** Prompted for organization selection (interactive — appears to be authenticated)

---

## 6. Database

**Connection:** Successful via `POSTGRES_URL` from `.env.local`
**Table count:** 148 tables in `public` schema

### Key Tables Present
- `itineraries` + related (days, blocks, faq_items, rels, etc.)
- `destinations` + related
- `properties` + related
- `media` + related (mood, setting, suitable_for)
- `pages` + blocks (archive, content, cta, featured_*, home_hero, etc.)
- `posts` + related
- `authors`, `categories`, `designers`
- `itinerary_jobs` (pipeline tracking)
- `voice_configuration` (AI voice settings)
- `inquiries` (lead capture)
- `property_name_mappings` (scraper mapping)
- `sessions`, `users`
- `payload_*` system tables (migrations, preferences, locked_documents, jobs, kv, folders)
- Version tables (`_*_v`) for all major collections

---

## 7. Recommended Actions for Graham

### Step 1: Update the launchd plist to point to the new server

Edit `~/Library/LaunchAgents/com.kiuli.mcp-server.plist`:

```xml
<!-- Change ProgramArguments from: -->
<string>/Users/grahamwallington/Projects/kiuli-website/tools/mcp-filesystem-server/server.mjs</string>

<!-- To: -->
<string>/Users/grahamwallington/Projects/kiuli-website/tools/mcp-server/server.mjs</string>
```

```xml
<!-- Change WorkingDirectory from: -->
<string>/Users/grahamwallington/Projects/kiuli-website/tools/mcp-filesystem-server</string>

<!-- To: -->
<string>/Users/grahamwallington/Projects/kiuli-website/tools/mcp-server</string>
```

### Step 2: Set the correct PORT in the plist

Add to `EnvironmentVariables` dict:
```xml
<key>PORT</key>
<string>3101</string>
```

This keeps the new server on port 3101 so the existing Tailscale Funnel config continues to work without changes.

### Step 3: Update log paths in the plist

```xml
<key>StandardOutPath</key>
<string>/Users/grahamwallington/Projects/kiuli-website/tools/mcp-server/server.log</string>
<key>StandardErrorPath</key>
<string>/Users/grahamwallington/Projects/kiuli-website/tools/mcp-server/server-error.log</string>
```

### Step 4: Reload the service

```bash
# Unload old service
launchctl unload ~/Library/LaunchAgents/com.kiuli.mcp-server.plist

# Load updated service
launchctl load ~/Library/LaunchAgents/com.kiuli.mcp-server.plist

# Verify it's running
launchctl list | grep kiuli
ps aux | grep mcp-server | grep -v grep
```

### Step 5: Update Tailscale Funnel log paths (optional)

Edit `~/Library/LaunchAgents/com.kiuli.tailscale-funnel.plist` to point logs to the new directory.

### Step 6: Verify end-to-end

```bash
# Test local
curl http://localhost:3101/kiuli/sse

# Test via Tailscale Funnel
curl https://grahams-macbook-air.tail2d6663.ts.net/kiuli/sse
```

### Step 7: Add missing environment variables (before Content Engine phases)

Add to Vercel (when ready for each phase):
- `CONTENT_SYSTEM_SECRET` — Phase 1+
- `OPENAI_API_KEY` — Phase 2
- `CONTENT_LAMBDA_API_KEY` — Phase 5+
- `PERPLEXITY_API_KEY` — Phase 8

---

*Report complete. No source code was modified. No commits made. No deployments triggered.*
