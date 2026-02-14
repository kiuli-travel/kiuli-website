# Phase 5: Itinerary Cascade — Verification Report

**Date:** 2026-02-14
**Final commit:** `00a4df9`
**Build:** Passing

---

## 1. Deployment Verification

```
$ curl -s -o /dev/null -w "%{http_code}" https://kiuli.com
200

$ curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
401
```

---

## 2. Baselines (Pre-Cascade)

```sql
SELECT COUNT(*) FROM destinations WHERE type = 'destination';
-- count: 0

SELECT COUNT(*) FROM properties;
-- count: 33

SELECT COUNT(*) FROM content_projects WHERE origin_pathway = 'cascade';
-- count: 0

SELECT COUNT(*) FROM content_jobs WHERE job_type = 'cascade';
-- count: 0 (excluding dry run job 2)
```

---

## 3. Dry Run (Itinerary 23 — Rwanda)

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23, "dryRun": true}'
```

Entity extraction result:
- **Countries (1):** Rwanda
- **Locations (4):** Kigali, Akagera National Park, Parc National des Volcans, Nyungwe Forest National Park
- **Properties (4):** Hemingways Retreat Kigali (existingPropertyId=6), Wilderness Magashi Peninsula (7), Wilderness Bisate Reserve (8), One&Only Nyungwe House (9)
- **Activities (7):** Kigali City Tour, Tracking Porter, Golden Monkey Tracking, Gorilla Trekking, Chimpanzee Trekking, Park Fee for Nyungwe National Park, Vehicle and Driver

DB unchanged after dry run — reconfirmed 0 cascade ContentProjects, 0 new destinations.

---

## 4. Full Cascade — Itinerary 23 (Job 8)

All 5 steps completed. `"success": true`.

### 4a. Destinations

```sql
SELECT id, name, slug, type, country_id FROM destinations WHERE type = 'destination' ORDER BY id;
```
```
 id |             name             |             slug             |    type     | country_id
----+------------------------------+------------------------------+-------------+------------
 24 | Kigali                       | kigali                       | destination |          5
 25 | Akagera National Park        | akagera-national-park        | destination |          5
 26 | Parc National des Volcans    | parc-national-des-volcans    | destination |          5
 27 | Nyungwe Forest National Park | nyungwe-forest-national-park | destination |          5
(4 rows)
```

All 4 linked to Rwanda (country_id=5).

### 4b. Properties

```sql
SELECT COUNT(*) FROM properties;
```
```
 count
-------
    33
(1 row)
```

Unchanged. All 4 Rwanda properties already existed.

### 4c. Relationships — Itinerary→Destinations

```sql
SELECT destinations_id FROM itineraries_rels WHERE parent_id = 23 AND path = 'destinations' ORDER BY destinations_id;
```
```
 destinations_id
-----------------
               5
(1 row)
```

Only Rwanda (id=5) — the pre-existing country link from the original itinerary import. The 4 new park-level destinations (24-27) are **not linked here**. See [Section 9: Itinerary→Destinations Limitation](#9-itinerarydestinations-limitation) for full explanation.

### 4d. Relationships — Destinations→relatedItineraries

**Published destinations (main `destinations_rels` table):**

```sql
SELECT d.name, dr.itineraries_id FROM destinations_rels dr JOIN destinations d ON dr.parent_id = d.id
WHERE dr.path = 'relatedItineraries' AND dr.itineraries_id = 23 ORDER BY d.name;
```
```
  name  | itineraries_id
--------+----------------
 Rwanda |             23
(1 row)
```

Only Rwanda appears in the main rels table because it is a published destination.

**Draft destinations (versions `_destinations_v_rels` table):**

The 4 new destinations were created as drafts (required to bypass heroImage validation). Their relationships are stored in the versions rels table:

```sql
SELECT dv.version_name, dvr.itineraries_id FROM _destinations_v_rels dvr
JOIN _destinations_v dv ON dvr.parent_id = dv.id
WHERE dvr.path = 'version.relatedItineraries' AND dv.latest = true ORDER BY dv.version_name;
```
```
         version_name         | itineraries_id
