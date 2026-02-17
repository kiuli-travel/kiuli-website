# Phase 13: Corrections and Completion

**Context:** Phase 13 publishing pipeline code was partially written by a previous CLI session. All publisher files, the publish route, the triggerPublish action, text-to-lexical utility, Destinations.ts field additions, and migration file are written but NOT committed. The migration has NOT been run. There is one blocking bug and the build/test/commit cycle has not been executed.

**Strategist:** Claude.ai (Graham's project)
**Tactician:** You (Claude CLI)

---

## Rules

1. **Follow the task order exactly.**
2. **All output must be raw evidence** — SQL results, curl responses, file contents.
3. **If any gate fails, STOP.**
4. **Create report at** `content-engine/reports/phase13-publishing-pipeline.md`.
5. **Do not skip any step.**
6. **Do not re-write files that already exist unless a task explicitly says to.**

---

## PART A: Fix Blocking Bug — Posts heroImage

### Problem

`src/collections/Posts/index.ts` has `heroImage` with `required: true`. The article publisher creates posts with `_status: 'published'` but no heroImage (images come in Phase 14). Payload enforces required fields when `_status: 'published'` on collections with `drafts: true`. The `payload.create()` call will fail with a validation error.

Image presence should be enforced by quality gates (Phase 15), not by schema constraints. This is architecturally correct — content should flow through the pipeline without being blocked by missing images.

### Task 1: Remove required from Posts heroImage

In `src/collections/Posts/index.ts`, find the heroImage field and remove `required: true`. Change the admin description to remove "(required)".

Before:
```typescript
{
  name: 'heroImage',
  type: 'upload',
  relationTo: 'media',
  required: true,
  admin: {
    description: 'Featured image for the article (required)',
  },
},
```

After:
```typescript
{
  name: 'heroImage',
  type: 'upload',
  relationTo: 'media',
  admin: {
    description: 'Featured image for the article',
  },
},
```

**Verification:** Read Posts/index.ts. Confirm heroImage no longer has `required: true`.

---

## PART B: Run Migration

### Task 2: Verify migration file and registration exist

```bash
cat src/migrations/20260217_add_destination_content_fields.ts
grep "destination_content_fields" src/migrations/index.ts
```

Both should exist from the previous CLI session.

### Task 3: Run migration

```bash
cd ~/Projects/kiuli-website
npx payload migrate 2>&1
```

Record the full output.

### Gate 1: Migration Applied

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'destinations'
AND column_name IN ('why_choose', 'key_experiences', 'getting_there', 'health_safety', 'investment_expectation', 'top_lodges_content')
ORDER BY column_name;
```

```
PASS criteria: 6 rows returned.
FAIL action: STOP.
```

Also verify version table:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = '_destinations_v'
AND column_name IN ('version_why_choose', 'version_key_experiences', 'version_getting_there', 'version_health_safety', 'version_investment_expectation', 'version_top_lodges_content')
ORDER BY column_name;
```

```
PASS criteria: 6 rows returned.
FAIL action: STOP.
```

---

## PART C: Verify Existing Code

The previous CLI session wrote all publisher files, the publish route, triggerPublish action, and text-to-lexical. Do NOT rewrite these. Verify they exist:

### Task 4: Verify all files exist

Check each of these files exists and is non-empty:

```bash
wc -l content-system/publishing/text-to-lexical.ts
wc -l content-system/publishing/types.ts
wc -l content-system/publishing/article-publisher.ts
wc -l content-system/publishing/destination-page-publisher.ts
wc -l content-system/publishing/property-page-publisher.ts
wc -l content-system/publishing/enhancement-publisher.ts
wc -l content-system/publishing/update-publisher.ts
wc -l src/app/\(payload\)/api/content/publish/route.ts
```

And verify triggerPublish exists in actions.ts:

```bash
grep -n "triggerPublish" src/app/\(payload\)/admin/content-engine/project/\[id\]/actions.ts
```

**All files should exist with real content (not stubs).** If any file is missing or is a stub (contains `declare function`), STOP and report.

---

## PART D: Build

### Task 5: Build

```bash
npm run build 2>&1 | tail -80
```

If the build fails due to type errors:
- Fix the specific type errors
- Record what was wrong and what was changed
- Re-run build

**Do NOT modify any business logic.** Only fix TypeScript type issues if needed.

### Gate 2: Build Passes

```
PASS criteria: Exit code 0.
FAIL action: Fix type errors only (no logic changes), rebuild. If still fails, STOP.
```

---

## PART E: Commit and Push

### Task 6: Stage all Phase 13 files

```bash
git add src/collections/Posts/index.ts
git add src/collections/Destinations.ts
git add src/migrations/20260217_add_destination_content_fields.ts
git add src/migrations/index.ts
git add content-system/publishing/text-to-lexical.ts
git add content-system/publishing/types.ts
git add content-system/publishing/article-publisher.ts
git add content-system/publishing/destination-page-publisher.ts
git add content-system/publishing/property-page-publisher.ts
git add content-system/publishing/enhancement-publisher.ts
git add content-system/publishing/update-publisher.ts
git add src/app/\(payload\)/api/content/publish/route.ts
git add src/app/\(payload\)/admin/content-engine/project/\[id\]/actions.ts
```

Also stage any regenerated files (payload-types.ts, importMap.js) if they changed:

```bash
git add src/payload-types.ts 2>/dev/null || true
git add "src/app/(payload)/importMap.js" 2>/dev/null || true
```

Also stage the Phase 12 report and scripts that were left uncommitted:

```bash
git add content-engine/reports/phase12-consistency-checking.md 2>/dev/null || true
git add content-engine/scripts/ 2>/dev/null || true
```

Also stage this prompt:

```bash
git add content-engine/prompts/phase13-publishing-pipeline.md
git add content-engine/prompts/phase13-corrections-and-completion.md
```

### Task 7: Commit and Push

```bash
git commit -m "feat: Phase 13 — publishing pipeline with 5 publishers, optimistic locking, schema migration, text-to-Lexical, publish route, triggerPublish action"
git push
```

### Gate 3: Committed and Pushed

```
PASS criteria: Push succeeded, clean working tree.
FAIL action: STOP.
```

---

## PART F: Functional Test — Publish One Article

### Task 8: Wait for deploy and set up auth

Wait 90 seconds for Vercel deploy.

```bash
sleep 90
```

Set up the auth token:

```bash
export CONTENT_SYSTEM_SECRET=$(grep CONTENT_SYSTEM_SECRET .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
echo "Token length: ${#CONTENT_SYSTEM_SECRET}"
```

If token is empty, check `.env.local` for the correct variable name.

### Task 9: Check project 79 current state

```sql
SELECT id, title, stage, content_type, processing_status, consistency_check_result
FROM content_projects WHERE id = 79;
```

Project 79 should be at `draft` stage. If it's already at `review` or `published`, pick a different draft article. Other candidates: project 87 or project 89.

Record which project ID you're using for the test.

### Task 10: Advance to review

The batch route requires Payload session auth (cookie) or check if it also accepts Bearer. Try Bearer first:

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST https://kiuli.com/api/content/dashboard/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"action":"advance","projectIds":[79]}'
```

If this returns 401 or doesn't advance, use the publish route directly (Task 12) which accepts Bearer auth.

Record the response.

### Task 11: Verify review state and consistency check

Wait 5 seconds for consistency check auto-trigger, then query:

```sql
SELECT id, stage, processing_status, consistency_check_result
FROM content_projects WHERE id = 79;
```

If `processing_status` is still `processing`, wait 10 more seconds and re-query. The consistency check calls the LLM which can take 5-15 seconds.

**Required state before publish:** `stage = 'review'` AND (`consistency_check_result` is NOT `hard_contradiction` OR all hard issues resolved).

If the batch route couldn't advance the project, you can set the stage directly for testing:

```bash
curl -s -w "\nHTTP %{http_code}\n" -X PATCH "https://kiuli.com/api/content-projects/79" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"stage":"review"}'
```

If that also doesn't work (auth issue), use the local Payload API via script. Create and run a one-off script:

```typescript
// content-engine/scripts/advance-to-review.ts
import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function run() {
  const payload = await getPayload({ config: configPromise })
  await payload.update({
    collection: 'content-projects',
    id: 79,
    data: { stage: 'review', processingStatus: 'completed' },
  })
  console.log('Project 79 advanced to review')
  const project = await payload.findByID({ collection: 'content-projects', id: 79, depth: 0 })
  console.log('Stage:', (project as any).stage)
  process.exit(0)
}
run().catch(e => { console.error(e); process.exit(1) })
```

```bash
npx tsx content-engine/scripts/advance-to-review.ts
```

### Task 12: Publish

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST https://kiuli.com/api/content/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 79}'
```

