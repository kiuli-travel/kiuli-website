# PHASE 14: KIULI IMAGE LIBRARY

## STRUCTURE

This prompt has two parts. Part 1 is INVESTIGATION. You must complete Part 1 in full before writing a single line of code. Part 2 is IMPLEMENTATION. Do not skip ahead. Do not assume you understand the system. Read every file listed. Record every finding.

---

# PART 1: INVESTIGATION

You must read and understand the complete image pipeline before any implementation work begins. The purpose of this investigation is to prevent you from making assumptions about how images flow through the system. The pipeline spans Lambda functions, S3, imgix, Payload CMS, and the Content Engine. You must understand all of it.

## Investigation Step 1: The Scraper

Read these files in full:

```
lambda/image-processor/processImage.js
lambda/image-processor/handler.js
lambda/image-processor/shared/s3.js
lambda/image-processor/shared/payload.js
```

Record the answers to these questions. Do not proceed until you can answer all of them:

1. Where does the scraper download images FROM? (exact URL pattern)
2. What S3 key pattern does it use when uploading to Kiuli's S3? (exact pattern with variables)
3. What S3 bucket does it upload to?
4. What `CacheControl` header does it set on uploaded objects?
5. How does it create the Payload Media record — JSON POST or multipart upload? Why?
6. What fields does it set on the Media record at creation time? List every field.
7. How does global deduplication work? What field is checked? What happens on a race condition?
8. What does `sharp` do to the image before Payload upload? What are the resize dimensions and quality?
9. What is `CHUNK_SIZE` in the handler? What happens when there are more images than one chunk?

## Investigation Step 2: The Labeler

Read these files in full:

```
lambda/labeler/handler.js
lambda/labeler/labelImage.js
lambda/labeler/shared/openrouter.js
```

Record the answers:

1. What AI model does the labeler use? (exact model string)
2. What endpoint does it call on OpenRouter? (exact URL path)
3. How does it get the image data for the AI call — from S3, from imgix, or both? In what order?
4. What does `sharp` do before sending the image to the AI? What dimensions?
5. What is `IMAGE_ENRICHMENT_SCHEMA`? List every field, its type, and its enum values where applicable.
6. How does `response_format` work? What does `strict: true` do?
7. What context does the labeler receive from the scraper? List every context field.
8. How does `buildEnrichmentPrompt` use the context? What does it inject into the prompt?
9. What fields does the labeler write back to the Media record? List every one.
10. How is `isHero` determined? What two conditions must be true?
11. What is `BATCH_SIZE`? What is `CONCURRENT`? How does batching work across invocations?

## Investigation Step 3: The Media Collection

Read this file in full:

```
src/collections/Media.ts
```

Record the answers:

1. List every field on the Media collection. Group them by category: dedup, processing, labeling, source context, enrichment, standard, upload.
2. What `imageSizes` are configured? List every size with its dimensions and crop settings.
3. What `mimeTypes` are accepted?
4. What is `adminThumbnail` set to?
5. Is `focalPoint` enabled?
6. What is the `staticDir`?
7. What access controls exist?

## Investigation Step 4: S3 and imgix

Read these files:

```
src/plugins/s3Storage.ts
next.config.js (the images.remotePatterns section)
```

Run this database query:

```sql
SELECT id, url, imgix_url, original_s3_key, source_s3_key,
       sizes_thumbnail_url, sizes_large_url, sizes_xlarge_url,
       width, height
FROM media LIMIT 5;
```

Record the answers:

1. How does the S3 storage plugin work? Does it intercept Payload uploads? Does it handle ALL files in the media collection?
2. What is the S3 bucket name? What region?
3. What is the imgix domain?
4. What does an imgix URL look like for a Kiuli image? (exact pattern with the S3 key)
5. What does `media.url` contain? Is it an S3 URL, an imgix URL, or a Payload API URL?
6. What do the `sizes_*_url` fields contain? Same question.
7. How does Next.js know it can load images from imgix? (the remotePatterns config)
8. When Payload creates image sizes (thumbnail, small, medium, etc.), does the S3 plugin upload those to S3 too?

## Investigation Step 5: The Content System's Image Stubs

Read these files:

```
content-system/images/types.ts
content-system/images/library-search.ts
content-system/images/image-generator.ts
content-system/openrouter-client.ts
```

Run this database query:

```sql
SELECT ideation_model, research_model, drafting_model, editing_model, image_model
FROM content_system_settings LIMIT 1;
```

Record the answers:

1. What types are currently defined? Are they correct for what we need?
2. Are `library-search.ts` and `image-generator.ts` real implementations or declaration stubs?
3. What does `callModel` do? What endpoint does it hit?
4. What is `getModel('image')` currently configured to return?
5. Is `callModel` appropriate for image generation? Why or why not?
6. What function would need to be ADDED to openrouter-client.ts for image generation?

