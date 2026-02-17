# Phase A: Clean Git State and Verify Infrastructure

**Context:** The Content Engine build has dirty git state and infrastructure claims that need mechanistic verification before proceeding. This is audit-only except for git cleanup.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Do not fix any application code.** This phase is audit and git cleanup only.
2. **Every finding must be raw data** — SQL query output, curl responses, file contents. Not summaries.
3. **If a test fails, report the failure and stop.** Do not attempt repairs.
4. **Write your report as you go** to `content-engine/reports/phaseA-clean-and-verify.md`.
5. **The report must contain the raw output of every command you run.** Not paraphrased.
6. **Do not skip any query, test, or step.** Do not summarise. Do not paraphrase.
7. **Do not proceed past a failed gate.** Stop and report.

---

## Task 1: Git Cleanup

The working tree has tracked modified files, untracked project files, and tracked runtime artifacts that should never have been tracked. All three categories need different handling.

### Step 1.1: Add entries to `.gitignore`

Append these exact lines to the end of `.gitignore`:

```
# Runtime logs
tools/mcp-server/server.log
tools/mcp-server/server-error.log
tools/mcp-filesystem-server/

# Build cache
tsconfig.tsbuildinfo

# Env check file (contains secrets)
.env.vercel-check
```

### Step 1.2: Untrack runtime/build artifacts

These files are currently tracked by git but should not be. Remove them from git tracking WITHOUT deleting the files from disk:

```bash
git rm --cached tools/mcp-server/server.log
git rm --cached tsconfig.tsbuildinfo
```

If `tools/mcp-server/server-error.log` is also tracked, run `git rm --cached tools/mcp-server/server-error.log` as well.

### Step 1.3: Stage project files

Stage all of these — they are project content that belongs in the repo:

```bash
# Modified tracked files (project content)
git add content-engine/prompts/phase2.5-bootstrap-embeddings.md
git add content-engine/reports/phase1-db-reconciliation.md
git add content-engine/reports/phase4-embeddings-engine.md
git add src/payload-types.ts

# Untracked project content
git add content-engine/evidence/
git add content-engine/prompts/fix-auth-bypass.md
git add content-engine/prompts/phase11-execute-and-verify.md
git add content-engine/prompts/phase11-gap-closure.md
git add content-engine/prompts/phase11-mechanism-verification.md
git add content-engine/prompts/phase4-verify-all-types.md
git add content-engine/prompts/phase8-research-source-monitor.md
git add content-engine/prompts/phaseA-clean-and-verify.md

# The .gitignore changes themselves
git add .gitignore
```

Do NOT stage:
- `.env.vercel-check` (now gitignored)
- `tools/mcp-filesystem-server/` (now gitignored)
- `tools/mcp-server/server.log` (now untracked and gitignored)
- `tsconfig.tsbuildinfo` (now untracked and gitignored)

### Step 1.4: Commit and push

```bash
git commit -m "chore: clean git state — commit evidence/prompts/reports, untrack runtime artifacts"
git push
```

### Step 1.5: Verify clean state

```bash
git status
```

**Expected output:** `nothing to commit, working tree clean` — with no modified tracked files and no untracked files that aren't gitignored.

If `git status` still shows ANY modified tracked files or ANY untracked files that are not covered by `.gitignore`, the gate fails. Record what remains and STOP.

### Gate 1: Git Clean

```
PASS criteria: `git status` output shows "nothing to commit, working tree clean"
FAIL action: Record the remaining dirty files and STOP. Do not proceed.
```

---

## Task 2: Database Infrastructure Verification

Run these EXACT queries against the production database. Record the FULL raw output of each in the report.

### 2a: Content projects by stage

```sql
SELECT stage, COUNT(*) FROM content_projects GROUP BY stage ORDER BY count DESC;
```

### 2b: Draft/review/published project detail

