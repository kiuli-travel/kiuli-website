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
    """Show git status: branch, changes, unpushed commits."""
    try:
        branch = _run_git(["rev-parse", "--abbrev-ref", "HEAD"])
        status = _run_git(["status", "--porcelain"])
        unpushed = _run_git(["log", "@{u}..", "--oneline"])
        last = _run_git(["log", "-1", "--format=%H %s"])
        return {
            "branch": branch["stdout"] if branch["ok"] else "unknown",
            "changes": [l for l in status["stdout"].splitlines() if l] if status["ok"] else [],
            "unpushed": [l for l in unpushed["stdout"].splitlines() if l] if unpushed["ok"] else [],
            "last_commit": last["stdout"] if last["ok"] else None,
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
# Tools — Vercel
# ---------------------------------------------------------------------------

@mcp.tool()
def vercel_env_list():
    """List Vercel environment variable names (not values) for the project."""
    try:
        r = subprocess.run(
            ["vercel", "env", "ls"],
            cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=30
        )
        return {"success": r.returncode == 0,
                "output": (r.stdout + "\n" + r.stderr).strip()}
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
def trigger_pipeline(itrvl_url: str, execution_name: str = ""):
    """Start the Kiuli scraper Step Functions pipeline for an iTrvl URL. Returns execution ARN."""
    try:
        import json as _json
        arn = "arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline"
        name = execution_name or f"scrape-{int(__import__('time').time())}"
        inp = _json.dumps({"itrvlUrl": itrvl_url})
        r = subprocess.run(
            ["aws", "stepfunctions", "start-execution",
             "--state-machine-arn", arn,
             "--name", name,
             "--input", inp,
             "--region", "eu-north-1", "--output", "json"],
            capture_output=True, text=True, timeout=30,
        )
        if r.returncode == 0:
            data = _json.loads(r.stdout.strip())
            return {
                "started": True,
                "executionArn": data.get("executionArn"),
                "startDate": data.get("startDate"),
                "name": name,
                "itrvlUrl": itrvl_url,
            }
        return {"started": False, "error": r.stderr.strip()}
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


# ---------------------------------------------------------------------------
# Tools — Vercel Deployment
# ---------------------------------------------------------------------------

@mcp.tool()
def vercel_deploy(confirm: str = ""):
    """Deploy Kiuli website to Vercel production. Requires confirm='DEPLOY'."""
    try:
        if confirm != "DEPLOY":
            return {"deployed": False, "error": f"confirm must be exactly 'DEPLOY'. Got: {confirm}"}
        r = subprocess.run(
            ["vercel", "--prod", "--yes"],
            cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=600,
        )
        output = (r.stdout + "\n" + r.stderr).strip()
        url_match = re.search(r"Production:\s+(https://[^\s]+)", output)
        return {
            "deployed": r.returncode == 0,
            "url": url_match.group(1) if url_match else None,
            "output": output,
        }
    except Exception as e:
        return {"error": str(e)}


@mcp.tool()
def vercel_logs(since: str = "1h", filter: str = ""):
    """Fetch recent Vercel production logs."""
    try:
        cmd = f"vercel logs production --since {since} 2>&1"
        if filter:
            import shlex
            cmd += f" | grep -i {shlex.quote(filter)} || true"
        r = subprocess.run(cmd, shell=True, cwd=PROJECT_ROOT,
                           capture_output=True, text=True, timeout=30)
        output = r.stdout.strip()
        lines = output.split("\n") if output else []
        return {
            "since": since,
            "filter": filter or None,
            "lineCount": len(lines),
            "output": output or "(no logs in this time window)",
        }
    except Exception as e:
        return {"error": str(e)}


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
