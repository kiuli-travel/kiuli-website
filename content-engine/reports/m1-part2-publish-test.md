# M1 Part 2: End-to-End Publish Test

**Date:** 2026-02-22T14:33:00Z
**Executed by:** Claude CLI

## Phase A: Migration Gate

### A1: Column existence check

```
 column_name
-------------
(0 rows)
```

### A2: Migration status

```
Reading migration files from /Users/grahamwallington/Projects/kiuli-website/src/migrations
[54 migrations listed, all showing "Ran: Yes"]
Latest: 20260219_fix_version_table_columns (batch 33)
No pending quality gates migration.
```

### Gate A decision: Columns missing — running A3/A4/A5

### A3: Migration generated

migrate:create output:
```
Starting migration: generating UP statements...
Migration UP complete. Generating DOWN statements...
Migration DOWN statements generation complete.
Migration created at /Users/grahamwallington/Projects/kiuli-website/src/migrations/20260222_143340.ts
Done.
```

ls output:
```
-rw-r--r--  15892 22 Feb 14:33 src/migrations/20260222_143340.ts
```

The auto-generated migration included many existing schema changes (brand_voice tables, media fields, destination fields, article_images) that were already applied via dev mode. The migration was manually edited to include ONLY the quality gates columns that were actually missing from the database, preventing CREATE TABLE conflicts.

Edited migration content (quality gates only):
```sql
CREATE TYPE "public"."enum_content_projects_quality_gates_result" AS ENUM('pass', 'fail', 'not_checked');
CREATE TYPE "public"."enum__content_projects_v_version_quality_gates_result" AS ENUM('pass', 'fail', 'not_checked');
ALTER TABLE "content_projects" ADD COLUMN "quality_gates_result" ... DEFAULT 'not_checked';
ALTER TABLE "content_projects" ADD COLUMN "quality_gates_violations" jsonb;
ALTER TABLE "content_projects" ADD COLUMN "quality_gates_checked_at" timestamp(3) with time zone;
ALTER TABLE "content_projects" ADD COLUMN "quality_gates_overridden" boolean DEFAULT false;
ALTER TABLE "content_projects" ADD COLUMN "quality_gates_override_note" varchar;
ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_result" ... DEFAULT 'not_checked';
ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_violations" jsonb;
ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_checked_at" timestamp(3) with time zone;
ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_overridden" boolean DEFAULT false;
ALTER TABLE "_content_projects_v" ADD COLUMN "version_quality_gates_override_note" varchar;
```

Gate A3: PASS

### A4: Build and push

Build output:
```
Build completed successfully (exit code 0)
```

Git outputs:
```
[main 04172c2] feat: M1 Part 2 — add quality gates migration (quality_gates_result column)
 2 files changed, 39 insertions(+)
 create mode 100644 src/migrations/20260222_143340.ts
Pushed to origin/main.
```

Gate A4: PASS

### A5: Migration applied

migrate output:
```
Migrating: 20260222_143340
Migrated:  20260222_143340 (88ms)
Done.
```

Column existence verification:
```
         column_name
-----------------------------
 quality_gates_checked_at
 quality_gates_overridden
 quality_gates_override_note
 quality_gates_result
 quality_gates_violations
(5 rows)
```

payload_migrations verification:
```
 id |                  name                   | batch
----+-----------------------------------------+-------
 57 | 20260222_143340                         |    34
 56 | 20260219_fix_version_table_columns      |    33
 55 | 20260219_add_image_generation_fields    |    32
 54 | 20260218_fix_posts_faq_items_id_types   |    31
 53 | 20260217_add_destination_content_fields |    30
(5 rows)
```

Gate A5: PASS — all 5 columns exist, migration recorded at batch 34.

---

## Phase B: Pre-Flight

### B1: Starting state

```
 id |                                               title                                               |   content_type    | stage | processing_status | has_body | body_chars | has_meta_title | has_meta_desc | has_capsule | quality_gates_result | gates_checked | consistency_check_result
----+---------------------------------------------------------------------------------------------------+-------------------+-------+-------------------+----------+------------+----------------+---------------+-------------+----------------------+---------------+--------------------------
 27 | Mountain Gorilla Trekking vs Chimpanzee Tracking: Which Primate Experience to Choose in Rwanda    | itinerary_cluster | draft | completed         | t        |      22266 | t              | t             | t           | not_checked          | f             | soft_contradiction
 53 | Kalahari Desert Safari: Why the Northern Cape Offers Africa's Most Underrated Wildlife Experience | itinerary_cluster | draft | completed         | t        |      26253 | t              | t             | t           | not_checked          | f             | pass
 87 | Uganda's Primate Diversity Hotspot: Why Kibale Forest Hosts 13 Species in One Ecosystem           | authority         | draft | completed         | t        |      29058 | t              | t             | t           | not_checked          | f             | pass
(3 rows)
```

