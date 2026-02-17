# Phase 12 Verification: Staleness → page_update Code Path

**Context:** Phase 12 consistency checking is deployed. Every feature works EXCEPT Step 5b of consistency-checker.ts — the code that creates `page_update` projects when staleness issues are detected. This code compiled and deployed but has never executed at runtime. This prompt proves it works.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Follow the task order exactly.**
2. **All output must be raw data** — SQL output, script output, error messages.
3. **If any gate fails, STOP.**
4. **Append your report to** `content-engine/reports/phase12-consistency-checking.md` under a new heading `## Phase 12 Verification: Staleness Code Path`.

---

## Background

Step 5b in `content-system/quality/consistency-checker.ts` does two things when staleness issues exist:

1. **Dedup check:** Queries `content-projects` for existing `page_update` projects whose title contains the first 50 chars of `stale.sourceRecord`, excluding published/rejected/filtered.
2. **Create:** If no duplicate found, creates a `page_update` project with fields: `title`, `contentType: 'page_update'`, `stage: 'proposed'`, `processingStatus: 'idle'`, `originPathway: 'cascade'`, `briefSummary`.

These are the exact Payload API calls that need runtime verification. The LLM deciding whether something is staleness is a separate concern — that was already proven by the first run of project 53 (documented in the Phase 12 report: 3 staleness issues detected).

---

## Task 1: Write Integration Test Script

Create `content-engine/scripts/test-staleness-page-update.ts`.

This script exercises the EXACT same Payload operations that Step 5b performs. It does not call the LLM. It does not call `checkConsistency`. It directly tests the database create and dedup logic.

```typescript
/**
 * Integration test for Step 5b of consistency-checker.ts
 * Tests: page_update project creation and deduplication
 * 
 * Uses the same Payload API calls as Step 5b.
 * Does NOT involve the LLM — tests database operations only.
 * 
 * Run: npx tsx content-engine/scripts/test-staleness-page-update.ts
 */

import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function run() {
  const payload = await getPayload({ config: configPromise })

  // ── Synthetic staleness issue (same shape as consistency-checker produces) ──
  const syntheticStale = {
    issueType: 'staleness' as const,
    existingContent: 'The lodge has 12 rooms and was built in 2010',
    newContent: 'After 2024 renovations, the lodge now features 20 suites',
    sourceRecord: 'TEST-STALENESS: Integration test for Step 5b verification',
    resolution: 'pending' as const,
  }

  const titlePrefix = `Update: ${syntheticStale.sourceRecord}`.slice(0, 200)

  console.log('=== Step 5b Integration Test ===\n')

  // ── Test 1: Create page_update project ──────────────────────────────────

  console.log('TEST 1: Create page_update project')

  let createdId: number | null = null
  try {
    const created = await payload.create({
      collection: 'content-projects',
      data: {
        title: titlePrefix,
        contentType: 'page_update',
        stage: 'proposed',
        processingStatus: 'idle',
        originPathway: 'cascade',
        briefSummary: `[Staleness from project 9999] Existing content may be outdated. New content states: "${syntheticStale.newContent}". Existing content: "${syntheticStale.existingContent}". Source: ${syntheticStale.sourceRecord}.`,
      },
    })
    createdId = created.id as number
    console.log(`  PASS: Created project ID ${createdId}`)
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  // ── Test 2: Verify created project has correct fields ───────────────────

  console.log('\nTEST 2: Verify fields')

  try {
    const fetched = await payload.findByID({
      collection: 'content-projects',
      id: createdId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    const checks = [
      { field: 'contentType', expected: 'page_update', actual: fetched.contentType },
      { field: 'stage', expected: 'proposed', actual: fetched.stage },
      { field: 'processingStatus', expected: 'idle', actual: fetched.processingStatus },
      { field: 'originPathway', expected: 'cascade', actual: fetched.originPathway },
    ]

    let allPass = true
    for (const check of checks) {
      if (check.actual === check.expected) {
        console.log(`  PASS: ${check.field} = '${check.actual}'`)
      } else {
        console.log(`  FAIL: ${check.field} expected '${check.expected}', got '${check.actual}'`)
        allPass = false
      }
    }

    // briefSummary should contain the staleness context
    const briefSummary = fetched.briefSummary as string
    if (briefSummary && briefSummary.includes('Staleness from project') && briefSummary.includes(syntheticStale.newContent)) {
      console.log(`  PASS: briefSummary contains staleness context (${briefSummary.length} chars)`)
    } else {
      console.log(`  FAIL: briefSummary missing or doesn't contain expected text`)
      allPass = false
    }

    if (!allPass) {
      console.log('\n  FAIL: Field verification failed')
      // Clean up before exit
      await payload.delete({ collection: 'content-projects', id: createdId })
      process.exit(1)
    }
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    await payload.delete({ collection: 'content-projects', id: createdId })
    process.exit(1)
  }

  // ── Test 3: Dedup query finds the existing project ──────────────────────

  console.log('\nTEST 3: Dedup query')

  try {
    // This is the EXACT same query Step 5b uses
    const existing = await payload.find({
      collection: 'content-projects',
      where: {
        contentType: { equals: 'page_update' },
        stage: { not_in: ['published', 'rejected', 'filtered'] },
        title: { contains: syntheticStale.sourceRecord.slice(0, 50) },
      },
      limit: 1,
    })

    if (existing.docs.length > 0 && (existing.docs[0] as Record<string, unknown>).id === createdId) {
      console.log(`  PASS: Dedup query found project ID ${createdId}`)
    } else if (existing.docs.length > 0) {
      console.log(`  FAIL: Dedup query found wrong project: ID ${(existing.docs[0] as Record<string, unknown>).id}`)
      await payload.delete({ collection: 'content-projects', id: createdId })
      process.exit(1)
    } else {
      console.log(`  FAIL: Dedup query returned 0 results — Step 5b would create a duplicate`)
      await payload.delete({ collection: 'content-projects', id: createdId })
      process.exit(1)
    }
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    await payload.delete({ collection: 'content-projects', id: createdId })
    process.exit(1)
  }

  // ── Test 4: Dedup prevents duplicate creation ───────────────────────────

  console.log('\nTEST 4: Dedup prevents duplicate')

  try {
    // Simulate Step 5b running again with the same staleness issue
    const existingCheck = await payload.find({
      collection: 'content-projects',
      where: {
        contentType: { equals: 'page_update' },
        stage: { not_in: ['published', 'rejected', 'filtered'] },
        title: { contains: syntheticStale.sourceRecord.slice(0, 50) },
      },
      limit: 1,
    })

    if (existingCheck.docs.length > 0) {
      console.log(`  PASS: Dedup found existing project — would NOT create duplicate`)
    } else {
      console.log(`  FAIL: Dedup returned 0 — would incorrectly create duplicate`)
      await payload.delete({ collection: 'content-projects', id: createdId })
      process.exit(1)
    }
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    await payload.delete({ collection: 'content-projects', id: createdId })
    process.exit(1)
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  console.log('\nCLEANUP:')

  try {
    await payload.delete({ collection: 'content-projects', id: createdId })
    console.log(`  Deleted test project ID ${createdId}`)
  } catch (error) {
    console.log(`  WARNING: Failed to delete test project ${createdId}: ${error instanceof Error ? error.message : String(error)}`)
  }

  // ── Verify cleanup ─────────────────────────────────────────────────────

  console.log('\nVERIFY CLEANUP:')
  try {
    await payload.findByID({ collection: 'content-projects', id: createdId })
    console.log(`  FAIL: Project ${createdId} still exists after delete`)
    process.exit(1)
  } catch {
    console.log(`  PASS: Project ${createdId} confirmed deleted`)
  }

  console.log('\n=== ALL TESTS PASS ===')
  process.exit(0)
}

