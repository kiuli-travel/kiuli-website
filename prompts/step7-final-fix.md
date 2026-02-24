# Step 7 Final Fix: resolveLocationToDestination + Cleanup Script
## For Claude Code (CLI)

**Context:** Two blockers remain before Step 7 can be declared complete.

1. **Code bug:** `resolveLocationToDestination()` step 3 POSTs to `/api/destinations`
   without `?draft=true` on the URL. Payload CMS enforces required field validation
   (heroImage is required on Destinations) unless the draft query parameter is present.
   The result: every new location string that is not already in the database falls back
   to country ID. This is systemic — it affects every future itinerary with a new
   property location, not just Kilimanjaro.

2. **Missing cleanup script:** The version table cleanup was documented in a report
   but never committed. It must be a committed file so future test scrapes start from
   a genuinely clean state.

---

## Phase A: Fix `resolveLocationToDestination()`

Open `lambda/orchestrator/transform.js`.

Find this exact line in `resolveLocationToDestination()` step 3:

```javascript
    const createRes = await fetch(`${PAYLOAD_API_URL}/api/destinations`, {
```

Replace it with:

```javascript
    const createRes = await fetch(`${PAYLOAD_API_URL}/api/destinations?draft=true`, {
```

That is the entire code change. One line. Do not touch anything else in this function
or anywhere else in transform.js.

After making the change, verify it:

```bash
grep -n "api/destinations?draft=true" lambda/orchestrator/transform.js
```

Expected: exactly 1 match at the step 3 create line.

Then syntax check:

```bash
node --check lambda/orchestrator/transform.js
```

Expected: exit 0, no output.

---

## Phase B: Write cleanup script

Create `lambda/scripts/clean-test-data.sql` with the following content exactly:

```sql
-- Kiuli test scrape cleanup script
-- Run via: psql $DATABASE_URL_UNPOOLED -f lambda/scripts/clean-test-data.sql
--
-- Must be run before any test scrape to guarantee a clean baseline.
-- Includes Payload CMS version tables — raw SQL DELETE of main tables
-- does NOT remove version table data, which causes observation dedup to
-- see stale records and double-count on subsequent scrapes.
--
-- WARNING: Deletes ALL itineraries, knowledge base records, and test data.
-- Never run on production with real itinerary data present.

-- 1. Knowledge base (no FK dependencies on other KB tables)
DELETE FROM itinerary_patterns;
DELETE FROM airports;
DELETE FROM service_items;
DELETE FROM transfer_routes;

-- 2. Price observations (main + version tables)
DELETE FROM prop_price_obs;
DELETE FROM _prop_price_obs_v;

-- 3. Reset property accumulatedData (main + version tables)
UPDATE properties SET
  accumulated_data_observation_count = 0,
  accumulated_data_last_observed_at = NULL,
  accumulated_data_typical_nights_median = NULL,
  accumulated_data_typical_nights_min = NULL,
  accumulated_data_typical_nights_max = NULL,
  accumulated_data_price_positioning_observation_count = 0
WHERE id > 0;

UPDATE _properties_v SET
  version_accumulated_data_observation_count = 0,
  version_accumulated_data_last_observed_at = NULL,
  version_accumulated_data_typical_nights_median = NULL,
  version_accumulated_data_typical_nights_min = NULL,
  version_accumulated_data_typical_nights_max = NULL,
  version_accumulated_data_price_positioning_observation_count = 0
WHERE id > 0;

-- 4. Reset activity observation counts
UPDATE activities SET
  observation_count = 0
WHERE id > 0;

-- 5. Job dependencies (image_statuses references itinerary_jobs)
DELETE FROM image_statuses;
DELETE FROM itinerary_jobs;

-- 6. Itineraries (last — other tables may reference itinerary IDs)
DELETE FROM itineraries;

-- Verification — all counts must be 0 or NULL
SELECT 'itineraries' as tbl, COUNT(*) FROM itineraries
UNION ALL SELECT 'transfer_routes', COUNT(*) FROM transfer_routes
UNION ALL SELECT 'airports', COUNT(*) FROM airports
UNION ALL SELECT 'service_items', COUNT(*) FROM service_items
UNION ALL SELECT 'itinerary_patterns', COUNT(*) FROM itinerary_patterns
UNION ALL SELECT 'prop_price_obs', COUNT(*) FROM prop_price_obs
UNION ALL SELECT '_prop_price_obs_v', COUNT(*) FROM _prop_price_obs_v
UNION ALL SELECT 'itinerary_jobs', COUNT(*) FROM itinerary_jobs;

SELECT name, accumulated_data_observation_count FROM properties ORDER BY id;
-- Expected: all rows show 0

SELECT id, name, observation_count FROM activities ORDER BY id;
-- Expected: all rows show 0
```

