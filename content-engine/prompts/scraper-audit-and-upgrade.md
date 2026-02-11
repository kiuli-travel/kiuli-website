# Scraper Pipeline Forensic Audit & Upgrade Prompt

**Date:** 2026-02-11
**Scope:** Complete forensic audit of all 5 Lambda functions + Vercel API route + supporting modules
**Auditor:** Claude (Strategic)
**Recipient:** Claude Code (Tactical)

---

## Part 1: Forensic Audit Results

### Files Audited

| File | Lines | Status |
|------|-------|--------|
| lambda/orchestrator/handler.js | ~220 | Read in full |
| lambda/orchestrator/transform.js | ~500 | Read in full |
| lambda/orchestrator/shared/payload.js | ~200 | Read in full |
| lambda/orchestrator/shared/s3.js | ~120 | Read in full |
| lambda/orchestrator/shared/openrouter.js | ~250 | Read in full |
| lambda/orchestrator/shared/notifications.js | ~80 | Read in full |
| lambda/shared/config.js | ~40 | Read in full |
| lambda/image-processor/handler.js | ~280 | Read in full |
| lambda/image-processor/processImage.js | ~140 | Read in full |
| lambda/labeler/handler.js | ~220 | Read in full |
| lambda/labeler/labelImage.js | ~100 | Read in full |
| lambda/finalizer/handler.js | ~370 | Read in full |
| lambda/finalizer/selectHero.js | ~110 | Read in full |
| lambda/finalizer/generateSchema.js | ~130 | Read in full |
| lambda/finalizer/schemaValidator.js | ~220 | Read in full |
| lambda/video-processor/handler.js | ~230 | Read in full |
| lambda/sync-shared.sh | ~50 | Read in full |
| src/app/(payload)/api/scrape-itinerary/route.ts | ~180 | Read in full |
| src/collections/Properties.ts | ~170 | Read in full |
| src/collections/Itineraries/index.ts | ~900+ | Read in full |
| src/globals/PropertyNameMappings.ts | ~40 | Read in full |
| src/globals/DestinationNameMappings.ts | ~40 | Read in full |
| KIULI_LAMBDA_ARCHITECTURE.md | ~900 | Read in full |

**Database queries executed:** 8 (properties, stays, destinations, itineraries, FAQs, media)

### Pipeline Architecture Understanding

The scraper pipeline is a 5-Lambda async chain:

```
Admin UI → POST /api/scrape-itinerary (Vercel)
  → Creates ItineraryJob record
  → Invokes Orchestrator Lambda (async)

Orchestrator (kiuli-v6-orchestrator):
  → Calls Scraper Lambda via HTTP (kiuli-scraper — Puppeteer)
  → Runs transform.js on raw iTrvl data
  → Creates/updates Itinerary record in Payload
  → Creates ImageStatus records (1 per image/video)
  → Invokes Image Processor (async)

Image Processor (kiuli-v6-image-processor):
  → Processes 20 images per invocation (chunked)
  → Global dedup via sourceS3Key lookup
  → Downloads from iTrvl CDN → uploads to Kiuli S3
  → Creates Media records with source context
  → Self-invokes for next chunk OR triggers Labeler
  → Also invokes Video Processor for any videos

Video Processor (kiuli-v6-video-processor, not in main chain):
  → Converts HLS streams to MP4 via FFmpeg
  → Uploads to S3, creates Media record
  → Links video to itinerary

Labeler (kiuli-v6-labeler):
  → 10 images per batch, 3 concurrent AI calls
  → GPT-4o via OpenRouter with structured outputs
  → Context-aware enrichment (property name, country, segment type)
  → Updates Media records with scene, mood, tags, etc.
  → Self-invokes for next batch OR triggers Finalizer

Finalizer (kiuli-v6-finalizer):
  → Reconciles job counters from ImageStatuses (authoritative)
  → Links images to itinerary segments by type+name matching
  → Selects hero image (priority: isHero > wildlife > landscape)
  → Generates JSON-LD schema (Product + FAQPage + Breadcrumb)
  → Validates schema against Google Rich Results requirements
  → Calculates publish checklist and blockers
  → Completes job
```

