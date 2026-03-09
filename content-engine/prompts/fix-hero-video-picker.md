# Fix: Hero Video Picker in Itinerary Editor

## Context

The itinerary editor (`src/app/(payload)/admin/itinerary-editor/[id]/page.tsx`) has two coupled bugs in the hero video handling:

**Bug 1:** `onSelectVideo` is a no-op. When a user clicks the "Select Video" button in `HeroPanel`, nothing happens. The handler is `() => {}`.

**Bug 2:** The PATCH body writes `heroVideo: toId(rawDoc.heroVideo)` — the value from the document fetched at load time. There is no `heroVideoId` state variable tracking the current selection. If a user swaps the hero video, the save sends the original video ID, not the newly selected one.

These two bugs are fixed together. The fix mirrors exactly what was done for `heroImage`:
- `heroImage` has a `heroImageId` state variable, populated on load, updated by the picker, used in the PATCH body.
- `heroVideo` must have the same pattern: `heroVideoId` state, populated on load, updated by a real video picker modal, used in the PATCH body.

A `VideoSelectionModal` component does not exist yet. It must be created, following the same pattern as `src/components/admin/ImageSelectionModal.tsx`, but querying for video media only.

---

## Investigation

Before writing any code, confirm the current state by reading the relevant sections of the file.

```bash
echo "=== Investigation ===" > content-engine/evidence/hero-video-picker-investigation.txt

# Confirm Bug 1: onSelectVideo is a no-op
grep -n "onSelectVideo" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-investigation.txt

# Confirm Bug 2: heroVideo in PATCH body uses rawDoc, not state
grep -n "heroVideo:" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-investigation.txt

# Confirm heroVideoId state does not yet exist
grep -n "heroVideoId" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-investigation.txt

# Confirm heroVideoUrl and heroVideoName state exists (these are already present — confirm their line numbers)
grep -n "heroVideoUrl\|heroVideoName" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-investigation.txt

# Confirm how heroImageId is populated on load (the pattern to mirror)
grep -n "rawHeroId\|setHeroImageId" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-investigation.txt

# Confirm how heroVideoUrl is currently populated on load (to understand the mediaUrl helper)
grep -n "setHeroVideoUrl\|setHeroVideoName" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-investigation.txt

# Confirm image picker modal pattern (the modal component name and its props at usage site)
grep -n "ImageSelectionModal\|imageModalOpen\|currentlySelected" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-investigation.txt

# Confirm VideoSelectionModal does not yet exist
ls src/components/admin/VideoSelectionModal.tsx >> content-engine/evidence/hero-video-picker-investigation.txt 2>&1
```

Show the full contents of the investigation file. Do not proceed until you have confirmed:
- Line with `onSelectVideo={() => {}}` — confirm it is a no-op
- Line with `heroVideo: toId(rawDoc.heroVideo)` — confirm PATCH uses rawDoc
- No existing `heroVideoId` state
- Line where `setHeroVideoUrl` is called on load (confirms `mediaUrl()` helper is already used for video)
- `VideoSelectionModal.tsx` does not exist

---

## Task 1 — Create VideoSelectionModal

Create `src/components/admin/VideoSelectionModal.tsx`.

This component is a modal (overlay) that lets the user browse and select a single video from the media library. Its interface is identical to `ImageSelectionModal`:

```typescript
interface VideoSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (mediaIds: number[]) => void
  currentlySelected: number[]
}
```

It queries `/api/media` with the filter `where[mediaType][equals]=video` to show only video media items. It does **not** use `mimeType` for filtering at the query level — it uses `mediaType` field, exactly as `VideoSelectorField.tsx` does.

**Do not copy ImageSelectionModal verbatim and change the field names.** Write this component from scratch, adapted for video. Key differences from ImageSelectionModal:
- Query filter: `'where[mediaType][equals]': 'video'` (not image-type filters)
- Grid items render a `<video>` element (with `muted`, `playsInline`, `preload="metadata"`) not an `<img>`, to show a video thumbnail preview
- No country, type, or property filters — just a text search on filename and alt
- Header title: "Select Video from Library"
- Confirm button text: "Select Video" (since this is single-select, `selectedIds.size` will be 0 or 1)
- Single-select only: clicking a video clears the previous selection and selects the new one (no multi-select behaviour)
- If no videos are found, show: "No videos found in library."

The component must:
- Use `'use client'` directive
- Import React and useState, useEffect, useCallback
- Implement `isOpen` guard: return null if not open
- Accept `currentlySelected: number[]` to pre-highlight any already-selected video
- Call `onSelect([selectedId])` when the user confirms, then call `onClose()`
- Include a Cancel button that calls `onClose()` without calling `onSelect`

