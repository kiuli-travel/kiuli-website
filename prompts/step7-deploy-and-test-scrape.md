# Step 7: Deploy Orchestrator and Run Test Scrape
## For Claude Code (CLI)

**Context:** This is Step 7 of the Section 20 implementation sequence. Steps 1–6 are complete.
The orchestrator (transform.js + handler.js) was updated in commit bb11f98 with all
Sections 12–18 + Vision 2.0 changes. It has not yet been deployed to AWS. This task
deploys it and verifies the new code runs correctly against a real iTrvl itinerary.

**Philosophy:** No improvisation. Execute each phase in order. Stop and report if
anything produces unexpected output. Do not proceed past a failure.

---

## Pre-conditions (verified by Claude Strategic before issuing this task)

- Gate 2 database state confirmed clean
- Itinerary id=31 exists from old pre-Vision-2.0 scrape — must be deleted
- Transfer routes id=7–12 exist from old scrape, missing Vision 2.0 fields — must be deleted
- Serengeti Balloon Safari (activity id=12) has observation_count=2 from old runs — must be reset
- ItineraryJob id=97 is stale — must be deleted
- Airports, ItineraryPatterns: already empty
- Properties, ServiceItems, Destinations: clean

---

## Phase A: Deploy orchestrator

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda/scripts
./deploy.sh orchestrator
```

Report the full output verbatim. Do not proceed to Phase B unless:
- Script exits 0
- Output shows `DEPLOYMENT SUCCESSFUL`
- Git hash in Description matches `bb11f98`

---

## Phase B: Clean stale data

Connect via `psql $DATABASE_URL_UNPOOLED` and execute each statement, then run
the verification query immediately after. Report both the statement result and
the verification query output.

```sql
-- 1. Delete old itinerary
DELETE FROM itineraries WHERE id = 31;

-- Verify
SELECT COUNT(*) FROM itineraries;
-- Expected: 0

-- 2. Delete old transfer routes
DELETE FROM transfer_routes WHERE id IN (7, 8, 9, 10, 11, 12);

-- Verify
SELECT COUNT(*) FROM transfer_routes;
-- Expected: 0

-- 3. Delete old ItineraryJob
DELETE FROM itinerary_jobs WHERE id = 97;

-- Verify
SELECT COUNT(*) FROM itinerary_jobs;
-- Expected: 0

-- 4. Reset Balloon Safari observation count
UPDATE activities SET observation_count = 0 WHERE id = 12;

-- Verify
SELECT id, name, observation_count FROM activities WHERE id = 12;
-- Expected: observation_count = 0
```

---

## Phase C: Test scrape

### C1. Trigger scrape

```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "create"}'
```

Report the full response. Capture the jobId.

### C2. Poll until complete

```bash
JOB_ID=<id from response>
while true; do
  STATUS=$(curl -s "https://admin.kiuli.com/api/itinerary-jobs/$JOB_ID?depth=0" \
    -H "Authorization: Bearer $PAYLOAD_API_KEY" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))")
  echo "$(date -u +%H:%M:%S) — $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 15
done
```

### C3. If status is "failed", retrieve error details

```bash
curl -s "https://admin.kiuli.com/api/itinerary-jobs/$JOB_ID?depth=0" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('error:', d.get('error','')); print('phase:', d.get('errorPhase',''))"
```

Report final job status. If failed, stop here and report the error — do not proceed
to Phase D.

---

## Phase D: Gate 3 verification

Run all queries via `psql $DATABASE_URL_UNPOOLED`. Report the exact output of every
query — do not summarise or paraphrase.

```sql
-- Gate 3A: No properties linked to country-type destinations
SELECT p.name, d.name, d.type
FROM properties p JOIN destinations d ON p.destination_id = d.id
WHERE d.type = 'country';
-- Expected: 0 rows

-- Gate 3B: Activity count (no 'other' type possible — enum removed)
SELECT id, name, type, observation_count FROM activities ORDER BY id;
-- Expected: at least 1 row, Serengeti Balloon Safari present, observation_count=1

-- Gate 3C: Airports table populated
SELECT id, name, iata_code, type FROM airports ORDER BY id;
-- Expected: at least 1 row containing Kilimanjaro, iata_code='JRO', type='international'

-- Gate 3D: ServiceItems retain correct service_direction
SELECT name, service_direction FROM service_items WHERE category = 'airport_service';
-- Expected: rows with 'arrival' and 'departure' values

-- Gate 3E: ItineraryPatterns has both countries and regions
SELECT path, COUNT(*) FROM itinerary_patterns_rels GROUP BY path ORDER BY path;
-- Expected: both 'countries' and 'regions' paths present

-- Gate 3F: TransferRoutes have destination-type fromDestination (not country-type)
SELECT tr.slug, d.name, d.type
FROM transfer_routes tr
JOIN destinations d ON d.id = tr.from_destination_id
ORDER BY tr.id;
-- Expected: all d.type='destination', none='country'

-- Gate 3G: At least one TransferRoute has fromAirport or toAirport set
SELECT id, slug, from_airport_id, to_airport_id
FROM transfer_routes
WHERE from_airport_id IS NOT NULL OR to_airport_id IS NOT NULL;
-- Expected: >= 1 row

-- Gate 3H: Properties have Vision 2.0 externalIds populated
SELECT name, external_ids_itrvl_supplier_code, external_ids_itrvl_property_name
FROM properties
ORDER BY id;
-- Expected: all 4 properties have itrvlPropertyName set;
--           itrvlSupplierCode set where iTrvl provided it

-- Gate 3I: Properties have accumulatedData observations
SELECT name,
  accumulated_data_observation_count,
  accumulated_data_typical_nights_median
FROM properties
ORDER BY id;
-- Expected: all 4 properties have observation_count >= 1

-- Gate 3J: ItineraryPatterns record exists
SELECT id, total_nights, pax_type, price_tier FROM itinerary_patterns ORDER BY id;
-- Expected: 1 row

-- Gate 3K: Transfer routes have fromProperty or toProperty set
SELECT slug, from_property_id, to_property_id
FROM transfer_routes
WHERE from_property_id IS NOT NULL OR to_property_id IS NOT NULL
ORDER BY id;
-- Expected: >= 1 row (routes between properties should have these set)
```

---

## Report back with

1. Full deploy.sh output (Phase A)
2. Row counts after each delete + update (Phase B)
3. Job ID, final status, and if failed: full error details (Phase C)
4. Exact output of every Gate 3 query (Phase D)

**Do not mark this task complete until:**
- Deploy.sh shows DEPLOYMENT SUCCESSFUL with hash bb11f98
- All Phase B verifications return expected counts
- Job status is "completed"
- All Gate 3 queries return expected results

**Do not commit anything in this task.** This is a deploy-and-verify task only.
