import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import ignore from "ignore";
import { execFile, exec } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

// ---------------------------------------------------------------------------
// Config — all from environment variables
// ---------------------------------------------------------------------------
const PROJECT_ROOT = path.resolve(
  process.env.PROJECT_ROOT || "/Users/grahamwallington/Projects/kiuli-website"
);
const PORT = parseInt(process.env.PORT || "3200", 10);
const BASE_PATH = (process.env.BASE_PATH || "").replace(/\/$/, "");
const SERVER_NAME = process.env.SERVER_NAME || "Kiuli Filesystem Server";

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------
function safePath(relativePath) {
  const resolved = path.resolve(PROJECT_ROOT, relativePath);
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error(`Path traversal blocked: ${relativePath}`);
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// .gitignore support
// ---------------------------------------------------------------------------
async function loadGitignore() {
  const ig = ignore();
  try {
    const content = await fs.readFile(
      path.join(PROJECT_ROOT, ".gitignore"),
      "utf-8"
    );
    ig.add(content);
  } catch {
    /* No .gitignore */
  }
  ig.add([".git", "node_modules"]);
  return ig;
}

// ---------------------------------------------------------------------------
// Git helper
// ---------------------------------------------------------------------------
async function runGit(args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd: cwd || PROJECT_ROOT,
      timeout: 30000,
    });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return {
      ok: false,
      stdout: (err.stdout || "").trim(),
      stderr: (err.stderr || err.message || "").trim(),
      code: err.code,
    };
  }
}

// ---------------------------------------------------------------------------
// Tool registration — called once per SSE connection on a fresh McpServer
// ---------------------------------------------------------------------------
function registerTools(srv) {

// -- list_directory ---------------------------------------------------------
srv.tool(
  "list_directory",
  "List files and subdirectories. Respects .gitignore.",
  {
    path: z.string().default(".").describe("Relative path (default: root)"),
    recursive: z.boolean().default(false).describe("If true, list recursively"),
  },
  async ({ path: relPath, recursive }) => {
    const absPath = safePath(relPath);
    const ig = await loadGitignore();
    async function listDir(dir, prefix = "") {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      let results = [];
      for (const entry of entries) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (ig.ignores(rel)) continue;
        results.push({
          name: entry.name,
          path: rel,
          type: entry.isDirectory() ? "directory" : "file",
        });
        if (recursive && entry.isDirectory()) {
          results = results.concat(
            await listDir(path.join(dir, entry.name), rel)
          );
        }
      }
      return results;
    }
    return {
      content: [
        { type: "text", text: JSON.stringify(await listDir(absPath), null, 2) },
      ],
    };
  }
);

// -- read_file --------------------------------------------------------------
srv.tool(
  "read_file",
  "Read file contents.",
  {
    path: z.string().describe("Relative path to file"),
  },
  async ({ path: relPath }) => {
    return {
      content: [
        { type: "text", text: await fs.readFile(safePath(relPath), "utf-8") },
      ],
    };
  }
);

// -- write_file -------------------------------------------------------------
srv.tool(
  "write_file",
  "Write content to file. Creates parent directories.",
  {
    path: z.string().describe("Relative path"),
    content: z.string().describe("Content to write"),
  },
  async ({ path: relPath, content }) => {
    const absPath = safePath(relPath);
    await fs.mkdir(path.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, content, "utf-8");
    return {
      content: [
        {
          type: "text",
          text: `Written ${content.length} bytes to ${relPath}`,
        },
      ],
    };
  }
);

// -- delete_file ------------------------------------------------------------
srv.tool(
  "delete_file",
  "Delete a file or empty directory.",
  {
    path: z.string().describe("Relative path to delete"),
  },
  async ({ path: relPath }) => {
    const absPath = safePath(relPath);
    const stat = await fs.stat(absPath);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(absPath);
      if (entries.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                deleted: false,
                reason: `Directory not empty (${entries.length} items)`,
                path: relPath,
              }),
            },
          ],
        };
      }
      await fs.rmdir(absPath);
    } else {
      await fs.unlink(absPath);
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            deleted: true,
            path: relPath,
            type: stat.isDirectory() ? "directory" : "file",
          }),
        },
      ],
    };
  }
);

