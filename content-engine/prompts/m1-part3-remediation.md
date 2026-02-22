# M1 Part 3: Remediation

**Date:** 2026-02-22  
**Report:** `content-engine/reports/m1-part3-remediation.md`  
**Evidence dir:** `content-engine/evidence/m1/`

---

## What This Prompt Does

Fixes three specific problems identified in the M1 Part 2 analysis:

1. **Publish route does not write `target_record_id` back to content_projects.** Every
   published project has an empty `target_record_id`, breaking all relational queries
   that link a content project to its published output. Fix the route, then backfill
   the three existing published projects.

2. **Project 87 is blocked by two false-positive hard contradictions.** The consistency
   checker flagged Kibale Forest (Uganda) facts against Nyungwe Forest (Rwanda) facts
   as contradictions. They are different forests in different countries. Both issues
   must be resolved with an explanatory note, then project 87 published.

3. **Batch route parameter name discrepancy.** The Part 2 report showed curl commands
   using `"ids"` but the route source uses `projectIds`. This task audits the current
   code without changing it and records the correct parameter name for future prompts.

---

## Rules

1. Tasks must be executed in order. Task 1 must be committed and deployed before
   Task 3 (publishing 87 via API). Task 2 can run in parallel with the deploy wait.
2. Paste the complete raw output of every command and query verbatim into the report.
3. If a gate fails, write the report to that point and STOP. Do not attempt repair.
4. Do not modify any file except `src/app/(payload)/api/content/publish/route.ts`
   in Task 1. Do not touch any other application code.
5. Do not modify the consistency issues except via the specific SQL UPDATE in Task 2b.
   Do not delete or add issues. Do not change issue_type.

---

## Task 1: Fix Publish Route — Write target_record_id Back

### 1a: Read the current update call

Read lines 100–125 of `src/app/(payload)/api/content/publish/route.ts`:

```bash
sed -n '100,125p' src/app/\(payload\)/api/content/publish/route.ts
```

Paste the raw output verbatim. Identify the exact `payload.update` call that sets
`stage: 'published'`. This is the call that must be patched.

### 1b: Apply the targeted change

In the `payload.update` call that sets `stage: 'published'`, add `targetRecordId`
to the data object. The change is exactly one new line inside the existing `data: {}`
block:

**Before** (the data block currently contains):
```typescript
      data: {
        stage: 'published',
        publishedAt: result.publishedAt,
        processingStatus: 'completed',
        processingError: null,
      },
```

**After** (add targetRecordId):
```typescript
      data: {
        stage: 'published',
        publishedAt: result.publishedAt,
        targetRecordId: String(result.targetId),
        targetCollection: result.targetCollection,
        processingStatus: 'completed',
        processingError: null,
      },
```

`result.targetId` is the post/destination/property ID returned by the publisher.
`result.targetCollection` is the collection name (e.g. 'posts').
Both are already present on the `result` object — the publisher returns them.
`targetRecordId` is a varchar column, so String() is required.

Do not touch any other part of the file.

### 1c: Verify the change

Read the same lines back immediately after editing:

```bash
sed -n '100,125p' src/app/\(payload\)/api/content/publish/route.ts
```

Paste the raw output verbatim.

### Gate 1: Change verified in source

```
PASS criteria:
  The output of 1c contains the line:
    targetRecordId: String(result.targetId),
  AND the line:
    targetCollection: result.targetCollection,
  Both appear inside the payload.update data block alongside stage: 'published'.

FAIL action: If either line is missing or in the wrong location, STOP.
Do not proceed. The fix must be exact before building.
```

---

### 1d: Build

```bash
cd ~/Projects/kiuli-website
npm run build 2>&1 | tail -30
echo "EXIT_CODE: $?"
```

Paste the complete raw output including the EXIT_CODE line.

### Gate 2: Build passes

```
PASS criteria: EXIT_CODE: 0. The word "error" (case-insensitive) does not appear
in the output except in pre-existing migration file warnings.

FAIL action: Paste the full build error and STOP.
```

---

### 1e: Commit and push

Stage ONLY the publish route:

```bash
git add src/app/\(payload\)/api/content/publish/route.ts
git status
git commit -m "fix: M1 write targetRecordId back to content_projects on publish"
git push
git status
```