Record the full response.

If the publish route returns an error, record the error and try the local approach:

```typescript
// content-engine/scripts/test-publish.ts
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { publishArticle } from '../../content-system/publishing/article-publisher'

async function run() {
  const payload = await getPayload({ config: configPromise })

  // Ensure project is in review
  const project = await payload.findByID({ collection: 'content-projects', id: 79, depth: 0 }) as any
  console.log('Project 79 stage:', project.stage, 'type:', project.contentType)

  if (project.stage !== 'review' && project.stage !== 'draft') {
    console.log('Project not in review or draft stage, cannot test publish')
    process.exit(1)
  }

  // If still in draft, advance to review first
  if (project.stage === 'draft') {
    await payload.update({
      collection: 'content-projects',
      id: 79,
      data: { stage: 'review' },
    })
    console.log('Advanced to review')
  }

  console.log('Publishing...')
  const result = await publishArticle(79)
  console.log('Publish result:', JSON.stringify(result, null, 2))

  // Update project
  await payload.update({
    collection: 'content-projects',
    id: 79,
    data: {
      stage: 'published',
      publishedAt: result.publishedAt,
      processingStatus: 'completed',
    },
  })
  console.log('Project 79 marked as published')

  process.exit(0)
}
run().catch(e => { console.error(e.message); process.exit(1) })
```