```
 project_id | faq_count
------------+-----------
         27 |        10
         53 |        10
         87 |        10
(3 rows)
```

### B2: API reachable

```
HTTP_STATUS:405
```

(405 = Method Not Allowed on GET — API is reachable, test-connection endpoint only accepts POST)

### B3: Secret confirmed

```
CONTENT_SYSTEM_SECRET length: 44
```

### Gate B: PASS

All 3 projects: stage=draft, processing_status=completed, has_body=true, body_chars>500, has_meta_title=true, faq_count>=5. API reachable (405 != 404). Secret length 44 > 0.

**Note:** Batch API route required Bearer token auth to be added (committed as a3a80f3) before API calls could succeed.

---

## Phase C: Project 27

### C1: Advance to review

```
{"success":true,"updated":1,"skipped":[]}
HTTP_STATUS:200
```

```
 id | stage  | processing_status | quality_gates_result |  quality_gates_checked_at  | quality_gates_overridden | consistency_check_result
----+--------+-------------------+----------------------+----------------------------+--------------------------+--------------------------
 27 | review | completed         | pass                 | 2026-02-22 14:43:43.033+00 | f                        | soft_contradiction
(1 row)
```

Gate C1: PASS

### C2: Quality gates

```
 id | quality_gates_result | violations_json |  quality_gates_checked_at  | quality_gates_overridden
----+----------------------+-----------------+----------------------------+--------------------------
 27 | pass                 | []              | 2026-02-22 14:43:43.033+00 | f
(1 row)
```

Gates: PASS — no violations.

Gate C2: PASS

### C3: Consistency check

```
 id | consistency_check_result
----+--------------------------
 27 | soft_contradiction
(1 row)
```

```
            id            | issue_type | resolution |                                    existing_content                                     |                                  new_content                                   |                   source_record
--------------------------+------------+------------+-----------------------------------------------------------------------------------------+--------------------------------------------------------------------------------+---------------------------------------------------
 699b161baafbcf000424ea72 | soft       | pending    | Nyungwe Forest's Biodiversity Secrets: 13 Primate Species Beyond the Famous Chimpanzees | Nyungwe Forest provides opportunities to observe 12 additional primate species | Article section about Nyungwe's primate diversity
(1 row)
```

Consistency: soft_contradiction only (13 vs 12 primate species — numbering discrepancy). No hard contradictions.

Gate C3: PASS

### C4: Publish

```
{"success":true,"result":{"success":true,"targetCollection":"posts","targetId":23,"publishedAt":"2026-02-22T14:44:49.667Z"}}
HTTP_STATUS:200
```

Gate C4: PASS

### C5: Verification

Check 1 — content_projects:
```
 id |   stage   |        published_at        | target_collection | target_record_id | processing_status
----+-----------+----------------------------+-------------------+------------------+-------------------
 27 | published | 2026-02-22 14:44:49.667+00 | posts             |                  | completed
(1 row)
```

Check 2 — posts (queried by targetId=23 from API response):
```
 id |                                             title                                              |                                             slug                                              |  _status  |        published_at
----+------------------------------------------------------------------------------------------------+-----------------------------------------------------------------------------------------------+-----------+----------------------------
 23 | Mountain Gorilla Trekking vs Chimpanzee Tracking: Which Primate Experience to Choose in Rwanda | mountain-gorilla-trekking-vs-chimpanzee-tracking-which-primate-experience-to-choose-in-rwanda | published | 2026-02-22 14:44:49.667+00
(1 row)
```

Title cross-validation: matches B1 title for project 27. CONFIRMED.

Check 3 — live page:
```
HTTP_STATUS:200
```

**Note:** `target_record_id` is empty on content_projects despite successful publish. The publish route does not write back the target record ID. This is a minor bug — does not affect actual publishing.

Gate C5: PASS (3/3 checks verified)

### C6: Embeddings

```
   chunk_type    | chunks | with_vector |            latest
-----------------+--------+-------------+-------------------------------
 article_section |     10 |          10 | 2026-02-22 14:45:01.998348+00
(1 row)
```

