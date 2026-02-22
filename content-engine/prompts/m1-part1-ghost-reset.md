# M1 Part 1: Ghost Completion Reset

**Date:** 2026-02-22  
**Report:** `content-engine/reports/m1-part1-ghost-reset.md`  
**Evidence:** `content-engine/evidence/m1/`

---

## What This Prompt Does

Queries the production database to classify every `processing_status = 'completed'`
record as either stale or legitimate, resets only the stale ones, and produces
before/after evidence that cannot be fabricated.

---

## Rules

1. Follow tasks in order. Do not skip any task or query.
2. Paste the **raw output** of every command into the report. Not a summary. Not paraphrased.
3. If a gate fails, write the report up to that point and STOP. Do not attempt repair.
4. Do not update any column except `processing_status`, `processing_error`, and
   `processing_started_at`. Do not touch any other field.
5. Do not reset records at stage = 'published'. These are terminal.
6. Do not assume the number of stale records. The data determines the count.

---

## Task 1: Baseline Snapshot

Run these four queries. Paste the COMPLETE raw output of each into the report.

### Query 1A — All completed records (the universe)

```sql
SELECT
  id,
  content_type,
  stage,
  processing_status,
  body IS NOT NULL                                        AS has_body,
  (sections IS NOT NULL
    AND sections::text NOT IN ('{}', 'null', '""'))       AS has_sections,
  synthesis IS NOT NULL                                   AS has_synthesis,
  meta_title IS NOT NULL AND meta_title != ''             AS has_meta_title,
  processing_started_at IS NOT NULL                       AS has_started_at,
  processing_error IS NOT NULL                            AS has_error,
  updated_at
FROM content_projects
WHERE processing_status = 'completed'
ORDER BY stage, id;
```

### Query 1B — Count by stage for completed records

```sql
SELECT stage, COUNT(*) AS count
FROM content_projects
WHERE processing_status = 'completed'
GROUP BY stage
ORDER BY stage;
```

### Query 1C — Current state of all five target draft projects

```sql
SELECT
  id,
  stage,
  processing_status,
  body IS NOT NULL                            AS has_body,
  char_length(body::text)                     AS body_chars,
  meta_title IS NOT NULL AND meta_title != '' AS has_meta_title,
  consistency_check_result
FROM content_projects
WHERE id IN (27, 53, 87, 88, 89)
ORDER BY id;
```

### Query 1D — FAQ count for each target draft project

```sql
SELECT f._parent_id AS project_id, COUNT(*) AS faq_count
FROM content_projects_faq_section f
WHERE f._parent_id IN (27, 53, 87, 88, 89)
GROUP BY f._parent_id
ORDER BY f._parent_id;
```

### Gate 1: Baseline recorded

```
PASS criteria:
  ALL FOUR queries ran without error.
  Raw output is in the report — not summarised, not paraphrased.
  Query 1C shows that projects 27, 53, 87, 88, 89 each have has_body = true.
  Query 1D shows that each of those five projects has faq_count >= 5.

FAIL action: If any query errors, paste the exact error. STOP.
If has_body = false for any of 27/53/87/88/89, record it. STOP — Part 2 cannot
proceed if draft content is missing.
```

---

## Task 2: Classify Every Completed Record

Using the output of Query 1A, apply the following classification rules to EVERY row.
Write the classification table into the report — one row per record.

### Classification rules

A record is **STALE** if:
- Stage is `'brief'` or `'idea'`: `completed` at these stages can only mean a prior
  stage's status was not reset on advance. Brief shaping and ideation produce
  `target_angle`, `brief_summary` — not `body`. There is no way for a project to
  legitimately hold `processing_status = 'completed'` at brief/idea as a result
  of current-stage work unless those fields are populated. Check: if `body IS NULL`
  AND `has_sections = false`, it is STALE.
- Stage is `'draft'` or `'review'` AND `has_body = false`: drafting did not produce
  output. STALE.

A record is **LEGITIMATE** if:
- Stage is `'research'` AND `has_synthesis = true`: research completed successfully.
- Stage is `'draft'` or `'review'` AND `has_body = true`: drafting completed.
- Stage is `'published'`: terminal stage. NEVER reset. NEVER touch.

A record is **AMBIGUOUS** if it fits neither category clearly. Record it as ambiguous
and explain why. STOP and report — do not reset ambiguous records.

