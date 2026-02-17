# Phase F: Image Pipeline Implementation

**Context:** Phases A-E complete. Content can be drafted, quality-gated, consistency-checked, and published. The image pipeline is NOT on the critical path — content can publish without hero images. But the pipeline should exist for completeness and to support the workspace Images tab.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **This phase is about library search and prompt generation ONLY.** We are NOT implementing AI image generation services (DALL-E, Midjourney, etc.). The `image-generator.ts` generates text prompts that a human or future service can use.
2. **Library search queries the existing Media collection in Payload.** Kiuli already has 453+ images from iTrvl scraping.
3. **Write report to `content-engine/reports/phaseF-image-pipeline.md`.**

---

## Task 1: Implement `content-system/images/library-search.ts`

Replace the stub. The types define:

```typescript
interface LibrarySearchOptions {
  query: string
  destinations?: string[]
  properties?: string[]
  species?: string[]
  maxResults?: number
}

interface LibraryMatch {
  mediaId: string
  url: string
  score: number
  labels: Record<string, string>
  alt: string
}
```

Implementation:

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { LibrarySearchOptions, LibraryMatch } from './types'

export async function searchMediaLibrary(options: LibrarySearchOptions): Promise<LibraryMatch[]> {
  const payload = await getPayload({ config: configPromise })
  const limit = options.maxResults || 10

  // Build Payload query conditions
  const conditions: Record<string, unknown>[] = []

  // Text search on filename and alt
  if (options.query) {
    conditions.push({
      or: [
        { filename: { contains: options.query.toLowerCase() } },
        { alt: { contains: options.query.toLowerCase() } },
      ],
    })
  }

  // Filter by destination tags if Media has tag fields
  // Note: The Media collection may not have destination/property/species tags.
  // Check the actual Media collection schema first.

  const where = conditions.length > 0 ? { and: conditions } : {}

  const results = await payload.find({
    collection: 'media',
    where,
    limit,
    sort: '-createdAt',
  })

  return results.docs.map((doc) => {
    const d = doc as unknown as Record<string, unknown>
    return {
      mediaId: String(d.id),
      url: String(d.url || ''),
      score: 1.0, // Simple search — no relevance scoring
      labels: {}, // Populate if Media has tag fields
      alt: String(d.alt || d.filename || ''),
    }
  })
}
```

**IMPORTANT:** Before implementing, read `src/collections/Media.ts` to understand what fields are available on the Media collection. The search should use whatever fields actually exist — do NOT assume fields like `tags` or `destination` exist unless you verify them in the schema.

---

## Task 2: Implement `content-system/images/image-generator.ts`

Replace the stub. This generates photographic-quality prompts, NOT actual images.

```typescript
import { callModel } from '../openrouter-client'
import type { ImageGeneratorOptions, ImageGenerationResult } from './types'

export async function generateImagePrompts(options: ImageGeneratorOptions): Promise<ImageGenerationResult[]> {
  const count = options.count || 3

  const result = await callModel('editing', [
    {
      role: 'system',
      content: `You generate photographic image prompts for a luxury African safari travel website. Prompts should describe real photographic scenes — no illustrations, no AI art style. Think National Geographic quality. Each prompt should be specific enough to guide a photographer or be used with a photographic AI model.`
    },
    {
      role: 'user',
      content: `Generate ${count} image prompts for this content:

Title: ${options.title}
Type: ${options.contentType}
${options.promptPrefix ? `Additional context: ${options.promptPrefix}` : ''}

Return a JSON array of objects with "prompt" field only. No markdown fences.`
    },
  ], { maxTokens: 1024, temperature: 0.7 })

  let prompts: Array<{ prompt: string }>
  try {
    let text = result.content.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    prompts = JSON.parse(text)
  } catch {
    console.warn('[image-generator] Failed to parse prompt response')
    return []
  }

  return prompts.map(p => ({
    imageUrl: '', // No actual image generated
    prompt: p.prompt,
    status: 'candidate' as const,
  }))
}
```

---

## Task 3: Create API Route `/api/content/images/route.ts`

Create `src/app/(payload)/api/content/images/route.ts`:

- POST endpoint
- Accepts `{ projectId: number, action: 'search' | 'generate' }`
- For `search`: Loads project, extracts title/destinations/properties/species, calls `searchMediaLibrary`, writes results to `libraryMatches` field on project
- For `generate`: Calls `generateImagePrompts`, writes results to `generatedCandidates` array field on project
- Auth via Bearer or Payload session

---

## Task 4: Verification

### Test 4a: Library Search

```bash
curl -X POST https://kiuli.com/api/content/images \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID, "action": "search"}'
```

Expected: Returns matches from the Media collection. May be empty if no matching filenames exist.

Verify in database:

```sql
SELECT id, library_matches FROM content_projects WHERE id = PROJECT_ID;
```

### Test 4b: Prompt Generation

```bash
curl -X POST https://kiuli.com/api/content/images \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID, "action": "generate"}'
```

Expected: Returns generated prompts. Verify:

```sql
SELECT id, (SELECT COUNT(*) FROM content_projects_generated_candidates WHERE _parent_id = cp.id) as candidates
FROM content_projects cp WHERE id = PROJECT_ID;
```

### Gate F1: Image Pipeline Works

```
PASS criteria:
1. Library search returns results (or empty array if no matches — both are valid) without error
2. Prompt generation returns at least 1 prompt without error
3. Results are written to project's libraryMatches and generatedCandidates fields
4. Build passes
5. Route returns non-404 on production
```

---

## Commit

```bash
git add -A
git commit -m "feat: Phase F — image pipeline with media library search and photographic prompt generation"
git push
```

---

## Report Format

Write to `content-engine/reports/phaseF-image-pipeline.md`:

```markdown
# Phase F: Image Pipeline — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## Implementation
### Files Created/Modified
[list]

### Media Collection Schema
[Actual fields found in Media.ts that are searchable]

### Library Search
[How search works given the actual Media schema]

### Prompt Generator
[Model used, prompt approach]

## Verification
### Test 4a: Library Search
[response + DB verification]
### Test 4b: Prompt Generation
[response + DB verification]
### Gate F1: [PASS/FAIL]

## Git
- Committed: [YES/NO]
- Pushed: [YES/NO]

## Overall: [PASS / BLOCKED AT GATE]
```

---

## STOP CONDITIONS

- If the Media collection has zero records → library search will always be empty. Flag but continue.
- If OpenRouter fails for prompt generation → check API key. STOP and report.
