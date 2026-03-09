# MCP OAuth Connection Failure Report

**Date:** 2026-03-05
**Server:** Kiuli Files MCP Server
**URL:** `https://grahams-macbook-air.tail2d6663.ts.net:8443/`
**Claude.ai error references:** `f71abdad0f0dd8e4`, `ed60607750a7dc58`
**Claude.ai error message:** "There was an error connecting to the MCP server. Please check your server URL and make sure your server handles auth correctly."
**Server stack:** FastMCP 3.0.2, mcp SDK 1.26.0, Python 3.14.2, Tailscale Funnel

---

## Executive Summary

Claude.ai cannot complete OAuth with this MCP server. Three connection attempts across two days all fail differently, but share a common pattern: **Claude.ai never calls `/authorize` to start the authorization code grant.** The OAuth flow stalls somewhere between DCR (Dynamic Client Registration) and the authorization request. On later attempts, Claude.ai appears to use cached stale tokens, receives `401 invalid_token`, and gives up without attempting token refresh or re-authentication.

---

## 1. The Server Works Without OAuth

Before enabling OAuth, Claude.ai connected and used the server successfully in authless mode. Full MCP protocol handshake completed, all 15 tools discovered and callable:

```
POST /  → 200 OK       (initialize)
POST /  → 202 Accepted  (notifications/initialized)
POST /  → 200 OK        (tools/list — 15 tools, no _meta, no outputSchema)
POST /  → 200 OK        (tools/call — git_status)
```

The transport (streamable-http), Tailscale Funnel, middleware, and tools all work. The problem is **exclusively with the OAuth flow**.

---

## 2. Three Connection Attempts — Complete Server Logs

All requests from Claude.ai arrive at the server via Tailscale Funnel (source IP `100.97.77.125`). The access log has no timestamps, so ordering is derived from the error log timestamps and log line sequence.

### Attempt 1 — 2026-03-04 ~14:26 (First OAuth session)

Server had OAuth enabled. 401 response body contained `{"error": "invalid_token"}` (before our body fix). WWW-Authenticate header also contained `error="invalid_token"` (before our header fix).

```
GET  /.well-known/oauth-authorization-server   → 200 OK
GET  /.well-known/oauth-protected-resource     → 200 OK
POST /                                          → 401 Unauthorized
GET  /                                          → 401 Unauthorized
POST /                                          → 401 Unauthorized
GET  /.well-known/oauth-protected-resource     → 200 OK
GET  /.well-known/oauth-authorization-server   → 200 OK
POST /register                                  → 201 Created
POST /                                          → 200 OK     ← see note
```

**Error log:** 3 auth errors at 14:26:32, 14:26:34, 14:26:46.

**What happened:**
1. Claude.ai discovered OAuth metadata (correct).
2. Got 401 three times on the MCP endpoint.
3. Re-discovered metadata a second time.
4. Successfully registered via DCR (201).
5. Final `POST /` returned 200 — but **no `/authorize`, `/login`, or `/token` was ever called.** No authorization code was issued. No access token was exchanged. The 200 is likely from a brief authless period during server restarts.
6. **Result: Flow stalled after DCR. Never initiated authorization code grant.**

### Attempt 2 — 2026-03-05 ~10:17 (After clearing browser history)

Server had OAuth enabled. 401 response body still contained `{"error": "invalid_token"}` (before our body fix). WWW-Authenticate header was fixed (bare `Bearer resource_metadata="..."`).

```
POST /  → 401 Unauthorized
POST /  → 401 Unauthorized
POST /  → 401 Unauthorized
```

**Error log:** Auth errors at 10:16:59, 10:16:59, 10:17:00, then again at 10:32:58 and 10:38:15.

**What happened:**
1. No well-known discovery. No `/register`. No `/authorize`.
2. Claude.ai hit `POST /` three times with no follow-up.
3. **Result: Claude.ai appeared to use cached state. Gave up immediately.**

### Attempt 3 — 2026-03-05 ~11:16 (After RFC 6750 body fix + DB clear)

Server had OAuth enabled with the full RFC 6750 fix (both header and body). OAuth DB was freshly cleared — no stale clients or tokens. When no Authorization header is present, the 401 response now returns:
- Header: `Bearer resource_metadata="..."` (no error)
- Body: `{}` (no error)

```
POST /  → 401 Unauthorized
```

**Error log:** Single auth error at 11:16:28.