The modal overlay, inner container, and general layout must follow the same structural pattern as `ImageSelectionModal` (full-viewport overlay, centred card, header, scrollable grid, footer with cancel/confirm).

---

## Task 2 — Add heroVideoId state

In `src/app/(payload)/admin/itinerary-editor/[id]/page.tsx`:

Find:
```typescript
const [heroImageId, setHeroImageId] = useState<number | null>(null)
```

Add immediately below it:
```typescript
const [heroVideoId, setHeroVideoId] = useState<number | null>(null)
```

---

## Task 3 — Populate heroVideoId on load

Find the block that populates `heroImageId` on document load. It reads `doc.heroImage`, handles both populated-object and raw-id cases, and calls `setHeroImageId`. It looks like:

```typescript
const rawHeroId = doc.heroImage
if (rawHeroId && typeof rawHeroId === 'object') {
  setHeroImageId(Number((rawHeroId as any).id))
} else if (typeof rawHeroId === 'number') {
  setHeroImageId(rawHeroId)
}
```

Add an identical block immediately after it for `heroVideo`:

```typescript
const rawVideoId = doc.heroVideo
if (rawVideoId && typeof rawVideoId === 'object') {
  setHeroVideoId(Number((rawVideoId as any).id))
} else if (typeof rawVideoId === 'number') {
  setHeroVideoId(rawVideoId)
}
```

This block must appear in the same load function as the `heroImageId` population — confirm the exact location from the investigation output before placing it.

---

## Task 4 — Add videoModalOpen state

Find:
```typescript
const [imageModalOpen, setImageModalOpen] = useState(false)
```

Add immediately below it:
```typescript
const [videoModalOpen, setVideoModalOpen] = useState(false)
```

---

## Task 5 — Fix onSelectVideo

Find:
```typescript
onSelectVideo={() => {}}
```

Replace with:
```typescript
onSelectVideo={() => setVideoModalOpen(true)}
```

---

## Task 6 — Fix heroVideo in PATCH body

Find the line in the PATCH body that reads:
```typescript
heroVideo: toId(rawDoc.heroVideo),
```

Replace with:
```typescript
heroVideo: heroVideoId,
```

Do not change any other lines in the PATCH body. Confirm by searching that `toId(rawDoc.heroVideo)` no longer appears anywhere in the file after this change.

---

## Task 7 — Add VideoSelectionModal import and usage

Add the import for `VideoSelectionModal` alongside the existing `ImageSelectionModal` import. Find where `ImageSelectionModal` is imported and add `VideoSelectionModal` from the same directory pattern.

Find the image picker modal block — it is the `<ImageSelectionModal ... />` JSX element with `isOpen={imageModalOpen}`. Read its full structure in the file.

Add a `<VideoSelectionModal ... />` block immediately after the image picker modal block. It must:
- `isOpen={videoModalOpen}`
- `onClose={() => setVideoModalOpen(false)}`
- `currentlySelected={heroVideoId ? [heroVideoId] : []}`
- `onSelect={async (mediaIds) => { ... }}` — the handler must:
  1. If `mediaIds.length === 0`, return early
  2. Fetch the media doc: `const res = await fetch(\`/api/media/${mediaIds[0]}\`, { credentials: 'include' })`
  3. If `res.ok`, parse `const doc = await res.json()`
  4. Call `setHeroVideoId(mediaIds[0])`
  5. Call `setHeroVideoUrl(mediaUrl(doc))`
  6. Call `setHeroVideoName(doc.alt || doc.filename || \`Video #${mediaIds[0]}\`)`
  7. Call `setVideoModalOpen(false)`

This onSelect handler mirrors the image picker onSelect handler exactly, replacing image-specific calls with their video equivalents.

---

## Verification Gates

### Gate 1: Investigation complete
```bash
cat content-engine/evidence/hero-video-picker-investigation.txt
```
Confirm all items listed in the Investigation section are present. Do not proceed if any item is missing.

### Gate 2: VideoSelectionModal exists and filters for video
```bash
echo "=== Gate 2: VideoSelectionModal ===" > content-engine/evidence/hero-video-picker-gates.txt
ls -la src/components/admin/VideoSelectionModal.tsx >> content-engine/evidence/hero-video-picker-gates.txt
grep -n "mediaType" src/components/admin/VideoSelectionModal.tsx >> content-engine/evidence/hero-video-picker-gates.txt
grep -n "isOpen\|onClose\|onSelect\|currentlySelected" src/components/admin/VideoSelectionModal.tsx >> content-engine/evidence/hero-video-picker-gates.txt
```