```bash
npx tsx content-engine/scripts/test-publish.ts
```

### Task 13: Verify in database

```sql
-- Project 79 should be published
SELECT id, stage, published_at, processing_status
FROM content_projects WHERE id = 79;

-- A new post should exist
SELECT id, title, slug, _status, published_at, meta_title,
       LEFT(content::text, 200) as content_preview
FROM posts ORDER BY id;

-- Post should have FAQ items
SELECT p.id, p.title, COUNT(f.id) as faq_count
FROM posts p
LEFT JOIN posts_faq_items f ON f._parent_id = p.id
GROUP BY p.id, p.title;

-- Check specific FAQ items
SELECT f._parent_id, f.question, LEFT(f.answer::text, 100) as answer_preview
FROM posts_faq_items f ORDER BY f._parent_id, f._order;
```

### Gate 4: Article Published

```
PASS criteria (ALL must be true):
1. Project 79: stage = 'published', processing_status = 'completed', published_at IS NOT NULL
2. A post exists in the posts table with project 79's title
3. Post _status = 'published'
4. Post content is not null/empty
5. Post has at least 1 FAQ item
6. Post FAQ items have answer in Lexical format (jsonb with root.type = 'root')
7. Post meta_title matches project 79's meta_title

FAIL action: STOP and report.
```

---

## PART G: Integration Test — Destination Publisher

### Task 14: Test destination field writes

Create and run `content-engine/scripts/test-destination-publisher.ts`:

```typescript
/**
 * Integration test for destination-page-publisher DB operations.
 * Tests textToLexical and Payload write/read on the 6 new destination fields.
 * Does NOT require a content project — tests DB operations directly.
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { textToLexical } from '../../content-system/publishing/text-to-lexical'

async function run() {
  const payload = await getPayload({ config: configPromise })
  console.log('=== Destination Publisher Integration Test ===\n')

  // Find a real destination
  const dests = await payload.find({
    collection: 'destinations',
    where: { type: { equals: 'destination' } },
    limit: 1,
    depth: 0,
  })

  if (dests.docs.length === 0) {
    console.log('SKIP: No destinations in database')
    process.exit(0)
  }

  const dest = dests.docs[0] as unknown as Record<string, unknown>
  const destId = dest.id as number
  console.log(`Testing against: ${dest.name} (ID ${destId})\n`)

  // TEST 1: textToLexical
  console.log('TEST 1: textToLexical produces valid Lexical JSON')
  const lexical = textToLexical('First paragraph.\n\nSecond paragraph.\n\nThird.')
  const root = lexical.root as Record<string, unknown>
  const children = root.children as unknown[]
  if (root.type !== 'root') { console.log('  FAIL: root.type'); process.exit(1) }
  if (children.length !== 3) { console.log(`  FAIL: ${children.length} paragraphs, expected 3`); process.exit(1) }
  console.log('  PASS')

  // TEST 2: textToLexical empty input
  console.log('\nTEST 2: textToLexical handles empty input')
  const empty = textToLexical('')
  const emptyRoot = empty.root as Record<string, unknown>
  if ((emptyRoot.children as unknown[]).length !== 0) { console.log('  FAIL: non-empty children'); process.exit(1) }
  console.log('  PASS')

  // TEST 3: Write all 6 new fields
  console.log('\nTEST 3: Write 6 new richText fields to destination')
  const testContent = textToLexical('TEST — Phase 13 integration test. This will be cleaned up.')
  try {
    await payload.update({
      collection: 'destinations',
      id: destId,
      data: {
        whyChoose: testContent,
        keyExperiences: testContent,
        gettingThere: testContent,
        healthSafety: testContent,
        investmentExpectation: testContent,
        topLodgesContent: testContent,
      },
    })
    console.log('  PASS: All 6 fields written')
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  // TEST 4: Read back and verify Lexical structure
  console.log('\nTEST 4: Read back and verify Lexical structure')
  const updated = await payload.findByID({ collection: 'destinations', id: destId, depth: 0 }) as unknown as Record<string, unknown>
  const fields = ['whyChoose', 'keyExperiences', 'gettingThere', 'healthSafety', 'investmentExpectation', 'topLodgesContent']
  for (const field of fields) {
    const val = updated[field] as Record<string, unknown> | null
    if (!val || !val.root || (val.root as Record<string, unknown>).type !== 'root') {
      console.log(`  FAIL: ${field} is not valid Lexical`)
      process.exit(1)
    }
  }
  console.log('  PASS: All 6 fields contain valid Lexical JSON')

  // CLEANUP: Set new fields to null
  console.log('\nCLEANUP:')
  await payload.update({
    collection: 'destinations',
    id: destId,
    data: {
      whyChoose: null,
      keyExperiences: null,
      gettingThere: null,
      healthSafety: null,
      investmentExpectation: null,
      topLodgesContent: null,
    },
  })
  console.log('  Fields restored to null')

  // Verify cleanup
  const cleaned = await payload.findByID({ collection: 'destinations', id: destId, depth: 0 }) as unknown as Record<string, unknown>
  for (const field of fields) {
    if (cleaned[field] !== null && cleaned[field] !== undefined) {
      console.log(`  WARNING: ${field} not null after cleanup`)
    }
  }

  console.log('\n=== ALL TESTS PASS ===')
  process.exit(0)
}

run().catch(e => { console.error(`FATAL: ${e.message}`); process.exit(1) })
```