Paste all raw outputs including the commit hash.

### Gate 3: Committed cleanly

```
PASS criteria:
  Only src/app/(payload)/api/content/publish/route.ts was staged.
  Commit succeeded with a hash.
  git status after push shows nothing to commit.

FAIL action: If other files were staged, STOP. Do not commit unrelated changes.
```

---

## Task 2: Backfill target_record_id on Existing Published Projects

This is a direct SQL operation. It does not require waiting for the Vercel deploy.

The correct project → post mappings, established by title join in the Part 2 analysis:

| content_projects.id | posts.id | posts.title (first 40 chars) |
|---------------------|----------|-------------------------------|
| 79 | 22 | The Kazinga Channel Phenomenon |
| 27 | 23 | Mountain Gorilla Trekking vs C |
| 53 | 24 | Kalahari Desert Safari: Why th |

### 2a: Confirm the mappings before writing

Run this query. It establishes the project → post relationship by matching titles.
This is the authoritative confirmation of which post ID belongs to which project.

```sql
SELECT
  cp.id   AS project_id,
  p.id    AS post_id,
  LEFT(p.title, 50) AS post_title_prefix,
  cp.target_record_id AS current_target_record_id
FROM content_projects cp
JOIN posts p ON p.title = cp.title
WHERE cp.id IN (27, 53, 79)
ORDER BY cp.id;
```

Paste the complete raw output.

The gate requires that the post_id values match the table above exactly.
If they do not match, STOP — do not run the UPDATE.

### Gate 4: Mapping confirmed

```
PASS criteria:
  project_id=79 → post_id=22
  project_id=27 → post_id=23
  project_id=53 → post_id=24
  All three rows show current_target_record_id IS NULL (empty).

FAIL action: If any post_id differs from the table above, STOP.
The mapping may have changed — do not write incorrect IDs.
```

---

### 2b: Write the backfill

Run three individual UPDATE statements with RETURNING. Do not batch them — individual
statements make each one independently verifiable.

```sql
UPDATE content_projects
SET
  target_record_id   = '22',
  target_collection  = 'posts'
WHERE id = 79
  AND target_record_id IS NULL
RETURNING id, target_record_id, target_collection;
```

```sql
UPDATE content_projects
SET
  target_record_id   = '23',
  target_collection  = 'posts'
WHERE id = 27
  AND target_record_id IS NULL
RETURNING id, target_record_id, target_collection;
```

```sql
UPDATE content_projects
SET
  target_record_id   = '24',
  target_collection  = 'posts'
WHERE id = 53
  AND target_record_id IS NULL
RETURNING id, target_record_id, target_collection;
```

Paste the raw output of all three, including the RETURNING results.

### Gate 5: Backfill succeeded

```
PASS criteria:
  Each UPDATE returns exactly 1 row.
  Returned rows show:
    id=79, target_record_id='22', target_collection='posts'
    id=27, target_record_id='23', target_collection='posts'
    id=53, target_record_id='24', target_collection='posts'

FAIL action: If any UPDATE returns 0 rows (already populated, or WHERE clause
mismatch), paste the output and STOP.
```

---

### 2c: Verify backfill independently

```sql
SELECT
  cp.id           AS project_id,
  cp.target_record_id,
  cp.target_collection,
  p.id            AS post_id,
  p._status       AS post_status,
  LEFT(p.title, 50) AS post_title_prefix
FROM content_projects cp
JOIN posts p ON p.id = cp.target_record_id::integer
WHERE cp.id IN (27, 53, 79)
ORDER BY cp.id;
```

Paste the complete raw output.

### Gate 6: Backfill verified

```
PASS criteria:
  Three rows returned.
  For every row: post_id = target_record_id::integer (they agree).
  For every row: post_status = 'published'.
  The JOIN worked — meaning target_record_id contains a valid integer string
  that matches an actual posts row.

FAIL action: If the JOIN returns fewer than 3 rows, or any post_status !=
'published', STOP.
```

---

## Task 3: Resolve Project 87's False-Positive Contradictions

Project 87 is at stage='review' with consistency_check_result='hard_contradiction'.
The two issues flag Kibale Forest (Uganda) content against Nyungwe Forest (Rwanda)
content as contradictions. These are different forests in different countries.
The number 13 appears in both because both happen to host 13 primate species.
This is not a factual conflict — it is a limitation of the LLM's geographic context.

