# M1 Part 1: Ghost Completion Reset

**Date:** 2026-02-22T16:45:00Z
**Executed by:** Claude CLI

## Task 1: Baseline Snapshot

### Query 1A — All completed records

```
 id |   content_type    |   stage   | processing_status | has_body | has_sections | has_synthesis | has_meta_title | has_started_at | has_error |         updated_at
----+-------------------+-----------+-------------------+----------+--------------+---------------+----------------+----------------+-----------+----------------------------
 86 | authority         | brief     | completed         | f        | f            | f             | f              | f              | f         | 2026-02-15 18:20:38.595+00
 54 | itinerary_cluster | research  | completed         | f        | f            | t             | f              | f              | t         | 2026-02-15 22:12:03.3+00
 78 | itinerary_cluster | research  | completed         | f        | f            | t             | f              | f              | t         | 2026-02-20 17:03:21.239+00
 83 | authority         | research  | completed         | f        | f            | t             | f              | f              | t         | 2026-02-15 18:33:29.307+00
 27 | itinerary_cluster | draft     | completed         | t        | f            | t             | t              | t              | f         | 2026-02-17 16:17:48.884+00
 53 | itinerary_cluster | draft     | completed         | t        | f            | t             | t              | t              | f         | 2026-02-17 17:02:37.683+00
 87 | authority         | draft     | completed         | t        | f            | t             | t              | t              | f         | 2026-02-19 11:12:52.778+00
 88 | itinerary_cluster | draft     | completed         | t        | f            | t             | t              | f              | f         | 2026-02-20 09:49:11.842+00
 89 | itinerary_cluster | draft     | completed         | t        | f            | f             | t              | t              | f         | 2026-02-17 17:01:40.851+00
 79 | authority         | published | completed         | t        | f            | t             | t              | t              | f         | 2026-02-18 13:21:53.067+00
(10 rows)
```

### Query 1B — Count by stage

```
   stage   | count
-----------+-------
 brief     |     1
 research  |     3
 draft     |     5
 published |     1
(4 rows)
```

### Query 1C — Target draft projects

```
 id | stage | processing_status | has_body | body_chars | has_meta_title | consistency_check_result
----+-------+-------------------+----------+------------+----------------+--------------------------
 27 | draft | completed         | t        |      22266 | t              | soft_contradiction
 53 | draft | completed         | t        |      26253 | t              | pass
 87 | draft | completed         | t        |      29058 | t              | pass
 88 | draft | completed         | t        |      14997 | t              | not_checked
 89 | draft | completed         | t        |      22116 | t              | pass
(5 rows)
```

### Query 1D — FAQ counts

```
 project_id | faq_count
------------+-----------
         27 |        10
         53 |        10
         87 |        10
         88 |        10
         89 |         8
(5 rows)
```

### Gate 1: PASS

All four queries ran without error. Raw output pasted verbatim. All 5 target projects (27, 53, 87, 88, 89) have has_body = true. All have faq_count >= 5.

---

## Task 2: Classification

| id | stage | verdict | reason |
|----|-------|---------|--------|
| 86 | brief | STALE | Brief stage with body IS NULL and has_sections = false — ghost completion from prior stage advance |
| 54 | research | LEGITIMATE | Research stage with has_synthesis = true — research completed successfully |
| 78 | research | LEGITIMATE | Research stage with has_synthesis = true — research completed successfully |
| 83 | research | LEGITIMATE | Research stage with has_synthesis = true — research completed successfully |
| 27 | draft | LEGITIMATE | Draft stage with has_body = true — drafting completed |
| 53 | draft | LEGITIMATE | Draft stage with has_body = true — drafting completed |
| 87 | draft | LEGITIMATE | Draft stage with has_body = true — drafting completed |
| 88 | draft | LEGITIMATE | Draft stage with has_body = true — drafting completed |
| 89 | draft | LEGITIMATE | Draft stage with has_body = true — drafting completed |
| 79 | published | LEGITIMATE | Terminal published stage — never reset, never touch |

STALE_IDS: 86

### Gate 2: PASS

Every row from Query 1A appears in the classification table. Every STALE record has a clear reason matching the rules. No published record is classified as STALE. STALE_IDS list is explicitly stated.

---

## Task 3: Pre-Reset Evidence

```
 id | stage | processing_status | processing_error | processing_started_at | has_body |         updated_at
----+-------+-------------------+------------------+-----------------------+----------+----------------------------
 86 | brief | completed         |                  |                       | f        | 2026-02-15 18:20:38.595+00
(1 row)
```

