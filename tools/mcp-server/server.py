#!/usr/bin/env python3
"""
Kiuli MCP Server — filesystem, git, build, database, Lambda, and Payload tools.

Serves ~/Projects/kiuli-website to Claude.ai via Tailscale Funnel.
Port: 8420 (default), configurable via PORT env var.
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
# Claude.ai rejects.
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
log = logging.getLogger("kiuli-mcp")

PROJECT_ROOT = Path(os.environ["PROJECT_ROOT"]).resolve()
SERVER_NAME = os.environ.get("SERVER_NAME", "Kiuli Files")
PORT = int(os.environ.get("PORT", "8420"))

# ---------------------------------------------------------------------------
# OAuth
# ---------------------------------------------------------------------------
from starlette.requests import Request
from starlette.responses import Response

_oauth_provider = None
_MCP_PASSWORD = os.environ.get("MCP_PASSWORD", "")

if _MCP_PASSWORD:
    from oauth_provider import KiuliOAuthProvider
    _server_url = os.environ.get("MCP_SERVER_URL", "https://grahams-macbook-air.tail2d6663.ts.net:8443")
    _db_path = os.environ.get("OAUTH_DB_PATH", "/tmp/kiuli-mcp-oauth.db")
    _oauth_provider = KiuliOAuthProvider(
        password=_MCP_PASSWORD,
        db_path=_db_path,
        server_url=_server_url,
    )
    log.info("OAuth enabled")
else:
    log.info("OAuth disabled (MCP_PASSWORD not set)")

# ---------------------------------------------------------------------------
# FastMCP instance
# ---------------------------------------------------------------------------
if _oauth_provider:
    mcp = FastMCP(SERVER_NAME, auth=_oauth_provider)
else:
    mcp = FastMCP(SERVER_NAME)

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
# Login routes (only registered when OAuth is active)
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
        """Serve protected resource metadata at the path Tailscale can route.

        The MCP SDK registers this at /.well-known/oauth-protected-resource/kiuli/
        (RFC 9728), but Tailscale strips the /kiuli prefix so the request arrives
        here at /.well-known/oauth-protected-resource instead.
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
        """Serve OAuth metadata at the OIDC discovery path.

        The MCP SDK client tries three URLs for auth server metadata discovery.
        With Tailscale path-based routing, only the OIDC path-appended format
        (/prefix/.well-known/openid-configuration) is routable.
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
            "token_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
            "revocation_endpoint": f"{base}/revoke",
            "revocation_endpoint_auth_methods_supported": ["client_secret_post", "client_secret_basic"],
            "code_challenge_methods_supported": ["S256"],
        })


# ---------------------------------------------------------------------------
# Accept header normalization middleware (ASGI — NOT BaseHTTPMiddleware)
# MCP SDK rejects POST without application/json + text/event-stream in Accept.
# ---------------------------------------------------------------------------
class _FixResourceMetadataMiddleware:
    """Fix resource_metadata URL in 401 WWW-Authenticate for path-based proxy.

    The MCP SDK builds RFC 9728 URLs as:
      https://host/.well-known/oauth-protected-resource/prefix/
    But Tailscale --set-path strips the path prefix, so the URL must
    go through the prefix path instead:
      https://host/prefix/.well-known/oauth-protected-resource
    This middleware rewrites the URL in 401 responses.
    """
    def __init__(self, app, prefix):
        self.app = app
        self.prefix = prefix.rstrip("/")
        # From: /.well-known/oauth-protected-resource/kiuli  (and optional trailing /)
        # To:   /kiuli/.well-known/oauth-protected-resource
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
# Helpers
# ---------------------------------------------------------------------------

_EXCLUDE = {".git", "__pycache__", "node_modules", ".next", ".venv", "dist", "build", ".DS_Store"}


def _load_gitignore(root: Path) -> list[str]:
    gi = root / ".gitignore"
    if not gi.exists():
        return []
    return [l.strip() for l in gi.read_text().splitlines()
            if l.strip() and not l.startswith("#")]


def _excluded(name: str, gi: list[str]) -> bool:
    return name in _EXCLUDE or any(fnmatch.fnmatch(name, p) for p in gi)


def _safe(path: str) -> Path:
    p = (PROJECT_ROOT / path).resolve()
    if not str(p).startswith(str(PROJECT_ROOT)):
        raise ValueError(f"Path outside root: {path}")
    return p


def _run_git(args: list[str]) -> dict:
    try:
        r = subprocess.run(
            ["git"] + args, cwd=PROJECT_ROOT,
            capture_output=True, text=True, timeout=30
        )
        return {
            "ok": r.returncode == 0,
            "stdout": r.stdout.strip(),
            "stderr": r.stderr.strip(),
        }
    except Exception as e:
        return {"ok": False, "stdout": "", "stderr": str(e)}


# ---------------------------------------------------------------------------
# Tools — Filesystem
# ---------------------------------------------------------------------------

@mcp.tool()
def list_directory(path: str = ".", recursive: bool = False):
    """List files and subdirectories. Respects .gitignore. Max 500 entries."""
    try:
        root = _safe(path)
        gi = _load_gitignore(PROJECT_ROOT)
        entries = []
        for p in (sorted(root.rglob("*")) if recursive else sorted(root.iterdir())):
            rel = p.relative_to(PROJECT_ROOT)
            if any(_excluded(part, gi) for part in rel.parts):
                continue
            entries.append({"name": p.name, "path": str(rel),
                            "type": "directory" if p.is_dir() else "file"})
            if len(entries) >= 500:
                break
        return entries
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def read_file(path: str):
    """Read file contents."""
    try:
        return _safe(path).read_text(errors="replace")
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def write_file(path: str, content: str):
    """Write content to file. Creates parent directories."""
    try:
        p = _safe(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
        return {"written": len(content), "path": path}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def delete_file(path: str):
    """Delete file or empty directory."""
    try:
        p = _safe(path)
        p.rmdir() if p.is_dir() else p.unlink()
        return {"deleted": path}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def get_file_info(path: str):
    """Return file metadata."""
    try:
        p = _safe(path)
        s = p.stat()
        return {"path": path, "type": "directory" if p.is_dir() else "file",
                "size": s.st_size, "modified": s.st_mtime}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def search_files(pattern: str, is_regex: bool = False, max_results: int = 100):
    """Search file contents by regex or string."""
    try:
        results = []
        gi = _load_gitignore(PROJECT_ROOT)
        for p in PROJECT_ROOT.rglob("*"):
            if p.is_dir():
                continue
            rel = p.relative_to(PROJECT_ROOT)
            if any(_excluded(part, gi) for part in rel.parts):
                continue
            try:
                lines = p.read_text(errors="replace").splitlines()
            except Exception:
                continue
            for i, line in enumerate(lines, 1):
                if re.search(pattern, line) if is_regex else (pattern in line):
                    results.append({"file": str(rel), "line": i, "text": line})
                    if len(results) >= max_results:
                        return results
        return results
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Tools — Git
# ---------------------------------------------------------------------------

@mcp.tool()
def git_status():
    """Show git status: branch, HEAD hash, changes, unpushed commits, remote tracking info."""
    try:
        branch = _run_git(["rev-parse", "--abbrev-ref", "HEAD"])
        head_full = _run_git(["rev-parse", "HEAD"])
        head_short = _run_git(["rev-parse", "--short", "HEAD"])
        status = _run_git(["status", "--porcelain"])
        unpushed = _run_git(["log", "@{u}..", "--oneline"])
        last = _run_git(["log", "-1", "--format=%H %s %ai"])
        # Check if remote is reachable and what it has
        remote_head = _run_git(["ls-remote", "--heads", "origin", "main"])
        local_head = head_full["stdout"] if head_full["ok"] else ""
        remote_hash = ""
        if remote_head["ok"] and remote_head["stdout"]:
            remote_hash = remote_head["stdout"].split()[0] if remote_head["stdout"] else ""
        return {
            "branch": branch["stdout"] if branch["ok"] else "unknown",
            "head": head_short["stdout"] if head_short["ok"] else "unknown",
            "headFull": local_head,
            "changes": [l for l in status["stdout"].splitlines() if l] if status["ok"] else [],
            "unpushed": [l for l in unpushed["stdout"].splitlines() if l] if unpushed["ok"] else [],
            "last_commit": last["stdout"] if last["ok"] else None,
            "remoteHead": remote_hash,
            "localMatchesRemote": local_head == remote_hash if (local_head and remote_hash) else None,
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def git_commit_push(files: list[str], message: str, push: bool = True):
    """Stage files, commit, optionally push."""
    try:
        add = _run_git(["add"] + files)
        if not add["ok"]:
            return {"committed": False, "error": f"git add failed: {add['stderr']}"}
        commit = _run_git(["commit", "-m", message])
        if not commit["ok"]:
            return {"committed": False, "error": f"git commit failed: {commit['stderr']}"}
        pushed = False
        if push:
            p = _run_git(["push"])
            pushed = p["ok"]
            if not pushed:
                return {"committed": True, "pushed": False, "error": f"git push failed: {p['stderr']}"}
        return {"committed": True, "message": message, "pushed": pushed}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def git_push():
    """Push all committed changes to remote. Use after git_commit_push(push=False) or when commits were made externally."""
    try:
        r = _run_git(["push"])
        if not r["ok"]:
            return {"pushed": False, "error": r["stderr"]}
        return {"pushed": True, "output": r["stdout"]}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def git_log(count: int = 10):
    """Show recent git log: hash, date, message."""
    try:
        r = _run_git(["log", f"-{min(count, 50)}", "--format=%h %ai %s"])
        if not r["ok"]:
            return {"error": r["stderr"]}
        return {
            "commits": [l for l in r["stdout"].splitlines() if l],
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def git_diff(staged: bool = False, file: str = ""):
    """Show git diff. staged=True for staged changes. file to limit to one file."""
    try:
        args = ["diff"]
        if staged:
            args.append("--staged")
        if file:
            args.extend(["--", file])
        r = _run_git(args)
        if not r["ok"]:
            return {"error": r["stderr"]}
        return {"diff": r["stdout"] or "(no changes)"}
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Tools — Build & Payload
# ---------------------------------------------------------------------------

@mcp.tool()
def run_build():
    """Run npm run build and return output. Timeout: 300s."""
    try:
        r = subprocess.run(
            ["npm", "run", "build"],
            cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=300
        )
        output = (r.stdout + "\n" + r.stderr).strip()
        lines = output.split("\n")
        tail = "\n".join(lines[-100:])
        return {
            "success": r.returncode == 0,
            "total_lines": len(lines),
            "output": tail,
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def payload_command(command: str):
    """Run whitelisted Payload CMS commands: generate:importmap, migrate:status. Returns output."""
    try:
        ALLOWED = {"generate:importmap", "migrate:status"}
        if command not in ALLOWED:
            return {"error": f"Not allowed: {command}. Allowed: {sorted(ALLOWED)}"}
        r = subprocess.run(
            ["npx", "payload", command],
            cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=120
        )
        return {"command": command, "exit_code": r.returncode,
                "stdout": r.stdout, "stderr": r.stderr}
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Tools — Database
# ---------------------------------------------------------------------------

@mcp.tool()
def db_query(query: str):
    """Run a READ-ONLY SQL query against the database. Uses DATABASE_URL_UNPOOLED or POSTGRES_URL. SELECT, EXPLAIN, and \\d commands only."""
    try:
        stripped = query.strip().upper()
        is_select = stripped.startswith("SELECT") or stripped.startswith("WITH")
        is_meta = query.strip().startswith("\\")
        is_explain = stripped.startswith("EXPLAIN")
        if not (is_select or is_meta or is_explain):
            return {"error": "Only SELECT, EXPLAIN, and psql meta-commands are allowed"}
        db_url = os.environ.get("DATABASE_URL_UNPOOLED") or os.environ.get("POSTGRES_URL")
        if not db_url:
            return {"error": "DATABASE_URL_UNPOOLED not set"}
        r = subprocess.run(
            ["psql", db_url, "-c", query],
            capture_output=True, text=True, timeout=30
        )
        return {"success": r.returncode == 0,
                "output": (r.stdout + "\n" + r.stderr).strip()}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def db_exec(sql: str, confirm: str = ""):
    """Run a WRITE SQL statement against the database. Supports INSERT, UPDATE, DELETE, CREATE, ALTER, DROP. Requires confirm='EXECUTE' to prevent accidents."""
    try:
        if confirm != "EXECUTE":
            return {"executed": False, "error": f"confirm must be exactly 'EXECUTE'. Got: {confirm}"}
        stripped = sql.strip().upper()
        if stripped.startswith("SELECT") or stripped.startswith("WITH") or stripped.startswith("EXPLAIN"):
            return {"executed": False, "error": "Use db_query for SELECT/WITH/EXPLAIN"}
        db_url = os.environ.get("DATABASE_URL_UNPOOLED") or os.environ.get("POSTGRES_URL")
        if not db_url:
            return {"executed": False, "error": "DATABASE_URL_UNPOOLED not set"}
        r = subprocess.run(
            ["psql", db_url, "-c", sql],
            capture_output=True, text=True, timeout=30
        )
        return {"executed": r.returncode == 0,
                "output": (r.stdout + "\n" + r.stderr).strip()}
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Tools — Vercel (CI/CD)
# ---------------------------------------------------------------------------

import json as _json
import tempfile as _tempfile
import signal as _signal

# Track background deploy processes by job ID
_DEPLOY_JOBS_DIR = Path(_tempfile.gettempdir()) / "kiuli-mcp-deploys"
_DEPLOY_JOBS_DIR.mkdir(exist_ok=True)


def _run_vercel(args: list[str], timeout: int = 30) -> dict:
    """Run a vercel CLI command and return structured result."""
    try:
        r = subprocess.run(
            ["vercel"] + args,
            cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=timeout
        )
        return {
            "ok": r.returncode == 0,
            "stdout": r.stdout.strip(),
            "stderr": r.stderr.strip(),
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "stdout": "", "stderr": f"Command timed out after {timeout}s"}
    except Exception as e:
        return {"ok": False, "stdout": "", "stderr": str(e)}


@mcp.tool()
def vercel_list(prod_only: bool = True):
    """List recent Vercel deployments. Shows URL, state, commit, branch, age. Use this to find deployment URLs for vercel_inspect or vercel_logs."""
    try:
        args = ["ls"]
        if prod_only:
            args.append("--prod")
        r = _run_vercel(args, timeout=30)
        if not r["ok"]:
            return {"error": r["stderr"]}
        return {
            "success": True,
            "output": r["stdout"],
            "hint": "Use a deployment URL from this list with vercel_inspect to see build details, or vercel_logs for runtime logs.",
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def vercel_inspect(url: str):
    """Get full details for a Vercel deployment: build state, commit, duration, routes, build log tail. Pass a deployment URL from vercel_list."""
    try:
        r = _run_vercel(["inspect", url], timeout=30)
        if not r["ok"]:
            return {"error": r["stderr"]}
        return {
            "success": True,
            "deployment": url,
            "output": r["stdout"],
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def vercel_logs(url: str = "", follow: bool = False, filter: str = ""):
    """Fetch runtime logs for a Vercel deployment. Pass a deployment URL from vercel_list. If url is empty, fetches logs for the latest production deployment automatically."""
    try:
        # If no URL given, get latest prod deployment URL first
        if not url:
            ls_result = _run_vercel(["ls", "--prod"], timeout=20)
            if not ls_result["ok"]:
                return {"error": f"Could not list deployments: {ls_result['stderr']}"}
            # Parse the URL from the ls output (second line after header typically contains the URL)
            lines = ls_result["stdout"].split("\n")
            url_found = None
            for line in lines:
                match = re.search(r"(https://[^\s]+\.vercel\.app)", line)
                if match:
                    url_found = match.group(1)
                    break
            if not url_found:
                return {
                    "error": "Could not extract deployment URL from vercel ls output",
                    "raw_output": ls_result["stdout"],
                    "hint": "Run vercel_list first and pass a specific URL.",
                }
            url = url_found

        cmd_args = ["logs", url]
        r = _run_vercel(cmd_args, timeout=30)
        output = (r["stdout"] + "\n" + r["stderr"]).strip()

        if filter:
            filtered_lines = [l for l in output.split("\n") if filter.lower() in l.lower()]
            output = "\n".join(filtered_lines) if filtered_lines else f"(no lines matching '{filter}')"

        return {
            "deployment": url,
            "lineCount": len(output.split("\n")) if output else 0,
            "output": output or "(no logs)",
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def vercel_deploy(confirm: str = ""):
    """Deploy Kiuli website to Vercel production from local code. Runs as a background process because deploys take 2-5 minutes. Returns a job_id — use vercel_deploy_status to check progress. Requires confirm='DEPLOY'."""
    try:
        if confirm != "DEPLOY":
            return {"deployed": False, "error": f"confirm must be exactly 'DEPLOY'. Got: {confirm}"}

        # Create a unique job ID and output file
        import time
        job_id = f"deploy-{int(time.time())}"
        output_file = _DEPLOY_JOBS_DIR / f"{job_id}.log"
        pid_file = _DEPLOY_JOBS_DIR / f"{job_id}.pid"
        status_file = _DEPLOY_JOBS_DIR / f"{job_id}.status"

        # Write initial status
        status_file.write_text("RUNNING")

        # Launch vercel --prod --yes as a background process
        # Redirect all output to the log file
        with open(output_file, "w") as f:
            process = subprocess.Popen(
                ["vercel", "--prod", "--yes"],
                cwd=PROJECT_ROOT,
                stdout=f,
                stderr=subprocess.STDOUT,
            )

        pid_file.write_text(str(process.pid))

        # Start a monitor thread that waits for completion and writes status
        import threading
        def _monitor():
            returncode = process.wait()
            if returncode == 0:
                status_file.write_text("SUCCESS")
            else:
                status_file.write_text(f"FAILED (exit code {returncode})")

        t = threading.Thread(target=_monitor, daemon=True)
        t.start()

        return {
            "started": True,
            "job_id": job_id,
            "pid": process.pid,
            "hint": f"Deploy is running in background. Use vercel_deploy_status(job_id='{job_id}') to check progress.",
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def vercel_deploy_status(job_id: str = ""):
    """Check the status of a background Vercel deployment. If no job_id, lists all recent deploy jobs."""
    try:
        if not job_id:
            # List all deploy jobs
            jobs = []
            for status_file in sorted(_DEPLOY_JOBS_DIR.glob("*.status"), reverse=True):
                jid = status_file.stem
                status = status_file.read_text().strip()
                log_file = _DEPLOY_JOBS_DIR / f"{jid}.log"
                log_size = log_file.stat().st_size if log_file.exists() else 0
                jobs.append({"job_id": jid, "status": status, "log_bytes": log_size})
            return {"jobs": jobs[:10]} if jobs else {"jobs": [], "hint": "No deploy jobs found. Use vercel_deploy to start one."}

        status_file = _DEPLOY_JOBS_DIR / f"{job_id}.status"
        log_file = _DEPLOY_JOBS_DIR / f"{job_id}.log"
        pid_file = _DEPLOY_JOBS_DIR / f"{job_id}.pid"

        if not status_file.exists():
            return {"error": f"Unknown job_id: {job_id}"}

        status = status_file.read_text().strip()
        log_content = log_file.read_text() if log_file.exists() else ""
        log_lines = log_content.strip().split("\n") if log_content.strip() else []

        # Extract deployment URL from output if successful
        url = None
        if status == "SUCCESS":
            for line in log_lines:
                match = re.search(r"Production:\s+(https://[^\s]+)", line)
                if match:
                    url = match.group(1)
                    break

        # Return last 50 lines of log to keep response size manageable
        tail = "\n".join(log_lines[-50:])

        return {
            "job_id": job_id,
            "status": status,
            "url": url,
            "log_lines": len(log_lines),
            "log_tail": tail,
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def vercel_git():
    """Check Vercel Git integration status by inspecting the latest deployment. Shows git source, commit, branch, and whether auto-deploy is working."""
    try:
        # Get latest deployment details — vercel inspect shows git info
        ls_result = _run_vercel(["ls", "--prod"], timeout=20)
        if not ls_result["ok"]:
            return {"error": f"Could not list deployments: {ls_result['stderr']}"}

        # Extract first deployment URL
        url_found = None
        for line in ls_result["stdout"].split("\n"):
            match = re.search(r"(https://[^\s]+\.vercel\.app)", line)
            if match:
                url_found = match.group(1)
                break

        if not url_found:
            return {"error": "No deployments found", "raw": ls_result["stdout"]}

        # Inspect it for git info
        inspect_result = _run_vercel(["inspect", url_found], timeout=30)

        # Also read .vercel/project.json for linked project
        project_json = PROJECT_ROOT / ".vercel" / "project.json"
        local_config = None
        if project_json.exists():
            local_config = _json.loads(project_json.read_text())

        # Check local git state
        head = _run_git(["rev-parse", "--short", "HEAD"])
        remote = _run_git(["ls-remote", "--heads", "origin", "main"])

        return {
            "success": True,
            "latestDeployment": url_found,
            "inspectOutput": inspect_result["stdout"] if inspect_result["ok"] else inspect_result["stderr"],
            "linkedProject": local_config,
            "localHead": head["stdout"] if head["ok"] else None,
            "remoteHead": remote["stdout"].split()[0][:7] if remote["ok"] and remote["stdout"] else None,
            "deploymentList": ls_result["stdout"],
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def vercel_project():
    """Get Vercel project settings: framework, build command, output directory, git integration, domains."""
    try:
        r = _run_vercel(["project", "ls"], timeout=20)
        project_list = r["stdout"] if r["ok"] else "(failed to list)"

        # Also try to get linked project info from .vercel/project.json
        project_json = PROJECT_ROOT / ".vercel" / "project.json"
        local_config = None
        if project_json.exists():
            local_config = _json.loads(project_json.read_text())

        return {
            "success": True,
            "projects": project_list,
            "linkedProject": local_config,
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def vercel_rollback(url: str, confirm: str = ""):
    """Rollback Vercel production to a previous deployment. Pass a deployment URL from vercel_list. Requires confirm='ROLLBACK'."""
    try:
        if confirm != "ROLLBACK":
            return {"rolled_back": False, "error": f"confirm must be exactly 'ROLLBACK'. Got: {confirm}"}
        r = _run_vercel(["rollback", url, "--yes"], timeout=60)
        return {
            "rolled_back": r["ok"],
            "url": url,
            "output": (r["stdout"] + "\n" + r["stderr"]).strip(),
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def vercel_env_list():
    """List Vercel environment variable names (not values) for the project."""
    try:
        r = _run_vercel(["env", "ls"], timeout=30)
        return {"success": r["ok"],
                "output": (r["stdout"] + "\n" + r["stderr"]).strip()}
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Tools — Lambda
# ---------------------------------------------------------------------------

LAMBDA_FUNCTION_MAP = {
    "scraper": "kiuli-scraper",
    "orchestrator": "kiuli-v6-orchestrator",
    "image-processor": "kiuli-v6-image-processor",
    "labeler": "kiuli-v6-labeler",
    "finalizer": "kiuli-v6-finalizer",
    "video-processor": "kiuli-v6-video-processor",
}


@mcp.tool()
def lambda_status(function: str = "all"):
    """Get deployed status for Kiuli Lambda functions from AWS. Returns State, LastModified, CodeSize, and git hash. function: 'all', 'scraper', 'orchestrator', 'image-processor', 'labeler', or 'finalizer'."""
    try:
        targets = list(LAMBDA_FUNCTION_MAP.items()) if function == "all" else [(function, LAMBDA_FUNCTION_MAP.get(function))]
        if targets[0][1] is None:
            return {"error": f"Unknown function: {function}. Valid: {sorted(LAMBDA_FUNCTION_MAP.keys())}"}

        results = {}
        for key, name in targets:
            try:
                r = subprocess.run(
                    ["aws", "lambda", "get-function-configuration",
                     "--function-name", name, "--region", "eu-north-1",
                     "--query", "{State:State,LastModified:LastModified,CodeSize:CodeSize,Description:Description}",
                     "--output", "json"],
                    capture_output=True, text=True, timeout=20
                )
                if r.returncode == 0:
                    import json
                    data = json.loads(r.stdout.strip())
                    hash_match = re.search(r"git:([a-f0-9]+)", data.get("Description", ""))
                    data["deployedGitHash"] = hash_match.group(1) if hash_match else None
                    results[key] = data
                else:
                    results[key] = {"error": r.stderr.strip()}
            except Exception as e:
                results[key] = {"error": str(e)}

        head = _run_git(["rev-parse", "--short", "HEAD"])
        current_hash = head["stdout"] if head["ok"] else "unknown"

        sync_status = {}
        for key, data in results.items():
            if "error" in data:
                sync_status[key] = "ERROR"
            elif not data.get("deployedGitHash"):
                sync_status[key] = "NO_HASH_STAMPED"
            elif data["deployedGitHash"] == current_hash:
                sync_status[key] = "CURRENT"
            else:
                sync_status[key] = f"BEHIND — deployed: {data['deployedGitHash']}, head: {current_hash}"

        return {
            "currentHead": current_hash,
            "allCurrent": all(s == "CURRENT" for s in sync_status.values()),
            "syncStatus": sync_status,
            "functions": results,
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def lambda_logs(function: str, since: str = "10m", filter: str = ""):
    """Tail recent CloudWatch logs for a Kiuli Lambda function. function: 'scraper', 'orchestrator', 'image-processor', 'labeler', or 'finalizer'. since: e.g. '5m', '30m', '1h'. filter: optional keyword."""
    try:
        name = LAMBDA_FUNCTION_MAP.get(function)
        if not name:
            return {"error": f"Unknown function: {function}. Valid: {sorted(LAMBDA_FUNCTION_MAP.keys())}"}
        log_group = f"/aws/lambda/{name}"
        cmd = f"aws logs tail {log_group} --since {since} --region eu-north-1 --format short 2>&1"
        if filter:
            import shlex
            cmd += f" | grep -i {shlex.quote(filter)} || true"
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        output = r.stdout.strip()
        lines = output.split("\n") if output else []
        return {
            "function": name,
            "logGroup": log_group,
            "since": since,
            "filter": filter or None,
            "lineCount": len(lines),
            "output": output or "(no logs in this time window)",
        }
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Tools — Lambda Deployment
# ---------------------------------------------------------------------------

@mcp.tool()
def deploy_lambda(function: str):
    """Deploy a Kiuli Lambda function using deploy.sh. Syncs shared modules, installs deps for linux-x64, packages, uploads, stamps git hash, verifies. Returns full output."""
    try:
        valid = list(LAMBDA_FUNCTION_MAP.keys())
        if function not in valid:
            return {"error": f"Unknown function: {function}. Valid: {sorted(valid)}"}
        script = PROJECT_ROOT / "lambda" / "scripts" / "deploy.sh"
        if not script.exists():
            return {"error": f"deploy.sh not found at {script}"}
        r = subprocess.run(
            ["bash", str(script), function],
            cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=300,
            env={**os.environ, "PATH": os.environ.get("PATH", "")},
        )
        output = (r.stdout + "\n" + r.stderr).strip()
        return {
            "function": function,
            "success": "DEPLOYMENT SUCCESSFUL" in output,
            "output": output,
            "exit_code": r.returncode,
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def verify_lambdas():
    """Run verify.sh to check all Lambda functions are deployed at current git HEAD."""
    try:
        script = PROJECT_ROOT / "lambda" / "scripts" / "verify.sh"
        if not script.exists():
            return {"error": f"verify.sh not found at {script}"}
        r = subprocess.run(
            ["bash", str(script)],
            cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=60,
            env={**os.environ, "PATH": os.environ.get("PATH", "")},
        )
        output = (r.stdout + "\n" + r.stderr).strip()
        return {
            "allCurrent": "All functions verified at HEAD" in output,
            "output": output,
        }
    except Exception as e:
        return {"error": str(e)}


# ---------------------------------------------------------------------------
# Tools — Scraper Pipeline
# ---------------------------------------------------------------------------

@mcp.tool()
def trigger_pipeline(itrvl_url: str, mode: str = "update"):
    """Start the Kiuli scraper pipeline for an iTrvl URL via the website API. Creates a job record and triggers Step Functions. mode: 'create' or 'update' (default: update)."""
    try:
        import json as _json
        import urllib.request
        api_key = os.environ.get("SCRAPER_API_KEY", "") or os.environ.get("PAYLOAD_API_KEY", "")
        api_key = api_key.strip().replace("\\n", "")
        if not api_key:
            return {"error": "SCRAPER_API_KEY / PAYLOAD_API_KEY not set in environment"}
        payload = _json.dumps({"itrvlUrl": itrvl_url, "mode": mode}).encode()
        req = urllib.request.Request(
            "https://kiuli.com/api/scrape-itinerary",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = _json.loads(resp.read().decode())
        return {
            "started": data.get("success", False),
            "jobId": data.get("jobId"),
            "itineraryId": data.get("itineraryId"),
            "mode": data.get("mode"),
            "message": data.get("message"),
            "itrvlUrl": itrvl_url,
        }
    except urllib.error.HTTPError as e:
        import json as _json
        body = e.read().decode() if e.fp else ""
        try:
            err_data = _json.loads(body)
        except Exception:
            err_data = {"raw": body}
        return {"started": False, "status": e.code, "error": err_data}
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def pipeline_status(execution_arn: str = ""):
    """Check Step Functions pipeline execution status, or list recent executions if no ARN given."""
    try:
        import json as _json
        sm_arn = "arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline"

        if not execution_arn:
            r = subprocess.run(
                ["aws", "stepfunctions", "list-executions",
                 "--state-machine-arn", sm_arn,
                 "--max-results", "10",
                 "--region", "eu-north-1", "--output", "json"],
                capture_output=True, text=True, timeout=30,
            )
            if r.returncode != 0:
                return {"error": r.stderr.strip()}
            data = _json.loads(r.stdout.strip())
            return {
                "mode": "list",
                "executions": [
                    {"name": e["name"], "status": e["status"],
                     "startDate": e.get("startDate"), "stopDate": e.get("stopDate"),
                     "executionArn": e["executionArn"]}
                    for e in data.get("executions", [])
                ],
            }

        r = subprocess.run(
            ["aws", "stepfunctions", "describe-execution",
             "--execution-arn", execution_arn,
             "--region", "eu-north-1", "--output", "json"],
            capture_output=True, text=True, timeout=30,
        )
        if r.returncode != 0:
            return {"error": r.stderr.strip()}
        data = _json.loads(r.stdout.strip())
        return {
            "mode": "detail",
            "name": data.get("name"),
            "status": data.get("status"),
            "startDate": data.get("startDate"),
            "stopDate": data.get("stopDate"),
            "error": data.get("error"),
            "cause": data.get("cause"),
        }
    except Exception as e:
        return {"error": str(e)}



# (Vercel deployment tools are now in the "Tools — Vercel (CI/CD)" section above)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    from starlette.middleware import Middleware

    log.info(f"Kiuli MCP server starting on 127.0.0.1:{PORT}")
    mcp.run(
        transport="streamable-http",
        host="127.0.0.1",
        port=PORT,
        path="/",
        json_response=True,
        middleware=[
            Middleware(_FixResourceMetadataMiddleware, prefix="/kiuli"),
            Middleware(_NormaliseAcceptMiddleware),
        ],
    )
