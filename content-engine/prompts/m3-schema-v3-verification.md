# Schema v3.0 Post-Migration Verification

**Date:** 2026-02-23
**Author:** Claude (Strategic)
**Recipient:** Claude Code (Tactical)
**Scope:** Verification only — no code changes, no file edits

---

## Context

CLI ran a database migration and touched `destination-resolver.ts` during the schema
v3.0 task, both outside the scope of that prompt. This prompt verifies the actual
database state and the current content of the modified file before any further work
proceeds.

Do not fix anything in this task. Read and report only.

---

## Task 1: Database Verification

Run these SQL queries using the Kiuli MCP db_query tool and report the exact output
of each one.

### Query 1: New tables
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('airports', 'service_items', 'location_mappings', 'location_mappings_mappings')
ORDER BY table_name;
```
Expected: 4 rows.

### Query 2: Activities booking_behaviour columns
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'activities' AND column_name LIKE '%booking%'
ORDER BY column_name;
```
Expected: 4 or more rows (one per field in the bookingBehaviour group).

### Query 3: TransferRoutes airport FK columns
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'transfer_routes'
AND column_name IN ('from_airport_id', 'to_airport_id');
```
Expected: 2 rows.

### Query 4: Activities data integrity
```sql
SELECT id, name, type FROM activities ORDER BY id;
```
Expected: id=12, name='Serengeti Balloon Safari', type='balloon_flight'. No other rows.

### Query 5: Migration record
```sql
SELECT name, batch, executed_at FROM payload_migrations ORDER BY executed_at DESC LIMIT 5;
```
Report all rows returned — this shows what migrations ran and when.

### Query 6: Properties seasonalityData columns
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'properties' AND column_name LIKE '%seasonality%'
ORDER BY column_name;
```
Expected: 1 or more rows.

### Query 7: ItineraryPatterns new relation tables
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'itinerary_patterns%'
ORDER BY table_name;
```
Report all rows — we need to confirm `itinerary_patterns_rels` exists and that
`regions` and `service_items` relationship paths are present.

---

## Task 2: Read destination-resolver.ts

Read the full current content of:
```
content-system/cascade/destination-resolver.ts
```

Report the entire file content. Do not summarise. Do not paraphrase.

---

## Task 3: Read the migration file

Find the migration file that was generated and run during the schema v3.0 task:
```bash
ls -la src/migrations/ | sort
```

Report the filenames. Then read the most recent migration file (the one with the
highest timestamp) and report its full content.

---

## Completion Report

Report in this exact format. Paste the raw query output — do not interpret or
summarise it.

```
SCHEMA V3.0 VERIFICATION REPORT
Date: [ISO timestamp]

QUERY 1 — New tables:
[paste raw output]

QUERY 2 — Activities booking_behaviour columns:
[paste raw output]

QUERY 3 — TransferRoutes airport columns:
[paste raw output]

QUERY 4 — Activities data integrity:
[paste raw output]

QUERY 5 — Migration history:
[paste raw output]

QUERY 6 — Properties seasonalityData columns:
[paste raw output]

QUERY 7 — ItineraryPatterns relation tables:
[paste raw output]

DESTINATION-RESOLVER.TS CURRENT CONTENT:
[paste full file content]

MIGRATION FILE:
Filename: [filename]
Content: [paste full file content]

BLOCKERS
[Any queries that failed to run and why]
```

---

## Constraints

1. Read and report only. No code changes. No file edits. No fixes.
2. Paste raw output. Do not interpret, summarise, or selectively report.
3. If a query fails, report the exact error and continue to the next query.
4. If destination-resolver.ts does not exist at that path, report that exactly.
