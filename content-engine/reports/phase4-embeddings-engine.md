# Phase 4: Embeddings Engine — ContentProject Chunking + Embed Endpoint Report

**Date:** February 13, 2026
**Executor:** Claude CLI (Tactician)
**Prompt:** `content-engine/prompts/phase4-embeddings-engine.md`

---

## 1. chunkContent() Implementation

Implemented in `content-system/embeddings/chunker.ts`. Handles all content types:

| Content Type | Strategy | Chunk Type |
|-------------|----------|------------|
| authority | Split body by H2 headings + FAQ | article_section, faq_answer |
| destination_page | One chunk per section from sections JSON + FAQ | destination_section, faq_answer |
| property_page | One chunk per section from sections JSON + FAQ | property_section, faq_answer |
| itinerary_enhancement | Split body by H2 headings | itinerary_segment |
| page_update | Single body chunk | page_section |
| Other (itinerary_cluster, designer_insight) | Split body by H2 (fallback) | article_section |

H2 splitting: Walks `root.children`, starts new section at each `type: 'heading', tag: 'h2'`. Long sections (>500 words) split at paragraph boundaries.

All chunks carry metadata: destinations, properties, species, contentType, freshnessCategory from the ContentProject.

---

## 2. embedChunks() Implementation

Implemented in `content-system/embeddings/embedder.ts`:
- Batch embeds texts using `embedTextsWithRetry()` (batch size 20)
- Inserts with all metadata columns: `content_project_id`, `content_type`, `destinations`, `properties`, `species`, `freshness_category`
- Returns `EmbeddingRecord[]` with IDs from `RETURNING` clause
- Added `deleteProjectEmbeddings(contentProjectId)` for idempotent re-embedding

---

## 3. Embed Endpoint

Created `src/app/(payload)/api/content/embed/route.ts`:
- POST `/api/content/embed`
- Auth: Bearer `CONTENT_SYSTEM_SECRET`
- Body: `{ contentProjectId: number }`
- Flow: fetch project → set processingStatus='processing' → delete old embeddings → chunkContent → embedChunks → set processingStatus='completed'
- On error: sets processingStatus='failed' with processingError
- `maxDuration: 60`, `dynamic: 'force-dynamic'`

---

## 4. Test Results

### Test ContentProject Created

```json
{
  "id": 2,
  "title": "Phase 4 Test Project",
  "contentType": "authority",
  "body": { "root": { "children": [intro paragraph, H2 "The Great Migration", paragraph, H2 "Luxury Lodges and Camps", paragraph] } },
  "faqSection": [2 items],
  "destinations": ["Kenya", "Tanzania"],
  "properties": ["Singita", "Angama Mara"],
  "species": ["wildebeest", "zebra", "lion"]
}
```

### Embed Endpoint Response

```json
{
  "contentProjectId": 2,
  "chunks": 5,
  "chunkTypes": ["article_section", "article_section", "article_section", "faq_answer", "faq_answer"]
}
```

5 chunks: 3 article_section (intro + 2 H2 sections) + 2 faq_answer.

### Embeddings in DB

```
[article_section] content_project_id=2 content_type=authority
  destinations=["Kenya","Tanzania"] properties=["Singita","Angama Mara"] species=["wildebeest","zebra","lion"]
  preview: This is the introduction to our test article about luxury sa...

[article_section] content_project_id=2 content_type=authority
  preview: The Great Migration — The Great Migration is one of the most...

[article_section] content_project_id=2 content_type=authority
  preview: Luxury Lodges and Camps — East Africa offers some of the fine...

[faq_answer] content_project_id=2 content_type=authority
  preview: Q: When is the best time to see the Great Migration? A: The...

[faq_answer] content_project_id=2 content_type=authority
  preview: Q: What should I pack for a luxury safari? A: Pack neutral-c...
```

### processingStatus

```
processingStatus: completed
processingError: null
```

### Idempotency

| Run | Project embeddings | Bootstrap | Total |
|-----|--------------------|-----------|-------|
| First | 5 | 143 | 148 |
| Second | 5 | 143 | 148 |

PASS — old embeddings deleted before re-inserting.

### Bootstrap Preserved

Bootstrap embeddings (content_project_id IS NULL): **143** — unchanged.

### Auth Rejection

```
curl -s -o /dev/null -w "%{http_code}" -X POST https://kiuli.com/api/content/embed \
  -H "Authorization: Bearer wrong-token" -H "Content-Type: application/json" \
  -d '{"contentProjectId": 2}'
# 401
```

### Cleanup

Test project and its 5 embeddings deleted. Final total: 143.

---

## 5. Build Output

```
npm run build → PASSED
Routes:
  ƒ /api/content/embed (195 B, 102 kB)
  ƒ /api/content/test-connection (195 B, 102 kB)
Sitemap generated: https://kiuli.com/sitemap.xml
```

---

## 6. Files Created/Modified

**New files:**
- `src/app/(payload)/api/content/embed/route.ts` — Embed endpoint

**Modified files:**
- `content-system/embeddings/chunker.ts` — Added chunkContent() with H2 splitting and content type handlers
- `content-system/embeddings/embedder.ts` — Added embedChunks() and deleteProjectEmbeddings()

**Not modified (preserved):**
- `content-system/embeddings/bootstrap.ts` — untouched
- `content-system/embeddings/query.ts` — untouched
- `content-system/embeddings/lexical-text.ts` — untouched
- `content-system/embeddings/types.ts` — untouched

---

## 7. Gate Evidence

| Gate | Result |
|------|--------|
| Build passes | Yes |
| Embed endpoint returns chunks > 0 | 5 chunks |
| Embeddings in DB with content_project_id | 5 rows, content_project_id=2, all metadata set |
| processingStatus = completed | Yes |
| Idempotency: same count after re-embed | 5 = 5 |
| Bootstrap preserved: 143 | Yes |
| Auth rejection: 401 | Yes |
| Test data cleaned up | Yes, final total = 143 |

All gates PASS.