run().catch((error) => {
  console.error(`FATAL: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
```

Write this file EXACTLY as shown. Do not modify, simplify, or "improve" it.

**Verification:** Read the file back and confirm it matches.

---

## Task 2: Run the Script

```bash
cd ~/Projects/kiuli-website
npx tsx content-engine/scripts/test-staleness-page-update.ts
```

Record the COMPLETE output.

### Gate 1: All 4 Tests Pass

```
PASS criteria: Script outputs "ALL TESTS PASS" and exits with code 0.
FAIL action: STOP. Record the exact error output.
```

---

## Task 3: Verify Database is Clean

```sql
SELECT id, title, content_type, stage FROM content_projects WHERE title LIKE '%TEST-STALENESS%';
```

### Gate 2: Zero Rows

```
PASS criteria: Query returns 0 rows (test data was cleaned up).
FAIL action: STOP.
```

---

## Task 4: Verify No Collateral Damage

```sql
SELECT id, stage, content_type, consistency_check_result, processing_status
FROM content_projects
WHERE id IN (27, 53, 79, 87, 89)
ORDER BY id;
```

### Gate 3: Unchanged

```
PASS criteria: All 5 projects have the same state as the Phase 12 Completion final state:
  27: draft, itinerary_cluster, soft_contradiction, completed
  53: draft, itinerary_cluster, pass, completed
  79: draft, authority, pass, completed
  87: draft, authority, pass, completed
  89: draft, itinerary_cluster, pass, completed

FAIL action: STOP.
```

---

## Report Format

Append to `content-engine/reports/phase12-consistency-checking.md`:

```markdown
## Phase 12 Verification: Staleness Code Path

**Date:** [timestamp]

### Script Output
[Complete terminal output from Task 2]

### Gate 1: [PASS/FAIL]

### Database Clean
[Query output from Task 3]

### Gate 2: [PASS/FAIL]

### Collateral Check
[Query output from Task 4]

### Gate 3: [PASS/FAIL]

### Verification Result: [ALL GATES PASS / BLOCKED AT GATE N]
```

---

## DO NOT

- Do not modify consistency-checker.ts
- Do not modify any API routes or server actions
- Do not run consistency checks on any project
- Do not call the LLM
- Do not modify the test script
- Do not skip any gate check

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.** Do not attempt repairs.
