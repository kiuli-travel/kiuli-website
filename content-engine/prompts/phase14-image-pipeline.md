# Phase 14: Image Pipeline

**Context:** Phases 0–13 complete. Publishing pipeline functional. Post 22 published with no hero image. 644 images in Media collection with rich metadata (632 tagged, 130 with animals, 66 marked hero-suitable). Phase 14 builds image search, generation, selection, and wires them into the workspace, conversation handler, and publishers.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Follow the task order exactly.**
2. **All output must be raw evidence** — SQL results, file contents, build output.
3. **If any gate fails, STOP.**
4. **Do not skip any step.**
5. **No placeholders, no stubs, no TODOs.**

---

## Current State (verified)

**Media collection:** 644 images. Fields available for search: `country` (enum, 8 values), `imageType` (enum, 7 values), `animals` (jsonb array), `tags` (jsonb array), `scene` (text), `sourceProperty` (text), `isHero` (boolean), `quality` (enum), `composition` (enum), `mood` (multi-select), `setting` (multi-select), `suitableFor` (multi-select), `altText` (text), `url` (text), `filename` (text).

**ContentProjects:** Has `heroImage` relationship field (line 475 of `src/collections/ContentProjects/index.ts`), column `hero_image_id` in database. Currently null on all projects.

**Posts:** Has `heroImage` upload field (`relationTo: 'media'`), column `hero_image_id`. Not required (Phase 13 fix). Currently null on post 22.

**OpenRouter client:** Has `image` model purpose. Currently set to `anthropic/claude-sonnet-4` in the database — a text model that cannot generate images. Must be changed.

**OpenRouter image generation API (verified from docs 2026-02-18):**
- Endpoint: `POST /api/v1/chat/completions` (SAME endpoint as text — NOT a separate images endpoint)
- Required parameter: `modalities: ["image"]` (image-only models) or `modalities: ["image", "text"]` (multimodal like Gemini)
- Optional: `image_config: { aspect_ratio: "16:9" }` for aspect ratio control
- Response: `choices[0].message.images[].image_url.url` contains base64 data URL (`data:image/png;base64,...`)
- Available models include: `google/gemini-2.5-flash-preview-image`, `black-forest-labs/flux-1.1-pro`, `sourceful/riverflow-v2-fast`

**Conversation handler:** Action types: edit_field, edit_body, edit_section, edit_faq, stage_change, update_voice. No image actions. TAB_CONTEXT['Images'] says placeholder.

**ImagesTab:** Placeholder — `<div>Image management coming in a future phase.</div>`

**Article publisher:** Does not read or write heroImage.

**Workspace types:** No image-related fields on WorkspaceProject.

**Workspace page:** `transformProject` does not include heroImage.

**Server actions:** No image-related actions.

---

## PART A: Update Types

### Task 1: Replace `content-system/images/types.ts`

Replace the entire file with:

```typescript
export interface LibrarySearchOptions {
  /** Free-text query matched against tags, scene, altText */
  query?: string
  /** Filter by country (exact match) */
  countries?: string[]
  /** Filter by source property name (contains, case-insensitive) */
  properties?: string[]
  /** Filter by animals array (jsonb containment) */
  species?: string[]
  /** Filter by image type */
  imageTypes?: string[]
  /** Only return hero-suitable images */
  heroOnly?: boolean
  /** Filter by composition style */
  composition?: string
  /** Filter by suitableFor usage */
  suitableFor?: string
  /** Maximum results to return */
  maxResults?: number
}

export interface LibraryMatch {
  mediaId: number
  url: string
  thumbnailUrl: string | null
  alt: string
  altText: string | null
  scene: string | null
  country: string | null
  imageType: string | null
  sourceProperty: string | null
  animals: string[]
  tags: string[]
  isHero: boolean
  width: number | null
  height: number | null
  /** Relevance score (0-1). Higher = more criteria matched */
  score: number
}

export interface LibrarySearchResult {
  matches: LibraryMatch[]
  totalAvailable: number
  query: LibrarySearchOptions
}

export interface PhotoPrompt {
  /** The photographic prompt (camera-first language) */
  prompt: string
  /** Brief description of what this prompt aims to produce */
  intent: string
  /** Suggested aspect ratio */
  aspectRatio: '16:9' | '4:3' | '1:1' | '3:4' | '3:2' | '2:3'
}

export interface PromptGenerationOptions {
  /** Content project title */
  title: string
  /** Content type */
  contentType: string
  /** Destination countries */
  destinations: string[]
  /** Property names */
  properties: string[]
  /** Animal species */
  species: string[]
  /** Usage context */
  usage: 'hero-banner' | 'article-feature' | 'social'
  /** Number of prompt variants to generate */
  count?: number
}

export interface ImageGenerationResult {
  /** Payload Media ID of the uploaded image */
  mediaId: number
  /** The prompt used */
  prompt: string
  /** Model used for generation */
  model: string
}

export interface HeroSelectionResult {
  /** Media ID that was selected */
  mediaId: number
  /** Whether the content project was updated */
  projectUpdated: boolean
}
```

**Verification:** Read back the file. Confirm all interfaces are present. Confirm `ImageGenerationResult.mediaId` is a number (not a URL — generated images are uploaded to Media).

---

## PART B: Library Search Implementation

### Task 2: Replace `content-system/images/library-search.ts`

Replace the entire file (removing the `declare function` stub) with a real implementation.

**Algorithm:**

1. Build Payload `where` clause from search options:
   - `country`: `{ in: countries }` if provided
   - `imageType`: `{ in: imageTypes }` if provided
   - `isHero`: `{ equals: true }` if heroOnly
   - `composition`: `{ equals: composition }` if provided
   - `quality`: `{ equals: 'high' }` always (we only want quality images)

