# Phase 2.5: Bootstrap Embeddings — CLI Prompt

**Date:** 2026-02-11
**Author:** Claude.ai (Strategic)
**Executor:** Claude CLI (Tactical)
**Phase:** 2.5 of 15
**Depends on:** Phase 2 (complete)

---

## Context

The embedding store exists but is empty. This phase seeds it with existing content so consistency checking and research retrieval have useful data from day one. The bootstrap script reads content from the database, extracts plain text from Lexical richtext JSON, calls OpenAI to generate embeddings, and inserts them into the `content_embeddings` table.

Read this prompt completely before writing any code.

---

## Current Content Inventory (Verified via DB Queries)

| Source | Count | Has Content | Notes |
|--------|-------|-------------|-------|
| Itineraries | 6 | All 6 have segments | 1 published, 5 draft — all contain real iTrvl content |
| Stay segments | 30 | 30 have `description_itrvl` | Avg ~1300 chars Lexical JSON (~800 chars text) |
| Activity segments | 38 | 37 have `description_itrvl` | Avg ~700 chars Lexical JSON |
| Transfer segments | 112 | 53 have `description_itrvl` | Avg ~400 chars — logistical, low value |
| FAQ items | 24 | 24 have `question_itrvl` + `answer_itrvl` | Short Q&A pairs |
| Destinations | 10 | 1 (Rwanda) has description | 9 are empty drafts |
| Properties | 0 | — | Collection exists but no records |

**Decision: Embed all 6 itineraries regardless of `_status`.** The V4 plan says "published/live content only" but all 6 contain real iTrvl content that will be published before launch. Embedding only 1 published itinerary (~10 chunks) would be nearly useless. This deviation is justified by the data reality and will be noted in the report.

**Skip transfers.** Logistical text ("Drive from X to Y") has minimal value for consistency checking.

**Expected output: ~92 chunks** (30 stay + 37 activity + 24 FAQ + 1 destination description).

---

## Lexical RichText Extraction

All description and answer fields are stored as Lexical richtext JSON. The structure is:

```json
{
  "root": {
    "type": "root",
    "children": [
      {
        "type": "paragraph",
        "children": [
          { "text": "Actual text content here..." }
        ]
      }
    ]
  }
}
```

The bootstrap script must include a `extractTextFromLexical(json)` function that:
- Recursively walks the tree
- Collects all `text` property values from leaf nodes
- Joins with spaces
- Trims and normalises whitespace
- Returns empty string for null/undefined/invalid input
- Handles nested structures (paragraphs within list items, etc.)

---

## Task 1: Create Bootstrap Script

**File:** `content-system/embeddings/bootstrap.ts`

This is a standalone TypeScript script runnable via `npx tsx content-system/embeddings/bootstrap.ts`.

### Imports and Setup

```typescript
import { getPool, query, end } from '../db'
```

For OpenAI embeddings, use `fetch` directly against the OpenAI API. Do NOT install the `openai` npm package. The API call is simple:

```typescript
const response = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: 'text-embedding-3-large',
    input: texts,  // array of strings, max 20 per batch
    dimensions: 3072,
  }),
})
```

The response shape is:
```json
{
  "data": [
    { "embedding": [0.123, -0.456, ...], "index": 0 },
    { "embedding": [...], "index": 1 }
  ],
  "usage": { "prompt_tokens": 123, "total_tokens": 123 }
}
```

### Functions Required

#### `extractTextFromLexical(richtext: unknown): string`
As described above. Returns plain text. Returns empty string on any error or invalid input.

#### `async fetchChunks(): Promise<ContentChunk[]>`

Query the database directly using the pg Pool (NOT the Payload REST API — we need direct SQL for efficiency):

**Stay segments:**
```sql
SELECT s.id, s.accommodation_name, s.description_itrvl, s._parent_id,
       i.title as itinerary_title, i.slug as itinerary_slug
FROM itineraries_blocks_stay s
JOIN itineraries i ON s._parent_id = i.id
WHERE s.description_itrvl IS NOT NULL
ORDER BY s._parent_id, s._order
```
- chunk_type: `'itinerary_segment'`
- itinerary_id: `s._parent_id`
- Extract text from `description_itrvl`
- Skip chunks with <20 words of extracted text

**Activity segments:**
```sql
SELECT a.id, a.title, a.description_itrvl, a._parent_id,
       i.title as itinerary_title, i.slug as itinerary_slug
FROM itineraries_blocks_activity a
JOIN itineraries i ON a._parent_id = i.id
WHERE a.description_itrvl IS NOT NULL
ORDER BY a._parent_id, a._order
```
- chunk_type: `'itinerary_segment'`
- itinerary_id: `a._parent_id`
- Extract text from `description_itrvl`
- Skip chunks with <20 words

