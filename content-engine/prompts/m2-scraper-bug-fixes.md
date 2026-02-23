# M2 Bug Fixes: Scraper Knowledge Base Corrections

**Date:** 2026-02-23
**Author:** Claude (Strategic)
**Recipient:** Claude Code (Tactical)

---

## Before You Start

Read both files in their entirety before touching a line:

```
lambda/orchestrator/transform.js
lambda/orchestrator/handler.js
```

There are 6 bugs. This prompt fixes all 6 in a specific order. Do not reorder the
fixes. Do not fix one and test — all 6 must be fixed before committing.

---

## The 6 Bugs and Their Fixes

---

### Bug 1: TransferRoute observations have no itineraryId

**Root cause:** `linkTransferRoutes()` runs inside `transform()`, before
`payloadItinerary.id` exists. Observations are written immediately with `itineraryId`
missing entirely. Every observation in the database has a null itineraryId.

**Fix — Architecture change. Two parts.**

#### Part 1A: Change `linkTransferRoutes()` in transform.js

`linkTransferRoutes()` must stop writing observations. It still creates route records
and updates airlines. But observation data is collected and returned for handler.js
to write after the itinerary is saved.

**New return signature:**
```javascript
return { routeMap, transferSequence, pendingTransferObs };
```

`pendingTransferObs` is an array of objects, one per transfer segment processed:
```javascript
{
  routeId: string,       // The route's Payload ID
  slug: string,          // For logging only
  departureTime: string | null,
  arrivalTime: string | null,
  airline: string | null,
  dateObserved: string,  // ISO date: new Date().toISOString().slice(0, 10)
}
```

**Changes to make inside `linkTransferRoutes()`:**

Remove the `pendingTransferObs` array declaration at the top of the function:
```javascript
const pendingTransferObs = [];
```

**When an existing route is found** (the `if (existingRoute)` branch):
- Keep the airline dedup logic — that update still happens here
- Keep the `fromDestination` update if missing — that happens here too
- Remove the observation append: do NOT include `observations`, `observationCount`
  in the PATCH body
- Instead, push to pendingTransferObs:
  ```javascript
  pendingTransferObs.push({
    routeId,
    slug,
    departureTime: segment.departureTime || null,
    arrivalTime: segment.arrivalTime || null,
    airline: segment.airline || null,
    dateObserved: new Date().toISOString().slice(0, 10),
  });
  ```

**The PATCH for existing routes becomes:**
```javascript
await fetch(`${PAYLOAD_API_URL}/api/transfer-routes/${routeId}`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({
    airlines: updatedAirlines,
    ...(fromDestinationId && !existingRoute.fromDestination
      ? { fromDestination: fromDestinationId }
      : {}),
  }),
});
console.log(`[linkTransferRoutes] UPDATED airlines: ${from} → ${to}`);
```

**When a new route is created** (the `else` / POST branch):
- Create with `observations: []` and `observationCount: 0` — no observation in the
  POST body
- After successful create, push to pendingTransferObs:
  ```javascript
  pendingTransferObs.push({
    routeId,
    slug,
    departureTime: segment.departureTime || null,
    arrivalTime: segment.arrivalTime || null,
    airline: segment.airline || null,
    dateObserved: new Date().toISOString().slice(0, 10),
  });
  ```

**The POST body for new routes becomes:**
```javascript
body: JSON.stringify({
  from,
  to,
  slug,
  mode,
  fromDestination: fromDestinationId,
  airlines: airlineName ? [{ name: airlineName, go7Airline: false, duffelAirline: false }] : [],
  observations: [],
  observationCount: 0,
}),
```

