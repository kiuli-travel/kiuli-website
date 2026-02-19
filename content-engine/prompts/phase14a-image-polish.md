# PHASE 14a — Image Library Polish & Completion

Phase 14 built the plumbing. This phase makes it actually usable.

## Rules

Same as Phase 14 verification: evidence files for every gate, fix and re-run (don't weaken assertions), stop gates before expensive operations.

---

## INVESTIGATION (Read before coding)

Read these files and confirm you understand the current state:

1. `src/app/(payload)/admin/image-library/page.tsx` — the full library page
2. `src/components/content-system/workspace/ImageLibraryPicker.tsx` — the embedded workspace picker
3. `src/app/(payload)/admin/image-library/actions.ts` — server actions
4. `content-system/images/upload-pipeline.ts` — how generated images are saved
5. `content-system/images/types.ts` — all type definitions
6. `src/app/(payload)/admin/content-engine/project/[id]/page.tsx` — how hero image is resolved server-side
7. `src/app/(payload)/admin/content-engine/project/[id]/actions.ts` — `fetchProjectData` and `transformProject`
8. `content-system/publishing/article-publisher.ts` — how hero image flows to published posts
9. `src/collections/Media.ts` — Media collection schema (what fields exist on the record)

After reading, write a brief summary of what you found to `content-engine/evidence/phase14a-investigation.txt`. This is NOT optional — it prevents you from making assumptions about field names, type signatures, and data flow.

---

## TASK 1 — Fix hero image selection feedback

**Problem:** Clicking an image in the workspace picker calls `selectHeroImage` server action, which saves to DB. But the local component state doesn't update. The user sees no change. No confirmation. No visual highlight on the selected image.

**Fix in `ImageLibraryPicker.tsx`:**

1. Add local state for `currentHeroId` initialized from `selectedId` prop
2. After successful `selectHeroImage` call, update `currentHeroId` locally AND call `onHeroChanged`
3. Show a brief "Hero image saved" toast/indicator (a temporary green message, not a modal)
4. Highlight the currently-selected image in the grid with a visible border/ring
5. The "Current Hero Image" section at the top should update immediately using local state, not wait for server re-render

**Fix in `actions.ts` (`fetchProjectData`):**

The server-side `transformProject` in `actions.ts` does NOT resolve the hero image media record. It only sets `heroImageId`. But `heroImageImgixUrl` and `heroImageAlt` stay undefined. This means when the client refreshes project data after hero selection, the hero image preview won't render.

Add hero image resolution to `fetchProjectData`:
```
// After transformProject, if heroImageId is set, fetch the media record
// and populate heroImageImgixUrl and heroImageAlt
```

This mirrors what page.tsx already does in the server component.

---

## TASK 2 — Add free-text prompt field for image generation

**Problem:** The generation panel only allows structured input (type, species, destination, country, mood, time of day). Users need to describe exactly what they want: "aerial photo of pods of hippos in the Kazinga channel" or "close-up of a silverback gorilla's hands in Bwindi."

**Fix in the generation panel (both library page and workspace picker):**

1. Add a textarea field labeled "Scene Description (optional)" below the structured fields
2. When present, the scene description is passed to the prompt generator as additional context
3. The prompt generator should incorporate it into the photographic prompts while still adding camera specs

**Fix in `prompt-generator.ts`:**

Add an optional `description` field to `PhotographicSubject`:
```typescript
description?: string  // Free-text scene description, e.g., "aerial photo of pods of hippos in the Kazinga channel"
```

In `buildUserPrompt`, if `subject.description` is set, include it:
```
The user wants: {subject.description}
Incorporate this specific scene into your photographic prompts while adding camera specifications, lighting, and technical details.
```

**Fix in types.ts:**
Add `description?: string` to `PhotographicSubject`

**Fix in server actions:**
Pass `description` through from the UI to the prompt generator

---

## TASK 3 — Store generation metadata on Media records

**Problem:** When an image is generated, the prompt, model, and timestamp are not saved to the Media record. The detail panel can't show generation provenance.

**Check first:** Read `src/collections/Media.ts` to see what fields exist. The Media collection likely already has fields from the labeler (scene, tags, etc.) but may not have generation-specific fields.

**If fields don't exist, add to Media collection:**
- `generationPrompt` (textarea) — the prompt used to generate the image
- `generationModel` (text) — the model that generated it (e.g., "black-forest-labs/flux.2-max")
- `generatedAt` (date) — when it was generated

**Fix in `upload-pipeline.ts`:**
When creating the Media record, include the generation metadata:
```typescript
generationPrompt: metadata.prompt,
generationModel: modelName, // pass from callImageGeneration result
generatedAt: new Date().toISOString(),
```

This means `uploadGeneratedImage` needs to also receive the model name. Either pass it as a parameter or include it in `UploadMetadata`.

**Fix in `image-generator.ts` (`generateAndSave`):**
Pass the model name through from the generation result to the upload.

---

## TASK 4 — Image detail modal with zoom

**Problem:** The library page has a right sidebar detail panel. It shows metadata but: no zoom, no full-size view, no generation provenance, no creation date.

**Replace `ImageDetailPanel` with a proper modal:**

1. **Full-screen overlay** (not sidebar) with dark backdrop
2. **Large image** at the top with zoom controls:
   - Fit-to-view (default)
   - Zoom in/out buttons (+/- or scroll wheel)
   - Click-and-drag pan when zoomed
   - Reset zoom button
3. **Metadata below the image**, organized into sections:
   - **Core:** alt text, country, type, composition, quality, dimensions
   - **Scene & Mood:** scene description, mood tags, time of day, setting
   - **Animals:** species list (if any)
   - **Tags:** all tags
   - **Provenance:** source (scraped/generated), sourceProperty (if scraped), createdAt date
   - **Generation details** (only for generated images): prompt used, model used, generated date
4. **Actions bar:** Copy imgix URL, Open in new tab (full resolution), Use as hero (if in workspace context)
5. **Keyboard:** Esc closes, left/right arrows navigate between images in current grid

---

## TASK 5 — Back link to /admin

**Fix in `image-library/page.tsx`:**

Add a breadcrumb/nav bar at the very top:
```
← Back to Admin    |    Image Library    |    {total} images
```

The "← Back to Admin" links to `/admin`. Simple. Use Kiuli brand styling.

---

## TASK 6 — Inline image insertion into drafts

**This is the most important task in this phase.**

**Problem:** The Images tab only handles hero image selection. There is no way to insert images into the article body. Published articles have no inline images.

**Approach — Image placement slots:**

Rather than building a full Lexical image plugin (complex, fragile), use an image placement system:

1. **In the Images tab**, below the hero image section, add an "Article Images" section
2. This shows a list of image slots: "After Section 1", "After Section 2", etc. (derived from the draft body's heading structure)
3. Each slot shows the currently assigned image (or "No image") and a "Choose" button
4. Clicking "Choose" opens the library picker filtered to relevant content
5. Selected images are saved to the content_project as `articleImages` (a jsonb array of `{ position: number, mediaId: number, caption?: string }`)
6. The article publisher reads `articleImages` and inserts them into the Lexical body at the appropriate positions when publishing

**Data model:**

Add to `content_projects` collection (if not already present):
```
articleImages: {
  type: 'json',
  // Array of { position: number, mediaId: number, caption: string }
}
```

Add to `WorkspaceProject` type:
```typescript
articleImages?: Array<{
  position: number  // Insert after this paragraph/heading index
  mediaId: number
  caption?: string
  imgixUrl?: string  // Resolved for display
  alt?: string       // Resolved for display
}>
```

**Fix in `transformProject` (both copies):**
Parse articleImages from raw project data and resolve media records for display.

**Fix in `article-publisher.ts`:**
When building the post body, insert image blocks into the Lexical content at the specified positions. Each image becomes a Lexical image node (or an upload node if Payload's Lexical supports it) with the media ID, imgix URL, alt text, and optional caption.

Check what node types Payload's Lexical editor supports for images. It likely has an `upload` block type. Use that.

**Server actions needed:**
- `saveArticleImages(projectId, images)` — saves the articleImages array
- `resolveArticleImages(projectId)` — returns the current articleImages with resolved media URLs

**UI in ImagesTab:**
After the hero section, show the article images section with:
- Position labels derived from draft headings (parse the draftBody to find H2/H3 elements)
- Thumbnail preview of assigned images
- "Choose" button that opens a mini library picker
- "Remove" button to unassign
- Optional caption text input
- Drag to reorder

---

## TASK 7 — Minor UI improvements

1. **Image library page:** Add time of day and suitable-for filter sections to the sidebar (the constants are defined but not rendered)
2. **Search auto-trigger:** When a filter checkbox changes, auto-search after a 500ms debounce (don't require clicking "Apply Filters")  
3. **Pagination:** Add "Load more" button when results are truncated (when matches.length equals limit)
4. **Generation cost notice:** In the generation panel, below the "Generate Image" button, show "(~$0.08 per image)" in small text

---

## VERIFICATION

### Gate 1 — Build passes

```bash
npm run build 2>&1 | tail -30 > content-engine/evidence/phase14a-gate1.txt
echo "EXIT: $?" >> content-engine/evidence/phase14a-gate1.txt
```

Must end with `EXIT: 0`.

### Gate 2 — Hero selection feedback works

Test manually:
1. Go to a project workspace → Images tab
2. Click an image in the grid
3. Verify: the image is highlighted, the "Current Hero Image" section updates, and a confirmation appears
4. Refresh the page — verify the hero image persists

Take screenshots or describe what you see in `content-engine/evidence/phase14a-gate2.txt`. This is a manual UI verification — you cannot fake this with code.

Actually — since you can't take screenshots, verify programmatically:

```bash
echo "=== Hero resolution in fetchProjectData ===" > content-engine/evidence/phase14a-gate2.txt
grep -n "heroImageImgixUrl\|heroImageAlt\|heroMedia" src/app/\(payload\)/admin/content-engine/project/\[id\]/actions.ts >> content-engine/evidence/phase14a-gate2.txt

echo "" >> content-engine/evidence/phase14a-gate2.txt
echo "=== Local state update in ImageLibraryPicker ===" >> content-engine/evidence/phase14a-gate2.txt
grep -n "currentHeroId\|setCurrentHero\|Hero image saved\|toast\|feedback" src/components/content-system/workspace/ImageLibraryPicker.tsx >> content-engine/evidence/phase14a-gate2.txt
```

The evidence file must show hero resolution code in actions.ts AND local state management in the picker.

### Gate 3 — Free-text description field exists

```bash
echo "=== PhotographicSubject.description ===" > content-engine/evidence/phase14a-gate3.txt
grep -n "description" content-system/images/types.ts >> content-engine/evidence/phase14a-gate3.txt

echo "" >> content-engine/evidence/phase14a-gate3.txt
echo "=== Prompt generator uses description ===" >> content-engine/evidence/phase14a-gate3.txt
grep -n "description" content-system/images/prompt-generator.ts >> content-engine/evidence/phase14a-gate3.txt

echo "" >> content-engine/evidence/phase14a-gate3.txt
echo "=== UI textarea for description ===" >> content-engine/evidence/phase14a-gate3.txt
grep -n "description\|Scene Description\|scene.*desc" src/app/\(payload\)/admin/image-library/page.tsx >> content-engine/evidence/phase14a-gate3.txt
grep -n "description\|Scene Description\|scene.*desc" src/components/content-system/workspace/ImageLibraryPicker.tsx >> content-engine/evidence/phase14a-gate3.txt
```

### Gate 4 — Generation metadata persisted

```bash
echo "=== Media collection fields ===" > content-engine/evidence/phase14a-gate4.txt
grep -n "generationPrompt\|generationModel\|generatedAt" src/collections/Media.ts >> content-engine/evidence/phase14a-gate4.txt

echo "" >> content-engine/evidence/phase14a-gate4.txt
echo "=== Upload pipeline saves metadata ===" >> content-engine/evidence/phase14a-gate4.txt
grep -n "generationPrompt\|generationModel\|generatedAt" content-system/images/upload-pipeline.ts >> content-engine/evidence/phase14a-gate4.txt
```

Both sections must have matches. If Media.ts has no generation fields, the upload pipeline can't save them.

### Gate 5 — Image detail modal has zoom and generation details

```bash
echo "=== Modal/zoom in library page ===" > content-engine/evidence/phase14a-gate5.txt
grep -n "zoom\|scale\|transform\|wheel\|pinch\|modal\|overlay\|fixed inset" src/app/\(payload\)/admin/image-library/page.tsx >> content-engine/evidence/phase14a-gate5.txt

echo "" >> content-engine/evidence/phase14a-gate5.txt
echo "=== Generation details shown ===" >> content-engine/evidence/phase14a-gate5.txt
grep -n "generationPrompt\|generationModel\|Generated by\|Prompt:" src/app/\(payload\)/admin/image-library/page.tsx >> content-engine/evidence/phase14a-gate5.txt
```

### Gate 6 — Back link to admin

```bash
echo "=== Admin back link ===" > content-engine/evidence/phase14a-gate6.txt
grep -n "Back to Admin\|\/admin\|breadcrumb\|ArrowLeft\|ChevronLeft" src/app/\(payload\)/admin/image-library/page.tsx >> content-engine/evidence/phase14a-gate6.txt
```

### Gate 7 — Article images system exists

```bash
echo "=== articleImages on types ===" > content-engine/evidence/phase14a-gate7.txt
grep -n "articleImages" src/components/content-system/workspace-types.ts >> content-engine/evidence/phase14a-gate7.txt

echo "" >> content-engine/evidence/phase14a-gate7.txt
echo "=== Article images UI ===" >> content-engine/evidence/phase14a-gate7.txt
grep -n "articleImages\|Article Images\|image slot\|image placement" src/components/content-system/workspace/ContentTabs.tsx >> content-engine/evidence/phase14a-gate7.txt
grep -n "articleImages\|Article Images\|image slot\|image placement" src/components/content-system/workspace/ImageLibraryPicker.tsx >> content-engine/evidence/phase14a-gate7.txt

echo "" >> content-engine/evidence/phase14a-gate7.txt
echo "=== Publisher inserts images ===" >> content-engine/evidence/phase14a-gate7.txt
grep -n "articleImages\|imageBlock\|upload.*node\|insertImage" content-system/publishing/article-publisher.ts >> content-engine/evidence/phase14a-gate7.txt

echo "" >> content-engine/evidence/phase14a-gate7.txt
echo "=== Server action ===" >> content-engine/evidence/phase14a-gate7.txt
grep -n "saveArticleImages\|articleImages" src/app/\(payload\)/admin/content-engine/project/\[id\]/actions.ts >> content-engine/evidence/phase14a-gate7.txt
```

All four sections must have matches: types, UI, publisher, server action.

### Gate 8 — Prompt generator test with description

Run the existing test (which should be extended to include a description test):

Add a new test case to `test-prompt-generator.ts`:
```
Test 6: Wildlife with custom description ("aerial photo of pods of hippos in the Kazinga channel")
- Verify the generated prompts incorporate "hippo", "Kazinga", and "aerial" concepts
- Verify camera specs are still present
```

```bash
npx tsx content-engine/scripts/test-prompt-generator.ts 2>&1 | tee content-engine/evidence/phase14a-gate8.txt
```

Must show PASS and the description test producing prompts that reference the described scene.

### Gate 9 — Build final

```bash
npm run build 2>&1 | tail -30 > content-engine/evidence/phase14a-gate9.txt
echo "EXIT: $?" >> content-engine/evidence/phase14a-gate9.txt
```

`EXIT: 0`.

---

## ★ STOP GATE ★

Stop after all gates 1-9. Show me the contents of EVERY evidence file. Do not commit until I confirm.

---

## GATE 10 — Commit and push (after confirmation)

```bash
git add -A
git status > content-engine/evidence/phase14a-gate10.txt
git commit -m "Phase 14a: Image Library polish — hero feedback, free-text prompts, detail modal, article images"
git push origin main 2>&1 >> content-engine/evidence/phase14a-gate10.txt
echo "DONE" >> content-engine/evidence/phase14a-gate10.txt
```

---

## WHAT NOT TO DO

- Do not build a full Lexical editor image plugin. The image placement slot system is simpler and achievable.
- Do not change the generation pipeline (openrouter-client, FLUX.2 Max). It works. Only add metadata persistence.
- Do not restructure the library search. It works. Only add pagination.
- Do not create new pages. The image library page and workspace picker already exist. Improve them.
- Do not weaken any existing test assertions. If a test fails, fix the code, not the test.
- Do not skip the investigation step. Write the findings file first.