### Data Flow Verification

**Destination linking:** WORKS CORRECTLY. `linkDestinations()` in transform.js queries Destinations by country name. All 6 itineraries have correct destination relationships in the database.

**Image context preservation:** WORKS CORRECTLY. ImageStatus records carry propertyName, segmentType, dayIndex, country through the full pipeline. Finalizer matches images to segments via `segmentType-propertyName` key.

**Deduplication:** WORKS CORRECTLY. Image Processor checks `sourceS3Key` uniqueness globally. Race condition handling exists for concurrent Lambda instances.

**Schema generation:** WORKS CORRECTLY. Product + FAQPage + BreadcrumbList schemas generated and validated. Schema validator catches missing fields, invalid URLs, placeholder content.

---

## Part 2: Findings

### P0 — STRUCTURAL GAP

#### Finding 1: Zero Property Records Created

**Severity:** P0 — Blocks Content Engine, frontend property pages, cross-referencing

**Evidence:**
- `SELECT count(*) FROM properties` → **0 rows**
- 30 stay segments exist with accommodation names (29 unique properties)
- Properties collection exists with rich schema: `description_itrvl`, `destination` relationship, `heroImage`, `gallery`, `faqItems`, `priceTier`, `metaTitle`, `metaDescription`, `answerCapsule`, `focusKeyword`
- Itinerary stay blocks have `property` relationship field (added by migration `20260208_add_properties_and_mappings.ts`)
- PropertyNameMappings global exists for alias resolution
- Content Engine embeddings schema has `property_id` column and `properties[]` metadata array
- **BUT:** `transform.js` never creates Property records, never populates the `property` relationship on stay blocks

**Root cause:** Property extraction was designed as a future Content Engine Cascade task, but the fundamental records need to exist at scrape time (same reason destinations are linked at scrape time).

**Impact chain:**
- Content Engine Phase 2.5 bootstrap can't embed property content (0 properties)
- Content Engine Phase 5 Cascade can't resolve property entities (nothing to resolve to)
- Frontend property pages can't render (no data)
- Cross-itinerary property linking impossible (The Silo appears in 2 itineraries but has no shared record)
- Image-to-property attribution incomplete

---

### P1 — BUGS

#### Finding 2: Property-Specific FAQs Silently Skipped

**Severity:** P1 — Data quality gap, currently invisible

**Evidence:**
- `SELECT DISTINCT question_itrvl FROM itineraries_faq_items` → **9 unique questions**, all generic templates
- Every itinerary has exactly 4 FAQs: "best time to visit [country]", "fitness level", "suitable for children", "what to pack"
- Zero property-specific FAQs exist (e.g., "What is included at Singita Boulders?")

**Root cause in transform.js, `generateFaqItems()`:**
```javascript
const stays = segments.filter(s => s.type === 'stay' || s.type === 'accommodation');
for (const stay of stays.slice(0, 3)) {
    if (stay.name) {  // ← BUG: stay.name is often null in iTrvl data
      faqItems.push(createFaqItem(
        `What is included at ${stay.name}?`,
```

The code checks `stay.name` but iTrvl presentation data uses `title` as the primary name field. The code itself acknowledges this in comments: *"iTrvl data has name=null, property name is in title or supplierName"*. Other functions in the same file correctly use the fallback chain `segment.name || segment.title || segment.supplierName` — but `generateFaqItems()` does not.

**Expected behaviour:** Up to 3 property-specific FAQs per itinerary using the accommodation name and inclusions text. Currently generating 0.

---

#### Finding 3: Auth Header Inconsistency in processImage.js

**Severity:** P1 — Works today, fragile