// -- search_files -----------------------------------------------------------
srv.tool(
  "search_files",
  "Search file contents by regex or string.",
  {
    pattern: z.string().describe("Search pattern"),
    is_regex: z.boolean().default(false).describe("Treat as regex"),
    max_results: z.number().int().default(100).describe("Max matches"),
  },
  async ({ pattern, is_regex, max_results }) => {
    const ig = await loadGitignore();
    const regex = is_regex
      ? new RegExp(pattern, "gi")
      : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const results = [];

    async function searchDir(dir, prefix = "") {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= max_results) return;
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (ig.ignores(rel)) continue;
        if (entry.isDirectory()) {
          await searchDir(path.join(dir, entry.name), rel);
        } else {
          try {
            const content = await fs.readFile(
              path.join(dir, entry.name),
              "utf-8"
            );
            const lines = content.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= max_results) return;
              if (regex.test(lines[i])) {
                results.push({
                  file: rel,
                  line: i + 1,
                  text: lines[i].trim().substring(0, 200),
                });
              }
              regex.lastIndex = 0;
            }
          } catch {
            /* skip binary */
          }
        }
      }
    }

    await searchDir(PROJECT_ROOT);
    return {
      content: [
        {
          type: "text",
          text:
            results.length > 0
              ? JSON.stringify(results, null, 2)
              : "No matches found",
        },
      ],
    };
  }
);

// -- get_file_info ----------------------------------------------------------
srv.tool(
  "get_file_info",
  "Return file metadata.",
  {
    path: z.string().describe("Relative path"),
  },
  async ({ path: relPath }) => {
    const stat = await fs.stat(safePath(relPath));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              path: relPath,
              type: stat.isDirectory() ? "directory" : "file",
              size: stat.size,
              modified: stat.mtime.toISOString(),
              created: stat.birthtime.toISOString(),
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- git_status -------------------------------------------------------------
srv.tool(
  "git_status",
  "Show git status: branch, changes, unpushed commits.",
  {},
  async () => {
    const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (!branch.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              is_git_repo: false,
              error: branch.stderr,
            }),
          },
        ],
      };
    }
    const status = await runGit(["status", "--porcelain"]);
    const describe = await runGit(["describe", "--tags", "--always"]);
    const unpushed = await runGit([
      "log",
      "--oneline",
      `origin/${branch.stdout}..HEAD`,
    ]);
    const lastCommit = await runGit(["log", "-1", "--format=%H %s"]);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              is_git_repo: true,
              branch: branch.stdout,
              describe: describe.ok ? describe.stdout : null,
              clean: status.ok && status.stdout === "",
              uncommitted: status.ok
                ? status.stdout.split("\n").filter((l) => l)
                : [],
              unpushed_count: unpushed.ok
                ? unpushed.stdout.split("\n").filter((l) => l).length
                : 0,
              unpushed_commits: unpushed.ok ? unpushed.stdout : null,
              last_commit: lastCommit.ok ? lastCommit.stdout : null,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- git_commit_push --------------------------------------------------------
