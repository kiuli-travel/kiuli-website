# Kiuli MCP Server

MCP server for the Kiuli website project. Provides Claude with filesystem access, git operations, CI/CD management (Vercel + Lambda), database inspection, and Payload CMS management.

Built with FastMCP 3.x (Python). Served via Tailscale Funnel on port 8420.

## Tools (27 total)

### Filesystem (6)

| Tool | Purpose |
|------|---------|
| `list_directory` | List files/dirs, respects .gitignore |
| `read_file` | Read file contents |
| `write_file` | Write file (creates parent dirs) |
| `delete_file` | Delete file or empty directory |
| `search_files` | Search by string or regex |
| `get_file_info` | File metadata (size, modified) |

### Git (2)

| Tool | Purpose |
|------|---------|
| `git_status` | Branch, HEAD hash, changes, unpushed, remote HEAD, localMatchesRemote |
| `git_commit_push` | Stage, commit, and push |

### Build & Payload (3)

| Tool | Purpose |
|------|---------|
| `run_build` | Run `npm run build`, return last 100 lines of output |
| `payload_command` | Whitelisted Payload commands (generate:importmap, migrate:status) |
| `db_query` | Read-only SQL queries (SELECT, EXPLAIN, psql meta-commands) |
| `db_exec` | Write SQL (INSERT, UPDATE, DELETE, etc.) — requires confirm='EXECUTE' |

### Vercel CI/CD (9)

| Tool | Purpose |
|------|---------|
| `vercel_list` | List recent deployments with URLs, state, commit, branch |
| `vercel_inspect` | Full details for a deployment: build state, duration, routes |
| `vercel_logs` | Runtime logs for a deployment (auto-resolves latest prod URL) |
| `vercel_deploy` | Deploy from local — background process, returns job_id |
| `vercel_deploy_status` | Poll background deploy progress and output |
| `vercel_git` | Check GitHub integration status (repo, branch, auto-deploy) |
| `vercel_project` | Project settings and linked project config |
| `vercel_rollback` | Rollback production to a previous deployment |
| `vercel_env_list` | List environment variable names |

### Lambda (5)

| Tool | Purpose |
|------|---------|
| `lambda_status` | Deployed state, git hash, sync status for Lambda functions |
| `lambda_logs` | CloudWatch logs for a Lambda function |
| `deploy_lambda` | Deploy a Lambda function via deploy.sh |
| `verify_lambdas` | Verify all Lambdas match current HEAD |
| `trigger_pipeline` | Start scraper pipeline for an iTrvl URL |
| `pipeline_status` | Check Step Functions execution status |

## CI/CD Workflow

### Diagnosis

```
1. git_status          → Is local code committed and pushed?
2. vercel_list         → What's actually deployed? What commit?
3. vercel_inspect(url) → Did the build succeed? Any errors?
4. vercel_git          → Is GitHub auto-deploy connected?
5. vercel_logs(url)    → Runtime errors after deployment?
```

### Deployment

```
1. run_build           → Verify local build passes
2. git_commit_push     → Commit and push to GitHub
3. vercel_list         → Wait for GitHub auto-deploy, check status
   OR
3. vercel_deploy       → Manual deploy from local (background)
4. vercel_deploy_status → Poll until complete
5. vercel_inspect(url) → Verify deployment
```

### Rollback

```
1. vercel_list         → Find previous good deployment URL
2. vercel_rollback(url) → Rollback to it
```

## Setup

```bash
cd tools/mcp-server
pip install fastmcp
```

## Running

```bash
PROJECT_ROOT=~/Projects/kiuli-website python3 server.py
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_ROOT` | (required) | Project root directory |
| `PORT` | `8420` | Server port |
| `SERVER_NAME` | `Kiuli Files` | Server name in MCP |
| `MCP_PASSWORD` | (empty) | Enable OAuth if set |
| `MCP_SERVER_URL` | `https://grahams-macbook-air.tail2d6663.ts.net:8443` | OAuth server URL |
| `DATABASE_URL_UNPOOLED` | — | Database connection for db_query/db_exec |
| `POSTGRES_URL` | — | Fallback database connection |

## Security

- Path traversal blocked (all paths resolve within PROJECT_ROOT)
- Database writes require `confirm='EXECUTE'`
- Vercel deploys require `confirm='DEPLOY'`
- Vercel rollbacks require `confirm='ROLLBACK'`
- Payload commands are whitelisted
- Git operations require explicit file paths
- .gitignore respected for directory listings and searches
