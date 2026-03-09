# FastMCP 3.0.2 → 3.1.0 Upgrade Analysis

**Date:** 2026-03-05
**Context:** Kiuli MCP server fails to complete OAuth with Claude.ai. Investigating whether upgrading from FastMCP 3.0.2 to 3.1.0 would fix the issue.

---

## Critical Finding: Claude.ai Skips DCR

**Issue [jlowin/fastmcp#1919](https://github.com/jlowin/fastmcp/issues/1919)** documents that **Claude.ai does NOT follow the standard OAuth DCR flow.** Instead of:

```
POST /  → 401
GET /.well-known/oauth-protected-resource  → 200
GET /.well-known/oauth-authorization-server → 200
POST /register  → 201 (DCR)
GET /authorize  → 302
```

Claude.ai actually does:

```
POST /  → 401
GET /.well-known/oauth-protected-resource  → 200
GET /.well-known/oauth-authorization-server → 200
GET /authorize?client_id=<pre-generated-id>  → ???  ← skips /register entirely
```

Claude.ai sends `/authorize` with a **pre-generated `client_id` that was never registered** via DCR. When FastMCP (pre-2.13.0) couldn't find the unregistered client, it returned HTTP 400 `invalid_request`. Claude.ai didn't know what to do with that and gave up.

**The fix in FastMCP 2.13.0** (PRs #1923, #1930): Changed the response for unknown clients from `400 invalid_request` to `401 invalid_client`. This specific status code triggers Claude.ai's automatic client registration — Claude.ai then calls `/register` and retries `/authorize`.

**This fix is present in 3.0.2 and 3.1.0.** But it raises a question: does our custom `OAuthProvider` implementation handle this flow correctly? If Claude.ai sends `/authorize` with an unregistered `client_id`, does our provider return the right error code to trigger auto-registration?

---

## Critical Finding: Known Claude.ai/Desktop OAuth Bug

**Issue [anthropics/claude-code#11814](https://github.com/anthropics/claude-code/issues/11814):** Claude Desktop and Claude.ai Web fail to connect to OAuth-protected MCP servers. Symptoms:
- Server logs show ZERO incoming requests (or very few)
- Users see an infinite `about:blank` loop or generic connection error
- Claude Code CLI works fine with the same server

**This is a known Anthropic-side bug with no fix yet.** It matches our symptoms exactly — the server is correct, all endpoints work via curl, but Claude.ai fails to drive the flow.

---

## What Changed in 3.1.0

### Potentially Relevant to Our Issue

| Change | Why It Matters |
|--------|---------------|
| **AuthorizationError handling in list hooks** | Fixes an issue where `AuthorizationError` was not properly caught during `tools/list` operations in auth middleware. If Claude.ai's first operation after auth is `tools/list`, this could cause a silent failure. |
| **MCPConfigTransport session persistence** | Fixes session state loss between consecutive tool invocations in multi-server scenarios. |
| **Token introspection caching** | In-memory caching for token verification — reduces intermittent auth failures from timing issues. |
| **MultiAuth support** | Compose multiple token verifiers — not directly relevant but indicates auth system was reworked. |

### NOT Fixed in 3.1.0

| Issue | Status |
|-------|--------|
| **RFC 6750 violation** — `error="invalid_token"` sent when no token provided | Still present. Same `RequireAuthMiddleware` code. Our ASGI middleware patch is still needed. |
| **Claude.ai/Desktop OAuth bug** ([#11814](https://github.com/anthropics/claude-code/issues/11814)) | Anthropic-side bug. No fix from FastMCP. |
| **Optional auth not supported** ([#3291](https://github.com/PrefectHQ/fastmcp/issues/3291)) | Rejected by maintainer. |

---

## Other Relevant Issues Found

| Issue | Detail |
|-------|--------|
| [#2461](https://github.com/jlowin/fastmcp/issues/2461) | FastMCP returns 400 instead of 401 for expired tokens. Fixed via `TokenHandler` which transforms error codes. Present in both 3.0.2 and 3.1.0. |
| [#1685](https://github.com/jlowin/fastmcp/issues/1685) | `www-authenticate` header returned well-known path relative to `resource_server_url` instead of base URL, causing 404s. Fixed in 2.12.1. |
| [#2521](https://github.com/jlowin/fastmcp/issues/2521) | `listChanged` flags flipped to `true` unexpectedly in tools/list responses. |
| [#2670](https://github.com/jlowin/fastmcp/issues/2670) | OAuth proxy times out after 5 minutes requiring reconnect. |
| [#3020](https://github.com/jlowin/fastmcp/issues/3020) | OAuthProxy blocks MCP initialize with 401. |
| [#972](https://github.com/jlowin/fastmcp/issues/972) | OAuth works with MCP Inspector but not Claude. |

---

## `token_endpoint_auth_methods_supported`

Our server's `/.well-known/oauth-authorization-server` advertises:

```json
"token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"]
```

It does NOT include `"none"`. If Claude.ai acts as a **public client** (which is standard for browser-based OAuth — no client_secret), it would see this metadata and may decide it cannot authenticate at the token endpoint. This could be why it never proceeds to `/authorize` — it knows it can't complete the token exchange.

The FastMCP `OAuthProvider` base class generates this list. We need to check whether 3.1.0 changed this, or whether we need to override it.

---

## Upgrade Risk Assessment

| Risk | Level | Detail |
|------|-------|--------|
| Breaking changes | Low | 3.1.0 is a minor version bump. No breaking API changes documented. |
| Our monkey patches | Medium | Patches 1 (strip _meta), 1b (strip outputSchema), 2 (ToolListChanged nudge) touch internal APIs that may have changed. Need to verify after upgrade. |
| OAuth middleware | Medium | Our `_RFC6750FixMiddleware` patches the response — the middleware chain may have changed. |
| Shared venv | Low | Other servers (Avatarix-web, DjumaCam) use the same venv. Upgrading affects all of them. |

---

## Recommendation

1. **Upgrade to 3.1.0** — the auth list hooks fix and session persistence fix are worth it. The RFC 6750 bug persists but our ASGI middleware handles it.

2. **Add `"none"` to `token_endpoint_auth_methods_supported`** — Claude.ai is likely a public client. This requires either overriding the metadata generation in our `OAuthProvider` or patching the FastMCP base class.

3. **File/reference [anthropics/claude-code#11814](https://github.com/anthropics/claude-code/issues/11814)** — our symptoms match the known Claude.ai OAuth bug. The server-side is correct; the client-side is broken.

4. **Test the Claude.ai DCR-skip flow** — verify that when Claude.ai sends `/authorize` with an unregistered `client_id`, our server returns `401 invalid_client` (not `400 invalid_request`), which triggers Claude.ai's auto-registration.

---

## Release Details

| Version | Date | Codename | Gap |
|---------|------|----------|-----|
| 3.0.2 | 2026-02-22 | Threecovery Mode II | — |
| 3.1.0 | 2026-03-03 | Code to Joy | 9 days, 62 commits, 211 files |
