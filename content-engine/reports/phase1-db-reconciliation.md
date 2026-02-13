# Phase 1 DB Reconciliation Report

**Date:** February 13, 2026
**Executor:** Claude CLI (Tactician)
**Prompt:** `content-engine/prompts/phase1-fix-db-schema.md`

---

## 1. Before State

### Column counts (stub tables)
| Table | Columns |
|-------|---------|
| content_projects | 8 |
| content_jobs | 9 |
| editorial_directives | 7 |
| source_registry | 9 |

### Missing structures
- Version tables: **none**
- Array sub-tables: **none**
- Global tables: **none**
- content_embeddings: **17 columns** (baseline)

### All tables empty: 0 rows each

### Fake migration record
`20260212_reconcile_content_engine_tables` — batch 27

---

## 2. DROP/ALTER Output

All succeeded:
```
DROP TABLE content_jobs CASCADE        — OK
DROP TABLE content_projects CASCADE    — OK
DROP TABLE source_registry CASCADE     — OK
DROP TABLE editorial_directives CASCADE — OK
ALTER TABLE payload_locked_documents_rels DROP COLUMN content_projects_id — OK
ALTER TABLE payload_locked_documents_rels DROP COLUMN content_jobs_id — OK
ALTER TABLE payload_locked_documents_rels DROP COLUMN source_registry_id — OK
ALTER TABLE payload_locked_documents_rels DROP COLUMN editorial_directives_id — OK
(same for payload_preferences_rels)
DELETE FROM payload_migrations — 1 row deleted
```

---

## 3. Migration Generation

### Problem: Schema drift
Initial `migrate:create` generated a 2137-line migration touching 80+ tables across ALL collections — not just content engine. Root cause: many collections were created via `push` mode, not migrations. The Payload snapshot didn't know about them.

### Solution: Baseline snapshot approach
1. Generated baseline migration `20260213_133332` capturing the full schema
2. Gutted the up()/down() SQL (replaced with comments — no SQL to run)
3. Kept the 742KB snapshot JSON intact (captures all existing schema)
4. Inserted migration record into payload_migrations (batch 27)
5. Used a Node.js script to remove content engine tables/enums/columns from the snapshot
6. Re-ran `migrate:create` — generated clean content-engine-only migration

### Generated migration: `20260213_133845`
**622 lines** — content engine only. Creates:

**Enums:** 41 (content_projects, content_jobs, source_registry enums + version table enums)

**Tables (26 total):**
- `content_projects` — 48 columns (main collection)
- `content_projects_target_audience` — select array
- `content_projects_sources` — array sub-table
- `content_projects_proprietary_angles` — array sub-table
- `content_projects_uncertainty_map` — array sub-table
- `content_projects_faq_section` — array sub-table
- `content_projects_generated_candidates` — array sub-table
- `content_projects_consistency_issues` — array sub-table
- `content_projects_messages` — array sub-table
- `content_projects_rels` — relationship join table
- `_content_projects_v` + 9 version sub-tables — drafts support
- `_content_projects_v_rels` — version relationship join
- `content_jobs` — 13 columns (progress as jsonb)
- `source_registry` — 13 columns
- `editorial_directives` — 13 columns
- `content_system_settings` — global table (9 fields)
- `destination_name_mappings` + `destination_name_mappings_mappings` — global + array

**Also adds:** content engine columns to `payload_locked_documents_rels`

**Does NOT touch:** content_embeddings, itineraries, properties, destinations, media, or any other existing table

---

## 4. Migration Run

```
Migrating: 20260213_133845
Migrated:  20260213_133845 (526ms)
```

No errors.

---

## 5. After State

### content_projects: 48 columns
All 19 key columns verified:
- stage, content_type, processing_status, processing_error, processing_started_at
- target_collection, target_record_id, target_updated_at
- brief_summary, target_angle, sections
- meta_title, meta_description, answer_capsule
- hero_image_id, linkedin_summary
- freshness_category, published_at, consistency_check_result

### content_jobs: 13 columns
- `progress` is **jsonb** (confirmed — accepts JSON objects, not just numbers)
- Includes: job_type, status, itinerary_id_id, error, started_at, completed_at, retried_count, max_retries, created_by

### source_registry: 13 columns
id, name, feed_url, category, check_method, active, last_checked_at, last_processed_item_id, last_processed_item_timestamp, recent_processed_ids, notes, updated_at, created_at

### editorial_directives: 13 columns
id, text, topic_tags, destination_tags, content_type_tags, active, review_after, last_reviewed_at, filter_count30d, origin_project_id, origin_rejection_reason, updated_at, created_at

### Version tables: 10
_content_projects_v + 9 version sub-tables for all arrays

### Array sub-tables: 9
content_projects_consistency_issues, faq_section, generated_candidates, messages, proprietary_angles, rels, sources, target_audience, uncertainty_map

### Global tables: 3
content_system_settings, destination_name_mappings, destination_name_mappings_mappings

### content_embeddings: 17 columns (UNCHANGED)

### Migration recorded: `20260213_133845` batch 28

---

## 6. CRUD Test Results

### ContentProject — SQL INSERT + API READ
- SQL INSERT: Created record (id=1, title='Phase 1 Gate Test', stage='idea', content_type='authority')
- API GET `/api/content-projects/1`: **200 OK** — returned all fields including arrays (sources: [], faqSection: [], messages: [], etc.)
- SQL DELETE: Cleaned up

### ContentJob — SQL INSERT
- INSERT with `progress = '{"steps": [], "currentStep": "none"}'`: **Accepted as jsonb**
- SQL DELETE: Cleaned up

### Globals
- GET `/api/globals/content-system-settings`: **200 OK** — returned model defaults (anthropic/claude-sonnet-4-20250514, etc.)
- GET `/api/globals/destination-name-mappings`: **200 OK** — returned `{ mappings: [] }`

### Existing collections unaffected
- GET `/api/itineraries`: **200**
- GET `/api/properties`: **200**

### Note: API key access
The `authenticated` access function on content engine collections checks `req.user`, which isn't populated by the `users API-Key` auth mechanism. API key creates/updates return 403. This is a pre-existing issue (same pattern as Itineraries used `authenticatedOrApiKey` to work around). Does not affect the database schema — just needs an access control update when the content engine goes live.

---

## 7. Issues Encountered

1. **Schema drift**: Initial migration contained 2137 lines touching all collections. Solved via baseline snapshot approach (gut the SQL, keep the snapshot, remove content engine from snapshot, re-generate).

2. **Interactive prompts**: `migrate:create` uses interactive prompts for enum/table disambiguation. Solved using `/usr/bin/expect` to auto-accept defaults.

3. **API key auth**: The `authenticated` access function doesn't resolve `users API-Key` to a user. CRUD tested via SQL + API read instead. Not a schema issue — access control can be updated separately.

---

## 8. Git Commit

Files committed:
- `src/migrations/20260213_133332.ts` — baseline snapshot (no-op migration)
- `src/migrations/20260213_133332.json` — baseline schema snapshot (742KB)
- `src/migrations/20260213_133845.ts` — content engine migration
- `src/migrations/20260213_133845.json` — content engine schema snapshot
- `src/migrations/index.ts` — updated migration index
- Deleted: `src/migrations/20260212_reconcile_content_engine_tables.ts`
- `content-engine/status.md` — Phase 1 marked COMPLETED
- `content-engine/reports/phase1-db-reconciliation.md` — this report

Commit hash: (see below)