srv.tool(
  "git_commit_push",
  "Stage, commit, and push.",
  {
    files: z.array(z.string()).describe("Files to stage"),
    message: z.string().describe("Commit message"),
    push: z.boolean().default(true).describe("Push after commit"),
  },
  async ({ files, message, push }) => {
    const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (!branch.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              committed: false,
              pushed: false,
              error: "Not a git repository",
            }),
          },
        ],
      };
    }

    // Validate all paths
    for (const f of files) {
      try {
        safePath(f);
      } catch (err) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                committed: false,
                pushed: false,
                error: err.message,
              }),
            },
          ],
        };
      }
    }

    const add = await runGit(["add", ...files]);
    if (!add.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              committed: false,
              pushed: false,
              error: `git add failed: ${add.stderr}`,
            }),
          },
        ],
      };
    }

    const commit = await runGit(["commit", "-m", message]);
    if (!commit.ok) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              committed: false,
              pushed: false,
              error: `git commit failed: ${commit.stderr}`,
              stdout: commit.stdout,
            }),
          },
        ],
      };
    }

    const hash = await runGit(["rev-parse", "--short", "HEAD"]);

    let pushed = false;
    let pushOutput = null;
    if (push) {
      const p = await runGit(["push", "origin", branch.stdout]);
      pushed = p.ok;
      pushOutput = pushed ? p.stdout || p.stderr : p.stderr;
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              committed: true,
              commit_hash: hash.ok ? hash.stdout : "unknown",
              commit_message: message,
              files_staged: files,
              pushed,
              push_output: pushOutput,
              branch: branch.stdout,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- run_build --------------------------------------------------------------
srv.tool(
  "run_build",
  "Run npm run build and return output. Timeout: 300s.",
  {},
  async () => {
    try {
      const { stdout, stderr } = await execAsync("npm run build 2>&1", {
        cwd: PROJECT_ROOT,
        timeout: 300000,
        maxBuffer: 1024 * 1024 * 5, // 5MB
        env: { ...process.env, NODE_ENV: "production" },
      });
      const output = (stdout + "\n" + stderr).trim();
      const success = !output.includes("Build error") && !output.includes("Failed to compile");
      // Return last 100 lines to keep response manageable
      const lines = output.split("\n");
      const tail = lines.slice(-100).join("\n");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success,
              total_lines: lines.length,
              output: tail,
            }),
          },
        ],
      };
    } catch (err) {
      const output = (err.stdout || "") + "\n" + (err.stderr || err.message || "");
      const lines = output.trim().split("\n");
      const tail = lines.slice(-100).join("\n");
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              total_lines: lines.length,
              output: tail,
              exit_code: err.code,
            }),
          },
        ],
      };
    }
  }
);

// -- payload_command ---------------------------------------------------------
srv.tool(
  "payload_command",
  "Run whitelisted Payload CMS commands: generate:importmap, migrate:status. Returns output.",
  {
    command: z
      .enum(["generate:importmap", "migrate:status"])
      .describe("Payload command to run"),
  },
  async ({ command }) => {
    const allowedCommands = {
      "generate:importmap": "npx payload generate:importmap",
      "migrate:status": "npx payload migrate:status",
    };

    const cmd = allowedCommands[command];
    if (!cmd) {
      return {
        content: [
          { type: "text", text: JSON.stringify({ error: "Command not allowed" }) },
        ],
      };
    }

    try {
      const { stdout, stderr } = await execAsync(`${cmd} 2>&1`, {
        cwd: PROJECT_ROOT,
        timeout: 60000,
        maxBuffer: 1024 * 1024,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              command,
              success: true,
              output: (stdout + "\n" + stderr).trim(),
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              command,
              success: false,
              output: ((err.stdout || "") + "\n" + (err.stderr || err.message || "")).trim(),
              exit_code: err.code,
            }),
          },
        ],
      };
    }
  }
);