```sql
SELECT id, content_type, stage, processing_status,
  body IS NOT NULL AS has_body,
  sections IS NOT NULL AS has_sections,
  meta_title IS NOT NULL AS has_meta_title,
  answer_capsule IS NOT NULL AS has_capsule
FROM content_projects
WHERE stage IN ('draft', 'review', 'published')
ORDER BY id;
```

### 2c: Ghost completions

Projects where `processing_status = 'completed'` but are at a stage that implies content should exist (`draft` or `review`) and have no content. This is the specific query — do not modify it:

```sql
SELECT id, content_type, title, stage, processing_status,
  body IS NOT NULL AS has_body,
  sections IS NOT NULL AS has_sections,
  (sections IS NOT NULL AND sections::text NOT IN ('{}', 'null', '""')) AS has_real_sections
FROM content_projects
WHERE processing_status = 'completed'
  AND stage IN ('draft', 'review')
  AND body IS NULL
  AND (sections IS NULL OR sections::text IN ('{}', 'null', '""'));
```

This query filters to `draft` and `review` stages only. Projects at `research` stage with `processing_status = 'completed'` are NOT ghost completions — they completed research, not drafting.

### 2d: Content jobs health

```sql
SELECT job_type, status, COUNT(*) FROM content_jobs GROUP BY job_type, status ORDER BY job_type, status;
```

### 2e: Embedding store health

```sql
SELECT chunk_type, COUNT(*) AS chunks,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) AS with_embedding
FROM content_embeddings
GROUP BY chunk_type;
```

### 2f: BrandVoice populated

```sql
SELECT voice_summary IS NOT NULL AS has_summary,
  audience IS NOT NULL AS has_audience,
  updated_at
FROM brand_voice;
```

### 2g: Banned phrases count

```sql
SELECT COUNT(*) FROM brand_voice_banned_phrases;
```

### 2h: Source registry entries

```sql
SELECT id, name, category, active, last_checked_at FROM source_registry;
```

### 2i: FAQ items per project (for projects at draft/review/published)

```sql
SELECT f._parent_id, COUNT(*) AS faq_count
FROM content_projects_faq_section f
JOIN content_projects cp ON cp.id = f._parent_id
WHERE cp.stage IN ('draft', 'review', 'published')
GROUP BY f._parent_id;
```

### 2j: Itinerary state

```sql
SELECT COUNT(*) AS total,
  COUNT(CASE WHEN _status = 'published' THEN 1 END) AS published
FROM itineraries;
```

### Gate 2: Database Audit Recorded

```
PASS criteria: All 10 query results (2a through 2j) are in the report with raw output. No results are summarised or paraphrased.
FAIL action: If any query errors (bad column name, table not found), record the exact error. That error IS the finding — do not retry with a different query.
```

---

## Task 3: API Route Smoke Test

Test each content API route. The goal is to confirm the route EXISTS (returns any status code except 404). We are not testing correctness — just reachability.

Run each curl command. Record the HTTP status code for each.

```bash
# 3a: Test connection
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com/api/content/test-connection

# 3b: Dashboard
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com/api/content/dashboard

# 3c: Dashboard batch
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/dashboard/batch -H "Content-Type: application/json" -d '{"action":"test"}'

# 3d: Draft
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/draft -H "Content-Type: application/json" -d '{"projectId":999999}'

# 3e: Cascade
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/cascade -H "Content-Type: application/json" -d '{}'

# 3f: Research
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/research -H "Content-Type: application/json" -d '{}'

# 3g: Conversation
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/conversation -H "Content-Type: application/json" -d '{}'

# 3h: Embed
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/embed -H "Content-Type: application/json" -d '{}'

# 3i: Decompose
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/decompose -H "Content-Type: application/json" -d '{}'

# 3j: Source monitor
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/source-monitor -H "Content-Type: application/json" -d '{}'

# 3k: Jobs
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com/api/content/jobs
```

### Gate 3: All Routes Reachable

