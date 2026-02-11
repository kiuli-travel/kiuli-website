# Phase 2: Vector Store — CLI Prompt

**Date:** 2026-02-11
**Author:** Claude.ai (Strategic)
**Executor:** Claude CLI (Tactical)
**Phase:** 2 of 15
**Depends on:** Phase 1 (complete)

---

## Context

This phase creates the pgvector infrastructure for the content embedding store. The embedding store is what makes consistency checking, research retrieval, and content deduplication possible. It sits alongside Payload's managed tables as a separate, directly-managed table using unpooled connections.

Read this prompt completely before writing any code or running any commands.

---

## Critical Details

- **Neon project ID:** `super-queen-68865217`
- **Org ID:** `org-long-rice-46985810` (MUST pass `--org-id` to all neonctl commands)
- **Main branch ID:** `br-royal-shadow-abvgnq2g`
- **PG version:** 17
- **Region:** `aws-eu-west-2`
- **Unpooled connection:** Use `DATABASE_URL_UNPOOLED` environment variable (already set locally and in Vercel)

---

## Task 1: Create SQL Migration Files

Create three SQL files. These are standalone SQL — not Payload migrations. They run via psql or neonctl against the database directly.

**File:** `content-system/migrations/001_enable_pgvector.sql`

```sql
-- Enable pgvector extension
-- Neon supports pgvector natively; this is idempotent
CREATE EXTENSION IF NOT EXISTS vector;
```

**File:** `content-system/migrations/002_create_embeddings_table.sql`

```sql
-- Content embeddings table for RAG, consistency checking, and deduplication
-- Managed directly (not by Payload). Foreign key constraints intentionally omitted —
-- IDs are application-managed references to Payload collections.

CREATE TABLE IF NOT EXISTS content_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_type TEXT NOT NULL CHECK (chunk_type IN (
    'research_extract',
    'article_section',
    'faq_answer',
    'designer_insight',
    'itinerary_context',
    'editorial_directive',
    'conversation_insight',
    'destination_section',
    'itinerary_segment',
    'page_section',
    'property_section'
  )),
  chunk_text TEXT NOT NULL,
  embedding vector(3072) NOT NULL,

  content_project_id INTEGER,
  itinerary_id INTEGER,
  destination_id INTEGER,
  property_id INTEGER,

  content_type TEXT,
  destinations TEXT[],
  properties TEXT[],
  species TEXT[],
  freshness_category TEXT,
  audience_relevance TEXT[],

  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**File:** `content-system/migrations/003_create_indexes.sql`

```sql
-- HNSW index for cosine similarity search
-- m=32, ef_construction=128: over-indexed for recall
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
  ON content_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 32, ef_construction = 128);