// -- db_query ---------------------------------------------------------------
srv.tool(
  "db_query",
  "Run a READ-ONLY SQL query against the database. Uses DATABASE_URL_UNPOOLED or POSTGRES_URL. SELECT and \\d commands only.",
  {
    query: z.string().describe("SQL query (SELECT only) or psql meta-command (\\d, \\dt, \\di)"),
  },
  async ({ query }) => {
    const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL;
    if (!dbUrl) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "No database URL configured (DATABASE_URL_UNPOOLED or POSTGRES_URL)",
            }),
          },
        ],
      };
    }

    // Safety: only allow SELECT, WITH (CTEs), and psql meta-commands
    const trimmed = query.trim().toUpperCase();
    const isSelect = trimmed.startsWith("SELECT") || trimmed.startsWith("WITH");
    const isMeta = query.trim().startsWith("\\");
    const isExplain = trimmed.startsWith("EXPLAIN");

    if (!isSelect && !isMeta && !isExplain) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "Only SELECT queries, EXPLAIN, and psql meta-commands (\\d, \\dt, \\di) are allowed",
            }),
          },
        ],
      };
    }

    try {
      const { stdout, stderr } = await execAsync(
        `psql "${dbUrl}" -c ${JSON.stringify(query)}`,
        {
          cwd: PROJECT_ROOT,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        }
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              output: (stdout + "\n" + stderr).trim(),
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              output: ((err.stdout || "") + "\n" + (err.stderr || err.message || "")).trim(),
            }),
          },
        ],
      };
    }
  }
);

// -- db_exec ----------------------------------------------------------------
srv.tool(
  "db_exec",
  "Run a WRITE SQL statement against the database. Supports INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, DROP TABLE. Use db_query for SELECT. Requires confirm='EXECUTE' to prevent accidents.",
  {
    sql: z.string().describe("SQL statement to execute (INSERT, UPDATE, DELETE, CREATE, ALTER, DROP)"),
    confirm: z.string().describe("Must be exactly 'EXECUTE' to proceed — prevents accidental writes"),
  },
  async ({ sql, confirm }) => {
    if (confirm !== "EXECUTE") {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            executed: false,
            error: "confirm must be exactly 'EXECUTE'. Got: " + confirm,
          }),
        }],
      };
    }

    const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL;
    if (!dbUrl) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: "No database URL configured (DATABASE_URL_UNPOOLED or POSTGRES_URL)",
          }),
        }],
      };
    }

    // Block SELECT — use db_query for reads
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("SELECT") || trimmed.startsWith("WITH") || trimmed.startsWith("EXPLAIN")) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            executed: false,
            error: "Use db_query for SELECT/WITH/EXPLAIN statements",
          }),
        }],
      };
    }

    try {
      const { stdout, stderr } = await execAsync(
        `psql "${dbUrl}" -c ${JSON.stringify(sql)}`,
        {
          cwd: PROJECT_ROOT,
          timeout: 30000,
          maxBuffer: 1024 * 1024,
        }
      );
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            executed: true,
            output: (stdout + "\n" + stderr).trim(),
          }),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            executed: false,
            output: ((err.stdout || "") + "\n" + (err.stderr || err.message || "")).trim(),
          }),
        }],
      };
    }
  }
);

// -- vercel_env_list --------------------------------------------------------
srv.tool(
  "vercel_env_list",
  "List Vercel environment variable names (not values) for the project.",
  {},
  async () => {
    try {
      const { stdout, stderr } = await execAsync("vercel env ls 2>&1", {
        cwd: PROJECT_ROOT,
        timeout: 30000,
      });
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              output: (stdout + "\n" + stderr).trim(),
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              output: ((err.stdout || "") + "\n" + (err.stderr || err.message || "")).trim(),
            }),
          },
        ],
      };
    }
  }
);

