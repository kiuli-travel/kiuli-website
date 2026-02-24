# Step 7 Remediation: Investigate and Fix Two Remaining Issues
## For Claude Code (CLI)

**Context:** Step 7 test scrape (Job 99) passed 9/10 Gate 3 checks. Two issues remain
before Step 7 can be declared complete:

1. **Gate 3I:** All 4 properties have observation_count=2 after a single scrape of a
   clean database. Expected: 1. The dedup check is either not firing or firing too late.

2. **Gate 3F:** 1/6 transfer routes still has a country-type fromDestination
   (Kilimanjaro → Legendary Lodge). CLI stated this was editorial, but that requires
   verification via CloudWatch logs before it can be accepted.

**Philosophy:** Investigate before fixing. Both issues need root cause confirmed before
any code is written. Stop and report after each investigation phase.

---

## Phase A: Investigate Gate 3I — observation_count=2

### A1. Check prop_price_obs table

```sql
-- How many price observation records exist per property?
SELECT p.name, COUNT(ppo.id) as obs_records
FROM properties p
LEFT JOIN prop_price_obs ppo ON ppo._parent_id = p.id
GROUP BY p.id, p.name
ORDER BY p.name;
```

```sql
-- What itinerary IDs are referenced in those observations?
SELECT p.name, ppo.itinerary_id, i.id as itinerary_exists
FROM prop_price_obs ppo
JOIN properties p ON p.id = ppo._parent_id
LEFT JOIN itineraries i ON i.id = ppo.itinerary_id
ORDER BY p.name;
```

Report the exact output. This tells us whether:
- Old observations from itinerary 31 survived Phase B cleanup (dedup seeing wrong itinerary)
- Itinerary 32 appears twice per property (property processed twice in a single job)

### A2. Check CloudWatch logs for orderedPropertyIds

Retrieve the orchestrator log for Job 99. Filter for property sequence data:

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/kiuli-v6-orchestrator \
  --region eu-north-1 \
  --filter-pattern '"orderedProperty" OR "accumulatedData" OR "already recorded" OR "property sequence"' \
  --start-time $(date -d '3 hours ago' +%s000) \
  2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for e in data.get('events', []):
    print(e['message'].strip())
" | head -60
```

Report the exact output. This shows whether:
- The dedup fired (look for "already recorded" messages)
- How many properties were in orderedPropertyIds
- Whether any property appears twice

### A3. After receiving A1 and A2 output — stop and report

Do not proceed to Phase B until you have reported the A1 and A2 results. The fix
depends entirely on which root cause is confirmed.

**Expected root causes (one of these must be true):**

Option X: `prop_price_obs` contains records from itinerary 31 that Phase B did not
delete. The dedup ran but found itinerary 31 ≠ 32, treated it as a new observation,
wrote itinerary 32, leaving 2 records total.

Option Y: A property appears twice in `orderedPropertyIds`. The loop ran twice for
that property. The dedup fired correctly on the second pass but only for some
properties — or the Payload API returned stale data between the two writes.

Option Z: Something else. Report what the logs show.

---

## Phase B: Investigate Gate 3F — Kilimanjaro country fallback

### B1. Check CloudWatch logs for location resolution

```bash
aws logs filter-log-events \
  --log-group-name /aws/lambda/kiuli-v6-orchestrator \
  --region eu-north-1 \
  --filter-pattern '"resolveLocation" OR "Kilimanjaro" OR "nearestDestination"' \
  --start-time $(date -d '3 hours ago' +%s000) \
  2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
for e in data.get('events', []):
    print(e['message'].strip())
" | head -40
```

Report the exact output. We need to see:
- What locationString was passed to resolveLocationToDestination for the Kilimanjaro airport
- Whether it found a match, auto-created a destination, or fell back to country
- What the resulting nearestDestination ID was

### B2. Check current airport and route state

```sql
-- What nearestDestination did each airport get?
SELECT a.name, a.iata_code, d.name as nearest_destination, d.type
FROM airports a
LEFT JOIN destinations d ON d.id = a.nearest_destination_id
ORDER BY a.id;
```

```sql
-- Which route has the country-type fromDestination?
SELECT tr.slug, d.name, d.type
FROM transfer_routes tr
JOIN destinations d ON d.id = tr.from_destination_id
WHERE d.type = 'country'
ORDER BY tr.id;
```

### B3. After receiving B1 and B2 output — stop and report

The acceptable outcomes are:

**Accepted as editorial:** The CloudWatch log shows `resolveLocationToDestination`
was called with a null or empty locationString for the Kilimanjaro airport. The
country fallback is correct behaviour — no location string means no destination can
be inferred. A LocationMapping entry for "Kilimanjaro" → Arusha destination would
fix it without code changes.

**Code bug:** The log shows `resolveLocationToDestination` was called with a non-null
locationString (e.g. "Kilimanjaro") but still fell back to country — either because
the direct name match found nothing (expected), and auto-create failed or returned
the country. If auto-create produced a destination record, it should be destination-
type, not country-type.

---

## Phase C: Apply fixes

**Do not write any code until Phase A and Phase B results are reported and the root
causes are confirmed.**

After reporting, implement only what the root cause analysis demands:

### If Option X (stale prop_price_obs records):
The fix is in Phase B data cleanup — the delete of itinerary 31 did not cascade to
`prop_price_obs`. The dedup code is correct. The cleanup script must explicitly delete
orphaned prop_price_obs records before future scrapes.

Add to the cleanup protocol (document this, no code change needed in handler.js):
```sql
-- Must run before any test scrape to clear orphaned price observations
DELETE FROM prop_price_obs WHERE itinerary_id NOT IN (SELECT id FROM itineraries);
```

Then re-clean and re-scrape to verify observation_count=1.

### If Option Y (property appears twice in orderedPropertyIds):
The fix is in `transform.js`. The `propertySequence` must deduplicate by property ID
before being mapped to `orderedPropertyIds`. Change in `transform()`:

```javascript
// Deduplicate orderedPropertyIds — same property may appear multiple times
// in propertySequence if itinerary visits it on multiple legs
const seenPropertyIds = new Set()
const orderedPropertyIds = propertySequence
  .map(p => p.property)
  .filter(id => {
    if (seenPropertyIds.has(id)) return false
    seenPropertyIds.add(id)
    return true
  })
