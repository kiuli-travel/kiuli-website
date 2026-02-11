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

} // end registerTools

// ---------------------------------------------------------------------------
// Express + Streamable HTTP wiring
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

const sessions = {}; // sessionId → { transport, server }

// POST /mcp — main MCP endpoint (initialize + all JSON-RPC messages)
app.post(`${BASE_PATH}/mcp`, async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];

  try {
    // Existing session — route to its transport
    if (sessionId && sessions[sessionId]) {
      await sessions[sessionId].transport.handleRequest(req, res, req.body);
      return;
    }

    // New session — must be an InitializeRequest
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

    // Bad request — no session and not an initialize
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

// GET /mcp — SSE stream for server-initiated messages
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

// DELETE /mcp — session termination
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

// Health check
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