The issues must be marked 'override' with an explanation. Do not delete them.
Do not change issue_type. Do not change existing_content or new_content.

The issue IDs, confirmed from the production database:
- `699b1867aafbcf000424ea75`
- `699b1867aafbcf000424ea76`

### 3a: Confirm the issues before touching them

```sql
SELECT
  id,
  _parent_id,
  issue_type,
  resolution,
  resolution_note,
  LEFT(existing_content, 60) AS existing_prefix,
  LEFT(new_content, 60)      AS new_prefix
FROM content_projects_consistency_issues
WHERE _parent_id = 87
ORDER BY _order;
```

Paste the complete raw output.

### Gate 7: Issues confirmed before resolution

```
PASS criteria:
  Exactly 2 rows returned.
  Both rows show: _parent_id=87, issue_type='hard', resolution='pending'.
  Both issue IDs match: 699b1867aafbcf000424ea75 and 699b1867aafbcf000424ea76.

FAIL action: If IDs do not match, if there are more or fewer rows than expected,
or if resolution is not 'pending', STOP. Do not proceed with the UPDATE.
```

---

### 3b: Mark both issues as overridden

```sql
UPDATE content_projects_consistency_issues
SET
  resolution      = 'override',
  resolution_note = 'False positive: Kibale Forest (Uganda) and Nyungwe Forest (Rwanda) are different forests in different countries. Both host 13 primate species coincidentally — this is not a factual contradiction. The article discusses Uganda and Rwanda as separate destinations.'
WHERE id IN ('699b1867aafbcf000424ea75', '699b1867aafbcf000424ea76')
  AND _parent_id = 87
  AND issue_type  = 'hard'
  AND resolution  = 'pending'
RETURNING id, resolution, LEFT(resolution_note, 80) AS note_prefix;
```

Paste the complete raw output including RETURNING results.

### Gate 8: Issues resolved

```
PASS criteria:
  UPDATE returns exactly 2 rows.
  Both rows show resolution='override'.
  Note_prefix shows the beginning of the explanation text.

FAIL action: If fewer than 2 rows returned, the WHERE clause did not match.
STOP. Do not proceed.
```

---

### 3c: Update project 87's consistency_check_result

Now that there are no remaining unresolved hard contradictions, the project's
overall consistency result must be updated. There are no soft contradictions
either (verified from the issues query above — only the two hard issues exist).
The result must be set to 'pass'.

```sql
UPDATE content_projects
SET consistency_check_result = 'pass'
WHERE id = 87
  AND consistency_check_result = 'hard_contradiction'
RETURNING id, consistency_check_result, stage, quality_gates_result;
```

Paste the complete raw output.

### Gate 9: Project 87 consistency updated

```
PASS criteria:
  UPDATE returns 1 row.
  Row shows: id=87, consistency_check_result='pass', stage='review',
  quality_gates_result='pass'.

FAIL action: If 0 rows returned (consistency_check_result was already changed,
or WHERE clause mismatch), paste the output and STOP.
```

---

## Task 4: Publish Project 87

**Wait for the Vercel deploy from Task 1e before this step.**

To confirm the deploy has completed, check that the publish route contains the fix:

```bash
curl -s "https://kiuli.com/api/content/publish" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 99999}' \
  -w "\nHTTP_STATUS:%{http_code}"
```

This should return HTTP_STATUS:404 (project not found), which proves the route is
reachable. HTTP_STATUS:409 would mean the deploy has not finished yet (the old route
would block on quality gates not checked). HTTP_STATUS:401 means the secret is not set.

If it returns HTTP_STATUS:404, the deploy is ready. Proceed.
If it returns anything else, wait 60 seconds and retry once.

### 4a: Confirm project 87 is ready to publish

```sql
SELECT
  id,
  stage,
  processing_status,
  quality_gates_result,
  consistency_check_result,
  target_record_id,
  published_at
FROM content_projects
WHERE id = 87;
```

Paste the complete raw output.

### Gate 10: Project 87 pre-publish state correct

