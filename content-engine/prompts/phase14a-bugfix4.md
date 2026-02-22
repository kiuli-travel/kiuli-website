# Phase 14a Bugfix 4 — Image Generation Timeout & UX

## Context

Image generation silently fails. When a user clicks "Generate & Save" on a photographic prompt, the operation takes 30-75 seconds (Flux generation via OpenRouter: 20-60s, S3 upload + Payload create: 5-15s). Vercel kills the server action before it completes because there is no `maxDuration` configured. The client-side `await` either hangs indefinitely or throws an unhandled exception. No error is shown. No progress is shown. The user is left staring at a modal that appears to have done nothing.

This affects **both** generation entry points:
1. `GenerationPanel` in `src/app/(payload)/admin/image-library/page.tsx` (main library)
2. `ArticleImageGenModal` in `src/components/content-system/workspace/ContentTabs.tsx` (article images)

Both call the `generateAndSaveImage` server action from `src/app/(payload)/admin/image-library/actions.ts`, which has no timeout control.

## Problems (3)

### Problem 1 — Vercel function timeout kills image generation

**Location:** `src/app/(payload)/admin/image-library/actions.ts`

The `generateAndSaveImage` server action calls `generateAndSave()` which does:
1. `callImageGeneration()` → OpenRouter → Flux model (20-60 seconds)
2. `uploadGeneratedImage()` → Buffer decode → Payload create with S3 upload → imgixUrl write (5-15 seconds)

Total wall clock: 30-75 seconds.

The actions file has no `maxDuration` export. There is no `vercel.json`. The `next.config.js` has no `serverActions` timeout config. Vercel uses its default timeout (10s Hobby, 60s Pro). The function gets killed mid-execution.

Server actions cannot export `maxDuration` — that is a Route Segment Config option. The only reliable way to control timeout for a long-running operation is a **route handler** with explicit `maxDuration`.

### Problem 2 — Missing try/catch lets failures crash silently

**Location:** Both generation modals

In `ArticleImageGenModal.handleGenImage`:
```javascript
setGenerating(true)
const result = await generateAndSaveImage(...)  // throws on timeout
setGenerating(false)  // never runs
```

In `GenerationPanel.handleGenerateImage`:
```javascript
setGeneratingImage(index)
const result = await generateAndSaveImage(...)  // throws on timeout
setGeneratingImage(null)  // never runs
```

Neither has try/catch. When the promise rejects (Vercel timeout = network error to the client), the state-cleanup lines never execute. The spinner either freezes forever or the component goes silent. No error is ever shown to the user.

### Problem 3 — No feedback during 30-75 second generation

Even if the timeout were fixed, the UX is a black hole:
- A button spinner (identical to a 200ms loading state) is the only feedback
- No time expectation — user assumes it broke after 10 seconds
- No staged progress (generating → uploading → done)
- No clear success confirmation — the image appears in the grid but nothing highlights it
- On error: `alert()` for caught errors, complete silence for thrown exceptions
- The prompt generation step (`handleGenPrompts`) also lacks try/catch

---

## Investigation (Step 0)

Before writing any code, verify these specific problems exist:

1. Open `src/app/(payload)/admin/image-library/actions.ts` — confirm NO `maxDuration` export anywhere in the file. Record line count.
2. Open `src/app/(payload)/admin/image-library/page.tsx` — find `handleGenerateImage` inside `GenerationPanel`. Confirm NO try/catch around the `await generateAndSaveImage(...)` call. Record the line number.
3. Open `src/app/(payload)/admin/image-library/page.tsx` — find `handleGeneratePrompts` inside `GenerationPanel`. Confirm NO try/catch around the `await generateImagePrompts(...)` call. Record the line number.
4. Open `src/components/content-system/workspace/ContentTabs.tsx` — find `handleGenImage` inside `ArticleImageGenModal`. Confirm NO try/catch around the `await generateAndSaveImage(...)` call. Record the line number.
5. Open `src/components/content-system/workspace/ContentTabs.tsx` — find `handleGenPrompts` inside `ArticleImageGenModal`. Confirm NO try/catch around the `await generateImagePrompts(...)` call. Record the line number.
6. Confirm NO route handler exists at `src/app/(payload)/api/content/generate-image/route.ts`.