**Location:** `lambda/image-processor/processImage.js`, `createMediaRecord()` function, line ~100

**Evidence:**
```javascript
// processImage.js uses:
'Authorization': `Bearer ${payload.PAYLOAD_API_KEY}`

// Every other Payload API call across ALL Lambdas uses:
'Authorization': `users API-Key ${PAYLOAD_API_KEY}`
```

The Itineraries collection access control (`authenticatedOrApiKey`) accepts both formats, so this works today. But it's inconsistent and if auth logic changes, media creation would break silently while everything else continues working.

**Fix:** Change to `users API-Key ${payload.PAYLOAD_API_KEY}` to match all other callers.

---

### P2 — DOCUMENTATION DISCREPANCIES (not in scope for this upgrade)

#### Finding 4: Architecture Doc Says Nemotron, Code Uses GPT-4o

- KIULI_LAMBDA_ARCHITECTURE.md says "AI Enrichment: Nemotron (via OpenRouter)" throughout
- openrouter.js `analyzeImageWithContext()`: `model: 'openai/gpt-4o'`

#### Finding 5: config.js Is Dead Code

- `lambda/shared/config.js` defines constants that no handler imports
- All values hardcoded locally in each handler

### P3 — OBSERVATIONAL (not in scope for this upgrade)

#### Finding 6: Scraper Lambda Source Not in Version Control

Only `lambda/scraper-deploy.zip` exists. No source handler.js visible.

#### Finding 7: scraper-deploy.zip Committed to Git

Binary zip file in version control. Should be in .gitignore.

---

## Part 3: Upgrade Specification

### Scope

Fix Findings 1, 2, and 3. Do NOT touch Findings 4-7 (documentation and cleanup — separate task).

All changes are in **three files only:**
1. `lambda/orchestrator/transform.js` — Property extraction + FAQ fix
2. `lambda/orchestrator/handler.js` — Bidirectional property linking
3. `lambda/image-processor/processImage.js` — Auth header fix

---

### Task 1: Add Property Extraction to transform.js

#### 1A: Create `linkProperties()` function

Add a new async function that follows the exact same pattern as the existing `linkDestinations()` function. Place it directly after `linkDestinations()` in the file.

```
async function linkProperties(segments, destinationIds)
```

**For each stay segment:**

1. Extract accommodation name using the same fallback chain used elsewhere: `segment.name || segment.title || segment.supplierName`
2. Skip if no name extracted
3. Generate slug: reuse existing `generateSlug()` function
4. **Check PropertyNameMappings first:**
   - GET `${PAYLOAD_API_URL}/api/globals/property-name-mappings`
   - Search mappings array: for each mapping, check if `mapping.aliases` (JSON array) contains the accommodation name (case-insensitive)
   - If found, use `mapping.property` as the Property ID (it may be a populated object with `.id`, or just an ID — handle both)
5. **If not in mappings, query Properties by slug:**
   - GET `${PAYLOAD_API_URL}/api/properties?where[slug][equals]=${slug}&limit=1`
   - If found, use existing record
6. **If not found, create a new Property record:**
   - POST to `${PAYLOAD_API_URL}/api/properties`
   - Fields to set:
     - `name`: the accommodation name
     - `slug`: generated slug
     - `destination`: find matching destination ID from the segment's country. The `destinationIds` array was returned by `linkDestinations()`, but it's keyed by country. You'll need to also resolve the segment's country to a destination ID. Use the same query pattern as linkDestinations: `GET /api/destinations?where[name][equals]=${country}&limit=1`
     - `description_itrvl`: the segment's description text as a PLAIN STRING. Do NOT use Lexical richText format — the Properties collection `description_itrvl` field is type `textarea`, not `richText`.
     - `_status`: `'draft'`
   - Do NOT set: type, priceTier, heroImage, gallery, metaTitle, metaDescription, faqItems, answerCapsule, focusKeyword (these are Content Engine / manual tasks)