## Investigation Step 6: Current Database State

Run these queries:

```sql
-- Total media and labeling coverage
SELECT count(*) total,
       count(CASE WHEN labeling_status = 'complete' THEN 1 END) labeled,
       count(CASE WHEN labeling_status = 'pending' THEN 1 END) pending,
       count(CASE WHEN labeling_status = 'failed' THEN 1 END) failed,
       count(original_s3_key) has_s3,
       count(imgix_url) has_imgix
FROM media;

-- Image types breakdown
SELECT image_type, count(*) FROM media GROUP BY image_type ORDER BY count(*) DESC;

-- Countries breakdown
SELECT country, count(*) FROM media GROUP BY country ORDER BY count(*) DESC;

-- Animals breakdown (top 20)
SELECT animal, count(*) FROM (
  SELECT jsonb_array_elements_text(animals) as animal FROM media WHERE animals IS NOT NULL
) sub GROUP BY animal ORDER BY count(*) DESC LIMIT 20;

-- Hero suitability
SELECT is_hero, count(*) FROM media GROUP BY is_hero;

-- Composition types
SELECT composition, count(*) FROM media GROUP BY composition ORDER BY count(*) DESC;

-- Quality distribution
SELECT quality, count(*) FROM media GROUP BY quality ORDER BY count(*) DESC;

-- Source properties (top 20)
SELECT source_property, count(*) FROM media WHERE source_property IS NOT NULL
GROUP BY source_property ORDER BY count(*) DESC LIMIT 20;

-- Content projects with hero images
SELECT id, title, hero_image_id FROM content_projects WHERE hero_image_id IS NOT NULL;

-- Posts with hero images
SELECT id, title, hero_image_id FROM posts WHERE hero_image_id IS NOT NULL;
```

Record every result. These numbers define what the library contains and what gaps exist.

## Investigation Step 7: The Workspace

Read the current ImagesTab placeholder and workspace structure:

```
src/components/content-system/workspace/ContentTabs.tsx (find the ImagesTab section)
src/components/content-system/workspace/ProjectWorkspace.tsx
src/components/content-system/workspace-types.ts
src/app/(payload)/admin/content-engine/project/[id]/page.tsx
src/app/(payload)/admin/content-engine/project/[id]/actions.ts
content-system/conversation/handler.ts
```

Record:

1. Where is the ImagesTab placeholder? What does it currently render?
2. What props does ProjectWorkspace pass to tab components?
3. Does `WorkspaceProject` have a `heroImage` field? Does `transformProject` extract it?
4. What server actions currently exist? What pattern do they follow?
5. What conversation handler actions exist? How are they validated and processed?
6. What is `TAB_CONTEXT['Images']` currently set to?

## INVESTIGATION CHECKPOINT

Before proceeding to Part 2, write a summary of your findings in a file at:

```
content-engine/investigation/phase14-findings.md
```

This file must contain:
- Every answer to every question above
- A diagram of the complete image flow: iTrvl CDN → S3 → imgix → Payload → Frontend
- A list of every field on the Media collection with its current database population rate
- The exact API patterns needed for image generation via OpenRouter
- Any discrepancies between documentation and code

Do NOT proceed to Part 2 until this file is written.

---

# PART 2: IMPLEMENTATION

## Architecture Overview

Phase 14 builds the **Kiuli Image Library** — a unified interface for browsing, searching, filtering, generating, and managing every image in the system. This is not a tab on the content workspace alone. It is a standalone admin page AND a reusable component that embeds into the content workspace's Images tab. One library, one interface, used everywhere.

### What the Image Library does:

1. **Browse and search** all 644+ existing Media records with multi-dimensional filtering
2. **Generate new images** of wildlife, landscapes, destinations, and countries using the highest-quality diffusion models available through OpenRouter
3. **NEVER generate property images** — properties use scraped images only, because generating property images would hallucinate features that don't exist
4. **Upload generated images** to S3 via Payload (using the same S3 storage plugin the scraper uses), making them first-class Media records indistinguishable from scraped images
5. **Label generated images** using the same GPT-4o enrichment pipeline the scraper uses
6. **Select hero images** for content projects
7. **Manage image metadata** — edit labels, tags, alt text

### Image sources and their rules:

| Source | What it contains | Generation allowed? |
|--------|-----------------|-------------------|
| Scraped (iTrvl) | Property photos, wildlife, landscapes, activities | N/A (already exists) |
| Generated (AI) | Wildlife, landscapes, destinations, countries | YES — wildlife, landscape, destination, country |
| Generated (AI) | Property/accommodation images | **ABSOLUTELY NOT** — hallucination risk |

### The generation constraint enforcement:

When a user attempts to generate an image, the system must check the requested `imageType`. If the type is `accommodation`, `room`, `dining`, `spa`, `lodge-interior`, `lodge-exterior`, `pool-deck`, `bedroom`, or any property-related category, the request must be REJECTED with a clear message: "Property images cannot be generated. Only scraped property images are used to ensure accuracy. Generate wildlife, landscape, destination, or country images instead."

This is not a soft warning. It is a hard gate. No property image generation under any circumstance.

---

## 2A: OpenRouter Image Generation Client

### Critical: How OpenRouter Image Generation Works

OpenRouter does NOT use a separate `/api/v1/images/generations` endpoint. Image generation goes through the SAME `/api/v1/chat/completions` endpoint used for text. The difference:

1. You add `modalities: ["image"]` (for image-only models) or `modalities: ["image", "text"]` (for multimodal models) to the request body
2. Images come back as base64-encoded data URLs in `response.choices[0].message.images` array (NOT in `content`)
3. You can control aspect ratio via `image_config: { aspect_ratio: "16:9" }` and resolution via `image_config: { image_size: "4K" }`

### Model Selection for Photorealistic Wildlife Photography

The mission is the highest possible realism. This is wildlife and nature photography that must be indistinguishable from camera-captured images. Based on current model capabilities (February 2026):

**Primary model: `black-forest-labs/flux.2-max`**
- Ranked #1 for photorealism on LM Arena
- 32B parameter flow-matching transformer with Mistral-3 vision-language conditioning
- Superior lighting physics, material rendering, depth, and composition
- Supports 4MP output (2048x2048 or equivalent)
- Pricing: $0.07/first MP output, $0.03/subsequent MP
- Modalities: `["image"]` (image-only model)

**Fallback model: `black-forest-labs/flux.2-pro`**
- Same architecture family, production-optimised
- Pricing: $0.03/first MP, $0.015/subsequent MP
- Good for iteration and preview before committing to max quality

**Evaluation model: `bytedance-seed/seedream-4.5`**
- Native 4K output
- $0.04/image flat rate
- Strong competitor — the investigation should include a side-by-side test

### Implementation in openrouter-client.ts

Add a new exported function `callImageGeneration` alongside the existing `callModel`. They share the same endpoint URL but the request shape differs:

```typescript
export async function callImageGeneration(
  prompt: string,
  options?: {
    model?: string        // override getModel('image')
    aspectRatio?: string  // e.g., "16:9", "3:2", "1:1"
    imageSize?: string    // e.g., "2K", "4K"
  }
): Promise<{ imageBase64: string; model: string; prompt: string }>
```

The function:
1. Calls `getModel('image')` to get the model string (or uses `options.model` override)
2. Builds the request body with `modalities: ["image"]`, the prompt as a user message, and `image_config` if aspect ratio or size specified
3. POSTs to `https://openrouter.ai/api/v1/chat/completions`
4. Parses the response: the image is in `data.choices[0].message.images[0]` as a data URL (e.g., `data:image/png;base64,....`)
5. Strips the data URL prefix, returns the raw base64 string plus the model name and prompt used
6. Retries once on 429/5xx (same pattern as `callModel`)
7. Throws on all other errors with the actual API response

### Update Content System Settings

The `imageModel` field must be updated from `anthropic/claude-sonnet-4` to `black-forest-labs/flux.2-max`:

```sql
UPDATE content_system_settings SET image_model = 'black-forest-labs/flux.2-max';
```

This is a required step, not optional.

---

## 2B: Prompt Generation for Wildlife Photography

Image generation prompts must describe camera behaviour, not scenes. The difference:

**Bad (scene description):** "A leopard sitting in a tree at sunset in the Serengeti"

**Good (camera behaviour):** "Telephoto wildlife photograph, 400mm f/2.8 lens, 1/2000s shutter speed, leopard resting on a sausage tree branch, Serengeti grassland background rendered as smooth golden bokeh by the wide aperture, golden hour side-lighting from camera-left creating rim light along the animal's coat, Fujifilm Velvia 50 colour rendition with saturated warm tones, shallow depth of field isolating subject from environment, eye-level perspective from game drive vehicle distance, slight atmospheric haze adding depth, natural pose with animal looking away from camera"

The prompt generator is a TEXT task using the `drafting` model (currently `anthropic/claude-sonnet-4`). It produces photographic prompts that tell the diffusion model HOW a real photographer would capture the scene.

### Prompt Generation Function

