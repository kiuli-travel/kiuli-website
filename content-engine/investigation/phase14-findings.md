# Phase 14 Investigation Findings

## Investigation Step 1: The Scraper (Image Processor)

### 1. Where does the scraper download images FROM?
From the iTrvl imgix CDN: `https://itrvl-production-media.imgix.net/{sourceS3Key}` (configurable via `ITRVL_IMAGE_CDN_BASE` env var).

### 2. What S3 key pattern does it use when uploading?
`media/originals/{itineraryId}/{filename}` — where `filename` is extracted from the source key via `sourceKey.split('/').pop()`.

### 3. What S3 bucket does it upload to?
`kiuli-bucket` (from `S3_BUCKET` env var), region `eu-north-1`.

### 4. What CacheControl header does it set?
`public, max-age=31536000, immutable` — one year, immutable.

### 5. How does it create the Payload Media record?
**Multipart upload** (not JSON POST). It uses `FormData` with:
- `file` field: a `Blob` of the image buffer
- `_payload` field: a JSON string of all metadata

JSON-only POST returns 500 — Payload's upload collection requires the actual file.

### 6. What fields does it set on the Media record at creation time?
- `alt` — display name derived from filename
- `sourceS3Key` — original iTrvl S3 key (for dedup)
- `originalS3Key` — Kiuli S3 key path
- `imgixUrl` — constructed imgix URL with `?auto=format,compress&q=80`
- `sourceItinerary` — itinerary ID (number)
- `processingStatus` — `'complete'`
- `labelingStatus` — `'pending'`
- `usedInItineraries` — array with itinerary ID
- `sourceProperty` — from imageContext.propertyName (if present)
- `sourceSegmentType` — from imageContext.segmentType (if present)
- `sourceSegmentTitle` — from imageContext.segmentTitle (if present)
- `sourceDayIndex` — from imageContext.dayIndex (if present)
- `country` — from imageContext.country (if present)

### 7. How does global deduplication work?
Checks `sourceS3Key` field (unique, indexed) via `payload.findMediaBySourceS3Key()`. If a record exists, returns the existing media ID and updates `usedInItineraries`. On race condition (another Lambda creates the same record), catches the "Value must be unique" 400 error and retries the dedup lookup.

### 8. What does sharp do before Payload upload?
If width > 2400 OR height > 1600 OR file > 4MB, resizes to fit within **2400x1600** (inside, withoutEnlargement) and converts to JPEG quality **85**.

### 9. What is CHUNK_SIZE? What happens with more images?
`CHUNK_SIZE = 20`. Step Functions handles iteration — the Lambda returns `{ remaining: N }` and Step Functions re-invokes for the next chunk.

---

## Investigation Step 2: The Labeler

### 1. What AI model does the labeler use?
`openai/gpt-4o` (exact model string in `analyzeImageWithContext`).

### 2. What endpoint does it call?
`https://openrouter.ai/api/v1/chat/completions` — the standard chat completions endpoint.

### 3. How does it get image data?
Tries **S3 first** (via `GetObjectCommand`), falls back to **imgix URL** or `media.url`. S3 is preferred for reliability.

### 4. What does sharp do before AI?
If width > 1200 OR height > 800 OR file > 10MB, resizes to fit within **1200x800** (inside, withoutEnlargement) and converts to JPEG quality **75**.

### 5. IMAGE_ENRICHMENT_SCHEMA fields:

| Field | Type | Enum Values |
|-------|------|-------------|
| scene | string | — |
| mood | array of string | serene, adventurous, romantic, dramatic, intimate, luxurious, wild, peaceful |
| timeOfDay | string | dawn, morning, midday, afternoon, golden-hour, dusk, night |
| setting | array of string | lodge-interior, lodge-exterior, pool-deck, bedroom, dining, savanna, river-water, forest, mountain, bush-dinner, game-drive, walking-safari, aerial, spa |
| composition | string | hero, establishing, detail, portrait, action, panoramic |
| animals | array of string | — |
| altText | string | — |
| tags | array of string | — |
| suitableFor | array of string | hero-banner, article-feature, gallery, thumbnail, social, print |
| quality | string | high, medium, low |
| imageType | string | wildlife, landscape, accommodation, activity, people, food, aerial, detail |

All fields are required. `additionalProperties: false`.

### 6. How does response_format work?
Uses OpenAI's structured outputs with `response_format: { type: 'json_schema', json_schema: { name: 'image_enrichment', strict: true, schema: IMAGE_ENRICHMENT_SCHEMA } }`. `strict: true` guarantees the response matches the schema exactly — no missing fields, no extra fields, all enums respected.