-- Scalar indexes for filtering
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type ON content_embeddings (content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_type ON content_embeddings (chunk_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_project ON content_embeddings (content_project_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_itinerary ON content_embeddings (itinerary_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_destination ON content_embeddings (destination_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_property ON content_embeddings (property_id);

-- GIN indexes for array containment queries (@> operator)
CREATE INDEX IF NOT EXISTS idx_embeddings_destinations ON content_embeddings USING GIN (destinations);
CREATE INDEX IF NOT EXISTS idx_embeddings_properties ON content_embeddings USING GIN (properties);
CREATE INDEX IF NOT EXISTS idx_embeddings_species ON content_embeddings USING GIN (species);
```

**File:** `content-system/migrations/run.sh`

A shell script that runs all three migrations in order against a given database URL:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run content-system SQL migrations
# Usage: ./content-system/migrations/run.sh "$DATABASE_URL_UNPOOLED"

DB_URL="${1:?Usage: run.sh <DATABASE_URL>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Running content-system migrations ==="

for sql_file in "$SCRIPT_DIR"/0*.sql; do
  filename=$(basename "$sql_file")
  echo "→ Running $filename..."
  psql "$DB_URL" -f "$sql_file" -v ON_ERROR_STOP=1
  echo "  ✓ $filename complete"
done

echo "=== All migrations complete ==="
```

Make `run.sh` executable: `chmod +x content-system/migrations/run.sh`

---

## Task 2: Update content-system/db.ts

Replace the current stub with a real implementation. This file provides the unpooled postgres connection for vector operations. It does NOT replace Payload's managed connection — it supplements it.

Keep the existing Payload API type declarations (they're used by other content-system modules). Add the pg pool below them.

**Requirements:**

- Import `pg` from the `pg` package (already installed as a transitive dependency of `@payloadcms/db-vercel-postgres` — verify with `ls node_modules/pg` before adding any dependency)
- Create a lazy-initialised `Pool` using `DATABASE_URL_UNPOOLED`
- Pool config: `max: 3` (we're the only direct consumer), `ssl: { rejectUnauthorized: false }` for Neon compatibility
- Export `getPool()` that returns the pool instance
- Export `query(text: string, params?: unknown[]): Promise<pg.QueryResult>` convenience function
- Export `end()` to close the pool (for clean Lambda shutdown)
- Include the existing Payload API type declarations unchanged

Do NOT use `import Pool from 'pg'` — use `import { Pool } from 'pg'`. Verify the import works.

---

## Task 3: Update content-system/embeddings/types.ts

The Phase 1 stub has incorrect chunk types. Replace with the correct types matching the database CHECK constraint exactly.

**ChunkType must be:**

```typescript
export type ChunkType =
  | 'research_extract'
  | 'article_section'
  | 'faq_answer'
  | 'designer_insight'
  | 'itinerary_context'
  | 'editorial_directive'
  | 'conversation_insight'
  | 'destination_section'
  | 'itinerary_segment'
  | 'page_section'
  | 'property_section'
```

Update the rest of the interfaces to match the actual database schema:

```typescript
export interface EmbeddingRecord {
  id: string  // UUID
  chunkType: ChunkType
  chunkText: string
  embedding: number[]  // 3072 dimensions

  contentProjectId?: number
  itineraryId?: number
  destinationId?: number
  propertyId?: number

  contentType?: string
  destinations?: string[]
  properties?: string[]
  species?: string[]
  freshnessCategory?: string
  audienceRelevance?: string[]

  publishedAt?: string
  createdAt: string
  updatedAt: string
}
```

Keep the `ContentChunk`, `SimilarityResult`, `QueryFilter`, `ChunkerOptions`, `EmbedOptions`, and `QueryOptions` interfaces but update their `ChunkType` references and field names to be consistent with the new `EmbeddingRecord`. Also update `ChunkMetadata` to include all filter fields from the database schema.

---

## Task 4: Execute Migrations — Dev Branch First

This is the critical part. Follow this exact sequence. Do NOT skip the dev branch step.

### Step 1: Create dev branch

```bash
neonctl branches create \
  --project-id super-queen-68865217 \
  --org-id org-long-rice-46985810 \
  --name "dev/content-engine-pgvector" \
  --parent main \
  --output json
```

Capture the output. Extract the connection URI for the dev branch — you need the unpooled endpoint. It will be in the output JSON under `connection_uri` or similar. If the output doesn't include a connection string directly, construct it or use:

```bash
neonctl connection-string \
  --project-id super-queen-68865217 \
  --org-id org-long-rice-46985810 \
  --branch "dev/content-engine-pgvector" \
  --pooled false
```

### Step 2: Run migrations on dev branch

```bash
./content-system/migrations/run.sh "<DEV_BRANCH_CONNECTION_STRING>"
```

### Step 3: Verify on dev branch

Run all of the following and capture output:

```bash
DEV_URL="<DEV_BRANCH_CONNECTION_STRING>"

# Verify pgvector extension
psql "$DEV_URL" -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"

# Verify table structure
psql "$DEV_URL" -c "\d content_embeddings"

# Verify all indexes
psql "$DEV_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename = 'content_embeddings' ORDER BY indexname;"

# Verify insert works with all field types
psql "$DEV_URL" -c "
INSERT INTO content_embeddings (
  chunk_type, chunk_text, embedding, content_type,
  destinations, properties, species, property_id
) VALUES (
  'property_section',
  'Test embed: Angama Mara perches on the rim of the Great Rift Valley.',
  (SELECT array_agg(random())::vector(3072) FROM generate_series(1,3072)),
  'property_page',
  ARRAY['masai-mara', 'kenya'],
  ARRAY['angama-mara'],
  ARRAY['lion', 'elephant'],
  1
) RETURNING id, chunk_type, created_at;
"

# Verify array filter query works
psql "$DEV_URL" -c "
SELECT id, chunk_type, chunk_text
FROM content_embeddings
WHERE 'angama-mara' = ANY(properties)
LIMIT 1;
"

# Verify cosine similarity query syntax works (using random query vector)
psql "$DEV_URL" -c "
SELECT id, chunk_text,
  1 - (embedding <=> (SELECT array_agg(random())::vector(3072) FROM generate_series(1,3072))) as similarity
FROM content_embeddings
ORDER BY embedding <=> (SELECT array_agg(random())::vector(3072) FROM generate_series(1,3072))
LIMIT 3;
"

# Clean up test data
psql "$DEV_URL" -c "DELETE FROM content_embeddings WHERE chunk_text LIKE 'Test embed:%';"

# Verify Payload tables are untouched (should see all 148+ existing tables)
psql "$DEV_URL" -c "SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
```

If any step fails, STOP and report the error. Do not proceed to production.

### Step 4: Run migrations on production

Only after dev branch verification passes:

```bash
./content-system/migrations/run.sh "$DATABASE_URL_UNPOOLED"
```

### Step 5: Verify on production

Run the same verification commands from Step 3 but against `$DATABASE_URL_UNPOOLED`. Same insert test, same query tests, same cleanup.

Additionally verify Payload is unaffected:

```bash
# Verify Payload admin still responds
curl -s -o /dev/null -w "%{http_code}" https://admin.kiuli.com/admin

# Verify an existing API endpoint still works
curl -s https://admin.kiuli.com/api/itineraries?limit=1 | head -c 200
```

### Step 6: Delete dev branch

```bash
neonctl branches delete "dev/content-engine-pgvector" \
  --project-id super-queen-68865217 \
  --org-id org-long-rice-46985810
```

---

## Task 5: Verify pg import in db.ts

After writing db.ts, verify the `pg` module is available:

```bash
node -e "const { Pool } = require('pg'); console.log('pg available, Pool constructor:', typeof Pool)"
```

If this fails, `pg` is not installed. In that case, install it:

```bash
npm install pg
npm install -D @types/pg
```

But check first — it's likely already available as a transitive dependency.

---

## Task 6: Build Verification

```bash
npm run build
```

Must pass. The new db.ts must compile. The updated types.ts must be consistent with other content-system modules that import from it.

---

## DO NOT

- Do not use pooled connection (`POSTGRES_URL`) for vector operations
- Do not add foreign key constraints to content_embeddings
- Do not modify Payload's database configuration or migrations
- Do not modify any Payload collections or globals
- Do not create API routes (that's Phase 2.5+)
- Do not install npm packages unless `pg` is genuinely missing (check first)
- Do not run migrations on production before verifying on dev branch

---

## Verification & Report

Write results to `content-engine/reports/phase2-vector-store.md`:

### 1. Dev Branch Verification
Full output of all verification queries on dev branch.

### 2. Production Verification
Full output of all verification queries on production.

### 3. Dev Branch Cleanup
Confirmation that dev branch was deleted.

### 4. Build Output
Last 20 lines of `npm run build`.

### 5. File Manifest
Every file created or modified with line counts.

### 6. pg Module Verification
Output of the `node -e` check.

### 7. Payload Health Check
HTTP status codes from admin.kiuli.com checks.

### 8. Git Commit

```bash
git add -A
git commit -m "feat(content-engine): Phase 2 — pgvector store

SQL migrations: enable pgvector, create content_embeddings table, HNSW + GIN indexes.
db.ts: unpooled pg connection pool for vector operations.
embeddings/types.ts: corrected chunk types matching database CHECK constraint.
Verified on Neon dev branch, then applied to production.
Dev branch deleted."
git push
```

### 9. Status Update

Update `content-engine/status.md`:
- Mark Phase 2 as COMPLETED with date
- Note pgvector version from extension query
- Note any issues encountered

---

## Success Criteria

Phase 2 is complete when ALL of the following are true:

1. `pgvector` extension enabled on production Neon database
2. `content_embeddings` table exists with all columns matching V6 spec Section 11.8
3. HNSW index exists with correct parameters (m=32, ef_construction=128)
4. All 9 scalar and GIN indexes exist
5. Insert, array filter, and cosine similarity queries all work
6. Payload tables and admin unaffected
7. `content-system/db.ts` provides working unpooled Pool connection
8. `content-system/embeddings/types.ts` has correct ChunkType enum matching database
9. `npm run build` passes
10. Dev branch deleted
11. Git clean, committed, pushed