### Classification table format

Write this exact table into the report, one row per completed record:

```
| id | stage | verdict | reason |
|----|-------|---------|--------|
| NN | xxxxxx | STALE / LEGITIMATE / AMBIGUOUS | [one sentence] |
```

After the table, write:

```
STALE_IDS: [comma-separated list, or "NONE" if zero stale records found]
```

### Gate 2: Classification complete

```
PASS criteria:
  Every row from Query 1A appears in the classification table.
  Every STALE record has a clear reason that matches the classification rules above.
  No published record is classified as STALE.
  STALE_IDS list is explicitly stated (even if empty).

FAIL action: If any record cannot be classified, write it as AMBIGUOUS and STOP.
```

---

## Task 3: Pre-Reset Evidence (STALE records only)

If STALE_IDS is "NONE", skip to Task 6.

Run this query using the actual STALE IDs. This is the before-state evidence.

```sql
SELECT
  id,
  stage,
  processing_status,
  processing_error,
  processing_started_at,
  body IS NOT NULL AS has_body,
  updated_at
FROM content_projects
WHERE id = ANY(ARRAY[/* STALE_IDS */])
ORDER BY id;
```

Paste the complete raw output into the report.

Write the STALE_COUNT: the number of rows returned by this query.

### Gate 3: Before-state captured

```
PASS criteria:
  Query ran without error.
  The number of rows returned equals the number of IDs in STALE_IDS.
  All rows show processing_status = 'completed'.
  Raw output pasted verbatim into report.

FAIL action: If the row count doesn't match STALE_IDS length, STOP.
```

---

## Task 4: Reset Stale Records

Run this SQL UPDATE directly (do not use a script — direct SQL is verifiable):

```sql
UPDATE content_projects
SET
  processing_status      = 'idle',
  processing_error       = NULL,
  processing_started_at  = NULL
WHERE id = ANY(ARRAY[/* STALE_IDS */])
  AND processing_status  = 'completed'
  AND stage NOT IN ('published')
RETURNING id, stage, processing_status, processing_error;
```

Paste the complete raw output including the RETURNING clause results and the row count.

The RETURNING clause shows exactly which rows were updated and what they now contain.

### Gate 4: Reset ran

```
PASS criteria:
  The UPDATE ran without error.
  The RETURNING output shows one row per STALE ID.
  Every returned row shows processing_status = 'idle'.
  The number of returned rows equals STALE_COUNT from Gate 3.

FAIL action: If row count < STALE_COUNT, some records were not updated. STOP.
If any returned row still shows processing_status = 'completed', STOP.
```

---

## Task 5: Post-Reset Verification (independent query)

Run this query independently of the UPDATE statement. It is a separate SELECT that
proves the DB state is correct — not a re-read of the RETURNING clause.

```sql
SELECT
  id,
  stage,
  processing_status,
  processing_error,
  processing_started_at,
  updated_at
FROM content_projects
WHERE id = ANY(ARRAY[/* STALE_IDS */])
ORDER BY id;
```

Then run the final integrity check — this query must return zero rows:

```sql
SELECT id, stage, processing_status
FROM content_projects
WHERE id = ANY(ARRAY[/* STALE_IDS */])
  AND processing_status = 'completed';
```

Paste both complete raw outputs.

### Gate 5: Reset verified

```
PASS criteria (BOTH must be true):
  First query: every row shows processing_status = 'idle',
               processing_error = NULL, processing_started_at = NULL.
  Second query: returns ZERO rows (0 rows).

FAIL action: If any stale ID still shows processing_status = 'completed', STOP.
If the second query returns any rows, the reset did not work. STOP.
```

---

## Task 6: Verify Legitimate Records Are Untouched

Run this query to confirm the records classified as LEGITIMATE were not modified:

```sql
SELECT id, stage, processing_status
FROM content_projects
WHERE processing_status = 'completed'
  AND stage != 'published'
ORDER BY id;
```

These remaining completed records must match exactly the IDs classified as
LEGITIMATE (non-stale, non-published) in Task 2.

Then run the final completed-record count:

```sql
SELECT
  COUNT(*)                                            AS total_completed,
  COUNT(*) FILTER (WHERE stage = 'published')         AS published_completed,
  COUNT(*) FILTER (WHERE stage NOT IN ('published'))  AS non_published_completed
FROM content_projects
WHERE processing_status = 'completed';
```

