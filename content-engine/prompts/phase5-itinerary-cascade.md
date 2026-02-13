# Phase 5: Itinerary Cascade

## Context

Phases 1-4 are complete: schema, embeddings table, bootstrap embeddings (143), OpenRouter client, ContentProject embeddings engine. All tested and verified.

Phase 5 implements the Itinerary Cascade — the core pipeline that processes an itinerary and resolves its entities (destinations, properties) into Payload records, populates relationships, and creates ContentProjects for new entities needing content.

**This runs as a Vercel API endpoint** (not Lambda). All Phases 1-4 run on Vercel with Payload Local API. The cascade is CRUD operations (find, create, update relationships) — 30-60 seconds max, well within Vercel's 300s timeout. The module architecture in `content-system/cascade/` means it can be wrapped in a Lambda later if needed.

## Current State

### What Exists
- 10 destinations (all country-level: Kenya, Tanzania, Uganda, Rwanda, Botswana, South Africa, Zambia, Zimbabwe, Namibia, Mozambique)
- 33 properties (all linked to country-level destinations, all with property_id on stay blocks)
- 7 itineraries with structured days, stays, activities, transfers
- Stay blocks have: `accommodationNameItrvl`, `location`, `country`, `property` (relationship to properties)
- Activity blocks have: `titleItrvl`
- `overview.countries` array on each itinerary
- `destinations` relationship on itineraries (country-level, partially populated)
- `relatedItineraries` on destinations (1 entry total — nearly empty)
- `relatedItineraries` on properties (34 entries — populated by scraper)
- DestinationNameMappings global (empty)
- PropertyNameMappings global (empty)
- ContentJobs collection (empty)
- ContentProjects collection (0 records with real content — only test records were cleaned up)

### What Doesn't Exist
- No park/reserve-level destinations (Masai Mara, Serengeti, Sabi Sands, etc.)
- No bidirectional destination → itinerary links (only 1 entry)
- No ContentProjects for any destinations or properties
- No afterChange hook on Itineraries
- No cascade API endpoint
- No jobs API endpoint

## Stub Files to Replace

All files in `content-system/cascade/` are stubs (type declarations only) EXCEPT `types.ts` which has real type definitions. Replace the stubs with real implementations:

- `entity-extractor.ts` — stub: `export declare function extractEntities(...)`
- `destination-resolver.ts` — stub: `export declare function resolveDestinations(...)`
- `property-resolver.ts` — stub: `export declare function resolveProperties(...)` (add this — current stub uses wrong name)
- `relationship-manager.ts` — stub: `export declare function verifyRelationships(...)`
- `cascade-orchestrator.ts` — stub: `export declare function runCascade(...)`

## Implementation

### Task 1: Update Types (`content-system/cascade/types.ts`)

The existing types are close but need adjustments for Payload Local API usage. Update to:

```typescript
export interface EntityMap {
  countries: CountryEntity[]
  locations: LocationEntity[]
  properties: PropertyEntity[]
  activities: string[]
}

export interface CountryEntity {
  name: string          // e.g., "Rwanda"
  source: 'overview' | 'stay'  // where it was found
}

export interface LocationEntity {
  name: string          // e.g., "Masai Mara", "Sabi Sands"
  country: string       // parent country name
  source: 'stay' | 'day'
}

export interface PropertyEntity {
  name: string          // e.g., "Wilderness Bisate Reserve"
  location: string      // e.g., "Parc National des Volcans"
  country: string       // e.g., "Rwanda"
  existingPropertyId: number | null  // from stay.property field if linked
}

export interface ResolutionResult {
  entityName: string
  action: 'found' | 'created' | 'ambiguous'
  payloadId: number
  slug: string
}

export interface RelationshipAction {
  collection: string
  recordId: number
  field: string
  action: 'existed' | 'added'
  targetId: number
}

export interface ContentProjectAction {
  title: string
  contentType: string
  targetCollection: string
  targetRecordId: number
  action: 'created' | 'already_exists'
  projectId?: number
}

export interface CascadeStepResult {
  step: string
  status: 'completed' | 'failed'
  data: Record<string, unknown>
  error?: string
}

export interface CascadeResult {
  itineraryId: number
  steps: CascadeStepResult[]
  status: 'completed' | 'failed'
  summary: {
    countriesFound: number
    locationsFound: number
    locationsCreated: number
    propertiesFound: number
    propertiesCreated: number
    relationshipsAdded: number
    projectsCreated: number
  }
}

export interface CascadeOptions {
  itineraryId: number
  jobId?: number
  startFromStep?: number  // 1-5, for retry from failure point
  dryRun?: boolean
}
```