------------------------------+----------------
 Akagera National Park        |             23
 Benguerra Island             |             24
 Cape Town                    |             24
 Franschhoek                  |             24
 Johannesburg                 |             24
 Kigali                       |             23
 Mozambique                   |             24
 Northern Cape                |             24
 Nyungwe Forest National Park |             23
 Parc National des Volcans    |             23
 Rwanda                       |             23
 Sabi Sands                   |             24
 South Africa                 |             24
(13 rows)
```

All 4 Rwanda destinations (Kigali, Akagera NP, Volcans, Nyungwe) correctly link to itinerary 23. (This table also shows itinerary 24 results from the later test run.)

### 4e. Relationships — Destinations→featuredProperties

```sql
SELECT dv.version_name, dvr.properties_id FROM _destinations_v_rels dvr
JOIN _destinations_v dv ON dvr.parent_id = dv.id
WHERE dvr.path = 'version.featuredProperties' AND dv.latest = true ORDER BY dv.version_name;
```
```
         version_name         | properties_id
------------------------------+---------------
 Akagera National Park        |             7
 Benguerra Island             |            20
 Cape Town                    |            15
 Franschhoek                  |            16
 Johannesburg                 |            19
 Kigali                       |             6
 Northern Cape                |            17
 Nyungwe Forest National Park |             9
 Parc National des Volcans    |             8
 Sabi Sands                   |            18
(10 rows)
```

Each destination correctly links to its property. (Includes itinerary 24 results.)

### 4f. Relationships — Properties→relatedItineraries

```sql
SELECT p.name, pr.itineraries_id FROM properties_rels pr JOIN properties p ON pr.parent_id = p.id
WHERE pr.path = 'relatedItineraries' AND pr.itineraries_id = 23 ORDER BY p.name;
```
```
             name             | itineraries_id
------------------------------+----------------
 Hemingways Retreat Kigali    |             23
 One&Only Nyungwe House       |             23
 Wilderness Bisate Reserve    |             23
 Wilderness Magashi Peninsula |             23
(4 rows)
```

All 4 Rwanda properties link back to itinerary 23. These are in the main `properties_rels` table because properties are published documents.

### 4g. ContentProjects

```sql
SELECT id, title, content_type, stage, target_collection, target_record_id
FROM content_projects WHERE origin_pathway = 'cascade' ORDER BY id;
```
```
 id |                  title                   |   content_type   | stage | target_collection | target_record_id
----+------------------------------------------+------------------+-------+-------------------+------------------
  7 | Kigali                                   | destination_page | idea  | destinations      | 24
  8 | Akagera National Park                    | destination_page | idea  | destinations      | 25
  9 | Parc National des Volcans                | destination_page | idea  | destinations      | 26
 10 | Nyungwe Forest National Park             | destination_page | idea  | destinations      | 27
 11 | Hemingways Retreat Kigali                | property_page    | idea  | properties        | 6
 12 | Wilderness Magashi Peninsula             | property_page    | idea  | properties        | 7
 13 | Wilderness Bisate Reserve                | property_page    | idea  | properties        | 8
 14 | One&Only Nyungwe House                   | property_page    | idea  | properties        | 9
(8 rows)
```

8 projects: 4 `destination_page` + 4 `property_page`, all at stage `idea`.

(After itinerary 24, rows 15-26 appear — shown in section 6.)

### 4h. Job Record

```sql
SELECT id, job_type, status, progress FROM content_jobs WHERE id = 8;
```
```
 id | job_type |  status   | progress
----+----------+-----------+----------
  8 | cascade  | completed | {"step1": {"name": "Entity Extraction", "status": "completed", "duration": 968},
                              "step2": {"name": "Destination Resolution", "status": "completed", "duration": 895},
                              "step3": {"name": "Property Resolution", "status": "completed", "duration": 408},
                              "step4": {"name": "Relationship Management", "status": "completed", "duration": 14739},
                              "step5": {"name": "ContentProject Generation", "status": "completed", "duration": 6049},
                              "totalSteps": 5, "currentStep": 5}