```typescript
export async function generatePhotographicPrompts(
  subject: {
    type: 'wildlife' | 'landscape' | 'destination' | 'country'
    species?: string       // e.g., "leopard", "elephant herd"
    destination?: string   // e.g., "Serengeti", "Okavango Delta"
    country?: string       // e.g., "Tanzania", "Botswana"
    mood?: string          // e.g., "dramatic", "serene", "intimate"
    timeOfDay?: string     // e.g., "golden-hour", "dawn", "night"
  },
  count?: number  // default 3
): Promise<Array<{
  prompt: string
  intent: string        // one-sentence description of what this produces
  aspectRatio: string   // recommended aspect ratio
  cameraSpec: string    // e.g., "400mm telephoto, f/2.8"
}>>
```

The function calls `callModel('drafting', ...)` with a system prompt that instructs the model to think like a wildlife photographer. The system prompt must include:

- Lens types and focal lengths appropriate to the subject (telephoto for wildlife, wide-angle for landscapes)
- Aperture and depth of field guidance
- Lighting direction and quality (golden hour, overcast, harsh midday to avoid, etc.)
- Film stock / colour science references (Fujifilm Velvia for saturated landscapes, Kodak Portra for softer tones)
- Camera position and perspective (eye-level from vehicle, low angle from hide, aerial)
- Environmental context (dust, haze, water spray, vegetation)
- Behavioural authenticity (animals in natural poses, not anthropomorphised)
- Composition rules (rule of thirds, leading lines, negative space)
- What to NEVER include: text, watermarks, borders, frames, human artifacts, obviously AI artifacts like extra limbs, impossible anatomy

The model returns a JSON array of prompt objects. Parse it. Return it.

### The Property Guard

`generatePhotographicPrompts` must check `subject.type` before proceeding. If the type is not one of `wildlife`, `landscape`, `destination`, `country`, throw an error. If the caller somehow passes property-related fields, reject. This is the first line of defence against property image generation.

---

## 2C: Image Upload Pipeline

When a generated image is approved, it must become a first-class Media record. The flow:

1. Decode the base64 image data into a Buffer
2. Generate a filename: `kiuli-gen-{timestamp}-{subject-type}.png`
3. Generate an S3 key: `media/generated/{subject-type}/{filename}`
4. Call `payload.create()` on the `media` collection with:
   - The file data (Buffer, filename, mimetype, size) — using Payload's file upload mechanism
   - Metadata fields: alt, country, imageType, animals, tags, scene, quality, isHero, composition, suitableFor
   - Source tracking: `sourceS3Key` set to `generated:{timestamp}` (unique, satisfies dedup constraint), `processingStatus: 'complete'`, `labelingStatus: 'pending'`
5. The S3 storage plugin intercepts the upload and puts the file in S3
6. Payload generates all image sizes (thumbnail through og) and the S3 plugin uploads those too
7. The Media record is created with all URLs populated

After creation, trigger labeling: call the same GPT-4o enrichment used by the Lambda labeler, but locally via the Content Engine's OpenRouter client. Use `analyzeImageWithContext` logic adapted for the content system — same schema, same structured outputs, same context-aware prompt. Update the Media record with the enrichment fields.

### Upload Function

```typescript
export async function uploadGeneratedImage(
  imageBase64: string,
  metadata: {
    type: 'wildlife' | 'landscape' | 'destination' | 'country'
    species?: string[]
    country?: string
    destination?: string
    prompt: string          // the prompt that generated this image
    aspectRatio?: string
  }
): Promise<{ mediaId: number; imgixUrl: string }>
```

### Local Labeling Function

```typescript
export async function labelMediaRecord(
  mediaId: number,
  context?: {
    country?: string
    destination?: string
    species?: string[]
  }
): Promise<void>
```

This function:
1. Fetches the Media record from Payload
2. Gets the image from S3 (using `originalS3Key`) or from the imgix URL
3. Resizes with sharp for AI consumption (1200x800 max, quality 75)
4. Calls GPT-4o via OpenRouter with the same `IMAGE_ENRICHMENT_SCHEMA` and context-aware prompt used by the Lambda labeler
5. Updates the Media record with all enrichment fields
6. Sets `labelingStatus: 'complete'` and `labeledAt`

This means the Content Engine has its own labeling capability, independent of the Lambda pipeline. Same model, same schema, same results. Generated images and scraped images get identical enrichment.

---

## 2D: Library Search

The search system queries the Media collection with multi-dimensional filtering. It must handle both Payload `where` clauses (for indexed enum fields) and JavaScript post-filtering (for jsonb arrays and text matching).

### Search Function

```typescript
export async function searchLibrary(options: {
  country?: string | string[]
  imageType?: string | string[]
  composition?: string | string[]
  mood?: string | string[]
  timeOfDay?: string | string[]
  setting?: string | string[]
  suitableFor?: string | string[]
  quality?: string
  isHero?: boolean
  species?: string[]           // matches against animals jsonb
  properties?: string[]        // matches against sourceProperty text
  query?: string               // free text against tags, scene, altText
  source?: 'scraped' | 'generated' | 'all'  // filter by origin
  excludeIds?: number[]        // exclude already-selected images
  limit?: number               // default 40
}): Promise<{
  matches: LibraryMatch[]
  total: number
  facets: {
    countries: Array<{ value: string; count: number }>
    imageTypes: Array<{ value: string; count: number }>
    species: Array<{ value: string; count: number }>
    properties: Array<{ value: string; count: number }>
  }
}>
```