### 7. Context fields from scraper:
- `propertyName` — from imageStatus or media.sourceProperty
- `country` — from imageStatus or media.country
- `segmentType` — from imageStatus or media.sourceSegmentType
- `segmentTitle` — from imageStatus or media.sourceSegmentTitle
- `dayIndex` — from imageStatus or media.sourceDayIndex

### 8. How does buildEnrichmentPrompt use context?
Injects a "GROUND TRUTH" section at the top listing property, country, segment type, and day. Also appends instructions to include property name in altText/tags if known, and include country in tags if known.

### 9. What fields does the labeler write back?
- Source context: `sourceProperty`, `sourceSegmentType`, `sourceSegmentTitle`, `sourceDayIndex`, `country`
- AI enrichment: `scene`, `mood`, `timeOfDay`, `setting`, `composition`, `suitableFor`, `animals`, `tags`
- Standard: `alt`, `altText`, `quality`, `imageType`, `isHero`
- Status: `labelingStatus` ('complete'), `labeledAt`, `processingError` (null)

### 10. How is isHero determined?
Two conditions: `composition === 'hero'` AND `quality === 'high'`.

### 11. Batching:
- `BATCH_SIZE = 10` — images per invocation
- `CONCURRENT = 3` — concurrent AI calls within a batch
- Processes in groups of CONCURRENT using `Promise.allSettled`
- Step Functions handles iteration between batches via `remaining` count

---

## Investigation Step 3: The Media Collection

### Fields grouped by category:

**Dedup:**
- `sourceS3Key` — text, unique, indexed

**Media Type:**
- `mediaType` — select (image/video)
- `videoContext` — select (hero/background/gallery), conditional on video

**Processing Status:**
- `processingStatus` — select (pending/processing/complete/failed)
- `processingError` — text

**Labeling Status:**
- `labelingStatus` — select (pending/processing/complete/failed/skipped)

**Usage Tracking:**
- `usedInItineraries` — relationship to itineraries, hasMany

**Standard:**
- `alt` — text
- `caption` — richText (lexical)
- `url` — text (read-only)

**Source Context (read-only):**
- `sourceItinerary` — text
- `s3Key` — text
- `sourceUrl` — text
- `originalS3Key` — text
- `imgixUrl` — text
- `sourceProperty` — text
- `sourceSegmentType` — select (stay/activity/transfer)
- `sourceSegmentTitle` — text
- `sourceDayIndex` — number

**Enrichment (AI-generated):**
- `location` — text
- `country` — select (10 African countries + Unknown)
- `imageType` — select (wildlife/landscape/accommodation/activity/people/food/aerial/detail)
- `animals` — json
- `tags` — json
- `altText` — text
- `isHero` — checkbox (default false)
- `quality` — select (high/medium/low)
- `scene` — text
- `mood` — select, hasMany (8 values)
- `timeOfDay` — select (7 values)
- `setting` — select, hasMany (14 values)
- `composition` — select (6 values)
- `suitableFor` — select, hasMany (6 values)

### Image Sizes:

| Name | Width | Height | Crop |
|------|-------|--------|------|
| thumbnail | 300 | auto | — |
| square | 500 | 500 | — |
| small | 600 | auto | — |
| medium | 900 | auto | — |
| large | 1400 | auto | — |
| xlarge | 1920 | auto | — |
| og | 1200 | 630 | center |

### Other upload config:
- `mimeTypes`: `image/*`, `video/mp4`, `video/webm`, `video/quicktime`
- `adminThumbnail`: `'thumbnail'`
- `focalPoint`: `true`
- `staticDir`: `../../public/media` (relative to collections dir)

### Access:
- `create`: authenticated
- `delete`: authenticated
- `read`: anyone
- `update`: authenticated

---

## Investigation Step 4: S3 and imgix

### 1. S3 storage plugin:
Uses `@payloadcms/storage-s3`. Configured for the `media` collection only (`collections: { media: true }`). It intercepts ALL Payload uploads for the media collection and stores them in S3 instead of locally.

### 2. S3 bucket and region:
Bucket: `S3_BUCKET` env var (kiuli-bucket). Region: `S3_REGION` env var (eu-north-1).

### 3. imgix domain:
`kiuli.imgix.net`

### 4. imgix URL pattern:
`https://kiuli.imgix.net/{s3Key}?auto=format,compress&q=80`
Example: `https://kiuli.imgix.net/media/originals/28/filename.jpeg?auto=format%2Ccompress&q=80`

### 5. What does media.url contain?
A **Payload API URL**: `/api/media/file/{filename}` — NOT an S3 or imgix URL. The S3 plugin redirects these to S3.