2. For species: Can't do jsonb containment via Payload `where`. Fetch a broader set and post-filter.

3. For free-text query: Can't do full-text search via Payload. Post-filter against `tags` jsonb array, `scene`, `altText`, `sourceProperty`.

4. For properties: Post-filter `sourceProperty` contains (case-insensitive).

**Strategy:** Fetch up to 200 images matching the broadest filterable criteria (country, imageType, isHero, composition, quality). Then post-filter and score.

**Scoring:**
- Country match: +0.15
- ImageType match: +0.10
- Species match (any animal in filter found in record's animals): +0.25
- Property match (sourceProperty contains any filter property): +0.20
- Query term match (any query word found in tags/scene/altText): +0.15 per term (capped at 0.30)
- isHero bonus: +0.10
- suitableFor match: +0.10

Normalise to 0-1. Sort descending. Return top `maxResults` (default 20).

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { LibrarySearchOptions, LibraryMatch, LibrarySearchResult } from './types'

export async function searchLibrary(options: LibrarySearchOptions): Promise<LibrarySearchResult> {
  const payload = await getPayload({ config: configPromise })

  // Build Payload where clause from filterable fields
  const where: Record<string, unknown> = {}
  const andClauses: Record<string, unknown>[] = []

  if (options.countries && options.countries.length > 0) {
    andClauses.push({ country: { in: options.countries } })
  }

  if (options.imageTypes && options.imageTypes.length > 0) {
    andClauses.push({ imageType: { in: options.imageTypes } })
  }

  if (options.heroOnly) {
    andClauses.push({ isHero: { equals: true } })
  }

  if (options.composition) {
    andClauses.push({ composition: { equals: options.composition } })
  }

  // Always filter to quality = high (we only have high, but future-proof)
  andClauses.push({
    or: [
      { quality: { equals: 'high' } },
      { quality: { exists: false } },
    ],
  })

  if (andClauses.length > 0) {
    where.and = andClauses
  }

  // Fetch a broad set for post-filtering + scoring
  const fetchLimit = 200
  const result = await payload.find({
    collection: 'media',
    where: Object.keys(where).length > 0 ? where : undefined,
    limit: fetchLimit,
    depth: 0,
    sort: '-createdAt',
  })

  const maxResults = options.maxResults ?? 20

  // Parse query terms for text matching
  const queryTerms = (options.query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2)

  const speciesLower = (options.species || []).map((s) => s.toLowerCase())
  const propertiesLower = (options.properties || []).map((p) => p.toLowerCase())

  // Score and filter
  const scored: LibraryMatch[] = []

  for (const doc of result.docs) {
    const raw = doc as unknown as Record<string, unknown>
    const tags: string[] = parseJsonArray(raw.tags)
    const animals: string[] = parseJsonArray(raw.animals)
    const tagsLower = tags.map((t) => t.toLowerCase())
    const animalsLower = animals.map((a) => a.toLowerCase())
    const sceneLower = ((raw.scene as string) || '').toLowerCase()
    const altTextLower = ((raw.altText as string) || '').toLowerCase()
    const sourcePropertyLower = ((raw.sourceProperty as string) || '').toLowerCase()

    let score = 0
    let maxPossible = 0

    // Country match
    if (options.countries && options.countries.length > 0) {
      maxPossible += 0.15
      if (options.countries.includes(raw.country as string)) {
        score += 0.15
      }
    }

    // ImageType match
    if (options.imageTypes && options.imageTypes.length > 0) {
      maxPossible += 0.10
      if (options.imageTypes.includes(raw.imageType as string)) {
        score += 0.10
      }
    }

    // Species match
    if (speciesLower.length > 0) {
      maxPossible += 0.25
      const hasSpecies = speciesLower.some((s) =>
        animalsLower.some((a) => a.includes(s) || s.includes(a))
      )
      if (hasSpecies) {
        score += 0.25
      } else {
        // Hard filter: if species requested but not in image, skip
        continue
      }
    }

    // Property match
    if (propertiesLower.length > 0) {
      maxPossible += 0.20
      const hasProperty = propertiesLower.some((p) =>
        sourcePropertyLower.includes(p) ||
        tagsLower.some((t) => t.includes(p))
      )
      if (hasProperty) {
        score += 0.20
      }
    }

    // Query text match
    if (queryTerms.length > 0) {
      maxPossible += 0.30
      const searchableText = [...tagsLower, sceneLower, altTextLower, sourcePropertyLower].join(' ')
      let matchedTerms = 0
      for (const term of queryTerms) {
        if (searchableText.includes(term)) matchedTerms++
      }
      const termScore = Math.min(0.30, (matchedTerms / queryTerms.length) * 0.30)
      score += termScore

      // If query terms provided and zero matches, skip
      if (matchedTerms === 0 && !options.countries && !options.species) {
        continue
      }
    }

    // isHero bonus
    if (raw.isHero) {
      score += 0.10
      maxPossible += 0.10
    } else {
      maxPossible += 0.10
    }

    // suitableFor match
    if (options.suitableFor) {
      maxPossible += 0.10
      const suitable = parseJsonArray(raw.suitableFor)
      if (suitable.includes(options.suitableFor)) {
        score += 0.10
      }
    }

    // Normalise
    const normalisedScore = maxPossible > 0 ? score / maxPossible : 0

    // Build URL
    const url = (raw.url as string) ||
      (raw.sizes_large_url as string) ||
      (raw.sizes_medium_url as string) || ''

    const thumbnailUrl = (raw.sizes_thumbnail_url as string) ||
      (raw.sizes_small_url as string) || null

    scored.push({
      mediaId: raw.id as number,
      url,
      thumbnailUrl,
      alt: (raw.alt as string) || '',
      altText: (raw.altText as string) || null,
      scene: (raw.scene as string) || null,
      country: (raw.country as string) || null,
      imageType: (raw.imageType as string) || null,
      sourceProperty: (raw.sourceProperty as string) || null,
      animals,
      tags,
      isHero: Boolean(raw.isHero),
      width: (raw.width as number) || null,
      height: (raw.height as number) || null,
      score: Math.round(normalisedScore * 100) / 100,
    })
  }

  // Sort by score descending, then by isHero, then by createdAt (newest)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (b.isHero !== a.isHero) return b.isHero ? 1 : -1
    return 0
  })

  return {
    matches: scored.slice(0, maxResults),
    totalAvailable: result.totalDocs,
    query: options,
  }
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string')
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter((v: unknown) => typeof v === 'string')
    } catch { /* not JSON */ }
  }
  return []
}
```

**Verification:** Read back the file. Confirm:
1. No `declare function` — it's a real implementation
2. Uses Payload `find` with `where` clauses
3. Post-filters for species (jsonb) and query text
4. Scoring algorithm with normalisation
5. Returns sorted results

---

## PART C: OpenRouter Client — Add Image Generation

### Task 3: Add `callImageGeneration` to `content-system/openrouter-client.ts`

Add this new exported function AFTER the existing `callModel` function. Do NOT modify `callModel` or any existing functions.

```typescript
/**
 * Generate an image via OpenRouter.
 *
 * OpenRouter image generation uses the SAME /api/v1/chat/completions endpoint
 * as text, but with the `modalities` parameter set to ["image"] or ["image", "text"].
 *
 * Response format: choices[0].message.images[].image_url.url (base64 data URL)
 *
 * See: https://openrouter.ai/docs/guides/overview/multimodal/image-generation
 */