STALE_COUNT: 1

### Gate 3: PASS

Query ran without error. 1 row returned matching 1 ID in STALE_IDS. Row shows processing_status = 'completed'. Raw output pasted verbatim.

---

## Task 4: Reset

```
 id | stage | processing_status | processing_error
----+-------+-------------------+------------------
 86 | brief | idle              |
(1 row)

UPDATE 1
```

Method: Direct SQL via psql connected to DATABASE_URL_UNPOOLED (the MCP db_query tool is read-only, so psql was used for the write operation).

### Gate 4: PASS

UPDATE ran without error. RETURNING output shows 1 row for STALE ID 86. Row shows processing_status = 'idle'. 1 returned row equals STALE_COUNT of 1.

---

## Task 5: Post-Reset Verification

First query — current state of reset records:

```
 id | stage | processing_status | processing_error | processing_started_at |         updated_at
----+-------+-------------------+------------------+-----------------------+----------------------------
 86 | brief | idle              |                  |                       | 2026-02-15 18:20:38.595+00
(1 row)
```

Second query — integrity check (must return zero rows):

```
 id | stage | processing_status
----+-------+-------------------
(0 rows)
```

### Gate 5: PASS

First query: record 86 shows processing_status = 'idle', processing_error = NULL, processing_started_at = NULL. Second query: returns ZERO rows — no stale IDs still show 'completed'.

---

## Task 6: Collateral Check

First query — remaining non-published completed records:

```
 id |  stage   | processing_status
----+----------+-------------------
 27 | draft    | completed
 53 | draft    | completed
 54 | research | completed
 78 | research | completed
 83 | research | completed
 87 | draft    | completed
 88 | draft    | completed
 89 | draft    | completed
(8 rows)
```

Second query — completed record counts:

```
 total_completed | published_completed | non_published_completed
-----------------+---------------------+-------------------------
               9 |                   1 |                       8
(1 row)
```

### Gate 6: PASS

Every ID in the first query (27, 53, 54, 78, 83, 87, 88, 89) was classified as LEGITIMATE in Task 2. STALE ID 86 does not appear. Total counts are consistent: 10 original − 1 stale reset = 9 completed (1 published + 8 non-published).

---

## Task 7: Target Projects

First query — target project state:

```
 id | stage | processing_status | has_body | body_chars | has_meta_title | consistency_check_result
----+-------+-------------------+----------+------------+----------------+--------------------------
 27 | draft | completed         | t        |      22266 | t              | soft_contradiction
 53 | draft | completed         | t        |      26253 | t              | pass
 87 | draft | completed         | t        |      29058 | t              | pass
 88 | draft | completed         | t        |      14997 | t              | not_checked
 89 | draft | completed         | t        |      22116 | t              | pass
(5 rows)
```

Second query — FAQ counts:

```
 project_id | faq_count
------------+-----------
         27 |        10
         53 |        10
         87 |        10
         88 |        10
         89 |         8
(5 rows)
```

### Gate 7: PASS

All five target projects meet all criteria:
- 27: stage=draft, has_body=true, body_chars=22266 (>500), has_meta_title=true, faq_count=10 (>=5)
- 53: stage=draft, has_body=true, body_chars=26253 (>500), has_meta_title=true, faq_count=10 (>=5)
- 87: stage=draft, has_body=true, body_chars=29058 (>500), has_meta_title=true, faq_count=10 (>=5)
- 88: stage=draft, has_body=true, body_chars=14997 (>500), has_meta_title=true, faq_count=10 (>=5)
- 89: stage=draft, has_body=true, body_chars=22116 (>500), has_meta_title=true, faq_count=8 (>=5)

---

## Task 8: Git State

```
branch: main
changes:
  ?? content-engine/prompts/m1-part1-ghost-reset.md
  ?? content-engine/prompts/m1-part2-publish-test.md
  ?? content-engine/prompts/phase14a-bugfix4.md
  ?? tools/mcp-server/server.py
unpushed: []
```

No code changes — SQL-only operation. Nothing to commit. The untracked files listed above predate this session and are not related to this task.

### Gate 8: PASS

SQL-only reset produced no code changes. Correct behavior for a direct database operation.

---

## Overall: ALL GATES PASS

One stale ghost completion record (ID 86, stage=brief) was identified and reset to idle. Nine legitimate completed records remain untouched. All five target projects (27, 53, 87, 88, 89) are confirmed ready for Part 2.