```
PASS criteria:
  stage = 'review'
  quality_gates_result = 'pass'
  consistency_check_result = 'pass'
  target_record_id IS NULL (empty — the fix will write it)
  published_at IS NULL

FAIL action: If consistency_check_result != 'pass', Task 3 did not complete.
STOP.
```

---

### 4b: Publish

```bash
PUBLISH_87=$(curl -s -w "\nHTTP_STATUS:%{http_code}" --max-time 120 \
  -X POST https://kiuli.com/api/content/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 87}')
echo "$PUBLISH_87"
```

Paste the complete raw output.

### Gate 11: Publish API succeeded

```
PASS criteria:
  HTTP_STATUS:200.
  Response body contains "success":true.
  Response body contains a targetId value (the new post ID).

FAIL action:
  HTTP_STATUS:409 "quality gates have not been run" → deploy not ready. Wait and retry once.
  HTTP_STATUS:409 "hard contradiction" → Task 3 did not propagate. STOP.
  HTTP_STATUS:409 any other reason → read the error and STOP.
  HTTP_STATUS:5xx → paste full error and STOP.
```

---

### 4c: Three-point verification

**Check 1 — content_projects row:**

```sql
SELECT
  id,
  stage,
  target_record_id,
  target_collection,
  published_at,
  processing_status
FROM content_projects
WHERE id = 87;
```

**Check 2 — posts row (use the targetId from the publish response):**

```sql
SELECT id, title, slug, _status, published_at
FROM posts
WHERE id = [targetId from publish response];
```

Replace `[targetId from publish response]` with the actual integer from the API response.

**Check 3 — live page:**

Use the slug from Check 2:

```bash
SLUG_87="[slug from Check 2 output]"
curl -s -o /dev/null -w "HTTP_STATUS:%{http_code}\n" "https://kiuli.com/posts/${SLUG_87}"
```

Paste the complete raw output of all three checks.

### Gate 12: Project 87 published and verified

```
PASS criteria (ALL THREE must be true):
  Check 1: stage='published', target_record_id IS NOT NULL (not empty),
            target_collection='posts', published_at IS NOT NULL.

            *** target_record_id must NOT be empty here. ***
            If it is empty, the publish route fix (Task 1) was not deployed when
            the publish ran. This is the primary indicator that the fix worked.
            An empty target_record_id here means the fix failed. STOP.

  Check 2: A posts row exists for the targetId, _status='published',
            title matches project 87's title ("Uganda's Primate Diversity Hotspot...").

  Check 3: HTTP_STATUS:200 OR HTTP_STATUS:404 (both acceptable — 404 means the
            page exists but SSG hasn't rebuilt. 200 proves it fully works.
            500 means a template error — record it but continue.)

FAIL action:
  target_record_id is empty in Check 1 → the fix was not active when publish ran.
  This is a hard failure. STOP.
  Check 2 returns zero rows → no post was created. STOP.
  Check 2 shows _status != 'published' → post exists but not published. STOP.
```

---

## Task 5: Batch Route Parameter Audit

This task does not change any code. It records the correct parameter name.

```bash
grep -n "projectIds\|\"ids\"\|body\.ids" \
  src/app/\(payload\)/api/content/dashboard/batch/route.ts
```

Paste the complete raw output.

Record the answer to this question in the report:

> Does the batch route expect `projectIds` or `ids` in the request body?

The Part 2 report showed curl commands using `"ids": [27]`. The route source at the
time of this audit uses one or the other. State which is correct for future use.

---

## Task 6: Final State

### 6a: All published content projects

```sql
SELECT
  cp.id           AS project_id,
  cp.stage,
  cp.target_record_id,
  cp.target_collection,
  cp.published_at,
  p.id            AS post_id,
  p._status       AS post_status
FROM content_projects cp
LEFT JOIN posts p ON p.id = cp.target_record_id::integer
WHERE cp.stage = 'published'
ORDER BY cp.id;
```

Paste the complete raw output. Every row must have a non-null target_record_id
and the JOIN must return a post_id for every row.

### 6b: Total posts

```sql
SELECT COUNT(*) AS total_published_posts
FROM posts WHERE _status = 'published';
```

### 6c: Embeddings for project 87

```sql
SELECT
  content_project_id,
  chunk_type,
  COUNT(*) AS chunks,
  COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) AS with_vector,
  MAX(updated_at) AS latest
FROM content_embeddings
WHERE content_project_id = 87
GROUP BY content_project_id, chunk_type;
```