export async function callImageGeneration(
  prompt: string,
  options?: { aspectRatio?: string },
): Promise<{ base64DataUrl: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set')
  }

  const model = await getModel('image')

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'user', content: prompt },
    ],
    modalities: ['image'],
  }

  if (options?.aspectRatio) {
    body.image_config = { aspect_ratio: options.aspectRatio }
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://kiuli.com',
    'X-Title': 'Kiuli Content Engine',
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (response.ok) {
      const data = await response.json()
      const message = data.choices?.[0]?.message
      const images = message?.images

      if (!images || images.length === 0) {
        throw new Error(
          `OpenRouter returned no images. Model: ${model}. ` +
          `Verify the model supports image output modalities. ` +
          `Response content: ${JSON.stringify(message?.content || '(empty)').slice(0, 200)}`
        )
      }

      const imageUrl = images[0].image_url?.url
      if (!imageUrl) {
        throw new Error(
          `OpenRouter image response missing image_url.url. ` +
          `Raw image object: ${JSON.stringify(images[0]).slice(0, 200)}`
        )
      }

      return {
        base64DataUrl: imageUrl,
        model: data.model || model,
      }
    }

    const status = response.status
    const errorBody = await response.text()

    if (status === 400 || status === 401 || status === 403 || status === 404) {
      throw new Error(`OpenRouter image generation error ${status}: ${errorBody}`)
    }

    if (status === 429 || status >= 500) {
      lastError = new Error(`OpenRouter image generation error ${status}: ${errorBody}`)
      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
    }

    throw new Error(`OpenRouter image generation unexpected status ${status}: ${errorBody}`)
  }

  throw lastError ?? new Error('OpenRouter image generation failed after retry')
}
```

**Verification:** Read back openrouter-client.ts. Confirm:
1. `callImageGeneration` is exported
2. Uses `/api/v1/chat/completions` endpoint (NOT `/api/v1/images/generations`)
3. Sends `modalities: ["image"]` in the request body
4. Reads response from `choices[0].message.images[0].image_url.url`
5. Supports optional `aspectRatio` via `image_config`
6. Same retry logic as `callModel`

### Task 3b: Update the imageModel in the database

```sql
UPDATE content_system_settings
SET image_model = 'google/gemini-2.5-flash-preview-image'
WHERE id = 1;
```

Then verify:

```sql
SELECT image_model FROM content_system_settings;
```

Expected: `google/gemini-2.5-flash-preview-image`

**Why this model:** It's multimodal (text + image output), available on OpenRouter, and cost-effective ($0.30/M input tokens). Gemini image models are confirmed working on OpenRouter as of August 2025.

---

## PART C2: Image Generator — Generate and Upload

### Task 4: Replace `content-system/images/image-generator.ts`

Replace the entire file. This module does TWO things:

1. `generatePhotographicPrompts` — Uses a text model to produce camera-first prompts
2. `generateAndUploadImage` — Calls OpenRouter for image generation, then uploads the result to Payload Media collection (which handles S3 storage automatically)

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { callModel, callImageGeneration } from '../openrouter-client'
import type {
  PromptGenerationOptions,
  PhotoPrompt,
  ImageGenerationResult,
} from './types'

/**
 * Generate photographic prompts using a text model.
 * Prompts describe camera behaviour — lens type, focal length, depth of field,
 * lighting direction — not scene description.
 */
export async function generatePhotographicPrompts(
  options: PromptGenerationOptions,
): Promise<PhotoPrompt[]> {
  const count = options.count ?? 3

  const systemPrompt = `You are an expert wildlife and travel photographer specialising in African safaris. You generate photographic prompts that describe CAMERA BEHAVIOUR, not scenes.

Every prompt must specify:
- Lens type and focal length (e.g., "70-200mm telephoto at 135mm")
- Aperture and depth of field (e.g., "f/2.8, shallow depth isolating subject")
- Lighting direction and quality (e.g., "backlit golden hour, rim lighting on fur")
- Camera position and angle (e.g., "low angle from vehicle roof hatch, eye level with subject")
- Film stock or colour science reference (e.g., "Kodak Portra 400 tonality, lifted shadows")

