# Phase 6: Ideation Pipeline

## Context

Phases 1-5 complete. The cascade creates destination_page and property_page ContentProjects for structural entities. Phase 6 creates **article** ContentProjects — the actual editorial content that drives SEO and qualification.

When a cascade completes, the decompose step generates 10-15 article candidates from the itinerary, filters them against editorial directives and the embedding store, and creates ContentProjects at `brief` stage for survivors. Filtered candidates are recorded with reasons.

**Runs as a Vercel endpoint** (consistent with Phase 5).

## Current State

### What Exists
- 20 ContentProjects from cascade: 10 destination_page + 10 property_page (all at `idea` stage)
- 143 bootstrap embeddings in content_embeddings
- OpenRouter client working (tested in Phase 3)
- Embedding query module working (semanticSearch in content-system/embeddings/query.ts)
- EditorialDirectives collection (empty — no directives yet)
- ContentJobs collection (9 cascade jobs)
- 7 itineraries with full structured data

### Stub Files to Replace
- `content-system/ideation/candidate-generator.ts` — stub
- `content-system/ideation/candidate-filter.ts` — stub
- `content-system/ideation/brief-shaper.ts` — stub
- `content-system/signals/itinerary-decomposer.ts` — stub

### Types Files to Update
- `content-system/ideation/types.ts` — has types but may need adjustments
- `content-system/signals/types.ts` — has types but may need adjustments

## Architecture

```
/api/content/decompose (POST)
  → Creates ContentJob (type: 'decompose')
  → Fetches itinerary (depth: 2)
  → Step 1: Build context (itinerary summary + entities + existing content via embeddings)
  → Step 2: Generate candidates (OpenRouter ideation model → 10-15 structured candidates)
  → Step 3: Filter candidates (editorial directives + embedding similarity for duplicates)
  → Step 4: Shape briefs (create ContentProject records at 'brief' stage; filtered → 'filtered' stage)
  → Updates ContentJob to completed
```

## Implementation

### Task 1: Update Types

**`content-system/ideation/types.ts`** — keep existing interfaces but add/adjust:

```typescript
export interface RawCandidate {
  title: string
  contentType: 'itinerary_cluster' | 'authority'
  briefSummary: string
  targetAngle: string
  targetAudience: ('customer' | 'professional' | 'guide')[]
  destinations: string[]
  properties: string[]
  species: string[]
  freshnessCategory: 'monthly' | 'quarterly' | 'annual' | 'evergreen'
  competitiveNotes: string
}

export interface FilteredCandidate extends RawCandidate {
  passed: boolean
  filterReason?: string
  directivesMatched: string[]
  duplicateScore: number
  duplicateTitle?: string
}
```

**`content-system/signals/types.ts`** — update DecomposeOptions:

```typescript
export interface DecomposeOptions {
  itineraryId: number
  jobId?: number
}

export interface DecompositionResult {
  itineraryId: number
  totalCandidates: number
  passed: number
  filtered: number
  projectsCreated: number[]
  filteredProjectIds: number[]
}
```

### Task 2: Candidate Generator (`content-system/ideation/candidate-generator.ts`)

**Input:** Full itinerary data (fetched with depth: 2) + existing content context from embeddings

**Output:** RawCandidate[] (10-15 candidates)

**Implementation:**

1. Build an itinerary summary from the structured data:
   - Title, countries, number of nights
   - Each stay: property name, location, country, nights, description text (extract from Lexical richText using the lexical-text.ts extractTextFromLexical function from Phase 2.5)
   - Each activity: title
   - Investment level: price range
   - FAQ questions (just the questions, not answers)

2. Query the embedding store for existing content about the same destinations:
   ```typescript
   import { semanticSearch } from '../embeddings/query'
   
   // For each destination in the itinerary, find what content already exists
   const existingContent: string[] = []
   for (const dest of itinerary.overview?.countries || []) {
     const results = await semanticSearch(dest.country, { topK: 5, minScore: 0.4 })
     existingContent.push(...results.map(r => `[${r.chunkType}] ${r.chunkText.substring(0, 200)}`))
   }
   ```