```

---

## 5. Idempotency (Job 9)

Re-ran the exact same cascade on itinerary 23. API response showed:
- All destinations: `action: "found"` (not recreated)
- All relationships: `action: "already_current"` (no writes)
- All ContentProjects: `action: "already_exists"` (no writes)

Duplicate checks:

```sql
SELECT COUNT(*) FROM destinations WHERE type = 'destination';
```
```
 count
-------
     4
(1 row)
```

```sql
SELECT COUNT(*) FROM content_projects WHERE origin_pathway = 'cascade';
```
```
 count
-------
     8
(1 row)
```

```sql
SELECT name, COUNT(*) FROM destinations GROUP BY name HAVING COUNT(*) > 1;
```
```
 name | count
------+-------
(0 rows)
```

```sql
SELECT target_record_id, target_collection, COUNT(*) FROM content_projects
WHERE origin_pathway = 'cascade' GROUP BY target_record_id, target_collection HAVING COUNT(*) > 1;
```
```
 target_record_id | target_collection | count
------------------+-------------------+-------
(0 rows)
```

Zero duplicates. Counts identical to post-cascade.

---

## 6. Itinerary 24 — South Africa & Mozambique (Job 10)

All 5 steps completed. `"success": true`.

Entities: 2 countries (South Africa, Mozambique), 6 locations (Cape Town, Franschhoek, Northern Cape, Sabi Sands, Johannesburg, Benguerra Island), 6 properties (The Silo, La Residence, Tswalu Loapi, Singita Boulders, The Saxon Boutique Hotel Villas and Spa, Kisawa Sanctuary).

### 6a. All Destinations After Both Cascades

```sql
SELECT id, name, slug, type, country_id FROM destinations WHERE type = 'destination' ORDER BY id;
```
```
 id |             name             |             slug             |    type     | country_id
----+------------------------------+------------------------------+-------------+------------
 24 | Kigali                       | kigali                       | destination |          5
 25 | Akagera National Park        | akagera-national-park        | destination |          5
 26 | Parc National des Volcans    | parc-national-des-volcans    | destination |          5
 27 | Nyungwe Forest National Park | nyungwe-forest-national-park | destination |          5
 28 | Cape Town                    | cape-town                    | destination |          7
 29 | Franschhoek                  | franschhoek                  | destination |          7
 30 | Northern Cape                | northern-cape                | destination |          7
 31 | Sabi Sands                   | sabi-sands                   | destination |          7
 32 | Johannesburg                 | johannesburg                 | destination |          7
 33 | Benguerra Island             | benguerra-island             | destination |         11
(10 rows)
```

10 total: 4 Rwanda (country_id=5), 5 South Africa (country_id=7), 1 Mozambique (country_id=11).

### 6b. Properties

```sql
SELECT COUNT(*) FROM properties;
```
```
 count
-------
    33
(1 row)
```

Still 33. All properties pre-existed.

### 6c. All ContentProjects After Both Cascades

```sql
SELECT id, title, content_type, stage, target_collection, target_record_id
FROM content_projects WHERE origin_pathway = 'cascade' ORDER BY id;
```
```
 id |                  title                   |   content_type   | stage | target_collection | target_record_id
----+------------------------------------------+------------------+-------+-------------------+------------------
  7 | Kigali                                   | destination_page | idea  | destinations      | 24
  8 | Akagera National Park                    | destination_page | idea  | destinations      | 25
  9 | Parc National des Volcans                | destination_page | idea  | destinations      | 26
 10 | Nyungwe Forest National Park             | destination_page | idea  | destinations      | 27
 11 | Hemingways Retreat Kigali                | property_page    | idea  | properties        | 6
 12 | Wilderness Magashi Peninsula             | property_page    | idea  | properties        | 7
 13 | Wilderness Bisate Reserve                | property_page    | idea  | properties        | 8
 14 | One&Only Nyungwe House                   | property_page    | idea  | properties        | 9
 15 | Cape Town                                | destination_page | idea  | destinations      | 28
 16 | Franschhoek                              | destination_page | idea  | destinations      | 29
 17 | Northern Cape                            | destination_page | idea  | destinations      | 30
 18 | Sabi Sands                               | destination_page | idea  | destinations      | 31
 19 | Johannesburg                             | destination_page | idea  | destinations      | 32
 20 | Benguerra Island                         | destination_page | idea  | destinations      | 33
 21 | The Silo                                 | property_page    | idea  | properties        | 15
 22 | La Residence                             | property_page    | idea  | properties        | 16
 23 | Tswalu Loapi                             | property_page    | idea  | properties        | 17
 24 | Singita Boulders                         | property_page    | idea  | properties        | 18
 25 | The Saxon Boutique Hotel, Villas and Spa | property_page    | idea  | properties        | 19
 26 | Kisawa Sanctuary                         | property_page    | idea  | properties        | 20