```

Then re-deploy, re-clean, re-scrape.

### If Gate 3F is confirmed as a code bug:
Report the exact failure mode and stop — do not attempt a fix without Claude Strategic
reviewing the root cause.

### If Gate 3F is confirmed as editorial:
No code change. Document the LocationMapping that is needed:
- externalString: "Kilimanjaro"
- sourceSystem: "itrvl"
- resolvedAs: "destination"
- destination: Arusha (id=34 or the correct Arusha destination ID)

This will be added via the Payload admin UI — not via code.

---

## Phase D: Re-verify after fixes

After applying fixes (whatever they are), run a clean test scrape:

### D1. Clean stale data
```sql
-- Delete everything from the last test scrape
DELETE FROM itinerary_patterns WHERE id > 0;
DELETE FROM itineraries WHERE id > 0;
DELETE FROM transfer_routes WHERE id > 0;
DELETE FROM airports WHERE id > 0;
DELETE FROM service_items WHERE id > 0;
DELETE FROM itinerary_jobs WHERE id > 0;
DELETE FROM prop_price_obs WHERE id > 0;  -- explicit cleanup of observations
UPDATE activities SET observation_count = 0 WHERE id > 0;
UPDATE properties SET
  accumulated_data_observation_count = 0,
  accumulated_data_last_observed_at = NULL,
  accumulated_data_typical_nights_median = NULL,
  accumulated_data_typical_nights_min = NULL,
  accumulated_data_typical_nights_max = NULL,
  accumulated_data_price_positioning_observation_count = 0
WHERE id > 0;
```

Verify after each:
```sql
SELECT COUNT(*) FROM itineraries;           -- 0
SELECT COUNT(*) FROM transfer_routes;       -- 0
SELECT COUNT(*) FROM airports;              -- 0
SELECT COUNT(*) FROM prop_price_obs;        -- 0
SELECT accumulated_data_observation_count FROM properties ORDER BY id;  -- all 0
SELECT observation_count FROM activities WHERE id = 12;                 -- 0
```

### D2. Trigger test scrape
Same Tanzania URL as before:
```bash
curl -s -X POST https://admin.kiuli.com/api/scrape-itinerary \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/LrYsHSgMbxBrZeKDuESwZreUIrTP38pDBttfy9GrsXoDsnvS3ZI096AFr5UOzUL4/680df39120a6c6005b2bfc1e", "mode": "create"}'
```

Poll until complete. Report job ID and final status.

### D3. Run Gate 3I and 3F verification only (the two that failed)

```sql
-- Gate 3I: observation_count must be exactly 1
SELECT name, accumulated_data_observation_count
FROM properties ORDER BY id;
-- Expected: ALL rows show exactly 1

-- Gate 3I supplementary: exactly 1 price observation record per property
SELECT p.name, COUNT(ppo.id) as obs_count
FROM properties p
LEFT JOIN prop_price_obs ppo ON ppo._parent_id = p.id
GROUP BY p.id, p.name
ORDER BY p.name;
-- Expected: ALL rows show exactly 1

-- Gate 3F: fromDestination type check
SELECT tr.slug, d.name, d.type
FROM transfer_routes tr
JOIN destinations d ON d.id = tr.from_destination_id
ORDER BY tr.id;
-- Expected: All type='destination' (or confirmed editorial exception for Kilimanjaro)
```

---

## Report back with

1. Phase A results: A1 SQL output + A2 CloudWatch output + your root cause conclusion
2. Phase B results: B1 CloudWatch output + B2 SQL output + editorial or code bug verdict
3. Phase C: What fix you applied and why
4. Phase D: Verification SQL output

**Do not mark this task complete until Gate 3I shows observation_count=1 for all
properties and Gate 3F is either clean or confirmed editorial with documentation.**

**Do not commit until verification passes.**