Keep the old interfaces if they're imported elsewhere, but the cascade modules should use the new ones.

### Task 2: Entity Extractor (`content-system/cascade/entity-extractor.ts`)

**Input:** Full itinerary document from Payload (depth: 2 to include days, segments, property records)

**Output:** EntityMap with deduplicated entities

**Logic (deterministic — no LLM):**

1. **Countries:** Collect from `itinerary.overview.countries[].country` AND from each stay block's `country` field. Deduplicate by normalised name (trim, case-insensitive).

2. **Locations:** Collect from each stay block's `location` field AND each day's `location` field. Deduplicate. Associate each with its country (from the stay block's `country` field, or from the day's context).

3. **Properties:** Collect from each stay block: `accommodationNameItrvl` (or `accommodationName`), `location`, `country`, and the `property` relationship field (which gives existing `propertyId`). Deduplicate by name.

4. **Activities:** Collect from each activity block's `titleItrvl` (or `title`). Deduplicate.

**Important details:**
- Itinerary `days` is an array. Each day has `segments` which is a blocks field. Access via `day.segments` — each segment has `blockType` ('stay', 'activity', 'transfer').
- The `property` field on stay blocks is a relationship. When fetched with depth: 2, it's a full property object with `id`, `name`, etc. When depth: 0, it's just the integer ID.
- Use the Payload Local API: `await payload.findByID({ collection: 'itineraries', id: itineraryId, depth: 2 })`
- Filter out empty/null values. Trim whitespace on all names.

### Task 3: Destination Resolver (`content-system/cascade/destination-resolver.ts`)

**Input:** EntityMap.countries and EntityMap.locations, plus Payload instance

**Output:** ResolutionResult[] for all destinations

**Logic for countries:**

1. For each country name, query: `await payload.find({ collection: 'destinations', where: { name: { equals: countryName }, type: { equals: 'country' } } })`
2. If found → ResolutionResult with action: 'found'
3. If not found → This shouldn't happen for the 10 African countries we have. Log warning, skip creation. Countries should be manually added.

**Logic for locations (parks, reserves, regions):**

1. First check DestinationNameMappings: `await payload.findGlobal({ slug: 'destination-name-mappings' })`. Search `mappings[].aliases` arrays for exact match (case-insensitive). If found, use the `destination` relationship ID.

2. If no mapping match, query destinations collection: `await payload.find({ collection: 'destinations', where: { name: { equals: locationName }, type: { equals: 'destination' } } })`

3. If found → ResolutionResult with action: 'found'

4. If not found → Create new destination:
   ```typescript
   const countryDest = // find country destination by name
   await payload.create({
     collection: 'destinations',
     data: {
       name: locationName,
       slug: slugify(locationName),   // lowercase, hyphenated
       type: 'destination',
       country: countryDest.id,       // relationship to parent country
       _status: 'draft',
     }
   })
   ```
   Return ResolutionResult with action: 'created'

**Slugify function:** lowercase, replace spaces and special chars with hyphens, collapse multiple hyphens, trim leading/trailing hyphens. Use same pattern as existing slugs in the database.

**Idempotency:** Always check existence before creating. Two cascades on the same itinerary must produce the same result.

### Task 4: Property Resolver (`content-system/cascade/property-resolver.ts`)

**Input:** EntityMap.properties, resolved destinations, plus Payload instance

**Output:** ResolutionResult[] for all properties

**Logic:**

1. If `existingPropertyId` is set (stay block already linked) → fetch property to confirm it exists, return as 'found'

2. If no existing ID, check PropertyNameMappings global for alias match (case-insensitive)

3. If no mapping match, query: `await payload.find({ collection: 'properties', where: { name: { equals: propertyName } } })`

4. If found → return as 'found'

5. If not found → Create new property:
   ```typescript
   // Find the destination for this property's location
   const destinationId = // find from resolved destinations, matching by location name
   
   await payload.create({
     collection: 'properties',
     data: {
       name: propertyName,
       slug: slugify(propertyName),
       destination: destinationId,
       _status: 'draft',
     }
   })
   ```

