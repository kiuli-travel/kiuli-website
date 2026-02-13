# Phase 1: Database Schema — Complete Properly

**Date:** February 13, 2026  
**Author:** Claude (Strategist)  
**Executor:** Claude CLI (Tactician)  
**Specification:** KIULI_CONTENT_SYSTEM_V6.md, KIULI_CONTENT_SYSTEM_DEVELOPMENT_PLAN_V4.md

---

## Problem

Phase 1 was marked complete but the database does not match the Payload collection definitions. A manual reconciliation migration created stub tables with minimal columns. The proper Payload migration was never generated.

All four content engine tables are empty (0 rows). We will drop them, remove the fake migration record, and generate a proper Payload migration from scratch.

**Do NOT touch content_embeddings.** That table is correct and stays as-is.

---

## Outcomes

1. All content engine database tables match their Payload collection definitions exactly
2. ContentProjects has version tables (collection has `versions: { drafts: true }`)
3. All array fields have their sub-tables
4. All relationship fields have proper columns or join tables
5. Global tables exist for content_system_settings and destination_name_mappings
6. content_embeddings table is UNCHANGED (17 columns, all indexes intact)
7. `npm run build` passes
8. Payload admin can CRUD ContentProjects, ContentJobs, SourceRegistry, EditorialDirectives
9. Payload admin can access and save ContentSystemSettings and DestinationNameMappings globals
10. All existing collections (Itineraries, Properties, Destinations, etc.) are unaffected

---

## Step 1: Record the Before State

Run every query below and save the output. This is evidence of what's broken.

```bash
# Column counts for content engine tables
psql "$POSTGRES_URL" -c "
SELECT table_name, COUNT(*) as column_count 
FROM information_schema.columns 
WHERE table_name IN ('content_projects', 'content_jobs', 'source_registry', 'editorial_directives') 
GROUP BY table_name ORDER BY table_name;
"

# Check for version tables (should be none)
psql "$POSTGRES_URL" -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%content_projects_v%'
ORDER BY table_name;
"

# Check for array sub-tables (should be none)
psql "$POSTGRES_URL" -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE 'content_projects_%' AND table_name NOT IN ('content_projects'))
ORDER BY table_name;
"

# Check for global tables (should be none)
psql "$POSTGRES_URL" -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%content_system%' OR table_name LIKE '%destination_name%')
ORDER BY table_name;
"

# Confirm tables are empty
psql "$POSTGRES_URL" -c "SELECT COUNT(*) FROM content_projects;"
psql "$POSTGRES_URL" -c "SELECT COUNT(*) FROM content_jobs;"
psql "$POSTGRES_URL" -c "SELECT COUNT(*) FROM source_registry;"
psql "$POSTGRES_URL" -c "SELECT COUNT(*) FROM editorial_directives;"

# Record content_embeddings column count (must be 17 — our baseline)
psql "$POSTGRES_URL" -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'content_embeddings';"

# Record the fake migration entry
psql "$POSTGRES_URL" -c "SELECT name, batch FROM payload_migrations WHERE name LIKE '%reconcile%';"
```

---

## Step 2: Drop the Stub Tables and Fake Migration

```sql
-- Drop the content engine stub tables (all empty, confirmed in Step 1)
-- CASCADE handles any FK references between them
DROP TABLE IF EXISTS content_jobs CASCADE;
DROP TABLE IF EXISTS content_projects CASCADE;
DROP TABLE IF EXISTS source_registry CASCADE;
DROP TABLE IF EXISTS editorial_directives CASCADE;

-- Remove columns added to Payload internal tables by the reconciliation migration
ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS content_projects_id;
ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS content_jobs_id;
ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS source_registry_id;
ALTER TABLE payload_locked_documents_rels DROP COLUMN IF EXISTS editorial_directives_id;

ALTER TABLE payload_preferences_rels DROP COLUMN IF EXISTS content_projects_id;
ALTER TABLE payload_preferences_rels DROP COLUMN IF EXISTS content_jobs_id;
ALTER TABLE payload_preferences_rels DROP COLUMN IF EXISTS source_registry_id;
ALTER TABLE payload_preferences_rels DROP COLUMN IF EXISTS editorial_directives_id;

-- Drop indexes on those columns
DROP INDEX IF EXISTS payload_locked_documents_rels_content_projects_id_idx;
DROP INDEX IF EXISTS payload_locked_documents_rels_content_jobs_id_idx;
DROP INDEX IF EXISTS payload_locked_documents_rels_source_registry_id_idx;
DROP INDEX IF EXISTS payload_locked_documents_rels_editorial_directives_id_idx;

-- Remove the fake migration record
DELETE FROM payload_migrations WHERE name = '20260212_reconcile_content_engine_tables';
```