**What happened:**
1. Single `POST /` → 401. Nothing else.
2. No well-known discovery. No `/register`. No `/authorize`. No `/token`.
3. Despite the OAuth DB being completely empty, Claude.ai sent a single request and gave up.
4. **Result: Claude.ai appears to be sending a cached stale Bearer token.** Since the request has an `Authorization` header, our RFC 6750 fix correctly passes it through (the fix only applies to requests without an auth header). The response contains `error="invalid_token"` in both header and body — correct per RFC 6750 when a token IS provided but invalid. But Claude.ai does not attempt token refresh or re-authentication.

---

## 3. The Two Failure Modes

### Failure Mode A: First-time connection (no cached tokens)

**Sequence:** Discover → 401 → Discover again → Register via DCR → **STALL** (never calls `/authorize`)

**Affected attempt:** #1

**Server response at the 401 step (now fixed):**
```http
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer resource_metadata="https://grahams-macbook-air.tail2d6663.ts.net:8443/.well-known/oauth-protected-resource"
content-type: application/json

{}
```

**Expected next step from Claude.ai:** `GET /authorize?response_type=code&client_id=...&redirect_uri=...&code_challenge=...&state=...`

**What actually happens:** Nothing. Flow stops after DCR.

### Failure Mode B: Reconnection with cached stale tokens

**Sequence:** Send `POST /` with cached Bearer token → 401 → **GIVE UP**

**Affected attempts:** #2, #3

**Server response (correct per RFC 6750 — token WAS provided but is invalid):**
```http
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer error="invalid_token", error_description="Authentication failed...", resource_metadata="https://grahams-macbook-air.tail2d6663.ts.net:8443/.well-known/oauth-protected-resource"
content-type: application/json

{"error": "invalid_token", "error_description": "Authentication failed. The provided bearer token is invalid, expired, or no longer recognized by the server."}
```

**Expected next steps from Claude.ai:**
1. Attempt token refresh via `POST /token` with the cached refresh_token
2. If refresh fails, re-discover OAuth metadata
3. Re-register if needed
4. Re-start authorization code flow

**What actually happens:** Claude.ai makes no further requests. Shows error to user.

---

## 4. Evidence That Claude.ai Caches Tokens Across Sessions