**Important:** When matching destination for a new property, use the resolved destinations from Step 2. Match the property's `location` field against resolved destination names. If no match, fall back to the country-level destination.

### Task 5: Relationship Manager (`content-system/cascade/relationship-manager.ts`)

**Input:** itineraryId, resolved destination IDs, resolved property IDs, Payload instance

**Output:** RelationshipAction[]

**Logic:**

First, read the `autoPopulateRelationships` setting from ContentSystemSettings global. If false, skip all relationship writes and return empty array.

1. **itinerary → destinations:** Read current `destinations` relationship. Add any resolved destination IDs that aren't already linked.
   ```typescript
   const itinerary = await payload.findByID({ collection: 'itineraries', id: itineraryId, depth: 0 })
   const currentDestIds = (itinerary.destinations || []).map(d => typeof d === 'number' ? d : d.id)
   const newDestIds = resolvedDestIds.filter(id => !currentDestIds.includes(id))
   if (newDestIds.length > 0) {
     await payload.update({
       collection: 'itineraries',
       id: itineraryId,
       data: { destinations: [...currentDestIds, ...newDestIds] }
     })
   }
   ```

2. **destination → relatedItineraries:** For each resolved destination, check its `relatedItineraries` and add this itinerary if not present.
   ```typescript
   for (const destId of allResolvedDestIds) {
     const dest = await payload.findByID({ collection: 'destinations', id: destId, depth: 0 })
     const currentRelated = (dest.relatedItineraries || []).map(r => typeof r === 'number' ? r : r.id)
     if (!currentRelated.includes(itineraryId)) {
       await payload.update({
         collection: 'destinations',
         id: destId,
         data: { relatedItineraries: [...currentRelated, itineraryId] }
       })
     }
   }
   ```

3. **property → relatedItineraries:** Same pattern. For each resolved property, add this itinerary if not present.

4. **destination → featuredProperties:** For each resolved destination, add any properties in that destination that aren't already in `featuredProperties`.
   ```typescript
   // Group properties by destination
   // For each destination, check featuredProperties and add missing ones
   ```

5. **stay block → property:** For each stay block that has `accommodationNameItrvl` matching a resolved property but no `property` relationship set, link them. (Most already linked, but handle edge cases.)

Return an array of all actions taken (existed vs added).

### Task 6: ContentProject Generator

**This is NOT a separate file** — it's part of the cascade orchestrator (Step 5). The logic:

For each resolved destination (both countries and locations):
1. Check if a ContentProject already exists: `await payload.find({ collection: 'content-projects', where: { contentType: { equals: 'destination_page' }, targetCollection: { equals: 'destinations' }, targetRecordId: { equals: String(destinationId) } } })`
2. If none exists, create one:
   ```typescript
   await payload.create({
     collection: 'content-projects',
     data: {
       title: `Destination Page: ${destinationName}`,
       slug: `destination-page-${destinationSlug}`,
       stage: 'idea',
       contentType: 'destination_page',
       originPathway: 'cascade',
       originItinerary: itineraryId,
       targetCollection: 'destinations',
       targetRecordId: String(destinationId),
       destinations: [destinationName],
       freshnessCategory: 'quarterly',
     }
   })
   ```

For each resolved property:
1. Same pattern — check existence, create if missing
2. `contentType: 'property_page'`, `targetCollection: 'properties'`

### Task 7: Cascade Orchestrator (`content-system/cascade/cascade-orchestrator.ts`)

**Input:** CascadeOptions (itineraryId, optional jobId, optional startFromStep)

**Output:** CascadeResult

The orchestrator coordinates the 5 steps. If a `jobId` is provided, it updates the ContentJob's `progress` field after each step.

```
Step 1: Entity Extraction → EntityMap
Step 2: Destination Resolution → ResolutionResult[]
Step 3: Property Resolution → ResolutionResult[]
Step 4: Relationship Verification → RelationshipAction[]
Step 5: ContentProject Generation → ContentProjectAction[]
```

**Job progress updates** (if jobId provided):
```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function updateJobProgress(jobId: number, progress: Record<string, unknown>) {
  const payload = await getPayload({ config: configPromise })
  await payload.update({
    collection: 'content-jobs',
    id: jobId,
    data: { progress }
  })
}
```

