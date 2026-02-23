# Schema v3.0: Airports, ServiceItems, LocationMappings, Activity Booking Behaviour

**Date:** 2026-02-23
**Author:** Claude (Strategic)
**Recipient:** Claude Code (Tactical)
**Scope:** Schema files only — no data changes, no migrations, no deployment

---

## Confirmed Architecture Facts

Read this before touching any file.

**The specification.** All schema definitions are in `KIULI_CANONICAL_SCHEMA_SPEC.md` at
the root of the repository. Sections 3–11 define exactly what to build. If anything in
this prompt conflicts with the spec, the spec wins. Report the conflict before acting.

**Payload collection slug convention.** Collection slugs use kebab-case. The Airports
collection uses `slug: 'airports'`. ServiceItems uses `slug: 'service-items'`. Relate to
them from other collections using their slug string exactly.

**Payload group field storage.** Nested group fields are stored in the database as
flattened columns: `booking_behaviour_requires_advance_booking`, etc. This is Payload's
default behaviour — you do not need to configure anything special. Define the group
fields as shown in the spec; Payload handles the column naming.

**`DestinationNameMappings` is deregistered, not deleted.** Remove it from
`payload.config.ts` globals array and the import statement. Do NOT delete the file
`src/globals/DestinationNameMappings.ts` — it stays as a reference until data migration
is confirmed complete in a later step.

**`content-system/cascade/destination-resolver.ts` is NOT in scope.** That file reads
from `destination-name-mappings` global. It will be updated in a later step when the
data migration runs. Do not touch it in this task.

**`Activities.ts` — do NOT remove `other` from the type enum.** The v3.0 spec requires
removing it, but that happens in Step 4 of the implementation sequence (Section 20 of
the spec), after data migration converts existing `type='other'` records to ServiceItems.
Removing it now before data migration will break existing records. Add `bookingBehaviour`
only.

**No Lambda changes in this task.** The scraper functions `linkAirports()`,
`linkServiceItems()`, and the updated `linkActivities()` are defined in the spec but
implemented in a separate task. This task is schema files only.

**Build tool.** Use `npx tsc --noEmit` to verify TypeScript. Do not use `npm run build`
for the gate check — it takes much longer and is needed only for the final pre-commit
verification.

---

## Pre-flight: Required Reads

Read these files before writing a single line of code. Report what you find.

```
1. src/payload.config.ts
   - What collections are currently in the collections array?
   - What globals are currently in the globals array?

2. src/collections/Activities.ts
   - What fields exist? Confirm the current type enum options.
   - Is bookingBehaviour already present? (Expected: no)

3. src/collections/ItineraryPatterns.ts
   - What fields exist? Confirm transferSequence structure.
   - Are regions or serviceItems fields already present? (Expected: no)

4. src/collections/Properties.ts
   - Is accumulatedData group present? (Expected: yes — added in M2)
   - Is seasonalityData present inside accumulatedData? (Expected: no)

5. src/collections/TransferRoutes.ts
   - Is fromAirport or toAirport present? (Expected: no)
```

Report the answer to each question before proceeding. If any answer is unexpected,
stop and report. Do not guess and proceed.

---

## Step 1: Create `src/collections/Airports.ts`

Create this file with the exact content from Section 3 of `KIULI_CANONICAL_SCHEMA_SPEC.md`.

The complete TypeScript content is in the spec under:
`## 3. New Collection: src/collections/Airports.ts`

Copy the `CollectionConfig` object exactly. Do not modify field names, admin labels,
or descriptions. Do not add fields not in the spec.

After creating the file:
```bash
npx tsc --noEmit 2>&1 | grep -i "airports"
```
Expected: no errors mentioning Airports.ts.

---

## Step 2: Create `src/collections/ServiceItems.ts`

Create this file with the exact content from Section 4 of `KIULI_CANONICAL_SCHEMA_SPEC.md`.

The complete TypeScript content is in the spec under:
`## 4. New Collection: src/collections/ServiceItems.ts`

After creating the file:
```bash
npx tsc --noEmit 2>&1 | grep -i "service"
```
Expected: no errors mentioning ServiceItems.ts.

---

## Step 3: Create `src/globals/LocationMappings.ts`

Create this file with the exact content from Section 9 of `KIULI_CANONICAL_SCHEMA_SPEC.md`.

The complete TypeScript content is in the spec under:
`## 9. New Global: src/globals/LocationMappings.ts`

After creating the file:
```bash
npx tsc --noEmit 2>&1 | grep -i "location"
```
Expected: no errors mentioning LocationMappings.ts.

---

## Step 4: Modify `src/collections/Activities.ts`

Add the `bookingBehaviour` group from Section 5.2 of the spec. Insert it after the
existing `fitnessLevel` field and before the `wetuContentEntityId` field.

**Do NOT:**
- Remove `other` from the type enum
- Remove any existing fields
- Reorder any existing fields
- Change any existing field names or admin labels

After editing:
```bash
npx tsc --noEmit 2>&1 | grep -i "activities"
```
Expected: no errors.

---

## Step 5: Modify `src/collections/ItineraryPatterns.ts`

Add two fields from Section 6 of the spec:

1. `regions` field — add after the `countries` field
2. `serviceItems` field — add after the `transferSequence` field

Do not modify any existing fields.

After editing:
```bash
npx tsc --noEmit 2>&1 | grep -i "itinerary-patterns\|ItineraryPatterns"
```
Expected: no errors.

