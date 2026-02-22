# M1 Cleanup

**Date:** 2026-02-22  
**Report:** `content-engine/reports/m1-cleanup.md`  
**Purpose:** Final M1 housekeeping — clean git state, purge vector DB stubs,
delete off-topic content project, update CLAUDE.md launch status.

This prompt has no architectural decisions and no code changes that affect
production behaviour. It is data cleanup and documentation only.

---

## Rules

1. Execute tasks in order. Each task must pass its gate before the next begins.
2. Paste all raw command and query output verbatim into the report.
3. STOP and report if any gate fails. Do not improvise.
4. Do not touch: Payload Media collection, S3 bucket, imgix, any itinerary
   records, any published post records, any content projects except project 141.
5. The only application file that may be edited is `CLAUDE.md`.

---

## Task 1: Git Audit

Establish ground truth before touching anything.

```bash
git status
git log --oneline -8
```

Paste both outputs verbatim.

### Gate 1: Confirm expected dirty state

```
PASS criteria:
  git status shows exactly these entries and no others:
    M  src/payload-types.ts
    ?? content-engine/prompts/phase14a-bugfix4.md
    ?? src/migrations/20260222_143340.json
    ?? tools/mcp-server/server.py
  git log shows dafcf97 as a recent commit.

FAIL action: If any unexpected modified or untracked file appears, list it
in the report and STOP. Do not commit until unexpected files are understood.
```

---

## Task 2: Commit Git Debris

These four files are the only outstanding items from M1 and prior work.
Commit them in two logical groups — application files separate from tooling.

### 2a: Application files

Stage and commit `src/payload-types.ts` and `src/migrations/20260222_143340.json`.
These are paired: payload-types is the TypeScript type output of the Payload schema
that includes the quality gates fields added in migration 20260222_143340.
The migration .json is the snapshot Payload generates alongside the .ts file.

```bash
git add src/payload-types.ts src/migrations/20260222_143340.json
git status
git commit -m "chore: commit payload-types and migration snapshot for quality gates fields"
echo "EXIT: $?"
```

Paste all raw output including EXIT.

### Gate 2: Application commit clean

```
PASS criteria:
  Only the two listed files were staged (verify from git status before commit).
  EXIT: 0
  Commit hash appears in output.

FAIL action: If other files were staged or EXIT != 0, STOP.
```

---

### 2b: Tooling and prompt files

Stage and commit the remaining three untracked files.

```bash
git add \
  content-engine/prompts/phase14a-bugfix4.md \
  tools/mcp-server/server.py
git status
git commit -m "chore: commit MCP server and phase14a bugfix prompt"
echo "EXIT: $?"
```

Paste all raw output including EXIT.

### Gate 3: Tooling commit clean

```
PASS criteria:
  Exactly those two files staged.
  EXIT: 0

FAIL action: STOP if other files appear or EXIT != 0.
```

---

### 2c: Push and verify clean tree

```bash
git push
git status
```

Paste both outputs verbatim.

### Gate 4: Tree clean

```
PASS criteria:
  git status output is exactly:
    "On branch main
    Your branch is up to date with 'origin/main'.
    nothing to commit, working tree clean"
  No modified files. No untracked files. No unpushed commits.

FAIL action: If any file remains dirty or untracked, STOP.
```

---

## Task 3: Vector DB Audit Before Deletion

Establish exact counts before any deletion. This is the before-state.

```sql
SELECT
  content_project_id,
  chunk_type,
  COUNT(*) AS chunks
FROM content_embeddings
GROUP BY content_project_id, chunk_type
ORDER BY content_project_id NULLS FIRST, chunk_type;
```

Then the summary:

```sql
SELECT
  COUNT(*) AS total_rows,
  COUNT(CASE WHEN content_project_id IN (27,53,79,87) THEN 1 END) AS rows_to_keep,
  COUNT(CASE WHEN content_project_id NOT IN (27,53,79,87)
             OR content_project_id IS NULL THEN 1 END) AS rows_to_delete
FROM content_embeddings;
```

Paste both outputs verbatim.

### Gate 5: Before-state confirmed

