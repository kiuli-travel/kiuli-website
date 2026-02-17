# Phase 13: Publishing Pipeline

**Context:** Phases 0–12 complete. 5 draft article projects exist. Publishing stubs exist in `content-system/publishing/` — all are `declare function` only. No `/api/content/publish` route exists. Destinations collection is missing 6 richText fields that the destination-page-drafter writes to.

**Strategist:** Claude.ai (Graham's project)
**Tactician:** You (Claude CLI)

---

## Rules

1. **Follow the task order exactly.**
2. **All output must be raw evidence** — SQL results, curl responses, file contents.
3. **If any gate fails, STOP.**
4. **Create report at** `content-engine/reports/phase13-publishing-pipeline.md`.
5. **Do not skip any step.**

---

## PART A: Schema Migration

### Task 1: Add Fields to Destinations.ts

Open `src/collections/Destinations.ts`.

Add 6 new richText fields AFTER the `bestTimeToVisit` field and BEFORE the `highlights` field:

```typescript
    {
      name: 'whyChoose',
      type: 'richText',
      label: 'Why Choose This Destination',
      admin: {
        description: 'Editorial content: what makes this destination special vs alternatives',
      },
    },
    {
      name: 'keyExperiences',
      type: 'richText',
      label: 'Key Experiences',
      admin: {
        description: 'Editorial content: signature activities and encounters',
      },
    },
    {
      name: 'gettingThere',
      type: 'richText',
      label: 'Getting There',
      admin: {
        description: 'Logistics: flights, transfers, access routes',
      },
    },
    {
      name: 'healthSafety',
      type: 'richText',
      label: 'Health & Safety',
      admin: {
        description: 'Health requirements, safety considerations, malaria, visas',
      },
    },
    {
      name: 'investmentExpectation',
      type: 'richText',
      label: 'Investment Expectation',
      admin: {
        description: 'Pricing context and value framing for this destination',
      },
    },
    {
      name: 'topLodgesContent',
      type: 'richText',
      label: 'Top Lodges Editorial',
      admin: {
        description: 'Editorial overview of the best properties at this destination',
      },
    },
```

**Verification:** Read Destinations.ts back. Confirm 6 new fields exist between bestTimeToVisit and highlights.

### Task 2: Create Migration

Create `src/migrations/20260217_add_destination_content_fields.ts`:

```typescript
import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add 6 richText content fields to destinations
  await db.execute(sql`
    ALTER TABLE "destinations"
    ADD COLUMN IF NOT EXISTS "why_choose" jsonb,
    ADD COLUMN IF NOT EXISTS "key_experiences" jsonb,
    ADD COLUMN IF NOT EXISTS "getting_there" jsonb,
    ADD COLUMN IF NOT EXISTS "health_safety" jsonb,
    ADD COLUMN IF NOT EXISTS "investment_expectation" jsonb,
    ADD COLUMN IF NOT EXISTS "top_lodges_content" jsonb;
  `)

  // Add corresponding version columns
  await db.execute(sql`
    ALTER TABLE "_destinations_v"
    ADD COLUMN IF NOT EXISTS "version_why_choose" jsonb,
    ADD COLUMN IF NOT EXISTS "version_key_experiences" jsonb,
    ADD COLUMN IF NOT EXISTS "version_getting_there" jsonb,
    ADD COLUMN IF NOT EXISTS "version_health_safety" jsonb,
    ADD COLUMN IF NOT EXISTS "version_investment_expectation" jsonb,
    ADD COLUMN IF NOT EXISTS "version_top_lodges_content" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "destinations"
    DROP COLUMN IF EXISTS "why_choose",
    DROP COLUMN IF EXISTS "key_experiences",
    DROP COLUMN IF EXISTS "getting_there",
    DROP COLUMN IF EXISTS "health_safety",
    DROP COLUMN IF EXISTS "investment_expectation",
    DROP COLUMN IF EXISTS "top_lodges_content";
  `)

  await db.execute(sql`
    ALTER TABLE "_destinations_v"
    DROP COLUMN IF EXISTS "version_why_choose",
    DROP COLUMN IF EXISTS "version_key_experiences",
    DROP COLUMN IF EXISTS "version_getting_there",
    DROP COLUMN IF EXISTS "version_health_safety",
    DROP COLUMN IF EXISTS "version_investment_expectation",
    DROP COLUMN IF EXISTS "version_top_lodges_content";
  `)
}
```

### Task 3: Register Migration

Add to `src/migrations/index.ts`:

1. Add import at the end of the import block:
```typescript
import * as migration_20260217_add_destination_content_fields from './20260217_add_destination_content_fields';
```

2. Add entry at the end of the migrations array:
```typescript
  {
    up: migration_20260217_add_destination_content_fields.up,
    down: migration_20260217_add_destination_content_fields.down,
    name: '20260217_add_destination_content_fields',
  },
```

### Task 4: Run Migration

```bash
cd ~/Projects/kiuli-website
npx payload migrate 2>&1
```

Record the full output.

### Gate 1: Migration Applied

Verify the columns exist:

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

## PART B: Text-to-Lexical Utility

### Task 5: Create textToLexical Utility

The destination-page-publisher needs to convert the drafter's plain text sections (stored as strings in `content_projects.sections` jsonb) to Lexical richText JSON (for the richText fields on destinations).

Create `content-system/publishing/text-to-lexical.ts`:

```typescript
/**
 * Converts plain text (potentially with markdown-style paragraphs) to
 * Payload CMS Lexical richText JSON format.
 *
 * Splits on double-newline for paragraphs. Single newlines within a
 * paragraph are joined with a space.
 *
 * Does NOT handle markdown bold, headers, lists, or links.
 * The publisher's job is to move content, not format it.
 * Formatting is the frontend's job.
 */
export function textToLexical(text: string): Record<string, unknown> {
  if (!text || text.trim().length === 0) {
    return {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        children: [],
        direction: null,
      },
    }
  }

  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 0)

  const children = paragraphs.map((para) => ({
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    children: [
      {
        type: 'text',
        format: 0,
        text: para,
        detail: 0,
        mode: 'normal',
        style: '',
        version: 1,
      },
    ],
    direction: 'ltr',
    textFormat: 0,
    textStyle: '',
  }))

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      children,
      direction: 'ltr',
    },
  }
}
```

**Verification:** Read it back.

---

## PART C: Rewrite Publishing Types

### Task 6: Rewrite types.ts

Replace the entire contents of `content-system/publishing/types.ts` with:

```typescript
export interface PublishResult {
  success: boolean
  targetCollection: string
  targetId: number
  publishedAt: string
  error?: string
}

export interface OptimisticLockError {
  targetCollection: string
  targetId: number
  expectedUpdatedAt: string
  actualUpdatedAt: string
}
```

The old interfaces (`ArticlePublishOptions`, `DestinationPagePublishOptions`, etc.) were never used by any caller and had wrong types (string IDs, wrong field names). Each publisher will define its own input by reading directly from the content project. The publisher functions take `projectId: number` and read everything they need from the database.

**Verification:** Read it back.

---

## PART D: Build Publishers

Each publisher follows the same pattern:
1. Read content project by ID
2. Validate content type
3. Set processingStatus to 'processing'
4. Read target record and its updatedAt (optimistic lock baseline)
5. Write to target collection
6. Verify updatedAt hasn't changed (optimistic lock check)
7. Set stage to 'published', publishedAt, processingStatus to 'completed'
8. Trigger embedding

### Task 7: article-publisher.ts

Replace `content-system/publishing/article-publisher.ts` entirely.

The article publisher writes to the Posts collection. Field mapping from content_projects → posts:

| Content Project Field | Posts Field | Notes |
|---|---|---|
| title | title | Direct copy |
| body (Lexical jsonb) | content | Direct copy — both are Lexical richText |
| metaTitle | meta.title (DB: meta_title) | Direct copy, max 60 |
| metaDescription | meta.description (DB: meta_description) | Direct copy, max 160 |
| answerCapsule | meta.answerCapsule (DB: meta_answer_capsule) | Direct copy |
| faqSection (array) | faqItems | Array of {question, answer} — but Posts.faqItems.answer is richText (jsonb), so plain text answers need textToLexical conversion |

The publisher must:
1. Read content project, validate it's an article type (`itinerary_cluster`, `authority`, `designer_insight`).
2. Generate a slug from the title if none exists.
3. Check if a Post with this slug already exists. If yes, update it (idempotent). If no, create it.
4. Write the mapped fields.
5. Set `_status: 'published'` and `publishedAt`.
6. Map destinations to relatedItineraries if any. (Skip for now — relationship mapping is complex and not blocking.)
7. Return the Post ID.

Optimistic lock: Posts are created by the publisher (not pre-existing), so no lock conflict is possible on create. On update (re-publish), read updatedAt before write, verify after.

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { textToLexical } from './text-to-lexical'
import type { PublishResult } from './types'

const ARTICLE_TYPES = new Set(['itinerary_cluster', 'authority', 'designer_insight'])

export async function publishArticle(projectId: number): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })

  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  const contentType = project.contentType as string
  if (!ARTICLE_TYPES.has(contentType)) {
    throw new Error(`Article publisher received non-article type: ${contentType}`)
  }

  // Validate required fields
  const title = project.title as string
  if (!title) throw new Error('Cannot publish: title is empty')

  const body = project.body
  if (!body) throw new Error('Cannot publish: body is empty')

  const metaTitle = project.metaTitle as string
  const metaDescription = project.metaDescription as string
  const answerCapsule = project.answerCapsule as string

  // Generate slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)

  // Convert FAQ answers to Lexical richText
  const rawFaq = Array.isArray(project.faqSection) ? project.faqSection as Record<string, unknown>[] : []
  const faqItems = rawFaq
    .filter((f) => f.question && f.answer)
    .map((f) => ({
      question: String(f.question),
      answer: textToLexical(String(f.answer)),
    }))

  // Check for existing post with this slug (idempotent re-publish)
  const existing = await payload.find({
    collection: 'posts',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
  })

  const now = new Date().toISOString()

  const postData: Record<string, unknown> = {
    title,
    content: body,
    slug,
    publishedAt: now,
    _status: 'published',
    faqItems: faqItems.length > 0 ? faqItems : [],
    meta: {
      title: metaTitle || undefined,
      description: metaDescription || undefined,
      answerCapsule: answerCapsule || undefined,
    },
  }

  let postId: number

  if (existing.docs.length > 0) {
    const existingPost = existing.docs[0] as unknown as Record<string, unknown>
    const existingUpdatedAt = existingPost.updatedAt as string

    // Optimistic lock: re-read to verify
    const freshPost = await payload.findByID({
      collection: 'posts',
      id: existingPost.id as number,
      depth: 0,
    }) as unknown as Record<string, unknown>

    if ((freshPost.updatedAt as string) !== existingUpdatedAt) {
      throw new Error(`Optimistic lock conflict on post ${existingPost.id}: updatedAt changed between reads`)
    }

    const updated = await payload.update({
      collection: 'posts',
      id: existingPost.id as number,
      data: postData,
    })
    postId = updated.id as number
    console.log(`[article-publisher] Updated existing post ${postId} for project ${projectId}`)
  } else {
    const created = await payload.create({
      collection: 'posts',
      data: postData,
    })
    postId = created.id as number
    console.log(`[article-publisher] Created new post ${postId} for project ${projectId}`)
  }

  return {
    success: true,
    targetCollection: 'posts',
    targetId: postId,
    publishedAt: now,
  }
}
```

**Verification:** Read it back.

### Task 8: destination-page-publisher.ts

Replace `content-system/publishing/destination-page-publisher.ts` entirely.

Field mapping from content_projects.sections → destinations:

| Section Key | Destinations Field | Type | Notes |
|---|---|---|---|
| overview | description | richText (jsonb) | textToLexical conversion |
| when_to_visit | bestTimeToVisit | richText (jsonb) | textToLexical conversion |
| why_choose | whyChoose | richText (jsonb) | NEW field, textToLexical |
| key_experiences | keyExperiences | richText (jsonb) | NEW field, textToLexical |
| getting_there | gettingThere | richText (jsonb) | NEW field, textToLexical |
| health_safety | healthSafety | richText (jsonb) | NEW field, textToLexical |
| investment_expectation | investmentExpectation | richText (jsonb) | NEW field, textToLexical |
| top_lodges | topLodgesContent | richText (jsonb) | NEW field, textToLexical |
| faq → faqItems array | faqItems | array | answer needs textToLexical |

Also writes: metaTitle, metaDescription, answerCapsule to the destination.

The publisher needs to know WHICH destination to write to. The content project has a `destinations` array field (string names). The publisher must resolve the destination name to a destination ID. If no exact match, it should fail — not guess.

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { textToLexical } from './text-to-lexical'
import type { PublishResult, OptimisticLockError } from './types'

const SECTION_TO_FIELD: Record<string, string> = {
  overview: 'description',
  when_to_visit: 'bestTimeToVisit',
  why_choose: 'whyChoose',
  key_experiences: 'keyExperiences',
  getting_there: 'gettingThere',
  health_safety: 'healthSafety',
  investment_expectation: 'investmentExpectation',
  top_lodges: 'topLodgesContent',
}

export async function publishDestinationPage(projectId: number): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })

  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((project.contentType as string) !== 'destination_page') {
    throw new Error(`Destination publisher received type: ${project.contentType}`)
  }

  const sections = project.sections as Record<string, string> | null
  if (!sections || Object.keys(sections).length === 0) {
    throw new Error('Cannot publish: sections is empty')
  }

  // Resolve destination
  const destinations = Array.isArray(project.destinations)
    ? (project.destinations as string[])
    : []
  if (destinations.length === 0) {
    throw new Error('Cannot publish: no destination name on content project')
  }

  const destResult = await payload.find({
    collection: 'destinations',
    where: { name: { equals: destinations[0] } },
    limit: 1,
    depth: 0,
  })

  if (destResult.docs.length === 0) {
    throw new Error(`Cannot publish: destination "${destinations[0]}" not found in destinations collection`)
  }

  const destination = destResult.docs[0] as unknown as Record<string, unknown>
  const destinationId = destination.id as number
  const baselineUpdatedAt = destination.updatedAt as string

  // Build update payload: convert each section text → Lexical
  const updateData: Record<string, unknown> = {}

  for (const [sectionKey, text] of Object.entries(sections)) {
    const field = SECTION_TO_FIELD[sectionKey]
    if (field && text && text.trim().length > 0) {
      updateData[field] = textToLexical(text)
    }
  }

  // Meta fields
  if (project.metaTitle) updateData.metaTitle = project.metaTitle
  if (project.metaDescription) updateData.metaDescription = project.metaDescription
  if (project.answerCapsule) updateData.answerCapsule = project.answerCapsule

  // FAQ items
  const rawFaq = Array.isArray(project.faqSection) ? project.faqSection as Record<string, unknown>[] : []
  if (rawFaq.length > 0) {
    updateData.faqItems = rawFaq
      .filter((f) => f.question && f.answer)
      .map((f) => ({
        question: String(f.question),
        answer: textToLexical(String(f.answer)),
      }))
  }

  // Optimistic lock: re-read before write
  const freshDest = await payload.findByID({
    collection: 'destinations',
    id: destinationId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((freshDest.updatedAt as string) !== baselineUpdatedAt) {
    // Conflict — retry once with fresh baseline
    console.warn(`[destination-publisher] Optimistic lock conflict on destination ${destinationId}, retrying`)
    const retryDest = await payload.findByID({
      collection: 'destinations',
      id: destinationId,
      depth: 0,
    }) as unknown as Record<string, unknown>
    const retryUpdatedAt = retryDest.updatedAt as string

    // Second attempt
    await payload.update({ collection: 'destinations', id: destinationId, data: updateData })

    const afterUpdate = await payload.findByID({
      collection: 'destinations',
      id: destinationId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    if ((afterUpdate.updatedAt as string) === retryUpdatedAt) {
      const lockError: OptimisticLockError = {
        targetCollection: 'destinations',
        targetId: destinationId,
        expectedUpdatedAt: retryUpdatedAt,
        actualUpdatedAt: afterUpdate.updatedAt as string,
      }
      throw new Error(`Optimistic lock failed after retry: ${JSON.stringify(lockError)}`)
    }
  } else {
    // No conflict — write
    await payload.update({ collection: 'destinations', id: destinationId, data: updateData })
  }

  const now = new Date().toISOString()
  console.log(`[destination-publisher] Updated destination ${destinationId} for project ${projectId}`)

  return {
    success: true,
    targetCollection: 'destinations',
    targetId: destinationId,
    publishedAt: now,
  }
}
```

