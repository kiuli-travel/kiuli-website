# M3: Section 19 Data Fixes

**Source of truth:** KIULI_CANONICAL_SCHEMA_SPEC.md Section 19  
**Scope:** Data fixes only — no schema changes, no migration, no scraper changes  
**Gate:** All 7 Gate 2 queries must pass before this task is complete

---

## Confirmed Pre-Flight State (verified by Claude.ai before this prompt was written)

Do not re-query what is already confirmed. Proceed directly to Step A.

```
Properties (all currently point to destination_id=3, Tanzania country — WRONG):
  id=39  Legendary Lodge     → should be Arusha (id=34)
  id=40  Little Chem Chem    → should be Tarangire National Park (id=35)
  id=41  Nyasi Tented Camp   → should be Serengeti National Park (DOES NOT EXIST YET)
  id=42  Mwiba Lodge         → should be Mwiba Wildlife Reserve (id=37)

Activities:
  id=8   Meet and Assist - Kilimanjaro Int Airport Arrival         type=other  → DELETE
  id=9   VIP Lounge -  Kilimanjaro International Airport Arrival   type=other  → DELETE (note: has leading space in name)
  id=10  Serengeti Camping Fee                                     type=other  → DELETE
  id=11   Serengeti National Park Fee                              type=other  → DELETE (note: has leading space in name)
  id=12  Serengeti Balloon Safari                                  type=balloon_flight  → KEEP, fix destination
  id=13  Meet and Assist - Kilimanjaro Int Airport Departure       type=other  → DELETE
  id=14  VIP Lounge -  Kilimanjaro International Airport Departure type=other  → DELETE

Activity id=12 current destination: Tanzania (id=3, type=country) — WRONG, fix to Serengeti National Park

activities_rels rows for ids 8,9,10,11,13,14:
  16 rows across paths: destinations, observedInItineraries, properties
  No activities_suitability rows for any of these ids
  No _activities_v table — Activities is NOT versioned

Destination id=36 (Serengeti Mobile) — not referenced by any properties or itinerary_patterns_rels
  Can be deleted after Step B sets Nyasi to SERENGETI_ID

ServiceItems table: 0 rows (empty)
ItineraryPatterns: id=2 exists, regions and serviceItems fields available after schema v3.0 migration
```

---

## Critical Corrections to Spec Step E

The spec says to delete from `_activities_v` and `_activities_v_rels`. **These tables do not exist** — Activities is not versioned. The correct delete sequence is:

```sql
DELETE FROM activities_rels WHERE parent_id IN (8, 9, 10, 11, 13, 14);
DELETE FROM activities WHERE id IN (8, 9, 10, 11, 13, 14);
```

That is all. No version tables exist. No suitability rows exist for these IDs.

---

## Step A: Create Serengeti National Park destination

Make this API call. Record the returned ID — it is SERENGETI_ID used in all subsequent steps.

```
POST https://kiuli.com/api/destinations
Headers: Authorization: Bearer <PAYLOAD_API_KEY>
Content-Type: application/json

{
  "name": "Serengeti National Park",
  "slug": "serengeti-national-park",
  "type": "destination",
  "country": 3,
  "_status": "draft"
}
```

**Gate A — Run immediately after POST:**
```sql
SELECT id, name, type, country_id FROM destinations WHERE slug = 'serengeti-national-park';
```
Expected: exactly 1 row, type='destination', country_id=3.

DO NOT PROCEED to Step B until Gate A passes.

---

## Step B: Fix Nyasi Tented Camp destination

```
PATCH https://kiuli.com/api/properties/41
Headers: Authorization: Bearer <PAYLOAD_API_KEY>
Content-Type: application/json

{
  "destination": <SERENGETI_ID>
}
```

**Gate B:**
```sql
SELECT destination_id FROM properties WHERE id = 41;
```
Expected: `<SERENGETI_ID>`.

DO NOT PROCEED to Step C until Gate B passes.

---

## Step C: Fix remaining 3 property destinations

Three separate PATCH calls:

```
PATCH https://kiuli.com/api/properties/42
{ "destination": 37 }
// Mwiba Lodge → Mwiba Wildlife Reserve

PATCH https://kiuli.com/api/properties/40
{ "destination": 35 }
// Little Chem Chem → Tarangire National Park

PATCH https://kiuli.com/api/properties/39
{ "destination": 34 }
// Legendary Lodge → Arusha
```

**Gate C:**
```sql
SELECT p.name, d.name AS destination, d.type
FROM properties p JOIN destinations d ON p.destination_id = d.id
ORDER BY p.id;
```
Expected — exactly these 4 rows, no others:
```
Legendary Lodge   | Arusha                  | destination
Little Chem Chem  | Tarangire National Park | destination
Nyasi Tented Camp | Serengeti National Park | destination
Mwiba Lodge       | Mwiba Wildlife Reserve  | destination
```
Any deviation (wrong name, type='country', wrong count) = FAIL. Report and stop.

