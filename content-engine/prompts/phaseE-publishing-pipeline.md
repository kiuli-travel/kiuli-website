# Phase E: Publishing Pipeline Implementation

**Context:** Phases A-D complete. Quality gates and consistency checking are operational. The publishing pipeline is the bridge between ContentProjects and the public-facing collections (Posts, Destinations, Properties, Itineraries).

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Publishing must be gated.** Quality gates AND consistency check must pass before publish is allowed.
2. **Optimistic locking on all writes.** If the target record was modified between when we read it and when we publish, the publish MUST fail with a clear error.
3. **Every publisher must be tested against the production database.**
4. **Write report to `content-engine/reports/phaseE-publishing-pipeline.md`.**

---

## Architecture

Publishing transforms a ContentProject's draft content into a record in the target collection:

| Content Type | Source Fields | Target Collection | Target Fields |
|---|---|---|---|
| authority, itinerary_cluster, designer_insight | body, metaTitle, metaDescription, answerCapsule, faqSection, heroImage | Posts | content, meta.title, meta.description, answerCapsule, faqItems, heroImage |
| destination_page | sections, metaTitle, metaDescription, answerCapsule, faqSection | Destinations | description/bestTimeToVisit/faqItems + metaTitle, metaDescription, answerCapsule |
| property_page | sections, metaTitle, metaDescription, answerCapsule, faqSection | Properties | description_enhanced + metaTitle, metaDescription, answerCapsule, faqItems |
| itinerary_enhancement | body (enhanced segment text) | Itineraries (segment) | The specific segment's enhanced field |
| page_update | body (new field content) | Any collection | targetField on targetRecordId |

---

## Task 1: Implement Shared Publishing Utilities

Create `content-system/publishing/utils.ts`:

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { checkHardGates } from '../quality/hard-gates'
import { checkConsistency } from '../quality/consistency-checker'
import { extractTextFromLexical } from '../embeddings/lexical-text'
import type { PublishResult, OptimisticLockError } from './types'

/**
 * Pre-publish validation. Returns null if OK, or an error string if blocked.
 */
export async function prePublishCheck(projectId: number): Promise<string | null> {
  const payload = await getPayload({ config: configPromise })
  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  // 1. Stage must be 'review' or 'draft' (allow draft for page_update and itinerary_enhancement)
  const stage = project.stage as string
  const contentType = project.contentType as string
  const fastTrackTypes = ['page_update', 'itinerary_enhancement']
  
  if (stage !== 'review' && !(fastTrackTypes.includes(contentType) && stage === 'draft')) {
    return `Cannot publish: project is at stage '${stage}', expected 'review'`
  }

  // 2. Quality gates must pass
  let bodyText = ''
  if (project.body) {
    bodyText = extractTextFromLexical(project.body)
  } else if (project.sections) {
    const sections = typeof project.sections === 'string'
      ? JSON.parse(project.sections)
      : project.sections
    bodyText = Object.values(sections || {}).map(v => String(v || '')).join('\n\n')
  }

  const gateResult = await checkHardGates({
    projectId: String(projectId),
    body: bodyText,
    metaTitle: (project.metaTitle as string) || undefined,
    metaDescription: (project.metaDescription as string) || undefined,
  })

  if (!gateResult.passed) {
    const errors = gateResult.violations.filter(v => v.severity === 'error')
    return `Quality gates failed: ${errors.map(e => e.message).join('; ')}`
  }

  // 3. Consistency check must not have unresolved hard contradictions
  const consistencyResult = project.consistencyCheckResult as string
  if (consistencyResult === 'hard_contradiction') {
    // Check if all hard contradictions are resolved
    const issues = Array.isArray(project.consistencyIssues) ? project.consistencyIssues : []
    const unresolvedHard = issues.filter((i: Record<string, unknown>) => 
      i.issueType === 'hard' && i.resolution === 'pending'
    )
    if (unresolvedHard.length > 0) {
      return `Publish blocked: ${unresolvedHard.length} unresolved hard contradiction(s)`
    }
  }

  return null // All checks passed
}

/**
 * Optimistic lock check. Compares targetUpdatedAt on project with actual updatedAt on target record.
 */
