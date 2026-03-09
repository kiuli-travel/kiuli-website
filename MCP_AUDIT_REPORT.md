# MCP Audit Report — Kiuli

**Date:** 2026-03-04
**Auditor:** Claude Code

---

## 1. Before State (Phase 0 Discovery)

| Item | Before |
|------|--------|
| Server file | `tools/mcp-server/server.py` (Python FastMCP) |
| Transport | `streamable-http` |
| Binding | `127.0.0.1` |
| Port | 3101 |
| MCP path | `/mcp` (FastMCP default) |
| Monkey patch 1 (strip _meta) | **Missing** |
| Monkey patch 1b (strip outputSchema) | **Missing** |
| Monkey patch 2 (ToolListChanged nudge) | **Missing** |
| Tool error handling | **None** — tools raised raw exceptions |
| OAuth | **None** |
| Tools count | 12 (missing db_exec, lambda_status, lambda_logs) |
| Funnel | `:8443 → 3101` |
| launchd | `com.kiuli.mcp-server` running PID 74100 |

Also found: `server.mjs` (Node.js MCP server, not running but had more tools).

## 2. Changes Made

### `tools/mcp-server/server.py` — Complete rewrite

| Change | Why |
|--------|-----|
| Added PATCH 1: `_PatchTool.get_meta = lambda self: None` | Claude.ai rejects tools/list with `_meta` present |
| Added PATCH 1b: Strip `outputSchema` from `Tool.model_dump` | Claude.ai rejects outputSchema in protocol 2024-11-05 |
| Added PATCH 2: `ToolListChangedNotification` nudge (0.5s, 2.0s, 5.0s) | Claude.ai doesn't discover tools without this nudge |
| Added try/except on all 15 tools | Tools must never raise exceptions to the MCP layer |
| Changed port default to 8420 | Avoid conflicts (karula=8417, djumacam=8418, xen1=8419) |
| Changed path to `"/"` (explicit) | Consistent with guide |
| Added `json_response=True` | Returns JSON instead of SSE for simpler session management |
| Added `_NormaliseAcceptMiddleware` | MCP SDK requires specific Accept header |
| Added 3 new tools: `db_exec`, `lambda_status`, `lambda_logs` | Ported from server.mjs |
| Added OAuth support (conditional on `MCP_PASSWORD` env var) | Server runs authless if no password set |
| Added login routes (GET/POST `/login`) | OAuth authorization flow |
| Added `_RFC6750FixMiddleware` | Fixes Claude.ai 401 loop on first connection |

### `tools/mcp-server/oauth_provider.py` — New file

Adapted from Graham Dev's working OAuth provider. SQLite-backed, single-user, all 9 abstract methods implemented. Uses Kiuli teal (#486A6A) branding in login form.

### `~/Library/LaunchAgents/com.kiuli.mcp-server.plist`

| Change | Before | After |
|--------|--------|-------|
| PORT | 3101 | 8420 |
| SERVER_NAME | Kiuli Files Local | Kiuli Files |
| MCP_USERNAME | (not set) | graham |
| MCP_PASSWORD | (not set) | hosana22 |
| MCP_SERVER_URL | (not set) | https://grahams-macbook-air.tail2d6663.ts.net:8443 |
| OAUTH_DB_PATH | (not set) | /tmp/kiuli-mcp-oauth.db |
| BASE_PATH | (empty) | (removed — not used) |
| EXTERNAL_BASE_PATH | /kiuli | (removed — not used) |

### `~/Library/LaunchAgents/com.kiuli.tailscale-funnel.plist`

Updated from `--https=8443 3101` to `--https=8443 8420`.

### Tailscale Funnel

Updated from `:8443 → 3101` to `:8443 → 8420`.

## 3. Package Versions

Using shared venv at `/Users/grahamwallington/.config/mcp/venv/` (Python 3.14.2).

| Package | Installed | Required | Match |
|---------|-----------|----------|-------|
| fastmcp | 3.0.2 | 3.0.2 | ✅ |
| mcp | 1.26.0 | 1.26.0 | ✅ |
| Authlib | 1.6.8 | 1.6.8 | ✅ |
| sse-starlette | 3.2.0 | 3.2.0 | ✅ |
| pydantic | 2.12.5 | 2.12.5 | ✅ |
| starlette | 0.52.1 | 0.52.1 | ✅ |
| uvicorn | 0.41.0 | 0.41.0 | ✅ |
| PyJWT | 2.11.0 | 2.11.0 | ✅ |
| python-multipart | 0.0.22 | 0.0.22 | ✅ |
| python-dotenv | 1.2.1 | 1.1.1 | ⚠️ minor |

