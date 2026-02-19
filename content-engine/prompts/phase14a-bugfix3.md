# Phase 14a — Bugfix 3: Save Architecture + Pagination + Error Handling

## Context

Six bugs remain in the image system after bugfix2. Three share a root cause (side effects inside setState), two are pagination UX failures, and one is silent error swallowing.

**This prompt fixes all six by implementing a professional debounced-save architecture for article images and correcting the pagination/error handling in the image library.**

---

## INVESTIGATION STEP (mandatory — do this first)

Read these files completely. Do not skim:

1. `src/components/content-system/workspace/ContentTabs.tsx` — find `ArticleImagesSection`. Trace every call to `handleSave`, `handleAssign`, `handleRemove`, `handleCaptionChange`, `handleCaptionBlur`. Note how each calls `setImages` and `handleSave` together.
2. `src/app/(payload)/admin/image-library/page.tsx` — find `doSearch`. Trace the `loading` state through the render. Note what happens to the grid when `loading` is true. Find the "Load more" button — note it has no `disabled` prop.
3. `src/app/(payload)/admin/image-library/page.tsx` — find the `ArticleImagePickerModal` inside ContentTabs.tsx. Note the `doSearch` error handling path (or lack thereof).

Write findings to `content-engine/evidence/phase14a-bugfix3-investigation.txt`:
- For each of the 6 problems below, confirm the bug exists in the code and note the exact lines.
- If any bug does NOT exist (i.e. it was already fixed), note that too.

---

## THE 6 PROBLEMS

### Problem 1 — "Load more" replaces grid with spinner

**Location:** `src/app/(payload)/admin/image-library/page.tsx`

`doSearch(true)` sets `setLoading(true)`. The render logic is:

```
{loading ? (full-page spinner) : matches.length === 0 ? (empty state) : (grid)}
```

When "Load more" is clicked, all 60 images vanish, a full-page spinner appears, then 120 images render. This makes pagination feel broken.

**Root cause:** Single `loading` boolean used for both initial load and append-load.

### Problem 2 — Double-click "Load more" produces duplicates

**Location:** `src/app/(payload)/admin/image-library/page.tsx`

