# Phase 13 Cleanup: Migration Safety, Optimistic Lock Fix, Debris Removal

**Context:** Phase 13 gates all passed. Three issues need resolution before Phase 14.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Follow the task order exactly.**
2. **All output must be raw evidence** — SQL results, file diffs, build output.
3. **If any gate fails, STOP.**
4. **Append to** `content-engine/reports/phase13-publishing-pipeline.md`.
5. **Do not skip any step.**

---

## Problem 1: Destructive Migration

`src/migrations/20260218_fix_posts_faq_items_id_types.ts` is registered in `src/migrations/index.ts` but NOT recorded in `payload_migrations`. The schema fixes were applied via direct SQL during debugging.

On the next `npx payload migrate`, Payload will try to run it. This line is destructive:

```sql
ALTER TABLE "_posts_v_version_faq_items" ALTER COLUMN "id" SET DATA TYPE integer USING 0;
```

The column is already `integer`. There are 12 rows with valid IDs. `USING 0` sets every row's ID to 0. Primary key violation. Migration fails. **All future migrations blocked.**

The fix is NOT to insert a row into `payload_migrations`. That's a lie — it hides the problem. The fix is to make the migration idempotent: check current column types before altering, skip steps that are already in the correct state.

## Problem 2: Broken Optimistic Lock

**Property publisher** — both branches of the conflict check do the exact same thing:

```typescript
if ((freshProp.updatedAt as string) !== baselineUpdatedAt) {
    console.warn(`...retrying`)
    await payload.update({ collection: 'properties', id: propertyId, data: updateData })
} else {
    await payload.update({ collection: 'properties', id: propertyId, data: updateData })
}
```

This is cosmetic code. The "retry" writes blindly without re-verifying.

**Destination publisher** — the retry path writes without verifying the fresh baseline:

```typescript
// Reads retryDest, gets retryUpdatedAt
// Immediately writes WITHOUT checking retryUpdatedAt is still current
await payload.update({ collection: 'destinations', id: destinationId, data: updateData })
// Then reads AFTER writing and checks if updatedAt matches — backwards
```

The V4 spec requires: "re-read, re-apply, re-write. If second conflict, surface error."

Correct pattern:
1. Read baseline (already done during setup)
2. Build update data
3. Right before write: re-read to verify baseline hasn't changed
4. If match → write
5. If mismatch (first conflict) → read fresh baseline, re-read to verify IT hasn't changed
6. If still stable → write
7. If changed again (second conflict) → throw error

## Problem 3: Debugging Debris in Production

Three diagnostic test posts exist in production:
- Post 14: "Diagnostic Test Post"
- Post 18: "Diag faq-empty 1771413109072"  
- Post 21: "Diag faq 1771413634536"

Related records: 2 FAQ items (post 21), 3 version records (IDs 14, 17, 20), 2 version FAQ items (version 20).

A 10KB debugging route exists: `src/app/(payload)/api/content/test-post-create/route.ts`

---

## PART A: Rewrite Migration to Be Idempotent

### Task 1: Replace migration file

Replace the ENTIRE contents of `src/migrations/20260218_fix_posts_faq_items_id_types.ts` with:

```typescript
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

/**
 * Fix posts_faq_items and related table ID column types.
 *
 * Payload CMS 3.76+ uses different ID strategies for main vs version array tables:
 * - Main tables (posts_faq_items, posts_populated_authors): varchar IDs (hex strings from Payload)
 * - Version tables (_posts_v_version_faq_items, _posts_v_version_populated_authors): serial (integer auto-increment)
 *
 * This migration is IDEMPOTENT: it checks current column types before altering.
 * Safe to run on fresh databases, already-applied databases, or partial states.
 */

async function getColumnType(
  db: MigrateUpArgs['db'],
  tableName: string,
  columnName: string,
): Promise<{ dataType: string; hasDefault: boolean }> {
  const result = await db.execute(sql`
    SELECT data_type, column_default
    FROM information_schema.columns
    WHERE table_name = ${tableName} AND column_name = ${columnName}
  `)
  const row = (result as any).rows?.[0]
  if (!row) throw new Error(`Column ${tableName}.${columnName} not found`)
  return {
    dataType: row.data_type,
    hasDefault: row.column_default !== null,
  }
}

async function ensureVarchar(
  db: MigrateUpArgs['db'],
  tableName: string,
): Promise<void> {
  const { dataType } = await getColumnType(db, tableName, 'id')
  if (dataType === 'character varying') {
    console.log(`  ${tableName}.id already varchar — skip`)
    return
  }
  console.log(`  ${tableName}.id is ${dataType} — converting to varchar`)
  await db.execute(sql.raw(`ALTER TABLE "${tableName}" ALTER COLUMN "id" DROP DEFAULT`))
  await db.execute(sql.raw(`ALTER TABLE "${tableName}" ALTER COLUMN "id" SET DATA TYPE varchar USING "id"::varchar`))
  await db.execute(sql.raw(`DROP SEQUENCE IF EXISTS "${tableName}_id_seq"`))
}

async function ensureSerial(
  db: MigrateUpArgs['db'],
  tableName: string,
): Promise<void> {
  const { dataType, hasDefault } = await getColumnType(db, tableName, 'id')
  if (dataType === 'integer' && hasDefault) {
    console.log(`  ${tableName}.id already integer with default — skip`)
    return
  }
  if (dataType !== 'integer') {
    console.log(`  ${tableName}.id is ${dataType} — converting to integer`)
    // Must handle existing varchar values: set to sequential integers
    // First, add a temp sequence
    const seqName = `${tableName}_id_seq`
    await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "${seqName}"`))
    await db.execute(sql.raw(`
      ALTER TABLE "${tableName}" ALTER COLUMN "id" SET DATA TYPE integer
      USING nextval('"${seqName}"')
    `))
    await db.execute(sql.raw(`ALTER SEQUENCE "${seqName}" OWNED BY "${tableName}"."id"`))
    await db.execute(sql.raw(`
      SELECT setval('"${seqName}"', COALESCE((SELECT MAX("id") FROM "${tableName}"), 0) + 1, false)
    `))
    await db.execute(sql.raw(`ALTER TABLE "${tableName}" ALTER COLUMN "id" SET DEFAULT nextval('"${seqName}"')`))
  } else {
    // Integer but no default — add the sequence
    console.log(`  ${tableName}.id is integer but missing default — adding sequence`)
    const seqName = `${tableName}_id_seq`
    await db.execute(sql.raw(`CREATE SEQUENCE IF NOT EXISTS "${seqName}" OWNED BY "${tableName}"."id"`))
    await db.execute(sql.raw(`
      SELECT setval('"${seqName}"', COALESCE((SELECT MAX("id") FROM "${tableName}"), 0) + 1, false)
    `))
    await db.execute(sql.raw(`ALTER TABLE "${tableName}" ALTER COLUMN "id" SET DEFAULT nextval('"${seqName}"')`))
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  console.log('Fixing posts array table ID types (idempotent)...')

  // Main tables: should be varchar
  console.log('Main tables → varchar:')
  await ensureVarchar(db, 'posts_faq_items')
  await ensureVarchar(db, 'posts_populated_authors')

  // Version tables: should be serial (integer + auto-increment)
  console.log('Version tables → serial:')
  await ensureSerial(db, '_posts_v_version_faq_items')
  await ensureSerial(db, '_posts_v_version_populated_authors')

  console.log('Done.')
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Revert: main tables back to serial, version tables back to varchar
  // (This is the pre-fix state, which was broken, but down() restores it)
  console.log('Reverting posts array table ID types...')

  // Main tables back to serial
  await ensureSerial(db, 'posts_faq_items')
  await ensureSerial(db, 'posts_populated_authors')

  // Version tables back to varchar
  await ensureVarchar(db, '_posts_v_version_faq_items')
  await ensureVarchar(db, '_posts_v_version_populated_authors')
}
```

**Verification:** Read it back. Confirm it uses `getColumnType` before every ALTER.

---

## PART B: Fix Optimistic Locking

### Task 2: Replace destination-page-publisher.ts optimistic lock section

In `content-system/publishing/destination-page-publisher.ts`, find the optimistic lock section (from `// Optimistic lock: re-read before write` to the closing of the else block that calls `payload.update`). Replace that entire section with:

```typescript
  // Optimistic lock: verify baseline before write
  const freshDest = await payload.findByID({
    collection: 'destinations',
    id: destinationId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((freshDest.updatedAt as string) !== baselineUpdatedAt) {
    // First conflict — retry once per V4 spec
    console.warn(`[destination-publisher] Conflict on destination ${destinationId}, retrying`)
    const retryBaseline = freshDest.updatedAt as string

    const retryCheck = await payload.findByID({
      collection: 'destinations',
      id: destinationId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    if ((retryCheck.updatedAt as string) !== retryBaseline) {
      throw new Error(
        `Optimistic lock failed after retry on destinations/${destinationId}: ` +
        `expected ${retryBaseline}, got ${retryCheck.updatedAt}`
      )
    }
    // Retry baseline stable — safe to write
  }

  await payload.update({
    collection: 'destinations',
    id: destinationId,
    data: updateData,
  })
```

