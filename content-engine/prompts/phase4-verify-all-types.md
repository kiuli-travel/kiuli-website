# Phase 4 Verification: Test All Content Types

**Date:** February 13, 2026
**Author:** Claude (Strategist)
**Executor:** Claude CLI (Tactician)

---

## Problem

Phase 4 only tested the `authority` content type. Four other content types were implemented but never tested: `destination_page`, `property_page`, `itinerary_enhancement`, `page_update`. The `chunkSections()` code path (used by destination_page and property_page) has never been called with any data.

---

## Task

Create a test ContentProject for each untested content type, embed it via the endpoint, verify chunks are correct, then clean up. This is verification only — no code changes unless a bug is found.

---

## Tests

Run each test sequentially. If any test fails, stop, diagnose, fix, and re-test before moving to the next.

### Test 1: destination_page

```bash
# Create
curl -s -X POST https://admin.kiuli.com/api/content-projects \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Destination Page",
    "stage": "draft",
    "contentType": "destination_page",
    "processingStatus": "idle",
    "sections": {
      "overview": "The Serengeti National Park is Tanzania most iconic wildlife destination spanning nearly 15000 square kilometres of endless plains grasslands and woodlands. Home to the Great Migration this vast ecosystem supports one of the highest concentrations of large mammals on Earth. The landscape ranges from the short grass plains in the south to the wooded hills in the north creating diverse habitats that attract different species throughout the year.",
      "whyChoose": "What sets a Serengeti safari apart is the sheer scale of wildlife encounters. Unlike smaller reserves where sightings can feel curated here the wilderness stretches to every horizon. Predator prey dynamics play out across open plains offering unobstructed viewing. The lodges and camps positioned along migration routes provide front row seats to one of nature greatest spectacles.",
      "bestTimeToVisit": "The Serengeti offers excellent game viewing year round but the experience varies dramatically by season. The dry season from June to October concentrates wildlife around remaining water sources making sightings more predictable. The calving season from January to March in the southern plains offers incredible predator action as newborn wildebeest attract lions cheetahs and hyenas."
    },
    "faqSection": [
      {"question": "How many days should I spend in the Serengeti?", "answer": "We recommend a minimum of three nights in the Serengeti to experience the full range of wildlife and landscapes. Four to five nights allows for deeper exploration including walking safaris and visits to different ecological zones within the park."}
    ],
    "destinations": ["Tanzania", "Serengeti"],
    "freshnessCategory": "quarterly"
  }'
# Save ID
```

Embed and verify:
```bash
# Embed
curl -s -X POST https://kiuli.com/api/content/embed \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"contentProjectId": DEST_ID}'
# Must return chunks > 0

# Verify chunk types
psql "$DATABASE_URL_UNPOOLED" -c "
SELECT chunk_type, LEFT(chunk_text, 60) as preview
FROM content_embeddings WHERE content_project_id = DEST_ID;
"
# Must show destination_section chunks (one per section key: overview, whyChoose, bestTimeToVisit) + 1 faq_answer
# Expected: 3 destination_section + 1 faq_answer = 4 chunks
```

### Test 2: property_page

```bash
curl -s -X POST https://admin.kiuli.com/api/content-projects \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Property Page",
    "stage": "draft",
    "contentType": "property_page",
    "processingStatus": "idle",
    "sections": {
      "overview": "Singita Grumeti is a private concession bordering the western corridor of the Serengeti offering exclusive access to over 350000 acres of pristine wilderness. The property operates three distinct lodges each with its own character and setting. Wildlife density here rivals the main Serengeti park but without the crowds making every game drive feel like a private safari.",
      "accommodation": "The suites blend contemporary African design with natural materials creating spaces that feel both luxurious and connected to the landscape. Floor to ceiling windows frame the savannah while private plunge pools offer a place to cool off between game drives. Every detail from the handcrafted furniture to the locally sourced artwork reflects a commitment to celebrating Tanzanian craftsmanship."
    },
    "properties": ["Singita Grumeti"],
    "destinations": ["Tanzania"],
    "freshnessCategory": "annual"
  }'
```

Embed and verify:
```bash
curl -s -X POST https://kiuli.com/api/content/embed \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"contentProjectId": PROP_ID}'
# Must return chunks > 0

psql "$DATABASE_URL_UNPOOLED" -c "
SELECT chunk_type, LEFT(chunk_text, 60) as preview
FROM content_embeddings WHERE content_project_id = PROP_ID;
"
# Must show property_section chunks (overview, accommodation)
# Expected: 2 property_section chunks
```

### Test 3: itinerary_enhancement