- User cleared all browser history and relogged into Claude.ai between attempts #1 and #2.
- Despite this, attempt #2 sent `POST /` without first discovering OAuth metadata — implying cached OAuth state survived the browser clear.
- Between attempts #2 and #3, the server-side OAuth DB was completely deleted and recreated empty. Any previously issued client_id, access_token, or refresh_token no longer exists.
- Attempt #3 still sent just one `POST /` → 401 with no follow-up — implying Claude.ai is using a cached token that no longer exists server-side.
- **Conclusion:** Claude.ai stores MCP OAuth tokens server-side (in the user's account), not in browser storage. Clearing browser history does not clear the OAuth token cache.

---

## 5. OAuth Endpoints — All Working

Every OAuth endpoint has been manually tested and works correctly:

| Endpoint | Method | Status | Verified |
|----------|--------|--------|----------|
| `/.well-known/oauth-protected-resource` | GET | 200 | Correct `resource`, `authorization_servers`, `scopes_supported` |
| `/.well-known/oauth-authorization-server` | GET | 200 | Correct `issuer`, all endpoints, PKCE S256 |
| `/register` | POST | 201 | Creates client with `client_id`, accepts various configurations |
| `/authorize` | GET | 302 | Redirects to `/login?state=...` |
| `/login` | GET | 200 | Returns branded HTML login form |
| `/login` | POST | 302 | On valid credentials, redirects to `redirect_uri` with auth code |
| `/token` | POST | 200 | Exchanges auth code for access_token + refresh_token (PKCE validated) |
| `/revoke` | POST | 200 | Revokes tokens |

**Full OAuth flow works end-to-end via curl.** The server issues tokens, validates them, refreshes them, and grants access to MCP tools. The only thing that doesn't work is Claude.ai driving the flow.

---

## 6. Current 401 Responses (After Fix)

### When NO Authorization header is present:

```http
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer resource_metadata="https://grahams-macbook-air.tail2d6663.ts.net:8443/.well-known/oauth-protected-resource"
content-type: application/json
content-length: 2

{}
```

No `error` parameter in header. No `error` field in body. RFC 6750 compliant.

### When Authorization header IS present but token is invalid:

```http
HTTP/1.1 401 Unauthorized
www-authenticate: Bearer error="invalid_token", error_description="Authentication failed...", resource_metadata="https://grahams-macbook-air.tail2d6663.ts.net:8443/.well-known/oauth-protected-resource"
content-type: application/json
content-length: 301

{"error": "invalid_token", "error_description": "Authentication failed..."}
```

`error="invalid_token"` present in both header and body. RFC 6750 compliant.

---

## 7. OAuth Discovery Metadata

### `/.well-known/oauth-protected-resource`
```json
{
  "resource": "https://grahams-macbook-air.tail2d6663.ts.net:8443/",
  "authorization_servers": [
    "https://grahams-macbook-air.tail2d6663.ts.net:8443/"
  ],
  "scopes_supported": ["mcp"],
  "bearer_methods_supported": ["header"]
}
```

### `/.well-known/oauth-authorization-server`
```json
{
  "issuer": "https://grahams-macbook-air.tail2d6663.ts.net:8443/",
  "authorization_endpoint": "https://grahams-macbook-air.tail2d6663.ts.net:8443/authorize",
  "token_endpoint": "https://grahams-macbook-air.tail2d6663.ts.net:8443/token",
  "registration_endpoint": "https://grahams-macbook-air.tail2d6663.ts.net:8443/register",
  "scopes_supported": ["mcp"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
  "revocation_endpoint": "https://grahams-macbook-air.tail2d6663.ts.net:8443/revoke",
  "revocation_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
  "code_challenge_methods_supported": ["S256"]
}
```

---

## 8. Questions for Claude.ai Engineering

1. **Why does Claude.ai never call `/authorize` after successful DCR?** In attempt #1, Claude.ai discovered metadata, registered a client, but never started the authorization code grant. What condition must be met for Claude.ai to proceed to `/authorize`?

2. **Does Claude.ai require `token_endpoint_auth_methods_supported` to include `"none"`?** Our server advertises `["client_secret_post", "client_secret_basic"]`. If Claude.ai acts as a public client (no client_secret), it may see this metadata and decide it can't authenticate at the token endpoint, so it never proceeds. Should we add `"none"` to `token_endpoint_auth_methods_supported`?

3. **Does Claude.ai store MCP OAuth tokens server-side?** The evidence strongly suggests tokens survive browser history clearing. If so, how does a user force a clean OAuth re-authentication? Removing and re-adding the MCP server URL?

4. **When Claude.ai receives `401 error="invalid_token"` for a cached token, does it attempt token refresh?** Server logs show no `POST /token` request with a refresh_token after any 401. Claude.ai appears to give up immediately rather than trying the refresh grant.

5. **What `redirect_uri` does Claude.ai use during DCR?** The server logs the `/register` request but not the request body. Knowing the exact `redirect_uri` would help verify the authorization flow configuration.

6. **What does Claude.ai expect in the 401 response body when no token is provided?** We now return `{}`. Should we return something else? An empty body? A specific error code that signals "begin OAuth flow"?

7. **Is there a way to view Claude.ai's MCP client-side logs?** The server-side logs show what requests arrive, but not what Claude.ai decided to do (or not do) between requests. Client-side logs would reveal whether Claude.ai is silently failing at JSON parsing, metadata validation, redirect_uri construction, etc.

---

## 9. Software Versions

| Package | Version |
|---------|---------|
| fastmcp | 3.0.2 |
| mcp (SDK) | 1.26.0 |
| Authlib | 1.6.8 |
| starlette | 0.52.1 |
| uvicorn | 0.41.0 |
| PyJWT | 2.11.0 |
| python-multipart | 0.0.22 |
| pydantic | 2.12.5 |
| sse-starlette | 3.2.0 |
| Python | 3.14.2 |
| Tailscale | 1.94.1 client / 1.94.2 daemon |

---

## 10. What We've Already Tried

| Fix | Result |
|-----|--------|
| Strip `_meta` from tools/list | Works — Claude.ai discovers tools in authless mode |
| Strip `outputSchema` from tools/list | Works — Claude.ai discovers tools in authless mode |
| ToolListChanged nudge (0.5s, 2.0s, 5.0s) | Works — Claude.ai calls tools/list after nudge |
| Accept header normalization | Works — MCP SDK no longer rejects POST |
| RFC 6750 header fix (strip `error` from WWW-Authenticate when no auth header) | Implemented — header is now bare `Bearer resource_metadata="..."` |
| RFC 6750 body fix (strip `error` from JSON body when no auth header) | Implemented — body is now `{}` |
| Clear OAuth DB (remove all stale clients/tokens) | Done — DB recreated fresh |
| Verify all OAuth endpoints via curl | All work correctly |
| Full end-to-end OAuth flow via curl | Works — tokens issued, validated, refreshed |

**The server-side implementation is correct.** Every endpoint works. The full OAuth flow completes successfully when driven manually. The failure is in Claude.ai's OAuth client not driving the flow to completion.
