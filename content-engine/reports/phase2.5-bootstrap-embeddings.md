# Phase 2.5: Bootstrap Embeddings Report

**Date:** February 13, 2026
**Executor:** Claude CLI (Tactician)
**Prompt:** `content-engine/prompts/phase2.5-bootstrap-embeddings.md`

---

## 1. Lexical Text Extraction

Created `content-system/embeddings/lexical-text.ts`. Tested against real data:

| Source | Sample | Words | Status |
|--------|--------|-------|--------|
| Stay (The Silo) | "The Silo is a magical space towering above the V&A Waterfront..." | 146 | PASS |
| Stay (La Residence) | "Located in the beautiful Franschhoek valley..." | 132 | PASS |
| Stay (Tswalu Loapi) | "Inspired by the spirit of unfiltered adventure..." | 181 | PASS |
| FAQ answer | "Garden Cottage: 2025: Includes: Breakfast and dinner..." | 66 | PASS |
| Destination (Rwanda) | "Rwanda is home to the great apes" | 7 | PASS (short) |

**Discovery:** Property `description_itrvl` is a `textarea` field (plain text string), not Lexical JSON. The chunker was updated to handle plain text for properties.

---

## 2. OpenAI Embedding API Test

```
Model: text-embedding-3-large
Dimensions: 3072 (confirmed)
First 5 values: [-0.0051805195, 0.0017826584, -0.014829343, 0.0075460924, 0.0052780253]
```

---

## 3. Bootstrap Run Output

```
Stays: 34 chunks (0 skipped)
Activities: 31 chunks (10 skipped — fewer than 20 words)
FAQs: 44 chunks (5 skipped — fewer than 10 words)
Properties: 33 chunks (0 skipped)
Destinations: 1 chunk (0 skipped)

Total chunks: 143
Batches: 8 (20 chunks per batch)
All batches succeeded — no retries needed.
```

---

## 4. Verification Query Results

### Counts by type
| chunk_type | count |
|-----------|-------|
| itinerary_segment | 65 |
| faq_answer | 44 |
| property_section | 33 |
| destination_section | 1 |
| **Total** | **143** |

### Null checks
- Empty chunk_text: **0** (PASS)
- Embedding dimensions: **3072** for all rows (PASS)
- itinerary_id populated for segments: **65/65** (PASS)
- itinerary_id populated for FAQs: **44/44** (PASS)
- property_id populated for properties: **33/33** (PASS)

### Similarity search (raw SQL)
```
[itinerary_segment] sim=1.0000 The Silo is a magical space...
[itinerary_segment] sim=1.0000 The Silo is a magical space... (duplicate from different itinerary)
[property_section]  sim=1.0000 The Silo is a magical space... (same content as property)
[itinerary_segment] sim=0.4772 The Saxon Boutique Hotel, Villas and Spa...
[property_section]  sim=0.4770 The Saxon Boutique Hotel, Villas and Spa...
```
Top result is itself (sim=1.0), scores decrease for different content. PASS.

---

## 5. Semantic Search Test

Query: "gorilla trekking Rwanda"

```
[itinerary_segment] score=0.637 Head out on an unforgettable journey through East Africa's stunning landscapes...
[itinerary_segment] score=0.627 Embark on a once in a lifetime gorilla trekking adventure in Bwindi...
[itinerary_segment] score=0.590 Wander through the enchanting Nyungwe Forest, one of Africa's oldest...
[itinerary_segment] score=0.588 Set out on a once-in-a-lifetime adventure into the highland bamboo forest to track...
[destination_section] score=0.560 Rwanda...
```

Top results are gorilla/Rwanda content. Semantic search is working correctly.

---

## 6. Idempotency Test

| Run | Total embeddings |
|-----|-----------------|
| First run | 143 |
| Second run | 143 |

Count is identical — idempotency PASS.

---

## 7. Skipped Chunks

| Source | Skipped | Reason |
|--------|---------|--------|
| Activities | 10 | Description fewer than 20 words |
| FAQs | 5 | Answer text fewer than 10 words |

---

## 8. Build Output

```
npm run build → PASSED
Sitemap generated: https://kiuli.com/sitemap.xml
```

---

## 9. Files Created/Modified

**New files:**
- `content-system/embeddings/lexical-text.ts` — Lexical JSON text extractor
- `content-system/embeddings/bootstrap.ts` — Bootstrap orchestrator
- `scripts/bootstrap-embeddings.ts` — Runner script

**Modified files:**
- `content-system/embeddings/chunker.ts` — Real implementation replacing stub
- `content-system/embeddings/embedder.ts` — Real implementation replacing stub
- `content-system/embeddings/query.ts` — Real implementation replacing stub

---

## 10. Gate Evidence

| Gate | Result |
|------|--------|
| Embedding count > 0 | 143 |
| 4 chunk types with counts | itinerary_segment=65, faq_answer=44, property_section=33, destination_section=1 |
| No empty chunks | 0 |
| Semantic search returns relevant results | Top results for "gorilla trekking Rwanda" are gorilla/Rwanda content |
| Idempotency: second run = first run | 143 = 143 |
| Build passes | Yes |

All gates PASS.