After each step, update progress:
```json
{
  "step_1_complete": true,
  "entities": { "countries": 1, "locations": 4, "properties": 4, "activities": 5 },
  "step_2_complete": true,
  "destinations": { "found": 1, "created": 3 },
  "step_3_complete": true,
  "properties": { "found": 4, "created": 0 },
  "step_4_complete": true,
  "relationships": { "added": 12, "existed": 5 },
  "step_5_complete": true,
  "projects": { "created": 3, "already_exists": 0 }
}
```

**startFromStep:** If provided, skip completed steps. Load intermediate results from the job's progress field. For step 1 (entity extraction), always re-run since it's deterministic and fast.

**Error handling:** If any step fails:
1. Update job status to 'failed' with error message
2. Update progress to show which step failed
3. Return CascadeResult with status: 'failed'
4. Do NOT continue to the next step

**dryRun:** If true, run entity extraction and resolution queries but don't create any records or update relationships. Return what WOULD be created. Useful for testing.

### Task 8: API Endpoint (`src/app/(payload)/api/content/cascade/route.ts`)

POST endpoint. Auth: `CONTENT_SYSTEM_SECRET` header (same pattern as embed endpoint).

**Request body:**
```json
{
  "itineraryId": 23,
  "dryRun": false,
  "startFromStep": 1
}
```

**Logic:**
1. Validate auth
2. Create ContentJob with jobType: 'cascade', status: 'pending', itineraryId
3. Update job to status: 'running', startedAt: now
4. Call `runCascade({ itineraryId, jobId: job.id, startFromStep, dryRun })`
5. On success: update job to 'completed'
6. On failure: update job to 'failed'
7. Return CascadeResult

**Response:**
```json
{
  "success": true,
  "jobId": 1,
  "result": { /* CascadeResult */ }
}
```

Set `export const maxDuration = 120` and `export const dynamic = 'force-dynamic'`.

### Task 9: Jobs API Endpoint (`src/app/(payload)/api/content/jobs/route.ts`)

Same auth pattern.

**GET:** List jobs with optional filters
- Query params: `type` (cascade, decompose, etc.), `status` (pending, running, completed, failed), `limit` (default 20)
- Returns: `{ jobs: ContentJob[] }`

**PATCH:** Retry a failed job
- Body: `{ jobId: number }`
- Logic: reset status to 'pending', increment retriedCount, re-trigger cascade with startFromStep = first failed step
- Returns: `{ success: true, jobId: number }`

### Task 10: afterChange Hook (`src/collections/Itineraries/hooks/triggerCascade.ts`)

Fires after an itinerary is saved. Creates a ContentJob and triggers the cascade endpoint asynchronously.

**Conditions — only fire when:**
- The itinerary's `_status` changes to 'published' (compare `previousDoc._status` vs `doc._status`)
- OR it's a brand new itinerary (`operation === 'create'`)

**Do NOT fire on:**
- Regular draft saves
- Updates to already-published itineraries that don't change status

**Implementation:**
```typescript
import type { CollectionAfterChangeHook } from 'payload'

export const triggerCascade: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const isNewlyPublished = doc._status === 'published' && previousDoc?._status !== 'published'
  const isNew = operation === 'create'
  
  if (!isNewlyPublished && !isNew) return doc

  // Fire and forget — do NOT await this
  const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://kiuli.com'
  const secret = process.env.CONTENT_SYSTEM_SECRET
  
  if (!secret) {
    console.warn('[triggerCascade] CONTENT_SYSTEM_SECRET not set, skipping cascade')
    return doc
  }

  fetch(`${baseUrl}/api/content/cascade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify({ itineraryId: doc.id }),
  }).catch(err => {
    console.error('[triggerCascade] Failed to trigger cascade:', err.message)
  })

  return doc
}
```

Register in `src/collections/Itineraries/hooks/index.ts` and add to the Itineraries collection config:
```typescript
hooks: {
  beforeChange: [calculateChecklist, updateLastModified, validatePublish],
  afterChange: [triggerCascade],
  afterRead: [resolveFields],
},
```

## Testing

Test against **itinerary 23** (Rwanda, ID=23). This itinerary has:
- 1 country: Rwanda
- 4 locations: Kigali, Akagera National Park, Parc National des Volcans, Nyungwe Forest National Park  
- 4 properties: Hemingways Retreat Kigali, Wilderness Magashi Peninsula, Wilderness Bisate Reserve, One&Only Nyungwe House (all already exist as property IDs 6, 7, 8, 9)

### Test 1: Dry Run

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23, "dryRun": true}'
```