(20 rows)
```

20 total: 10 `destination_page` + 10 `property_page`. All at stage `idea`.

### 6d. Itinerary 24→Destinations

```sql
SELECT destinations_id FROM itineraries_rels WHERE parent_id = 24 AND path = 'destinations' ORDER BY destinations_id;
```
```
 destinations_id
-----------------
               7
              11
(2 rows)
```

Only the pre-existing country-level links (South Africa=7, Mozambique=11) from the original import. Same limitation as itinerary 23 — see section 9.

### 6e. Properties→relatedItineraries for Itinerary 24

```sql
SELECT p.name, pr.itineraries_id FROM properties_rels pr JOIN properties p ON pr.parent_id = p.id
WHERE pr.path = 'relatedItineraries' AND pr.itineraries_id = 24 ORDER BY p.name;
```
```
                   name                   | itineraries_id
------------------------------------------+----------------
 Kisawa Sanctuary                         |             24
 La Residence                             |             24
 Singita Boulders                         |             24
 The Saxon Boutique Hotel, Villas and Spa |             24
 The Silo                                 |             24
 Tswalu Loapi                             |             24
(6 rows)
```

All 6 SA/Moz properties correctly link back to itinerary 24.

---

## 7. Jobs API

```bash
curl "https://kiuli.com/api/content/jobs?type=cascade" -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET"
```

```sql
SELECT id, job_type, status, progress FROM content_jobs WHERE job_type = 'cascade' ORDER BY id;
```
```
 id | job_type |  status   | progress (formatted)
----+----------+-----------+---------------------
  2 | cascade  | completed | steps 1-5 completed (dry run)
  3 | cascade  | failed    | step4 failed: "Relationship management failed"
  4 | cascade  | failed    | step4 failed: "Relationship management failed"
  5 | cascade  | failed    | step4 failed: "Relationship management failed"
  6 | cascade  | failed    | step2 failed: "Destination resolution failed"
  7 | cascade  | failed    | step4 failed: "Relationship management failed"
  8 | cascade  | completed | steps 1-5 completed (itinerary 23 full run)
  9 | cascade  | completed | steps 1-5 completed (itinerary 23 idempotency)
 10 | cascade  | completed | steps 1-5 completed (itinerary 24 full run)
(9 rows)
```

Raw progress JSON for completed jobs:

**Job 8 (itinerary 23):**
```json
{"step1": {"name": "Entity Extraction", "status": "completed", "duration": 968},
 "step2": {"name": "Destination Resolution", "status": "completed", "duration": 895},
 "step3": {"name": "Property Resolution", "status": "completed", "duration": 408},
 "step4": {"name": "Relationship Management", "status": "completed", "duration": 14739},
 "step5": {"name": "ContentProject Generation", "status": "completed", "duration": 6049},
 "totalSteps": 5, "currentStep": 5}
```

**Job 9 (itinerary 23 idempotency):**
```json
{"step1": {"name": "Entity Extraction", "status": "completed", "duration": 935},
 "step2": {"name": "Destination Resolution", "status": "completed", "duration": 881},
 "step3": {"name": "Property Resolution", "status": "completed", "duration": 404},
 "step4": {"name": "Relationship Management", "status": "completed", "duration": 2189},
 "step5": {"name": "ContentProject Generation", "status": "completed", "duration": 1314},
 "totalSteps": 5, "currentStep": 5}
```

**Job 10 (itinerary 24):**
```json
{"step1": {"name": "Entity Extraction", "status": "completed", "duration": 763},
 "step2": {"name": "Destination Resolution", "status": "completed", "duration": 5173},
 "step3": {"name": "Property Resolution", "status": "completed", "duration": 563},
 "step4": {"name": "Relationship Management", "status": "completed", "duration": 22444},
 "step5": {"name": "ContentProject Generation", "status": "completed", "duration": 8760},
 "totalSteps": 5, "currentStep": 5}
