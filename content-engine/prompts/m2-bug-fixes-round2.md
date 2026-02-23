# M2 Bug Fixes Round 2: Helicopter Visibility + Activity Observation Dedup

**Date:** 2026-02-23
**Author:** Claude (Strategic)
**Recipient:** Claude Code (Tactical)

---

## Before You Start

Read all three files in their entirety before touching anything:

```
lambda/orchestrator/transform.js
lambda/orchestrator/handler.js
src/collections/Activities.ts
```

There are 2 bugs. Fix them in order. Do not commit until both are fixed and all
verification checks pass.

---

## Bug A — Helicopter segments silently dropped from itinerary day blocks

**Root cause:** `mapSegmentToBlock()` in transform.js has two places that handle
transfer segments. `linkTransferRoutes()` was correctly updated to include
`'helicopter'` in its `transferTypes` Set. `mapSegmentToBlock()` was not. A
helicopter segment hits the final `else` branch, logs "Unknown segment type", and
returns null. It is filtered out of the day's segment array. The itinerary renders as
though the helicopter transfer never happened.

### Fix A1: Add helicopter to mapSegmentToBlock() blockType condition

Locate this block in `mapSegmentToBlock()`:

```javascript
} else if (type === 'flight' || type === 'road' || type === 'transfer' || type === 'boat' || type === 'entry' || type === 'exit' || type === 'point') {
  blockType = 'transfer';
}
```

Change to:

```javascript
} else if (type === 'flight' || type === 'road' || type === 'transfer' || type === 'boat' || type === 'helicopter' || type === 'entry' || type === 'exit' || type === 'point') {
  blockType = 'transfer';
}
```

### Fix A2: Add helicopter to transferType mapping inside the transfer block

Locate this mapping inside the `if (blockType === 'transfer')` block:

```javascript
let transferType = 'road';
if (type === 'flight') transferType = 'flight';
if (type === 'boat') transferType = 'boat';
if (type === 'entry') transferType = 'entry';
if (type === 'exit') transferType = 'exit';
if (type === 'point') transferType = 'point';
```

Add after the boat line:

```javascript
if (type === 'helicopter') transferType = 'helicopter';
```

That is the complete fix for Bug A. Two lines changed, one added.

---

## Bug B — Activity observationCount inflates on every re-scrape

**Root cause:** `linkActivities()` in transform.js increments `observationCount`
immediately when an existing activity is found, inside `if (!activityId)` →
`if (existingActivity)`. This runs before `payloadItinerary.id` exists, so there is
nothing to check for dedup. Every re-scrape of the same iTrvl URL increments every
activity's observationCount, regardless of whether this itinerary has already been
counted.

Properties and TransferRoutes both solve this by deferring their count updates to
handler.js where `payloadItinerary.id` is known, and maintaining an `observations`
array with `itineraryId` for dedup. Activities must follow the same pattern.

This requires three changes: schema (add `observedInItineraries` field), transform.js
(collect pending activity IDs, stop incrementing inline), handler.js (write the
increment with dedup check).

### Fix B1: Add observedInItineraries field to Activities collection

Open `src/collections/Activities.ts`. After the `observationCount` field (the last
field in the array), add:

```typescript
{
  name: 'observedInItineraries',
  type: 'relationship',
  relationTo: 'itineraries',
  hasMany: true,
  admin: {
    readOnly: true,
    description: 'Itineraries that have contributed to observationCount — used for dedup on re-scrape',
  },
},
```

### Fix B2: Generate and apply migration

After saving Activities.ts, run:

```bash
npm run build 2>&1 | tail -5
```

Build must pass before proceeding.

Then generate the migration:

```bash
npx payload migrate:create 2>&1
```

This produces a timestamped migration file in src/migrations/. Confirm it was created
by checking the directory. The auto-generated migration will add the junction table
for the new hasMany relationship.

Apply the migration:

```bash
npx payload migrate 2>&1
```

Verify the migration applied:

```bash
# Use the db_query tool to confirm
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE '%activities%observed%'
   OR table_name LIKE '%activities_rels%'
ORDER BY table_name;
```

You are looking for a junction/rels table that covers the new relationship. Payload
typically names it `activities_rels` (shared rels table) or similar. The exact name
doesn't matter — what matters is that the migration applied without error.

### Fix B3: Modify linkActivities() in transform.js

**Three changes inside the function:**

**Change 1:** Add `pendingActivityObs` array after the `activityPropertyLinks`
declaration:

```javascript
const activityPropertyLinks = new Map(); // slug → Set<propertyId>
const pendingActivityObs = []; // Collected here, written in handler.js with itineraryId
```

**Change 2:** In the `if (existingActivity)` branch, remove `observationCount` from
the PATCH body. The current PATCH is:

```javascript
await fetch(`${PAYLOAD_API_URL}/api/activities/${activityId}`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    observationCount: (existingActivity.observationCount || 0) + 1,
    destinations: updatedDestinations,
    properties: updatedProperties,
  }),
});
console.log(`[linkActivities] UPDATED: ${activityName} (${(existingActivity.observationCount || 0) + 1} observations)`);
activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)));
```

Change to:

```javascript
await fetch(`${PAYLOAD_API_URL}/api/activities/${activityId}`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    destinations: updatedDestinations,
    properties: updatedProperties,
  }),
});
console.log(`[linkActivities] UPDATED: ${activityName} (destinations/properties updated; observationCount deferred to handler.js)`);
activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)));
pendingActivityObs.push({ activityId, slug: activityName });
```

**Change 3:** In the successful create path (`if (createRes.ok)`), after setting
`activityId`, also push to `pendingActivityObs`:

```javascript
activityId = created.doc?.id || created.id;
activityMap.set(slug, activityId);
activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)));
pendingActivityObs.push({ activityId, slug: activityName }); // ADD THIS LINE
console.log(`[linkActivities] CREATED: ${activityName} → ${activityId}`);
```

In the conflict retry path (after `activityId = retryData.docs[0].id`), also push:

```javascript
activityId = retryData.docs[0].id;
activityMap.set(slug, activityId);
activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)));
pendingActivityObs.push({ activityId, slug: activityName }); // ADD THIS LINE
console.log(`[linkActivities] LINKED (after conflict): ${activityName}`);
```

**Change 4:** Update the return statement and the function's return type. The function
currently returns `activityMap`. It must now return both:

```javascript
console.log(`[linkActivities] Total activities: ${activityMap.size}`);
return { activityMap, pendingActivityObs };
```

**Change 5:** Update the call site in `transform()`. Currently:

```javascript
const activityMap = await linkActivities(segments, propertyMap, destinationCache);
```

Change to:

```javascript
const { activityMap, pendingActivityObs: pendingActivityObsList } = await linkActivities(segments, propertyMap, destinationCache);
```

**Change 6:** Add `pendingActivityObs` to `_knowledgeBase` in `transform()`:

```javascript
const _knowledgeBase = {
  orderedPropertyIds: propertySequence.map(p => p.property),
  propertySequence,
  transferSequence,
  pendingTransferObs,
  pendingActivityObs: pendingActivityObsList,   // ADD THIS
  activityIds: [...activityMap.values()],
  adultsCount,
  childrenCount,
  startDate: itinerary.startDate || null,
};
```

### Fix B4: Add activity observation block in handler.js

Add this block in handler.js AFTER the TransferRoute observation block and BEFORE the
accumulatedData block. The `kb` variable is already declared above — do not redeclare.

