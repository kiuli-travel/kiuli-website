# M1 Part 2: End-to-End Publish Test

**Date:** 2026-02-22  
**Report:** `content-engine/reports/m1-part2-publish-test.md`  
**Evidence dir:** `content-engine/evidence/m1/`

---

## What This Prompt Does

Proves the Content Engine can publish content end-to-end. Three projects (27, 53, 87)
will be advanced from draft → review → published. Each publish is verified by three
independent checks that cannot all succeed unless the publish actually happened:
(1) DB record in Posts collection, (2) content_projects.stage = 'published',
(3) HTTP 200 from kiuli.com.

**Critical prerequisite:** This prompt contains a mandatory Phase A that checks whether
the quality gates database migration has been applied. If the `quality_gates_result`
column does not exist, the publish route will ALWAYS return 409. Phase A must complete
before any project is touched.

---

## Rules

1. Complete every phase in order. Phase A is not optional.
2. Paste the **complete raw output** of every command and query verbatim into the report.
3. If any gate fails, write the report to that point and STOP. Do not attempt repair.
4. Do not override quality gates violations unless instructed. Record them and STOP.
5. Do not advance multiple projects simultaneously. Fully verify each project before
   starting the next.
6. Do not modify any content project fields other than through the designated API calls.
7. Never use `curl -s` without also capturing the response body. You need both the body
   AND the status code for every API call.

---

## Phase A: Migration Gate

The publish route reads `project.qualityGatesResult`. If this column does not exist
in the database, Payload returns `undefined` for it, and the route returns 409
"quality gates have not been run" for every project, forever.

This phase must run first. It either confirms the columns exist or creates them.

### A1: Check column existence

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'content_projects'
  AND column_name LIKE 'quality%'
ORDER BY column_name;
```

Paste the complete raw output.

### A2: Check migration status

```bash
cd ~/Projects/kiuli-website
npx payload migrate:status 2>&1
```

Paste the complete raw output.

### Gate A: Branch on findings

**Read A1 output first.**

```
IF A1 returns zero rows (no quality_% columns):
  The migration has not been run. Proceed to A3.

IF A1 returns rows including quality_gates_result:
  The migration ran. Skip to Phase B. Write "Migration already applied — skipping A3/A4/A5" in report.