```
PASS criteria: Zero 404 responses across all 11 tests. Any other status code (200, 400, 401, 500) proves the route exists.
FAIL action: Record which route(s) returned 404. That means the route file is missing or not deployed. STOP.
```

---

## Task 4: Identify Ghost Completions

Using the results from query 2c, list every ghost completion project. For each one:

1. Record id, title, content_type, stage

2. Count its conversation messages:
```sql
SELECT COUNT(*) FROM content_projects_messages WHERE _parent_id = [ID];
```

3. Count its FAQ items:
```sql
SELECT COUNT(*) FROM content_projects_faq_section WHERE _parent_id = [ID];
```

4. Write (but DO NOT EXECUTE) the reset query:
```sql
-- PENDING GRAHAM APPROVAL — do not execute
UPDATE content_projects
SET processing_status = 'idle', processing_error = NULL, processing_started_at = NULL
WHERE id = [ID];
```

If query 2c returned zero rows, state "No ghost completions found" and record that as the finding.

### Gate 4: Ghost Completions Identified

```
PASS criteria: Every ghost completion from query 2c is listed with message count, FAQ count, and written (not executed) reset query. OR zero ghost completions found and stated explicitly.
FAIL action: N/A — this gate cannot fail. It is a data collection gate.
```

---

## Task 5: Build Verification

```bash
cd ~/Projects/kiuli-website
npm run build 2>&1 | tail -80
```

Record the output including the exit code.

### Gate 5: Build Passes

```
PASS criteria: Exit code 0. The word "error" does not appear in the output (warnings are acceptable).
FAIL action: Record the full error output. STOP.
```

---

## Report Format

Write to `content-engine/reports/phaseA-clean-and-verify.md`:

```markdown
# Phase A: Clean and Verify — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## Task 1: Git Cleanup

### 1.1 .gitignore additions
[exact lines added]

### 1.2 Untracked artifacts
[git rm --cached commands run and output]

### 1.3 Staged files
[git add commands run]

### 1.4 Commit
[commit hash and message]

### 1.5 Final git status
[raw git status output]

### Gate 1: [PASS/FAIL]

---

## Task 2: Database Audit

### 2a: Projects by stage
[raw output]

### 2b: Draft/review/published detail
[raw output]

### 2c: Ghost completions
[raw output]

### 2d: Content jobs health
[raw output]

### 2e: Embedding store health
[raw output]

### 2f: BrandVoice populated
[raw output]

### 2g: Banned phrases count
[raw output]

### 2h: Source registry entries
[raw output]

### 2i: FAQ items per project
[raw output]

### 2j: Itinerary state
[raw output]

### Gate 2: [PASS/FAIL]

---

## Task 3: API Route Smoke Test

| Route | Status Code |
|---|---|
| test-connection | [code] |
| dashboard | [code] |
| dashboard/batch | [code] |
| draft | [code] |
| cascade | [code] |
| research | [code] |
| conversation | [code] |
| embed | [code] |
| decompose | [code] |
| source-monitor | [code] |
| jobs | [code] |

### Gate 3: [PASS/FAIL]

---

## Task 4: Ghost Completions

[For each ghost completion: id, title, content_type, stage, message_count, faq_count, reset query (NOT EXECUTED)]

[Or: "No ghost completions found."]

### Gate 4: [PASS/FAIL]

---

## Task 5: Build

[raw output of npm run build]
[exit code]

### Gate 5: [PASS/FAIL]

---

## Overall: [ALL GATES PASS / BLOCKED AT GATE N]
```

---

## DO NOT

- Do not modify any application code (only `.gitignore`)
- Do not run database migrations
- Do not deploy to Vercel
- Do not fix bugs
- Do not execute the ghost completion reset queries
- Do not skip any query or test
- Do not summarise or paraphrase query outputs
- Do not retry failed queries with modified SQL
- Do not invent alternative approaches if a step doesn't work as written

---

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.** Do not attempt to fix the failure. The strategist decides next steps.