**Payload `where` clause fields** (indexed, fast):
- country, imageType, composition, quality, isHero, timeOfDay, labelingStatus (always 'complete')

**Post-filter fields** (in JavaScript after fetch):
- species: check if any element in `animals` jsonb array matches any requested species (case-insensitive, singular/plural tolerance — "hippo" matches "hippos")
- properties: check if `sourceProperty` contains any requested property name (case-insensitive)
- query: check if any word appears in `tags` (jsonb array), `scene` (text), or `altText` (text)
- mood, setting, suitableFor: these are `hasMany` select fields — check for intersection
- source: if 'scraped', filter to records where `sourceS3Key` does NOT start with 'generated:'; if 'generated', filter to records where it DOES

**Facets:** After filtering, compute facet counts for the sidebar. Count distinct values of country, imageType, species (from animals arrays), and sourceProperty across all matching results (not just the returned page).

**Scoring:** Each match gets a relevance score based on how many filter criteria it matched. This is for sort order, not filtering. All returned results passed the filters. The score determines which appear first.

**Result shape:**

```typescript
interface LibraryMatch {
  mediaId: number
  url: string                    // Payload API URL
  imgixUrl: string | null        // imgix CDN URL (preferred for display)
  thumbnailUrl: string | null    // Payload thumbnail size URL
  alt: string
  altText: string | null
  country: string | null
  imageType: string | null
  composition: string | null
  animals: string[]
  tags: string[]
  scene: string | null
  sourceProperty: string | null
  isHero: boolean
  quality: string | null
  mood: string[]
  timeOfDay: string | null
  suitableFor: string[]
  width: number | null
  height: number | null
  source: 'scraped' | 'generated'
  score: number
}
```

---

## 2E: v0 Prompts for the Image Library UI

The Image Library UI must be designed using v0.dev, then implemented. This section defines the v0 prompts that will produce the component designs. After generating the v0 designs, implement them as real React components.

### v0 Prompt 1: Library Browser Page

Generate a v0 prompt and save it to `content-engine/v0-prompts/image-library-browser.md`:

**Design brief for v0:**

Design an admin image library browser for a luxury African safari company called Kiuli. This is a full-page admin interface at `/admin/image-library`.