**Expected:** Returns EntityMap showing 1 country, 4 locations, 4 properties. No records created. No job status changes.

### Test 2: Full Cascade

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

**Verify after:**

```sql
-- Step 2: New park-level destinations created
SELECT id, name, slug, type, country_id 
FROM destinations 
WHERE type = 'destination' 
ORDER BY id;
-- Expect: ~4 new destinations (Kigali, Akagera, Volcans, Nyungwe) linked to Rwanda (id=5)

-- Step 3: Properties should all be 'found' (already exist)
SELECT COUNT(*) FROM properties;
-- Expect: still 33 (no new properties created)

-- Step 4: Relationships populated
-- itinerary → destinations includes new park-level destinations
SELECT destinations_id FROM itineraries_rels 
WHERE parent_id = 23 AND path = 'destinations';
-- Expect: Rwanda (5) + new park-level destination IDs

-- destination → relatedItineraries backfilled
SELECT parent_id, itineraries_id FROM destinations_rels 
WHERE path = 'relatedItineraries' AND itineraries_id = 23;
-- Expect: entries for Rwanda + each new park destination

-- Step 5: ContentProjects created
SELECT title, content_type, target_collection, target_record_id, stage
FROM content_projects
WHERE origin_pathway = 'cascade'
ORDER BY id;
-- Expect: destination_page projects for new destinations + Rwanda
-- Expect: property_page projects for all 4 properties
```

### Test 3: Idempotency

Run the cascade again on itinerary 23:
```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

**Verify:**
- No duplicate destinations created
- No duplicate ContentProjects created
- Relationship counts unchanged
- Job shows all steps completed with "found"/"already_exists" actions

### Test 4: Auth Rejection

```bash
curl -X POST https://kiuli.com/api/content/cascade \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

**Expect:** 401

### Test 5: Jobs API

```bash
# List cascade jobs
curl "https://kiuli.com/api/content/jobs?type=cascade" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET"
```

**Expect:** Returns the cascade jobs from Tests 2 and 3, both with status 'completed'

### Test 6: Second Itinerary (itinerary 24 — South Africa & Mozambique)

Run cascade on itinerary 24 to test multi-country itinerary and overlapping properties.

**Expect:**
- Countries found: South Africa, Mozambique (both exist)
- New locations created for: Cape Town, Franschhoek, Northern Cape, Sabi Sands, Johannesburg, Benguerra Island
- Properties: all 6 found (IDs 15-20, 24)
- Relationships: itinerary 24 linked to all resolved destinations
- ContentProjects: destination_page for each new location, property_page for each property (unless already created by Test 2... they won't be since these are different properties)

## Gate Evidence

Build must pass. All tests must pass.

| Gate | Evidence |
|------|----------|
| entity-extractor produces correct counts for itinerary 23 | Dry run response |
| New park-level destinations created with correct country links | DB query |
| No duplicate destinations on re-run | DB count unchanged |
| All bidirectional relationships populated | DB queries on rels tables |
| ContentProjects created at 'idea' stage | DB query |
| No duplicate ContentProjects on re-run | DB count unchanged |
| Job progress tracking works | Job record shows all 5 steps |
| Auth rejection returns 401 | curl response |
| afterChange hook registered (manual verification) | Itinerary collection config inspection |
| Build passes | `npm run build` |

## Do NOT

- Do NOT auto-publish any ContentProjects (all start at 'idea' stage)
- Do NOT modify the Destinations, Properties, or Itineraries collection schemas
- Do NOT use LLM for entity extraction (deterministic only)
- Do NOT block itinerary saves (afterChange hook is fire-and-forget)
- Do NOT create a Lambda function (this runs on Vercel)
- Do NOT delete any existing data (additive only)
- Do NOT modify the ContentJobs, ContentProjects, or ContentSystemSettings collection schemas
- Do NOT modify any existing hooks (add the new hook alongside existing ones)

## Report

After completion, create `content-engine/reports/phase5-itinerary-cascade.md` with:
1. Files created/modified
2. Entity extraction results for itinerary 23
3. Destinations created (names, IDs, parent country)
4. Relationships added (counts per collection)
5. ContentProjects created (titles, types, target IDs)
6. Idempotency verification results
7. Multi-itinerary test results (itinerary 24)
8. Any issues encountered and how they were resolved