Never describe a scene narratively. Describe what the camera DOES.

Respond with a JSON array of objects, each with: prompt (string), intent (string, 1 sentence), aspectRatio ("16:9" | "4:3" | "1:1" | "3:4" | "3:2" | "2:3"). Nothing else — no markdown, no preamble.`

  const userPrompt = `Generate ${count} photographic prompts for:
Title: ${options.title}
Content type: ${options.contentType}
Destinations: ${options.destinations.join(', ') || 'African safari'}
Properties: ${options.properties.join(', ') || 'luxury lodge'}
Species: ${options.species.join(', ') || 'general wildlife'}
Usage: ${options.usage}

Make each prompt distinct — vary lens choice, lighting, angle, and time of day.`

  const result = await callModel('drafting', [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], {
    maxTokens: 2048,
    temperature: 0.7,
  })

  try {
    let text = result.content.trim()
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
    }
    const parsed = JSON.parse(text) as PhotoPrompt[]
    if (!Array.isArray(parsed)) throw new Error('Expected array')
    return parsed.filter(
      (p) => p.prompt && p.intent && p.aspectRatio,
    )
  } catch (err) {
    console.error('[image-generator] Failed to parse prompt response:', err)
    return [{
      prompt: result.content,
      intent: 'Raw prompt (parsing failed)',
      aspectRatio: '16:9',
    }]
  }
}

/**
 * Generate an image via OpenRouter and upload it to the Payload Media collection.
 *
 * Flow:
 * 1. Call OpenRouter with the prompt → receive base64 PNG data URL
 * 2. Decode base64 to Buffer
 * 3. Upload to Payload Media via payload.create() → S3 upload handled automatically
 * 4. Return the new Media record ID
 */
export async function generateAndUploadImage(
  prompt: string,
  metadata: {
    alt: string
    country?: string
    imageType?: string
    sourceItinerary?: string
    aspectRatio?: string
  },
): Promise<ImageGenerationResult> {
  // 1. Generate via OpenRouter
  const { base64DataUrl, model } = await callImageGeneration(prompt, {
    aspectRatio: metadata.aspectRatio,
  })

  // 2. Decode base64 data URL to Buffer
  // Format: data:image/png;base64,<data>
  const base64Match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!base64Match) {
    throw new Error(
      `Unexpected image data format. Expected base64 data URL, got: ${base64DataUrl.slice(0, 80)}...`
    )
  }

  const imageFormat = base64Match[1] // png, jpeg, webp
  const base64Data = base64Match[2]
  const buffer = Buffer.from(base64Data, 'base64')
  const mimeType = `image/${imageFormat}`
  const filename = `generated-${Date.now()}.${imageFormat}`

  // 3. Upload to Payload Media collection
  const payload = await getPayload({ config: configPromise })

  const mediaRecord = await payload.create({
    collection: 'media',
    data: {
      alt: metadata.alt,
      altText: metadata.alt,
      imageType: metadata.imageType || null,
      country: metadata.country || null,
      sourceItinerary: metadata.sourceItinerary || null,
      quality: 'high',
      isHero: true,
      scene: prompt.slice(0, 200),
      tags: ['ai-generated'],
      processingStatus: 'complete',
      labelingStatus: 'complete',
    },
    file: {
      data: buffer,
      mimetype: mimeType,
      name: filename,
      size: buffer.length,
    },
    overrideAccess: true,
  })

  const mediaId = (mediaRecord as unknown as Record<string, unknown>).id as number
  console.log(`[image-generator] Generated and uploaded image. Media ID: ${mediaId}, model: ${model}`)

  return {
    mediaId,
    prompt,
    model,
  }
}
```

**Verification:** Read back the file. Confirm:
1. `generatePhotographicPrompts` uses `callModel('drafting', ...)` (a text model — NOT the image model)
2. `generateAndUploadImage` calls `callImageGeneration` from openrouter-client
3. Decodes base64 data URL to Buffer
4. Uploads to Payload via `payload.create({ collection: 'media', file: { data: buffer, ... } })`
5. Returns `mediaId` (integer) — NOT a temporary URL
6. No text-model detection hack, no "go use this prompt elsewhere" fallback
7. Sets metadata on the Media record (alt, imageType, country, tags: ['ai-generated'])

---

## PART D: Workspace Types + Page Updates

### Task 5: Add image fields to WorkspaceProject

In `src/components/content-system/workspace-types.ts`, add to the `WorkspaceProject` interface:

```typescript
  /** Selected hero image */
  heroImage?: {
    id: number
    url: string
    thumbnailUrl: string | null
    alt: string
  }
```

**Verification:** Read back the file. Confirm the field exists on WorkspaceProject.

### Task 6: Add heroImage to workspace page

In `src/app/(payload)/admin/content-engine/project/[id]/page.tsx`, in the `WorkspacePage` default export function, AFTER fetching `raw` and BEFORE calling `transformProject`, add hero image resolution:

```typescript
  // Resolve hero image if set
  let heroImageData: WorkspaceProject['heroImage'] | undefined
  if (raw.heroImage && typeof raw.heroImage === 'number') {
    try {
      const media = await payload.findByID({
        collection: 'media',
        id: raw.heroImage as number,
        depth: 0,
      }) as unknown as Record<string, unknown>
      heroImageData = {
        id: media.id as number,
        url: (media.url as string) || (media.sizes_large_url as string) || '',
        thumbnailUrl: (media.sizes_thumbnail_url as string) || null,
        alt: (media.alt as string) || '',
      }
    } catch {
      // Media record not found — ignore
    }
  }

  const project = transformProject(raw)
  if (heroImageData) {
    project.heroImage = heroImageData
  }
```