Write findings to `content-engine/evidence/phase14a-bugfix4-investigation.txt`.

---

## Fix 1 — Route handler with maxDuration=120

**Create:** `src/app/(payload)/api/content/generate-image/route.ts`

This route handler wraps the existing `generateAndSave` function with a 120-second timeout. It follows the exact same pattern as the other content API routes (`/api/content/draft/route.ts`, `/api/content/research/route.ts`, etc).

```typescript
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { generateAndSave } from '../../../../../../content-system/images/image-generator'
import { isPropertyType, PROPERTY_GUARD_MESSAGE } from '../../../../../../content-system/images/types'

export const maxDuration = 120
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: { prompt?: string; metadata?: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { prompt, metadata } = body

  if (!prompt || typeof prompt !== 'string') {
    return Response.json({ error: 'Missing or invalid prompt' }, { status: 400 })
  }

  if (!metadata || !metadata.type || typeof metadata.type !== 'string') {
    return Response.json({ error: 'Missing or invalid metadata.type' }, { status: 400 })
  }

  if (isPropertyType(metadata.type)) {
    return Response.json({ error: PROPERTY_GUARD_MESSAGE }, { status: 400 })
  }

  try {
    const result = await generateAndSave(prompt, {
      type: metadata.type as 'wildlife' | 'landscape' | 'destination' | 'country',
      species: Array.isArray(metadata.species) ? metadata.species as string[] : undefined,
      country: typeof metadata.country === 'string' ? metadata.country : undefined,
      destination: typeof metadata.destination === 'string' ? metadata.destination : undefined,
      aspectRatio: typeof metadata.aspectRatio === 'string' ? metadata.aspectRatio : undefined,
    })
    return Response.json(result)
  } catch (error) {
    console.error('[generate-image] Error:', error instanceof Error ? error.message : error)
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
```

**Important:** The relative import path `../../../../../../content-system/images/image-generator` must be correct. Count the directory depth from `src/app/(payload)/api/content/generate-image/route.ts` to the project root. The `(payload)` route group directory counts as a level. Verify the import resolves by checking the build.

---

## Fix 2 — Client-side helper with network error handling

**Create:** `src/app/(payload)/admin/image-library/generate-client.ts`

This is a plain TypeScript module (NOT 'use server', NOT 'use client'). It can be imported by any client component. It calls the route handler from Fix 1 and wraps all failure modes into a clean result type.

```typescript
/**
 * Client-side helper to generate an image via the route handler.
 * Handles network errors, timeouts, and server errors uniformly.
 */
export async function generateImageViaApi(
  prompt: string,
  metadata: {
    type: string
    species?: string[]
    country?: string
    destination?: string
    aspectRatio?: string
  },
): Promise<{ mediaId: number; imgixUrl: string; model: string } | { error: string }> {
  try {
    const response = await fetch('/api/content/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, metadata }),
    })

    const data = await response.json()

    if (!response.ok) {
      return { error: data.error || `Server error (${response.status})` }
    }

    if (!data.mediaId || !data.imgixUrl) {
      return { error: 'Server returned incomplete result' }
    }

    return data
  } catch (error) {
    // Network failure, timeout, or JSON parse error
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return { error: 'Network error — check your connection and try again' }
    }
    return { error: error instanceof Error ? error.message : 'Unknown error — please try again' }
  }
}
```

---

## Fix 3 — Update GenerationPanel (main library page)

**File:** `src/app/(payload)/admin/image-library/page.tsx`

### 3a. Add import

Add this import alongside the existing imports from `./actions`:

```typescript
import { generateImageViaApi } from './generate-client'
```