7. **Return a Map of accommodation name → Property ID** for use in stay block construction

**Important constraints:**
- Cache the PropertyNameMappings response — fetch it ONCE at the start, not per segment
- Cache Property lookups — if "The Silo" appears twice across segments, don't create duplicates. Use a local Map keyed by slug.
- Use the same auth headers as `linkDestinations()`: `{ 'Authorization': 'users API-Key ${PAYLOAD_API_KEY}' }`
- Log what happens: `[linkProperties] CREATED: Singita Boulders -> 45`, `[linkProperties] LINKED: The Silo -> 12 (existing)`, `[linkProperties] ALIAS MATCH: One&Only Cape Town -> 8 (via mapping)`
- Wrap individual property operations in try/catch — one property failure should not fail the entire pipeline. Log and continue.

#### 1B: Call linkProperties() from transform()

In the `transform()` function, after the existing `linkDestinations()` call:

```javascript
// Link to destination records based on extracted countries
const countriesForLinking = countries.map(c => ({ country: c }));
const destinationIds = await linkDestinations(countriesForLinking);

// NEW: Link/create property records for stay segments
const propertyMap = await linkProperties(segments, destinationIds);
```

#### 1C: Set property relationship on stay blocks

In `mapSegmentToBlock()`, when `blockType === 'stay'`, add the property field to the returned object. This requires passing the propertyMap into mapSegmentToBlock.

**Approach:** Add `propertyMap` as a third parameter to `mapSegmentToBlock(segment, mediaMapping, propertyMap)`.

In the stay block return object, add:
```javascript
property: propertyMap?.get(accommodationName) || null,
```

Where `accommodationName` is the already-extracted `segment.name || segment.title || 'Accommodation'`.

Update all call sites of `mapSegmentToBlock` in the `days` mapping to pass `propertyMap`.

#### 1D: Return property IDs from transform() for bidirectional linking

Add a `_propertyIds` field to the transformed object:
```javascript
const transformed = {
    // ... existing fields ...
    _propertyIds: [...new Set(propertyMap.values())], // Unique property IDs for bidirectional linking
};
```

---

### Task 2: Bidirectional Property Linking in handler.js

In `lambda/orchestrator/handler.js`, AFTER the itinerary is created/updated (after `payloadItinerary = await payload.createItinerary(createData)` or the update path), add:

```javascript
// Update Property relatedItineraries for bidirectional linking
const propertyIds = transformedData._propertyIds || [];
if (propertyIds.length > 0) {
  console.log(`[Orchestrator] Linking ${propertyIds.length} properties to itinerary ${payloadItinerary.id}`);
  for (const propertyId of propertyIds) {
    try {
      const property = await payload.getById('properties', propertyId, { depth: 0 });
      const existingRelated = (property.relatedItineraries || []).map(r => typeof r === 'object' ? r.id : r);
      if (!existingRelated.includes(payloadItinerary.id)) {
        await payload.update('properties', propertyId, {
          relatedItineraries: [...existingRelated, payloadItinerary.id]
        });
        console.log(`[Orchestrator] Linked property ${propertyId} -> itinerary ${payloadItinerary.id}`);
      }
    } catch (err) {
      console.log(`[Orchestrator] Failed to update Property ${propertyId} relatedItineraries: ${err.message}`);
      // Non-fatal — don't fail the pipeline
    }
  }
}
```

Also: strip `_propertyIds` before sending to Payload to keep the data clean. Either:
- `delete createData._propertyIds` before `payload.createItinerary(createData)`, OR
- Payload will ignore unknown fields, so this is optional but cleaner

---

### Task 3: Fix Property-Specific FAQ Generation in transform.js

In `generateFaqItems()`, fix the accommodation name extraction:

**Current (buggy):**
```javascript
for (const stay of stays.slice(0, 3)) {
    if (stay.name) {
      faqItems.push(createFaqItem(
        `What is included at ${stay.name}?`,
        stay.inclusions || stay.description ||
```