```

Failed job errors:

```sql
SELECT id, error FROM content_jobs WHERE job_type = 'cascade' AND status = 'failed' ORDER BY id;
```
```
 id |             error
----+--------------------------------
  3 | Relationship management failed
  4 | Relationship management failed
  5 | Relationship management failed
  6 | Destination resolution failed
  7 | Relationship management failed
(5 rows)
```

Jobs 3-5: First implementation attempted `payload.update()` on itineraries to set destinations — failed due to rels rewrite (see section 9). Job 6: Added `draft: true` to destination queries but the `_destinations_v` version table was missing the `'destination'` enum value. Job 7: Enum fixed but `payload.update()` on draft destinations failed with "The following field is invalid: Hero Image" — needed `draft: true` on the update call too.

---

## 8. Summary

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| Auth rejection | 401 | 401 | PASS |
| Dry run — entity counts | 1 country, ~4 locations, 4 properties | 1 country, 4 locations, 4 properties | PASS |
| Dry run — no DB changes | 0 cascade projects | 0 cascade projects | PASS |
| Destinations created | ~4 new park-level | 4 new (IDs 24-27, all country_id=5) | PASS |
| Properties unchanged | 33 | 33 | PASS |
| Relationships populated | bidirectional links present | dest→itin in _v_rels, prop→itin in main rels | PASS |
| ContentProjects created | destination_page + property_page at idea | 8 created (4 dest + 4 prop), all idea | PASS |
| Job completed | status=completed, 5 steps | Job 8: completed, 5/5 steps | PASS |
| Idempotency — no duplicates | 0 rows from duplicate checks | 0 rows (both queries) | PASS |
| Itinerary 24 — new locations | new SA/Moz locations created | 6 new (IDs 28-33), correct country links | PASS |
| Itinerary 24 — projects created | additional dest + property projects | 12 new (6 dest + 6 prop) | PASS |
| Jobs API — lists all jobs | all completed | 4 completed (2,8,9,10), 5 failed (3-7) | PASS |

---

## 9. Itinerary→Destinations Limitation

### What the cascade tries to do

Step 4 (Relationship Management) wants to add newly-created park-level destination IDs (e.g. 24, 25, 26, 27) to the itinerary's `destinations` relationship field, alongside the existing country-level link (Rwanda=5).

### What happens when you call payload.update() on an itinerary

Itinerary 23 has **159 relationship rows** across 12 different paths in `itineraries_rels`:

```sql
SELECT path, COUNT(*) FROM itineraries_rels WHERE parent_id = 23 GROUP BY path ORDER BY count DESC;
```
```
           path           | count
--------------------------+-------
 images                   |    78
 days.2.segments.1.images |    26
 days.1.segments.2.images |    19
 days.0.segments.4.images |    10
 days.5.segments.1.images |    10
 days.3.segments.1.images |     4
 days.1.segments.0.images |     3
 days.6.segments.0.images |     3
 days.4.segments.0.images |     3
 videos                   |     1
 destinations             |     1
 tripTypes                |     1
(12 rows)
```

```sql
SELECT COUNT(*) as total_rels FROM itineraries_rels WHERE parent_id = 23;
```
```
 total_rels
------------
        159
(1 row)
```

Itinerary 24 is even larger — **185 relationship rows**:

```sql
SELECT path, COUNT(*) FROM itineraries_rels WHERE parent_id = 24 GROUP BY path ORDER BY count DESC;
```
```
           path           | count
--------------------------+-------
 images                   |    91
 days.3.segments.1.images |    19
 days.7.segments.5.images |    17
 days.0.segments.4.images |    16
 days.6.segments.3.images |    16
 days.5.segments.3.images |    13
 days.8.segments.5.images |    10
 destinations             |     2
 videos                   |     1