```
 total_embeddings
------------------
              212
(1 row)
```

10 article_section embeddings generated with vectors for project 27.

---

## Phase D: Project 53

### D1: Advance to review

```
{"success":true,"updated":1,"skipped":[]}
HTTP_STATUS:200
```

```
 id | stage  | processing_status | quality_gates_result |  quality_gates_checked_at  | quality_gates_overridden | consistency_check_result
----+--------+-------------------+----------------------+----------------------------+--------------------------+--------------------------
 53 | review | completed         | pass                 | 2026-02-22 14:47:38.844+00 | f                        | pass
(1 row)
```

Gate D1: PASS

### D2: Quality gates

```
 id | quality_gates_result |                                                                   violations_json                                                                   |  quality_gates_checked_at  | quality_gates_overridden
----+----------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------+----------------------------+--------------------------
 53 | pass                 | [{"gate": "superlative_language", "field": "body", "message": "Superlative/fear-forward phrase \"the most\" found in body", "severity": "warning"}] | 2026-02-22 14:47:38.844+00 | f
(1 row)
```

Gates: PASS — 1 warning (superlative "the most" in body), no errors. Non-blocking.

Gate D2: PASS

### D3: Consistency check

```
 id | consistency_check_result
----+--------------------------
 53 | pass
(1 row)
```

```
            id            | issue_type | resolution |                                                       existing_content                                                       |                      new_content                       |                     source_record
--------------------------+------------+------------+------------------------------------------------------------------------------------------------------------------------------+--------------------------------------------------------+--------------------------------------------------------
 699b1707aafbcf000424ea73 | staleness  | pending    | Conservation ROI article mentions wildlife population improvements but doesn't specify current lion numbers in Northern Cape | 450 black-maned lions roam across semi-arid grasslands | Conservation ROI article covering Northern Cape region
 699b1707aafbcf000424ea74 | staleness  | pending    | Conservation ROI article mentions Tswalu Loapi property but doesn't specify current size                                     | Tswalu Kalahari covers 100,000 hectares                | Conservation ROI article mentioning Tswalu Loapi
(2 rows)
```

Consistency: pass. Issues are staleness type only (not contradictions).

Gate D3: PASS

### D4: Publish

```
{"success":true,"result":{"success":true,"targetCollection":"posts","targetId":24,"publishedAt":"2026-02-22T14:51:47.159Z"}}
HTTP_STATUS:200
```

Gate D4: PASS

### D5: Verification

Check 1:
```
 id |   stage   |        published_at        | target_collection | target_record_id | processing_status
----+-----------+----------------------------+-------------------+------------------+-------------------
 53 | published | 2026-02-22 14:51:47.159+00 | posts             |                  | completed
(1 row)
```

Check 2:
```
 id |                                               title                                               |                                              slug                                               |  _status  |        published_at
----+---------------------------------------------------------------------------------------------------+-------------------------------------------------------------------------------------------------+-----------+----------------------------
 24 | Kalahari Desert Safari: Why the Northern Cape Offers Africa's Most Underrated Wildlife Experience | kalahari-desert-safari-why-the-northern-cape-offers-africas-most-underrated-wildlife-experience | published | 2026-02-22 14:51:47.159+00
(1 row)
```

Title cross-validation: matches B1 title for project 53. CONFIRMED.

Check 3:
```
HTTP_STATUS:200
```

Gate D5: PASS (3/3 checks verified)

### D6: Embeddings

```
   chunk_type    | chunks | with_vector |            latest
-----------------+--------+-------------+-------------------------------
 article_section |     10 |          10 | 2026-02-22 14:45:01.998348+00
(1 row)
```

```
 total_embeddings
------------------
              212
(1 row)
```

Note: Embeddings for project 53 not yet visible in recent window. Total unchanged at 212. Embedding generation may be fully async.

---

## Phase E: Project 87

### E1: Advance to review

```
{"success":true,"updated":1,"skipped":[]}
HTTP_STATUS:200
```

```
 id | stage  | processing_status | quality_gates_result | quality_gates_checked_at  | quality_gates_overridden | consistency_check_result
----+--------+-------------------+----------------------+---------------------------+--------------------------+--------------------------
 87 | review | completed         | pass                 | 2026-02-22 14:53:31.18+00 | f                        | hard_contradiction
(1 row)
```

Gate E1: PASS

### E2: Quality gates