```javascript
// ============================================================
// KNOWLEDGE BASE: Activity observation dedup
// ============================================================
const pendingActivityObs = kb.pendingActivityObs || [];
if (pendingActivityObs.length > 0) {
  console.log(`[Orchestrator] Processing ${pendingActivityObs.length} activity observations`);
  for (const obs of pendingActivityObs) {
    try {
      const activity = await payload.getById('activities', obs.activityId, { depth: 0 });
      const existingObserved = (activity.observedInItineraries || [])
        .map(id => typeof id === 'object' ? id.id : id)
        .map(String);

      if (existingObserved.includes(String(payloadItinerary.id))) {
        console.log(`[Orchestrator] Activity already observed for itinerary ${payloadItinerary.id}: ${obs.slug} — skipping`);
        continue;
      }

      await payload.update('activities', obs.activityId, {
        observationCount: (activity.observationCount || 0) + 1,
        observedInItineraries: [...existingObserved, String(payloadItinerary.id)],
      });
      console.log(`[Orchestrator] Activity obs recorded: ${obs.slug} (count: ${(activity.observationCount || 0) + 1})`);
    } catch (err) {
      console.error(`[Orchestrator] Activity obs failed for ${obs.activityId}: ${err.message}`);
      // Non-fatal — continue
    }
  }
}
```

---

## Verification

### Syntax checks

```bash
node -c lambda/orchestrator/transform.js
node -c lambda/orchestrator/handler.js
```

Both must exit 0.

### Build

```bash
npm run build 2>&1 | tail -10
```

Must pass.

### Code review checklist — read the actual code for each:

1. `'helicopter'` is in the blockType condition in `mapSegmentToBlock()`
   - YES / NO

2. `if (type === 'helicopter') transferType = 'helicopter'` exists in the transfer
   block's type mapping
   - YES / NO

3. `observedInItineraries` field is present in `src/collections/Activities.ts`
   - YES / NO

4. Migration was generated and applied without error
   - YES / NO

5. `pendingActivityObs` array declared in `linkActivities()`
   - YES / NO

6. `observationCount` is NOT in the PATCH body for existing activities in
   `linkActivities()`
   - YES / NO (must be NO to confirm removal)

7. All three paths in `linkActivities()` (existing found, new created, conflict retry)
   push to `pendingActivityObs`
   - YES / NO

8. `linkActivities()` returns `{ activityMap, pendingActivityObs }`
   - YES / NO

9. Call site in `transform()` destructures both values
   - YES / NO

10. `_knowledgeBase` includes `pendingActivityObs`
    - YES / NO

11. Activity observation block exists in handler.js between TransferRoute obs block
    and accumulatedData block
    - YES / NO

12. That block checks `observedInItineraries` for `payloadItinerary.id` before
    incrementing
    - YES / NO

13. That block adds `payloadItinerary.id` to `observedInItineraries` when recording
    - YES / NO

All 13 must be YES.

---

## Sync and Commit

```bash
cd lambda && ./sync-shared.sh && cd ..
npm run build 2>&1 | tail -5
```

Build must pass. Then:

```bash
git add src/collections/Activities.ts \
        src/migrations/ \
        lambda/orchestrator/transform.js \
        lambda/orchestrator/handler.js
git commit -m "fix(scraper): Helicopter segment visibility; activity observationCount dedup via observedInItineraries"
git push
```

---

## Final Report Format

```
ROUND 2 BUG FIX REPORT
Date: [timestamp]

Bug A — Helicopter visibility: FIXED / NOT FIXED
  - 'helicopter' in mapSegmentToBlock blockType condition: YES/NO
  - transferType = 'helicopter' mapping present: YES/NO

Bug B — Activity observationCount dedup: FIXED / NOT FIXED
  - observedInItineraries field added to Activities.ts: YES/NO
  - Migration generated and applied: YES/NO
  - observationCount removed from inline PATCH in linkActivities(): YES/NO
  - pendingActivityObs collected across all 3 paths: YES/NO
  - Activity obs block in handler.js with dedup check: YES/NO

Syntax: PASS / FAIL
Build: PASS / FAIL
GIT: Committed [hash] / NOT COMMITTED

BLOCKERS
[Exact description of anything that could not be completed and why]
```