## 4. Test Results

### Phase 4: Authless Testing

```
✅ Local connectivity: POST http://127.0.0.1:8420/ → 200 OK
✅ MCP initialize: protocolVersion=2024-11-05, serverInfo.name=Kiuli Files
✅ Initialized notification: 202 Accepted
✅ tools/list: 15 tools, no _meta, no outputSchema
✅ git_status: branch=main, changes detected correctly
✅ list_directory: 45 entries returned
✅ db_query: SELECT count(*) FROM pages → 1 row
✅ Funnel: All tests pass via https://grahams-macbook-air.tail2d6663.ts.net:8443/
```

### Phase 5: OAuth Testing

```
✅ OAuth discovery: All URLs use https://grahams-macbook-air.tail2d6663.ts.net:8443/
✅ Protected resource metadata: Correct resource and authorization_servers
✅ Dynamic Client Registration: Successful
✅ Login form: Accessible at /login (GET)
```

### RFC 6750 WWW-Authenticate Tests

**No Authorization header (first-time connection):**
```
www-authenticate: Bearer resource_metadata="https://grahams-macbook-air.tail2d6663.ts.net:8443/.well-known/oauth-protected-resource"
```
✅ No `error="invalid_token"` — RFC 6750 compliant

**With bad Bearer token:**
```
www-authenticate: Bearer error="invalid_token", error_description="Authentication failed...", resource_metadata="..."
```
✅ `error="invalid_token"` correctly present when token was provided but invalid

## 5. Funnel Status

```
https://grahams-macbook-air.tail2d6663.ts.net:8443 (Funnel on)
|-- / proxy http://127.0.0.1:8420
```

## 6. launchd Status

```
39439    0    com.kiuli.mcp-server
```

Running, exit code 0.

## 7. Tool Inventory (15 tools)

| # | Tool | Description |
|---|------|-------------|
| 1 | `list_directory` | List files/dirs, respects .gitignore, max 500 |
| 2 | `read_file` | Read file contents |
| 3 | `write_file` | Write file, creates parent dirs |
| 4 | `delete_file` | Delete file or empty directory |
| 5 | `get_file_info` | File metadata (size, modified) |
| 6 | `search_files` | Search by string or regex |
| 7 | `git_status` | Branch, changes, unpushed, last commit |
| 8 | `git_commit_push` | Stage, commit, optionally push |
| 9 | `run_build` | Run `npm run build`, timeout 300s |
| 10 | `payload_command` | Whitelisted Payload commands |
| 11 | `db_query` | Read-only SQL (SELECT, EXPLAIN, \d) |
| 12 | `db_exec` | Write SQL with confirm='EXECUTE' gate |
| 13 | `vercel_env_list` | List Vercel env var names |
| 14 | `lambda_status` | Lambda deployment status + git hash sync |
| 15 | `lambda_logs` | Tail CloudWatch logs |

## 8. OAuth Status

**OAuth is ENABLED** with:
- Provider: `KiuliOAuthProvider` (SQLite-backed, single-user)
- Username: `graham`
- DB: `/tmp/kiuli-mcp-oauth.db` (WAL mode)
- Token TTLs: access=1h, refresh=60d, auth_code=5m
- RFC 6750 fix: Active (ASGI middleware)

## 9. WWW-Authenticate Headers

**No Authorization header:**
```
Bearer resource_metadata="https://grahams-macbook-air.tail2d6663.ts.net:8443/.well-known/oauth-protected-resource"
```

**With bad Bearer token:**
```
Bearer error="invalid_token", error_description="Authentication failed...", resource_metadata="https://grahams-macbook-air.tail2d6663.ts.net:8443/.well-known/oauth-protected-resource"
```

## 10. Connection URL for Claude.ai

```
https://grahams-macbook-air.tail2d6663.ts.net:8443/
```

Go to **Claude.ai → Settings → Integrations → Add MCP Server** and enter this URL.

When prompted, log in with:
- Username: `graham`
- Password: `hosana22`