### 6. What do sizes_*_url fields contain?
Also **Payload API URLs**: `/api/media/file/{filename}-{width}x{height}.jpg`

### 7. Next.js remotePatterns for imgix:
```js
{ protocol: 'https', hostname: 'kiuli.imgix.net' }
{ protocol: 'https', hostname: 'kiuli-bucket.s3.eu-north-1.amazonaws.com' }
{ protocol: 'https', hostname: '*.s3.*.amazonaws.com' }
```

### 8. Does S3 plugin upload image sizes too?
Yes — the S3 plugin intercepts all files in the media collection, including generated sizes (thumbnail, small, medium, large, xlarge, og).

### Database sample (5 records):
- `url` = `/api/media/file/{filename}` (Payload API path)
- `imgix_url` = `https://kiuli.imgix.net/media/originals/{id}/{filename}?auto=format%2Ccompress&q=80`
- `original_s3_key` = `media/originals/{id}/{filename}`
- `sizes_thumbnail_url` = `/api/media/file/{filename}-300x169.jpg`
- Typical dimensions: 3840x2160 to 5760x3240

---

## Investigation Step 5: Content System's Image Stubs

### 1. Current types defined:
- `LibraryMatch` — minimal (mediaId, url, score, labels, alt)
- `ImageGenerationRequest` — minimal (prompt, style, aspectRatio)
- `ImageGenerationResult` — minimal (imageUrl, prompt, status)
- `LibrarySearchOptions` — minimal (query, destinations, properties, species, maxResults)
- `ImageGeneratorOptions` — minimal (projectId, contentType, title, promptPrefix, count)

These are **declaration stubs** — not aligned with the real Media schema or the enrichment pipeline.

### 2. Are library-search.ts and image-generator.ts real implementations?
**No** — both are `.d.ts`-style declaration files with `export declare function`. No implementations exist.

### 3. What does callModel do?
It fetches the model name from `content_system_settings` via `getModel(purpose)`, then POSTs to `https://openrouter.ai/api/v1/chat/completions` with the model, messages, max_tokens, and temperature. Returns `{ content, model, usage }`. Retries once on 429/5xx with 5s backoff.

### 4. What is getModel('image') currently configured to return?
Currently returns `anthropic/claude-sonnet-4` (the image_model field value in content_system_settings). This is a TEXT model, not an image generation model.

### 5. Is callModel appropriate for image generation?
**No** — `callModel` only handles text completions. Image generation requires `modalities: ["image"]` in the request and parses images from `response.choices[0].message.images`, not from `.message.content`. A new function is needed.

### 6. What function needs to be added?
`callImageGeneration(prompt, options?)` — uses the same endpoint but adds `modalities: ["image"]`, optional `image_config`, and parses the base64 image from the response's images array.

---

## Investigation Step 6: Current Database State

### Media overview:
| Metric | Value |
|--------|-------|
| Total media records | 644 |
| Labeled (complete) | 632 |
| Pending labeling | 0 |
| Failed labeling | 0 |
| Has S3 key | 643 |
| Has imgix URL | 643 |
| Unlabeled (no status) | 12 |

### Image types:
| Type | Count |
|------|-------|
| accommodation | 379 |
| wildlife | 104 |
| activity | 66 |
| landscape | 49 |
| people | 16 |
| food | 12 |
| (null) | 12 |
| aerial | 6 |

### Countries:
| Country | Count |
|---------|-------|
| South Africa | 102 |
| Namibia | 95 |
| Kenya | 93 |
| Botswana | 92 |
| Uganda | 88 |
| Rwanda | 79 |
| Tanzania | 73 |
| (null) | 12 |
| Mozambique | 10 |

### Animals (top 20):
| Animal | Count |
|--------|-------|
| elephant | 20 |
| giraffe | 16 |
| gorilla | 13 |
| elephants | 12 |
| lion | 9 |
| wildebeest | 7 |
| leopard | 7 |
| zebra | 6 |
| chimpanzee | 6 |
| golden monkey | 5 |
| hippo | 4 |
| lions | 4 |
| antelope | 3 |
| zebras | 3 |
| hippos | 3 |
| oryx | 2 |
| rhino | 2 |
| wildebeests | 2 |
| bird | 1 |
| lizard | 1 |

Note: plural/singular inconsistency (elephant/elephants, lion/lions, hippo/hippos, zebra/zebras, wildebeest/wildebeests). Library search must handle this.

### Hero suitability:
| isHero | Count |
|--------|-------|
| false | 578 |
| true | 66 |