```
PASS criteria:
  Total rows = 239 (or within ±5 if any async embeddings landed since verification).
  rows_to_keep = 60 (projects 27, 53, 79, 87 — the four published articles).
  rows_to_delete = 179 (or total minus 60).
  The four published projects appear in the detail query with the correct counts:
    27: 10 article_section
    53:  9 article_section
    79: 11 article_section + 10 faq_answer
    87: 10 article_section + 10 faq_answer

FAIL action: If rows_to_keep != 60 or published project counts differ from above,
STOP. Do not delete until the before-state is understood.
```

---

## Task 4: Delete Vector DB Stubs

Delete everything except the four published articles' embeddings.

The KEEP set is content_project_id IN (27, 53, 79, 87).
Everything else — stubs for unpublished projects, off-topic project 141,
NULL-project scraped content (itinerary_segment, property_section,
destination_section, faq_answer with no project_id) — is removed.

This does NOT affect: Payload Media, S3, imgix, itinerary records, posts,
content_projects, or any other table. Only content_embeddings.

```sql
WITH deleted AS (
  DELETE FROM content_embeddings
  WHERE content_project_id IS NULL
     OR content_project_id NOT IN (27, 53, 79, 87)
  RETURNING chunk_type, content_project_id
)
SELECT chunk_type, content_project_id, COUNT(*) AS deleted_count
FROM deleted
GROUP BY chunk_type, content_project_id
ORDER BY content_project_id NULLS FIRST, chunk_type;
```

Paste the complete raw output verbatim including the row count at the bottom.

### Gate 6: Deletion confirmed

```
PASS criteria:
  The query returns rows showing deleted records for:
    - NULL content_project_id (itinerary_segment, property_section,
      destination_section, faq_answer from scraper bootstrap)
    - content_project_id = 141 (Amazon article stub)
    - content_project_id values for brief/research/draft stage stubs
      (28–89 excluding 27, 53, 79, 87)
  Total deleted rows match rows_to_delete from Gate 5 (within ±5).
  content_project_id 27, 53, 79, 87 do NOT appear in the deleted output.

FAIL action: If any of 27, 53, 79, or 87 appear in the deleted output, the
WHERE clause was wrong. STOP. (Note: at this point the DELETE has already run.
Record the exact output and stop for manual assessment.)
```

---

## Task 5: Verify After State

Two independent queries. Both must agree.

```sql
SELECT
  content_project_id,
  chunk_type,
  COUNT(*) AS chunks
FROM content_embeddings
GROUP BY content_project_id, chunk_type
ORDER BY content_project_id, chunk_type;
```

```sql
SELECT COUNT(*) AS total_remaining FROM content_embeddings;
```

Paste both outputs verbatim.

### Gate 7: After state correct

```
PASS criteria:
  Exactly 4 content_project_id values appear: 27, 53, 79, 87.
  Chunk counts match the expected before-state for those four projects exactly:
    27: 10 article_section
    53:  9 article_section
    79: 11 article_section + 10 faq_answer
    87: 10 article_section + 10 faq_answer
  Total remaining = 60.
  No NULL content_project_id rows.
  No other content_project_id values.

FAIL action: If any unexpected rows remain or expected rows are missing, STOP.
```

---

## Task 6: Delete Project 141

Project 141 is an Amazon deforestation article that entered via the bioRxiv
Conservation Biology RSS source. It has no connection to African safari travel.
It should not exist in this database.

It is at stage='brief', processing_status='idle', with no body, no child records
except one embedding (already deleted in Task 4).

### 6a: Confirm before deleting

```sql
SELECT id, stage, processing_status, content_type, title,
       origin_pathway, origin_url, created_at
FROM content_projects
WHERE id = 141;
```

```sql
SELECT COUNT(*) AS child_embeddings
FROM content_embeddings
WHERE content_project_id = 141;
```

Paste both outputs verbatim.

### Gate 8: Project 141 safe to delete

```
PASS criteria:
  Project exists with id=141, stage='brief', processing_status='idle'.
  child_embeddings = 0 (deleted in Task 4).

FAIL action: If processing_status is anything other than 'idle', or if
child_embeddings > 0, STOP.
```

---

### 6b: Delete via psql

The Payload MCP db_query tool is read-only. Use psql directly.

```bash
psql "$DATABASE_URL_UNPOOLED" -c "
DELETE FROM content_projects WHERE id = 141 RETURNING id, title, stage;
"
```