**Fixed:**
```javascript
for (const stay of stays.slice(0, 3)) {
    const propertyName = stay.name || stay.title || stay.supplierName;
    if (propertyName) {
      faqItems.push(createFaqItem(
        `What is included at ${propertyName}?`,
        stay.clientIncludeExclude || stay.inclusions || stay.description ||
        `${propertyName} offers luxury accommodation with full board and activities as specified in the itinerary.`
      ));
```

Note: also added `stay.clientIncludeExclude` as first fallback — this is the iTrvl presentation field that contains formatted inclusions text and is richer than `stay.inclusions`.

---

### Task 4: Fix Auth Header in processImage.js

In `lambda/image-processor/processImage.js`, function `createMediaRecord()`:

**Current:**
```javascript
'Authorization': `Bearer ${payload.PAYLOAD_API_KEY}`,
```

**Fixed:**
```javascript
'Authorization': `users API-Key ${payload.PAYLOAD_API_KEY}`,
```

---

### Execution Order

1. Make changes to `lambda/orchestrator/transform.js` (Tasks 1A, 1B, 1C, 1D, Task 3)
2. Make changes to `lambda/orchestrator/handler.js` (Task 2)
3. Make change to `lambda/image-processor/processImage.js` (Task 4)
4. Run `cd lambda && ./sync-shared.sh` to sync shared modules
5. Verify: `node -c lambda/orchestrator/transform.js` (syntax check)
6. Verify: `node -c lambda/orchestrator/handler.js` (syntax check)
7. Verify: `node -c lambda/image-processor/processImage.js` (syntax check)
8. Verify: `npm run build` from project root (full build check)
9. Commit all changes with message: `fix: Add property extraction to scraper pipeline, fix FAQ generation bug, fix auth header`

---

### Post-Implementation Verification

After deploying the updated Lambdas and re-scraping the 6 test itineraries, these queries validate success:

```sql
-- Should return ~29 rows (one per unique accommodation name)
SELECT count(*) FROM properties;

-- All stay blocks should have property_id populated
SELECT count(*) FROM itineraries_blocks_stay WHERE property_id IS NULL;
-- Expected: 0

-- Properties should have destination relationships
SELECT p.name, d.name as destination FROM properties p
JOIN destinations d ON d.id = p.destination_id
ORDER BY p.name;

-- FAQs should now include property-specific questions
SELECT DISTINCT question_itrvl FROM itineraries_faq_items
WHERE question_itrvl LIKE 'What is included at%';
-- Expected: ~15-18 rows

-- Cross-itinerary linking should work (The Silo in 2 itineraries)
SELECT p.name, count(DISTINCT ir.parent_id) as itinerary_count
FROM properties p
JOIN properties_rels ir ON ir.properties_id = p.id AND ir.path = 'relatedItineraries'
GROUP BY p.name
HAVING count(DISTINCT ir.parent_id) > 1;
```

**IMPORTANT:** These verification queries can only be run AFTER re-scraping the 6 test itineraries with the upgraded code. The existing database records were created with the old transform.js and won't have properties or property-specific FAQs.

---

### What This Does NOT Change

- **Scraper Lambda** (`kiuli-scraper`): Untouched. Returns raw iTrvl data; all changes are downstream.
- **Image Processor logic**: Only the auth header fix. No image processing changes.
- **Labeler**: Untouched. Already receives property context via ImageStatus records.
- **Finalizer**: Untouched. Already links images to segments by property name.
- **Video Processor**: Untouched.
- **Vercel API route** (`scrape-itinerary/route.ts`): Untouched.
- **Payload collections**: Untouched. Properties collection already has all needed fields.
- **Lambda deployment**: Code change only. After build verification, the orchestrator and image-processor Lambdas need repackaging and deployment to AWS — that is a separate step.