```bash
curl -s -X POST https://admin.kiuli.com/api/content-projects \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Itinerary Enhancement",
    "stage": "draft",
    "contentType": "itinerary_enhancement",
    "processingStatus": "idle",
    "body": {
      "root": {
        "type": "root",
        "children": [
          {"type": "heading", "tag": "h2", "children": [{"type": "text", "text": "Morning Game Drive"}], "version": 1, "format": "", "indent": 0, "direction": "ltr"},
          {"type": "paragraph", "children": [{"type": "text", "text": "The early morning game drive departs before dawn when the bush comes alive with activity. Predators are most active during these cooler hours and the golden light creates perfect conditions for photography. Your guide will navigate the reserve using years of experience reading animal tracks and behaviour patterns to position you for the best possible sightings."}], "version": 1, "format": "", "indent": 0, "direction": "ltr"},
          {"type": "heading", "tag": "h2", "children": [{"type": "text", "text": "Sundowner Experience"}], "version": 1, "format": "", "indent": 0, "direction": "ltr"},
          {"type": "paragraph", "children": [{"type": "text", "text": "As the afternoon light softens your guide will find the perfect spot overlooking the plains for a traditional sundowner. Cold drinks and canapes are served as the sun dips below the horizon painting the sky in shades of amber and crimson. This quintessential safari moment is when the bush transforms and nocturnal creatures begin to stir."}], "version": 1, "format": "", "indent": 0, "direction": "ltr"}
        ],
        "version": 1, "format": "", "indent": 0, "direction": "ltr"
      }
    },
    "destinations": ["Kenya"],
    "freshnessCategory": "evergreen"
  }'
```

Embed and verify:
```bash
curl -s -X POST https://kiuli.com/api/content/embed \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"contentProjectId": ENH_ID}'

psql "$DATABASE_URL_UNPOOLED" -c "
SELECT chunk_type, LEFT(chunk_text, 60) as preview
FROM content_embeddings WHERE content_project_id = ENH_ID;
"
# Must show itinerary_segment chunks (not article_section)
# Expected: 2 itinerary_segment chunks
```

### Test 4: page_update

```bash
curl -s -X POST https://admin.kiuli.com/api/content-projects \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Page Update",
    "stage": "draft",
    "contentType": "page_update",
    "processingStatus": "idle",
    "body": {
      "root": {
        "type": "root",
        "children": [
          {"type": "paragraph", "children": [{"type": "text", "text": "Updated information about gorilla trekking permits in Rwanda. The Rwanda Development Board has announced new permit pricing for the 2026 season. Permits remain at fifteen hundred US dollars per person for a one hour visit with a mountain gorilla family. The number of daily permits is still limited to eighty across all gorilla families in Volcanoes National Park ensuring a sustainable and exclusive experience for every visitor."}], "version": 1, "format": "", "indent": 0, "direction": "ltr"}
        ],
        "version": 1, "format": "", "indent": 0, "direction": "ltr"
      }
    },
    "destinations": ["Rwanda"],
    "freshnessCategory": "monthly"
  }'
```

Embed and verify:
```bash
curl -s -X POST https://kiuli.com/api/content/embed \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"contentProjectId": UPD_ID}'

psql "$DATABASE_URL_UNPOOLED" -c "
SELECT chunk_type, LEFT(chunk_text, 60) as preview
FROM content_embeddings WHERE content_project_id = UPD_ID;
"
# Must show exactly 1 page_section chunk
```

### Test 5: Cross-type semantic search

After all four are embedded, verify semantic search finds content across types:

```bash
npx tsx -e "
const { semanticSearch } = require('./content-system/embeddings/query');
const { end } = require('./content-system/db');
async function test() {
  const results = await semanticSearch('Serengeti wildlife migration');
  for (const r of results.slice(0, 5)) {
    console.log(\`[\${r.chunkType}] score=\${r.score.toFixed(3)} project=\${r.contentProjectId ?? 'bootstrap'} \${r.chunkText.substring(0, 80)}\`);
  }
  await end();
  process.exit(0);
}
test();
"
```

Should return a mix of destination_section, property_section, and bootstrap itinerary_segment results related to Serengeti/Tanzania.

### Cleanup

Delete all test embeddings and projects:

```bash
# Delete embeddings
psql "$DATABASE_URL_UNPOOLED" -c "DELETE FROM content_embeddings WHERE content_project_id IN (DEST_ID, PROP_ID, ENH_ID, UPD_ID);"

# Delete projects
for ID in DEST_ID PROP_ID ENH_ID UPD_ID; do
  curl -s -X DELETE https://admin.kiuli.com/api/content-projects/$ID \
    -H "Authorization: users API-Key $PAYLOAD_API_KEY"
done

# Verify back to 143
psql "$DATABASE_URL_UNPOOLED" -c "SELECT COUNT(*) FROM content_embeddings;"
# Must be 143
```

---

## Expected Results Summary

| Content Type | Chunks Expected | Chunk Types |
|---|---|---|
| destination_page | 4 | 3 destination_section + 1 faq_answer |
| property_page | 2 | 2 property_section |
| itinerary_enhancement | 2 | 2 itinerary_segment |
| page_update | 1 | 1 page_section |

If any content type produces 0 chunks or the wrong chunk_type, there's a bug. Fix it before proceeding.

---

## Report

Append results to `content-engine/reports/phase4-embeddings-engine.md` under a new section "## 8. Content Type Verification". Include actual chunk counts and types for each test, semantic search output, and final embedding count (must be 143 after cleanup).

If any bug was found and fixed, document the fix and re-run all tests.
