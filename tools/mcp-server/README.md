# Kiuli MCP Filesystem Server

Enhanced MCP server for the Kiuli website project. Provides Claude.ai with filesystem access, git operations, build verification, database inspection, and Payload CMS management.

## Tools

| Tool | Purpose |
|------|---------|
| `list_directory` | List files/dirs, respects .gitignore |
| `read_file` | Read file contents |
| `write_file` | Write file (creates parent dirs) |
| `delete_file` | Delete file or empty directory |
| `search_files` | Search by string or regex |
| `get_file_info` | File metadata (size, modified) |
| `git_status` | Branch, uncommitted changes, unpushed commits |
| `git_commit_push` | Stage, commit, and push |
| `run_build` | Run `npm run build`, return success/failure + output |
| `payload_command` | Whitelisted Payload commands (generate:importmap, migrate:status) |
| `db_query` | Read-only SQL queries (SELECT only) |
| `vercel_env_list` | List Vercel env var names |

## Setup

```bash
cd tools/mcp-server
npm install
```

## Running

```bash
# Default (port 3200, project root auto-detected)
node server.mjs

# Custom configuration
PROJECT_ROOT=/path/to/project PORT=3200 BASE_PATH=/kiuli node server.mjs
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_ROOT` | `/Users/grahamwallington/Projects/kiuli-website` | Project root directory |
| `PORT` | `3200` | Server port |
| `BASE_PATH` | (empty) | URL prefix for SSE/messages endpoints |
| `SERVER_NAME` | `Kiuli Filesystem Server` | Server name in MCP |
| `DATABASE_URL_UNPOOLED` | — | Database connection for db_query tool |
| `POSTGRES_URL` | — | Fallback database connection |

## Tailscale Funnel

The server is exposed via Tailscale Funnel at:
```
https://grahams-macbook-air.tail2d6663.ts.net/kiuli/sse
```

## Security

- Path traversal blocked (all paths must resolve within PROJECT_ROOT)
- Database queries are read-only (SELECT, EXPLAIN, psql meta-commands only)
- Payload commands are whitelisted (only specific safe commands allowed)
- Git operations require explicit file paths