```

Do not proceed past this decision point without reading the actual A1 output.

---

### A3: Generate the migration (only if A1 returned zero rows)

```bash
cd ~/Projects/kiuli-website
npx payload migrate:create 2>&1
```

Paste the complete raw output. This command generates a new migration file in
`src/migrations/` based on the difference between the Payload schema definition
and the current database state.

After running, list the migrations directory to confirm a new file was created:

```bash
ls -lt src/migrations/*.ts | head -5
```

Paste the output. The newest file should have today's date in its name.

Read the new migration file:

```bash
cat src/migrations/$(ls -t src/migrations/*.ts | head -1 | xargs basename)
```

Paste the complete content. Confirm it adds columns including `quality_gates_result`.
If the migration does NOT include quality gates columns, STOP — the schema definition
may not have the fields, which is a separate problem requiring investigation.

### Gate A3: Migration file generated

```
PASS criteria:
  migrate:create ran without error.
  A new .ts file exists in src/migrations/ with today's date.
  The file content includes ADD COLUMN statements (or equivalent) for quality_gates_result.

FAIL action: If migrate:create errors, paste the full error and STOP.
If the new file does not reference quality_gates_result, STOP.
```

---

### A4: Build and deploy the migration

First build locally to confirm the migration compiles:

```bash
npm run build 2>&1 | tail -30
```

Paste output. Exit code must be 0.

If build passes, commit and push:

```bash
git add src/migrations/
git commit -m "feat: M1 Part 2 — add quality gates migration (quality_gates_result column)"
git push
git status
```

Paste all raw outputs.

After pushing, Vercel will auto-deploy. Wait for the deployment to complete before
running the migration. Check deployment status:

```bash
npx vercel ls --prod 2>&1 | head -10
```

Paste output. The most recent deployment should show "Ready" status.

### Gate A4: Build and push succeeded

```
PASS criteria:
  Build exit code 0.
  Commit succeeded with a hash.
  git status shows clean tree.

FAIL action: Build error → paste full error and STOP.
Push error → paste error and STOP.
```

---

### A5: Run the migration on production

```bash
npx payload migrate 2>&1
```

Paste the complete raw output.

Then verify the columns now exist:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'content_projects'
  AND column_name LIKE 'quality%'
ORDER BY column_name;
```

Paste the complete raw output.

Then verify the migration appears in payload_migrations:

```sql
SELECT id, name, batch FROM payload_migrations ORDER BY batch DESC LIMIT 5;
```

Paste the complete raw output.

### Gate A5: Migration applied

```
PASS criteria (ALL THREE must be true):
  1. migrate command output shows the migration ran successfully (no errors).
  2. The column existence query returns rows including quality_gates_result,
     quality_gates_violations, quality_gates_checked_at, quality_gates_overridden.
  3. The new migration name appears in payload_migrations.

FAIL action: If any condition fails, paste the exact output and STOP.
```

---

## Phase B: Pre-Flight

### B1: Confirm starting state of all three test projects

```sql
SELECT
  id,
  title,
  content_type,
  stage,
  processing_status,
  body IS NOT NULL                              AS has_body,
  char_length(body::text)                       AS body_chars,
  meta_title IS NOT NULL AND meta_title != ''   AS has_meta_title,
  meta_description IS NOT NULL
    AND meta_description != ''                  AS has_meta_desc,
  answer_capsule IS NOT NULL
    AND answer_capsule != ''                    AS has_capsule,
  quality_gates_result,
  quality_gates_checked_at IS NOT NULL          AS gates_checked,
  consistency_check_result,
  consistency_checked_at IS NOT NULL            AS consistency_checked
FROM content_projects
WHERE id IN (27, 53, 87)
ORDER BY id;
```

```sql
SELECT f._parent_id AS project_id, COUNT(*) AS faq_count
FROM content_projects_faq_section f
WHERE f._parent_id IN (27, 53, 87)
GROUP BY f._parent_id
ORDER BY f._parent_id;
```

Paste both complete raw outputs.

### B2: Confirm API is reachable

```bash
curl -s -w "\nHTTP_STATUS:%{http_code}" --max-time 10 \
  https://kiuli.com/api/content/test-connection
```

Paste the complete output including the HTTP_STATUS line.

### B3: Confirm CONTENT_SYSTEM_SECRET is set

```bash
echo "CONTENT_SYSTEM_SECRET length: ${#CONTENT_SYSTEM_SECRET}"
```

If the output shows length 0, load it:

```bash
grep CONTENT_SYSTEM_SECRET .env.local .env.production.local 2>/dev/null | head -1
```

Export it before any curl commands:

```bash
export CONTENT_SYSTEM_SECRET="[value from .env file]"
echo "CONTENT_SYSTEM_SECRET length: ${#CONTENT_SYSTEM_SECRET}"
```

Paste all raw outputs. Never paste the actual secret value.

### Gate B: Pre-flight pass

```
PASS criteria for ALL THREE projects (27, 53, 87):
  stage = 'draft'
  processing_status = 'completed'  (drafting already done from Phase B work)
  has_body = true
  body_chars > 500
  has_meta_title = true
  faq_count >= 5

API: test-connection returns HTTP_STATUS:200 (or any non-404)
Secret: length > 0

FAIL action: If any project fails any condition, record which and why. STOP.
```

---

## Phase C: Project 27 — Full Cycle

Record the project title from Query B1 for cross-validation in Gate C5.

### C1: Advance to Review

This call will auto-trigger quality gates AND consistency check on review advance.

```bash
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" --max-time 120 \
  -X POST https://kiuli.com/api/content/dashboard/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"action": "advance", "ids": [27]}')
echo "$RESPONSE"
```

Wait 10 seconds for async gate triggers to complete, then query:

```sql
SELECT
  id,
  stage,
  processing_status,
  quality_gates_result,
  quality_gates_checked_at,
  quality_gates_overridden,
  consistency_check_result,
  consistency_checked_at
FROM content_projects
WHERE id = 27;
```

Paste both complete raw outputs.

### Gate C1: Project 27 advanced to review

```
PASS criteria (ALL must be true):
  HTTP_STATUS:200 in the curl output.
  Response body does NOT contain id 27 in any "skipped" array.
  DB query shows stage = 'review'.
  DB query shows quality_gates_result IS NOT NULL (either 'pass' or 'fail').
  DB query shows quality_gates_checked_at IS NOT NULL.
  DB query shows consistency_check_result IS NOT NULL.

FAIL action:
  HTTP_STATUS:4xx/5xx → paste full response and STOP.
  Project 27 in "skipped" with a reason → paste reason and STOP.
  stage still = 'draft' → advance did not work. STOP.
  quality_gates_result IS NULL → columns not written (migration problem?). STOP.
  quality_gates_checked_at IS NULL → gates did not auto-trigger. STOP.
```

---

### C2: Inspect Quality Gates Result

```sql
SELECT
  id,
  quality_gates_result,
  quality_gates_violations::text    AS violations_json,
  quality_gates_checked_at,
  quality_gates_overridden
FROM content_projects
WHERE id = 27;
```

Paste the complete raw output including `violations_json`.

### Gate C2: Quality gates are actionable

```
READ violations_json carefully before deciding:

IF quality_gates_result = 'pass':
  PROCEED to C3. Write "Gates: PASS — no violations" in report.

IF quality_gates_result = 'fail':
  Parse violations_json. Check severity of each violation.
  IF all violations have severity = 'warning' (none have severity = 'error'):
    PROCEED to C3. Write "Gates: FAIL (warnings only) — proceeding" in report.
    Document each warning violation in the report.
  IF any violation has severity = 'error':
    STOP. Do not publish. Write each error violation in the report.
    Gate C2: FAIL — error violations present, cannot publish.

Do NOT override gates violations. Do NOT attempt to fix violations.
If stopping, record the exact violation text from violations_json.
```

---

### C3: Inspect Consistency Check Result

```sql
SELECT
  id,
  consistency_check_result,
  consistency_checked_at
FROM content_projects
WHERE id = 27;
```

```sql
SELECT
  id,
  issue_type,
  resolution,
  existing_content,
  new_content,
  source_record
FROM content_projects_consistency_issues
WHERE project_id = 27
ORDER BY issue_type DESC, id;
```

Paste both complete raw outputs.

### Gate C3: No unresolved hard contradictions

```
IF consistency_check_result = 'pass' OR 'soft_contradiction':
  PROCEED to C4.

IF consistency_check_result = 'hard_contradiction':
  Check the issues query for rows where issue_type = 'hard' AND resolution = 'pending'.
  IF any such rows exist: STOP. Cannot publish. List the issues.
  IF no such rows: all hard issues resolved. PROCEED to C4.

IF consistency_check_result = 'not_checked':
  This should not happen — auto-trigger ran in C1. STOP and investigate.
```

---

### C4: Publish Project 27

```bash
PUBLISH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" --max-time 120 \
  -X POST https://kiuli.com/api/content/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 27}')
echo "$PUBLISH_RESPONSE"
```

Paste the complete raw output.

### Gate C4: Publish call succeeded

```
PASS criteria:
  HTTP_STATUS:200.
  Response body contains "success": true or a published record ID.

FAIL action:
  HTTP 409 "quality gates have not been run" →
    Gates migration did not work correctly. STOP.
  HTTP 409 "quality gates failed" →
    Error-severity violations still blocking. Check Gate C2. STOP.
  HTTP 409 "hard contradiction" →
    Consistency check blocking. Check Gate C3. STOP.
  HTTP 5xx → paste full error and STOP.
```

---

### C5: Verify Project 27 in Posts Collection

This is the only gate that proves content actually published. Three independent checks
must ALL agree. If any disagrees, the publish failed despite the API returning 200.

**Check 1: content_projects stage**

```sql
SELECT id, stage, published_at, target_collection, target_record_id, processing_status
FROM content_projects
WHERE id = 27;
```

**Check 2: Posts record existence**

Use the `target_record_id` from Check 1 as the posts ID. If target_record_id is NULL,
Check 2 will fail.

```sql
SELECT id, title, slug, _status, published_at
FROM posts
WHERE id = (
  SELECT target_record_id::integer
  FROM content_projects
  WHERE id = 27
);
```

**Check 3: Live page on kiuli.com**

Use the `slug` from Check 2:

```bash
POST_SLUG="[slug from Check 2 query output]"
curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" \
  "https://kiuli.com/posts/${POST_SLUG}"
```

Paste the complete raw output of ALL THREE checks.

Save to evidence file:

```bash
mkdir -p content-engine/evidence/m1
cat << 'EOF' > content-engine/evidence/m1/project-27-published.txt
PROJECT 27 PUBLISH EVIDENCE
Date: [timestamp]

content_projects row:
[paste Check 1 raw output]

posts row:
[paste Check 2 raw output]

Live page HTTP status:
[paste Check 3 raw output]
EOF
```

### Gate C5: Project 27 publish verified

```
PASS criteria (ALL THREE must be true):
  Check 1: stage = 'published', target_collection IS NOT NULL, target_record_id IS NOT NULL.
  Check 2: A posts row exists, _status = 'published', title matches project 27's title
           (from Query B1 — use this as cross-validation that the right record was created).
  Check 3: HTTP_STATUS:200.

FAIL action:
  Check 1 shows stage != 'published' → project stage not updated. STOP.
  Check 1 shows target_record_id IS NULL → publisher did not set target. STOP.
  Check 2 returns zero rows → no post was created despite API success. STOP.
  Check 2 shows _status != 'published' → post exists but not published. STOP.
  Check 3 returns HTTP_STATUS:404 → Next.js page not rendering.
    This is BLOCKED (not FAILED) if the template exists but SSG hasn't rebuilt.
    Record as BLOCKED. Continue to Project 53 — the publish mechanism works.
  Check 3 returns HTTP_STATUS:500 → page template error. Record and continue — not a
    publish failure.

Note: HTTP 404 on the live page does NOT mean publish failed. It means the frontend
template may need a rebuild. The publish is COMPLETE if Checks 1 and 2 both pass.
```

---

### C6: Verify Embeddings (Project 27)

```sql
SELECT
  chunk_type,
  source_type,
  COUNT(*)                                              AS chunks,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END)     AS with_vector,
  MAX(updated_at)                                       AS latest
FROM content_embeddings
WHERE updated_at > NOW() - INTERVAL '15 minutes'
GROUP BY chunk_type, source_type
ORDER BY chunk_type;
```

```sql
SELECT COUNT(*) AS total_embeddings FROM content_embeddings;
```

Paste both raw outputs. Note the total_embeddings count — it must be compared after
projects 53 and 87 are published to confirm embeddings were generated for each.

---

## Phase D: Project 53 — Full Cycle

Repeat the exact sequence C1 through C6 for project 53.

Replace all references to project 27 with project 53.
Save evidence to `content-engine/evidence/m1/project-53-published.txt`.

Apply the same gates (C1 through C5) with the same pass/fail criteria.
Project 53's title from Query B1 is the cross-validation value for Gate D5.

The live page check for project 53 uses the slug from project 53's posts row.

---

## Phase E: Project 87 — Full Cycle

Repeat the exact sequence C1 through C6 for project 87.

Replace all references to project 27 with project 87.
Save evidence to `content-engine/evidence/m1/project-87-published.txt`.

Apply the same gates with the same criteria.

---

## Phase F: Final State

Run these queries after all three projects have been published (or as far as got):

### F1: Stage summary

```sql
SELECT stage, COUNT(*) AS count
FROM content_projects
GROUP BY stage
ORDER BY stage;
```

### F2: Published project detail

```sql
SELECT
  cp.id,
  cp.title,
  cp.content_type,
  cp.stage,
  cp.target_record_id,
  cp.published_at,
  p.id            AS post_id,
  p._status       AS post_status,
  p.slug          AS post_slug
FROM content_projects cp
LEFT JOIN posts p ON p.id = cp.target_record_id::integer
WHERE cp.id IN (27, 53, 87)
ORDER BY cp.id;
```

### F3: Posts count

```sql
SELECT COUNT(*) AS total_published_posts
FROM posts
WHERE _status = 'published';
```

### F4: Embedding count

```sql
SELECT COUNT(*) AS total_embeddings FROM content_embeddings;
```

Paste all four complete raw outputs.

### Gate F: End-to-end validated

```
PASS criteria:
  F2 shows stage = 'published' for all three projects (27, 53, 87).
  F2 shows post_status = 'published' for all three.
  F2 shows post_id IS NOT NULL for all three.
  F3 shows total_published_posts >= 3 (project 79 was previously published = at least 4).
  F4 shows total_embeddings increased compared to the count in Phase C6.

PARTIAL PASS (acceptable):
  If 2 of 3 projects published successfully and the third failed at a gate,
  write "PARTIAL PASS — 2 of 3 projects published" and record which gate failed.

FAIL action: If zero projects published, record the first gate failure. STOP.
```

---

## Report Format

Write to `content-engine/reports/m1-part2-publish-test.md`:

```markdown
# M1 Part 2: End-to-End Publish Test

**Date:** [ISO timestamp]
**Executed by:** Claude CLI

## Phase A: Migration Gate

### A1: Column existence check
[paste raw SQL output verbatim]

### A2: Migration status
[paste raw output verbatim]

### Gate A decision: [Columns present — skipping A3/A4/A5] OR [Columns missing — running A3/A4/A5]

### A3: Migration generated (if applicable)
[paste migrate:create output verbatim]
[paste ls output verbatim]
[paste new migration file content verbatim]
Gate A3: [PASS / FAIL]

### A4: Build and push (if applicable)
[paste build output verbatim]
[paste git outputs verbatim]
Gate A4: [PASS / FAIL]

### A5: Migration applied (if applicable)
[paste migrate output verbatim]
[paste column existence query output verbatim]
[paste payload_migrations query output verbatim]
Gate A5: [PASS / FAIL]

---

## Phase B: Pre-Flight

### B1: Starting state
[paste both query raw outputs verbatim]

### B2: API reachable
[paste curl raw output verbatim]

### B3: Secret confirmed
[paste echo output verbatim — NOT the secret value]

### Gate B: [PASS / FAIL — reason]

---

## Phase C: Project 27

### C1: Advance to review
[paste curl raw output verbatim]
[paste DB query raw output verbatim]
Gate C1: [PASS / FAIL]

### C2: Quality gates
[paste DB query raw output verbatim including violations_json]
Gate C2: [PASS / FAIL / STOP — reason if stopping]

### C3: Consistency check
[paste both query raw outputs verbatim]
Gate C3: [PASS / FAIL / STOP]

### C4: Publish
[paste curl raw output verbatim]
Gate C4: [PASS / FAIL]

### C5: Verification
[paste Check 1 raw output verbatim]
[paste Check 2 raw output verbatim]
[paste Check 3 raw output verbatim]
Gate C5: [PASS / PARTIAL PASS (live page blocked) / FAIL — reason]

### C6: Embeddings
[paste both query raw outputs verbatim]

---

## Phase D: Project 53

[same structure as Phase C]

---

## Phase E: Project 87

[same structure as Phase C]

---

## Phase F: Final State

[paste all four query raw outputs verbatim]

### Gate F: [PASS / PARTIAL PASS — N of 3 published / FAIL]

---

## Overall: [ALL PHASES PASS / BLOCKED AT PHASE X GATE Y — reason]
```

---

## Stop Conditions

Stop immediately if any gate marked STOP or FAIL is reached.
Write the report to the point of failure.
Do not attempt repair.
Do not advance the next project if the current one failed.
Do not fabricate evidence — if a query returns zero rows, paste zero rows.