// -- lambda_status ----------------------------------------------------------
srv.tool(
  "lambda_status",
  "Get deployed status for Kiuli Lambda functions from AWS. Returns State, LastModified, CodeSize, and the git hash stamped in Description by deploy.sh. syncStatus shows CURRENT/BEHIND/NO_HASH_STAMPED for each function. This is the authoritative check — source code in git means nothing until this shows CURRENT.",
  {
    function: z
      .enum(["all", "scraper", "orchestrator", "image-processor", "labeler", "finalizer", "video-processor"])
      .default("all")
      .describe("Which function to check. Default: all"),
  },
  async ({ function: fn }) => {
    const FUNCTION_MAP = {
      scraper:           "kiuli-scraper",
      orchestrator:      "kiuli-v6-orchestrator",
      "image-processor": "kiuli-v6-image-processor",
      labeler:           "kiuli-v6-labeler",
      finalizer:         "kiuli-v6-finalizer",
      "video-processor": "kiuli-v6-video-processor",
    };

    const targets = fn === "all"
      ? Object.entries(FUNCTION_MAP)
      : [[fn, FUNCTION_MAP[fn]]];

    const results = {};
    for (const [key, name] of targets) {
      try {
        const { stdout } = await execAsync(
          `aws lambda get-function-configuration --function-name ${name} --region eu-north-1 ` +
          `--query '{State:State,LastModified:LastModified,CodeSize:CodeSize,Description:Description}' --output json`,
          { timeout: 20000 }
        );
        const data = JSON.parse(stdout.trim());
        const hashMatch = (data.Description || "").match(/git:([a-f0-9]+)/);
        data.deployedGitHash = hashMatch ? hashMatch[1] : null;
        results[key] = data;
      } catch (err) {
        results[key] = {
          error: ((err.stdout || "") + " " + (err.stderr || err.message || "")).trim(),
        };
      }
    }

    const headResult = await runGit(["log", "-1", "--format=%h %s"]);
    const currentHash = await runGit(["rev-parse", "--short", "HEAD"]);

    const syncStatus = {};
    for (const [key, data] of Object.entries(results)) {
      if (data.error) {
        syncStatus[key] = "ERROR";
      } else if (!data.deployedGitHash) {
        syncStatus[key] = "NO_HASH_STAMPED — run deploy.sh to stamp";
      } else if (data.deployedGitHash === currentHash.stdout) {
        syncStatus[key] = "CURRENT";
      } else {
        syncStatus[key] = `BEHIND — deployed: ${data.deployedGitHash}, head: ${currentHash.stdout}`;
      }
    }

    const allCurrent = Object.values(syncStatus).every(s => s === "CURRENT");

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          currentHead: currentHash.stdout,
          currentCommit: headResult.stdout,
          allCurrent,
          syncStatus,
          functions: results,
        }, null, 2),
      }],
    };
  }
);

// -- lambda_logs ------------------------------------------------------------
srv.tool(
  "lambda_logs",
  "Tail recent CloudWatch logs for a Kiuli Lambda function. Use after a test scrape to confirm new code executed. Filter by keyword to find specific log lines.",
  {
    function: z
      .enum(["scraper", "orchestrator", "image-processor", "labeler", "finalizer", "video-processor"])
      .describe("Which Lambda function's logs to retrieve"),
    since: z
      .string()
      .default("10m")
      .describe("How far back to look. Examples: '5m', '30m', '1h'. Default: 10m"),
    filter: z
      .string()
      .optional()
      .describe("Optional keyword to filter log lines. Case-insensitive."),
  },
  async ({ function: fn, since, filter }) => {
    const FUNCTION_MAP = {
      scraper:           "kiuli-scraper",
      orchestrator:      "kiuli-v6-orchestrator",
      "image-processor": "kiuli-v6-image-processor",
      labeler:           "kiuli-v6-labeler",
      finalizer:         "kiuli-v6-finalizer",
      "video-processor": "kiuli-v6-video-processor",
    };

    const name = FUNCTION_MAP[fn];
    const logGroup = `/aws/lambda/${name}`;

    let cmd = `aws logs tail ${logGroup} --since ${since} --region eu-north-1 --format short 2>&1`;
    if (filter) {
      cmd += ` | grep -i ${JSON.stringify(filter)} || true`;
    }

    try {
      const { stdout } = await execAsync(cmd, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 2,
      });
      const output = stdout.trim();
      const lines = output ? output.split("\n") : [];
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            function: name,
            logGroup,
            since,
            filter: filter || null,
            lineCount: lines.length,
            output: output || "(no logs in this time window)",
          }, null, 2),
        }],
      };
    } catch (err) {
      const output = ((err.stdout || "") + (err.stderr || "")).trim();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            function: name,
            logGroup,
            since,
            filter: filter || null,
            lineCount: 0,
            output: output || "(error retrieving logs)",
            error: err.message,
          }, null, 2),
        }],
      };
    }
  }
);