### Composition:
| Type | Count |
|------|-------|
| establishing | 341 |
| portrait | 70 |
| hero | 66 |
| action | 64 |
| panoramic | 49 |
| detail | 42 |
| (null) | 12 |

### Quality:
| Quality | Count |
|---------|-------|
| high | 632 |
| (null) | 12 |

### Mood (from media_mood junction table):
| Mood | Count |
|------|-------|
| luxurious | 387 |
| serene | 294 |
| intimate | 192 |
| peaceful | 185 |
| wild | 132 |
| adventurous | 114 |
| romantic | 72 |
| dramatic | 38 |

### Time of Day:
| Time | Count |
|------|-------|
| afternoon | 315 |
| midday | 97 |
| dusk | 65 |
| morning | 62 |
| golden-hour | 58 |
| night | 19 |
| dawn | 16 |
| (null) | 12 |

### Setting (from media_setting junction table):
| Setting | Count |
|---------|-------|
| lodge-interior | 192 |
| savanna | 190 |
| lodge-exterior | 186 |
| bedroom | 94 |
| dining | 77 |
| river-water | 76 |
| forest | 61 |
| pool-deck | 57 |
| game-drive | 30 |
| aerial | 29 |
| mountain | 24 |
| walking-safari | 21 |
| spa | 18 |
| bush-dinner | 17 |

### Suitable For (from media_suitable_for junction table):
| Usage | Count |
|-------|-------|
| article-feature | 623 |
| gallery | 621 |
| social | 548 |
| print | 425 |
| hero-banner | 290 |
| thumbnail | 16 |

### Source Properties (top 20):
| Property | Count |
|----------|-------|
| Wilderness Serra Cafema | 43 |
| Wilderness Desert Rhino Camp | 41 |
| Wilderness Little Mombo | 40 |
| Wilderness DumaTau | 34 |
| Wilderness Bisate Reserve | 27 |
| The Silo | 21 |
| Little Chem Chem | 19 |
| Wilderness Magashi Peninsula | 19 |
| La Residence | 19 |
| Jacks Camp | 18 |
| Lewa House | 17 |
| Elewana Loisaba Lodo Springs | 17 |
| The Saxon Boutique Hotel, Villas and Spa | 17 |
| Nyasi Tented Camp | 17 |
| Clouds Mountain Gorilla Lodge | 17 |
| Singita Boulders | 16 |
| Mwiba Lodge | 15 |
| Giraffe Manor | 14 |
| Nile Safari Lodge | 14 |
| Tswalu Loapi | 13 |

### Content projects with hero images:
None — 0 rows. No hero images selected yet.

### Posts with hero images:
None — 0 rows. No hero images on posts yet.

---

## Investigation Step 7: The Workspace

### 1. ImagesTab placeholder:
Located in `ContentTabs.tsx`. Renders: `"Image management coming in a future phase."` — a centered placeholder div with no functionality.

### 2. Props passed to tab components:
Tab components receive `project: WorkspaceProject` and `projectId: number`. Some also receive `onDataChanged?: () => void` and `onFocusSection?: (sectionName: string) => void`.

### 3. Does WorkspaceProject have heroImage?
**No** — `WorkspaceProject` does not have a `heroImage` field. The `content_projects` table HAS `hero_image_id` (integer FK to media), but `transformProject` does not extract it.

### 4. Server actions pattern:
Actions are `'use server'` functions that:
1. Call `authenticate()` to get payload instance and user
2. Validate user is logged in
3. Fetch the project
4. Perform the operation
5. Return `{ success: true, ... }` or `{ error: string }`

Existing actions: `sendConversationMessage`, `fetchProjectData`, `advanceProjectStage`, `rejectProject`, `saveProjectFields`, `triggerResearch`, `triggerDraft`, `saveFaqItems`, `triggerConsistencyCheck`, `resolveConsistencyIssue`, `triggerPublish`.

### 5. Conversation handler actions:
Supported action types: `edit_field`, `edit_body`, `edit_section`, `edit_faq`, `stage_change`, `update_voice`. Validated by `validateAction()` and processed by `processProjectActions()` (batched into single DB write) and `processVoiceActions()` (writes to BrandVoice global).

### 6. TAB_CONTEXT['Images']:
Currently set to: `'The Images tab is a placeholder. No actions available for images yet.'`

---

## Image Flow Diagram