**When the slug-conflict retry finds an existing route** (the inner `if` after 400):
- Set `routeId = retryData.docs[0].id`
- Also push to pendingTransferObs (the observation was lost before — now it won't be):
  ```javascript
  pendingTransferObs.push({
    routeId,
    slug,
    departureTime: segment.departureTime || null,
    arrivalTime: segment.arrivalTime || null,
    airline: segment.airline || null,
    dateObserved: new Date().toISOString().slice(0, 10),
  });
  console.log(`[linkTransferRoutes] LINKED (after conflict): ${from} → ${to}`);
  ```

**Return statement at end of function:**
```javascript
console.log(`[linkTransferRoutes] Total routes: ${routeMap.size}, pending obs: ${pendingTransferObs.length}`);
return { routeMap, transferSequence, pendingTransferObs };
```

#### Part 1B: Update transform() to pass pendingTransferObs through _knowledgeBase

In the `transform()` function, update the destructure:
```javascript
// Old:
const { routeMap: transferRouteMap, transferSequence } = await linkTransferRoutes(segments, destinationCache);

// New:
const { routeMap: transferRouteMap, transferSequence, pendingTransferObs } = await linkTransferRoutes(segments, destinationCache);
```

Add `pendingTransferObs` to `_knowledgeBase`:
```javascript
const _knowledgeBase = {
  orderedPropertyIds: propertySequence.map(p => p.property),
  propertySequence,
  transferSequence,
  pendingTransferObs,          // ADD THIS
  activityIds: [...activityMap.values()],
  adultsCount,
  childrenCount,
  startDate: itinerary.startDate || null,
};
```

#### Part 1C: Add TransferRoute observation block in handler.js

In handler.js, add this block AFTER the bidirectional property linking block and
BEFORE the accumulatedData block. Use `payload.getById` and `payload.update` from
the shared payload module.

```javascript
// ============================================================
// KNOWLEDGE BASE: TransferRoute observations with itineraryId
// ============================================================
const pendingTransferObs = kb.pendingTransferObs || [];
if (pendingTransferObs.length > 0) {
  console.log(`[Orchestrator] Writing ${pendingTransferObs.length} TransferRoute observations`);
  for (const obs of pendingTransferObs) {
    try {
      const route = await payload.getById('transfer-routes', obs.routeId, { depth: 0 });
      const existingObs = route.observations || [];
      const existingAirlines = route.airlines || [];

      // Dedup: skip if an observation for this itinerary already exists
      const alreadyRecorded = existingObs.some(o => {
        const id = typeof o.itineraryId === 'object' ? o.itineraryId?.id : o.itineraryId;
        return String(id) === String(payloadItinerary.id);
      });
      if (alreadyRecorded) {
        console.log(`[Orchestrator] TransferRoute obs already exists for route ${obs.routeId}, itinerary ${payloadItinerary.id} — skipping`);
        continue;
      }

      // Dedup airline
      const airlineName = obs.airline || null;
      const airlineAlreadyPresent = airlineName && existingAirlines.some(a => a.name === airlineName);
      const updatedAirlines = airlineAlreadyPresent
        ? existingAirlines
        : [
            ...existingAirlines,
            ...(airlineName ? [{ name: airlineName, go7Airline: false, duffelAirline: false }] : []),
          ];

      await payload.update('transfer-routes', obs.routeId, {
        observations: [...existingObs, {
          itineraryId: payloadItinerary.id,
          departureTime: obs.departureTime,
          arrivalTime: obs.arrivalTime,
          airline: obs.airline,
          dateObserved: obs.dateObserved,
        }],
        observationCount: existingObs.length + 1,
        airlines: updatedAirlines,
      });
      console.log(`[Orchestrator] TransferRoute obs saved: ${obs.slug} (itinerary ${payloadItinerary.id})`);
    } catch (err) {
      console.error(`[Orchestrator] TransferRoute obs failed for route ${obs.routeId}: ${err.message}`);
      // Non-fatal — continue
    }
  }
}
```

---

### Bug 2: Activities only link to the first property they appear at

**Root cause:** When `activityMap.get(slug)` returns a non-null value, the code enters
`if (!activityId) { ... }` as false and does nothing. There is no else branch.
If "Game Drive" appears at Property A (day 2) then Property B (day 5), Property B
is never linked.

**Fix — In `linkActivities()` in transform.js:**

Add a Map to track which properties have already been linked for each activity slug
within this run. Add this after the existing `slugCache` declaration:

```javascript
const activityPropertyLinks = new Map(); // slug → Set<propertyId>
```

**Inside the loop, after the existing `if (!activityId)` block, add an else branch:**

The full structure around this area should look like:

```javascript
try {
  let activityId = activityMap.get(slug) || null;

  if (!activityId) {
    // ... existing create/find logic unchanged ...
    // After activityId is set (either from find or create), initialise the Set:
    if (activityId && currentPropertyId) {
      activityPropertyLinks.set(slug, new Set([currentPropertyId]));
    } else if (activityId) {
      activityPropertyLinks.set(slug, new Set());
    }

  } else {
    // Activity already seen in this itinerary. Check if currentPropertyId needs linking.
    if (currentPropertyId) {
      const linked = activityPropertyLinks.get(slug) || new Set();
      if (!linked.has(currentPropertyId)) {
        // This property hasn't been linked to this activity in this run — PATCH it
        try {
          const actRes = await fetch(
            `${PAYLOAD_API_URL}/api/activities/${activityId}?depth=0`,
            { headers }
          );
          if (actRes.ok) {
            const existingActivity = await actRes.json();
            const existingProperties = (existingActivity.properties || [])
              .map(p => typeof p === 'object' ? p.id : p);
            if (!existingProperties.includes(currentPropertyId)) {
              await fetch(`${PAYLOAD_API_URL}/api/activities/${activityId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({
                  properties: [...existingProperties, currentPropertyId],
                }),
              });
              console.log(`[linkActivities] LINKED additional property ${currentPropertyId} → activity ${activityId} (${activityName})`);
            }
            linked.add(currentPropertyId);
            activityPropertyLinks.set(slug, linked);
          }
        } catch (err) {
          console.error(`[linkActivities] Failed to link additional property for ${activityName}: ${err.message}`);
          // Non-fatal
        }
      }
    }
  }

} catch (err) {
  console.error(`[linkActivities] Error for ${activityName}:`, err.message);
}
```

**Important:** In the `if (!activityId)` branch, after the create or find code sets
`activityId`, also initialise the `activityPropertyLinks` entry. Specifically:
- If found in DB (existingActivity path): after setting `activityId`, add
  `activityPropertyLinks.set(slug, new Set([currentPropertyId].filter(Boolean)))`
- If created (POST path): after setting `activityId`, add same

This ensures the Set is populated on first encounter so subsequent encounters don't
re-fetch unnecessarily.

---

### Bug 3: `!propertyId.__backfilled` never activates

**Root cause:** `propertyId` is a string. `string.__backfilled` is `undefined`.
`!undefined` is always `true`. The guard is permanently open. Every property — including
ones just created with supplierCode already set — gets an extra GET to check backfill.

**Fix — In `linkProperties()` in transform.js:**

Add a Set immediately after the `slugMap` declaration (before the loop):
```javascript
const createdThisRun = new Set(); // Track IDs created in this run — no backfill needed
```

After a successful property creation (inside the `if (createRes.ok)` block), add:
```javascript
propertyId = created.doc?.id || created.id;
createdThisRun.add(propertyId);  // ADD THIS LINE
console.log(`[linkProperties] CREATED: ${accommodationName} -> ${propertyId}`);
```

Change the backfill guard from:
```javascript
if (propertyId && !propertyId.__backfilled) {
```
To:
```javascript
if (propertyId && !createdThisRun.has(propertyId)) {
```

No other changes to the backfill logic.

---

### Bug 4: TransferRoute slug-conflict retry loses the observation

**This bug is fully resolved by Bug 1's fix.** When the conflict retry sets `routeId`,
it now pushes to `pendingTransferObs`. The observation is written by handler.js with
the correct `itineraryId`. No additional changes needed here.

Confirm after implementing Bug 1 that all three paths (existing route found, new route
created, slug conflict retry) each push exactly one entry to `pendingTransferObs` when
`routeId` is successfully resolved.

---

### Bug 5: `helicopter` not recognised as a transfer type

**Fix — In `linkTransferRoutes()` in transform.js:**

Change:
```javascript
const transferTypes = new Set(['flight', 'road', 'boat']);
```
To:
```javascript
const transferTypes = new Set(['flight', 'road', 'boat', 'helicopter']);
```

Add the mode mapping immediately after the existing `if (type === 'boat')` line:
```javascript
let mode = 'road';
if (type === 'flight') mode = 'flight';
if (type === 'boat') mode = 'boat';
if (type === 'helicopter') mode = 'helicopter';
```

---

### Bug 6: Duplicate accumulatedData observations on re-scrape

**Root cause:** The accumulatedData block in handler.js unconditionally appends a new
price observation for every property on every run. In update mode (same Payload
itinerary ID), re-scraping the same URL appends a second identical observation.
`commonPairings.count` also inflates.

**Fix — In handler.js, inside the accumulatedData loop:**

After fetching `existingProperty`, add a dedup check before doing anything else:

```javascript
const existingProperty = await payload.getById('properties', propertyId, { depth: 0 });

// === Dedup check: skip if this itinerary's data is already recorded ===
const existingObs = existingProperty.accumulatedData?.pricePositioning?.observations || [];
const alreadyRecorded = existingObs.some(obs => {
  const id = typeof obs.itineraryId === 'object' ? obs.itineraryId?.id : obs.itineraryId;
  return String(id) === String(payloadItinerary.id);
});
if (alreadyRecorded) {
  console.log(`[Orchestrator] accumulatedData already recorded for property ${propertyId}, itinerary ${payloadItinerary.id} — skipping`);
  continue;
}
```

If `alreadyRecorded` is true, `continue` skips both the observation append AND the
commonPairings update for this property. Both must be skipped — they are one atomic
update for one itinerary's contribution to this property.

The rest of the accumulatedData logic (the observation append, commonPairings merge,
PATCH call) is unchanged.

---

## Verification After All 6 Fixes

**Syntax checks:**
```bash
node -c lambda/orchestrator/transform.js
node -c lambda/orchestrator/handler.js
```

**Build:**
```bash
npm run build 2>&1 | tail -20
```

**Code review checklist — confirm each by reading the actual code:**

1. `linkTransferRoutes()` returns `{ routeMap, transferSequence, pendingTransferObs }`
   - YES / NO

2. `linkTransferRoutes()` writes zero observations to the database (no observations
   array in any POST or PATCH body within the function)
   - YES / NO

3. All three paths in `linkTransferRoutes()` (existing found, new created, conflict
   retry) each push to `pendingTransferObs` when routeId is resolved
   - YES / NO

4. `_knowledgeBase` in transform() includes `pendingTransferObs`
   - YES / NO

5. handler.js has a TransferRoute observation block between the property linking block
   and the accumulatedData block
   - YES / NO

6. That block writes each observation with `itineraryId: payloadItinerary.id`
   - YES / NO

7. That block has a dedup check: skips if an observation for this itineraryId already
   exists on the route
   - YES / NO

8. `linkActivities()` has an else branch that PATCHes property links for repeated
   activity slugs
   - YES / NO

9. `activityPropertyLinks` Map exists and prevents redundant PATCH calls for the same
   property/activity combination within one run
   - YES / NO

10. `createdThisRun` Set exists in `linkProperties()` and is populated on every
    successful create
    - YES / NO

11. Backfill guard uses `!createdThisRun.has(propertyId)` — not `!propertyId.__backfilled`
    - YES / NO

12. `transferTypes` Set includes `'helicopter'` and mode mapping includes helicopter
    - YES / NO

13. accumulatedData block has dedup check before appending observation
    - YES / NO

14. That dedup check skips BOTH observation AND commonPairings update when itinerary
    already recorded
    - YES / NO

All 14 must be YES. If any is NO, the relevant bug is not fixed.

---

## Sync and Commit

After all 14 checks pass:

```bash
cd lambda && ./sync-shared.sh && cd ..
npm run build 2>&1 | tail -5
```

Build must pass. Then:

```bash
git add lambda/orchestrator/transform.js lambda/orchestrator/handler.js
git commit -m "fix(scraper): TransferRoute itineraryId, activity multi-property linking, backfill guard, helicopter mode, observation dedup"
git push
```

---

## Final Report Format

```
M2 BUG FIX REPORT
Date: [timestamp]

Bug 1 — TransferRoute itineraryId: FIXED / NOT FIXED
  - pendingTransferObs returned from linkTransferRoutes: YES/NO
  - Observation block in handler.js writes itineraryId: YES/NO
  - Dedup check on route observation: YES/NO

Bug 2 — Activity multi-property linking: FIXED / NOT FIXED
  - Else branch present: YES/NO
  - activityPropertyLinks prevents redundant PATCHes: YES/NO

Bug 3 — Backfill guard: FIXED / NOT FIXED
  - createdThisRun Set used: YES/NO

Bug 4 — Conflict retry observation loss: FIXED / NOT FIXED
  - Resolved by Bug 1 restructure: YES/NO (confirm all 3 paths push to pendingTransferObs)

Bug 5 — Helicopter: FIXED / NOT FIXED
  - 'helicopter' in transferTypes Set: YES/NO
  - Mode mapping present: YES/NO

Bug 6 — Duplicate accumulatedData: FIXED / NOT FIXED
  - Dedup check by itineraryId: YES/NO
  - Both observation and commonPairings skipped on duplicate: YES/NO

Syntax checks: PASS / FAIL
Build: PASS / FAIL
GIT: Committed [hash] / NOT COMMITTED

BLOCKERS
[Anything that could not be completed and exact reason]
```