### 6d: Commit new prompts and reports

Stage and commit everything from this session:

```bash
git add \
  content-engine/prompts/m1-part3-remediation.md \
  content-engine/reports/m1-part3-remediation.md \
  content-engine/evidence/m1/
git status
git commit -m "docs: M1 Part 3 remediation prompt, report, and evidence"
git push
git status
```

Paste all raw outputs.

### Gate 13: Final state clean

```
PASS criteria:
  6a: All published projects (79, 27, 53, 87) have non-null target_record_id.
      JOIN returns a post_id for every row. No nulls anywhere.
  6b: total_published_posts = 4.
  6c: project 87 has at least 1 article_section chunk with with_vector = chunks.
  6d: git status shows clean tree.

PARTIAL PASS (acceptable):
  6c shows 0 embeddings for project 87. Embedding is fire-and-forget async.
  Record it and continue. Not a failure of the publish.

FAIL action: If 6a shows any null target_record_id for a published project, STOP.
```

---

## Report Format

Write to `content-engine/reports/m1-part3-remediation.md`:

```markdown
# M1 Part 3: Remediation

**Date:** [ISO timestamp]
**Executed by:** Claude CLI

## Task 1: Publish Route Fix

### 1a: Current update block
[paste sed output verbatim]

### 1b: Change applied
[state what was changed — one sentence]

### 1c: Verification read-back
[paste sed output verbatim]

### Gate 1: [PASS / FAIL]

### 1d: Build
[paste build output verbatim]
EXIT_CODE: [n]
### Gate 2: [PASS / FAIL]

### 1e: Commit
[paste commit hash and git status verbatim]
### Gate 3: [PASS / FAIL]

---

## Task 2: Backfill target_record_id

### 2a: Mapping confirmation
[paste query output verbatim]
### Gate 4: [PASS / FAIL]

### 2b: Backfill (3 UPDATE statements)
[paste each RETURNING result verbatim]
### Gate 5: [PASS / FAIL]

### 2c: Verification
[paste JOIN query output verbatim]
### Gate 6: [PASS / FAIL]

---

## Task 3: Project 87 Consistency Resolution

### 3a: Issues confirmed
[paste query output verbatim]
### Gate 7: [PASS / FAIL]

### 3b: Resolution UPDATE
[paste RETURNING output verbatim]
### Gate 8: [PASS / FAIL]

### 3c: Project UPDATE
[paste RETURNING output verbatim]
### Gate 9: [PASS / FAIL]

---

## Task 4: Publish Project 87

### Deploy readiness check
[paste curl output verbatim]

### 4a: Pre-publish state
[paste query output verbatim]
### Gate 10: [PASS / FAIL]

### 4b: Publish
[paste curl output verbatim]
### Gate 11: [PASS / FAIL]

### 4c: Three-point verification
Check 1 — content_projects:
[paste query output verbatim]

Check 2 — posts:
[paste query output verbatim]

Check 3 — live page:
[paste curl output verbatim]

### Gate 12: [PASS / FAIL — and if target_record_id was populated: YES/NO]

---

## Task 5: Batch Route Parameter Audit

[paste grep output verbatim]

Correct parameter name: [projectIds / ids]
Part 2 report curl commands used: [ids / projectIds]
Match: [YES / NO]

---

## Task 6: Final State

### 6a: Published projects
[paste query output verbatim]

### 6b: Total posts
[paste query output verbatim]

### 6c: Project 87 embeddings
[paste query output verbatim]

### 6d: Git state
[paste git outputs verbatim]

### Gate 13: [PASS / PARTIAL PASS (87 embeddings pending) / FAIL]

---

## Overall: [ALL GATES PASS / BLOCKED AT GATE N — reason]

## M1 Status After This Part
- Projects published: [list]
- target_record_id populated for all: [YES / NO]
- Unresolved issues: [none / list]
```

---

## Stop Conditions

Stop immediately if any gate fails. Write the report to the point of failure.
Do not attempt repair beyond what the task specifies.
Do not modify any file except publish/route.ts in Task 1.
Do not run any migration.
Do not touch consistency issues except via the exact SQL in Task 3.
