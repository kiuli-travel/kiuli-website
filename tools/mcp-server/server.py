#!/usr/bin/env python3
"""MCP filesystem server. Configured via environment variables."""
import os, re, subprocess, fnmatch
from pathlib import Path
from fastmcp import FastMCP

PROJECT_ROOT = Path(os.environ["PROJECT_ROOT"]).resolve()
SERVER_NAME  = os.environ.get("SERVER_NAME", "MCP Filesystem")
PORT         = int(os.environ.get("PORT", "8500"))

mcp  = FastMCP(SERVER_NAME)

_EXCLUDE = {".git", "__pycache__", "node_modules", ".next", ".venv", "dist", "build"}

def _load_gitignore(root: Path) -> list[str]:
    gi = root / ".gitignore"
    if not gi.exists():
        return []
    return [l.strip() for l in gi.read_text().splitlines()
            if l.strip() and not l.startswith("#")]

def _excluded(name: str, gi: list[str]) -> bool:
    if name in _EXCLUDE:
        return True
    return any(fnmatch.fnmatch(name, p) for p in gi)

def _safe(path: str) -> Path:
    p = (PROJECT_ROOT / path).resolve()
    if not str(p).startswith(str(PROJECT_ROOT)):
        raise ValueError(f"Path outside root: {path}")
    return p

@mcp.tool()
def list_directory(path: str = ".", recursive: bool = False) -> list:
    """List files and subdirectories. Respects .gitignore."""
    root = _safe(path)
    gi = _load_gitignore(PROJECT_ROOT)
    iterator = sorted(root.rglob("*")) if recursive else sorted(root.iterdir())
    entries = []
    for p in iterator:
        rel = p.relative_to(PROJECT_ROOT)
        if any(_excluded(part, gi) for part in rel.parts):
            continue
        entries.append({"name": p.name, "path": str(rel),
                        "type": "directory" if p.is_dir() else "file"})
    return entries

@mcp.tool()
def read_file(path: str) -> str:
    """Read file contents."""
    return _safe(path).read_text(errors="replace")

@mcp.tool()
def write_file(path: str, content: str) -> dict:
    """Write content to file. Creates parent directories."""
    p = _safe(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    return {"written": len(content), "path": path}

@mcp.tool()
def delete_file(path: str) -> dict:
    """Delete file or empty directory."""
    p = _safe(path)
    p.rmdir() if p.is_dir() else p.unlink()
    return {"deleted": path}

@mcp.tool()
def get_file_info(path: str) -> dict:
    """Return file metadata."""
    p = _safe(path)
    s = p.stat()
    return {"path": path, "type": "directory" if p.is_dir() else "file",
            "size": s.st_size, "modified": s.st_mtime}

@mcp.tool()
def search_files(pattern: str, is_regex: bool = False, max_results: int = 100) -> list:
    """Search file contents by regex or string."""
    results = []
    gi = _load_gitignore(PROJECT_ROOT)
    for p in PROJECT_ROOT.rglob("*"):
        if p.is_dir():
            continue
        if any(_excluded(part, gi) for part in p.relative_to(PROJECT_ROOT).parts):
            continue
        try:
            lines = p.read_text(errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            hit = re.search(pattern, line) if is_regex else (pattern in line)
            if hit:
                results.append({"file": str(p.relative_to(PROJECT_ROOT)), "line": i, "text": line})
                if len(results) >= max_results:
                    return results
    return results

@mcp.tool()
def git_status() -> dict:
    """Show git status: branch, changes, unpushed commits."""
    def run(cmd):
        return subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True).stdout.strip()
    return {
        "branch":   run(["git", "rev-parse", "--abbrev-ref", "HEAD"]),
        "changes":  [l for l in run(["git", "status", "--porcelain"]).splitlines() if l],
        "unpushed": [l for l in run(["git", "log", "@{u}..", "--oneline"]).splitlines() if l],
    }

@mcp.tool()
def git_commit_push(files: list[str], message: str, push: bool = True) -> dict:
    """Stage files, commit, optionally push."""
    def run(cmd):
        r = subprocess.run(cmd, cwd=PROJECT_ROOT, capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError(r.stderr.strip() or r.stdout.strip())
        return r.stdout.strip()
    run(["git", "add"] + files)
    run(["git", "commit", "-m", message])
    if push:
        run(["git", "push"])
    return {"committed": message, "pushed": push}

@mcp.tool()
def run_build() -> dict:
    """Run npm run build and return output. Timeout: 300s."""
    r = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=300
    )
    return {"exit_code": r.returncode, "stdout": r.stdout, "stderr": r.stderr}

@mcp.tool()
def payload_command(command: str) -> dict:
    """Run whitelisted Payload CMS commands: generate:importmap, migrate:status. Returns output."""
    ALLOWED = {"generate:importmap", "migrate:status"}
    if command not in ALLOWED:
        raise ValueError(f"Not allowed: {command}. Allowed: {sorted(ALLOWED)}")
    r = subprocess.run(
        ["npx", "payload", command],
        cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=120
    )
    return {"exit_code": r.returncode, "stdout": r.stdout, "stderr": r.stderr}

@mcp.tool()
def db_query(query: str) -> dict:
    """Run a READ-ONLY SQL query against the database. Uses DATABASE_URL_UNPOOLED or POSTGRES_URL. SELECT and \\d commands only."""
    stripped = query.strip()
    if not (stripped.upper().startswith("SELECT") or stripped.startswith("\\")):
        raise ValueError("Only SELECT queries and \\d meta-commands are permitted")
    db_url = os.environ.get("DATABASE_URL_UNPOOLED") or os.environ.get("POSTGRES_URL")
    if not db_url:
        raise ValueError("DATABASE_URL_UNPOOLED not set")
    r = subprocess.run(
        ["psql", db_url, "-c", query],
        capture_output=True, text=True, timeout=30
    )
    return {"exit_code": r.returncode, "stdout": r.stdout, "stderr": r.stderr}

@mcp.tool()
def vercel_env_list() -> dict:
    """List Vercel environment variable names (not values) for the project."""
    r = subprocess.run(
        ["vercel", "env", "ls"],
        cwd=PROJECT_ROOT, capture_output=True, text=True, timeout=30
    )
    return {"exit_code": r.returncode, "stdout": r.stdout, "stderr": r.stderr}

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="127.0.0.1", port=PORT)