Also add the import for `WorkspaceProject` type at the top if not already imported.

**Verification:** Read back the page. Confirm:
1. heroImage resolution happens after project fetch
2. Only fetches media if heroImage is a number (not null)
3. project.heroImage is set before passing to ProjectWorkspace

---

## PART E: Server Actions

### Task 7: Add searchImages action

In `src/app/(payload)/admin/content-engine/project/[id]/actions.ts`, add:

```typescript
// ── Action 12: Search Library Images ─────────────────────────────────────────

export async function searchImages(
  projectId: number,
  options: {
    query?: string
    countries?: string[]
    properties?: string[]
    species?: string[]
    imageTypes?: string[]
    heroOnly?: boolean
    maxResults?: number
  },
): Promise<{ success: true; matches: import('../../../../../../../content-system/images/types').LibraryMatch[] } | { error: string }> {
  const { user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  try {
    const { searchLibrary } = await import('../../../../../../../content-system/images/library-search')
    const result = await searchLibrary(options)
    return { success: true, matches: result.matches }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
```

### Task 8: Add selectHeroImage action

```typescript
// ── Action 13: Select Hero Image ─────────────────────────────────────────────

export async function selectHeroImage(
  projectId: number,
  mediaId: number,
): Promise<{ success: true; mediaId: number } | { error: string }> {
  const { payload, user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  try {
    // Verify media exists
    await payload.findByID({ collection: 'media', id: mediaId, depth: 0 })

    // Verify project exists
    await payload.findByID({ collection: 'content-projects', id: projectId, depth: 0 })

    // Update project's heroImage
    await payload.update({
      collection: 'content-projects',
      id: projectId,
      data: { heroImage: mediaId },
    })

    return { success: true, mediaId }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
```

### Task 9: Add generateImagePrompts action

```typescript
// ── Action 14: Generate Photographic Prompts ─────────────────────────────────

export async function generateImagePrompts(
  projectId: number,
  usage: 'hero-banner' | 'article-feature' | 'social',
): Promise<{ success: true; prompts: import('../../../../../../../content-system/images/types').PhotoPrompt[] } | { error: string }> {
  const { payload, user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  try {
    const project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    const { generatePhotographicPrompts } = await import('../../../../../../../content-system/images/image-generator')

    const prompts = await generatePhotographicPrompts({
      title: (project.title as string) || '',
      contentType: (project.contentType as string) || '',
      destinations: parseJsonArray(project.destinations),
      properties: parseJsonArray(project.properties),
      species: parseJsonArray(project.species),
      usage,
    })

    return { success: true, prompts }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
```

### Task 10: Add generateAndUploadImageAction

```typescript
// ── Action 15: Generate and Upload Image ─────────────────────────────────────

export async function generateAndUploadImageAction(
  projectId: number,
  prompt: string,
  metadata: {
    alt: string
    country?: string
    imageType?: string
    aspectRatio?: string
  },
): Promise<{ success: true; mediaId: number; model: string } | { error: string }> {
  const { payload, user } = await authenticate()
  if (!user) return { error: 'Not authenticated' }

  try {
    // Verify project exists
    const project = await payload.findByID({
      collection: 'content-projects',
      id: projectId,
      depth: 0,
    }) as unknown as Record<string, unknown>

    const { generateAndUploadImage } = await import('../../../../../../../content-system/images/image-generator')

    const result = await generateAndUploadImage(prompt, {
      ...metadata,
      sourceItinerary: (project.sourceItinerary as string) || undefined,
    })

    return { success: true, mediaId: result.mediaId, model: result.model }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}
```

**Verification:** Read back actions.ts. Confirm:
1. `searchImages` calls `searchLibrary`
2. `selectHeroImage` verifies media and project exist before updating
3. `generateImagePrompts` calls `generatePhotographicPrompts`
4. `generateAndUploadImageAction` calls `generateAndUploadImage` — returns mediaId (not a URL)
5. All follow the existing pattern: authenticate, try/catch, return `{success}` or `{error}`

---

## PART F: ImagesTab

### Task 11: Replace ImagesTab in ContentTabs.tsx

Replace the placeholder `ImagesTab` component with a real implementation. The component needs:

1. **Current hero image** display (if set)
2. **Auto-search** — on mount, auto-search using project's destinations/species/properties
3. **Search form** — country dropdown, image type dropdown, free text query, hero-only checkbox
4. **Results grid** — thumbnails with alt text, score badge, country/type badges
5. **Select as hero** button on each result
6. **Generate section** — "Generate Prompts" button, displays prompts, "Generate Image" button per prompt that calls generateAndUploadImageAction, then auto-selects the generated image as hero

```typescript
interface ImagesTabProps {
  project: WorkspaceProject
  projectId: number
  onDataChanged?: () => void
}
```

The component should:
- Import `searchImages`, `selectHeroImage`, `generateImagePrompts`, `generateAndUploadImageAction` from the actions file
- Use `useState` for: searchResults, searching, prompts, generating, generatingImage
- On mount: if project has destinations/species, auto-search with those filters
- Search form: country (select from known list), imageType (select from known list), query (text), heroOnly (checkbox)
- Results: grid of image cards, each showing thumbnail (or fallback to url), alt text, score, country badge, type badge. "Select as Hero" button on each.
- Current hero: if `project.heroImage` is set, display it prominently at the top
- Generate section: "Generate Prompts" button → shows prompts → "Generate Image" button per prompt → calls generateAndUploadImageAction → on success, auto-select as hero and trigger onDataChanged

Use the same style classes already defined in ContentTabs.tsx: `labelClass`, `inputClass`, `btnPrimary`, `btnSecondary`, `contentArea`.