---

## Step 6: Modify `src/collections/Properties.ts`

Add the `seasonalityData` array inside the existing `accumulatedData` group, per
Section 7 of the spec. It goes after the `commonPairings` array within the
`accumulatedData` group fields.

Read the current `accumulatedData` group carefully before editing. Find the closing
`}` of the `commonPairings` field. Add `seasonalityData` after it, before the closing
`]` of the `accumulatedData.fields` array.

After editing:
```bash
npx tsc --noEmit 2>&1 | grep -i "properties"
```
Expected: no errors.

---

## Step 7: Modify `src/collections/TransferRoutes.ts`

Add two fields from Section 8 of the spec:

1. `fromAirport` — relationship to 'airports', add after `toDestination`
2. `toAirport` — relationship to 'airports', add after `fromAirport`

Do not modify any existing fields.

After editing:
```bash
npx tsc --noEmit 2>&1 | grep -i "transfer"
```
Expected: no errors.

---

## Step 8: Update `src/payload.config.ts`

Make these exact changes:

**Add imports** (alongside the existing collection/global imports):
```typescript
import { Airports } from './collections/Airports'
import { ServiceItems } from './collections/ServiceItems'
import { LocationMappings } from './globals/LocationMappings'
```

**Remove import:**
```typescript
import { DestinationNameMappings } from './globals/DestinationNameMappings'
```

**Add to collections array:** `Airports`, `ServiceItems`

**Add to globals array:** `LocationMappings`

**Remove from globals array:** `DestinationNameMappings`

Do not change the order of any other imports or array entries beyond these additions
and removals.

---

## Gate 1: TypeScript

```bash
npx tsc --noEmit
```

Expected: zero errors, zero warnings about the modified or new files.

If there are errors: stop, report the full error output. Do not commit.

---

## Gate 2: Registration Verification

```bash
grep -n "Airports\|ServiceItems\|LocationMappings\|DestinationNameMappings" src/payload.config.ts
```

Expected output must show:
- `Airports` appears (import + collections array)
- `ServiceItems` appears (import + collections array)
- `LocationMappings` appears (import + globals array)
- `DestinationNameMappings` does NOT appear anywhere

If `DestinationNameMappings` still appears: do not commit. Fix and re-run.

---

## Gate 3: Build

```bash
npm run build 2>&1 | tail -20
```

Expected: build exits with zero errors. Report the last 20 lines of output.

If the build fails: stop, report the full error. Do not commit.

---

## Commit

When all three gates pass:

```bash
git add \
  src/collections/Airports.ts \
  src/collections/ServiceItems.ts \
  src/globals/LocationMappings.ts \
  src/collections/Activities.ts \
  src/collections/ItineraryPatterns.ts \
  src/collections/Properties.ts \
  src/collections/TransferRoutes.ts \
  src/payload.config.ts
git commit -m "feat(schema): v3.0 — Airports, ServiceItems, LocationMappings, activity bookingBehaviour, airport routing fields, seasonalityData, serviceItems on ItineraryPatterns"
git push
```

---

## Completion Report

Report in this exact format:

```
SCHEMA V3.0 COMPLETION REPORT
Date: [ISO timestamp]
Commit: [hash]

PRE-FLIGHT FINDINGS
- Activities.ts bookingBehaviour already present: YES / NO
- ItineraryPatterns.ts regions already present: YES / NO
- Properties.ts seasonalityData already present: YES / NO
- TransferRoutes.ts fromAirport already present: YES / NO
- DestinationNameMappings in payload.config.ts before edit: YES / NO

FILES CREATED
- src/collections/Airports.ts: CREATED
- src/collections/ServiceItems.ts: CREATED
- src/globals/LocationMappings.ts: CREATED

FILES MODIFIED
- src/collections/Activities.ts: bookingBehaviour group added after [field name]
- src/collections/ItineraryPatterns.ts: regions added after [field name], serviceItems added after [field name]
- src/collections/Properties.ts: seasonalityData added inside accumulatedData after [field name]
- src/collections/TransferRoutes.ts: fromAirport and toAirport added after [field name]
- src/payload.config.ts: Airports + ServiceItems in collections, LocationMappings in globals, DestinationNameMappings removed

GATE RESULTS
- Gate 1 (TypeScript): PASS / FAIL
- Gate 2 (Registration): PASS / FAIL
- Gate 3 (Build): PASS / FAIL
- Last 20 lines of build output: [paste here]

GIT
- Committed: YES / NO
- Pushed: YES / NO
- Commit hash: [hash]

BLOCKERS
[Any issues encountered and exact error messages]

STATUS: COMPLETE / FAILED / BLOCKED
```

---

## Constraints

1. **Read before modifying.** Confirm current state of each file before editing it.
   Report unexpected findings before acting on them.

2. **Spec is the source of truth.** Every field, every type, every admin description
   comes from `KIULI_CANONICAL_SCHEMA_SPEC.md`. Do not invent or simplify.

3. **No data changes.** This task creates and modifies TypeScript schema files only.
   No migrations, no API calls, no database queries, no Lambda changes.

4. **Do not remove `other` from Activities type enum.** This is explicitly deferred
   to after data migration. Removing it now will break existing records.

5. **Do not touch `DestinationNameMappings.ts` file.** Deregister it from
   payload.config.ts only.

6. **All three gates must pass before committing.** TypeScript clean, registration
   verified, build clean. Zero exceptions.