Paste both raw outputs.

### Gate 6: Collateral damage check

```
PASS criteria:
  Every ID in the first query's results was classified as LEGITIMATE in Task 2.
  No STALE ID appears in the first query's results.
  Total counts are consistent with the classification.

FAIL action: If any STALE ID appears in the results, the UPDATE was incorrect. STOP.
If any LEGITIMATE ID is missing, it may have been inadvertently reset. STOP.
```

---

## Task 7: Target Projects Final State

Confirm the five target projects for Part 2 are untouched and publish-ready:

```sql
SELECT
  id,
  stage,
  processing_status,
  body IS NOT NULL                            AS has_body,
  char_length(body::text)                     AS body_chars,
  meta_title IS NOT NULL AND meta_title != '' AS has_meta_title,
  consistency_check_result
FROM content_projects
WHERE id IN (27, 53, 87, 88, 89)
ORDER BY id;
```

```sql
SELECT f._parent_id AS project_id, COUNT(*) AS faq_count
FROM content_projects_faq_section f
WHERE f._parent_id IN (27, 53, 87, 88, 89)
GROUP BY f._parent_id
ORDER BY f._parent_id;
```

Paste both raw outputs.

### Gate 7: Target projects ready

```
PASS criteria for ALL FIVE projects (27, 53, 87, 88, 89):
  stage = 'draft'
  has_body = true
  body_chars > 500
  has_meta_title = true
  faq_count >= 5

FAIL action: If any project fails any condition, record which and why. STOP.
This is a hard blocker — Part 2 depends on these projects being in this state.
```

---

## Task 8: Commit

```bash
cd ~/Projects/kiuli-website
git status
```

Paste raw output.

If git status shows no changes (the reset was done via direct SQL, not file changes),
write "No code changes — SQL-only operation. Nothing to commit." and STOP — this is correct.

If any files were modified during this session (e.g., a script was created):
```bash
git add [only the files modified in this session]
git commit -m "fix: M1 Part 1 — reset stale ghost completion records via direct SQL"
git push
git status
```

Paste all raw outputs.

### Gate 8: Git state clean

```
PASS criteria:
  Either "nothing to commit" (correct for SQL-only reset)
  OR commit succeeded and git status shows clean tree.

FAIL action: Uncommitted changes that were not part of this task. STOP.
```

---

## Report Format

Write to `content-engine/reports/m1-part1-ghost-reset.md`:

```markdown
# M1 Part 1: Ghost Completion Reset

**Date:** [ISO timestamp]
**Executed by:** Claude CLI

## Task 1: Baseline Snapshot

### Query 1A — All completed records
[paste raw SQL output verbatim]

### Query 1B — Count by stage
[paste raw SQL output verbatim]

### Query 1C — Target draft projects
[paste raw SQL output verbatim]

### Query 1D — FAQ counts
[paste raw SQL output verbatim]

### Gate 1: [PASS / FAIL — reason]

---

## Task 2: Classification

[paste classification table]

STALE_IDS: [list or NONE]

### Gate 2: [PASS / FAIL — reason]

---

## Task 3: Pre-Reset Evidence

[paste raw SQL output verbatim]
STALE_COUNT: [n]

### Gate 3: [PASS / FAIL — reason]

---

## Task 4: Reset

[paste UPDATE raw output verbatim including RETURNING results and row count]

### Gate 4: [PASS / FAIL — reason]

---

## Task 5: Post-Reset Verification

[paste first query raw output verbatim]
[paste second query raw output verbatim]

### Gate 5: [PASS / FAIL — reason]

---

## Task 6: Collateral Check

[paste first query raw output verbatim]
[paste second query raw output verbatim]

### Gate 6: [PASS / FAIL — reason]

---

## Task 7: Target Projects

[paste first query raw output verbatim]
[paste second query raw output verbatim]

### Gate 7: [PASS / FAIL — reason]

---

## Task 8: Git State

[paste git status raw output verbatim]
[or: "No code changes — SQL-only operation. Nothing to commit."]

### Gate 8: [PASS / FAIL — reason]

---

## Overall: [ALL GATES PASS / BLOCKED AT GATE N — reason]
```

---

## Stop Conditions

Stop immediately if any gate fails. Write the report to the point of failure.
Do not attempt repair. Do not proceed past a gate failure.
Do not interpret ambiguous results as PASS.
