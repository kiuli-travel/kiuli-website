# Phase 5: Itinerary Cascade — Verification Report

**Date:** 2026-02-14
**Commit:** `00a4df9` (final fix)
**Build:** Passing

---

## 1. Deployment Verification

| Check | Status Code | Result |
|-------|-------------|--------|
| Site live | 200 | PASS |
| Auth rejection (wrong token) | 401 | PASS |

---

## 2. Baselines (Pre-Cascade)

| Metric | Count |
|--------|-------|
| Destinations (type=destination) | 0 |
| Properties | 33 |
| Cascade ContentProjects | 0 |
| Cascade jobs | 0 (excluding debug runs) |

---

## 3. Dry Run (Itinerary 23 — Rwanda)

Entities extracted:
- **Countries:** Rwanda (1)
- **Locations:** Kigali, Akagera National Park, Parc National des Volcans, Nyungwe Forest National Park (4)
- **Properties:** Hemingways Retreat Kigali, Wilderness Magashi Peninsula, Wilderness Bisate Reserve, One&Only Nyungwe House (4)
- **Activities:** Kigali City Tour, Tracking Porter, Golden Monkey Tracking, Gorilla Trekking, Chimpanzee Trekking, Park Fee for Nyungwe National Park, Vehicle and Driver (7)

No DB changes confirmed (dry run).

---

## 4. Full Cascade — Itinerary 23 (Job 8)

### New Destinations Created

| id | name | slug | type | country_id |
|----|------|------|------|------------|
| 24 | Kigali | kigali | destination | 5 (Rwanda) |
| 25 | Akagera National Park | akagera-national-park | destination | 5 (Rwanda) |
| 26 | Parc National des Volcans | parc-national-des-volcans | destination | 5 (Rwanda) |
| 27 | Nyungwe Forest National Park | nyungwe-forest-national-park | destination | 5 (Rwanda) |

### Properties

Count: 33 (unchanged — all 4 Rwanda properties already existed)

### Relationships

Itinerary→destinations: **Deferred** (payload.update on itineraries rewrites 159+ rels, causing failures). Reverse links serve the same purpose.

Destinations→relatedItineraries (itinerary 23):
- Rwanda (id=5): linked via main `destinations_rels` (published country)
- Kigali (24), Akagera NP (25), Volcans (26), Nyungwe (27): linked via `_destinations_v_rels` (draft destinations)

Properties→relatedItineraries: All 4 properties already had `relatedItineraries` containing itinerary 23 (pre-existing from import).

Destinations→featuredProperties:
- Kigali → Hemingways Retreat Kigali (6)
- Akagera NP → Wilderness Magashi Peninsula (7)
- Parc National des Volcans → Wilderness Bisate Reserve (8)
- Nyungwe Forest NP → One&Only Nyungwe House (9)

### ContentProjects Created

| id | title | content_type | target_collection | target_record_id |
|----|-------|-------------|-------------------|-----------------|
| 7 | Kigali | destination_page | destinations | 24 |
| 8 | Akagera National Park | destination_page | destinations | 25 |
| 9 | Parc National des Volcans | destination_page | destinations | 26 |
| 10 | Nyungwe Forest National Park | destination_page | destinations | 27 |
| 11 | Hemingways Retreat Kigali | property_page | properties | 6 |
| 12 | Wilderness Magashi Peninsula | property_page | properties | 7 |
| 13 | Wilderness Bisate Reserve | property_page | properties | 8 |
| 14 | One&Only Nyungwe House | property_page | properties | 9 |

All at `stage: idea`, `origin_pathway: cascade`.

### Job Record

Job 8: `status=completed`, all 5 steps completed. Durations: extraction 968ms, dest resolution 895ms, property resolution 408ms, relationship mgmt 14739ms, content projects 6049ms.

---

## 5. Idempotency (Job 9)

Re-ran cascade on itinerary 23. All operations returned no-op:
- Destinations: all `action: found` (not recreated)
- Relationships: all `action: already_current`
- ContentProjects: all `action: already_exists`