// -- deploy_lambda ----------------------------------------------------------
srv.tool(
  "deploy_lambda",
  "Deploy a Kiuli Lambda function using deploy.sh. Syncs shared modules, installs deps, packages, uploads (S3 for large zips), stamps git hash, and verifies. Returns full output.",
  {
    function: z
      .enum(["scraper", "orchestrator", "image-processor", "labeler", "finalizer", "video-processor"])
      .describe("Which Lambda function to deploy"),
  },
  async ({ function: fn }) => {
    const scriptPath = path.join(PROJECT_ROOT, "lambda", "scripts", "deploy.sh");
    try {
      const { stdout, stderr } = await execAsync(`bash ${scriptPath} ${fn} 2>&1`, {
        cwd: PROJECT_ROOT,
        timeout: 300000, // 5 minutes — npm ci + zip + upload takes time
        maxBuffer: 1024 * 1024 * 5,
        env: { ...process.env, PATH: process.env.PATH },
      });
      const output = (stdout + "\n" + stderr).trim();
      const success = output.includes("DEPLOYMENT SUCCESSFUL");
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ function: fn, success, output }, null, 2),
        }],
      };
    } catch (err) {
      const output = ((err.stdout || "") + "\n" + (err.stderr || err.message || "")).trim();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            function: fn,
            success: false,
            output,
            exit_code: err.code,
          }, null, 2),
        }],
      };
    }
  }
);

// -- verify_lambdas ---------------------------------------------------------
srv.tool(
  "verify_lambdas",
  "Run verify.sh to check all 6 Lambda functions are deployed at current git HEAD. Returns CURRENT/BEHIND/ERROR for each.",
  {},
  async () => {
    const scriptPath = path.join(PROJECT_ROOT, "lambda", "scripts", "verify.sh");
    try {
      const { stdout, stderr } = await execAsync(`bash ${scriptPath} 2>&1`, {
        cwd: PROJECT_ROOT,
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, PATH: process.env.PATH },
      });
      const output = (stdout + "\n" + stderr).trim();
      const allCurrent = output.includes("All functions verified at HEAD");
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ allCurrent, output }, null, 2),
        }],
      };
    } catch (err) {
      const output = ((err.stdout || "") + "\n" + (err.stderr || err.message || "")).trim();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ allCurrent: false, output, exit_code: err.code }, null, 2),
        }],
      };
    }
  }
);

// -- trigger_pipeline -------------------------------------------------------
srv.tool(
  "trigger_pipeline",
  "Start the Kiuli scraper Step Functions pipeline for an iTrvl URL. Returns the execution ARN for tracking with pipeline_status.",
  {
    itrvl_url: z.string().describe("Full iTrvl itinerary URL to scrape"),
    execution_name: z.string().optional().describe("Optional custom execution name. Auto-generated if omitted."),
  },
  async ({ itrvl_url, execution_name }) => {
    const STATE_MACHINE_ARN = "arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline";
    const name = execution_name || `scrape-${Date.now()}`;
    const input = JSON.stringify({ itrvlUrl: itrvl_url });

    try {
      const { stdout } = await execAsync(
        `aws stepfunctions start-execution ` +
        `--state-machine-arn ${STATE_MACHINE_ARN} ` +
        `--name ${JSON.stringify(name)} ` +
        `--input ${JSON.stringify(input)} ` +
        `--region eu-north-1 --output json`,
        { timeout: 30000 }
      );
      const result = JSON.parse(stdout.trim());
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            started: true,
            executionArn: result.executionArn,
            startDate: result.startDate,
            name,
            itrvlUrl: itrvl_url,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            started: false,
            error: ((err.stdout || "") + " " + (err.stderr || err.message || "")).trim(),
          }, null, 2),
        }],
      };
    }
  }
);