**Verification:** Read it back.

### Task 9: property-page-publisher.ts

Replace `content-system/publishing/property-page-publisher.ts`.

The property drafter writes 2 sections: `overview` and `faq`. Mapping:

| Section Key | Properties Field | Type |
|---|---|---|
| overview | description_enhanced | richText (jsonb) |
| faq → faqItems | faqItems | array, answer is richText |

Also writes: metaTitle, metaDescription, answerCapsule.

Same pattern as destination publisher: resolve property by name from `project.properties[0]`, optimistic lock, single atomic write.

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { textToLexical } from './text-to-lexical'
import type { PublishResult, OptimisticLockError } from './types'

export async function publishPropertyPage(projectId: number): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })

  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((project.contentType as string) !== 'property_page') {
    throw new Error(`Property publisher received type: ${project.contentType}`)
  }

  const sections = project.sections as Record<string, string> | null
  if (!sections || !sections.overview) {
    throw new Error('Cannot publish: sections.overview is empty')
  }

  // Resolve property
  const properties = Array.isArray(project.properties) ? (project.properties as string[]) : []
  if (properties.length === 0) {
    throw new Error('Cannot publish: no property name on content project')
  }

  const propResult = await payload.find({
    collection: 'properties',
    where: { name: { equals: properties[0] } },
    limit: 1,
    depth: 0,
  })

  if (propResult.docs.length === 0) {
    throw new Error(`Cannot publish: property "${properties[0]}" not found in properties collection`)
  }

  const property = propResult.docs[0] as unknown as Record<string, unknown>
  const propertyId = property.id as number
  const baselineUpdatedAt = property.updatedAt as string

  // Build update
  const updateData: Record<string, unknown> = {
    descriptionEnhanced: textToLexical(sections.overview),
  }

  if (project.metaTitle) updateData.metaTitle = project.metaTitle
  if (project.metaDescription) updateData.metaDescription = project.metaDescription
  if (project.answerCapsule) updateData.answerCapsule = project.answerCapsule

  // FAQ
  const rawFaq = Array.isArray(project.faqSection) ? project.faqSection as Record<string, unknown>[] : []
  if (rawFaq.length > 0) {
    updateData.faqItems = rawFaq
      .filter((f) => f.question && f.answer)
      .map((f) => ({
        question: String(f.question),
        answer: textToLexical(String(f.answer)),
      }))
  }

  // Optimistic lock
  const freshProp = await payload.findByID({
    collection: 'properties',
    id: propertyId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((freshProp.updatedAt as string) !== baselineUpdatedAt) {
    console.warn(`[property-publisher] Optimistic lock conflict on property ${propertyId}, retrying`)
    await payload.update({ collection: 'properties', id: propertyId, data: updateData })
  } else {
    await payload.update({ collection: 'properties', id: propertyId, data: updateData })
  }

  const now = new Date().toISOString()
  console.log(`[property-publisher] Updated property ${propertyId} for project ${projectId}`)

  return {
    success: true,
    targetCollection: 'properties',
    targetId: propertyId,
    publishedAt: now,
  }
}
```

**Verification:** Read it back.

### Task 10: enhancement-publisher.ts

Replace `content-system/publishing/enhancement-publisher.ts`.

Enhancement projects write a single field on a target record. The content project has `targetCollection` (enum: destinations/itineraries/posts/properties), `targetField` (varchar), `targetRecordId` (varchar — parse to number), and `body` (Lexical richText).

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { PublishResult } from './types'

const ALLOWED_COLLECTIONS = new Set(['destinations', 'itineraries', 'posts', 'properties'])

export async function publishEnhancement(projectId: number): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })

  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((project.contentType as string) !== 'itinerary_enhancement') {
    throw new Error(`Enhancement publisher received type: ${project.contentType}`)
  }

  const targetCollection = project.targetCollection as string
  const targetField = project.targetField as string
  const targetRecordId = parseInt(String(project.targetRecordId), 10)

  if (!targetCollection || !ALLOWED_COLLECTIONS.has(targetCollection)) {
    throw new Error(`Invalid target collection: ${targetCollection}`)
  }
  if (!targetField) throw new Error('Cannot publish: targetField is empty')
  if (isNaN(targetRecordId)) throw new Error('Cannot publish: targetRecordId is invalid')
  if (!project.body) throw new Error('Cannot publish: body is empty')

  // Read target for optimistic lock
  const target = await payload.findByID({
    collection: targetCollection as 'destinations' | 'itineraries' | 'posts' | 'properties',
    id: targetRecordId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  const baselineUpdatedAt = target.updatedAt as string

  // Verify no conflict
  const freshTarget = await payload.findByID({
    collection: targetCollection as 'destinations' | 'itineraries' | 'posts' | 'properties',
    id: targetRecordId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((freshTarget.updatedAt as string) !== baselineUpdatedAt) {
    throw new Error(`Optimistic lock conflict on ${targetCollection}/${targetRecordId}`)
  }

  await payload.update({
    collection: targetCollection as 'destinations' | 'itineraries' | 'posts' | 'properties',
    id: targetRecordId,
    data: { [targetField]: project.body },
  })

  const now = new Date().toISOString()
  console.log(`[enhancement-publisher] Wrote to ${targetCollection}.${targetField} (ID ${targetRecordId}) for project ${projectId}`)

  return {
    success: true,
    targetCollection,
    targetId: targetRecordId,
    publishedAt: now,
  }
}
```

**Verification:** Read it back.

### Task 11: update-publisher.ts

Replace `content-system/publishing/update-publisher.ts`.

Identical pattern to enhancement but for `page_update` content type. Also preserves `targetCurrentContent` on the content project.

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { textToLexical } from './text-to-lexical'
import type { PublishResult } from './types'

const ALLOWED_COLLECTIONS = new Set(['destinations', 'itineraries', 'posts', 'properties'])

export async function publishUpdate(projectId: number): Promise<PublishResult> {
  const payload = await getPayload({ config: configPromise })

  const project = await payload.findByID({
    collection: 'content-projects',
    id: projectId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((project.contentType as string) !== 'page_update') {
    throw new Error(`Update publisher received type: ${project.contentType}`)
  }

  const targetCollection = project.targetCollection as string
  const targetField = project.targetField as string
  const targetRecordId = parseInt(String(project.targetRecordId), 10)

  if (!targetCollection || !ALLOWED_COLLECTIONS.has(targetCollection)) {
    throw new Error(`Invalid target collection: ${targetCollection}`)
  }
  if (!targetField) throw new Error('Cannot publish: targetField is empty')
  if (isNaN(targetRecordId)) throw new Error('Cannot publish: targetRecordId is invalid')
  if (!project.body) throw new Error('Cannot publish: body is empty')

  // Read target for optimistic lock
  const target = await payload.findByID({
    collection: targetCollection as 'destinations' | 'itineraries' | 'posts' | 'properties',
    id: targetRecordId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  const baselineUpdatedAt = target.updatedAt as string

  // Snapshot current content for audit trail
  const currentContent = target[targetField]
  if (currentContent && !project.targetCurrentContent) {
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { targetCurrentContent: currentContent },
    })
  }

  // Optimistic lock verify
  const freshTarget = await payload.findByID({
    collection: targetCollection as 'destinations' | 'itineraries' | 'posts' | 'properties',
    id: targetRecordId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  if ((freshTarget.updatedAt as string) !== baselineUpdatedAt) {
    throw new Error(`Optimistic lock conflict on ${targetCollection}/${targetRecordId}`)
  }

  // Determine if target field is richText (jsonb) — if body is Lexical, write directly
  // If body is not Lexical (shouldn't happen), convert
  await payload.update({
    collection: targetCollection as 'destinations' | 'itineraries' | 'posts' | 'properties',
    id: targetRecordId,
    data: { [targetField]: project.body },
  })

  const now = new Date().toISOString()
  console.log(`[update-publisher] Wrote to ${targetCollection}.${targetField} (ID ${targetRecordId}) for project ${projectId}`)

  return {
    success: true,
    targetCollection,
    targetId: targetRecordId,
    publishedAt: now,
  }
}
```

**Verification:** Read it back.

---

## PART E: Publish Route

### Task 12: Create /api/content/publish/route.ts

Create `src/app/(payload)/api/content/publish/route.ts`:

The publish route:
1. Authenticates (Bearer token or Payload session)
2. Reads the content project
3. Checks consistency: if `consistencyCheckResult` is `hard_contradiction`, checks for unresolved pending hard issues — blocks publish if any
4. Routes to the appropriate publisher by contentType
5. After publish: triggers embedding (fire-and-forget via internal fetch to `/api/content/embed`)
6. Updates content project: stage → 'published', publishedAt, processingStatus → 'completed'
7. Returns result

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

async function validateAuth(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    if (
      token === process.env.CONTENT_SYSTEM_SECRET ||
      token === process.env.PAYLOAD_API_KEY ||
      token === process.env.SCRAPER_API_KEY
    ) {
      return true
    }
  }
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({ headers: request.headers })
    if (user) return true
  } catch {}
  return false
}

export async function POST(request: NextRequest) {
  if (!(await validateAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let projectId: number
  try {
    const body = await request.json()
    projectId = body.projectId
    if (!projectId || typeof projectId !== 'number') {
      return NextResponse.json({ error: 'Missing or invalid projectId' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  let project: Record<string, unknown>
  try {
    project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: `Project ${projectId} not found` }, { status: 404 })
  }

  // Block if unresolved hard contradictions
  const consistencyResult = project.consistencyCheckResult as string
  if (consistencyResult === 'hard_contradiction') {
    const issues = Array.isArray(project.consistencyIssues) ? project.consistencyIssues as Record<string, unknown>[] : []
    const unresolvedHard = issues.filter((i) => i.issueType === 'hard' && i.resolution === 'pending')
    if (unresolvedHard.length > 0) {
      return NextResponse.json({
        error: `Cannot publish: ${unresolvedHard.length} unresolved hard contradiction(s)`,
      }, { status: 409 })
    }
  }

  // Set processing
  await payload.update({
    collection: 'content-projects',
    id: projectId,
    data: { processingStatus: 'processing', processingError: null, processingStartedAt: new Date().toISOString() },
  })

  try {
    const contentType = project.contentType as string
    let result: import('../../../../../../content-system/publishing/types').PublishResult

    switch (contentType) {
      case 'itinerary_cluster':
      case 'authority':
      case 'designer_insight': {
        const { publishArticle } = await import('../../../../../../content-system/publishing/article-publisher')
        result = await publishArticle(projectId)
        break
      }
      case 'destination_page': {
        const { publishDestinationPage } = await import('../../../../../../content-system/publishing/destination-page-publisher')
        result = await publishDestinationPage(projectId)
        break
      }
      case 'property_page': {
        const { publishPropertyPage } = await import('../../../../../../content-system/publishing/property-page-publisher')
        result = await publishPropertyPage(projectId)
        break
      }
      case 'itinerary_enhancement': {
        const { publishEnhancement } = await import('../../../../../../content-system/publishing/enhancement-publisher')
        result = await publishEnhancement(projectId)
        break
      }
      case 'page_update': {
        const { publishUpdate } = await import('../../../../../../content-system/publishing/update-publisher')
        result = await publishUpdate(projectId)
        break
      }
      default:
        throw new Error(`No publisher for content type: ${contentType}`)
    }

    // Update project to published
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        stage: 'published',
        publishedAt: result.publishedAt,
        processingStatus: 'completed',
        processingError: null,
      },
    })

    // Trigger embedding (fire and forget)
    try {
      const secret = process.env.CONTENT_SYSTEM_SECRET
      if (secret) {
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://kiuli.com'
        fetch(`${baseUrl}/api/content/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`,
          },
          body: JSON.stringify({ contentProjectId: projectId }),
        }).catch((err) => {
          console.error(`[publish-route] Embedding trigger failed for project ${projectId}:`, err)
        })
      }
    } catch {}

    return NextResponse.json({ success: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[publish-route] Failed for project ${projectId}:`, message)

    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'failed', processingError: message },
      })
    } catch {}

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

