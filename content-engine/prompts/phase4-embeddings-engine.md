# Phase 4: Embeddings Engine — ContentProject Chunking + Embed Endpoint

**Date:** February 13, 2026
**Author:** Claude (Strategist)
**Executor:** Claude CLI (Tactician)
**Depends on:** Phase 3 (complete), Phase 2.5 (complete)

---

## Problem

The embeddings modules work for bootstrap data but not ContentProject content. `chunkContent()` returns empty array. `embedChunks()` returns empty array. No embed endpoint exists. Phase 5 (cascade) creates ContentProjects that need embedding.

---

## Outcomes

1. `chunkContent()` handles all ContentProject content types
2. `embedChunks()` embeds ContentProject chunks with content_project_id set
3. Embed endpoint at `/api/content/embed/route.ts` works
4. Idempotent: re-embedding deletes old embeddings for that project
5. ProcessingStatus lifecycle managed (idle -> processing -> completed/failed)
6. All 143 bootstrap embeddings untouched
7. Build passes

---

## What exists (do NOT break)

- `chunker.ts`: Bootstrap functions (chunkItineraryStays, etc.) — keep
- `embedder.ts`: embedTexts, embedTextsWithRetry, insertEmbeddings, embedAndInsertBatches — keep
- `query.ts`: semanticSearch, querySimilar — keep, fully working
- `bootstrap.ts`, `lexical-text.ts`, `types.ts` — keep as-is
- 143 embeddings in content_embeddings where content_project_id IS NULL

## What needs implementing

- `chunkContent()` in chunker.ts (currently returns [])
- `embedChunks()` in embedder.ts (currently returns [])
- `/api/content/embed/route.ts` (doesn't exist)

---

## chunkContent() implementation

Takes a ContentProject record and returns ContentChunk[]. Strategy by content type:

**authority (articles):**
- Source: `body` field (Lexical richText)
- Split by H2 headings. Lexical heading nodes have `type: 'heading'` and `tag: 'h2'`. Walk root.children, start new section at each H2.
- chunk_type: `article_section`
- Target: 200-500 words. If section > 500 words, split at paragraph boundaries.
- Also chunk `faqSection` array items as `faq_answer` type
- Skip chunks < 20 words

**destination_page:**
- Source: `sections` field (JSON object keyed by section name)
- One chunk per section. Extract text: if Lexical JSON use extractTextFromLexical, if string use directly.
- chunk_type: `destination_section`
- Also chunk faqSection if present
- Skip sections < 20 words

**property_page:**
- Same as destination_page but chunk_type: `property_section`

**itinerary_enhancement:**
- Source: `body` field. Same splitting as authority but chunk_type: `itinerary_segment`

**page_update:**
- Source: `body` field. Single chunk, chunk_type: `page_section`

All chunks carry metadata from ContentProject: destinations (JSON array field), properties, species, contentType, freshnessCategory. sourceCollection is `content-projects`, sourceId is project id.

---

## embedChunks() implementation

Replace the empty stub:
1. Delete existing embeddings: `DELETE FROM content_embeddings WHERE content_project_id = $1`
2. Batch embed texts (reuse embedTextsWithRetry, batch size 20)
3. Insert with ALL metadata columns including content_project_id, content_type, destinations, properties, species, freshness_category
4. Return EmbeddingRecord[] with ids from RETURNING clause

---

## Embed endpoint

Create `src/app/(payload)/api/content/embed/route.ts`:

- POST, auth: Bearer CONTENT_SYSTEM_SECRET
- Body: `{ contentProjectId: number }`
- Fetch ContentProject via Payload Local API (depth: 0)
- Update processingStatus to 'processing'
- Delete existing embeddings for this content_project_id
- chunkContent() -> embedChunks()
- Update processingStatus to 'completed' (or 'failed' with processingError on error)
- Return `{ chunks: N, contentProjectId }`
- maxDuration: 60, dynamic: 'force-dynamic'

Auth pattern:
```typescript
const authHeader = request.headers.get('Authorization')
if (!authHeader?.startsWith('Bearer ') || authHeader.slice(7) !== process.env.CONTENT_SYSTEM_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

---

## H2 Splitting for Lexical RichText

Lexical stores headings as nodes with `type: 'heading'` and `tag: 'h2'`. Walk root.children:

```
for each child in root.children:
  if child.type === 'heading' and child.tag === 'h2':
    finalize current section, start new one with heading text as title
  else:
    add child to current section
```

Extract text from each section's nodes using extractTextFromLexical (which handles recursive children). If no H2s exist, treat entire body as one chunk.

---

## Step-by-step

### Step 1: Implement chunkContent()

Add H2 splitting and content type handlers. Keep all bootstrap functions.

Test by creating a test ContentProject with body containing 2 H2 sections + 1 FAQ, calling chunkContent(), verifying 3 chunks (2 article_section + 1 faq_answer).

### Step 2: Implement embedChunks()

Keep all existing functions.

### Step 3: Create embed endpoint

### Step 4: Build

```bash
npm run build
```

### Step 5: Deploy and test end-to-end

Create test ContentProject via API, embed via endpoint, verify:
- Chunks returned > 0
- Embeddings in DB with content_project_id set
- processingStatus = 'completed'
- Idempotency: embed again, count unchanged
- Bootstrap preserved (143 where content_project_id IS NULL)
- Auth rejection (wrong token -> 401)
- Clean up test project and its embeddings after

### Step 6: Commit

```bash
git add -A
git commit -m "feat(content-engine): Phase 4 — embeddings engine for ContentProjects

Implemented chunkContent() for all content types (authority with H2
splitting, destination/property pages from sections JSON, enhancements,
page updates). embedChunks() with content_project_id tracking.
/api/content/embed endpoint with auth and processingStatus lifecycle."
git push
```

---

## Do Not

- Do NOT modify or remove bootstrap functions
- Do NOT modify bootstrap.ts, query.ts, lexical-text.ts
- Do NOT modify content_embeddings table schema
- Do NOT modify ContentProjects collection definition
- Do NOT delete existing 143 bootstrap embeddings
- Do NOT install npm packages

---

## Gate Evidence

```bash
# 1. Build passes
npm run build 2>&1 | tail -5

# 2. Embed endpoint returns chunks > 0
# (paste curl output)

# 3. Embeddings in DB with content_project_id
# (paste query)

# 4. processingStatus = completed
# (paste output)

# 5. Idempotency: same count after re-embed
# (paste counts)

# 6. Bootstrap preserved: 143
# (paste count)

# 7. Auth rejection: 401
# (paste status)
```

---

## Report

Write to `content-engine/reports/phase4-embeddings-engine.md` with all test outputs. Update `content-engine/status.md`.