// -- pipeline_status --------------------------------------------------------
srv.tool(
  "pipeline_status",
  "Check status of a Step Functions pipeline execution. Use after trigger_pipeline to monitor progress. Also lists recent executions if no ARN provided.",
  {
    execution_arn: z.string().optional().describe("Execution ARN from trigger_pipeline. If omitted, lists recent executions."),
  },
  async ({ execution_arn }) => {
    const STATE_MACHINE_ARN = "arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline";

    if (!execution_arn) {
      // List recent executions
      try {
        const { stdout } = await execAsync(
          `aws stepfunctions list-executions ` +
          `--state-machine-arn ${STATE_MACHINE_ARN} ` +
          `--max-results 10 ` +
          `--region eu-north-1 --output json`,
          { timeout: 30000 }
        );
        const data = JSON.parse(stdout.trim());
        const executions = (data.executions || []).map(e => ({
          name: e.name,
          status: e.status,
          startDate: e.startDate,
          stopDate: e.stopDate || null,
          executionArn: e.executionArn,
        }));
        return {
          content: [{
            type: "text",
            text: JSON.stringify({ mode: "list", executions }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              mode: "list",
              error: ((err.stdout || "") + " " + (err.stderr || err.message || "")).trim(),
            }, null, 2),
          }],
        };
      }
    }

    // Describe specific execution
    try {
      const { stdout } = await execAsync(
        `aws stepfunctions describe-execution ` +
        `--execution-arn ${JSON.stringify(execution_arn)} ` +
        `--region eu-north-1 --output json`,
        { timeout: 30000 }
      );
      const data = JSON.parse(stdout.trim());

      // Also get execution history for the last few events
      let recentEvents = [];
      try {
        const { stdout: histStdout } = await execAsync(
          `aws stepfunctions get-execution-history ` +
          `--execution-arn ${JSON.stringify(execution_arn)} ` +
          `--reverse-order --max-results 10 ` +
          `--region eu-north-1 --output json`,
          { timeout: 30000 }
        );
        const histData = JSON.parse(histStdout.trim());
        recentEvents = (histData.events || []).map(e => ({
          type: e.type,
          timestamp: e.timestamp,
          id: e.id,
        }));
      } catch { /* history optional */ }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            mode: "detail",
            name: data.name,
            status: data.status,
            startDate: data.startDate,
            stopDate: data.stopDate || null,
            input: data.input ? JSON.parse(data.input) : null,
            output: data.output ? JSON.parse(data.output) : null,
            error: data.error || null,
            cause: data.cause || null,
            recentEvents,
          }, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            mode: "detail",
            error: ((err.stdout || "") + " " + (err.stderr || err.message || "")).trim(),
          }, null, 2),
        }],
      };
    }
  }
);

// -- vercel_deploy ----------------------------------------------------------
srv.tool(
  "vercel_deploy",
  "Deploy Kiuli website to Vercel production. Runs 'vercel --prod' and returns the deployment URL. Always run run_build first to catch errors locally.",
  {
    confirm: z.string().describe("Must be exactly 'DEPLOY' to proceed — prevents accidental deployments"),
  },
  async ({ confirm }) => {
    if (confirm !== "DEPLOY") {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            deployed: false,
            error: "confirm must be exactly 'DEPLOY'. Got: " + confirm,
          }),
        }],
      };
    }

    try {
      const { stdout, stderr } = await execAsync("vercel --prod --yes 2>&1", {
        cwd: PROJECT_ROOT,
        timeout: 600000, // 10 minutes
        maxBuffer: 1024 * 1024 * 5,
      });
      const output = (stdout + "\n" + stderr).trim();
      // Extract deployment URL from output
      const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
      const prodMatch = output.match(/Production:\s+(https:\/\/[^\s]+)/);
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            deployed: true,
            url: prodMatch ? prodMatch[1] : (urlMatch ? urlMatch[0] : null),
            output,
          }, null, 2),
        }],
      };
    } catch (err) {
      const output = ((err.stdout || "") + "\n" + (err.stderr || err.message || "")).trim();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            deployed: false,
            output,
            exit_code: err.code,
          }, null, 2),
        }],
      };
    }
  }
);

