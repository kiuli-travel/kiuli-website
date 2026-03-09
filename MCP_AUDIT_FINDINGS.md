# MCP Audit Findings — Phase 0 Discovery

**Date:** 2026-03-04
**Auditor:** Claude Code

---

## 0.1 Server Code Location

MCP server directory: `~/Projects/kiuli-website/tools/mcp-server/`

**Files found:**

| File | Purpose | Status |
|------|---------|--------|
| `server.py` | Python FastMCP server (currently running) | Active via launchd |
| `server.mjs` | Node.js MCP server (more tools, not running) | Dormant |
| `package.json` | Node.js deps for server.mjs | Not relevant to Python server |
| `README.md` | Documentation (partially outdated — references SSE/old port) | Stale |
| `server.log` | Server stdout log (63KB) | Active |
| `server-error.log` | Server stderr log (empty) | Active |

Also found: `tools/mcp-filesystem-server/` — contains only funnel logs, no server code.

## 0.2 Server Code Analysis

### server.py (CURRENTLY RUNNING)

- **Transport:** `streamable-http` ✅
- **Binding:** `127.0.0.1` ✅
- **Port:** Via env var `PORT`, set to `3101` by launchd plist ❌ (should be 8420)
- **Path:** Uses FastMCP default (`/mcp`) — no explicit `path="/"` argument ❌
- **Monkey patch 1 (strip _meta):** MISSING ❌
- **Monkey patch 2 (ToolListChangedNotification):** MISSING ❌
- **Tool error handling (try/except):** MISSING ❌ — tools raise raw exceptions
- **FastMCP instantiation:** `FastMCP(SERVER_NAME)` — no auth ✅ (correct for now)

**Tools registered (10):**
1. `list_directory` — filesystem listing
2. `read_file` — read file contents
3. `write_file` — write file
4. `delete_file` — delete file/dir
5. `get_file_info` — file metadata
6. `search_files` — regex/string search
7. `git_status` — branch, changes, unpushed
8. `git_commit_push` — stage, commit, push
9. `run_build` — npm run build
10. `payload_command` — whitelisted Payload commands
11. `db_query` — read-only SQL
12. `vercel_env_list` — list Vercel env vars

### server.mjs (NOT RUNNING — has additional tools)

- **Transport:** Streamable HTTP via Express + `@modelcontextprotocol/sdk`
- **Binding:** `0.0.0.0` ❌
- **Port:** 3200 default
- **Additional tools NOT in server.py:**
  - `db_exec` — write SQL with confirmation gate
  - `lambda_status` — check deployed Lambda function status + git hash sync
  - `lambda_logs` — tail CloudWatch logs for Lambda functions

## 0.3 Running State

```
PID 74100 — /Users/grahamwallington/.config/mcp/venv/bin/python3 server.py
Port: 3101 (TCP LISTEN)
```

Server is responding:
- `GET /` → 404 Not Found (no root handler)
- `POST /mcp` → 200 OK (MCP endpoint working)
- `GET /mcp` → 406 Not Acceptable (expected for streamable-http without session)

Logs show Claude.ai connections from `160.79.106.*` (Anthropic IPs) with successful POST/GET/DELETE cycles. Also shows `GET /.well-known/oauth-protected-resource` → 404 (Claude.ai checking for OAuth, not found).

## 0.4 Installed Packages (shared venv)

Venv: `/Users/grahamwallington/.config/mcp/venv/`
Python: 3.14.2

| Package | Installed | Required | Match? |
|---------|-----------|----------|--------|
| fastmcp | 3.0.2 | 3.0.2 | ✅ |
| mcp | 1.26.0 | 1.26.0 | ✅ |
| Authlib | 1.6.8 | 1.6.8 | ✅ |
| sse-starlette | 3.2.0 | 3.2.0 | ✅ |
| pydantic | 2.12.5 | 2.12.5 | ✅ |
| starlette | 0.52.1 | 0.52.1 | ✅ |
| uvicorn | 0.41.0 | 0.41.0 | ✅ |
| PyJWT | 2.11.0 | 2.11.0 | ✅ |
| python-multipart | 0.0.22 | 0.0.22 | ✅ |
| python-dotenv | 1.2.1 | 1.1.1 | ⚠️ minor diff |

All critical packages match. python-dotenv 1.2.1 vs 1.1.1 is a patch-level difference and unlikely to cause issues.

## 0.5 Tailscale Funnel

```
https://grahams-macbook-air.tail2d6663.ts.net:8443 → http://127.0.0.1:3101
https://grahams-macbook-air.tail2d6663.ts.net:8444 → http://127.0.0.1:3102
https://grahams-macbook-air.tail2d6663.ts.net:10000 → http://127.0.0.1:8510
https://grahams-macbook-air.tail2d6663.ts.net → http://127.0.0.1:3100
```

Kiuli is on `:8443` → `3101`. Needs to be updated to `8420`.

Tailscale hostname: `grahams-macbook-air` (100.97.77.125)

## 0.6 launchd

**Agent:** `com.kiuli.mcp-server` (PID 74100, running)
**Plist:** `~/Library/LaunchAgents/com.kiuli.mcp-server.plist`

Configuration:
- Runs: `/Users/grahamwallington/.config/mcp/venv/bin/python3 server.py`
- PORT=3101
- PROJECT_ROOT=/Users/grahamwallington/Projects/kiuli-website
- SERVER_NAME=Kiuli Files Local
- DATABASE_URL_UNPOOLED set (Neon Postgres)
- RunAtLoad + KeepAlive
- Logs: /tmp/mcp-kiuli.log, /tmp/mcp-kiuli-error.log

**Also found:** `com.kiuli.tailscale-funnel` — runs `tailscale funnel --https=8443 3101`

## Summary of Required Changes

| Item | Current | Required | Priority |
|------|---------|----------|----------|
| Port | 3101 | 8420 | HIGH |
| MCP path | `/mcp` (default) | `/` (explicit) | HIGH |
| Monkey patch 1 (strip _meta) | Missing | Required | CRITICAL |
| Monkey patch 2 (ToolListChanged) | Missing | Required | CRITICAL |
| Tool error handling | None | try/except on all tools | HIGH |
| Missing tools | — | db_exec, lambda_status, lambda_logs | MEDIUM |
| Funnel | 8443→3101 | 8443→8420 | HIGH |
| launchd plist | PORT=3101 | PORT=8420 | HIGH |
| Funnel plist | 8443→3101 | 8443→8420 | HIGH |
| OAuth | None | Phase 5 | AFTER authless works |