```bash
npx tsx content-engine/scripts/test-destination-publisher.ts
```

### Gate 5: Integration Test Passes

```
PASS criteria: Script exits 0 with "ALL TESTS PASS".
FAIL action: STOP.
```

---

## PART H: Final State

### Task 15: Record final state

```sql
-- All published projects
SELECT id, stage, content_type, published_at, processing_status
FROM content_projects WHERE stage = 'published' ORDER BY id;

-- All posts
SELECT id, title, slug, _status, published_at, meta_title
FROM posts ORDER BY id;

-- FAQ items per post
SELECT f._parent_id as post_id, f.question
FROM posts_faq_items f ORDER BY f._parent_id, f._order;

-- New destination columns exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'destinations'
AND column_name IN ('why_choose', 'key_experiences', 'getting_there', 'health_safety', 'investment_expectation', 'top_lodges_content')
ORDER BY column_name;

-- All draft projects still at draft (not accidentally advanced)
SELECT id, stage, content_type FROM content_projects
WHERE id IN (27, 53, 87, 89) ORDER BY id;
```

Record all outputs.

---

## Report Format

```markdown
# Phase 13: Publishing Pipeline — Report

**Date:** [timestamp]

## PART A: Posts heroImage Fix
### Task 1
[Before/after confirmation]

## PART B: Migration
### Tasks 2-3
[Verification, migration output]
### Gate 1: [PASS/FAIL]
[SQL evidence — 6 rows for destinations, 6 rows for _destinations_v]

## PART C: Code Verification
### Task 4
[Line counts, triggerPublish grep]

## PART D: Build
### Task 5
[Build output, exit code]
### Gate 2: [PASS/FAIL]

## PART E: Commit
### Tasks 6-7
[git output, commit hash]
### Gate 3: [PASS/FAIL]

## PART F: Functional Test
### Tasks 8-13
[All curl responses, SQL results]
### Gate 4: [PASS/FAIL]
[7-point checklist with evidence for each]

## PART G: Integration Test
### Task 14
[Script output]
### Gate 5: [PASS/FAIL]

## PART H: Final State
### Task 15
[All SQL outputs]

## Overall Phase 13: [ALL GATES PASS / BLOCKED AT GATE N]
```

---

## DO NOT

- Do not rewrite publisher files — they already exist from the previous CLI session
- Do not modify any collection schema other than Posts/index.ts (removing heroImage required)
- Do not create new collections
- Do not modify the consistency checker, conversation handler, or drafting pipeline
- Do not publish any project other than the chosen test project (79, 87, or 89)
- Do not advance projects 27 or 53 — leave them at their current stage
- Do not modify the migration file — it already exists and is correct

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.** Do not attempt repairs beyond type error fixes in Part D.