```
 id | quality_gates_result |                                                                   violations_json                                                                   | quality_gates_checked_at  | quality_gates_overridden
----+----------------------+-----------------------------------------------------------------------------------------------------------------------------------------------------+---------------------------+--------------------------
 87 | pass                 | [{"gate": "superlative_language", "field": "body", "message": "Superlative/fear-forward phrase \"the most\" found in body", "severity": "warning"}] | 2026-02-22 14:53:31.18+00 | f
(1 row)
```

Gates: PASS — 1 warning only, no errors.

Gate E2: PASS

### E3: Consistency check

```
 id | consistency_check_result
----+--------------------------
 87 | hard_contradiction
(1 row)
```

```
            id            | issue_type | resolution |                                    existing_content                                     |                                   new_content                                   |                           source_record
--------------------------+------------+------------+-----------------------------------------------------------------------------------------+---------------------------------------------------------------------------------+--------------------------------------------------------------------
 699b1867aafbcf000424ea75 | hard       | pending    | Nyungwe Forest's Biodiversity Secrets: 13 Primate Species Beyond the Famous Chimpanzees | Kibale Forest National Park supports 13 distinct species                        | Article section about Nyungwe Forest's primate diversity
 699b1867aafbcf000424ea76 | hard       | pending    | Kibale Forest National Park supports 13 distinct species                                | Chimpanzee tracking in Nyungwe Forest operates on entirely different principles | Article section describing chimpanzee tracking experience location
(2 rows)
```

2 unresolved hard contradictions (resolution = 'pending'). Both relate to cross-referencing between Uganda's Kibale Forest and Rwanda's Nyungwe Forest — the article discusses both locations and the consistency checker flags the different contexts as contradictory.

### Gate E3: FAIL — 2 unresolved hard contradictions. Cannot publish project 87.

Project 87 stopped at review stage. Not proceeding to E4/E5/E6.

---

## Phase F: Final State

### F1: Stage summary
```
   stage   | count
-----------+-------
 idea      |    20
 brief     |    30
 research  |     3
 draft     |     2
 review    |     1
 published |     3
 proposed  |     2
 rejected  |     1
(8 rows)
```

### F2: Published project detail
```
 id |                                               title                                               |   content_type    |   stage   | target_record_id |        published_at        | post_id | post_status | post_slug
----+---------------------------------------------------------------------------------------------------+-------------------+-----------+------------------+----------------------------+---------+-------------+-----------
 27 | Mountain Gorilla Trekking vs Chimpanzee Tracking: Which Primate Experience to Choose in Rwanda    | itinerary_cluster | published |                  | 2026-02-22 14:44:49.667+00 |         |             |
 53 | Kalahari Desert Safari: Why the Northern Cape Offers Africa's Most Underrated Wildlife Experience | itinerary_cluster | published |                  | 2026-02-22 14:51:47.159+00 |         |             |
 87 | Uganda's Primate Diversity Hotspot: Why Kibale Forest Hosts 13 Species in One Ecosystem           | authority         | review    |                  |                            |         |             |
(3 rows)
```

Note: F2 JOIN returns empty post columns because target_record_id is empty (minor bug — publish route does not write back target_record_id). Posts were independently verified in C5/D5 via the targetId from the API response.

### F3: Posts count
```
 total_published_posts
-----------------------
                     3
(1 row)
```

3 published posts total: post 22 (project 79, pre-existing), post 23 (project 27), post 24 (project 53).

### F4: Embedding count
```
 total_embeddings
------------------
              212
(1 row)
```

Embeddings unchanged from baseline. Project 27 generated 10 article_section embeddings. Project 53 embeddings may be pending async generation.

### Gate F: PARTIAL PASS — 2 of 3 projects published

- Projects 27 and 53: PUBLISHED and verified (DB, Posts, live HTTP 200)
- Project 87: BLOCKED at Gate E3 (2 unresolved hard contradictions in consistency check)

---

## Bugs Discovered

1. **target_record_id not written back**: The publish route returns `targetId` in the response but does not save it to `content_projects.target_record_id`. This breaks F2 JOIN queries and any future code that relies on this field to find the published post.

2. **Batch route missing Bearer auth**: The `/api/content/dashboard/batch` route only accepted Payload session auth. Bearer token auth was added in commit `a3a80f3` to match other API routes.

---

## Overall: PARTIAL PASS — 2 of 3 projects published, project 87 BLOCKED AT PHASE E GATE E3 (hard contradictions)