**Key change:** Both paths (no conflict AND successful retry) fall through to the single `payload.update()` call. The only path that doesn't write is if the retry also detects a conflict, which throws. Remove the `OptimisticLockError` import if it was only used in the old code.

**Verification:** Read the file back. Confirm:
1. There is exactly ONE `payload.update()` call for the destination write (at the bottom, not inside if/else)
2. The retry reads twice and verifies before falling through
3. Second conflict throws with both expected and actual updatedAt values

### Task 3: Replace property-page-publisher.ts optimistic lock section

In `content-system/publishing/property-page-publisher.ts`, find the optimistic lock section (from `// Optimistic lock` to the closing of the else block). Replace with:

```typescript
  // Optimistic lock: verify baseline before write
  const freshProp = await payload.findByID({
    collection: 'properties',
    id: propertyId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((freshProp.updatedAt as string) !== baselineUpdatedAt) {
    // First conflict — retry once per V4 spec
    console.warn(`[property-publisher] Conflict on property ${propertyId}, retrying`)
    const retryBaseline = freshProp.updatedAt as string

    const retryCheck = await payload.findByID({
      collection: 'properties',
      id: propertyId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    if ((retryCheck.updatedAt as string) !== retryBaseline) {
      throw new Error(
        `Optimistic lock failed after retry on properties/${propertyId}: ` +
        `expected ${retryBaseline}, got ${retryCheck.updatedAt}`
      )
    }
    // Retry baseline stable — safe to write
  }

  await payload.update({
    collection: 'properties',
    id: propertyId,
    data: updateData,
  })
```

Remove the `OptimisticLockError` import if it becomes unused.

**Verification:** Read the file back. Same 3 checks as Task 2.

---

## PART C: Remove Debugging Debris

### Task 4: Delete diagnostic test posts via script

Create and run `content-engine/scripts/cleanup-test-posts.ts`:

```typescript
/**
 * Remove diagnostic test posts created during Phase 13 debugging.
 * Posts 14, 18, 21 are test artifacts. Post 22 is the real published article.
 *
 * Payload's delete cascades to:
 * - posts_faq_items (FK _parent_id)
 * - _posts_v (FK parent_id) → cascades to _posts_v_version_faq_items, _posts_v_version_populated_authors
 * - posts_rels, posts_populated_authors
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const TEST_POST_IDS = [14, 18, 21]

async function run() {
  const payload = await getPayload({ config: configPromise })

  console.log('=== Cleanup Diagnostic Test Posts ===\n')

  // Verify these are actually test posts before deleting
  for (const id of TEST_POST_IDS) {
    try {
      const post = await payload.findByID({ collection: 'posts', id, depth: 0 }) as any
      const title = post.title as string
      if (!title.startsWith('Diag') && title !== 'Diagnostic Test Post') {
        console.log(`ABORT: Post ${id} title "${title}" does not look like a test post`)
        process.exit(1)
      }
      console.log(`Post ${id}: "${title}" — confirmed test post`)
    } catch {
      console.log(`Post ${id}: not found (already deleted) — skip`)
    }
  }

  console.log('')

  // Delete via Payload (handles cascade)
  for (const id of TEST_POST_IDS) {
    try {
      await payload.delete({ collection: 'posts', id })
      console.log(`Deleted post ${id}`)
    } catch {
      console.log(`Post ${id}: delete failed or not found — skip`)
    }
  }

  console.log('\nVerification:')

  // Verify posts gone
  const remaining = await payload.find({
    collection: 'posts',
    where: { id: { in: TEST_POST_IDS } },
    depth: 0,
  })
  console.log(`Posts remaining with test IDs: ${remaining.docs.length} (expected 0)`)

  // Verify post 22 still exists
  try {
    const post22 = await payload.findByID({ collection: 'posts', id: 22, depth: 0 }) as any
    console.log(`Post 22 ("${(post22.title as string).slice(0, 50)}...") still exists — GOOD`)
  } catch {
    console.log('CRITICAL: Post 22 is missing!')
    process.exit(1)
  }

  // Count remaining posts
  const allPosts = await payload.find({ collection: 'posts', limit: 100, depth: 0 })
  console.log(`Total posts in collection: ${allPosts.docs.length}`)

  console.log('\n=== CLEANUP COMPLETE ===')
  process.exit(0)
}

run().catch(e => { console.error(`FATAL: ${e.message}`); process.exit(1) })
```

