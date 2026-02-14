# Phase 5 Verification: Itinerary Cascade Testing

## Context

Phase 5 implementation is complete — all files created, build passes. Now verify every code path with real data. Run each test sequentially. If any test fails, stop and report the failure. Do not proceed past a failed test.

## Pre-flight

Before any tests, verify the endpoint exists and rejects bad auth:

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

**Expected:** 401. If not 401, stop and fix.

## Test 1: Dry Run (Itinerary 23 — Rwanda)

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23, "dryRun": true}'
```

Record the full JSON response. Verify:

- `result.steps[0]` (entity extraction) shows entities with:
  - countries: should include "Rwanda"
  - locations: should include parks/regions from the stay blocks (Kigali, Akagera National Park, Parc National des Volcans, Nyungwe Forest National Park — or similar)
  - properties: should include all 4 (Hemingways Retreat Kigali, Wilderness Magashi Peninsula, Wilderness Bisate Reserve, One&Only Nyungwe House)
- No records created in DB (dry run):
  ```sql
  SELECT COUNT(*) FROM destinations WHERE type = 'destination';
  -- Record this count as BASELINE_DEST_COUNT
  
  SELECT COUNT(*) FROM content_projects WHERE origin_pathway = 'cascade';
  -- Should be 0
  ```

## Test 2: Full Cascade (Itinerary 23)

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

Record the full JSON response. Then verify every step with DB queries:

### Step 2 verification — new destinations:
```sql
SELECT id, name, slug, type, country_id 
FROM destinations 
WHERE type = 'destination' 
ORDER BY id;
```
Record all rows. Each new park/location should have `country_id` pointing to Rwanda (id=5).

### Step 3 verification — properties:
```sql
SELECT COUNT(*) FROM properties;
```
Should still be 33 (all 4 Rwanda properties already exist).

### Step 4 verification — relationships:
```sql
-- Itinerary → destinations (should include new park-level IDs)
SELECT destinations_id FROM itineraries_rels 
WHERE parent_id = 23 AND path = 'destinations'
ORDER BY destinations_id;

-- Destinations → relatedItineraries (backfilled)
SELECT d.name, dr.itineraries_id 
FROM destinations_rels dr 
JOIN destinations d ON dr.parent_id = d.id 
WHERE dr.path = 'relatedItineraries' AND dr.itineraries_id = 23
ORDER BY d.name;

-- Properties → relatedItineraries for Rwanda properties
SELECT p.name, pr.itineraries_id 
FROM properties_rels pr 
JOIN properties p ON pr.parent_id = p.id 
WHERE pr.path = 'relatedItineraries' AND pr.itineraries_id = 23
ORDER BY p.name;
```

### Step 5 verification — ContentProjects:
```sql
SELECT id, title, content_type, stage, target_collection, target_record_id, origin_pathway
FROM content_projects
WHERE origin_pathway = 'cascade'
ORDER BY id;
```
Record all rows. Expect:
- `destination_page` projects for each new park-level destination
- `property_page` projects for each of the 4 Rwanda properties
- All at stage `idea`

### Job tracking:
```sql
SELECT id, job_type, status, progress, error
FROM content_jobs
WHERE job_type = 'cascade'
ORDER BY id DESC
LIMIT 1;
```
Should show status = 'completed', progress with all 5 steps marked complete.

## Test 3: Idempotency

Run the exact same cascade again:

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

Then verify nothing duplicated:
```sql
-- Same destination count as after Test 2
SELECT COUNT(*) FROM destinations WHERE type = 'destination';

-- Same ContentProject count as after Test 2
SELECT COUNT(*) FROM content_projects WHERE origin_pathway = 'cascade';

-- No duplicate destinations by name
SELECT name, COUNT(*) FROM destinations GROUP BY name HAVING COUNT(*) > 1;
-- Should return 0 rows

-- No duplicate ContentProjects by target
SELECT target_record_id, target_collection, COUNT(*) 
FROM content_projects 
WHERE origin_pathway = 'cascade' 
GROUP BY target_record_id, target_collection 
HAVING COUNT(*) > 1;
-- Should return 0 rows
```

The cascade response should show all actions as 'found' / 'already_exists' / 'existed'.

## Test 4: Second Itinerary (Itinerary 24 — South Africa & Mozambique)

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 24}'
```

Record full response. Then verify:

```sql
-- New locations created for SA + Mozambique stays
SELECT id, name, slug, type, country_id 
FROM destinations 
WHERE type = 'destination' 
ORDER BY id;

-- Properties still 33 (all already exist)
SELECT COUNT(*) FROM properties;

-- ContentProjects: new destination_page + property_page projects
SELECT id, title, content_type, target_record_id
FROM content_projects
WHERE origin_pathway = 'cascade'
ORDER BY id;

-- Itinerary 24 linked to destinations
SELECT destinations_id FROM itineraries_rels 
WHERE parent_id = 24 AND path = 'destinations'
ORDER BY destinations_id;
```

## Test 5: Jobs API

```bash
curl "https://kiuli.com/api/content/jobs?type=cascade" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET"
```

Should return all cascade jobs from Tests 2, 3, and 4. All with status 'completed'.

## Report

Create `content-engine/reports/phase5-itinerary-cascade.md` with:

1. Auth rejection result (status code)
2. Dry run response (full JSON or key summary)
3. Full cascade response for itinerary 23 (key summary)
4. DB evidence tables for each verification query (paste actual query output)
5. Idempotency verification (counts before and after, duplicate check results)
6. Itinerary 24 results (new destinations, projects created)
7. Jobs API response summary
8. Summary table:

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| Auth rejection | 401 | ? | ? |
| Dry run — entity counts | 1 country, ~4 locations, 4 properties | ? | ? |
| Dry run — no DB changes | 0 cascade projects | ? | ? |
| Full cascade — destinations created | ~4 new park-level | ? | ? |
| Full cascade — properties unchanged | 33 | ? | ? |
| Full cascade — relationships populated | bidirectional links present | ? | ? |
| Full cascade — projects created | destination_page + property_page | ? | ? |
| Full cascade — job completed | status = completed, 5 steps | ? | ? |
| Idempotency — no duplicates | 0 rows from duplicate checks | ? | ? |
| Itinerary 24 — new locations | new SA/Moz locations created | ? | ? |
| Itinerary 24 — projects created | additional destination + property projects | ? | ? |
| Jobs API — lists all jobs | 3+ cascade jobs, all completed | ? | ? |

If ANY test fails, stop. Report the failure, the actual output, and the error. Do not fabricate passing results.