3. Call OpenRouter with the ideation model:

   **System prompt:**
   ```
   You are Kiuli's content strategist. Kiuli is a luxury African safari travel company targeting high-net-worth US individuals. Generate article candidates from safari itineraries.

   ARTICLE TYPES:
   - itinerary_cluster: Destination deep-dives, experience preparation, wildlife/ecology, cultural/historical, practical logistics, comparison and decision support. These link strongly to the source itinerary.
   - authority: Science-to-field translation, industry analysis, debunking, policy/operations. These build topical authority.

   RULES:
   - Generate 10-15 candidates total, mix of both types
   - Each must have a specific angle that differentiates it from generic safari content
   - Titles should be search-optimised (what would a HNWI Google?)
   - Do NOT generate content about topics already well-covered in existing site content (provided below)
   - Do NOT generate generic "Top 10 things to do in X" listicles
   - Do NOT generate content comparing specific lodges against each other
   - Every candidate must connect to at least one destination or property from the itinerary

   TARGET AUDIENCE: High-net-worth US individuals planning luxury safaris ($25,000-$100,000+)

   Respond with ONLY a JSON array of candidates. No preamble, no markdown fences, no explanation.
   ```

   **User message:** Include the itinerary summary and existing content context.

   **Response format** (instruct the model to return this JSON):
   ```json
   [
     {
       "title": "string",
       "contentType": "itinerary_cluster | authority",
       "briefSummary": "2-3 sentence summary of what this article covers and why it matters",
       "targetAngle": "The specific angle that makes this different from competitors",
       "targetAudience": ["customer"],
       "destinations": ["Rwanda", "Volcanoes National Park"],
       "properties": ["Wilderness Bisate Reserve"],
       "species": ["mountain gorilla"],
       "freshnessCategory": "quarterly",
       "competitiveNotes": "Brief note on what competitors have published on this topic"
     }
   ]
   ```

4. Parse the response. Strip markdown fences if present. Parse JSON. Validate each candidate has required fields. Drop any that fail validation (log warning). Return RawCandidate[].

**Temperature:** 0.8 (creative ideation needs variety)
**Max tokens:** 4096

### Task 3: Candidate Filter (`content-system/ideation/candidate-filter.ts`)

**Input:** RawCandidate[], Payload instance

**Output:** FilteredCandidate[] (all candidates with passed/failed status and reasons)

**Three filter checks per candidate:**

1. **Editorial Directives:**
   ```typescript
   const payload = await getPayload({ config: configPromise })
   const directives = await payload.find({
     collection: 'editorial-directives',
     where: { active: { equals: true } },
     limit: 100,
   })
   ```
   
   For each active directive, check if the candidate matches its tags:
   - If directive has `destinationTags`, check if any overlap with candidate's destinations
   - If directive has `contentTypeTags`, check if candidate's contentType is in the list
   - If directive has `topicTags`, do a simple keyword check of candidate title + briefSummary against topic tags
   - If ALL applicable tag dimensions match (AND logic across dimensions), the directive applies
   - If a directive applies, mark candidate as filtered with reason: `"Filtered by directive: {directive.text}"`
   - Increment the directive's `filterCount30d` (fire-and-forget update)

2. **Embedding Duplicate Check:**
   ```typescript
   import { semanticSearch } from '../embeddings/query'
   
   const results = await semanticSearch(candidate.title + ' ' + candidate.briefSummary, {
     topK: 3,
     minScore: 0.7,  // High threshold — only flag very similar content
   })
   
   if (results.length > 0 && results[0].score > 0.85) {
     // Very high similarity — likely duplicate
     candidate.passed = false
     candidate.filterReason = `Too similar to existing content: "${results[0].chunkText.substring(0, 100)}..." (score: ${results[0].score.toFixed(3)})`
     candidate.duplicateScore = results[0].score
     candidate.duplicateTitle = results[0].chunkText.substring(0, 100)
   }
   ```

3. **Existing ContentProject Check:**
   Check if a ContentProject with similar title already exists:
   ```typescript
   const existing = await payload.find({
     collection: 'content-projects',
     where: {
       title: { equals: candidate.title },
       stage: { not_equals: 'filtered' },
     },
     limit: 1,
   })
   if (existing.docs.length > 0) {
     candidate.passed = false
     candidate.filterReason = `ContentProject already exists: "${existing.docs[0].title}" (ID: ${existing.docs[0].id})`
   }
   ```

Return ALL candidates (both passed and filtered) with their status.

### Task 4: Brief Shaper (`content-system/ideation/brief-shaper.ts`)

**Input:** FilteredCandidate[] + itineraryId + Payload instance

**Output:** Array of created ContentProject IDs (for passed) and filtered project IDs