Run this via psql against `$POSTGRES_URL`. Verify each DROP/ALTER succeeds.

---

## Step 3: Remove the Reconciliation Migration File

Delete the migration file and update the migration index:

```bash
rm src/migrations/20260212_reconcile_content_engine_tables.ts
```

Then edit `src/migrations/index.ts`:
- Remove the import line for `20260212_reconcile_content_engine_tables`
- Remove the corresponding entry from the migrations array

Verify the file still has valid syntax after editing.

---

## Step 4: Generate a Proper Payload Migration

```bash
npx payload migrate:create
```

When prompted for a name, use: `content_engine_phase1`

This generates a migration file in `src/migrations/` that diffs the Payload schema (from all collection and global definitions in payload.config.ts) against the current database state.

**Review the generated migration SQL carefully.** Verify:

1. It creates `content_projects` table with ALL columns from the ContentProjects collection definition (stage, content_type, processing_status, processing_error, all Brief/Research/Draft/Image/Distribution/Linking/Consistency/Metadata fields)
2. It creates array sub-tables: `content_projects_sources`, `content_projects_proprietary_angles`, `content_projects_uncertainty_map`, `content_projects_faq_section`, `content_projects_generated_candidates`, `content_projects_consistency_issues`, `content_projects_messages` (at minimum)
3. It creates version tables: `_content_projects_v` and version sub-tables for arrays
4. It creates `content_jobs` with all fields including `progress` as jsonb (NOT numeric)
5. It creates `source_registry` with all fields
6. It creates `editorial_directives` with all fields
7. It creates global tables for `content_system_settings` and `destination_name_mappings` (plus array sub-table for destination_name_mappings entries)
8. It adds relationship columns to `payload_locked_documents_rels` and `payload_preferences_rels`
9. It does NOT touch `content_embeddings`
10. It does NOT modify any existing collections (itineraries, properties, destinations, media, etc.)

If the migration contains changes to non-content-engine tables, understand why. If it's trying to sync drift on other collections, that's a problem — report it and stop.

---

## Step 5: Update the Migration Index

Ensure `src/migrations/index.ts` includes the new migration. Payload may have done this automatically. If not, add the import and entry manually.

---

## Step 6: Run the Migration

```bash
npx payload migrate
```

Watch the output. Every statement must succeed. If anything fails, stop and report the error — do not continue.

---

## Step 7: Verify the After State

Run every query below. Compare against Step 1 results.

```bash
# Content projects column count (should be 30+)
psql "$POSTGRES_URL" -c "
SELECT COUNT(*) as column_count 
FROM information_schema.columns 
WHERE table_name = 'content_projects';
"

# Key columns must exist
psql "$POSTGRES_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'content_projects' 
AND column_name IN ('stage', 'content_type', 'processing_status', 'processing_error', 'processing_started_at', 'target_collection', 'target_record_id', 'target_updated_at', 'brief_summary', 'target_angle', 'sections', 'meta_title', 'meta_description', 'answer_capsule', 'hero_image_id', 'linkedin_summary', 'freshness_category', 'published_at', 'consistency_check_result')
ORDER BY column_name;
"
# Must return all 19 columns

# Content jobs columns
psql "$POSTGRES_URL" -c "
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'content_jobs'
ORDER BY column_name;
"
# progress must be jsonb, not numeric

# Version tables exist
psql "$POSTGRES_URL" -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%content_projects_v%'
ORDER BY table_name;
"
# Must return at least one table

# Array sub-tables exist
psql "$POSTGRES_URL" -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'content_projects_%' 
AND table_name != 'content_projects'
ORDER BY table_name;
"
# Must return multiple tables (sources, faq_section, messages, etc.)

# Global tables exist
psql "$POSTGRES_URL" -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%content_system%' OR table_name LIKE '%destination_name%')
ORDER BY table_name;
"
# Must return tables

# Source registry columns
psql "$POSTGRES_URL" -c "
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'source_registry' ORDER BY ordinal_position;
"

# Editorial directives columns
psql "$POSTGRES_URL" -c "
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'editorial_directives' ORDER BY ordinal_position;
"

# CRITICAL: content_embeddings unchanged
psql "$POSTGRES_URL" -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'content_embeddings';"
# MUST be exactly 17. If not, STOP and report.

# Verify migration recorded
psql "$POSTGRES_URL" -c "SELECT name, batch FROM payload_migrations ORDER BY created_at DESC LIMIT 5;"
```