---

## Phase C: Deploy orchestrator

```bash
cd /Users/grahamwallington/Projects/kiuli-website/lambda/scripts
./deploy.sh orchestrator
```

Report the full output. Do not proceed unless:
- Script exits 0
- Output shows `DEPLOYMENT SUCCESSFUL`

---

## Phase D: Run clean test scrape

### D1. Clean all test data

```bash
psql $DATABASE_URL_UNPOOLED -f /Users/grahamwallington/Projects/kiuli-website/lambda/scripts/clean-test-data.sql
```

Report the full output of the script including the verification SELECT at the end.
All counts must be 0 before proceeding.

### D2. Trigger test scrape

```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "create"}'
```

Poll until complete. If failed, report the full error before stopping.

---

## Phase E: Verification — untruncated output required

Run each query via `psql $DATABASE_URL_UNPOOLED`. Copy and paste the exact terminal
output for every query. Do not summarise. Do not truncate.

```sql
-- Gate 3F: fromDestination types — all must be type='destination'
SELECT tr.slug, d.name AS from_destination, d.type
FROM transfer_routes tr
JOIN destinations d ON d.id = tr.from_destination_id
ORDER BY tr.id;
```

Expected: All rows show type='destination'. Zero rows with type='country'.

If any row shows type='country', report the slug and destination name — this indicates
`resolveLocationToDestination` still failed for that location string.

```sql
-- Gate 3I: observation_count must be exactly 1 for all properties
SELECT name, accumulated_data_observation_count
FROM properties
ORDER BY id;
```

Expected: All 4 rows show exactly 1.

```sql
-- Gate 3I supplementary: exactly 1 prop_price_obs record per property
SELECT p.name, COUNT(ppo.id) AS obs_count
FROM properties p
LEFT JOIN prop_price_obs ppo ON ppo._parent_id = p.id
GROUP BY p.id, p.name
ORDER BY p.name;
```

Expected: All 4 rows show exactly 1.

```sql
-- Gate 3A: no properties on country-type destinations (regression check)
SELECT p.name, d.name, d.type
FROM properties p
JOIN destinations d ON p.destination_id = d.id
WHERE d.type = 'country';
```

Expected: 0 rows.

```sql
-- Bonus: verify auto-created destinations are type='destination' not 'country'
SELECT name, type, slug FROM destinations ORDER BY id;
```

Report all rows. New destinations auto-created by resolveLocationToDestination must
show type='destination', not type='country'.

---

## Phase F: Commit

Only after ALL Phase E queries produce expected results:

```bash
git add lambda/orchestrator/transform.js lambda/scripts/clean-test-data.sql
```

Commit message:
```
fix(orchestrator): add ?draft=true to destination auto-create URL

resolveLocationToDestination() step 3 was posting to /api/destinations
without ?draft=true, causing Payload to enforce required field validation
(heroImage) and reject all auto-create attempts. Every new location string
fell back to country ID instead of auto-creating a destination-type record.

Also add lambda/scripts/clean-test-data.sql — canonical cleanup script
for test scrapes, including Payload version table cleanup to prevent
stale prop_price_obs_v records causing double observation counts.
```

Then push.

---

## Report back with

1. Output of `grep` and `node --check` (Phase A)
2. Confirmation clean-test-data.sql was created (Phase B)
3. Full deploy.sh output (Phase C)
4. Full output of clean-test-data.sql including verification rows (Phase D1)
5. Job ID and final status (Phase D2)
6. **Untruncated** output of all five Phase E queries
7. Git commit hash after push (Phase F)

**Do not mark this task complete until:**
- Gate 3F shows zero country-type fromDestination rows
- Gate 3I shows observation_count=1 for all 4 properties
- Gate 3I supplementary shows exactly 1 prop_price_obs per property
- Gate 3A shows 0 rows
- Commit is pushed