```
iTrvl CDN (itrvl-production-media.imgix.net)
  │
  ▼ [download via HTTP]
Image Processor Lambda (processImage.js)
  │
  ├──▶ S3 Upload: kiuli-bucket/media/originals/{itineraryId}/{filename}
  │    CacheControl: public, max-age=31536000, immutable
  │
  ├──▶ sharp resize (if needed): 2400x1600 max, JPEG q85
  │
  └──▶ Payload Media record (multipart upload)
       - sourceS3Key (dedup key)
       - originalS3Key (Kiuli S3 path)
       - imgixUrl (constructed)
       - processingStatus: complete
       - labelingStatus: pending
       │
       ▼ [Payload S3 plugin intercepts]
       S3 Upload: all image sizes (thumbnail, small, medium, large, xlarge, og)
       │
       ▼ [Step Functions triggers next phase]
Labeler Lambda (labelImage.js)
  │
  ├──▶ Fetch image from S3 (or imgix fallback)
  ├──▶ sharp resize: 1200x800 max, JPEG q75
  ├──▶ GPT-4o via OpenRouter (structured outputs)
  │    - IMAGE_ENRICHMENT_SCHEMA
  │    - Context: property, country, segment, day
  │
  └──▶ Update Media record with enrichment
       - scene, mood, timeOfDay, setting, composition
       - animals, tags, altText, suitableFor
       - quality, imageType, isHero
       - labelingStatus: complete
       │
       ▼ [Serving]
  imgix CDN: https://kiuli.imgix.net/{s3Key}?auto=format,compress&q=80
  Payload API: /api/media/file/{filename} (S3 plugin redirects)
  Next.js: <Image> with imgix URL via remotePatterns
```

---

## Field Population Rates

| Field | Populated | Total | Rate |
|-------|-----------|-------|------|
| sourceS3Key | 644 (source_s3_key) | 644 | 100% |
| originalS3Key | 643 | 644 | 99.8% |
| imgixUrl | 643 | 644 | 99.8% |
| labelingStatus=complete | 632 | 644 | 98.1% |
| quality | 632 | 644 | 98.1% |
| country | 632 | 644 | 98.1% |
| imageType | 632 | 644 | 98.1% |
| composition | 632 | 644 | 98.1% |
| timeOfDay | 632 | 644 | 98.1% |
| isHero | 644 (all have value) | 644 | 100% |
| scene | ~632 | 644 | ~98% |
| altText | ~632 | 644 | ~98% |
| animals (json) | varies | 644 | — |
| tags (json) | ~632 | 644 | ~98% |
| sourceProperty | ~551 | 644 | ~86% |
| mood (junction) | 1414 entries | 644 | ~2.2 avg |
| setting (junction) | 1072 entries | 644 | ~1.7 avg |
| suitableFor (junction) | 2523 entries | 644 | ~3.9 avg |

12 records are unlabeled (no enrichment fields, likely uploaded without going through labeling pipeline).

---

## Key Discrepancies and Notes

1. **labeledAt field**: The labeler code sets `labeledAt` but the Media collection schema does NOT define a `labeledAt` field. This field silently fails to persist. Not critical but worth noting.

2. **Plural/singular animals**: The animals jsonb array contains both "elephant" and "elephants", "lion" and "lions", etc. Library search must normalize these.

3. **Multi-select storage**: `mood`, `setting`, and `suitableFor` are stored in junction tables (`media_mood`, `media_setting`, `media_suitable_for`), NOT in the main media table. Library search via Payload API handles this transparently, but raw SQL queries must JOIN.

4. **heroImage already wired**: `content_projects` table already has `hero_image_id` (FK to media) and `library_matches` (jsonb). The schema is ready; only the UI and actions are missing.

5. **Image model misconfigured**: `content_system_settings.image_model` is `anthropic/claude-sonnet-4` — a text model, not an image generation model. Must be updated to `black-forest-labs/flux.2-max`.

6. **12 orphan records**: 12 media records have no labeling data (null country, null imageType, null quality, etc.). These appear to have been uploaded outside the pipeline.

---

## OpenRouter Image Generation API Pattern

Based on OpenRouter documentation, image generation uses the same chat completions endpoint:

```json
POST https://openrouter.ai/api/v1/chat/completions
{
  "model": "black-forest-labs/flux.2-max",
  "modalities": ["image"],
  "messages": [
    { "role": "user", "content": "photographic prompt here" }
  ],
  "image_config": {
    "aspect_ratio": "16:9",
    "image_size": "4K"
  }
}
```

Response:
```json
{
  "choices": [{
    "message": {
      "images": ["data:image/png;base64,iVBOR..."]
    }
  }]
}
```

Key differences from text completion:
- `modalities: ["image"]` in request body
- Images in `choices[0].message.images[]` (array of data URLs), NOT in `content`
- `image_config` for aspect ratio and resolution control
