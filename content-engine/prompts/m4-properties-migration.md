# M4: Properties Schema Migration

**Scope:** Generate and run Payload migration for Properties collection changes.  
**Trigger:** Properties.ts was updated with new fields from Vision 2.0. The DB does not yet have the new columns. Build fails at `generateStaticParams` for `/properties/[slug]` because it queries columns that don't exist.

---

## Pre-flight Check

Before generating anything, verify the current migration state:

```bash
npx payload migrate:status
```

Paste the raw output. The most recent migration should be `20260223_181943` (batch 38). If there is a pending migration that has not run, STOP and report — do not create another.

---

## Step 1: Generate the migration

```bash
npx payload migrate:create
```

This auto-generates a migration file in `src/migrations/` based on the diff between the current schema and the DB state.

**After generation:**
- Report the exact filename created (e.g. `20260224_123456.ts`)
- Report the number of lines in the file
- Do NOT run it yet

---

## Step 2: Read and verify the migration

Read the generated migration file in full. Verify it contains only ADD operations — no DROP, no RENAME, no column type changes on existing columns.

**Expected additions (non-exhaustive — verify all are present):**

For `properties` table:
- No direct column additions here (group fields are stored in the main table, check for new columns like `accumulated_data_observation_count`, `accumulated_data_last_observed_at`, `accumulated_data_typical_nights_median`, `accumulated_data_typical_nights_min`, `accumulated_data_typical_nights_max`, `accumulated_data_price_positioning_band`, `accumulated_data_price_positioning_avg_per_night_usd`, `accumulated_data_price_positioning_observation_count`, `canonical_content_source`, `canonical_content_last_synced`, `canonical_content_address`, `canonical_content_website`, `canonical_content_star_rating`, `canonical_content_total_rooms`, `availability_last_checked`, `availability_agent_relationship`, `availability_rate_visibility`, `availability_cache_policy_ttl_minutes`, `availability_cache_policy_check_on_draft`, `external_ids_wetu_content_rating`)

For sub-tables:
- `properties_external_ids_res_request_accomm_types`: new column `wetu_content_entity_item_id`
- New table: `prop_room_obs` (roomTypes observations)
- `prop_price_obs`: new columns `source`, `pax_type`, `room_type`
- New tables: `properties_accumulated_data_suitability`, `properties_accumulated_data_activity_patterns`
- New enum: `enum_prop_pp_band` (for accumulatedData.pricePositioning.band)

For the versioned `_properties_v` table — same additions mirrored.

**If the migration contains any DROP or RENAME statement, STOP and report. Do not run it.**

---

## Step 3: Run the migration

```bash
npx payload migrate
```

Report the full output verbatim.

---

## Step 4: Verify

Run these queries and paste raw output:

```sql
-- V1: New columns exist on properties table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'properties' 
AND column_name IN (
  'accumulated_data_observation_count',
  'accumulated_data_last_observed_at',
  'accumulated_data_price_positioning_band',
  'canonical_content_source',
  'availability_last_checked',
  'availability_agent_relationship',
  'external_ids_wetu_content_rating'
)
ORDER BY column_name;
-- Expected: 7 rows

-- V2: wetuContentEntityItemId added to resRequestAccommTypes sub-table
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'properties_external_ids_res_request_accomm_types'
AND column_name = 'wetu_content_entity_item_id';
-- Expected: 1 row

-- V3: prop_price_obs has new columns
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'prop_price_obs'
AND column_name IN ('source', 'pax_type', 'room_type')
ORDER BY column_name;
-- Expected: 3 rows

-- V4: prop_room_obs table exists
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'prop_room_obs';
-- Expected: 1 row

-- V5: No existing property data corrupted
SELECT id, name, destination_id FROM properties ORDER BY id;
-- Expected: 4 rows — Legendary Lodge, Little Chem Chem, Nyasi Tented Camp, Mwiba Lodge
-- All must retain their correct destination_id values from Section 19

-- V6: enum_prop_pp_band exists
SELECT typname FROM pg_type WHERE typname = 'enum_prop_pp_band';
-- Expected: 1 row
```

All 6 verification queries must pass before marking complete.

---

## Step 5: Run the build

```bash
npm run build
```

The build must complete with exit code 0. The earlier failure (`wetu_content_entity_item_id does not exist`) must not appear.

Report: PASS or FAIL. If FAIL, paste the error.

---

## Completion Report

```
M4: PROPERTIES MIGRATION — COMPLETE / FAILED

Migration file: [filename]
Migration output: [paste verbatim]

V1 (properties columns): PASS/FAIL
[raw output]

V2 (resRequestAccommTypes): PASS/FAIL
[raw output]

V3 (prop_price_obs new columns): PASS/FAIL
[raw output]

V4 (prop_room_obs table): PASS/FAIL
[raw output]

V5 (existing property data intact): PASS/FAIL
[raw output]

V6 (enum_prop_pp_band): PASS/FAIL
[raw output]

Build: PASS / FAIL
[error if FAIL]

DEVIATIONS FROM THIS PROMPT: [list any, or NONE]

STATUS: COMPLETE / FAILED / BLOCKED
```