Paste the complete raw output verbatim.

### Gate 9: Project 141 deleted

```
PASS criteria:
  DELETE returns exactly 1 row.
  Returned row shows id=141.

FAIL action: If DELETE returns 0 rows (already gone or WHERE mismatch), STOP.
```

---

### 6c: Verify deletion

```sql
SELECT COUNT(*) AS count_141 FROM content_projects WHERE id = 141;
```

```sql
SELECT stage, COUNT(*) FROM content_projects GROUP BY stage ORDER BY stage;
```

Paste both outputs verbatim.

### Gate 10: Verified deleted

```
PASS criteria:
  count_141 = 0.
  Stage summary: idea=20, brief=29 (was 30, minus project 141), research=3,
  draft=2, published=4, proposed=2, rejected=1. Total = 61.

FAIL action: If count_141 != 0 or brief count is not 29, STOP.
```

---

## Task 7: Update CLAUDE.md Launch Status

Section 12 of CLAUDE.md is outdated. It says M1 is not complete.
Update it to reflect current reality.

Read the current Section 12:

```bash
grep -n "M1\|M2\|M3\|M4\|M5\|M6\|M7\|Pipeline\|Schema\|Frontend\|Admin\|Integration\|Production\|Launch" CLAUDE.md | head -30
```

Paste the raw output.

Then apply the following targeted replacement to the Section 12 content.

Find this exact block (verify it matches before replacing):

```
The launch roadmap (KIULI_LAUNCH_ROADMAP.md) defines 7 milestones:
1. **M1: Pipeline Validation** — fix ghost bug, publish 2-3 projects
2. **M2: Schema Evolution & Scraper Upgrade** — future-proof for agentic vision
3. **M3: Frontend Development** — all pages to Awwwards standard
4. **M4: Admin UI Overhaul** — integrated workflow
5. **M5: Integration Test Cycle** — delete test data, re-scrape, full pipeline
6. **M6: Production Content Run** — 75-100 itineraries
7. **M7: Launch**

M2 is the critical path. Everything downstream depends on getting the schema right.
```

Replace with:

```
The launch roadmap (KIULI_LAUNCH_ROADMAP.md) defines 7 milestones:
1. **M1: Pipeline Validation** ✅ COMPLETE — ghost bug fixed, 4 articles published end-to-end (posts 22–25), target_record_id bug fixed, quality gates migration applied
2. **M2: Schema Evolution & Scraper Upgrade** — future-proof for agentic vision (BLOCKED: requires KIULI_AGENTIC_VISION.md in project knowledge)
3. **M3: Frontend Development** — all pages to Awwwards standard (requires M2 + test content)
4. **M4: Admin UI Overhaul** — integrated workflow
5. **M5: Integration Test Cycle** — delete all test data, re-scrape 6 test itineraries, full pipeline
6. **M6: Production Content Run** — 75-100 itineraries
7. **M7: Launch**

M2 is the critical path. Everything downstream depends on getting the schema right.
```

After making the change, read the updated section back:

```bash
grep -A 12 "defines 7 milestones" CLAUDE.md
```

Paste the raw output.

### Gate 11: CLAUDE.md updated correctly

```
PASS criteria:
  M1 line shows ✅ COMPLETE and the four fixes are listed.
  M5 line says "6 test itineraries" not "5-7".
  All other milestone lines unchanged.
  No other part of CLAUDE.md was modified.

FAIL action: If the text doesn't match exactly or other sections changed, STOP.
```

---

## Task 8: Final Commit and Verification

### 8a: Commit CLAUDE.md

```bash
git add CLAUDE.md
git status
git commit -m "docs: M1 complete — update CLAUDE.md launch status and milestone tracker"
git push
echo "EXIT: $?"
```

Paste all raw output including EXIT.

### Gate 12: CLAUDE.md committed

```
PASS criteria:
  Only CLAUDE.md was staged.
  EXIT: 0.
  Push succeeded.

FAIL action: If other files were staged or EXIT != 0, STOP.
```

---

### 8b: Final state verification

Run all three queries. Paste all three outputs verbatim.