Do NOT remove the existing `generateAndSaveImage` import — it may be used elsewhere (it won't be after this fix, but let the dead import be cleaned up separately or by the linter).

Actually — check: is `generateAndSaveImage` imported in this file? If so, remove it from the import. If it's only used in `handleGenerateImage`, it's safe to remove.

### 3b. Replace handleGenerateImage in GenerationPanel

Find the `handleGenerateImage` function inside `GenerationPanel`. Replace it with:

```typescript
const handleGenerateImage = useCallback(async (index: number) => {
  const prompt = prompts[index]
  if (!prompt) return
  setGeneratingImage(index)
  try {
    const result = await generateImageViaApi(prompt.prompt, {
      type: genType,
      species: species ? [species] : undefined,
      country: country || undefined,
      destination: destination || undefined,
      aspectRatio: prompt.aspectRatio,
    })
    if ('mediaId' in result) {
      setResults((prev) => [...prev, {
        prompt: prompt.prompt,
        mediaId: result.mediaId,
        imgixUrl: result.imgixUrl,
      }])
      onGenerated()
    } else {
      setResults((prev) => [...prev, { prompt: prompt.prompt, error: result.error }])
    }
  } catch (error) {
    setResults((prev) => [...prev, {
      prompt: prompt.prompt,
      error: error instanceof Error ? error.message : 'Unexpected error',
    }])
  } finally {
    setGeneratingImage(null)
  }
}, [prompts, genType, species, country, destination, onGenerated])
```

Key changes:
- `try/catch/finally` wraps the entire call
- `setGeneratingImage(null)` moves to `finally` — always runs regardless of success, error return, or thrown exception
- Uses `generateImageViaApi` instead of `generateAndSaveImage`
- Caught exceptions go to results array (visible to user) instead of being swallowed

### 3c. Add try/catch to handleGeneratePrompts in GenerationPanel

Find `handleGeneratePrompts`. Wrap in try/catch/finally:

```typescript
const handleGeneratePrompts = useCallback(async () => {
  setGeneratingPrompts(true)
  setPrompts([])
  setResults([])
  try {
    const result = await generateImagePrompts({
      type: genType,
      species: species || undefined,
      destination: destination || undefined,
      country: country || undefined,
      mood: mood || undefined,
      timeOfDay: timeOfDay || undefined,
      description: description || undefined,
    }, 3)
    if ('prompts' in result) {
      setPrompts(result.prompts)
    } else {
      alert(result.error)
    }
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Failed to generate prompts')
  } finally {
    setGeneratingPrompts(false)
  }
}, [genType, species, destination, country, mood, timeOfDay, description])
```

### 3d. Add time expectation to GenerationPanel prompt cards

In the render section of `GenerationPanel`, find where each prompt card renders the "Generate Image" button. Below the button, add a time expectation message that shows when generating:

Inside the prompt card `<div>`, after the existing generate button, add:

```jsx
{generatingImage === i && (
  <p className="mt-2 text-[10px] text-kiuli-charcoal/50">
    Generating image — this typically takes 30-60 seconds. Please don&apos;t close this panel.
  </p>
)}
```

---

## Fix 4 — Update ArticleImageGenModal (content workspace)

**File:** `src/components/content-system/workspace/ContentTabs.tsx`

### 4a. Add import

At the top of the file, add:

```typescript
import { generateImageViaApi } from '@/app/(payload)/admin/image-library/generate-client'
```

### 4b. Add state for generation feedback

Inside `ArticleImageGenModal`, add these state variables alongside the existing ones:

```typescript
const [generatingIndex, setGeneratingIndex] = useState<number | null>(null)
const [genError, setGenError] = useState<string | null>(null)
const [genSuccess, setGenSuccess] = useState<{ mediaId: number; imgixUrl: string } | null>(null)
```

Remove the existing `const [generating, setGenerating] = useState(false)` — it is replaced by `generatingIndex`.

### 4c. Replace handleGenImage

Replace the entire `handleGenImage` function:

```typescript
const handleGenImage = useCallback(async (index: number) => {
  setGeneratingIndex(index)
  setGenError(null)
  setGenSuccess(null)
  try {
    const result = await generateImageViaApi(prompts[index].prompt, {
      type: genType,
      species: species ? [species] : undefined,
      country: country || undefined,
      aspectRatio: prompts[index].aspectRatio,
    })
    if ('mediaId' in result) {
      setGenSuccess({ mediaId: result.mediaId, imgixUrl: result.imgixUrl })
      // Show success briefly, then close and refresh picker
      setTimeout(() => onGenerated(), 1500)
    } else {
      setGenError(result.error)
    }
  } catch (error) {
    setGenError(error instanceof Error ? error.message : 'Unexpected error')
  } finally {
    setGeneratingIndex(null)
  }
}, [prompts, genType, species, country, onGenerated])
```

### 4d. Replace handleGenPrompts with try/catch

```typescript
const handleGenPrompts = useCallback(async () => {
  setGenerating(true)
  setGenError(null)
  setGenSuccess(null)
  try {
    const result = await generateImagePrompts({
      type: genType,
      species: species || undefined,
      country: country || undefined,
      description: description || undefined,
    }, 3)
    if ('prompts' in result) setPrompts(result.prompts)
    else setGenError(result.error)
  } catch (error) {
    setGenError(error instanceof Error ? error.message : 'Failed to generate prompts')
  } finally {
    setGenerating(false)
  }
}, [genType, species, country, description])
```

Wait — this function still uses `generating` for the prompt generation step (not image generation). That is separate from image generation. Keep `const [generating, setGenerating] = useState(false)` for prompt generation. My instruction in 4b to remove it was wrong.

**Correction to 4b:** Keep `const [generating, setGenerating] = useState(false)`. This controls the "Generate Prompts" button state. Add the three new state variables alongside it:

```typescript
const [generating, setGenerating] = useState(false)  // ← KEEP THIS (for prompt generation)
const [prompts, setPrompts] = useState<PhotographicPrompt[]>([])
const [generatingIndex, setGeneratingIndex] = useState<number | null>(null)  // ← ADD
const [genError, setGenError] = useState<string | null>(null)  // ← ADD
const [genSuccess, setGenSuccess] = useState<{ mediaId: number; imgixUrl: string } | null>(null)  // ← ADD
```

### 4e. Update the render for prompt cards and feedback

In the JSX of `ArticleImageGenModal`, replace the prompts rendering section. The current section looks like:

```jsx
{prompts.length > 0 && (
  <div className="mt-4 flex flex-col gap-2">
    {prompts.map((p, i) => (
      <div key={i} className="rounded border border-kiuli-gray/60 p-3">
        <p className="line-clamp-3 text-[11px] text-kiuli-charcoal">{p.prompt}</p>
        <p className="mt-1 text-[10px] text-kiuli-charcoal/50">{p.cameraSpec} | {p.aspectRatio}</p>
        <button
          onClick={() => handleGenImage(p)}
          disabled={generating}
          className="mt-2 rounded bg-kiuli-clay px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
        >
          {generating ? <Loader2 className="inline h-3 w-3 animate-spin" /> : 'Generate & Save'}
        </button>
      </div>
    ))}
  </div>
)}
```

Replace with:

```jsx
{/* Error banner */}
{genError && (
  <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
    {genError}
  </div>
)}

{/* Success banner */}
{genSuccess && (
  <div className="mt-3 flex items-center gap-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src={`${genSuccess.imgixUrl.split('?')[0]}?w=80&h=60&fit=crop&auto=format`}
      alt="Generated"
      className="h-12 w-16 rounded object-cover"
    />
    <span className="text-xs font-medium text-emerald-700">Image saved to library!</span>
  </div>
)}

{prompts.length > 0 && !genSuccess && (
  <div className="mt-4 flex flex-col gap-2">
    {prompts.map((p, i) => (
      <div key={i} className="rounded border border-kiuli-gray/60 p-3">
        <p className="line-clamp-3 text-[11px] text-kiuli-charcoal">{p.prompt}</p>
        <p className="mt-1 text-[10px] text-kiuli-charcoal/50">{p.cameraSpec} | {p.aspectRatio}</p>
        <button
          onClick={() => handleGenImage(i)}
          disabled={generatingIndex !== null}
          className="mt-2 rounded bg-kiuli-clay px-3 py-1 text-[11px] font-medium text-white disabled:opacity-40"
        >
          {generatingIndex === i ? (
            <><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Generating...</>
          ) : (
            'Generate & Save'
          )}
        </button>
        {generatingIndex === i && (
          <p className="mt-2 text-[10px] text-kiuli-charcoal/50">
            Generating image — this typically takes 30-60 seconds. Please don&apos;t close this window.
          </p>
        )}
      </div>
    ))}
  </div>
)}
```

**Critical changes in the render:**
1. `handleGenImage(p)` changes to `handleGenImage(i)` — it now takes an index, not a prompt object
2. `disabled={generating}` changes to `disabled={generatingIndex !== null}` — tracks which prompt is generating
3. Time expectation message appears below the active prompt
4. Error banner shows above prompts (not alert())
5. Success banner shows the generated image thumbnail
6. Prompt cards hidden when success is showing (auto-closes after 1.5s via setTimeout in handleGenImage)

---

## Fix 5 — Clean up dead import

**File:** `src/app/(payload)/admin/image-library/page.tsx`

After Fix 3, the `generateAndSaveImage` import from `./actions` is no longer used in this file. Remove it from the import statement.

Check: is it `import { searchImages, generateImagePrompts, generateAndSaveImage } from './actions'`? If so, change to `import { searchImages, generateImagePrompts } from './actions'`.

**File:** `src/components/content-system/workspace/ContentTabs.tsx`

The import `import { searchImages, generateImagePrompts, generateAndSaveImage } from '@/app/(payload)/admin/image-library/actions'` — `generateAndSaveImage` is no longer called. Remove it. Keep `searchImages` and `generateImagePrompts`.

Wait — check if `generateAndSaveImage` is imported in ContentTabs.tsx at all. It might only be imported in page.tsx. Search for `generateAndSaveImage` in ContentTabs.tsx. If found, remove from import. If not found, the import is only in page.tsx.

---

## Verification Gates

### Gate 1: Investigation file
Confirm `content-engine/evidence/phase14a-bugfix4-investigation.txt` exists with all 6 items confirmed.

### Gate 2: Route handler exists
Verify `src/app/(payload)/api/content/generate-image/route.ts` exists and contains:
- `export const maxDuration = 120`
- `export const dynamic = 'force-dynamic'`
- `POST` function with authentication, input validation, and error handling

### Gate 3: Client helper exists
Verify `src/app/(payload)/admin/image-library/generate-client.ts` exists and contains:
- `generateImageViaApi` function
- `try/catch` around `fetch`
- Handles non-ok responses
- Returns `{ error: string }` for all failure modes

### Gate 4: GenerationPanel uses client helper
In `src/app/(payload)/admin/image-library/page.tsx`, verify:
- `generateImageViaApi` is imported from `./generate-client`
- `handleGenerateImage` calls `generateImageViaApi` (NOT `generateAndSaveImage`)
- `handleGenerateImage` has `try/catch/finally`
- `setGeneratingImage(null)` is in the `finally` block
- `handleGeneratePrompts` has `try/catch/finally`
- `setGeneratingPrompts(false)` is in the `finally` block
- Time expectation text exists: search for string "30-60 seconds"

### Gate 5: ArticleImageGenModal uses client helper
In `src/components/content-system/workspace/ContentTabs.tsx`, verify:
- `generateImageViaApi` is imported from `@/app/(payload)/admin/image-library/generate-client`
- `handleGenImage` calls `generateImageViaApi` (NOT `generateAndSaveImage`)
- `handleGenImage` has `try/catch/finally`
- `setGeneratingIndex(null)` is in the `finally` block
- `handleGenPrompts` has `try/catch/finally`
- `setGenerating(false)` is in the `finally` block
- `genError` state exists
- `genSuccess` state exists
- Error banner renders when `genError` is set
- Success banner renders when `genSuccess` is set
- Time expectation text exists: search for string "30-60 seconds"

### Gate 6: Dead imports removed
- `generateAndSaveImage` does NOT appear in `page.tsx` imports
- `generateAndSaveImage` does NOT appear in `ContentTabs.tsx` imports (if it was there)

### Gate 7: Build passes
Run build. EXIT: 0.

### Gate 8: ★ STOP GATE
Show all evidence. Wait for confirmation before committing.

### Gate 9: Commit and push
Message: `fix(images): route handler for generation timeout + UX feedback`
Files: the new route handler, client helper, and both modified component files.

---

## Rules

1. **Do not skip the investigation step.** Confirm every problem exists with line numbers before writing any code.
2. **Do not modify any other components.** Only touch: `page.tsx` (image library), `ContentTabs.tsx` (generation modals only), and the two new files.
3. **Do not remove the `generateAndSaveImage` server action from actions.ts.** It stays for potential future server-side use. Only remove the imports in the files that no longer call it.
4. **Every async handler must have try/catch/finally.** The `finally` block must always clean up loading state. No exceptions.
5. **`handleGenImage` takes an index, not a prompt object.** It reads `prompts[index]` internally. This matches how `handleGenerateImage` works in GenerationPanel.
6. **Build must pass before commit.**
7. **Show all evidence at the stop gate.**