```bash
npx tsx content-engine/scripts/cleanup-test-posts.ts
```

**Expected output:** 3 posts deleted, post 22 confirmed safe, total posts = 1.

### Task 5: Delete test-post-create route

```bash
rm -rf src/app/\(payload\)/api/content/test-post-create/
```

Verify:

```bash
ls src/app/\(payload\)/api/content/test-post-create/ 2>&1
```

Should say "No such file or directory".

---

## PART D: Build and Verify Migrations

### Task 6: Build

```bash
npm run build 2>&1 | tail -50
```

### Gate 1: Build Passes

```
PASS criteria: Exit code 0.
FAIL action: STOP.
```

### Task 7: Run migrations

This is the critical test. The idempotent migration must handle the "already applied" state:

```bash
npx payload migrate 2>&1
```

### Gate 2: Migration Runs Clean

```
PASS criteria:
1. Exit code 0
2. Output shows "already varchar — skip" for main tables
3. Output shows "already integer with default — skip" for version tables
4. No errors, no data loss

FAIL action: STOP.
```

### Task 8: Verify database state after migration

```sql
-- posts_faq_items.id should be varchar, no default
SELECT data_type, column_default
FROM information_schema.columns
WHERE table_name = 'posts_faq_items' AND column_name = 'id';

-- _posts_v_version_faq_items.id should be integer with sequence default
SELECT data_type, column_default
FROM information_schema.columns
WHERE table_name = '_posts_v_version_faq_items' AND column_name = 'id';

-- Post 22 still has 10 FAQ items
SELECT COUNT(*) FROM posts_faq_items WHERE _parent_id = 22;

-- Version FAQ items still intact
SELECT COUNT(*) FROM _posts_v_version_faq_items;

-- Test posts are gone
SELECT COUNT(*) FROM posts WHERE id IN (14, 18, 21);

-- Only post 22 remains
SELECT id, title FROM posts;
```

### Gate 3: Database Integrity

```
PASS criteria (ALL must be true):
1. posts_faq_items.id = character varying, no default
2. _posts_v_version_faq_items.id = integer, has nextval default
3. Post 22 has 10 FAQ items
4. Version FAQ items exist (count > 0)
5. Test posts deleted (count = 0)
6. Only post 22 in posts table

FAIL action: STOP.
```

---

## PART E: Commit and Push

### Task 9: Stage and commit

```bash
git add src/migrations/20260218_fix_posts_faq_items_id_types.ts
git add content-system/publishing/destination-page-publisher.ts
git add content-system/publishing/property-page-publisher.ts
git add content-engine/scripts/cleanup-test-posts.ts
git add content-engine/reports/phase13-publishing-pipeline.md
```

Also stage the deletion:
```bash
git rm -r src/app/\(payload\)/api/content/test-post-create/ 2>/dev/null || true
```

Stage any regenerated files:
```bash
git add src/payload-types.ts 2>/dev/null || true
git add "src/app/(payload)/importMap.js" 2>/dev/null || true
```

```bash
git commit -m "fix: Phase 13 cleanup — idempotent migration, correct optimistic locking, remove test debris"
git push
```

### Gate 4: Committed and Pushed

```
PASS criteria: Push succeeded, clean working tree.
FAIL action: STOP.
```

---

## Report Appendix Format

Append to `content-engine/reports/phase13-publishing-pipeline.md`:

```markdown
---

## Phase 13 Cleanup — [date]

### PART A: Idempotent Migration
[Confirmation that getColumnType checks exist, migration file contents verified]

### PART B: Optimistic Lock Fix
[Destination publisher: single update call, retry verified]
[Property publisher: single update call, retry verified]

### PART C: Debris Removal
[Cleanup script output, test route deletion confirmed]

### PART D: Build + Migration Verification
#### Gate 1: [PASS/FAIL] — Build
#### Gate 2: [PASS/FAIL] — Migration idempotent run
#### Gate 3: [PASS/FAIL] — Database integrity (6-point checklist)

### PART E: Commit
#### Gate 4: [PASS/FAIL] — Push
[Commit hash, file list]
```

---

## DO NOT

- Do not modify the article publisher (it's correct)
- Do not modify the enhancement or update publishers (their simpler pattern is acceptable)
- Do not modify any collection schemas
- Do not delete post 22 or modify project 79
- Do not create new API routes
- Do not modify the publish route or triggerPublish action

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.** Do not attempt repairs.
