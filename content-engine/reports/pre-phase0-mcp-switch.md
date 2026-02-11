# MCP Server Switch Report

**Date:** 2026-02-11
**Reporter:** Claude CLI

## Process Status
- Old process killed: **YES** (zombie PID 71728 from deleted `mcp-filesystem-server/`)
- New process running: **YES**
- PID: 52738
- Server path: `/Users/grahamwallington/Projects/kiuli-website/tools/mcp-server/server.mjs`

## Plist Changes Made

File: `~/Library/LaunchAgents/com.kiuli.mcp-server.plist`

| Setting | Old Value | New Value |
|---------|-----------|-----------|
| ProgramArguments path | `tools/mcp-filesystem-server/server.mjs` | `tools/mcp-server/server.mjs` |
| WorkingDirectory | `tools/mcp-filesystem-server` | `tools/mcp-server` |
| PORT | *(not set)* | `3101` |
| BASE_PATH | `/kiuli` | *(empty)* |
| DATABASE_URL_UNPOOLED | *(not set)* | `postgresql://neondb_owner:...@ep-shiny-band-ab1k6dnh.eu-west-2.aws.neon.tech/neondb?sslmode=require` |
| StandardOutPath | `tools/mcp-filesystem-server/server.log` | `tools/mcp-server/server.log` |
| StandardErrorPath | `tools/mcp-filesystem-server/server-error.log` | `tools/mcp-server/server-error.log` |

### BASE_PATH Fix

The original plist had `BASE_PATH=/kiuli`, which meant server routes were registered at `/kiuli/health`, `/kiuli/sse`, etc. However, Tailscale Funnel strips the `/kiuli` prefix before forwarding to localhost — so the server received `/health` instead of `/kiuli/health`, causing 404s.

**Fix:** Set `BASE_PATH` to empty string. Now:
- Local: `http://localhost:3101/health`, `http://localhost:3101/sse`
- Tailscale: `https://grahams-macbook-air.tail2d6663.ts.net/kiuli/health` → strips `/kiuli` → `http://localhost:3101/health` ✓

## Health Check
- Local (`http://localhost:3101/health`): `{"status":"ok","server":"Kiuli Filesystem Server","project_root":"/Users/grahamwallington/Projects/kiuli-website","sessions":0}`
- Tailscale Funnel (`https://grahams-macbook-air.tail2d6663.ts.net/kiuli/health`): `{"status":"ok","server":"Kiuli Filesystem Server","project_root":"/Users/grahamwallington/Projects/kiuli-website","sessions":0}`

## Known Limitation

The MCP SDK `McpServer` only supports one SSE transport connection at a time. Multiple simultaneous `/sse` connections will crash the server with:
```
Error: Already connected to a transport. Call close() before connecting to a new transport, or use a separate Protocol instance per connection.
```
launchd's `KeepAlive: true` auto-restarts the server after a crash, so this is recoverable but not ideal. This is a design constraint in the SDK — the server code would need to create a new `McpServer` instance per connection to support multiple clients.

## Errors
None (error log cleared after test-induced crash from simultaneous SSE connections)

## Status: COMPLETE

MCP server successfully switched from deleted `mcp-filesystem-server` to new `mcp-server`. Both local and Tailscale Funnel endpoints verified working. Claude.ai can connect via `https://grahams-macbook-air.tail2d6663.ts.net/kiuli/sse`.