**Verification:** Read it back.

---

## PART F: Wire Publish to Workspace

### Task 13: Add triggerPublish Server Action

Add to `src/app/(payload)/admin/content-engine/project/[id]/actions.ts`:

```typescript
// ── Action 11: Trigger Publish ───────────────────────────────────────────────

export async function triggerPublish(
  projectId: number,
): Promise<{ success: true; result: { targetCollection: string; targetId: number } } | { error: string }> {
  const { payload, user } = await authenticate()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  try {
    const project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    // Must be in review stage
    if ((project.stage as string) !== 'review') {
      return { error: `Cannot publish from stage '${project.stage}'. Must be in review.` }
    }

    // Block if unresolved hard contradictions
    if ((project.consistencyCheckResult as string) === 'hard_contradiction') {
      const issues = Array.isArray(project.consistencyIssues) ? project.consistencyIssues as Record<string, unknown>[] : []
      const unresolvedHard = issues.filter((i) => i.issueType === 'hard' && i.resolution === 'pending')
      if (unresolvedHard.length > 0) {
        return { error: `${unresolvedHard.length} unresolved hard contradiction(s). Resolve them first.` }
      }
    }

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { processingStatus: 'processing', processingError: null },
    })

    const contentType = project.contentType as string
    let publishResult: import('../../../../../../../content-system/publishing/types').PublishResult

    switch (contentType) {
      case 'itinerary_cluster':
      case 'authority':
      case 'designer_insight': {
        const { publishArticle } = await import('../../../../../../../content-system/publishing/article-publisher')
        publishResult = await publishArticle(projectId)
        break
      }
      case 'destination_page': {
        const { publishDestinationPage } = await import('../../../../../../../content-system/publishing/destination-page-publisher')
        publishResult = await publishDestinationPage(projectId)
        break
      }
      case 'property_page': {
        const { publishPropertyPage } = await import('../../../../../../../content-system/publishing/property-page-publisher')
        publishResult = await publishPropertyPage(projectId)
        break
      }
      case 'itinerary_enhancement': {
        const { publishEnhancement } = await import('../../../../../../../content-system/publishing/enhancement-publisher')
        publishResult = await publishEnhancement(projectId)
        break
      }
      case 'page_update': {
        const { publishUpdate } = await import('../../../../../../../content-system/publishing/update-publisher')
        publishResult = await publishUpdate(projectId)
        break
      }
      default:
        return { error: `No publisher for content type: ${contentType}` }
    }

    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: {
        stage: 'published',
        publishedAt: publishResult.publishedAt,
        processingStatus: 'completed',
        processingError: null,
      },
    })

    // Trigger embedding
    try {
      const secret = process.env.CONTENT_SYSTEM_SECRET
      if (secret) {
        const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://kiuli.com'
        fetch(`${baseUrl}/api/content/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${secret}`,
          },
          body: JSON.stringify({ contentProjectId: projectId }),
        }).catch(() => {})
      }
    } catch {}

    return { success: true, result: { targetCollection: publishResult.targetCollection, targetId: publishResult.targetId } }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      await payload.update({
        collection: 'content-projects',
        id: projectId,
        data: { processingStatus: 'failed', processingError: message },
      })
    } catch {}
    return { error: message }
  }
}
```