Required output:
- File exists (ls shows it)
- `mediaType` appears — confirms video filter is present
- All four prop names appear — confirms the interface is correct

### Gate 3: heroVideoId state and load population
```bash
echo "" >> content-engine/evidence/hero-video-picker-gates.txt
echo "=== Gate 3: heroVideoId state ===" >> content-engine/evidence/hero-video-picker-gates.txt
grep -n "heroVideoId" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-gates.txt
```

Required: minimum 4 lines — state declaration, rawVideoId population block, PATCH body usage, and the `currentlySelected` prop on the modal. Any fewer means something was missed.

### Gate 4: PATCH body uses heroVideoId, not rawDoc
```bash
echo "" >> content-engine/evidence/hero-video-picker-gates.txt
echo "=== Gate 4: PATCH body ===" >> content-engine/evidence/hero-video-picker-gates.txt
grep -n "heroVideo:" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-gates.txt
```

Required: every line containing `heroVideo:` must NOT contain `rawDoc`. If `toId(rawDoc.heroVideo)` appears anywhere, the fix is incomplete.

### Gate 5: onSelectVideo opens the modal
```bash
echo "" >> content-engine/evidence/hero-video-picker-gates.txt
echo "=== Gate 5: onSelectVideo ===" >> content-engine/evidence/hero-video-picker-gates.txt
grep -n "onSelectVideo\|videoModalOpen" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-gates.txt
```

Required:
- `onSelectVideo` line must contain `setVideoModalOpen(true)` — not `{}`
- `videoModalOpen` must appear in: state declaration, the `onSelectVideo` handler, `isOpen` prop on the modal, and the `onClose` handler on the modal (minimum 4 lines)

### Gate 6: onSelect handler calls all three setters
```bash
echo "" >> content-engine/evidence/hero-video-picker-gates.txt
echo "=== Gate 6: onSelect setters ===" >> content-engine/evidence/hero-video-picker-gates.txt
grep -n "setHeroVideoId\|setHeroVideoUrl\|setHeroVideoName" src/app/\(payload\)/admin/itinerary-editor/\[id\]/page.tsx >> content-engine/evidence/hero-video-picker-gates.txt
```

Required: all three setters must appear — `setHeroVideoId`, `setHeroVideoUrl`, `setHeroVideoName`. Any missing setter means the picker does not fully update the UI state.

### Gate 7: TypeScript check
```bash
echo "" >> content-engine/evidence/hero-video-picker-gates.txt
echo "=== Gate 7: TypeScript ===" >> content-engine/evidence/hero-video-picker-gates.txt
npx tsc --noEmit 2>&1 | head -40 >> content-engine/evidence/hero-video-picker-gates.txt
echo "TSC EXIT: $?" >> content-engine/evidence/hero-video-picker-gates.txt
```

Required: no new TypeScript errors in the files touched by this fix. Pre-existing errors in other files do not count, but errors in `VideoSelectionModal.tsx` or `page.tsx` are a failure.

### Gate 8: Build
```bash
npm run build 2>&1 | tail -20 > content-engine/evidence/hero-video-picker-build.txt
echo "BUILD EXIT: $?" >> content-engine/evidence/hero-video-picker-build.txt
```

Required: `BUILD EXIT: 0`.

---

## ★ STOP GATE

Show the full contents of:
- `content-engine/evidence/hero-video-picker-investigation.txt`
- `content-engine/evidence/hero-video-picker-gates.txt`
- `content-engine/evidence/hero-video-picker-build.txt`

Wait for confirmation before committing. Do not commit without being instructed to do so.

---

## Rules

1. Read the investigation output in full before writing any code. The line numbers matter — place the new code exactly where specified relative to the existing code.
2. `VideoSelectionModal` is written from scratch adapted for video. It is not a copy-paste of `ImageSelectionModal` with field names changed.
3. `VideoSelectionModal` must use `where[mediaType][equals]=video` as its query filter — the same filter that `VideoSelectorField.tsx` uses. Do not use `mimeType` filtering.
4. The `onSelect` handler in page.tsx must call all three setters: `setHeroVideoId`, `setHeroVideoUrl`, `setHeroVideoName`. Missing any one of these leaves the UI in an inconsistent state.
5. `heroVideo: heroVideoId` in the PATCH body is non-negotiable. After this fix, `toId(rawDoc.heroVideo)` must not appear anywhere in the file.
6. TypeScript must pass for the touched files. Fix any type errors before proceeding to the build gate.
7. Build must be `EXIT: 0` before the stop gate.
8. Show all evidence at the stop gate. Do not summarise — show the raw file contents.
