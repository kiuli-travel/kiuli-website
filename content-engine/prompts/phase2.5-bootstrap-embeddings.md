# Phase 2.5: Bootstrap Embeddings

**Date:** February 13, 2026  
**Author:** Claude (Strategist)  
**Executor:** Claude CLI (Tactician)  
**Depends on:** Phase 1 (complete), Phase 2 (complete)  
**Specification:** KIULI_CONTENT_SYSTEM_DEVELOPMENT_PLAN_V4.md Phase 2.5

---

## Problem

The content_embeddings table exists and is correct (17 columns, HNSW index, all scalar/GIN indexes). But it has 0 rows. The content-system/embeddings/ directory has type definitions but every module is a stub. We need real implementations and we need to seed the store with existing content.

---

## Outcomes

1. `content-system/embeddings/chunker.ts` is a real implementation that chunks itinerary segments, FAQ answers, destination sections, and property sections
2. `content-system/embeddings/embedder.ts` is a real implementation that calls OpenAI text-embedding-3-large and inserts into content_embeddings
3. `content-system/embeddings/query.ts` is a real implementation that does cosine similarity search with metadata filtering
4. `content-system/embeddings/bootstrap.ts` orchestrates: reads all content from DB, chunks, embeds, stores
5. A utility function `extractTextFromLexical(lexicalJson)` exists and correctly extracts plain text from Payload's Lexical JSON rich text format
6. The bootstrap has been run and content_embeddings contains rows
7. Similarity search returns relevant results
8. The bootstrap is idempotent — running it again does not create duplicates

---

## Data to Embed

All content regardless of draft/published status. This is test data that will be wiped before launch.

### Source tables and fields:

**Itinerary stays** (34 rows with content):
```sql
SELECT s.id, s._parent_id as itinerary_id, s.accommodation_name, s.description_itrvl, 
       s.location, s.country, s.property_id
FROM itineraries_blocks_stay s 
WHERE s.description_itrvl IS NOT NULL
```
- chunk_type: `itinerary_segment`
- itinerary_id: `s._parent_id`
- property_id: `s.property_id` (may be null)
- destinations: `[s.country]` if not null
- properties: `[s.accommodation_name]` if not null

**Itinerary activities** (41 rows with content):
```sql
SELECT a.id, a._parent_id as itinerary_id, a.title, a.description_itrvl
FROM itineraries_blocks_activity a 
WHERE a.description_itrvl IS NOT NULL
```
- chunk_type: `itinerary_segment`
- itinerary_id: `a._parent_id`

**Itinerary FAQ items** (49 rows):
```sql
SELECT f.id, f._parent_id as itinerary_id, f.question, f.answer_itrvl
FROM itineraries_faq_items f 
WHERE f.answer_itrvl IS NOT NULL
```
- chunk_type: `faq_answer`
- itinerary_id: `f._parent_id`
- chunk_text: combine question and answer text: `Q: {question}\nA: {answer_text}`

**Properties** (33 rows with content):
```sql
SELECT p.id, p.name, p.slug, p.description_itrvl, p.destination_id
FROM properties p 
WHERE p.description_itrvl IS NOT NULL
```
- chunk_type: `property_section`
- property_id: `p.id`
- destination_id: `p.destination_id` (may be null)
- properties: `[p.name]`

**Destinations** (only Rwanda has content):
```sql
SELECT d.id, d.name, d.slug, d.description, d.answer_capsule, d.best_time_to_visit
FROM destinations d 
WHERE d.description IS NOT NULL
```
- chunk_type: `destination_section`
- destination_id: `d.id`
- destinations: `[d.name]`

---

## Implementation Details

### Lexical Text Extraction

Create a utility at `content-system/embeddings/lexical-text.ts`.

Payload stores rich text as Lexical JSON. The structure is:
```json
{
  "root": {
    "type": "root",
    "children": [
      {
        "type": "paragraph",
        "children": [
          { "text": "The actual text content..." }
        ]
      }
    ]
  }
}
```