---

## Step 8: Functional Tests

```bash
npm run build
```

Must pass. If it fails, fix before continuing.

Then test CRUD through Payload:

```bash
# Create a ContentProject
curl -s -X POST https://admin.kiuli.com/api/content-projects \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Phase 1 Gate Test",
    "stage": "idea",
    "contentType": "authority",
    "processingStatus": "idle",
    "freshnessCategory": "quarterly"
  }'
# Must return the created record with all fields

# Read it back (use the ID from above)
curl -s https://admin.kiuli.com/api/content-projects/[ID] \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY"
# Must return all fields

# Create a ContentJob
curl -s -X POST https://admin.kiuli.com/api/content-jobs \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jobType": "cascade",
    "status": "pending",
    "progress": {"steps": [], "currentStep": "none"}
  }'
# progress must accept JSON object, not just a number

# Test globals
curl -s https://admin.kiuli.com/api/globals/content-system-settings \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY"
# Must return the global with model fields

curl -s https://admin.kiuli.com/api/globals/destination-name-mappings \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY"
# Must return the global

# Verify existing collections unaffected
curl -s -o /dev/null -w "%{http_code}" https://admin.kiuli.com/api/itineraries
# Must return 200

curl -s -o /dev/null -w "%{http_code}" https://admin.kiuli.com/api/properties
# Must return 200

# Delete test records
curl -s -X DELETE https://admin.kiuli.com/api/content-projects/[ID] \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY"
curl -s -X DELETE https://admin.kiuli.com/api/content-jobs/[ID] \
  -H "Authorization: users API-Key $PAYLOAD_API_KEY"
```

---

## Step 9: Commit

```bash
git add -A
git commit -m "fix(content-engine): Phase 1 — proper Payload migration for content engine collections

Dropped manually-created stub tables and reconciliation migration.
Generated proper Payload migration with all columns, array sub-tables,
version tables, relationship joins, and global tables."
git push
```

---

## Do Not

- Do NOT touch content_embeddings table in any way
- Do NOT modify Itineraries, Destinations, Properties, Posts, Authors, Media, or any non-content-engine collection definitions
- Do NOT modify the ContentProjects, ContentJobs, SourceRegistry, or EditorialDirectives collection code (the code is correct)
- Do NOT modify the ContentSystemSettings or DestinationNameMappings global code
- Do NOT install new npm packages
- Do NOT create API routes
- Do NOT skip any verification query
- Do NOT proceed past any failure — stop and report

---

## Gate Evidence

Every single one of these must pass:

```bash
# 1. Build passes
npm run build 2>&1 | tail -5

# 2. ContentProjects has all 19 key columns listed in Step 7
# (paste the query output)

# 3. ContentProjects version table exists
# (paste the query output)

# 4. Array sub-tables exist (list them all)
# (paste the query output)

# 5. Global tables exist
# (paste the query output)

# 6. content_embeddings has exactly 17 columns
# (paste the query output — must be 17)

# 7. CRUD test — ContentProject created, read, deleted successfully
# (paste the curl outputs)

# 8. ContentJob created with JSON progress field
# (paste the curl output)

# 9. Globals accessible
# (paste the curl outputs)

# 10. Existing collections return 200
# (paste the status codes)
```

---

## Report

Write report to `content-engine/reports/phase1-db-reconciliation.md` with:

1. Before state (all Step 1 query outputs)
2. DROP/ALTER output
3. Generated migration filename and a summary of what it creates
4. Migration run output
5. After state (all Step 7 query outputs)
6. CRUD test results (all Step 8 outputs)
7. Any issues encountered and how they were resolved
8. Git commit hash

Then update `content-engine/status.md` — mark Phase 1 as COMPLETED only if every gate passes.