**FAQ items:**
```sql
SELECT f.id, f.question_itrvl, f.answer_itrvl, f._parent_id,
       i.title as itinerary_title, i.slug as itinerary_slug
FROM itineraries_faq_items f
JOIN itineraries i ON f._parent_id = i.id
WHERE f.question_itrvl IS NOT NULL AND f.answer_itrvl IS NOT NULL
ORDER BY f._parent_id, f._order
```
- chunk_type: `'faq_answer'`
- itinerary_id: `f._parent_id`
- chunk_text: `"Q: {question}\nA: {answer}"` — combine question and extracted answer text
- Skip if answer text is <10 words

**Destination descriptions:**
```sql
SELECT d.id, d.name, d.slug, d.description, d.answer_capsule
FROM destinations d
WHERE d.description IS NOT NULL
```
- chunk_type: `'destination_section'`
- destination_id: `d.id`
- Extract text from `description`
- If `answer_capsule` exists and is ≥20 words, create a second chunk with chunk_type `'destination_section'` and chunk_text being the answer capsule text
- Skip chunks with <20 words

#### `async checkExisting(itineraryIds: number[], destinationIds: number[]): Promise<Set<string>>`

Query content_embeddings to find which source records already have embeddings:

```sql
SELECT DISTINCT
  CASE
    WHEN itinerary_id IS NOT NULL THEN 'itinerary_' || itinerary_id
    WHEN destination_id IS NOT NULL THEN 'destination_' || destination_id
  END as source_key
FROM content_embeddings
WHERE itinerary_id = ANY($1) OR destination_id = ANY($2)
```

Return a Set of source keys. In the main loop, skip any chunk whose source key is already in the set. This provides idempotency — re-running the bootstrap won't create duplicates.

**Important:** Idempotency is at the source record level (per itinerary, per destination), not per individual chunk. If an itinerary has any existing embeddings, skip ALL chunks for that itinerary. This ensures complete re-processing if needed (delete old + re-embed) rather than partial states.

#### `async embedBatch(texts: string[]): Promise<number[][]>`

Call OpenAI embeddings API. Batch size: max 20 texts per API call. Includes:
- Retry once on 429 (rate limit) or 5xx errors, with 5-second backoff
- Throw on persistent failure with human-readable message
- Log token usage from response

#### `async insertEmbeddings(chunks: ChunkWithEmbedding[]): Promise<void>`

Insert into content_embeddings using parameterised query:

```sql
INSERT INTO content_embeddings (
  chunk_type, chunk_text, embedding,
  itinerary_id, destination_id, property_id,
  content_type, destinations, properties
) VALUES ($1, $2, $3::vector(3072), $4, $5, $6, $7, $8, $9)
```

**Note:** Insert the embedding as `$3::vector(3072)` — the full precision vector. The HNSW index automatically casts to halfvec for indexing. Store full precision, index at half precision.

Batch inserts in groups of 10 (10 INSERT statements per transaction) for efficiency without risking huge transactions.

#### `async bootstrapEmbeddings(): Promise<BootstrapResult>`

Main orchestrator:

1. Fetch all chunks
2. Check existing embeddings (idempotency)
3. Filter out already-embedded sources
4. Log: `"Found {total} chunks, {skipped} already embedded, {toProcess} to process"`
5. If nothing to process, log and return early
6. Batch embed (20 per API call)
7. Insert embeddings (10 per transaction)
8. Log progress every 20 chunks: `"Embedded {done}/{total} chunks"`
9. Return summary: total, embedded, skipped, errors, token usage

### Script Entry Point

When run directly (`npx tsx content-system/embeddings/bootstrap.ts`):

1. Check `OPENAI_API_KEY` and `DATABASE_URL_UNPOOLED` are set — exit with clear error if not
2. Run `bootstrapEmbeddings()`
3. Print summary
4. Call `end()` to close the pool
5. Exit with code 0 on success, 1 on failure

---

## Task 2: Update Lambda Handler

**File:** `lambda/content-batch-embed/handler.js`

Update the existing stub to be a real (but simple) handler that could invoke the bootstrap. Since Lambda env isn't configured yet (deferred from Phase 0), this handler should be structurally complete but won't run on AWS until Phase 5.

The handler should:
- Log invocation with requestId
- Return `{ statusCode: 200, body: { status: 'bootstrap_ready', message: 'Lambda env not yet configured. Run bootstrap locally via npx tsx content-system/embeddings/bootstrap.ts' } }`

Keep it simple. The real Lambda implementation comes in Phase 4-5 when the full embeddings engine is built.

---

## Task 3: Run the Bootstrap

Execute:

```bash
npx tsx content-system/embeddings/bootstrap.ts
```

Capture the full output. If it fails, debug and fix before proceeding. Do not move on until the bootstrap completes with zero errors.

---

## Task 4: Verify Embeddings

After bootstrap completes, run these verification queries:

```bash
# 1. Total embedding count
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) as total FROM content_embeddings;"

# 2. Breakdown by chunk type
psql "$DATABASE_URL_UNPOOLED" -c "
SELECT chunk_type, COUNT(*) as count
FROM content_embeddings
GROUP BY chunk_type
ORDER BY count DESC;
"

# 3. Breakdown by itinerary
psql "$DATABASE_URL_UNPOOLED" -c "
SELECT i.title, COUNT(*) as chunks
FROM content_embeddings ce
JOIN itineraries i ON ce.itinerary_id = i.id
WHERE ce.itinerary_id IS NOT NULL
GROUP BY i.title
ORDER BY chunks DESC;
"

# 4. Destination embeddings
psql "$DATABASE_URL_UNPOOLED" -c "
SELECT d.name, COUNT(*) as chunks
FROM content_embeddings ce
JOIN destinations d ON ce.destination_id = d.id
WHERE ce.destination_id IS NOT NULL
GROUP BY d.name;
"

# 5. Similarity search — find content similar to "gorilla trekking"
psql "$DATABASE_URL_UNPOOLED" -c "
SELECT LEFT(chunk_text, 120) as text_preview, chunk_type,
  1 - (embedding::halfvec(3072) <=> (
    SELECT embedding::halfvec(3072) FROM content_embeddings
    WHERE chunk_text ILIKE '%gorilla%' LIMIT 1
  )) as similarity
FROM content_embeddings
ORDER BY embedding::halfvec(3072) <=> (
  SELECT embedding::halfvec(3072) FROM content_embeddings
  WHERE chunk_text ILIKE '%gorilla%' LIMIT 1
)
LIMIT 5;
"

# 6. Verify idempotency — run bootstrap again
npx tsx content-system/embeddings/bootstrap.ts
# Should report "0 to process" and exit cleanly

# 7. Verify Payload still works
curl -s -o /dev/null -w "%{http_code}" https://admin.kiuli.com/admin
```

---

## Task 5: Build Verification

```bash
npm run build
```

Must pass.

---

## DO NOT

- Do not install the `openai` npm package — use fetch directly
- Do not use the Payload REST API for reading content — use direct SQL via db.ts Pool
- Do not embed transfer segments (logistical, low value)
- Do not embed chunks with <20 words of extracted text (noise)
- Do not create API routes (deferred to Phase 4)
- Do not modify any Payload collections, globals, or migrations
- Do not modify the content_embeddings table schema
- Do not use pooled connection (POSTGRES_URL) for any vector operations

---

## Verification & Report

Write results to `content-engine/reports/phase2.5-bootstrap-embeddings.md`:

### 1. Bootstrap Output
Full console output from running the bootstrap script.

### 2. Verification Query Results
Output of all 7 verification queries.

### 3. Embedding Statistics
Total chunks, breakdown by type, breakdown by source, token usage, API cost estimate.

### 4. Idempotency Proof
Output of second bootstrap run showing 0 chunks to process.

### 5. Similarity Search Results
The top 5 results from the "gorilla trekking" similarity search, demonstrating the embeddings are semantically meaningful.

### 6. Build Output
Last 20 lines of `npm run build`.

### 7. Deviation Note
Document that all 6 itineraries were embedded regardless of `_status`, with justification.

### 8. Git Commit

```bash
git add -A
git commit -m "feat(content-engine): Phase 2.5 — bootstrap embeddings

Seeded content_embeddings with existing site content:
- Itinerary stay/activity segments, FAQ Q&A pairs
- Destination descriptions
- OpenAI text-embedding-3-large (3072 dimensions)
- Idempotent: skips already-embedded source records
All 6 itineraries embedded (including drafts — real iTrvl content)."
git push
```

### 9. Status Update

Update `content-engine/status.md`:
- Mark Phase 2.5 as COMPLETED with date
- Record total embedding count and breakdown
- Note the draft content deviation with justification

---

## Success Criteria

Phase 2.5 is complete when ALL of the following are true:

1. `content_embeddings` table contains embeddings for all 6 itineraries (stays, activities, FAQs) and Rwanda destination
2. Total chunk count is ~80-100 (exact number depends on content filtering)
3. Embeddings are 3072 dimensions (text-embedding-3-large)
4. Similarity search returns semantically relevant results
5. Re-running bootstrap produces 0 new embeddings (idempotent)
6. `npm run build` passes
7. Payload admin unaffected
8. Git clean, committed, pushed