DO NOT PROCEED to Step D until Gate C passes.

---

## Step D: Create 6 ServiceItems

Six separate POST calls. Use exact values — names, slugs, categories, levels, and directions are prescribed. 

Note: The names mirror the original Activities names EXCEPT id=9 and id=11 which had leading spaces — the ServiceItem names are trimmed (no leading space).

```
POST https://kiuli.com/api/service-items

1. {
  "name": "Meet and Assist - Kilimanjaro Int Airport Arrival",
  "slug": "meet-and-assist-kilimanjaro-int-airport-arrival",
  "category": "airport_service",
  "serviceLevel": "premium",
  "serviceDirection": "arrival",
  "isInclusionIndicator": true,
  "observationCount": 1
}

2. {
  "name": "VIP Lounge - Kilimanjaro International Airport Arrival",
  "slug": "vip-lounge-kilimanjaro-international-airport-arrival",
  "category": "airport_service",
  "serviceLevel": "ultra_premium",
  "serviceDirection": "arrival",
  "isInclusionIndicator": true,
  "observationCount": 1
}

3. {
  "name": "Serengeti Camping Fee",
  "slug": "serengeti-camping-fee",
  "category": "park_fee",
  "serviceLevel": "standard",
  "serviceDirection": "na",
  "isInclusionIndicator": true,
  "observationCount": 1
}

4. {
  "name": "Serengeti National Park Fee",
  "slug": "serengeti-national-park-fee",
  "category": "park_fee",
  "serviceLevel": "standard",
  "serviceDirection": "na",
  "isInclusionIndicator": true,
  "observationCount": 1
}

5. {
  "name": "Meet and Assist - Kilimanjaro Int Airport Departure",
  "slug": "meet-and-assist-kilimanjaro-int-airport-departure",
  "category": "airport_service",
  "serviceLevel": "premium",
  "serviceDirection": "departure",
  "isInclusionIndicator": true,
  "observationCount": 1
}

6. {
  "name": "VIP Lounge - Kilimanjaro International Airport Departure",
  "slug": "vip-lounge-kilimanjaro-international-airport-departure",
  "category": "airport_service",
  "serviceLevel": "ultra_premium",
  "serviceDirection": "departure",
  "isInclusionIndicator": true,
  "observationCount": 1
}
```

Record the 6 returned IDs as SERVICE_ITEM_IDS = [id1, id2, id3, id4, id5, id6] in creation order.

**Gate D:**
```sql
SELECT id, name, category, service_level, service_direction FROM service_items ORDER BY id;
```
Expected: exactly 6 rows.
- 2 rows with service_direction='arrival'
- 2 rows with service_direction='departure'  
- 2 rows with service_direction='na'
- 0 rows with service_direction=NULL

Any missing row, wrong direction, or wrong count = FAIL. Report and stop.

DO NOT PROCEED to Step E until Gate D passes.

---

## Step E: Delete Activity records 8, 9, 10, 11, 13, 14

**Important:** `_activities_v` does not exist — Activities is not versioned. Do not attempt to delete from it.

Run these two SQL statements in order:

```sql
DELETE FROM activities_rels WHERE parent_id IN (8, 9, 10, 11, 13, 14);
DELETE FROM activities WHERE id IN (8, 9, 10, 11, 13, 14);
```

Use `db_exec` with `confirm: "EXECUTE"` for each statement.

**Gate E:**
```sql
SELECT id, name, type FROM activities;
```
Expected: exactly 1 row — id=12, name='Serengeti Balloon Safari', type='balloon_flight'.

Any other result = FAIL. Report and stop.

DO NOT PROCEED to Step F until Gate E passes.

---

## Step F: Fix Activity id=12 destination

```
PATCH https://kiuli.com/api/activities/12
Headers: Authorization: Bearer <PAYLOAD_API_KEY>
Content-Type: application/json

{
  "destinations": [<SERENGETI_ID>]
}
```

**Gate F:**
```sql
SELECT d.name, d.type 
FROM activities_rels r
JOIN destinations d ON d.id = r.destinations_id
WHERE r.parent_id = 12 AND r.path = 'destinations';
```
Expected: exactly 1 row — name='Serengeti National Park', type='destination'.

Any country-type destination, zero rows, or more than 1 row = FAIL. Report and stop.

DO NOT PROCEED to Step G until Gate F passes.

---

## Step G: Delete Destination id=36 (Serengeti Mobile)

Run FK checks first. If any check returns non-zero, STOP and report — do not delete.

