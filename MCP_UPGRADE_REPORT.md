# MCP Server Upgrade Report: FastMCP 3.0.2 → 3.1.0 + Authless Switch

**Date:** 2026-03-05
**Server:** Kiuli Files MCP Server
**URL:** `https://grahams-macbook-air.tail2d6663.ts.net:8443/`

---

## Pre-Upgrade Snapshot

| Component | Version |
|-----------|---------|
| fastmcp | 3.0.2 |
| mcp (SDK) | 1.26.0 |
| Python | 3.14.2 |
| Server PID | 86560 |
| OAuth | Enabled (broken — Claude.ai bug #11814) |
| Tools | 15 |
| Transport | streamable-http on 127.0.0.1:8420 |

---

## Post-Upgrade Snapshot

| Component | Version |
|-----------|---------|
| fastmcp | **3.1.0** |
| mcp (SDK) | 1.26.0 (unchanged) |
| Python | 3.14.2 (unchanged) |
| Server PID | 91394 |
| OAuth | **Disabled** (authless mode) |
| Tools | 15 (unchanged) |
| Transport | streamable-http on 127.0.0.1:8420 (unchanged) |

New dependency added by 3.1.0: `uncalled-for 0.2.0`

All other dependencies unchanged: Authlib 1.6.8, starlette 0.52.1, uvicorn 0.41.0, PyJWT 2.11.0, pydantic 2.12.5, sse-starlette 3.2.0.

---

## What Changed

### 1. FastMCP 3.0.2 → 3.1.0

Upgraded via `pip install --upgrade fastmcp`. One minor version bump (9 days, 62 commits, 211 files between releases). No breaking API changes.

### 2. OAuth Disabled

OAuth provider, login routes, and RFC 6750 middleware all disabled. Reason: Claude.ai's OAuth client is broken (Anthropic bug [#11814](https://github.com/anthropics/claude-code/issues/11814)). The server-side OAuth implementation works perfectly end-to-end via curl, but Claude.ai never completes the authorization code grant flow.

The `oauth_provider.py` file is preserved for future re-enablement. All OAuth code in `server.py` is commented out with references to the bug number.

### 3. Middleware Reduced

| Middleware | Before | After |
|-----------|--------|-------|
| `_NormaliseAcceptMiddleware` | Active | Active |
| `_RFC6750FixMiddleware` | Active | Disabled (OAuth off) |

---

## Monkey Patch Verification

All three patches verified present and functional in FastMCP 3.1.0:

| Patch | Target | Status | Verification |
|-------|--------|--------|-------------|
| **Patch 1**: Strip `_meta` | `fastmcp.tools.tool.Tool.get_meta` | Attribute exists, patched | tools/list response has zero `_meta` fields |
| **Patch 1b**: Strip `outputSchema` | `mcp.types.Tool.model_dump` | Attribute exists, patched | tools/list response has zero `outputSchema` fields |
| **Patch 2**: ToolListChanged nudge | `mcp.server.session.ServerSession._received_notification` | Attribute exists, patched | Server logs show notifications at 0.5s, 2.0s, 5.0s after each session |

---

## Verification Tests — All Passed

### Test 1: Server starts
Server started successfully on PID 91394, port 8420. Startup banner confirms FastMCP 3.1.0.

### Test 2: HTTP 200 on MCP initialize
```
POST http://127.0.0.1:8420/ → 200 OK
```
No 401. Authless mode confirmed.

### Test 3: Valid initialize response
```json
{
  "serverInfo": {"name": "Kiuli Files", "version": "3.1.0"},
  "protocolVersion": "2025-03-26"
}
```

### Test 4: tools/list — 15 tools, no _meta, no outputSchema
```
Tool count: 15
  - list_directory
  - read_file
  - write_file
  - delete_file
  - get_file_info
  - search_files
  - git_status
  - git_commit_push
  - run_build
  - payload_command
  - db_query
  - db_exec
  - vercel_env_list
  - lambda_status
  - lambda_logs

_meta present: False
outputSchema present: False
```

### Test 5: OAuth endpoints return 404
```
/.well-known/oauth-authorization-server → 404
/.well-known/oauth-protected-resource   → 404
/register                                → 404
/authorize                               → 404
/login                                   → 404
/token                                   → 404
```

### Test 6: Tailscale Funnel active
```
https://grahams-macbook-air.tail2d6663.ts.net:8443 (Funnel on)
|-- / proxy http://127.0.0.1:8420
```

### Test 7: Full MCP initialize via Tailscale Funnel
```
POST https://grahams-macbook-air.tail2d6663.ts.net:8443/ → 200 OK
Server: Kiuli Files v3.1.0
Protocol: 2025-03-26
Tools via Funnel: 15 (all 15 verified)
```

---

## Error Log — Clean

No errors in `/tmp/mcp-kiuli-error.log` since restart. All entries are INFO level:
- Session creation
- `ListToolsRequest` processing
- `ToolListChangedNotification` sends at 0.5s, 2.0s, 5.0s delays

---

## Tool Count Comparison

| Pre-upgrade | Post-upgrade |
|-------------|-------------|
| 15 | 15 |

Same 15 tools in both. No tools lost or gained.

---

## Risk Items Resolved

| Risk | Resolution |
|------|-----------|
| Patch 1 target changed | `fastmcp.tools.tool.Tool.get_meta` still exists in 3.1.0 |
| Patch 1b target changed | `mcp.types.Tool.model_dump` still exists in 3.1.0 |
| Patch 2 target changed | `mcp.server.session.ServerSession._received_notification` still exists in 3.1.0 |
| OAuth middleware chain changed | N/A — OAuth disabled |
| Shared venv side effects | Only new dep is `uncalled-for 0.2.0`. All critical deps unchanged. |

---

## Next Steps

1. **Connect Claude.ai** — Add `https://grahams-macbook-air.tail2d6663.ts.net:8443/` as an MCP server in Claude.ai. With OAuth disabled, connection should succeed immediately.

2. **Monitor** — Watch `/tmp/mcp-kiuli-error.log` for any issues during Claude.ai usage.

3. **Re-enable OAuth later** — When Anthropic fixes bug #11814, uncomment the OAuth sections in `server.py` and add `"none"` to `token_endpoint_auth_methods_supported`.
