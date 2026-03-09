# Building an MCP Server for Claude.ai via Tailscale Funnel

**Authoritative reference — March 2026**

This documents the exact architecture required to run a FastMCP 3.x server on a
MacBook, expose it to Claude.ai via Tailscale Funnel with path-based routing, and
authenticate with OAuth 2.1. Every piece exists because something breaks without it.

**Stack:** Python 3.12+, FastMCP 3.1.0, mcp SDK, Tailscale, macOS launchd

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Why Each Piece Exists](#2-why-each-piece-exists)
3. [Prerequisites](#3-prerequisites)
4. [File Structure](#4-file-structure)
5. [oauth_provider.py — Full Reference](#5-oauth_providerpy)
6. [server.py — Full Reference](#6-serverpy)
7. [Tailscale Setup](#7-tailscale-setup)
8. [launchd Plist](#8-launchd-plist)
9. [Verification Tests](#9-verification-tests)
10. [Troubleshooting](#10-troubleshooting)
11. [Adding a New Server](#11-adding-a-new-server)

---

## 1. Architecture Overview

```
Claude.ai (160.79.x.x)
    │
    │  HTTPS port 443
    ▼
Tailscale Funnel
    │
    │  Path-based routing:
    │    /myserver → http://127.0.0.1:PORT
    │    (strips /myserver prefix!)
    ▼
FastMCP server (localhost:PORT)
    │
    │  ASGI middleware stack:
    │    1. _FixResourceMetadataMiddleware  — rewrites 401 header URLs
    │    2. _NormaliseAcceptMiddleware       — fixes Accept header
    ▼
MCP SDK auth layer
    │  OAuth 2.1: DCR → authorize → login → token
    ▼
Your tools (@mcp.tool)
```

**The critical insight:** Tailscale `--set-path /prefix` **strips the prefix** when
proxying to your server. A request to `https://host/myserver/token` arrives at your
server as `GET /token`. This means:

- You do NOT need path-stripping middleware (Tailscale already does it)
- You DO need to fix OAuth metadata URLs that the MCP SDK generates with RFC 9728
  format, because those URLs put `.well-known` BEFORE the prefix, which Tailscale
  can't route

---

## 2. Why Each Piece Exists

### Patches (module-level monkey-patches)

| Patch | What breaks without it |
|-------|----------------------|
| **Patch 1:** `_PatchTool.get_meta = lambda self: None` | FastMCP 3.x emits `_meta:{"fastmcp":{"tags":[]}}` on every tool. Claude.ai negotiates protocol `2024-11-05` which doesn't define `_meta` on Tool. Claude.ai rejects the entire `tools/list` response — zero tools shown. |
| **Patch 1b:** Strip `outputSchema` from `mcp.types.Tool.model_dump` | Return type annotations cause FastMCP to emit `outputSchema`. Claude.ai rejects tools with this field. Must target `mcp.types.Tool`, NOT `fastmcp.tools.tool.Tool`. |
| **Patch 2:** Send `ToolListChangedNotification` after `InitializedNotification` | Claude.ai doesn't call `tools/list` on its own after connecting. Without the nudge, the connection succeeds but shows zero tools. Sends at 0.5s, 2s, 5s delays. |

### Middleware

| Middleware | What breaks without it |
|-----------|----------------------|
| **`_FixResourceMetadataMiddleware`** | The MCP SDK puts `resource_metadata` in 401 `WWW-Authenticate` headers using RFC 9728 format: `https://host/.well-known/oauth-protected-resource/prefix/`. This URL doesn't start with `/prefix`, so Tailscale can't route it. The middleware rewrites it to `https://host/prefix/.well-known/oauth-protected-resource` which Tailscale CAN route. |
| **`_NormaliseAcceptMiddleware`** | The MCP SDK rejects POST requests without both `application/json` and `text/event-stream` in the Accept header. Some clients don't send both. This middleware normalizes the Accept header. |

### Custom Routes

| Route | What breaks without it |
|-------|----------------------|
| **`/.well-known/oauth-protected-resource`** | After `_FixResourceMetadataMiddleware` rewrites the URL, Claude.ai requests `/prefix/.well-known/oauth-protected-resource`. Tailscale strips `/prefix`, so the server receives `/.well-known/oauth-protected-resource`. The MCP SDK registered its route at `/.well-known/oauth-protected-resource/prefix/` (which never gets hit). This custom route serves the Protected Resource Metadata at the path that actually arrives. |
| **`/.well-known/openid-configuration`** | After PRM discovery, Claude.ai extracts `authorization_servers` and tries 3 URLs for OAuth AS metadata. URLs #1 and #2 use RFC 8414 format (`https://host/.well-known/oauth-authorization-server/prefix`) which Tailscale can't route. URL #3 uses OIDC path-appended format (`https://host/prefix/.well-known/openid-configuration`) which Tailscale routes → strips prefix → arrives as `/.well-known/openid-configuration`. This route serves the AS metadata there. |
| **`/login` (GET + POST)** | The MCP SDK's `/authorize` endpoint redirects to a login URL. The SDK doesn't provide a login form — you must implement it. The form POSTs credentials, validates them, creates an auth code, and redirects back to the client's `redirect_uri`. |

### OAuth Provider

The `OAuthProvider` base class from FastMCP handles all the standard OAuth 2.1
endpoints automatically:
- `/.well-known/oauth-authorization-server` — AS metadata discovery
- `/authorize` — authorization endpoint (calls your `authorize()` method)
- `/token` — token endpoint (handles PKCE, calls your `exchange_*` methods)
- `/register` — Dynamic Client Registration
- `/revoke` — token revocation
- Bearer token middleware (calls your `load_access_token()`)

You implement 9 abstract methods + 2 login handlers. Token state goes in SQLite.

---

## 3. Prerequisites

```bash
# Python venv with FastMCP
python3 -m venv ~/.config/mcp/venv
~/.config/mcp/venv/bin/pip install "fastmcp>=3.1.0"

# Tailscale (must be logged in, Funnel enabled on your tailnet)
brew install tailscale
# Or: download from https://tailscale.com/download/mac

# Verify Funnel is available
tailscale funnel status
```

Your Tailscale hostname (e.g. `grahams-macbook-air.tail2d6663.ts.net`) must have
Funnel enabled in the tailnet admin console.

---

## 4. File Structure

For each server, you need exactly 2 files:

```
tools/mcp-server/
├── server.py           # MCP server with patches, middleware, routes, tools
└── oauth_provider.py   # OAuth 2.1 provider (SQLite-backed)
```

Plus a launchd plist at `~/Library/LaunchAgents/com.yourproject.mcp-server.plist`.

---

## 5. oauth_provider.py

This is the complete OAuth provider. Copy it, change the class name and branding.

The base class `OAuthProvider` handles all standard endpoints. You implement:
- Storage (SQLite): `register_client`, `get_client`, `load_authorization_code`,
  `load_access_token`, `load_refresh_token`, `revoke_token`
- Token exchange: `exchange_authorization_code`, `exchange_refresh_token`
- Authorization: `authorize` (creates pending auth, returns login URL)
- Login handlers: `handle_login_get` (renders form), `handle_login_post` (validates)

```python
"""
MCP Server — Self-contained OAuth 2.1 provider.

Single-user, no external identity provider.
Token state persisted in SQLite — survives restarts.

Base class (FastMCP OAuthProvider) handles automatically:
  - /.well-known/oauth-authorization-server discovery endpoint
  - /authorize endpoint (calls our authorize() method, redirects to login)
  - /token endpoint (handles PKCE validation, calls our exchange methods)
  - /register endpoint (calls our register_client() method)
  - /revoke endpoint (calls our revoke_token() method)
  - BearerAuthBackend middleware (calls our load_access_token() via verify_token())

We implement: storage (SQLite), login form (HTML), and the 9 abstract methods.
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import sqlite3
import time
from contextlib import contextmanager
from secrets import token_hex, token_urlsafe
from urllib.parse import urlencode

from fastmcp.server.auth.auth import (
    AccessToken,
    ClientRegistrationOptions,
    OAuthProvider,
    RevocationOptions,
)
from mcp.server.auth.provider import (
    AuthorizationCode,
    AuthorizationParams,
    RefreshToken,
    construct_redirect_uri,
)
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from pydantic import AnyHttpUrl
from starlette.requests import Request
from starlette.responses import HTMLResponse, RedirectResponse, Response


# ---------------------------------------------------------------------------
# Configuration — read from environment (set in launchd plist)
# ---------------------------------------------------------------------------

SERVER_URL: str = os.environ.get(
    "MCP_SERVER_URL", "https://your-host.ts.net/your-prefix"
)
MCP_USERNAME: str = os.environ.get("MCP_USERNAME", "admin")
MCP_PASSWORD_RAW: str = os.environ.get("MCP_PASSWORD", "")
DB_PATH: str = os.environ.get("OAUTH_DB_PATH", "/tmp/mcp-oauth.db")

# Token lifetimes
ACCESS_TOKEN_TTL: int = 3600         # 1 hour
REFRESH_TOKEN_TTL: int = 60 * 86400  # 60 days
AUTH_CODE_TTL: int = 300              # 5 minutes
PENDING_AUTH_TTL: int = 600           # 10 minutes

MCP_SCOPE = "mcp"


# ---------------------------------------------------------------------------
# SQLite storage
# ---------------------------------------------------------------------------

_SCHEMA = """
CREATE TABLE IF NOT EXISTS clients (
    client_id   TEXT PRIMARY KEY,
    data        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_codes (
    code        TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    expires_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS access_tokens (
    token       TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    expires_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token       TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    expires_at  REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_auth (
    state       TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    expires_at  REAL NOT NULL
);
"""


def _connect(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(_SCHEMA)
    conn.commit()
    return conn


@contextmanager
def _tx(conn: sqlite3.Connection):
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


# ---------------------------------------------------------------------------
# OAuth provider implementation
# ---------------------------------------------------------------------------

class MyOAuthProvider(OAuthProvider):
    """Change 'MyOAuthProvider' to match your project."""

    def __init__(self, password: str, db_path: str, server_url: str) -> None:
        super().__init__(
            base_url=server_url,
            client_registration_options=ClientRegistrationOptions(
                enabled=True,
                valid_scopes=[MCP_SCOPE],
                default_scopes=[MCP_SCOPE],
            ),
            revocation_options=RevocationOptions(enabled=True),
            required_scopes=[MCP_SCOPE],
        )
        self._password_hash = hashlib.sha256(password.encode()).hexdigest()
        self._db = _connect(db_path)

    def _check_password(self, password: str) -> bool:
        return hashlib.sha256(password.encode()).hexdigest() == self._password_hash

    def _expire_rows(self) -> None:
        now = time.time()
        with _tx(self._db) as db:
            db.execute("DELETE FROM auth_codes WHERE expires_at < ?", (now,))
            db.execute("DELETE FROM access_tokens WHERE expires_at < ?", (now,))
            db.execute("DELETE FROM refresh_tokens WHERE expires_at < ?", (now,))
            db.execute("DELETE FROM pending_auth WHERE expires_at < ?", (now,))

    # --- Client registration ---

    async def register_client(
        self, client_info: OAuthClientInformationFull
    ) -> None:
        with _tx(self._db) as db:
            db.execute(
                "INSERT OR REPLACE INTO clients (client_id, data) VALUES (?, ?)",
                (client_info.client_id, client_info.model_dump_json()),
            )

    async def get_client(
        self, client_id: str
    ) -> OAuthClientInformationFull | None:
        row = self._db.execute(
            "SELECT data FROM clients WHERE client_id = ?", (client_id,)
        ).fetchone()
        if row is None:
            return None
        return OAuthClientInformationFull.model_validate_json(row["data"])

    # --- Authorization ---

    async def authorize(
        self,
        client: OAuthClientInformationFull,
        params: AuthorizationParams,
    ) -> str:
        self._expire_rows()
        state = params.state or token_urlsafe(32)

        pending = {
            "client_id": client.client_id,
            "redirect_uri": str(params.redirect_uri),
            "redirect_uri_provided_explicitly": params.redirect_uri_provided_explicitly,
            "code_challenge": params.code_challenge,
            "scopes": list(params.scopes) if params.scopes else [MCP_SCOPE],
            "state": state,
        }

        with _tx(self._db) as db:
            db.execute(
                "INSERT OR REPLACE INTO pending_auth (state, data, expires_at) VALUES (?, ?, ?)",
                (state, json.dumps(pending), int(time.time()) + PENDING_AUTH_TTL),
            )

        login_url = f"{str(SERVER_URL).rstrip('/')}/login?{urlencode({'state': state})}"
        return login_url

    async def load_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: str,
    ) -> AuthorizationCode | None:
        row = self._db.execute(
            "SELECT data, expires_at FROM auth_codes WHERE code = ?",
            (authorization_code,),
        ).fetchone()
        if row is None:
            return None
        if row["expires_at"] < time.time():
            self._db.execute(
                "DELETE FROM auth_codes WHERE code = ?", (authorization_code,)
            )
            self._db.commit()
            return None
        obj = json.loads(row["data"])
        if obj["client_id"] != client.client_id:
            return None
        return AuthorizationCode(
            code=obj["code"],
            client_id=obj["client_id"],
            redirect_uri=AnyHttpUrl(obj["redirect_uri"]),
            redirect_uri_provided_explicitly=obj["redirect_uri_provided_explicitly"],
            expires_at=int(row["expires_at"]),
            scopes=obj["scopes"],
            code_challenge=obj.get("code_challenge"),
        )

    # --- Token exchange ---

    async def exchange_authorization_code(
        self,
        client: OAuthClientInformationFull,
        authorization_code: AuthorizationCode,
    ) -> OAuthToken:
        with _tx(self._db) as db:
            db.execute(
                "DELETE FROM auth_codes WHERE code = ?", (authorization_code.code,)
            )

        access_token = f"at_{token_hex(32)}"
        refresh_token = f"rt_{token_hex(32)}"
        now = time.time()

        at_data = {
            "token": access_token,
            "client_id": client.client_id,
            "scopes": authorization_code.scopes,
        }
        rt_data = {
            "token": refresh_token,
            "client_id": client.client_id,
            "scopes": authorization_code.scopes,
        }

        with _tx(self._db) as db:
            db.execute(
                "INSERT INTO access_tokens (token, data, expires_at) VALUES (?, ?, ?)",
                (access_token, json.dumps(at_data), now + ACCESS_TOKEN_TTL),
            )
            db.execute(
                "INSERT INTO refresh_tokens (token, data, expires_at) VALUES (?, ?, ?)",
                (refresh_token, json.dumps(rt_data), now + REFRESH_TOKEN_TTL),
            )

        return OAuthToken(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_TTL,
            refresh_token=refresh_token,
            scope=" ".join(authorization_code.scopes),
        )

    async def load_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: str,
    ) -> RefreshToken | None:
        row = self._db.execute(
            "SELECT data, expires_at FROM refresh_tokens WHERE token = ?",
            (refresh_token,),
        ).fetchone()
        if row is None:
            return None
        if row["expires_at"] < time.time():
            self._db.execute(
                "DELETE FROM refresh_tokens WHERE token = ?", (refresh_token,)
            )
            self._db.commit()
            return None
        obj = json.loads(row["data"])
        if obj["client_id"] != client.client_id:
            return None
        return RefreshToken(
            token=obj["token"],
            client_id=obj["client_id"],
            scopes=obj["scopes"],
            expires_at=int(row["expires_at"]),
        )

    async def exchange_refresh_token(
        self,
        client: OAuthClientInformationFull,
        refresh_token: RefreshToken,
        scopes: list[str],
    ) -> OAuthToken:
        with _tx(self._db) as db:
            db.execute(
                "DELETE FROM refresh_tokens WHERE token = ?", (refresh_token.token,)
            )

        effective_scopes = scopes if scopes else refresh_token.scopes

        new_access = f"at_{token_hex(32)}"
        new_refresh = f"rt_{token_hex(32)}"
        now = time.time()

        at_data = {
            "token": new_access,
            "client_id": client.client_id,
            "scopes": effective_scopes,
        }
        rt_data = {
            "token": new_refresh,
            "client_id": client.client_id,
            "scopes": effective_scopes,
        }

        with _tx(self._db) as db:
            db.execute(
                "INSERT INTO access_tokens (token, data, expires_at) VALUES (?, ?, ?)",
                (new_access, json.dumps(at_data), now + ACCESS_TOKEN_TTL),
            )
            db.execute(
                "INSERT INTO refresh_tokens (token, data, expires_at) VALUES (?, ?, ?)",
                (new_refresh, json.dumps(rt_data), now + REFRESH_TOKEN_TTL),
            )

        return OAuthToken(
            access_token=new_access,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_TTL,
            refresh_token=new_refresh,
            scope=" ".join(effective_scopes),
        )

    async def load_access_token(self, token: str) -> AccessToken | None:
        row = self._db.execute(
            "SELECT data, expires_at FROM access_tokens WHERE token = ?",
            (token,),
        ).fetchone()
        if row is None:
            return None
        if row["expires_at"] < time.time():
            self._db.execute(
                "DELETE FROM access_tokens WHERE token = ?", (token,)
            )
            self._db.commit()
            return None
        obj = json.loads(row["data"])
        return AccessToken(
            token=obj["token"],
            client_id=obj["client_id"],
            scopes=obj["scopes"],
            expires_at=int(row["expires_at"]),
        )

    async def revoke_token(
        self, token: AccessToken | RefreshToken
    ) -> None:
        with _tx(self._db) as db:
            db.execute(
                "DELETE FROM access_tokens WHERE token = ?", (token.token,)
            )
            db.execute(
                "DELETE FROM refresh_tokens WHERE token = ?", (token.token,)
            )

    # --- Login form handlers ---

    async def handle_login_get(self, state: str) -> Response:
        if not state:
            return HTMLResponse(
                "<h2>Error</h2><p>Missing state parameter.</p>",
                status_code=400,
            )
        row = self._db.execute(
            "SELECT expires_at FROM pending_auth WHERE state = ?", (state,)
        ).fetchone()
        if row is None or row["expires_at"] < time.time():
            return HTMLResponse(
                "<h2>Error</h2><p>Authorization request expired or not found. "
                "Return to Claude and try again.</p>",
                status_code=400,
            )
        safe_state = html.escape(state)
        server_url_escaped = html.escape(str(SERVER_URL).rstrip("/"))
        body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCP Server — Login</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto;
           padding: 0 1rem; background: #fafafa; color: #333; }}
    h1 {{ font-size: 1.4rem; margin-bottom: 1.5rem; }}
    label {{ display: block; margin-bottom: 0.25rem; font-size: 0.9rem; color: #666; }}
    input {{ width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #ccc;
             border-radius: 4px; font-size: 1rem; box-sizing: border-box; }}
    button {{ width: 100%; padding: 0.6rem; background: #333; color: #fff;
              border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }}
    button:hover {{ background: #555; }}
  </style>
</head>
<body>
  <h1>MCP Server — Login</h1>
  <form method="POST" action="{server_url_escaped}/login">
    <input type="hidden" name="state" value="{safe_state}">
    <label for="username">Username</label>
    <input type="text" id="username" name="username" autocomplete="username" required>
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autocomplete="current-password" required>
    <button type="submit">Authorise</button>
  </form>
</body>
</html>"""
        return HTMLResponse(body)

    async def handle_login_post(
        self, username: str, password: str, state: str
    ) -> Response:
        row = self._db.execute(
            "SELECT data, expires_at FROM pending_auth WHERE state = ?", (state,)
        ).fetchone()
        if row is None or row["expires_at"] < time.time():
            return HTMLResponse(
                "<h2>Error</h2><p>Authorization request expired. "
                "Return to Claude and try again.</p>",
                status_code=400,
            )

        if username != MCP_USERNAME or not self._check_password(password):
            safe_state = html.escape(state)
            server_url_escaped = html.escape(str(SERVER_URL).rstrip("/"))
            body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MCP Server — Login</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto;
           padding: 0 1rem; background: #fafafa; color: #333; }}
    h1 {{ font-size: 1.4rem; margin-bottom: 1.5rem; }}
    label {{ display: block; margin-bottom: 0.25rem; font-size: 0.9rem; color: #666; }}
    input {{ width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #ccc;
             border-radius: 4px; font-size: 1rem; box-sizing: border-box; }}
    button {{ width: 100%; padding: 0.6rem; background: #333; color: #fff;
              border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }}
    .error {{ color: #c00; margin-bottom: 1rem; font-size: 0.9rem; }}
  </style>
</head>
<body>
  <h1>MCP Server — Login</h1>
  <p class="error">Invalid username or password.</p>
  <form method="POST" action="{server_url_escaped}/login">
    <input type="hidden" name="state" value="{safe_state}">
    <label for="username">Username</label>
    <input type="text" id="username" name="username" autocomplete="username" required>
    <label for="password">Password</label>
    <input type="password" id="password" name="password" autocomplete="current-password" required>
    <button type="submit">Authorise</button>
  </form>
</body>
</html>"""
            return HTMLResponse(body, status_code=401)

        pending = json.loads(row["data"])

        code = f"ac_{token_hex(16)}"
        code_data = {
            "code": code,
            "client_id": pending["client_id"],
            "redirect_uri": pending["redirect_uri"],
            "redirect_uri_provided_explicitly": pending["redirect_uri_provided_explicitly"],
            "scopes": pending["scopes"],
            "code_challenge": pending.get("code_challenge"),
        }

        with _tx(self._db) as db:
            db.execute(
                "INSERT INTO auth_codes (code, data, expires_at) VALUES (?, ?, ?)",
                (code, json.dumps(code_data), int(time.time()) + AUTH_CODE_TTL),
            )
            db.execute(
                "DELETE FROM pending_auth WHERE state = ?", (state,)
            )

        redirect = construct_redirect_uri(
            pending["redirect_uri"], code=code, state=state
        )
        return RedirectResponse(url=redirect, status_code=302)
```

---

## 6. server.py

Complete server template. Replace `PREFIX`, `PORT`, `SERVER_NAME`,
`MyOAuthProvider`, and add your own tools.

```python
#!/usr/bin/env python3
"""
MCP Server — filesystem and git tools.

Serves a project directory to Claude.ai via Tailscale Funnel.
"""

import logging
import os
import re
import subprocess
import sys
import fnmatch
from pathlib import Path

from fastmcp import FastMCP

# ---------------------------------------------------------------------------
# PATCH 1: Strip _meta from tool serialization
# FastMCP 3.x emits _meta:{"fastmcp":{"tags":[]}} on every tool.
# Claude.ai negotiates protocol 2024-11-05 which doesn't define _meta on Tool,
# causing Claude.ai to reject the entire tools/list response (zero tools shown).
# ---------------------------------------------------------------------------
from fastmcp.tools.tool import Tool as _PatchTool
_PatchTool.get_meta = lambda self: None

# ---------------------------------------------------------------------------
# PATCH 1b: Strip outputSchema from tool serialization
# Return type annotations cause FastMCP to emit outputSchema, which
# Claude.ai rejects. MUST target mcp.types.Tool, NOT fastmcp's Tool.
# ---------------------------------------------------------------------------
import mcp.types as _mcp_types
_orig_tool_dump = _mcp_types.Tool.model_dump
def _tool_dump_no_output_schema(self, **kwargs):
    result = _orig_tool_dump(self, **kwargs)
    result.pop("outputSchema", None)
    return result
_mcp_types.Tool.model_dump = _tool_dump_no_output_schema

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

logging.basicConfig(
    stream=sys.stderr,
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("my-mcp")

PROJECT_ROOT = Path(os.environ["PROJECT_ROOT"]).resolve()
SERVER_NAME = os.environ.get("SERVER_NAME", "My Files")
PORT = int(os.environ.get("PORT", "8420"))

# ---------------------------------------------------------------------------
# OAuth — import provider if MCP_PASSWORD is set, else run authless
# ---------------------------------------------------------------------------
from starlette.requests import Request
from starlette.responses import Response

_oauth_provider = None
_MCP_PASSWORD = os.environ.get("MCP_PASSWORD", "")

if _MCP_PASSWORD:
    from oauth_provider import MyOAuthProvider
    _server_url = os.environ.get(
        "MCP_SERVER_URL", "https://your-host.ts.net/your-prefix"
    )
    _db_path = os.environ.get(
        "OAUTH_DB_PATH", str(Path.home() / ".config/mcp/my-oauth.db")
    )
    _oauth_provider = MyOAuthProvider(
        password=_MCP_PASSWORD,
        db_path=_db_path,
        server_url=_server_url,
    )
    log.info("OAuth enabled")
else:
    log.info("OAuth disabled (MCP_PASSWORD not set)")

# ---------------------------------------------------------------------------
# FastMCP instance — with or without OAuth
# ---------------------------------------------------------------------------
mcp = FastMCP(SERVER_NAME, auth=_oauth_provider) if _oauth_provider else FastMCP(SERVER_NAME)

# ---------------------------------------------------------------------------
# PATCH 2: ToolListChanged nudge after initialization
# Claude.ai doesn't call tools/list on its own after connecting.
# Sending ToolListChangedNotification after InitializedNotification prompts
# it to discover tools.
# ---------------------------------------------------------------------------
import asyncio as _asyncio
from mcp.server.session import ServerSession as _ServerSession

_orig_received_notification = _ServerSession._received_notification

async def _patched_received_notification(self, notification):
    await _orig_received_notification(self, notification)
    if isinstance(notification.root, _mcp_types.InitializedNotification):
        async def _send_delayed():
            for delay in [0.5, 2.0, 5.0]:
                try:
                    await _asyncio.sleep(delay)
                    await self.send_tool_list_changed()
                    log.info(f"Sent ToolListChangedNotification after {delay}s")
                except Exception as e:
                    log.warning(f"Failed to send ToolListChanged after {delay}s: {e}")
        _asyncio.create_task(_send_delayed())

_ServerSession._received_notification = _patched_received_notification


# ---------------------------------------------------------------------------
# Custom routes (only registered when OAuth is active)
# ---------------------------------------------------------------------------
if _oauth_provider:
    @mcp.custom_route("/login", methods=["GET"])
    async def login_get(request: Request) -> Response:
        state = request.query_params.get("state", "")
        return await _oauth_provider.handle_login_get(state)

    @mcp.custom_route("/login", methods=["POST"])
    async def login_post(request: Request) -> Response:
        form = await request.form()
        username = str(form.get("username", ""))
        password = str(form.get("password", ""))
        state = str(form.get("state", ""))
        return await _oauth_provider.handle_login_post(username, password, state)

    @mcp.custom_route("/.well-known/oauth-protected-resource", methods=["GET"])
    async def protected_resource_metadata(request: Request) -> Response:
        """Serve Protected Resource Metadata at the path Tailscale can route.

        The MCP SDK registers this at /.well-known/oauth-protected-resource/PREFIX/
        (RFC 9728), but Tailscale strips /PREFIX so the request arrives here.
        """
        from starlette.responses import JSONResponse
        return JSONResponse({
            "resource": f"{_server_url}/",
            "authorization_servers": [_server_url],
            "scopes_supported": ["mcp"],
            "bearer_methods_supported": ["header"],
        })

    @mcp.custom_route("/.well-known/openid-configuration", methods=["GET", "OPTIONS"])
    async def oidc_discovery_metadata(request: Request) -> Response:
        """Serve OAuth AS metadata at the OIDC discovery path.

        The MCP SDK client tries 3 URLs for AS metadata discovery:
          1. https://host/.well-known/oauth-authorization-server/PREFIX  — can't route
          2. https://host/.well-known/openid-configuration/PREFIX        — can't route
          3. https://host/PREFIX/.well-known/openid-configuration        — THIS ONE WORKS
        Tailscale strips /PREFIX, server receives /.well-known/openid-configuration.
        """
        from starlette.responses import JSONResponse
        if request.method == "OPTIONS":
            return JSONResponse(
                content="",
                status_code=204,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                },
            )
        base = _server_url.rstrip("/")
        return JSONResponse({
            "issuer": f"{base}/",
            "authorization_endpoint": f"{base}/authorize",
            "token_endpoint": f"{base}/token",
            "registration_endpoint": f"{base}/register",
            "scopes_supported": ["mcp"],
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "token_endpoint_auth_methods_supported": [
                "client_secret_post", "client_secret_basic"
            ],
            "revocation_endpoint": f"{base}/revoke",
            "revocation_endpoint_auth_methods_supported": [
                "client_secret_post", "client_secret_basic"
            ],
            "code_challenge_methods_supported": ["S256"],
        })


# ---------------------------------------------------------------------------
# Middleware — ASGI (NOT BaseHTTPMiddleware)
# ---------------------------------------------------------------------------
class _FixResourceMetadataMiddleware:
    """Rewrite resource_metadata URL in 401 WWW-Authenticate headers.

    The MCP SDK builds RFC 9728 URLs as:
      https://host/.well-known/oauth-protected-resource/PREFIX/
    Tailscale can't route this (doesn't start with /PREFIX).
    Rewrite to:
      https://host/PREFIX/.well-known/oauth-protected-resource
    which Tailscale routes via /PREFIX → strips prefix → server handles.
    """
    def __init__(self, app, prefix):
        self.app = app
        self.prefix = prefix.rstrip("/")
        self._find = f"/.well-known/oauth-protected-resource{self.prefix}".encode()
        self._replace = f"{self.prefix}/.well-known/oauth-protected-resource".encode()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        async def rewrite_send(message):
            if message["type"] == "http.response.start":
                headers = []
                for name, value in message.get("headers", []):
                    if name == b"www-authenticate" and self._find in value:
                        value = value.replace(self._find + b"/", self._replace)
                        value = value.replace(self._find, self._replace)
                    headers.append((name, value))
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, rewrite_send)


class _NormaliseAcceptMiddleware:
    """Ensure Accept header includes both application/json and text/event-stream.

    The MCP SDK rejects POST requests without both content types in Accept.
    """
    def __init__(self, app):
        self.app = app
    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            accept = headers.get(b"accept", b"").decode()
            if "application/json" not in accept or "text/event-stream" not in accept:
                new_headers = [(k, v) for k, v in scope["headers"] if k != b"accept"]
                new_headers.append((b"accept", b"application/json, text/event-stream"))
                scope = dict(scope, headers=new_headers)
        await self.app(scope, receive, send)


# ---------------------------------------------------------------------------
# Your tools go here
# ---------------------------------------------------------------------------

@mcp.tool()
def hello(name: str = "world"):
    """Say hello."""
    return f"Hello, {name}!"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from starlette.middleware import Middleware

    # IMPORTANT: prefix must match your Tailscale --set-path value
    PREFIX = "/your-prefix"

    log.info(f"MCP server starting on 127.0.0.1:{PORT}")
    mcp.run(
        transport="streamable-http",
        host="127.0.0.1",
        port=PORT,
        path="/",
        json_response=True,
        middleware=[
            Middleware(_FixResourceMetadataMiddleware, prefix=PREFIX),
            Middleware(_NormaliseAcceptMiddleware),
        ],
    )
```

---

## 7. Tailscale Setup

### Add a server to port 443 with path-based routing

```bash
# Each server gets a path on port 443
tailscale serve --https=443 --set-path /myserver --bg http://127.0.0.1:PORT

# Enable Funnel (exposes to the internet — required for Claude.ai)
tailscale funnel --https=443 --set-path /myserver --bg http://127.0.0.1:PORT
```

### Multiple servers share port 443

```bash
tailscale serve --https=443 --set-path /kiuli --bg http://127.0.0.1:8420
tailscale serve --https=443 --set-path /avatarix-web --bg http://127.0.0.1:8421
tailscale serve --https=443 --set-path /avatarix --bg http://127.0.0.1:8417

# Funnel only needs to be enabled once (covers all paths)
tailscale funnel --https=443 --set-path /kiuli --bg http://127.0.0.1:8420
```

### Verify

```bash
tailscale serve status
# Should show:
#   https://your-host.ts.net (Funnel on)
#   |-- /kiuli        proxy http://127.0.0.1:8420
#   |-- /avatarix-web proxy http://127.0.0.1:8421
#   |-- /avatarix     proxy http://127.0.0.1:8417
```

### Critical: Tailscale strips the path prefix

When you `--set-path /kiuli`, Tailscale removes `/kiuli` from the request path
before proxying. This is automatic and cannot be disabled.

| Client requests | Server receives |
|----------------|----------------|
| `/kiuli/` | `/` |
| `/kiuli/token` | `/token` |
| `/kiuli/.well-known/openid-configuration` | `/.well-known/openid-configuration` |

---

## 8. launchd Plist

Save as `~/Library/LaunchAgents/com.yourproject.mcp-server.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.yourproject.mcp-server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Users/YOU/.config/mcp/venv/bin/python3</string>
        <string>/Users/YOU/Projects/yourproject/tools/mcp-server/server.py</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PROJECT_ROOT</key>
        <string>/Users/YOU/Projects/yourproject</string>
        <key>SERVER_NAME</key>
        <string>My Project Files</string>
        <key>PORT</key>
        <string>8420</string>
        <key>MCP_USERNAME</key>
        <string>admin</string>
        <key>MCP_PASSWORD</key>
        <string>YOUR_PASSWORD_HERE</string>
        <key>MCP_SERVER_URL</key>
        <string>https://your-host.ts.net/your-prefix</string>
        <key>OAUTH_DB_PATH</key>
        <string>/Users/YOU/.config/mcp/yourproject-oauth.db</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/mcp-yourproject.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/mcp-yourproject-error.log</string>
</dict>
</plist>
```

### Managing the service

```bash
# Load (start)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.yourproject.mcp-server.plist

# Unload (stop)
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.yourproject.mcp-server.plist

# Restart
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.yourproject.mcp-server.plist 2>/dev/null
sleep 1
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.yourproject.mcp-server.plist

# Check if running
lsof -iTCP:8420 -sTCP:LISTEN

# View logs
tail -f /tmp/mcp-yourproject-error.log
tail -f /tmp/mcp-yourproject.log
```

### Before restarting: always clear the OAuth DB

```bash
rm -f /Users/YOU/.config/mcp/yourproject-oauth.db
```

Claude.ai caches client registrations. Stale DB entries cause `invalid_token` loops.

---

## 9. Verification Tests

Run ALL of these before connecting from Claude.ai. Every test must pass.

```bash
TS="https://your-host.ts.net"
PREFIX="/your-prefix"
PORT=8420

echo "=== 1. Local: server responds with 401 ==="
curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/"
# Expect: 401

echo ""
echo "=== 2. Local: PRM endpoint ==="
curl -s "http://127.0.0.1:$PORT/.well-known/oauth-protected-resource"
# Expect: JSON with resource, authorization_servers

echo ""
echo "=== 3. Local: OIDC discovery ==="
curl -s "http://127.0.0.1:$PORT/.well-known/openid-configuration"
# Expect: JSON with issuer, authorization_endpoint, token_endpoint, registration_endpoint
# All URLs MUST include the prefix

echo ""
echo "=== 4. Local: OAuth AS metadata (SDK's built-in route) ==="
curl -s "http://127.0.0.1:$PORT/.well-known/oauth-authorization-server"
# Expect: JSON (same shape as #3, this is the SDK's own route)

echo ""
echo "=== 5. Tailscale: 401 with rewritten resource_metadata ==="
curl -s -D- -X POST "$TS$PREFIX/" -H "Content-Type: application/json" -d '{}' 2>/dev/null | grep www-authenticate
# Expect: resource_metadata="https://host/PREFIX/.well-known/oauth-protected-resource"
# NOT: resource_metadata="https://host/.well-known/oauth-protected-resource/PREFIX/"

echo ""
echo "=== 6. Tailscale: PRM via rewritten URL ==="
curl -s "$TS$PREFIX/.well-known/oauth-protected-resource"
# Expect: JSON with resource, authorization_servers containing PREFIX

echo ""
echo "=== 7. Tailscale: OIDC discovery (the critical path) ==="
curl -s "$TS$PREFIX/.well-known/openid-configuration"
# Expect: JSON with all endpoints containing PREFIX

echo ""
echo "=== 8. Tailscale: DCR ==="
curl -s -X POST "$TS$PREFIX/register" \
  -H 'Content-Type: application/json' \
  -d '{"redirect_uris":["https://claude.ai/api/mcp/auth_callback"],"grant_types":["authorization_code","refresh_token"],"response_types":["code"],"client_name":"test"}'
# Expect: JSON with client_id, client_secret

echo ""
echo "=== 9. Tailscale: Login page ==="
CLIENT_ID=$(curl -s -X POST "$TS$PREFIX/register" \
  -H 'Content-Type: application/json' \
  -d '{"redirect_uris":["https://claude.ai/api/mcp/auth_callback"],"grant_types":["authorization_code","refresh_token"],"response_types":["code"],"client_name":"test2"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['client_id'])")
curl -s -D- "$TS$PREFIX/authorize?response_type=code&client_id=$CLIENT_ID&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&code_challenge=test&code_challenge_method=S256&scope=mcp&state=test123" 2>/dev/null | head -5
# Expect: HTTP 302, Location header pointing to /PREFIX/login?state=test123
```

---

## 10. Troubleshooting

### "There was an error connecting to the MCP server"

**Step 1:** Check the access log (`/tmp/mcp-yourproject.log`):

- If you see `401 Unauthorized` repeating with no discovery requests → Claude.ai
  can't reach the PRM or OIDC endpoints. Check `_FixResourceMetadataMiddleware`
  prefix matches your Tailscale `--set-path`.

- If you see `GET /.well-known/oauth-protected-resource → 200` followed by
  `GET /.well-known/openid-configuration → 404` → the OIDC custom route isn't
  registered. Check it's inside the `if _oauth_provider:` block.

- If you see successful discovery + DCR + authorize but no token exchange →
  the login form's `action` URL is wrong. Check `SERVER_URL` in the OAuth provider.

**Step 2:** Check the error log (`/tmp/mcp-yourproject-error.log`):

- `Auth error returned: invalid_token` → expected for unauthenticated requests.
  Normal during discovery.

- Python tracebacks → fix the bug.

### Zero tools shown after connecting

- Patch 1 is missing (tools/list rejected due to `_meta`)
- Patch 1b is missing (tools/list rejected due to `outputSchema`)
- Patch 2 is missing (Claude.ai never calls tools/list)

### "invalid_token" loop after restart

OAuth DB has stale tokens. Fix:
```bash
rm -f /path/to/oauth.db
# Restart server
# Delete and re-add in Claude.ai
```

### Login form not loading

- Check `SERVER_URL` in the plist matches the Tailscale URL including prefix
- Check the form `action` attribute includes the full URL with prefix
- The login form must POST to `https://host/prefix/login`, not `/login`

---

## 11. Adding a New Server

Checklist for adding a new MCP server to your MacBook:

1. **Choose a port** (e.g., 8422) and a path prefix (e.g., `/myproject`)
2. **Copy** `server.py` and `oauth_provider.py` from an existing server
3. **Update** in `server.py`:
   - Logger name
   - Default PORT
   - Import: `from oauth_provider import MyProjectOAuthProvider`
   - Default `_server_url`
   - PREFIX in the entry point's `Middleware(_FixResourceMetadataMiddleware, prefix="/myproject")`
   - Custom route docstrings (optional)
   - Your tools
4. **Update** in `oauth_provider.py`:
   - Class name
   - Default `SERVER_URL`
   - Default `DB_PATH`
   - Login form title/branding
5. **Create** the launchd plist with correct paths and env vars
6. **Add Tailscale** serve + funnel paths:
   ```bash
   tailscale serve --https=443 --set-path /myproject --bg http://127.0.0.1:8422
   tailscale funnel --https=443 --set-path /myproject --bg http://127.0.0.1:8422
   ```
7. **Load** the launchd service
8. **Run** all 9 verification tests
9. **Connect** in Claude.ai: `https://your-host.ts.net/myproject`

---

## OAuth Flow — What Happens Step by Step

```
1. Claude.ai → POST https://host/myproject/
   Tailscale strips /myproject → server sees POST /
   Server: 401 Unauthorized
   WWW-Authenticate: Bearer resource_metadata="https://host/myproject/.well-known/oauth-protected-resource"
   (URL rewritten by _FixResourceMetadataMiddleware)

2. Claude.ai → GET https://host/myproject/.well-known/oauth-protected-resource
   Tailscale strips /myproject → server sees GET /.well-known/oauth-protected-resource
   Server: 200 { authorization_servers: ["https://host/myproject"] }
   (served by custom route)

3. Claude.ai → GET https://host/myproject/.well-known/openid-configuration
   Tailscale strips /myproject → server sees GET /.well-known/openid-configuration
   Server: 200 { issuer, authorization_endpoint, token_endpoint, registration_endpoint, ... }
   (served by custom route — URLs #1 and #2 from SDK fail because Tailscale can't route them)

4. Claude.ai → POST https://host/myproject/register
   Tailscale strips /myproject → server sees POST /register
   Server: 201 { client_id, client_secret }
   (handled by SDK's built-in DCR)

5. Claude.ai → GET https://host/myproject/authorize?...
   Tailscale strips /myproject → server sees GET /authorize
   Server: 302 → https://host/myproject/login?state=...
   (SDK calls OAuthProvider.authorize() which returns login URL)

6. User's browser → GET https://host/myproject/login?state=...
   Tailscale strips /myproject → server sees GET /login
   Server: 200 (HTML login form)
   (served by custom route)

7. User submits form → POST https://host/myproject/login
   Tailscale strips /myproject → server sees POST /login
   Server: validates credentials, creates auth code, 302 → claude.ai callback with code
   (served by custom route)

8. Claude.ai → POST https://host/myproject/token (with auth code + PKCE verifier)
   Tailscale strips /myproject → server sees POST /token
   Server: 200 { access_token, refresh_token }
   (handled by SDK's built-in token endpoint)

9. Claude.ai → POST https://host/myproject/ (with Bearer token)
   Tailscale strips /myproject → server sees POST /
   Server: 200 (MCP protocol — tool calls, etc.)
   (SDK validates token via OAuthProvider.load_access_token())
```

---

*Validated with FastMCP 3.1.0, mcp SDK, Tailscale 1.x, macOS Sequoia, March 2026.*
*Three servers running simultaneously on port 443 with path-based routing.*