// -- vercel_logs ------------------------------------------------------------
srv.tool(
  "vercel_logs",
  "Fetch recent Vercel production logs. Use after deployment or when debugging production issues.",
  {
    since: z.string().default("1h").describe("How far back. Examples: '30m', '1h', '6h'. Default: 1h"),
    filter: z.string().optional().describe("Optional keyword to filter (e.g. 'error', '500', 'api/scrape')"),
  },
  async ({ since, filter }) => {
    let cmd = `vercel logs production --since ${since} 2>&1`;
    if (filter) {
      cmd += ` | grep -i ${JSON.stringify(filter)} || true`;
    }

    try {
      const { stdout } = await execAsync(cmd, {
        cwd: PROJECT_ROOT,
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 2,
      });
      const output = stdout.trim();
      const lines = output ? output.split("\n") : [];
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            since,
            filter: filter || null,
            lineCount: lines.length,
            output: output || "(no logs in this time window)",
          }, null, 2),
        }],
      };
    } catch (err) {
      const output = ((err.stdout || "") + (err.stderr || "")).trim();
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            since,
            filter: filter || null,
            lineCount: 0,
            output: output || "(error retrieving logs)",
            error: err.message,
          }, null, 2),
        }],
      };
    }
  }
);

} // end registerTools

// ---------------------------------------------------------------------------
// Express + Streamable HTTP wiring
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

const sessions = {}; // sessionId → { transport, server }

app.post(`${BASE_PATH}/mcp`, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  try {
    if (sessionId && sessions[sessionId]) {
      await sessions[sessionId].transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          sessions[sid] = { transport, server: srv };
          console.log(`Session ${sid} initialized (${Object.keys(sessions).length} active)`);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions[sid]) {
          console.log(`Session ${sid} closed`);
          delete sessions[sid];
        }
      };

      const srv = new McpServer({ name: SERVER_NAME, version: "2.0.0" });
      registerTools(srv);
      await srv.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID provided" },
      id: null,
    });
  } catch (error) {
    console.error("Error handling POST /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.get(`${BASE_PATH}/mcp`, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Invalid or missing session ID" },
      id: null,
    });
    return;
  }
  await sessions[sessionId].transport.handleRequest(req, res);
});

app.delete(`${BASE_PATH}/mcp`, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Invalid or missing session ID" },
      id: null,
    });
    return;
  }
  await sessions[sessionId].transport.handleRequest(req, res);
});

app.get(`${BASE_PATH}/health`, (_req, res) => {
  res.json({
    status: "ok",
    server: SERVER_NAME,
    project_root: PROJECT_ROOT,
    sessions: Object.keys(sessions).length,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`${SERVER_NAME} listening on http://0.0.0.0:${PORT}`);
  console.log(`  MCP endpoint:  http://localhost:${PORT}${BASE_PATH}/mcp`);
  console.log(`  Health:        http://localhost:${PORT}${BASE_PATH}/health`);
  console.log(`  Project root:  ${PROJECT_ROOT}`);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  for (const id of Object.keys(sessions)) {
    try {
      await sessions[id].transport.close();
    } catch {}
    try {
      await sessions[id].server.close();
    } catch {}
    delete sessions[id];
  }
  process.exit(0);
});