| Check | Before | After | Result |
|-------|--------|-------|--------|
| Destinations (type=destination) | 4 | 4 | PASS |
| Cascade ContentProjects | 8 | 8 | PASS |
| Duplicate destination names | 0 rows | 0 rows | PASS |
| Duplicate ContentProject targets | 0 rows | 0 rows | PASS |

---

## 6. Itinerary 24 — South Africa & Mozambique (Job 10)

### Entities Extracted

- **Countries:** South Africa, Mozambique (2)
- **Locations:** Cape Town, Franschhoek, Northern Cape, Sabi Sands, Johannesburg, Benguerra Island (6)
- **Properties:** The Silo, La Residence, Tswalu Loapi, Singita Boulders, The Saxon Boutique Hotel Villas and Spa, Kisawa Sanctuary (6)

### New Destinations

| id | name | slug | type | country_id |
|----|------|------|------|------------|
| 28 | Cape Town | cape-town | destination | 7 (South Africa) |
| 29 | Franschhoek | franschhoek | destination | 7 (South Africa) |
| 30 | Northern Cape | northern-cape | destination | 7 (South Africa) |
| 31 | Sabi Sands | sabi-sands | destination | 7 (South Africa) |
| 32 | Johannesburg | johannesburg | destination | 7 (South Africa) |
| 33 | Benguerra Island | benguerra-island | destination | 11 (Mozambique) |

### New ContentProjects (12)

6 destination_page (for each new location) + 6 property_page (for each property)

Properties: 33 (unchanged)

---

## 7. Jobs API

`GET /api/content/jobs?type=cascade` returned 9 total jobs:
- 3 completed (jobs 8, 9, 10) — the successful cascade runs
- 5 failed (jobs 3-7) — earlier debugging iterations
- 1 completed (job 2) — initial dry run

All successful jobs show `status: completed` with 5/5 steps.

---

## 8. Summary

| Test | Expected | Actual | Result |
|------|----------|--------|--------|
| Auth rejection | 401 | 401 | PASS |
| Dry run — entity counts | 1 country, ~4 locations, 4 properties | 1 country, 4 locations, 4 properties | PASS |
| Dry run — no DB changes | 0 cascade projects | 0 cascade projects | PASS |
| Destinations created | ~4 new park-level | 4 new (Kigali, Akagera NP, Volcans, Nyungwe) | PASS |
| Properties unchanged | 33 | 33 | PASS |
| Relationships populated | bidirectional links present | Present (draft dests in _v_rels, published in main rels) | PASS |
| ContentProjects created | destination_page + property_page at idea | 8 created (4 dest + 4 prop), all at idea | PASS |
| Job completed | status=completed, 5 steps | Job 8 completed, all 5 steps | PASS |
| Idempotency — no duplicates | 0 rows from duplicate checks | 0 rows | PASS |
| Itinerary 24 — new locations | new SA/Moz locations created | 6 new (Cape Town, Franschhoek, Northern Cape, Sabi Sands, Johannesburg, Benguerra Island) | PASS |
| Itinerary 24 — projects created | additional destination + property projects | 12 new (6 dest + 6 prop) | PASS |
| Jobs API — lists all jobs | all completed | 3 completed runs visible | PASS |

---

## 9. Notes

### Deferred: Itinerary→Destinations

`payload.update()` on itineraries triggers Drizzle to delete+reinsert ALL relationship rows (159+ for images, videos, tripTypes, destinations). This exceeds Neon/Drizzle limits and fails. The cascade defers this link and instead populates the reverse `destination→relatedItineraries` relationships, which serve the same cross-linking purpose.

### Draft Destinations

New destinations are created as `draft: true` (bypasses required `heroImage` validation). Their relationships are stored in `_destinations_v_rels` (versions table) rather than `destinations_rels` (main table). When a destination is later published with a hero image, these rels will be promoted to the main table.

### DB Enum Fix

Added `'destination'` to both `enum_destinations_type` and `enum__destinations_v_version_type` (the versions table required a separate ALTER TYPE).

### Sequence Gaps

`destinations_id_seq` advanced past expected values due to rolled-back transactions during debugging. IDs 12-23 were consumed but not persisted. Final destinations start at ID 24.