**For each candidate that passed:**
```typescript
const project = await payload.create({
  collection: 'content-projects',
  data: {
    title: candidate.title,
    slug: slugify(candidate.title),
    stage: 'brief',
    contentType: candidate.contentType,
    originPathway: 'itinerary',
    originItinerary: itineraryId,
    targetCollection: 'posts',
    briefSummary: candidate.briefSummary,
    targetAngle: candidate.targetAngle,
    targetAudience: candidate.targetAudience,
    competitiveNotes: candidate.competitiveNotes,
    destinations: candidate.destinations,
    properties: candidate.properties,
    species: candidate.species,
    freshnessCategory: candidate.freshnessCategory,
  },
})
```

**For each candidate that was filtered:**
```typescript
const project = await payload.create({
  collection: 'content-projects',
  data: {
    title: candidate.title,
    slug: slugify(candidate.title),
    stage: 'filtered',
    contentType: candidate.contentType,
    originPathway: 'itinerary',
    originItinerary: itineraryId,
    targetCollection: 'posts',
    briefSummary: candidate.briefSummary,
    filterReason: candidate.filterReason,
    destinations: candidate.destinations,
    properties: candidate.properties,
    species: candidate.species,
  },
})
```

**Idempotency:** Before creating, check if a ContentProject with the same title AND originItinerary already exists. If so, skip.

Import the `slugify` function from `content-system/cascade/utils.ts`.

### Task 5: Decompose Orchestrator (`content-system/signals/itinerary-decomposer.ts`)

Coordinates the pipeline. Same pattern as cascade-orchestrator.

```typescript
export async function decomposeItinerary(options: DecomposeOptions): Promise<DecompositionResult> {
  const { itineraryId, jobId } = options
  const payload = await getPayload({ config: configPromise })
  
  // Fetch itinerary
  const itinerary = await payload.findByID({ collection: 'itineraries', id: itineraryId, depth: 2 })
  
  // Step 1: Generate candidates
  updateJobProgress(...)
  const rawCandidates = await generateCandidates({ itinerary, payload })
  
  // Step 2: Filter candidates
  updateJobProgress(...)
  const filteredCandidates = await filterCandidates({ candidates: rawCandidates, payload })
  
  // Step 3: Shape briefs
  updateJobProgress(...)
  const { passedIds, filteredIds } = await shapeBriefs({ candidates: filteredCandidates, itineraryId, payload })
  
  return {
    itineraryId,
    totalCandidates: rawCandidates.length,
    passed: passedIds.length,
    filtered: filteredIds.length,
    projectsCreated: passedIds,
    filteredProjectIds: filteredIds,
  }
}
```

Job progress format:
```json
{
  "step_1_complete": true,
  "candidates_generated": 12,
  "step_2_complete": true,
  "candidates_passed": 8,
  "candidates_filtered": 4,
  "step_3_complete": true,
  "projects_created": 8,
  "filtered_projects_created": 4
}
```

### Task 6: API Endpoint (`src/app/(payload)/api/content/decompose/route.ts`)

POST endpoint. Auth: `CONTENT_SYSTEM_SECRET` (same pattern as cascade and embed).

**Request body:**
```json
{
  "itineraryId": 23
}
```

**Logic:**
1. Validate auth
2. Create ContentJob with jobType: 'decompose', status: 'pending', itineraryId
3. Update job to 'running'
4. Call decomposeItinerary({ itineraryId, jobId })
5. On success: update job to 'completed'
6. On failure: update job to 'failed' with error
7. Return DecompositionResult

**Response:**
```json
{
  "success": true,
  "jobId": 11,
  "result": {
    "itineraryId": 23,
    "totalCandidates": 12,
    "passed": 8,
    "filtered": 4,
    "projectsCreated": [27, 28, 29, 30, 31, 32, 33, 34],
    "filteredProjectIds": [35, 36, 37, 38]
  }
}
```

Set `export const maxDuration = 120` and `export const dynamic = 'force-dynamic'`.

### Task 7: Wire Cascade → Decompose

In the cascade orchestrator (`content-system/cascade/cascade-orchestrator.ts`), after Step 5 completes successfully, fire-and-forget a call to the decompose endpoint:

