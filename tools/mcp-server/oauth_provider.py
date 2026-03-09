"""
Kiuli MCP Server — Self-contained OAuth 2.1 provider.

Adapted from Graham Dev's working implementation (which was adapted from Karula).
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
    "MCP_SERVER_URL", "https://grahams-macbook-air.tail2d6663.ts.net/kiuli"
)
MCP_USERNAME: str = os.environ.get("MCP_USERNAME", "graham")
MCP_PASSWORD_RAW: str = os.environ.get("MCP_PASSWORD", "")
DB_PATH: str = os.environ.get("OAUTH_DB_PATH", "/tmp/kiuli-mcp-oauth.db")

# Token lifetimes
ACCESS_TOKEN_TTL: int = 3600         # 1 hour
REFRESH_TOKEN_TTL: int = 60 * 86400  # 60 days
AUTH_CODE_TTL: int = 300             # 5 minutes
PENDING_AUTH_TTL: int = 600          # 10 minutes

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

class KiuliOAuthProvider(OAuthProvider):

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
  <title>Kiuli MCP — Login</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto; padding: 0 1rem;
           background: #F5F3EB; color: #404040; }}
    h1 {{ font-size: 1.4rem; margin-bottom: 1.5rem; color: #486A6A; }}
    label {{ display: block; margin-bottom: 0.25rem; font-size: 0.9rem; color: #666; }}
    input {{ width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #DADADA;
             border-radius: 4px; font-size: 1rem; box-sizing: border-box; }}
    button {{ width: 100%; padding: 0.6rem; background: #486A6A; color: #fff;
              border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }}
    button:hover {{ background: #3a5656; }}
  </style>
</head>
<body>
  <h1>Kiuli MCP — Login</h1>
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
                "<h2>Error</h2><p>Authorization request expired. Return to Claude and try again.</p>",
                status_code=400,
            )

        if username != MCP_USERNAME or not self._check_password(password):
            safe_state = html.escape(state)
            server_url_escaped = html.escape(str(SERVER_URL).rstrip("/"))
            body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Kiuli MCP — Login</title>
  <style>
    body {{ font-family: system-ui, sans-serif; max-width: 400px; margin: 80px auto; padding: 0 1rem;
           background: #F5F3EB; color: #404040; }}
    h1 {{ font-size: 1.4rem; margin-bottom: 1.5rem; color: #486A6A; }}
    label {{ display: block; margin-bottom: 0.25rem; font-size: 0.9rem; color: #666; }}
    input {{ width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #DADADA;
             border-radius: 4px; font-size: 1rem; box-sizing: border-box; }}
    button {{ width: 100%; padding: 0.6rem; background: #486A6A; color: #fff;
              border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }}
    .error {{ color: #c00; margin-bottom: 1rem; font-size: 0.9rem; }}
  </style>
</head>
<body>
  <h1>Kiuli MCP — Login</h1>
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