Country options: Tanzania, Kenya, Botswana, Rwanda, South Africa, Zimbabwe, Zambia, Namibia, Uganda, Mozambique.
Image type options: wildlife, landscape, accommodation, activity, people, food, aerial, detail.

**Verification:** Read back the ImagesTab. Confirm:
1. Not a placeholder
2. Auto-search on mount
3. Search form with filters
4. Results grid with thumbnails and scores
5. Select as hero button
6. Generate prompts section
7. Generate image button that calls generateAndUploadImageAction and uploads to Media
8. Shows current hero image if set

---

## PART G: Wire ImagesTab into ProjectWorkspace

### Task 12: Update ProjectWorkspace.tsx

The current `renderTabContent` has a case for 'Images' that renders `<ImagesTab />` with no props. Update it to pass `project`, `projectId`, and `onDataChanged`.

**Verification:** Read back ProjectWorkspace.tsx. Confirm the Images case passes all required props.

---

## PART H: Conversation Handler Integration

### Task 13: Add image actions to conversation handler

In `content-system/conversation/handler.ts`:

1. Update `TAB_CONTEXT['Images']` from placeholder to:

```typescript
'The Images tab shows: the current hero image (if selected), library search results, and AI image generation. The designer can search the library, select a hero image, generate photographic prompts, and generate images from prompts. When the designer asks about images, use search_images to find matching images from the library, or select_hero to choose one.'
```

2. Add new action types to the system prompt's AVAILABLE ACTIONS:

```
7. search_images — Search the media library for matching images
   { "type": "search_images", "query": "optional text", "countries": ["Uganda"], "species": ["hippo"], "imageTypes": ["wildlife"], "heroOnly": true }

8. select_hero — Select a media image as the hero for this project
   { "type": "select_hero", "mediaId": 687 }
```

3. Add to `ParsedAction` interface:
```typescript
  countries?: string[]
  imageTypes?: string[]
  heroOnly?: boolean
  mediaId?: number
```

4. Add validation cases in `validateAction`:
```typescript
case 'search_images':
  return true
case 'select_hero':
  return typeof action.mediaId === 'number'
```

5. Add processing in `processProjectActions` for `select_hero`:
```typescript
case 'select_hero': {
  data.heroImage = action.mediaId
  appliedActions.push({
    type: 'select_hero',
    details: { mediaId: action.mediaId },
  })
  break
}
```

6. In `handleMessage`, BEFORE calling processProjectActions, process search_images actions:

```typescript
const searchActions = validActions.filter((a) => a.type === 'search_images')
let searchResultsSummary = ''
if (searchActions.length > 0) {
  try {
    const { searchLibrary } = await import('../images/library-search')
    const searchAction = searchActions[0]
    const searchResult = await searchLibrary({
      query: searchAction.value || searchAction.query,
      countries: searchAction.countries,
      species: searchAction.species,
      imageTypes: searchAction.imageTypes,
      heroOnly: searchAction.heroOnly,
      maxResults: 10,
    })
    if (searchResult.matches.length > 0) {
      searchResultsSummary = '\n\nLibrary search results:\n' +
        searchResult.matches.map((m, i) =>
          `${i + 1}. [ID: ${m.mediaId}] ${m.alt || m.scene || 'Untitled'} — ${m.country || 'Unknown'}, ${m.imageType || 'unknown type'}, score: ${m.score}`
        ).join('\n')
    } else {
      searchResultsSummary = '\n\nLibrary search returned no matching images.'
    }
  } catch (err) {
    searchResultsSummary = `\n\nImage search failed: ${err instanceof Error ? err.message : String(err)}`
  }
}

if (searchResultsSummary) {
  parsed.message += searchResultsSummary
}
```

7. Update `ConversationAction` type in `content-system/conversation/types.ts` if the type field is constrained — add `'search_images' | 'select_hero'` to the union.

**Verification:** Read back handler.ts. Confirm all 6 points above.

---

## PART I: Article Publisher Integration

### Task 14: Pass heroImage through on publish

In `content-system/publishing/article-publisher.ts`, after building `postData`, add:

```typescript
  const projectHeroImage = project.heroImage as number | null
  if (projectHeroImage) {
    postData.heroImage = projectHeroImage
  }
```

**Verification:** Read back article-publisher.ts. Confirm heroImage is conditionally added.

---

## PART J: Build and Verify

### Task 15: Build

```bash
npm run build 2>&1 | tail -50
```

### Gate 1: Build Passes

```
PASS criteria: Exit code 0.
FAIL action: STOP.
```

### Task 16: Verify imageModel was updated

```bash
npx tsx -e "
import { getPayload } from 'payload';
import configPromise from '@payload-config';
async function run() {
  const payload = await getPayload({ config: configPromise });
  const settings = await payload.findGlobal({ slug: 'content-system-settings' });
  console.log('imageModel:', settings.imageModel);
  if (settings.imageModel !== 'google/gemini-2.5-flash-preview-image') {
    console.log('FAIL: imageModel not updated');
    process.exit(1);
  }
  console.log('PASS: imageModel is correct');
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });
"
```

### Gate 2: Image Model Configured

```
PASS criteria: imageModel = 'google/gemini-2.5-flash-preview-image'
FAIL action: STOP.
```

### Task 17: Test library search

Create `content-engine/scripts/test-image-search.ts`:

```typescript
import { searchLibrary } from '../../content-system/images/library-search'

async function run() {
  console.log('=== Image Library Search Tests ===\n')

  console.log('Test 1: Uganda wildlife images')
  const r1 = await searchLibrary({ countries: ['Uganda'], imageTypes: ['wildlife'], maxResults: 5 })
  console.log(`  Found: ${r1.matches.length} matches (total available: ${r1.totalAvailable})`)
  for (const m of r1.matches) {
    console.log(`  [${m.mediaId}] score=${m.score} — ${m.alt?.slice(0, 60) || '(no alt)'}`)
  }

  console.log('\nTest 2: Hippo images')
  const r2 = await searchLibrary({ species: ['hippo'], maxResults: 5 })
  console.log(`  Found: ${r2.matches.length} matches`)
  for (const m of r2.matches) {
    console.log(`  [${m.mediaId}] score=${m.score} animals=${m.animals.join(',')} — ${m.alt?.slice(0, 60) || '(no alt)'}`)
  }

  console.log('\nTest 3: Query "gorilla trekking"')
  const r3 = await searchLibrary({ query: 'gorilla trekking', maxResults: 5 })
  console.log(`  Found: ${r3.matches.length} matches`)
  for (const m of r3.matches) {
    console.log(`  [${m.mediaId}] score=${m.score} — ${m.scene?.slice(0, 60) || '(no scene)'}`)
  }

  console.log('\nTest 4: Hero-suitable images in Kenya')
  const r4 = await searchLibrary({ countries: ['Kenya'], heroOnly: true, maxResults: 5 })
  console.log(`  Found: ${r4.matches.length} matches`)
  for (const m of r4.matches) {
    console.log(`  [${m.mediaId}] score=${m.score} isHero=${m.isHero} — ${m.alt?.slice(0, 60) || '(no alt)'}`)
  }

  console.log('\nTest 5: South Africa + accommodation + "luxury"')
  const r5 = await searchLibrary({
    countries: ['South Africa'],
    imageTypes: ['accommodation'],
    query: 'luxury',
    maxResults: 5,
  })
  console.log(`  Found: ${r5.matches.length} matches`)
  for (const m of r5.matches) {
    console.log(`  [${m.mediaId}] score=${m.score} — ${m.alt?.slice(0, 60) || '(no alt)'}`)
  }

  console.log('\nTest 6: Non-existent species "penguin"')
  const r6 = await searchLibrary({ species: ['penguin'], maxResults: 5 })
  console.log(`  Found: ${r6.matches.length} matches (expected 0)`)

  console.log('\n=== TESTS COMPLETE ===')
  process.exit(0)
}

run().catch((e) => { console.error(`FATAL: ${e.message}`); process.exit(1) })
```

```bash
npx tsx content-engine/scripts/test-image-search.ts
```

### Gate 3: Library Search Works

```
PASS criteria (ALL must be true):
1. Test 1: Uganda wildlife — returns > 0 matches, all with country=Uganda
2. Test 2: Hippo images — returns > 0 matches, all with hippo/hippos in animals
3. Test 3: Gorilla trekking — returns > 0 matches
4. Test 4: Hero-only Kenya — returns > 0 matches, all with isHero=true
5. Test 5: South Africa accommodation — returns > 0 matches
6. Test 6: Penguin — returns 0 matches

FAIL action: STOP.
```

### Task 18: Test image generation end-to-end

Create `content-engine/scripts/test-image-generation.ts`:

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { generateAndUploadImage } from '../../content-system/images/image-generator'

async function run() {
  console.log('=== Image Generation End-to-End Test ===\n')

  const payload = await getPayload({ config: configPromise })

  // Count media before
  const beforeCount = await payload.count({ collection: 'media' })
  console.log(`Media count before: ${beforeCount.totalDocs}`)

  // Generate and upload
  console.log('Generating image...')
  const result = await generateAndUploadImage(
    'African elephant at golden hour, photographed with a 200mm telephoto lens at f/4, shallow depth of field isolating the subject against a warm savanna backdrop, Kodak Portra 400 colour science with lifted shadows',
    {
      alt: 'AI-generated elephant at golden hour',
      country: 'Tanzania',
      imageType: 'wildlife',
      aspectRatio: '16:9',
    },
  )

  console.log(`Generated image. Media ID: ${result.mediaId}, model: ${result.model}`)

  // Verify the media record exists
  const media = await payload.findByID({
    collection: 'media',
    id: result.mediaId,
    depth: 0,
  }) as unknown as Record<string, unknown>

  console.log(`\nMedia record verification:`)
  console.log(`  ID: ${media.id}`)
  console.log(`  alt: ${media.alt}`)
  console.log(`  altText: ${media.altText}`)
  console.log(`  country: ${media.country}`)
  console.log(`  imageType: ${media.imageType}`)
  console.log(`  quality: ${media.quality}`)
  console.log(`  isHero: ${media.isHero}`)
  console.log(`  url: ${(media.url as string)?.slice(0, 80) || '(none)'}`)
  console.log(`  filename: ${media.filename}`)
  console.log(`  mimeType: ${media.mime_type || media.mimeType}`)
  console.log(`  tags: ${JSON.stringify(media.tags)}`)

  // Count media after
  const afterCount = await payload.count({ collection: 'media' })
  console.log(`\nMedia count after: ${afterCount.totalDocs}`)

  if (afterCount.totalDocs !== beforeCount.totalDocs + 1) {
    console.log('FAIL: Media count did not increase by 1')
    process.exit(1)
  }

  if (!media.url && !media.filename) {
    console.log('FAIL: Media record has no URL or filename')
    process.exit(1)
  }

  console.log('\n=== IMAGE GENERATION TEST PASSED ===')
  process.exit(0)
}

run().catch((e) => { console.error(`FATAL: ${e.message}`); process.exit(1) })
```

```bash
npx tsx content-engine/scripts/test-image-generation.ts
```

### Gate 4: Image Generation End-to-End

```
PASS criteria (ALL must be true):
1. No errors during generation
2. Media count increased by 1
3. New media record has url or filename populated
4. New media record has correct metadata (alt, country, imageType, tags=['ai-generated'])
5. isHero = true on the generated record