export async function checkOptimisticLock(
  collection: string,
  recordId: string,
  expectedUpdatedAt: string | null,
): Promise<OptimisticLockError | null> {
  if (!expectedUpdatedAt) return null // No lock to check

  const payload = await getPayload({ config: configPromise })
  const record = await payload.findByID({
    collection: collection as 'posts',
    id: recordId as unknown as number,
    depth: 0,
  }) as unknown as Record<string, unknown>

  const actualUpdatedAt = record.updatedAt as string
  if (actualUpdatedAt !== expectedUpdatedAt) {
    return {
      targetCollection: collection,
      targetId: recordId,
      expectedUpdatedAt,
      actualUpdatedAt,
      message: `Target record was modified since read. Expected updatedAt: ${expectedUpdatedAt}, actual: ${actualUpdatedAt}`,
    }
  }

  return null
}

/**
 * Mark project as published after successful publish.
 */
export async function markPublished(projectId: number, targetCollection: string, targetId: string): Promise<void> {
  const payload = await getPayload({ config: configPromise })
  await payload.update({
    collection: 'content-projects',
    id: projectId,
    data: {
      stage: 'published',
      publishedAt: new Date().toISOString(),
      targetCollection,
      targetRecordId: targetId,
      processingStatus: 'completed',
    },
  })
}
```

---

## Task 2: Implement Article Publisher

Replace stub `content-system/publishing/article-publisher.ts`:

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { prePublishCheck, markPublished } from './utils'
import { extractTextFromLexical } from '../embeddings/lexical-text'
import type { ArticlePublishOptions, PublishResult } from './types'

export async function publishArticle(options: ArticlePublishOptions): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })
  const projectId = Number(options.projectId)

  // Pre-publish validation
  const blockReason = await prePublishCheck(projectId)
  if (blockReason) {
    return { success: false, targetCollection: 'posts', targetId: '', publishedAt: '', error: blockReason }
  }

  // Load project
  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  try {
    // Create post in Posts collection
    const postData: Record<string, unknown> = {
      title: project.title,
      slug: options.slug || project.slug,
      content: project.body, // Already in Lexical format
      heroImage: options.heroImageId || project.heroImage || undefined,
      excerpt: options.metaDescription?.substring(0, 300),
      meta: {
        title: options.metaTitle,
        description: options.metaDescription,
      },
      answerCapsule: options.answerCapsule,
      faqItems: options.faqSection?.map(faq => ({
        question: faq.question,
        answer: faq.answer, // Note: Posts FAQ answer is richText, may need conversion
      })),
      publishedAt: new Date().toISOString(),
      _status: 'published',
    }

    const post = await payload.create({
      collection: 'posts',
      data: postData,
    })

    await markPublished(projectId, 'posts', String(post.id))

    return {
      success: true,
      targetCollection: 'posts',
      targetId: String(post.id),
      publishedAt: new Date().toISOString(),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, targetCollection: 'posts', targetId: '', publishedAt: '', error: message }
  }
}
```

---

## Task 3: Implement Destination Page Publisher

Replace stub `content-system/publishing/destination-page-publisher.ts`:

The Destinations collection expects: `description` (richText), `metaTitle`, `metaDescription`, `answerCapsule`, `bestTimeToVisit` (richText), `highlights` (array), `faqItems` (array).

The ContentProject stores sections as a JSON object keyed by section name (from the destination-page-drafter which produces 9 sections: overview, when_to_visit, why_choose, key_experiences, getting_there, health_safety, investment_expectation, top_lodges, faq).

Map these sections to Destination fields. The `overview` section → `description`. The `when_to_visit` section → `bestTimeToVisit`. FAQ → `faqItems`. Others can be stored as richText blocks or in the description.

**IMPORTANT:** The Destinations collection does not have fields for every section the drafter produces. The publisher must map what it can and note what it can't. If new fields are needed on Destinations, flag this — do NOT add fields without instruction.

Implementation approach:
1. Load project and parse sections
2. Check optimistic lock against `targetRecordId` + `targetUpdatedAt`
3. Map sections to Destination fields
4. Update the Destination record
5. Mark project as published

---

## Task 4: Implement Property Page Publisher

Replace stub `content-system/publishing/property-page-publisher.ts`:

Similar to destination-page-publisher but targets the Properties collection. Map `description_enhanced` from the sections content.

---

## Task 5: Implement Enhancement Publisher

Replace stub `content-system/publishing/enhancement-publisher.ts`:

For `itinerary_enhancement` content type. Updates a specific field on a specific record in a specific collection. Uses optimistic locking.

---

## Task 6: Implement Update Publisher  

Replace stub `content-system/publishing/update-publisher.ts`:

Generic single-field update on any target record. Uses `targetCollection`, `targetRecordId`, `targetField` from the ContentProject.

---

## Task 7: Create Publish Dispatcher

Create `content-system/publishing/index.ts`:

```typescript
import type { PublishResult } from './types'

export async function dispatchPublish(projectId: number): Promise<PublishResult> {
  // Load project, determine content type, call appropriate publisher
  // Map content type to publisher function
  // Return result
}
```

---

## Task 8: Create API Route `/api/content/publish/route.ts`

Create `src/app/(payload)/api/content/publish/route.ts`:

- POST endpoint
- Accepts `{ projectId: number }`
- Auth via Bearer token or Payload session
- Calls `dispatchPublish(projectId)`
- Returns `{ success, targetCollection, targetId, publishedAt, error? }`
- `maxDuration = 60`

---

## Task 9: Verification

### Test 9a: Publish Blocked by Quality Gates

Pick a project at 'review' stage. If none exist, advance a drafted project to 'review' first.

Inject a banned phrase into its body. Call publish.

Expected: `success: false`, error message mentions quality gates.

### Test 9b: Publish Blocked by Unresolved Contradiction

Pick a project at 'review' stage with `consistencyCheckResult = 'hard_contradiction'` and at least one unresolved issue. Call publish.

Expected: `success: false`, error message mentions contradictions.

### Test 9c: Successful Publish (Article)

Pick or prepare a project at 'review' stage that:
- Has body, metaTitle, metaDescription, answerCapsule, faqSection populated
- Passes quality gates
- Has no unresolved hard contradictions (either 'pass' or all resolved)
- Has a valid slug

Call publish.

Expected: `success: true`, a new record appears in the Posts collection.

Verify:

```sql
-- Check the content project
SELECT id, stage, published_at, target_collection, target_record_id, processing_status
FROM content_projects WHERE id = PROJECT_ID;

-- Check the created post
SELECT id, title, slug, _status, published_at
FROM posts WHERE id = TARGET_RECORD_ID;
```

### Gate E1: Publishing Pipeline Works

```
PASS criteria:
1. Test 9a: Publish blocked by quality gates (full response showing error)
2. Test 9b: Publish blocked by contradictions (full response showing error)
3. Test 9c: Article published successfully
   - content_projects record shows stage='published', target_collection='posts', target_record_id is set
   - posts record exists with _status='published', matching title and slug
4. Build passes
5. Route returns non-404 on production
```

---

## Commit

```bash
git add -A
git commit -m "feat: Phase E — publishing pipeline with pre-publish gates, optimistic locking, article/destination/property/enhancement/update publishers"
git push
```

---

## Report Format

Write to `content-engine/reports/phaseE-publishing-pipeline.md`:

```markdown
# Phase E: Publishing Pipeline — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## Implementation
### Files Created/Modified
[list with sizes]

### Publisher Summary
| Publisher | Target Collection | Fields Mapped | Optimistic Lock |
|---|---|---|---|
| article | posts | [fields] | N/A (creates new) |
| destination-page | destinations | [fields] | Yes |
| property-page | properties | [fields] | Yes |
| enhancement | itineraries | [field] | Yes |
| update | any | [targetField] | Yes |

### Unmapped Sections
[Any ContentProject sections that could not be mapped to target collection fields]

## Verification
### Test 9a: Blocked by Quality Gates
[full response]
### Test 9b: Blocked by Contradictions
[full response]
### Test 9c: Successful Article Publish
[full response + SQL verification]

### Gate E1: [PASS/FAIL]

## Git
- Committed: [YES/NO]
- Pushed: [YES/NO]

## Overall: [PASS / BLOCKED AT GATE]
```

---

## STOP CONDITIONS

- If prePublishCheck fails unexpectedly (e.g., can't load quality gates) → STOP.
- If the Posts collection rejects the create (validation error) → the field mapping is wrong. STOP and report the exact Payload error.
- If optimistic lock check throws → the target record ID or collection slug may be wrong. STOP.
- If the Destinations or Properties collection does not have fields for critical section content → STOP and flag for Graham. We may need schema changes.