```typescript
// After step 5 completes, trigger decomposition
const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://kiuli.com'
const secret = process.env.CONTENT_SYSTEM_SECRET

if (secret && !options.dryRun) {
  fetch(`${baseUrl}/api/content/decompose`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${secret}`,
    },
    body: JSON.stringify({ itineraryId: options.itineraryId }),
  }).catch(err => {
    console.error('[cascade] Failed to trigger decompose:', err.message)
  })
}
```

This is fire-and-forget. The cascade doesn't wait for decomposition. The decompose endpoint creates its own ContentJob.

## Testing

### Test Sequence

All tests against production after deploy.

**Pre-flight:** Record baselines:
```sql
SELECT COUNT(*) FROM content_projects WHERE content_type IN ('itinerary_cluster', 'authority');
SELECT COUNT(*) FROM content_projects WHERE stage = 'brief';
SELECT COUNT(*) FROM content_projects WHERE stage = 'filtered';
SELECT COUNT(*) FROM content_jobs WHERE job_type = 'decompose';
```

**Test 1: Auth rejection**
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/decompose \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```
Expected: 401

**Test 2: Decompose itinerary 23 (Rwanda)**
```bash
curl -X POST https://kiuli.com/api/content/decompose \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"itineraryId": 23}'
```

Verify:
```sql
-- Article projects created at brief stage
SELECT id, title, content_type, stage, origin_pathway, origin_itinerary_id
FROM content_projects
WHERE origin_itinerary_id = 23 AND content_type IN ('itinerary_cluster', 'authority')
ORDER BY id;

-- Filtered candidates recorded
SELECT id, title, content_type, stage, filter_reason
FROM content_projects
WHERE origin_itinerary_id = 23 AND stage = 'filtered'
ORDER BY id;

-- Job record
SELECT id, job_type, status, progress
FROM content_jobs
WHERE job_type = 'decompose'
ORDER BY id DESC LIMIT 1;
```

Expected:
- 5-15 ContentProjects with contentType 'itinerary_cluster' or 'authority'
- Passed candidates at stage 'brief' with briefSummary and targetAngle populated
- Filtered candidates at stage 'filtered' with filterReason populated
- Job completed with 3 steps

**Test 3: Idempotency**

Run decompose on itinerary 23 again. Verify no duplicate ContentProjects created:
```sql
SELECT title, COUNT(*) FROM content_projects
WHERE origin_itinerary_id = 23 AND content_type IN ('itinerary_cluster', 'authority')
GROUP BY title HAVING COUNT(*) > 1;
-- Should return 0 rows
```

**Test 4: Decompose itinerary 24 (South Africa & Mozambique)**

Run decompose on itinerary 24. Verify different candidates generated (different destinations = different articles). Some overlap in authority topics is acceptable.

**Test 5: Directive filtering**

Create an editorial directive:
```bash
curl -X POST https://kiuli.com/api/editorial-directives \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Do not produce articles about gorilla trekking permit costs",
    "topicTags": ["gorilla", "permit", "cost"],
    "destinationTags": ["Rwanda"],
    "active": true
  }'
```

Then run decompose on a third itinerary (pick one that would generate gorilla content — itinerary 27, Uganda). Check if any gorilla/permit/cost candidates were filtered by the directive.

**Test 6: Jobs API**
```bash
curl "https://kiuli.com/api/content/jobs?type=decompose" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET"
```
All decompose jobs should show completed (or failed with clear error).

## Gate Evidence

Build must pass. All tests must pass.

| Gate | Evidence |
|------|----------|
| OpenRouter called with itinerary data | Job progress shows candidates_generated > 0 |
| Candidates are article types | All have contentType in (itinerary_cluster, authority) |
| Briefs have populated fields | briefSummary, targetAngle, destinations non-empty |
| Filtered candidates recorded | stage = 'filtered', filterReason non-empty |
| Duplicate check works | Re-run produces 0 new projects |
| Directive filtering works | Directive matches filter relevant candidates |
| Job tracking works | ContentJob shows all 3 steps completed |
| Auth rejection | 401 |
| Build passes | npm run build |

## Do NOT

- Do NOT auto-publish any ContentProjects
- Do NOT modify any collection schemas
- Do NOT create destination_page or property_page projects (cascade already does that)
- Do NOT use Perplexity or any external research API (that's Phase 8)
- Do NOT run decomposition synchronously during cascade (fire-and-forget trigger only)
- Do NOT modify the cascade orchestrator's 5-step logic (only add the fire-and-forget trigger after step 5)

## Report

After all tests pass, create `content-engine/reports/phase6-ideation-pipeline.md` with:
1. Files created/modified
2. OpenRouter prompt used (the actual system prompt)
3. Raw candidate output for itinerary 23 (all candidates with titles)
4. Filter results (which passed, which filtered, reasons)
5. DB evidence: ContentProjects created, jobs completed
6. Idempotency verification
7. Directive filtering test results
8. Summary table matching the gate evidence above

Commit and push the report with all code changes.