The extractor must:
- Recursively walk all `children` arrays
- Collect all leaf nodes with a `text` property
- Join paragraphs with `\n`
- Handle null/undefined/empty input (return empty string)
- Handle malformed JSON (return empty string, don't throw)

Test it against real data from the database before proceeding. If any description_itrvl value fails to extract text, stop and report the structure.

### Chunker (`content-system/embeddings/chunker.ts`)

Replace the stub with a real implementation. Keep the existing types from `types.ts`.

For bootstrap, we need four chunk strategies:

1. **itinerary_segment** — One chunk per stay or activity. Text is the extracted description. Skip chunks with fewer than 20 words.

2. **faq_answer** — One chunk per FAQ item. Text is `Q: {question}\nA: {extracted_answer}`. Skip if answer text is fewer than 10 words.

3. **property_section** — One chunk per property. Text is the extracted description. Skip chunks with fewer than 20 words.

4. **destination_section** — One chunk per destination. Text is the extracted description. If answer_capsule exists, prepend it. Skip chunks with fewer than 20 words.

Each chunk must carry metadata:
- `itinerary_id` (for itinerary segments and FAQs)
- `destination_id` (for destination sections, and properties that have one)
- `property_id` (for property sections, and stays that have one)
- `destinations` array (country/destination names)
- `properties` array (property/accommodation names)

### Embedder (`content-system/embeddings/embedder.ts`)

Replace the stub with a real implementation.

- Call OpenAI API directly via fetch (no npm package needed)
- Endpoint: `https://api.openai.com/v1/embeddings`
- Model: `text-embedding-3-large`
- Dimensions: 3072
- API key: `process.env.OPENAI_API_KEY`
- Batch size: 20 texts per API call (OpenAI supports up to 2048, but 20 keeps requests manageable)
- On API failure: retry once after 2 seconds. If second attempt fails, throw with the error details.

Insert into content_embeddings using the pg Pool from `content-system/db.ts`:

```sql
INSERT INTO content_embeddings (
  chunk_type, chunk_text, embedding,
  itinerary_id, destination_id, property_id,
  destinations, properties, created_at, updated_at
) VALUES (
  $1, $2, $3::vector(3072),
  $4, $5, $6,
  $7, $8, NOW(), NOW()
)
```

Note: `content_project_id` is null for bootstrap embeddings (no ContentProject exists yet). `species`, `freshness_category`, `audience_relevance`, `content_type`, `published_at` are also null for bootstrap data.

### Query (`content-system/embeddings/query.ts`)

Replace the stub with a real implementation.

```typescript
async function semanticSearch(
  queryText: string, 
  options?: {
    topK?: number,           // default 10
    minScore?: number,       // default 0.0
    chunkTypes?: string[],
    destinationId?: number,
    propertyId?: number,
    itineraryId?: number,
    excludeProjectId?: number,
  }
): Promise<SimilarityResult[]>
```

Implementation:
1. Embed the query text using the same OpenAI model
2. Query content_embeddings with cosine distance using halfvec cast:

```sql
SELECT id, chunk_type, chunk_text,
       1 - (embedding::halfvec(3072) <=> $1::halfvec(3072)) as similarity,
       itinerary_id, destination_id, property_id,
       destinations, properties
FROM content_embeddings
WHERE 1=1
  [AND chunk_type = ANY($N) -- if chunkTypes filter provided]
  [AND destination_id = $N  -- if destinationId filter provided]
  [AND property_id = $N     -- if propertyId filter provided]
  [AND itinerary_id = $N    -- if itineraryId filter provided]
  [AND content_project_id != $N -- if excludeProjectId provided]
ORDER BY embedding::halfvec(3072) <=> $1::halfvec(3072)
LIMIT $N
```

3. Filter results below minScore after the query
4. Return as `SimilarityResult[]` matching the type in types.ts

### Bootstrap (`content-system/embeddings/bootstrap.ts`)

New file. Orchestrates the full bootstrap:

1. Query all source data (stays, activities, FAQs, properties, destinations) using the SQL from the "Data to Embed" section above
2. Extract text from Lexical JSON for each record
3. Create chunks using the chunker
4. Skip empty/too-short chunks (log count of skipped)
5. Embed all chunks using the embedder (in batches of 20)
6. Log progress: "Embedding batch N/M (X chunks)"
7. Return summary: total chunks, by type, skipped count

**Idempotency:** Before inserting, check if embeddings already exist for the source:

```sql
-- For itinerary segments:
DELETE FROM content_embeddings 
WHERE chunk_type = 'itinerary_segment' AND itinerary_id = $1;

-- For FAQ answers:
DELETE FROM content_embeddings 
WHERE chunk_type = 'faq_answer' AND itinerary_id = $1;

-- For property sections:
DELETE FROM content_embeddings 
WHERE chunk_type = 'property_section' AND property_id = $1;

-- For destination sections:
DELETE FROM content_embeddings 
WHERE chunk_type = 'destination_section' AND destination_id = $1;
```

Delete-then-insert per source record. This means re-running bootstrap replaces old embeddings cleanly.

### Runner Script

Create `scripts/bootstrap-embeddings.ts`:

```typescript
import { bootstrap } from '../content-system/embeddings/bootstrap'
import { end } from '../content-system/db'

async function main() {
  console.log('Starting embedding bootstrap...')
  const result = await bootstrap()
  console.log('Bootstrap complete:', JSON.stringify(result, null, 2))
  await end()
  process.exit(0)
}

main().catch(e => {
  console.error('Bootstrap failed:', e)
  process.exit(1)
})
```

Run with: `npx tsx scripts/bootstrap-embeddings.ts`

This requires OPENAI_API_KEY and DATABASE_URL_UNPOOLED in the environment.

---

## Environment Variables Required

- `OPENAI_API_KEY` — for text-embedding-3-large calls
- `DATABASE_URL_UNPOOLED` — direct Neon connection (not pooled)

Both are already set on Vercel. For local execution, source from `.env.local` or `.env.vercel-prod` or pass directly.

---

## Step-by-Step Execution

### Step 1: Implement lexical-text.ts

Create `content-system/embeddings/lexical-text.ts`. Test it against real data:

```bash
npx tsx -e "
const { query } = require('./content-system/db');
const { extractTextFromLexical } = require('./content-system/embeddings/lexical-text');
async function test() {
  const res = await query('SELECT description_itrvl FROM itineraries_blocks_stay WHERE description_itrvl IS NOT NULL LIMIT 3');
  for (const row of res.rows) {
    const text = extractTextFromLexical(row.description_itrvl);
    console.log('---');
    console.log('Words:', text.split(/\s+/).length);
    console.log('Preview:', text.substring(0, 200));
  }
  process.exit(0);
}
test();
"
```

Must extract readable text. If it returns empty strings, the Lexical structure is different from expected — inspect the raw JSON and fix the extractor.

### Step 2: Implement chunker.ts

Replace the stub. Test:

```bash
# Verify it creates chunks from real data
npx tsx -e "
// Quick test: manually chunk one stay
"
```

### Step 3: Implement embedder.ts

Replace the stub. Test with a single text to verify OpenAI API works:

```bash
npx tsx -e "
const { embedTexts } = require('./content-system/embeddings/embedder');
async function test() {
  const result = await embedTexts(['This is a test of the embedding API.']);
  console.log('Dimensions:', result[0].length);
  console.log('First 5 values:', result[0].slice(0, 5));
  process.exit(0);
}
test();
"
```

Must return an array of 3072 floats.

### Step 4: Implement query.ts

Replace the stub. Will be tested after bootstrap populates data.

### Step 5: Implement bootstrap.ts and runner script

### Step 6: Run the bootstrap

```bash
npx tsx scripts/bootstrap-embeddings.ts
```

Watch the output. Every batch must succeed. If any API call fails after retry, stop and report.

### Step 7: Verify

```bash
# Total embeddings
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM content_embeddings;"

# Breakdown by type
psql "$DATABASE_URL_UNPOOLED" -c "SELECT chunk_type, COUNT(*) FROM content_embeddings GROUP BY chunk_type ORDER BY chunk_type;"

# Verify no empty chunk_text
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM content_embeddings WHERE chunk_text = '' OR chunk_text IS NULL;"
# Must be 0

# Verify all embeddings have 3072 dimensions
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM content_embeddings WHERE array_length(embedding::real[], 1) != 3072;"
# Must be 0 (note: this may need vector_dims() depending on pgvector version)

# Verify itinerary_id is populated for itinerary segments and FAQs
psql "$DATABASE_URL_UNPOOLED" -c "
SELECT chunk_type, COUNT(*), 
       SUM(CASE WHEN itinerary_id IS NOT NULL THEN 1 ELSE 0 END) as has_itinerary_id
FROM content_embeddings 
WHERE chunk_type IN ('itinerary_segment', 'faq_answer')
GROUP BY chunk_type;
"
# has_itinerary_id should equal count for both types

# Verify property_id is populated for property sections
psql "$DATABASE_URL_UNPOOLED" -c "
SELECT COUNT(*), SUM(CASE WHEN property_id IS NOT NULL THEN 1 ELSE 0 END) as has_property_id
FROM content_embeddings WHERE chunk_type = 'property_section';
"

# Test similarity search
psql "$DATABASE_URL_UNPOOLED" -c "
SELECT chunk_type, LEFT(chunk_text, 80) as preview,
       1 - (embedding::halfvec(3072) <=> (SELECT embedding::halfvec(3072) FROM content_embeddings WHERE chunk_type = 'itinerary_segment' LIMIT 1)) as similarity
FROM content_embeddings
ORDER BY embedding::halfvec(3072) <=> (SELECT embedding::halfvec(3072) FROM content_embeddings WHERE chunk_type = 'itinerary_segment' LIMIT 1)
LIMIT 5;
"
# Must return 5 rows with decreasing similarity scores. Top result should be itself (similarity ≈ 1.0)
```

### Step 8: Test the query module

```bash
npx tsx -e "
const { semanticSearch } = require('./content-system/embeddings/query');
const { end } = require('./content-system/db');
async function test() {
  // Search for gorilla-related content
  const results = await semanticSearch('gorilla trekking Rwanda');
  console.log('Results:', results.length);
  for (const r of results.slice(0, 5)) {
    console.log(\`[\${r.chunkType}] score=\${r.similarity.toFixed(3)} \${r.chunkText.substring(0, 100)}\`);
  }
  await end();
  process.exit(0);
}
test();
"
```

Must return results. The top results should be related to gorillas or Rwanda.

### Step 9: Test idempotency

Run the bootstrap again:

```bash
npx tsx scripts/bootstrap-embeddings.ts
```

Then verify the total count hasn't doubled:

```bash
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM content_embeddings;"
```

Must be the same count as Step 7 (not 2x).

### Step 10: Commit

```bash
git add -A
git commit -m "feat(content-engine): Phase 2.5 — bootstrap embeddings

Implemented real chunker, embedder, query, and bootstrap modules.
Seeded content_embeddings with itinerary segments, FAQ answers,
property descriptions, and destination content.
Replaced all stubs in content-system/embeddings/ with working code."
git push
```

---

## Do Not

- Do NOT install the `openai` npm package — use fetch directly
- Do NOT modify the content_embeddings table schema
- Do NOT modify any existing collection definitions
- Do NOT create Lambda functions (not needed for ~160 chunks)
- Do NOT create API endpoints yet (bootstrap is a one-time script)
- Do NOT modify db.ts except to add real implementations for the declare stubs IF needed by bootstrap
- Do NOT modify types.ts unless the existing types are genuinely incompatible with the implementation
- Do NOT skip the Lexical text extraction test (Step 1) — if it doesn't work, nothing else will

---

## Gate Evidence

Every one of these must pass:

```bash
# 1. Embedding count > 0
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM content_embeddings;"

# 2. Breakdown by type (expect ~4 types with counts)
psql "$DATABASE_URL_UNPOOLED" -c "SELECT chunk_type, COUNT(*) FROM content_embeddings GROUP BY chunk_type ORDER BY count DESC;"

# 3. No empty chunks
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM content_embeddings WHERE chunk_text = '' OR chunk_text IS NULL;"
# Must be 0

# 4. Semantic search returns relevant results for 'gorilla trekking Rwanda'
# (paste the test output from Step 8)

# 5. Idempotency: count after second run equals count after first run
# (paste both counts)

# 6. Build passes
npm run build 2>&1 | tail -5
```

---

## Report

Write report to `content-engine/reports/phase2.5-bootstrap-embeddings.md` with:

1. Lexical text extraction test results (sample outputs)
2. OpenAI embedding API test result (dimensions confirmed)
3. Bootstrap run output (batch progress, totals)
4. Verification query results (counts by type, nulls check, similarity search)
5. Semantic search test results
6. Idempotency test results
7. Any chunks that were skipped and why
8. Build output
9. Git commit hash

Then update `content-engine/status.md` — mark Phase 2.5 as COMPLETED only if every gate passes.