Brand: Kiuli Teal (#486A6A), Clay (#DA7A5A), Charcoal (#404040), Gray (#DADADA), Ivory (#F5F3EB). Fonts: General Sans for headings, Satoshi for body. Understated luxury aesthetic — clean, matte, sophisticated. Not flashy.

Layout:
- Left sidebar (280px): Filter panel with collapsible sections
  - Country: multi-select checkboxes (Tanzania, Kenya, Botswana, Rwanda, South Africa, Zimbabwe, Zambia, Namibia, Uganda, Mozambique)
  - Image Type: multi-select checkboxes (Wildlife, Landscape, Accommodation, Activity, People, Food, Aerial, Detail)
  - Species: tag input with autocomplete from existing animals data
  - Property: tag input with autocomplete from sourceProperty data
  - Mood: multi-select (Serene, Adventurous, Romantic, Dramatic, Intimate, Luxurious, Wild, Peaceful)
  - Time of Day: multi-select (Dawn, Morning, Midday, Afternoon, Golden Hour, Dusk, Night)
  - Composition: multi-select (Hero, Establishing, Detail, Portrait, Action, Panoramic)
  - Suitable For: multi-select (Hero Banner, Article Feature, Gallery, Thumbnail, Social, Print)
  - Quality: single select (High, Medium, Low)
  - Hero Only: toggle switch
  - Source: radio (All, Scraped Only, Generated Only)
  - Clear All Filters button

- Main area:
  - Top bar: search text input (full-text across tags/scene/alt), result count ("247 images"), view toggle (grid/list), sort dropdown (Relevance, Newest, Country A-Z)
  - Image grid: responsive masonry layout, 3-4 columns depending on width
  - Each image card:
    - Thumbnail (loaded via imgix URL with ?w=400&h=300&fit=crop&auto=format)
    - On hover: overlay with alt text, country badge, type badge, species badges
    - Bottom: source indicator (camera icon for scraped, sparkle icon for generated)
    - Click: opens detail panel
  - Infinite scroll or Load More button

- Right detail panel (slides in, 400px): appears when an image is clicked
  - Large preview (imgix URL with ?w=800&auto=format)
  - All metadata fields displayed
  - "Select as Hero" button (when used within content workspace)
  - "Edit Metadata" button → inline editable fields
  - "Copy imgix URL" button
  - Image dimensions and file size
  - Source information (which itinerary, which property, or "AI Generated")
  - Download original button

- Bottom floating bar: "Generate New Image" button → opens generation panel

Active filter state shown as pills above the grid, each removable with × button.

### v0 Prompt 2: Image Generation Panel

Generate a v0 prompt and save it to `content-engine/v0-prompts/image-generation-panel.md`:

**Design brief for v0:**

Design a slide-over panel (from right, 600px wide) for generating AI wildlife and nature photography. Same Kiuli brand.

Sections:
1. Subject Selection
   - Type radio: Wildlife | Landscape | Destination | Country
   - IF Wildlife: Species input (autocomplete from known animals list), Country dropdown
   - IF Landscape: Destination input, Country dropdown
   - IF Destination: Destination name input, Country dropdown
   - IF Country: Country dropdown only
   - Mood dropdown (optional)
   - Time of Day dropdown (optional)

2. Prompt Generation
   - "Generate Prompts" button
   - Shows 3 prompt cards, each with:
     - The full photographic prompt text (readable, wrapped)
     - Camera spec summary (e.g., "400mm telephoto, f/2.8, golden hour")
     - Recommended aspect ratio
     - Intent description
     - "Edit Prompt" toggle → makes prompt text editable
     - "Generate Image" button per prompt

3. Generation Results
   - Shows generated images as they complete
   - Each result:
     - Large preview
     - The prompt that produced it
     - "Approve & Save to Library" button → uploads to S3, creates Media record, triggers labeling
     - "Regenerate" button → same prompt, new image
     - "Reject" button → discards

4. Safety Notice (always visible at top of panel)
   - "Generated images are limited to wildlife, landscapes, destinations, and countries. Property and accommodation images are never generated to ensure authenticity."

The generation panel must visually BLOCK any attempt to generate property images. If the user somehow selects Accommodation as an image type, show a red warning and disable the generate button.

### v0 Prompt 3: Embedded Library Picker

Generate a v0 prompt and save it to `content-engine/v0-prompts/image-library-picker.md`:

**Design brief for v0:**

Design a compact image picker component that embeds into other admin interfaces. This is used in the Content Workspace's Images tab and in itinerary editing. Same Kiuli brand.

Layout:
- Compact filter bar (horizontal, not sidebar): Country dropdown, Type dropdown, Species input, Free text search, Hero Only toggle
- Image grid below: 3 columns, smaller cards than the full library
- Each card: thumbnail, alt text on hover, "Select" button
- Current selection shown at top with large preview and "Remove" action
- "Open Full Library" link → navigates to /admin/image-library
- "Generate New" button → opens generation panel as modal

This component receives an `onSelect(mediaId)` callback and a `selectedId` prop. It's a controlled component that reports selection to the parent.

---

## 2F: Implementation Plan

### Task 1: Write the v0 prompts

Create the three v0 prompt files at:
- `content-engine/v0-prompts/image-library-browser.md`
- `content-engine/v0-prompts/image-generation-panel.md`
- `content-engine/v0-prompts/image-library-picker.md`

Each file must contain the complete v0 prompt ready to paste into v0.dev. Include the Kiuli brand system (colors, fonts, aesthetic principles). Include enough detail that v0 produces a usable starting point. Include sample data for the mockup.

### Task 2: Update openrouter-client.ts

Add `callImageGeneration` function as specified in 2A. This function uses the chat completions endpoint with `modalities` parameter. It does NOT use a separate images endpoint.

Test it:
```
content-engine/scripts/test-image-generation.ts
```
This test script:
1. Calls `callImageGeneration` with a simple wildlife prompt
2. Verifies the response contains base64 image data
3. Writes the image to a temp file and verifies it's a valid image (use sharp to read metadata)
4. Reports the model used, image dimensions, and file size

### Task 3: Update content_system_settings

```sql
UPDATE content_system_settings SET image_model = 'black-forest-labs/flux.2-max';
```

### Task 4: Implement prompt generator

Create `content-system/images/prompt-generator.ts` with the `generatePhotographicPrompts` function as specified in 2B. Include the property guard.

Test it:
```
content-engine/scripts/test-prompt-generator.ts
```
This test:
1. Generates 3 prompts for a leopard in Tanzania
2. Generates 3 prompts for a landscape of the Okavango Delta
3. Generates 3 prompts for a destination (Masai Mara)
4. Attempts to generate prompts for accommodation — expects rejection
5. Verifies all prompts contain camera-specific language (focal length, aperture, etc.)
6. Prints all generated prompts for human review

### Task 5: Implement upload pipeline

Create `content-system/images/upload-pipeline.ts` with `uploadGeneratedImage` function as specified in 2C.

Create `content-system/images/labeler.ts` with `labelMediaRecord` function as specified in 2C. Port the GPT-4o enrichment schema and prompt from `lambda/labeler/shared/openrouter.js` — use the exact same `IMAGE_ENRICHMENT_SCHEMA` and `buildEnrichmentPrompt` logic. Do not reinvent it. Copy and adapt for TypeScript.

Test it:
```
content-engine/scripts/test-upload-pipeline.ts
```
This test:
1. Generates an image using a test prompt
2. Uploads it via `uploadGeneratedImage`
3. Verifies the Media record exists in Payload with correct fields
4. Verifies the S3 key pattern is `media/generated/{type}/{filename}`
5. Verifies imgix URL works (HTTP 200)
6. Runs `labelMediaRecord` on the new image
7. Verifies enrichment fields are populated (scene, mood, animals, tags, etc.)
8. Verifies `labelingStatus` is 'complete'

### Task 6: Implement library search

Replace `content-system/images/library-search.ts` stub with the real implementation as specified in 2D.

Replace `content-system/images/types.ts` with the complete type definitions covering LibraryMatch, LibrarySearchResult, search options, prompt types, generation types, and upload types.

Test it:
```
content-engine/scripts/test-library-search.ts
```
This test runs these cases:
1. Search Uganda wildlife → results > 0, all country = Uganda
2. Search for hippo species → results > 0, all have hippo/hippos in animals
3. Search hero-only Kenya → results > 0, all isHero = true
4. Search for accommodation → results > 0 (these exist from scraping)
5. Free text "sunset savanna" → results > 0
6. Search for penguin → 0 results (expected, no penguins in library)
7. Search with country + species + imageType combined → results > 0
8. Facets returned with correct counts
9. Source filter 'generated' → returns only generated images (may be 0 until generation test runs)

### Task 7: Server actions

Add to `src/app/(payload)/admin/content-engine/project/[id]/actions.ts`:

- `searchImages(options)` → calls searchLibrary, returns matches and facets
- `selectHeroImage(projectId, mediaId)` → verifies both exist, updates content_projects.hero_image_id
- `removeHeroImage(projectId)` → sets hero_image_id to null
- `generateImagePrompts(subject)` → calls generatePhotographicPrompts, returns prompt array
- `generateAndSaveImage(prompt, metadata)` → calls callImageGeneration, uploadGeneratedImage, labelMediaRecord, returns new Media record
- `updateImageMetadata(mediaId, fields)` → updates specified fields on Media record

Also add a standalone action file for the library page:
`src/app/(payload)/admin/image-library/actions.ts` — same functions, not scoped to a project.

### Task 8: Implement the Image Library page

Create `src/app/(payload)/admin/image-library/page.tsx` — the standalone library browser.

This is a full admin page accessible at `admin.kiuli.com/image-library`. It uses the components designed via v0 prompts. It renders the library browser with all filters, the image grid, the detail panel, and the generation panel.

For the initial implementation, build the component directly using Tailwind CSS and the Kiuli design system. Use the v0 prompts as design reference. The component must be functional — real search, real filtering, real facets. Image generation works end-to-end: prompt generation → image generation → upload → labeling → appears in library.

### Task 9: Implement the embedded library picker

Create `src/components/content-system/workspace/ImageLibraryPicker.tsx` — the compact picker component.

Replace the placeholder ImagesTab in ContentTabs.tsx with a component that wraps the ImageLibraryPicker, pre-configured with the project's destinations, species, and country as default filters. The "Select" action calls `selectHeroImage`. The current hero is displayed at the top.

### Task 10: Wire into ProjectWorkspace

Update:
- `workspace-types.ts`: add `heroImage` field to WorkspaceProject
- `ProjectWorkspace.tsx`: pass required props to the ImagesTab
- `page.tsx`: resolve heroImage media record after project fetch
- `transformProject`: extract heroImage data

### Task 11: Update conversation handler

In `content-system/conversation/handler.ts`:

1. Update `TAB_CONTEXT['Images']` with real context — when the designer is on the Images tab, the system prompt includes the current hero image (if any) and the top 10 library matches for the project's topic
2. Add action types: `search_images`, `select_hero`, `remove_hero`, `generate_prompts`
3. Add validation for each action type
4. Process `select_hero` and `remove_hero` in projectActions
5. Process `search_images` and `generate_prompts` — these return data that should be included in the NEXT model response, which means they trigger a follow-up call. The model asks to search, the search runs, the results are injected into context, and the model responds again with knowledge of what was found

### Task 12: Update article publisher

In `content-system/publishing/article-publisher.ts`:

Add hero image passthrough: if `project.heroImage` is set, include it in the published post data as `heroImage: project.heroImage`.

### Task 13: Add nav link

Add "Image Library" to the admin navigation so designers can access it directly. Find where the Content Engine nav links are defined and add the new route.

---

## VERIFICATION GATES

### Gate 1: Build passes
```
npm run build
```
Exit code 0. No TypeScript errors. No missing imports.

### Gate 2: Image generation works end-to-end
```
npx tsx content-engine/scripts/test-image-generation.ts
```
- Generates an image using FLUX.2 Max via OpenRouter
- Image is valid (sharp can read dimensions)
- File size > 100KB (it's a real image, not a placeholder)

### Gate 3: Prompt generator works
```
npx tsx content-engine/scripts/test-prompt-generator.ts
```
- Wildlife prompts contain camera specs (focal length, aperture)
- Accommodation prompts are rejected
- Each prompt > 100 characters

### Gate 4: Upload pipeline works
```
npx tsx content-engine/scripts/test-upload-pipeline.ts
```
- Generated image becomes a Media record in Payload
- Media record has imgixUrl that returns HTTP 200
- Labeling produces enrichment fields (scene, animals, tags)
- Media record has all image sizes populated (thumbnail through og)

### Gate 5: Library search works
```
npx tsx content-engine/scripts/test-library-search.ts
```
- All 9 test cases pass
- Facets are populated
- Species filtering works on jsonb arrays
- Source filtering distinguishes scraped from generated

### Gate 6: Library page loads
- Navigate to admin.kiuli.com/image-library
- Page renders with filters and image grid
- Filters produce correct results
- Image detail panel works
- Generation panel opens

### Gate 7: Workspace integration works
- Navigate to a content project's Images tab
- Library picker renders with project-relevant defaults
- Hero selection updates the project
- Hero removal works
- Conversation handler can reference images

### Gate 8: Publisher integration works
- Verify article-publisher.ts includes heroImage passthrough
- Verify the conditional is correct (only when heroImage is set)

### Gate 9: Property guard is enforced
- Attempt to generate prompts for accommodation → rejected
- Attempt to generate image for property → rejected
- No code path exists that allows property image generation

### Gate 10: Commit and push
```
git add -A
git commit -m "Phase 14: Kiuli Image Library with generation, search, and management"
git push
```
- Clean working tree after push
- No uncommitted files

---

## FILES CREATED OR MODIFIED

### New files:
- `content-engine/investigation/phase14-findings.md`
- `content-engine/v0-prompts/image-library-browser.md`
- `content-engine/v0-prompts/image-generation-panel.md`
- `content-engine/v0-prompts/image-library-picker.md`
- `content-system/images/types.ts` (replaced)
- `content-system/images/library-search.ts` (replaced)
- `content-system/images/prompt-generator.ts`
- `content-system/images/upload-pipeline.ts`
- `content-system/images/labeler.ts`
- `src/app/(payload)/admin/image-library/page.tsx`
- `src/app/(payload)/admin/image-library/actions.ts`
- `src/components/content-system/workspace/ImageLibraryPicker.tsx`
- `content-engine/scripts/test-image-generation.ts`
- `content-engine/scripts/test-prompt-generator.ts`
- `content-engine/scripts/test-upload-pipeline.ts`
- `content-engine/scripts/test-library-search.ts`

### Modified files:
- `content-system/openrouter-client.ts` (add callImageGeneration)
- `content-system/images/image-generator.ts` (replaced stub)
- `src/components/content-system/workspace/ContentTabs.tsx` (replace ImagesTab placeholder)
- `src/components/content-system/workspace/ProjectWorkspace.tsx` (pass image props)
- `src/components/content-system/workspace-types.ts` (add heroImage)
- `src/app/(payload)/admin/content-engine/project/[id]/page.tsx` (resolve heroImage)
- `src/app/(payload)/admin/content-engine/project/[id]/actions.ts` (add image actions)
- `content-system/conversation/handler.ts` (add image actions and context)
- `content-system/publishing/article-publisher.ts` (heroImage passthrough)

---

## WHAT DONE LOOKS LIKE

When this phase is complete:

1. A designer can open admin.kiuli.com/image-library and browse all 644+ images with multi-dimensional filtering
2. They can generate photorealistic wildlife and nature photography using FLUX.2 Max through a clean UI
3. They CANNOT generate property images — the system prevents it at multiple levels
4. Generated images go through the same labeling pipeline as scraped images
5. Generated images are stored in S3, served via imgix, and are full Media records in Payload
6. In the content workspace, the Images tab shows a compact picker with project-relevant defaults
7. The conversation handler can search for and recommend images
8. Hero images flow through to published articles
9. Every image in the system is searchable, filterable, and manageable from one interface