The "Load more" button has no `disabled` state. Two rapid clicks fire two `doSearch(true)` calls with the same `offsetRef.current` (it hasn't updated from the first call yet). Both return the same 60 images. Both append. User sees 60 duplicate cards.

**Root cause:** Button not disabled during load, no guard against concurrent requests.

### Problem 3 — Side effects inside setState callbacks

**Location:** `src/components/content-system/workspace/ContentTabs.tsx`, `ArticleImagesSection`

`handleAssign`, `handleRemove`, and `handleCaptionBlur` all call `handleSave()` inside `setImages(prev => { handleSave(...); return ... })`.

React StrictMode (enabled by Next.js in dev) double-invokes updater functions. This means every assign, remove, and blur fires `saveArticleImages` twice in development. In production it fires once, but this violates React's contract that updater functions must be pure. Future React versions or behavior changes will break this.

**Root cause:** Network calls (side effects) inside state updater functions.

### Problem 4 — Race condition on rapid assignment loses data

**Location:** `src/components/content-system/workspace/ContentTabs.tsx`, `ArticleImagesSection`

User assigns images to positions 0, 1, 2 in quick succession. Each `handleAssign` fires `handleSave` with the array at that moment:

- Save 1 sends `[{position: 0}]`
- Save 2 sends `[{position: 0}, {position: 1}]`
- Save 3 sends `[{position: 0}, {position: 1}, {position: 2}]`

`saveArticleImages` does a full replacement (`data: { articleImages: sanitized }`). If network reordering causes Save 1 to complete last, the database is overwritten with just `[{position: 0}]`. Positions 1 and 2 are silently lost. The UI still shows all three (local state is correct), but on page refresh they're gone.

**Root cause:** Multiple concurrent saves with full-replacement semantics. Last-write-wins with no ordering guarantee.

### Problem 5 — No rollback or recovery on failed save

**Location:** `src/components/content-system/workspace/ContentTabs.tsx`, `ArticleImagesSection`

If `handleSave` fails, `alert(result.error)` fires. But local state has already been updated — `setImages` already ran. The UI shows the image as assigned/removed. The database doesn't have it. User navigates away. Data is lost silently after dismissing the alert.

**Root cause:** No dirty tracking, no save status indicator, no navigation guard, no retry mechanism.

### Problem 6 — Search errors silently swallowed

**Location:** `src/app/(payload)/admin/image-library/page.tsx` (main library) and `src/components/content-system/workspace/ContentTabs.tsx` (article picker modal)

Both `doSearch` functions check `if ('result' in result)` and set matches. If the server action returns `{ error: string }` instead, there is no `else` branch. Loading stops. User sees stale results (or empty grid on first load). No error message appears anywhere.

**Root cause:** Missing error state and error display.

---

## THE FIXES

### Fix 1+2 — Pagination: separate loading states + button guard

**File:** `src/app/(payload)/admin/image-library/page.tsx`

**Changes:**

1. Add a new state variable:
```typescript
const [isLoadingMore, setIsLoadingMore] = useState(false)
```

2. In `doSearch`, use `isLoadingMore` for append mode instead of `loading`:
```typescript
const doSearch = useCallback(async (appendMode = false) => {
  if (appendMode) {
    setIsLoadingMore(true)
  } else {
    setLoading(true)
  }
  const searchOffset = appendMode ? offsetRef.current : 0
  const result = await searchImages({ /* ... existing options ... */ offset: searchOffset, limit: 60 })

  if (appendMode) {
    setIsLoadingMore(false)
  } else {
    setLoading(false)
  }

  if ('result' in result) {
    if (appendMode) {
      setMatches((prev) => [...prev, ...result.result.matches])
    } else {
      setMatches(result.result.matches)
    }
    setTotal(result.result.total)
    setFacets(result.result.facets)
    offsetRef.current = searchOffset + result.result.matches.length
    setHasMore(result.result.matches.length >= 60)
  } else {
    setSearchError(result.error)
  }
}, [/* existing deps */])
```

3. The render logic stays the same — `loading` still controls the full-page spinner. But `loading` is never set true during append, so the grid stays visible.

4. The "Load more" button uses `isLoadingMore` for both disabled state and spinner:
```tsx
{hasMore && (
  <div className="mt-4 flex justify-center">
    <button
      onClick={() => doSearch(true)}
      disabled={isLoadingMore}
      className="rounded bg-kiuli-gray/20 px-4 py-2 text-xs text-kiuli-charcoal hover:bg-kiuli-gray/30 disabled:opacity-40"
    >
      {isLoadingMore ? (
        <><Loader2 className="mr-1.5 inline h-3 w-3 animate-spin" /> Loading...</>
      ) : (
        'Load more'
      )}
    </button>
  </div>
)}
```

This fixes both Problem 1 (grid no longer vanishes) and Problem 2 (button is disabled during load, preventing double-click).

### Fix 3+4+5 — Debounced save architecture for ArticleImagesSection

**File:** `src/components/content-system/workspace/ContentTabs.tsx`

**Replace the entire `ArticleImagesSection` function** with a new implementation that follows this architecture:

#### Architecture: Optimistic local state + debounced persist + dirty tracking + error recovery

**Principles:**
- All mutations (assign, remove, caption change) are LOCAL ONLY — they update React state and a ref. No network call fires immediately.
- A `useRef` always holds the latest images array. The ref exists because the debounced save reads "the current truth right now" regardless of closure capture timing.
- A debounced save fires 800ms after mutations settle. If another change arrives within that window, the timer resets. When it fires, it reads from the ref and sends ONE save request with the complete current state.
- A save status indicator shows: idle | saving | saved | error.
- On failure, local state is preserved. An error banner with retry appears. The dirty flag stays true.
- A `beforeunload` handler warns the user if they try to close/navigate with unsaved changes.

**Implementation:**

```typescript
function ArticleImagesSection({ project, projectId, onDataChanged }: ArticleImagesSectionProps) {
  // ── State ──────────────────────────────────────────────────────────────
  const [images, setImages] = useState<ArticleImage[]>(project.articleImages || [])
  const imagesRef = useRef<ArticleImage[]>(project.articleImages || [])
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastSavedImages, setLastSavedImages] = useState<ArticleImage[]>(project.articleImages || [])
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [pickingForPosition, setPickingForPosition] = useState<number | null>(null)

  // ── Heading extraction (same as bugfix2) ───────────────────────────────
  const lexicalHeadings = extractHeadingsFromLexical(project.draftBodyRaw)
  const headings = lexicalHeadings.length > 0
    ? lexicalHeadings
    : (project.draftBody
      ? project.draftBody.split(/\n{2,}/).filter((p) => p.trim().length > 0).slice(0, 8).map((_, i) => `Section ${i + 1}`)
      : [])

  // ── Dirty tracking ────────────────────────────────────────────────────
  // Compare by serialized content, not reference
  const isDirty = JSON.stringify(images) !== JSON.stringify(lastSavedImages)

  // ── Navigation guard ──────────────────────────────────────────────────
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault()
        // Modern browsers ignore custom messages but still show a prompt
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty])

  // ── Sync from props when project data refreshes externally ────────────
  useEffect(() => {
    const incoming = project.articleImages || []
    setImages(incoming)
    imagesRef.current = incoming
    setLastSavedImages(incoming)
    setSaveStatus('idle')
    setSaveError(null)
  }, [project.articleImages])

  // ── Debounced save ────────────────────────────────────────────────────
  const doSave = useCallback(async () => {
    const current = imagesRef.current
    setSaveStatus('saving')
    setSaveError(null)
    const result = await saveArticleImages(projectId, current)
    if ('success' in result) {
      setLastSavedImages(current)
      setSaveStatus('saved')
      onDataChanged?.()
      // Fade back to idle after 2s
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000)
    } else {
      setSaveStatus('error')
      setSaveError(result.error)
    }
  }, [projectId, onDataChanged])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => doSave(), 800)
  }, [doSave])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  // ── Mutation helpers (local-only, then schedule save) ──────────────────

  const updateImages = useCallback((fn: (prev: ArticleImage[]) => ArticleImage[]) => {
    setImages((prev) => {
      const next = fn(prev)
      imagesRef.current = next
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const handleAssign = useCallback((position: number, match: { mediaId: number; imgixUrl: string | null; alt: string }) => {
    updateImages((prev) => {
      const updated = prev.filter((img) => img.position !== position)
      updated.push({
        position,
        mediaId: match.mediaId,
        imgixUrl: match.imgixUrl || undefined,
        alt: match.alt || undefined,
      })
      updated.sort((a, b) => a.position - b.position)
      return updated
    })
    setPickingForPosition(null)
  }, [updateImages])

  const handleRemove = useCallback((position: number) => {
    updateImages((prev) => prev.filter((img) => img.position !== position))
  }, [updateImages])

  const handleCaptionChange = useCallback((position: number, caption: string) => {
    updateImages((prev) =>
      prev.map((img) => img.position === position ? { ...img, caption } : img),
    )
  }, [updateImages])

  const handleRetry = useCallback(() => {
    doSave()
  }, [doSave])

  // ── Render ────────────────────────────────────────────────────────────

  if (!project.draftBody) {
    return (
      <div className="mx-5 rounded border border-kiuli-gray/30 bg-kiuli-gray/5 p-4">
        <p className="text-xs text-kiuli-charcoal/50">Generate a draft first to add inline images.</p>
      </div>
    )
  }

  return (
    <div className="mx-5 flex flex-col gap-3">
      {/* Header with save status */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-kiuli-charcoal">Article Images</h3>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-[10px] text-kiuli-charcoal/50">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[10px] text-emerald-600">✓ Saved</span>
          )}
          {saveStatus === 'error' && (
            <button onClick={handleRetry} className="text-[10px] font-medium text-red-600 hover:underline">
              Save failed — Retry
            </button>
          )}
          {isDirty && saveStatus === 'idle' && (
            <span className="text-[10px] text-amber-600">Unsaved changes</span>
          )}
        </div>
      </div>

      {/* Error banner */}
      {saveStatus === 'error' && saveError && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {saveError}
        </div>
      )}

      <p className="text-[10px] text-kiuli-charcoal/50">
        Assign images to positions in the article. They will be inserted after each heading when published.
      </p>

      {/* Position slots */}
      <div className="flex flex-col gap-2">
        {headings.map((heading, i) => {
          const assigned = images.find((img) => img.position === i)
          return (
            <div key={i} className="rounded border border-kiuli-gray/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-kiuli-charcoal">
                  After: <span className="text-kiuli-teal">{heading}</span>
                </span>
                <span className="text-[10px] text-kiuli-charcoal/40">Position {i}</span>
              </div>

              {assigned ? (
                <div className="flex gap-3">
                  {assigned.imgixUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${assigned.imgixUrl.split('?')[0]}?w=120&h=80&fit=crop&auto=format`}
                      alt={assigned.alt || ''}
                      className="h-16 w-24 rounded object-cover"
                    />
                  )}
                  <div className="flex flex-1 flex-col gap-1">
                    <input
                      className={`${inputClass} text-[11px]`}
                      placeholder="Caption (optional)"
                      value={assigned.caption || ''}
                      onChange={(e) => handleCaptionChange(i, e.target.value)}
                    />
                    <button
                      onClick={() => handleRemove(i)}
                      className="self-start text-[10px] text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setPickingForPosition(i)}
                  className="rounded border border-dashed border-kiuli-gray/50 px-3 py-2 text-xs text-kiuli-charcoal/50 hover:border-kiuli-teal hover:text-kiuli-teal"
                >
                  + Choose image
                </button>
              )}
            </div>
          )
        })}
      </div>

      {headings.length === 0 && (
        <p className="text-[10px] text-kiuli-charcoal/40">No headings found in draft. Images require section headings to determine placement.</p>
      )}

      {/* Article image picker modal */}
      {pickingForPosition !== null && (
        <ArticleImagePickerModal
          position={pickingForPosition}
          defaultCountry={project.destinations?.[0]}
          defaultSpecies={project.species}
          excludeIds={images.map((img) => img.mediaId)}
          onSelect={handleAssign}
          onClose={() => setPickingForPosition(null)}
        />
      )}
    </div>
  )
}
```

**Key differences from the old implementation:**

1. NO `handleCaptionBlur` — captions save via the same debounce as everything else. `onChange` triggers `updateImages` which schedules a save. No blur handler needed.
2. NO `handleSave` called inside `setImages` — `updateImages` is a clean wrapper that updates state, updates the ref, and schedules a debounced save. The save reads from the ref.
3. ONE save function (`doSave`) that always reads `imagesRef.current` — no closure staleness, no race conditions, no matter how many mutations happen.
4. Dirty tracking via `lastSavedImages` comparison — shows "Unsaved changes" if the debounce hasn't fired yet, "Save failed — Retry" on error.
5. `beforeunload` guard when dirty — prevents accidental data loss on navigation.
6. Error recovery — save failure shows error banner with retry button. Local state preserved.

**IMPORTANT:** The caption input no longer has an `onBlur` handler. The `onChange` handler already triggers `updateImages` → `scheduleSave`. The debounce timer resets on each keystroke, so fast typing doesn't fire multiple saves. The save fires 800ms after the user stops typing — which is the professional pattern.

### Fix 6 — Error handling for search

**File:** `src/app/(payload)/admin/image-library/page.tsx`

1. Add error state:
```typescript
const [searchError, setSearchError] = useState<string | null>(null)
```

2. In `doSearch`, clear error at start, set on failure:
```typescript
const doSearch = useCallback(async (appendMode = false) => {
  setSearchError(null)
  // ... existing loading logic ...
  // ... existing searchImages call ...
  if ('result' in result) {
    // ... existing success handling ...
  } else {
    setSearchError(result.error)
  }
}, [/* deps */])
```

3. Render error banner above the grid (inside the grid container, after the active filter pills section):
```tsx
{searchError && (
  <div className="mx-4 mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
    Search failed: {searchError}
  </div>
)}
```

**File:** `src/components/content-system/workspace/ContentTabs.tsx` — `ArticleImagePickerModal`

Same pattern. Add `searchError` state, display in the modal body.

1. Add state:
```typescript
const [searchError, setSearchError] = useState<string | null>(null)
```

2. In `doSearch`:
```typescript
const doSearch = useCallback(async () => {
  setLoading(true)
  setSearchError(null)
  const result = await searchImages({
    country: defaultCountry || undefined,
    query: query || undefined,
    species: defaultSpecies?.length ? defaultSpecies : undefined,
    excludeIds: excludeIds?.length ? excludeIds : undefined,
    limit: 24,
  })
  setLoading(false)
  if ('result' in result) {
    setMatches(result.result.matches)
  } else {
    setSearchError(result.error)
  }
}, [defaultCountry, defaultSpecies, excludeIds, query])
```

3. Render error in the modal body (after the search bar, before the grid):
```tsx
{searchError && (
  <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
    {searchError}
  </div>
)}
```

---

## FILES TO MODIFY

1. **`src/app/(payload)/admin/image-library/page.tsx`**
   - Add `isLoadingMore` state
   - Add `searchError` state
   - Modify `doSearch` to use `isLoadingMore` for append mode and handle errors
   - Update "Load more" button with `disabled={isLoadingMore}` and spinner
   - Add error banner above grid

2. **`src/components/content-system/workspace/ContentTabs.tsx`**
   - Replace entire `ArticleImagesSection` with debounced-save implementation
   - Add `useRef` import if not already present (it is — check the import line)
   - Add `searchError` state and handling to `ArticleImagePickerModal`
   - Add error display to `ArticleImagePickerModal`

---

## VERIFICATION GATES

### Gate 1: Investigation file exists and is accurate
```bash
cat content-engine/evidence/phase14a-bugfix3-investigation.txt
```
Must confirm all 6 problems exist with line numbers.

### Gate 2: Build passes
```bash
cd /home/xeroth/kiuli-website && npm run build 2>&1 | tail -20
echo "EXIT: $?"
```
Write output to `content-engine/evidence/phase14a-bugfix3-build.txt`. Must show EXIT: 0.

### Gate 3: Pagination fix verified
```bash
echo "=== Pagination ===" > content-engine/evidence/phase14a-bugfix3-fixes.txt
grep -n "isLoadingMore" src/app/\(payload\)/admin/image-library/page.tsx >> content-engine/evidence/phase14a-bugfix3-fixes.txt
grep -n "disabled={isLoadingMore}" src/app/\(payload\)/admin/image-library/page.tsx >> content-engine/evidence/phase14a-bugfix3-fixes.txt
```
Must show: `isLoadingMore` state declaration, usage in `doSearch`, and `disabled={isLoadingMore}` on the button.

### Gate 4: Save architecture verified
```bash
echo "=== Save Architecture ===" >> content-engine/evidence/phase14a-bugfix3-fixes.txt
grep -n "imagesRef\|saveTimerRef\|scheduleSave\|doSave\|isDirty\|lastSavedImages\|saveStatus\|beforeunload" src/components/content-system/workspace/ContentTabs.tsx >> content-engine/evidence/phase14a-bugfix3-fixes.txt
```
Must show ALL of: `imagesRef`, `saveTimerRef`, `scheduleSave`, `doSave`, `isDirty`, `lastSavedImages`, `saveStatus`, `beforeunload`.

### Gate 5: No side effects inside setState
```bash
echo "=== No side effects in setState ===" >> content-engine/evidence/phase14a-bugfix3-fixes.txt
# Search for the OLD pattern: handleSave called inside setImages callback
grep -n "setImages.*handleSave\|handleSave.*setImages" src/components/content-system/workspace/ContentTabs.tsx >> content-engine/evidence/phase14a-bugfix3-fixes.txt || echo "NONE FOUND (correct)" >> content-engine/evidence/phase14a-bugfix3-fixes.txt
```
Must show "NONE FOUND (correct)". If any matches are found, the fix is incomplete.

### Gate 6: No onBlur save handler
```bash
echo "=== No onBlur save ===" >> content-engine/evidence/phase14a-bugfix3-fixes.txt
grep -n "handleCaptionBlur\|onBlur.*handleSave\|onBlur.*save" src/components/content-system/workspace/ContentTabs.tsx >> content-engine/evidence/phase14a-bugfix3-fixes.txt || echo "NONE FOUND (correct)" >> content-engine/evidence/phase14a-bugfix3-fixes.txt
```
Must show "NONE FOUND (correct)".

### Gate 7: Search error handling verified
```bash
echo "=== Search Error Handling ===" >> content-engine/evidence/phase14a-bugfix3-fixes.txt
grep -n "searchError" src/app/\(payload\)/admin/image-library/page.tsx >> content-engine/evidence/phase14a-bugfix3-fixes.txt
grep -n "searchError" src/components/content-system/workspace/ContentTabs.tsx >> content-engine/evidence/phase14a-bugfix3-fixes.txt
```
Must show `searchError` state declaration and error display in BOTH files.

### Gate 8: Final build passes
```bash
cd /home/xeroth/kiuli-website && npm run build 2>&1 | tail -20
echo "EXIT: $?"
```
Write output to `content-engine/evidence/phase14a-bugfix3-final.txt`. Must show EXIT: 0.

### Gate 9: ★ STOP GATE
Show ALL evidence files. Wait for explicit confirmation before committing.

### Gate 10: Commit and push
```bash
cd /home/xeroth/kiuli-website && git add -A && git commit -m "phase14a-bugfix3: debounced save architecture, pagination fix, error handling" && git push
```

---

## RULES

1. **Do not skip the investigation step.** Read the actual code first.
2. **Do not keep the old `handleCaptionBlur` function.** The debounced save replaces it entirely. Caption `onChange` triggers `updateImages` → `scheduleSave`. No blur handler.
3. **Do not call `handleSave` or `doSave` inside any `setImages` callback.** The entire point of this fix is separating state mutations from side effects. If you find yourself writing `setImages(prev => { doSave(...); return ... })`, you are recreating the bug.
4. **The ref (`imagesRef`) must be updated inside `setImages`, not outside it.** The ref and state must always agree. The pattern is: `setImages(prev => { const next = fn(prev); imagesRef.current = next; return next })`.
5. **Build must pass before commit.** No exceptions.
6. **Show all evidence before committing.** No exceptions.
7. **Do not modify any other components** — BriefTab, ResearchTab, DraftTab, FAQTab, ConsistencyTab, DistributionTab, MetadataTab, and ImageLibraryPicker (hero picker) are NOT part of this fix and must not be changed.