**Verification:** Read actions.ts, confirm `triggerPublish` exists.

---

## PART G: Build, Commit, Test

### Task 14: Build

```bash
npm run build 2>&1 | tail -50
```

#### Gate 2: Build Passes

```
PASS criteria: Exit code 0.
FAIL action: STOP.
```

### Task 15: Commit and Push

Stage all modified/created files:

```bash
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

If `payload-types.ts` or `(payload)/importMap.js` was regenerated, add those too.

```bash
git commit -m "feat: Phase 13 — publishing pipeline with 5 publishers, optimistic locking, schema migration, text-to-Lexical"
git push
```

#### Gate 3: Committed and Pushed

```
PASS criteria: Push succeeded.
FAIL action: STOP.
```

### Task 16: Functional Test — Publish One Article

Wait 60+ seconds for Vercel deploy.

Use project 79 (authority article at draft stage). First advance it to review, then publish it.

```bash
export CONTENT_SYSTEM_SECRET=$(grep CONTENT_SYSTEM_SECRET .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")
```

Step 1: Advance project 79 from draft → review:

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST https://kiuli.com/api/content/dashboard/batch \
  -H "Content-Type: application/json" \
  -H "Cookie: $(cat .payload-cookie 2>/dev/null || echo '')" \
  -b "$(cat .payload-cookie 2>/dev/null || echo '')" \
  -d '{"action":"advance","projectIds":[79]}'
```

If cookie auth doesn't work, use the Bearer token approach. The batch route accepts Payload session auth. Try:

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST https://kiuli.com/api/content/dashboard/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"action":"advance","projectIds":[79]}'
```

**IMPORTANT:** The batch route auth uses `payload.auth()` not Bearer token. If both approaches fail, use the publish route directly which accepts Bearer:

Step 2: Verify project 79 is now in review:

```sql
SELECT id, stage, consistency_check_result, processing_status FROM content_projects WHERE id = 79;
```

(Note: advancing to review should auto-trigger consistency check from Phase 12.)

Wait for consistency check to complete (processingStatus should become 'completed').

Step 3: Publish project 79:

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST https://kiuli.com/api/content/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 79}'
```

Record the full response.

Step 4: Verify in database:

```sql
-- Project 79 should be published
SELECT id, stage, published_at, processing_status FROM content_projects WHERE id = 79;

-- A new post should exist
SELECT id, title, slug, _status, published_at, meta_title, LEFT(content::text, 100) as content_preview FROM posts LIMIT 5;

-- Post should have FAQ items
SELECT p.id, COUNT(f.id) as faq_count FROM posts p LEFT JOIN posts_faq_items f ON f._parent_id = p.id GROUP BY p.id;
```

#### Gate 4: Article Published

```
PASS criteria:
1. Project 79: stage = 'published', processing_status = 'completed', published_at IS NOT NULL
2. A post exists with project 79's title, _status = 'published'
3. Post has content (not null/empty)
4. Post has at least 1 FAQ item
5. No 500 errors

FAIL action: STOP.
```

### Task 17: Integration Test — Destination Publisher DB Operations

Same pattern as the Phase 12 staleness test. Tests the database operations without requiring a draft destination_page project.

Create and run `content-engine/scripts/test-destination-publisher.ts`:

```typescript
/**
 * Integration test for destination-page-publisher.
 * Tests textToLexical conversion and Payload write to destination fields.
 * Does NOT require a content project — tests DB operations directly.
 */

import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { textToLexical } from '../../content-system/publishing/text-to-lexical'

async function run() {
  const payload = await getPayload({ config: configPromise })

  console.log('=== Destination Publisher Integration Test ===\n')

  // Find a real destination to test against
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
  const destName = dest.name as string
  console.log(`Testing against destination: ${destName} (ID ${destId})\n`)

  // TEST 1: textToLexical produces valid Lexical JSON
  console.log('TEST 1: textToLexical conversion')
  const testText = 'First paragraph about the destination.\n\nSecond paragraph with more detail.\n\nThird paragraph concluding.'
  const lexical = textToLexical(testText)
  const root = lexical.root as Record<string, unknown>
  const children = root.children as unknown[]

  if (root.type !== 'root') {
    console.log('  FAIL: root.type is not "root"')
    process.exit(1)
  }
  if (children.length !== 3) {
    console.log(`  FAIL: Expected 3 paragraphs, got ${children.length}`)
    process.exit(1)
  }
  console.log('  PASS: 3 paragraphs generated')

  // TEST 2: Write to new fields
  console.log('\nTEST 2: Write new richText fields')
  const testLexical = textToLexical('TEST CONTENT — integration test for Phase 13 publisher')

  // Save original values to restore
  const originalWhyChoose = dest.why_choose || dest.whyChoose
  const originalKeyExperiences = dest.key_experiences || dest.keyExperiences

  try {
    await payload.update({
      collection: 'destinations',
      id: destId,
      data: {
        whyChoose: testLexical,
        keyExperiences: testLexical,
        gettingThere: testLexical,
        healthSafety: testLexical,
        investmentExpectation: testLexical,
        topLodgesContent: testLexical,
      },
    })
    console.log('  PASS: All 6 new fields written')
  } catch (error) {
    console.log(`  FAIL: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }

  // TEST 3: Read back and verify
  console.log('\nTEST 3: Read back and verify')
  const updated = await payload.findByID({
    collection: 'destinations',
    id: destId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  const fieldsToCheck = ['whyChoose', 'keyExperiences', 'gettingThere', 'healthSafety', 'investmentExpectation', 'topLodgesContent']
  let allPresent = true

  for (const field of fieldsToCheck) {
    const value = updated[field]
    if (value && typeof value === 'object') {
      const r = (value as Record<string, unknown>).root as Record<string, unknown>
      if (r && r.type === 'root') {
        console.log(`  PASS: ${field} contains valid Lexical JSON`)
      } else {
        console.log(`  FAIL: ${field} exists but is not valid Lexical (missing root.type)`)
        allPresent = false
      }
    } else {
      console.log(`  FAIL: ${field} is null or not an object`)
      allPresent = false
    }
  }

  if (!allPresent) {
    process.exit(1)
  }

  // CLEANUP: Restore original values (set new fields to null)
  console.log('\nCLEANUP:')
  try {
    await payload.update({
      collection: 'destinations',
      id: destId,
      data: {
        whyChoose: originalWhyChoose || null,
        keyExperiences: originalKeyExperiences || null,
        gettingThere: null,
        healthSafety: null,
        investmentExpectation: null,
        topLodgesContent: null,
      },
    })
    console.log('  Restored destination fields to original state')
  } catch (error) {
    console.log(`  WARNING: Cleanup failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  console.log('\n=== ALL TESTS PASS ===')
  process.exit(0)
}

run().catch((error) => {
  console.error(`FATAL: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
```

Run:

```bash
npx tsx content-engine/scripts/test-destination-publisher.ts
```

#### Gate 5: Integration Tests Pass

```
PASS criteria: Both scripts output "ALL TESTS PASS" and exit 0.
FAIL action: STOP.
```

### Task 18: Final State

```sql
-- Published projects
SELECT id, stage, content_type, published_at, processing_status
FROM content_projects
WHERE stage = 'published'
ORDER BY id;

-- Posts created
SELECT id, title, slug, _status, published_at FROM posts ORDER BY id;

-- FAQ items on posts
SELECT f._parent_id, f.question, LEFT(f.answer::text, 80) as answer_preview
FROM posts_faq_items f ORDER BY f._parent_id, f._order;

-- Destination fields exist
SELECT column_name FROM information_schema.columns
WHERE table_name = 'destinations'
AND column_name IN ('why_choose', 'key_experiences', 'getting_there', 'health_safety', 'investment_expectation', 'top_lodges_content')
ORDER BY column_name;
```

Record all outputs.

---

## Report Format

```markdown
# Phase 13: Publishing Pipeline — Report

**Date:** [timestamp]

## PART A: Schema Migration
### Task 1: Destinations.ts Update
[Confirmation]

### Task 2-3: Migration Created and Registered
[File contents]

### Task 4: Migration Applied
[Output]

### Gate 1: [PASS/FAIL]
[SQL evidence]

## PART B: text-to-Lexical
### Task 5: Utility Created
[Confirmation]

## PART C: Types Rewrite
### Task 6: types.ts
[Confirmation]

## PART D: Publishers
### Task 7-11: Publisher Implementations
[Confirmation for each]

## PART E: Publish Route
### Task 12: Route Created
[Confirmation]

## PART F: Workspace Wiring
### Task 13: triggerPublish Action
[Confirmation]

## PART G: Build, Commit, Test
### Task 14: Build
[Output, exit code]
#### Gate 2: [PASS/FAIL]

### Task 15: Commit
[Hash, files]
#### Gate 3: [PASS/FAIL]

### Task 16: Functional Test
[All curl responses, SQL verification]
#### Gate 4: [PASS/FAIL]

### Task 17: Integration Test
[Script output]
#### Gate 5: [PASS/FAIL]

### Task 18: Final State
[SQL outputs]

## Overall Phase 13: [ALL GATES PASS / BLOCKED AT GATE N]
```

---

## DO NOT

- Do not modify any collection schema other than Destinations.ts
- Do not create new collections
- Do not modify the consistency checker, conversation handler, or drafting pipeline
- Do not modify collection fields beyond what's specified (no new fields on Properties, Posts, etc.)
- Do not use placeholder or stub implementations — every publisher must be complete
- Do not skip the integration test
- Do not publish any project other than 79 during the functional test
- Do not advance projects 27, 53, 87, or 89 — leave them at draft

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.** Do not attempt repairs.