```sql
-- 1. Published projects with full traceability
SELECT
  cp.id         AS project_id,
  cp.stage,
  cp.target_record_id,
  cp.target_collection,
  p._status     AS post_status,
  p.slug
FROM content_projects cp
JOIN posts p ON p.id = cp.target_record_id::integer
WHERE cp.stage = 'published'
ORDER BY cp.id;
```

```sql
-- 2. Vector DB — only published articles remain
SELECT
  content_project_id,
  chunk_type,
  COUNT(*) AS chunks
FROM content_embeddings
GROUP BY content_project_id, chunk_type
ORDER BY content_project_id, chunk_type;
```

```sql
-- 3. Content project stage summary
SELECT stage, COUNT(*) FROM content_projects GROUP BY stage ORDER BY stage;
```

```bash
# 4. Git clean
git status
git log --oneline -5
```

Paste all four outputs verbatim.

### Gate 13: Clean final state

```
PASS criteria:
  Query 1: 4 rows — projects 79, 27, 53, 87, all stage='published',
            all with non-null target_record_id, all post_status='published'.
  Query 2: Exactly 4 content_project_id values (27, 53, 79, 87), total 60 rows.
            No NULL content_project_id. No other project IDs.
  Query 3: idea=20, brief=29, research=3, draft=2, published=4,
            proposed=2, rejected=1. Total=61.
  Git status: nothing to commit, working tree clean.
  Git log: most recent commit is CLAUDE.md docs commit.

FAIL action: Any variance from expected counts means something was missed
or over-deleted. STOP and record the discrepancy.
```

---

## Report Format

Write to `content-engine/reports/m1-cleanup.md`:

```markdown
# M1 Cleanup

**Date:** [ISO timestamp]
**Executed by:** Claude CLI

## Task 1: Git Audit
[paste git status and log verbatim]
### Gate 1: [PASS / FAIL]

## Task 2: Commit Git Debris

### 2a: Application files
[paste output verbatim]
### Gate 2: [PASS / FAIL — commit hash: XXXXXXX]

### 2b: Tooling files
[paste output verbatim]
### Gate 3: [PASS / FAIL — commit hash: XXXXXXX]

### 2c: Push and verify
[paste output verbatim]
### Gate 4: [PASS / FAIL]

## Task 3: Vector DB Audit
[paste both query outputs verbatim]
### Gate 5: [PASS / FAIL — before total: N, to_keep: 60, to_delete: N]

## Task 4: Delete Vector DB Stubs
[paste DELETE WITH output verbatim]
### Gate 6: [PASS / FAIL — rows deleted: N]

## Task 5: After State Verification
[paste both query outputs verbatim]
### Gate 7: [PASS / FAIL — remaining: 60]

## Task 6: Delete Project 141

### 6a: Pre-deletion check
[paste both query outputs verbatim]
### Gate 8: [PASS / FAIL]

### 6b: Delete
[paste psql output verbatim]
### Gate 9: [PASS / FAIL]

### 6c: Verification
[paste both query outputs verbatim]
### Gate 10: [PASS / FAIL — brief count: 29, total: 61]

## Task 7: Update CLAUDE.md
[paste grep outputs verbatim]
### Gate 11: [PASS / FAIL]

## Task 8: Final Commit and Verification

### 8a: Commit
[paste git output verbatim]
### Gate 12: [PASS / FAIL — commit hash: XXXXXXX]

### 8b: Final state
[paste all four outputs verbatim]
### Gate 13: [PASS / FAIL]

---

## Overall: [ALL 13 GATES PASS / BLOCKED AT GATE N — reason]

## M1 Final State
- Git: clean, all committed, pushed
- Vector DB: 60 rows, projects 27/53/79/87 only
- Content projects: 61 total, 4 published, project 141 deleted
- CLAUDE.md: M1 marked complete
- Ready for: M3 frontend development against 4 published articles
```

Do NOT commit the report file — it will be committed as part of this conversation's
final handoff, not by CLI.

---

## Stop Conditions

Stop at any failed gate. Do not attempt repair beyond what the task specifies.
Do not touch: posts, itineraries, media, S3, Payload collections other than
content_projects row 141, or any file other than CLAUDE.md.
The only destructive operations in this prompt are the two DELETEs in Tasks 4 and 6.
Everything else is read-only audit or additive (git commit, documentation update).