```sql
SELECT COUNT(*) FROM properties WHERE destination_id = 36;
SELECT COUNT(*) FROM activities_rels WHERE destinations_id = 36;
SELECT COUNT(*) FROM itinerary_patterns_rels WHERE destinations_id = 36;
```
All three must return 0. (Pre-flight confirms they are already 0, but verify again immediately before delete.)

Then delete:
```sql
DELETE FROM destinations WHERE id = 36 AND name = 'Serengeti Mobile';
```

**Gate G:**
```sql
SELECT id FROM destinations WHERE id = 36;
```
Expected: 0 rows.

DO NOT PROCEED to Step H until Gate G passes.

---

## Step H: Add LocationMappings seed entry

Via Payload admin UI at https://admin.kiuli.com — navigate to Globals → Location Mappings. Add one entry:

```
externalString: "Serengeti Mobile"
sourceSystem: "itrvl"
resolvedAs: "destination"
destination: <SERENGETI_ID>   (select from relationship picker)
notes: "Serengeti Mobile is the mobile camp operating concept for Nyasi Tented Camp. The actual destination is Serengeti National Park."
```

Save the global.

**Gate H:**
```sql
SELECT external_string, resolved_as, destination_id 
FROM location_mappings_mappings;
```
Expected: 1 row — external_string='Serengeti Mobile', resolved_as='destination', destination_id=SERENGETI_ID.

DO NOT PROCEED to Step I until Gate H passes.

---

## Step I: Update ItineraryPatterns record id=2

```
PATCH https://kiuli.com/api/itinerary-patterns/2
Headers: Authorization: Bearer <PAYLOAD_API_KEY>
Content-Type: application/json

{
  "regions": [<SERENGETI_ID>, 37, 35, 34],
  "serviceItems": <SERVICE_ITEM_IDS>
}
```

Where:
- SERENGETI_ID = ID created in Step A
- 37 = Mwiba Wildlife Reserve
- 35 = Tarangire National Park  
- 34 = Arusha
- SERVICE_ITEM_IDS = the 6 IDs from Step D, as an array

**Gate I:**
```sql
SELECT path, COUNT(*) as count
FROM itinerary_patterns_rels
WHERE parent_id = 2
GROUP BY path ORDER BY path;
```
Expected rows include:
- path='regions' with count=4
- path='serviceItems' with count=6

Any missing path, wrong count, or zero rows = FAIL.

---

## Gate 2 Final Check

Run all 7 Gate 2 queries from the spec Section 21 in sequence. All must pass before marking complete.

```sql
-- Gate 2A
SELECT id, name, type, country_id FROM destinations WHERE slug = 'serengeti-national-park';
-- Expected: 1 row, type='destination', country_id=3

-- Gate 2B
SELECT id FROM destinations WHERE name = 'Serengeti Mobile';
-- Expected: 0 rows

-- Gate 2C
SELECT p.name, d.name AS destination, d.type
FROM properties p JOIN destinations d ON p.destination_id = d.id
ORDER BY p.id;
-- Expected exactly 4 rows matching the table in Step C above

-- Gate 2D
SELECT id, name, type FROM activities;
-- Expected: exactly 1 row — id=12, balloon_flight

-- Gate 2E
SELECT d.name, d.type FROM activities_rels r
JOIN destinations d ON d.id = r.destinations_id
WHERE r.parent_id = 12 AND r.path = 'destinations';
-- Expected: 1 row, Serengeti National Park, type=destination

-- Gate 2F
SELECT name, category, service_direction FROM service_items ORDER BY id;
-- Expected: 6 rows, 2 arrival, 2 departure, 2 na

-- Gate 2G
SELECT COUNT(*) FROM activities WHERE type = 'other';
-- Expected: 0
```

---

## Completion Report Format

Report exactly this structure. No paraphrasing, no summaries — paste raw SQL output.

```
SECTION 19 DATA FIXES — COMPLETE / FAILED

SERENGETI_ID: [integer returned from Step A POST]
SERVICE_ITEM_IDS: [comma-separated IDs returned from Step D POSTs, in order]

GATE 2A: PASS/FAIL
[raw SQL output]

GATE 2B: PASS/FAIL
[raw SQL output]

GATE 2C: PASS/FAIL
[raw SQL output]

GATE 2D: PASS/FAIL
[raw SQL output]

GATE 2E: PASS/FAIL
[raw SQL output]

GATE 2F: PASS/FAIL
[raw SQL output]

GATE 2G: PASS/FAIL
[raw SQL output]

STEP H (LocationMappings):
[raw SQL output from Gate H query]

STEP I (ItineraryPatterns):
[raw SQL output from Gate I query]

DEVIATIONS FROM THIS PROMPT: [list any, or NONE]

STATUS: COMPLETE / FAILED / BLOCKED
Reason for non-COMPLETE: [if applicable]
```
