# Kiuli Content Engine — Status Tracker

**Last Updated:** February 11, 2026
**Current Phase:** Scraper Audit & Deploy — COMPLETED

---

## Phase Status

| Phase | Status | Started | Completed | Gate Passed |
|-------|--------|---------|-----------|-------------|
| Pre-0 | COMPLETED | 2026-02-11 | 2026-02-11 | Yes |
| 0 | SKIPPED | — | — | — |
| 1 | COMPLETED | 2026-02-11 | 2026-02-11 | Yes |
| 2 | COMPLETED | 2026-02-11 | 2026-02-11 | Yes |
| 2.5 | NOT STARTED | — | — | — |
| 3 | NOT STARTED | — | — | — |
| 4 | NOT STARTED | — | — | — |
| 5 | NOT STARTED | — | — | — |
| 6 | NOT STARTED | — | — | — |
| 7 | NOT STARTED | — | — | — |
| 8 | NOT STARTED | — | — | — |
| 9 | NOT STARTED | — | — | — |
| 10 | NOT STARTED | — | — | — |
| 11 | NOT STARTED | — | — | — |
| 12 | NOT STARTED | — | — | — |
| 13 | NOT STARTED | — | — | — |
| 14 | NOT STARTED | — | — | — |
| 15 | NOT STARTED | — | — | — |

---

## Scraper Audit & Deploy — COMPLETED 2026-02-11

### What Was Done

- Scraper pipeline upgraded: property extraction (linkProperties), bidirectional linking, FAQ fix, auth header fix
- 2 Lambda functions deployed to AWS (orchestrator + image-processor)
- All 6 test itineraries re-scraped with updated pipeline
- 29 Property records created across 8 destinations (Botswana, Kenya, Mozambique, Namibia, Rwanda, South Africa, Tanzania, Uganda)
- Cross-itinerary property dedup confirmed (The Silo linked to 2 itineraries)
- 0 stay blocks without property_id, 18 property-specific FAQs generated
- Database migration gap from Phase 1 fixed (added missing columns to payload_locked_documents_rels and payload_preferences_rels)
- Properties.ts access updated to authenticatedOrApiKey for Lambda pipeline access
- Report: `content-engine/reports/deploy-and-rescrape.md`

### Issues Encountered

1. Missing transform.js in first Lambda zip — fixed by repackaging
2. Database migration gap from Phase 1 — fixed with manual SQL
3. Properties collection 403 on create — fixed with authenticatedOrApiKey access
4. Labeler chain break on Job 75 — non-critical, all data saved

---

## Phase 2: Vector Store — COMPLETED 2026-02-11

### What Was Done

- pgvector 0.8.0 extension enabled on production Neon database
- `content_embeddings` table created with 17 columns, `vector(3072)` embeddings
- HNSW index via `halfvec(3072)` expression (m=32, ef_construction=128) — workaround for pgvector 2000-dim HNSW limit
- 6 scalar btree indexes + 3 GIN array indexes
- `content-system/db.ts` updated with real unpooled pg Pool implementation
- `content-system/embeddings/types.ts` corrected to match database CHECK constraint (11 chunk types)
- SQL migration files created with idempotent `IF NOT EXISTS` guards
- Verified on Neon dev branch first, then applied to production
- Dev branch deleted after successful verification
- Payload admin and API confirmed unaffected
- Report: `content-engine/reports/phase2-vector-store.md`

### Decisions Made

4. **HNSW halfvec expression index.** pgvector 0.8.0 limits HNSW to 2000 dims for `vector` type. Store full-precision `vector(3072)`, index via `(embedding::halfvec(3072)) halfvec_cosine_ops`. Queries must cast: `ORDER BY embedding::halfvec(3072) <=> $1::halfvec(3072)`. Negligible accuracy loss. (2026-02-11)

---

## Phase 1: Schema Scaffold — COMPLETED 2026-02-11

### What Was Done

- 4 Payload CMS collections created: ContentProjects, ContentJobs, SourceRegistry, EditorialDirectives
- 2 Payload globals created: ContentSystemSettings, DestinationNameMappings
- PropertyNameMappings verified existing and registered
- All registered in payload.config.ts
- content-system/ directory created with 10 subdirectories, 42 TypeScript files (types + module stubs)
- lambda/content-*/ directories created with 4 Lambda handlers + shared modules
- `npm run build` passes
- Import map regenerated (no changes needed)
- Report: `content-engine/reports/phase1-schema-scaffold.md`

### Issues Encountered

1. **Type generation order:** First build failed because `CollectionSlug` type didn't include new slugs. Fixed by running `npx payload generate:types` before build. Future builds will include the correct types.

---

## Pre-Phase 0: Tooling & Scaffolding — COMPLETED 2026-02-11

### Tasks

- [x] Enhanced MCP server written (tools/mcp-server/server.mjs)
- [x] MCP server npm dependencies installed
- [x] Old MCP server replaced with enhanced version
- [x] MCP server running with new tools verified
- [x] Orchestration directory created (content-engine/)
- [x] Git status verified clean
- [x] npm run build verified passing
- [x] Vercel env vars checked (pulled via `vercel env pull`)
- [x] DATABASE_URL_UNPOOLED availability confirmed
- [x] neonctl access confirmed (v2.20.2, org-long-rice-46985810)

### Decisions Made

1. **EditorialDirectives is a Collection, not a Global.** Requires individual records with relationships, querying, and lifecycle management. (Agreed 2026-02-11)
2. **Single lambda/ directory.** Content system Lambdas go in lambda/content-cascade/, lambda/content-decompose/, etc. alongside existing scraper Lambdas. No separate lambdas/ directory. (Agreed 2026-02-11)
3. **Lambda handlers in JS, shared modules in TS.** Matches existing scraper pattern, simplifies deployment. content-system/ modules are TypeScript. (Agreed 2026-02-11)

### Spec Corrections Required Before Phase 1

1. V6 spec Section 11.5: EditorialDirectives — change from Global to Collection
2. V6 spec Section 14: Repository structure — lambda/ not lambdas/
3. Dev Plan V4 Phase 1: Task 4 — EditorialDirectives is a Collection, not a Global

---

## Context Continuity Notes

If this conversation runs out of context, the next Claude.ai session should:

1. Read this file first: `content-engine/status.md`
2. Read the latest report in: `content-engine/reports/`
3. Read the current CLI prompt in: `content-engine/prompts/`
4. Reference specs: KIULI_CONTENT_SYSTEM_V6.md and KIULI_CONTENT_SYSTEM_DEVELOPMENT_PLAN_V4.md (in Claude.ai project files)
5. Reference current state: KIULI_PROJECT_STATE_FEB10.md (in Claude.ai project files)

The strategist (Claude.ai) writes prompts into content-engine/prompts/ and reads reports from content-engine/reports/. The tactician (Claude CLI) executes prompts and writes reports.