FAIL action: STOP. Include the full error output in the report.
```

### Task 19: Test hero selection

```bash
psql "$DATABASE_URL_UNPOOLED" -c "SELECT hero_image_id FROM content_projects WHERE id = 79;"
```

Create `content-engine/scripts/test-hero-selection.ts`:

```typescript
import { getPayload } from 'payload'
import configPromise from '@payload-config'

async function run() {
  const payload = await getPayload({ config: configPromise })
  console.log('=== Hero Selection Test ===\n')

  const results = await payload.find({
    collection: 'media',
    where: {
      country: { equals: 'Uganda' },
      imageType: { equals: 'wildlife' },
    },
    limit: 1,
    depth: 0,
  })

  if (results.docs.length === 0) {
    console.log('SKIP: No Uganda wildlife images found')
    process.exit(0)
  }

  const testMediaId = (results.docs[0] as unknown as Record<string, unknown>).id as number
  console.log(`Selected media ID: ${testMediaId}`)

  await payload.update({
    collection: 'content-projects',
    id: 79,
    data: { heroImage: testMediaId },
  })
  console.log('Set heroImage on project 79')

  const project = await payload.findByID({
    collection: 'content-projects',
    id: 79,
    depth: 0,
  }) as unknown as Record<string, unknown>

  const heroId = project.heroImage as number
  console.log(`Verified: project 79 heroImage = ${heroId}`)

  if (heroId !== testMediaId) {
    console.log('FAIL: heroImage mismatch')
    process.exit(1)
  }

  console.log('\n=== HERO SELECTION TEST PASSED ===')
  process.exit(0)
}

run().catch((e) => { console.error(`FATAL: ${e.message}`); process.exit(1) })
```

```bash
npx tsx content-engine/scripts/test-hero-selection.ts
```

### Gate 5: Hero Selection Works

```
PASS criteria:
1. Project 79 heroImage is set to a valid media ID
2. No errors during write

FAIL action: STOP.
```

### Task 20: Verify publisher integration

```sql
SELECT hero_image_id FROM posts WHERE id = 22;
SELECT hero_image_id FROM content_projects WHERE id = 79;
```

### Gate 6: Publisher Integration

```
PASS criteria:
1. Post 22 hero_image_id is still null (we didn't re-publish)
2. Project 79 hero_image_id is a valid integer
3. article-publisher.ts contains heroImage passthrough code
4. The passthrough is CONDITIONAL (only if projectHeroImage is truthy)

FAIL action: STOP.
```

---

## PART K: Commit and Push

### Task 21: Stage and commit

```bash
git add content-system/images/types.ts
git add content-system/images/library-search.ts
git add content-system/images/image-generator.ts
git add content-system/openrouter-client.ts
git add src/components/content-system/workspace-types.ts
git add src/components/content-system/workspace/ContentTabs.tsx
git add src/components/content-system/workspace/ProjectWorkspace.tsx
git add src/app/\(payload\)/admin/content-engine/project/\[id\]/page.tsx
git add src/app/\(payload\)/admin/content-engine/project/\[id\]/actions.ts
git add content-system/conversation/handler.ts
git add content-system/publishing/article-publisher.ts
git add content-engine/scripts/test-image-search.ts
git add content-engine/scripts/test-hero-selection.ts
git add content-engine/scripts/test-image-generation.ts
```

Stage any regenerated files:
```bash
git add src/payload-types.ts 2>/dev/null || true
git add "src/app/(payload)/importMap.js" 2>/dev/null || true
git add content-system/conversation/types.ts 2>/dev/null || true
```

```bash
git commit -m "feat: Phase 14 — image pipeline (library search, generation via OpenRouter, upload to Media, hero selection, workspace UI)"
git push
```

### Gate 7: Committed and Pushed

```
PASS criteria: Push succeeded, clean working tree.
FAIL action: STOP.
```

---

## Report

Create `content-engine/reports/phase14-image-pipeline.md`:

```markdown
# Phase 14: Image Pipeline — Execution Report

Date: [timestamp]
Executor: Claude CLI

## Summary
[Brief summary of what was built]

## PART A: Types
[Types file verified]

## PART B: Library Search
[Implementation details, scoring algorithm]

## PART C: OpenRouter Client + Image Model
[callImageGeneration function, imageModel updated to google/gemini-2.5-flash-preview-image]

## PART C2: Image Generator
[generatePhotographicPrompts + generateAndUploadImage — full pipeline from prompt to Media record]

## PART D: Workspace Types + Page
[heroImage added to WorkspaceProject, workspace page updated]

## PART E: Server Actions
[searchImages, selectHeroImage, generateImagePrompts, generateAndUploadImageAction]

## PART F: ImagesTab
[Component description, features]

## PART G: ProjectWorkspace Wiring
[Images tab props updated]

## PART H: Conversation Handler
[New action types, search integration]

## PART I: Article Publisher
[heroImage passthrough]

## PART J: Verification
### Gate 1: [PASS/FAIL] — Build
### Gate 2: [PASS/FAIL] — Image model configured
### Gate 3: [PASS/FAIL] — Library search (6 test cases)
### Gate 4: [PASS/FAIL] — Image generation end-to-end (generate → upload → verify in Media)
### Gate 5: [PASS/FAIL] — Hero selection
### Gate 6: [PASS/FAIL] — Publisher integration

## PART K: Commit
### Gate 7: [PASS/FAIL] — Push
[Commit hash, file list]
```

---

## DO NOT

- Do not modify any collection schemas (Posts, ContentProjects, Media are correct as-is)
- Do not create migrations
- Do not modify the publish route or triggerPublish action
- Do not modify the article publisher beyond adding the heroImage passthrough
- Do not delete project 79's data or post 22
- Do not install new npm packages (everything needed is already available)

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.** Do not attempt repairs.