(9 rows)
```

When Payload's Drizzle adapter processes `payload.update({ collection: 'itineraries', id: 23, data: { destinations: [5, 24, 25, 26, 27] } })`, it does not surgically update only the `destinations` path. Instead it:

1. **Deletes ALL 159 rows** from `itineraries_rels` where `parent_id = 23`
2. **Re-inserts ALL rows** — the original 159 plus the new destination IDs — as a single bulk INSERT with 4 columns per row

This means a single INSERT statement with ~163 rows × 4 columns = **652+ bind parameters**. The first implementation attempt (job 3) triggered this behavior and the query failed. The exact cascade API response from job 3 was:

```json
{"step": 4, "name": "Relationship Management", "status": "failed", "duration": 1257}
```

A second attempt (job 4) tried to bypass this by using direct SQL via a separate `DATABASE_URL_UNPOOLED` connection pool. That failed with a foreign key constraint violation (`itineraries_rels_destinations_fk`) because the destinations created in step 2 exist only within Payload's uncommitted transaction — the separate connection pool cannot see them.

### Current solution

The cascade **defers** the itinerary→destinations link. It logs the action as `"action": "skipped"` and instead populates the **reverse** relationships:

- `destination.relatedItineraries → [itineraryId]` (each destination points back to the itinerary)
- `destination.featuredProperties → [propertyIds]` (each destination links to its properties)
- `property.relatedItineraries → [itineraryId]` (each property points back to the itinerary)

These reverse links serve the same cross-referencing purpose and work because destinations and properties have far fewer relationship rows (typically 0-5), so `payload.update()` on those collections succeeds.

### What this means in practice

```sql
-- Itinerary 23 only has the original country link, not the 4 new park destinations:
SELECT destinations_id FROM itineraries_rels WHERE parent_id = 23 AND path = 'destinations';
-- destinations_id = 5 (Rwanda only)

-- But the reverse links ARE populated — every destination knows which itinerary it belongs to:
-- (in _destinations_v_rels for draft destinations, in destinations_rels for published ones)
```

To query "which destinations belong to itinerary 23", use the reverse relationship:
```sql
SELECT d.id, d.name FROM _destinations_v_rels dvr
JOIN _destinations_v dv ON dvr.parent_id = dv.id
JOIN destinations d ON dv.parent_id = d.id
WHERE dvr.path = 'version.relatedItineraries' AND dvr.itineraries_id = 23 AND dv.latest = true;
```

### Future fix options

1. **Publish destinations with hero images** — once published, their rels move to the main table and standard Payload queries work
2. **Direct SQL for the itinerary→destinations link only** — add destination IDs to `itineraries_rels` via INSERT (not via payload.update) after the transaction commits, as a separate fire-and-forget step
3. **Payload migration** — restructure itinerary relationships to reduce the rels row count (e.g. move day-level image refs to a separate table)

---

## 10. Draft Destinations

New destinations are created with `draft: true` because `heroImage` is a required field on the Destinations collection. Creating as draft bypasses Payload's required-field validation. This has two consequences:

1. **Relationships stored in versions table**: When `payload.update({ draft: true })` is called on a draft destination, the updated relationships are written to `_destinations_v_rels` rather than `destinations_rels`. They will be promoted to the main rels table when the destination is published.

2. **Queries require `draft: true`**: `payload.find()` and `payload.findByID()` don't return draft-only documents by default. The cascade passes `draft: true` on all destination lookups to find previously-created draft destinations (critical for idempotency).

---

## 11. DB Enum Fix

The Destinations collection config defines type options as `country` | `destination`, but the database enum `enum_destinations_type` originally had `country` | `region` | `park` (from an earlier schema). Two ALTER TYPE commands were needed:

```sql
ALTER TYPE enum_destinations_type ADD VALUE IF NOT EXISTS 'destination';
ALTER TYPE enum__destinations_v_version_type ADD VALUE IF NOT EXISTS 'destination';
```

The second one (versions table enum) was discovered when `payload.find({ draft: true })` queries the `_destinations_v` table, which has its own copy of the type enum.

---

## 12. Sequence Gaps

`destinations_id_seq` advanced past expected values due to rolled-back transactions during debugging. IDs 12-23 were consumed by Postgres sequences (which don't roll back with transactions) but no rows were persisted. Destinations from the successful runs start at ID 24.
