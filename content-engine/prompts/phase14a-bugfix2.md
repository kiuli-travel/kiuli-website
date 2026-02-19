# PHASE 14a — Bugfix Round 2

Six bugs found in the deployed image system. Bugs 3 and 4 together make article image placement fundamentally broken.

---

## Investigation

Before any code changes, read these files and understand the heading extraction problem:

1. `content-system/embeddings/lexical-text.ts` — note that `extractTextFromLexical` does NOT preserve heading markers. Headings come out as plain text.
2. `src/components/content-system/workspace/ContentTabs.tsx` — find `extractHeadings()` and trace its logic. Note that it looks for `#` prefixes that will never exist in Lexical-extracted text.
3. `content-system/publishing/article-publisher.ts` — find `insertImagesIntoBody()`. Note that it positions based on Lexical AST heading nodes, not paragraph indices.

Write findings to `content-engine/evidence/phase14a-bugfix2-investigation.txt`.

---

## BUG 1 — "Load more" doesn't paginate

The button calls `doSearch()` with the same `limit: 60` and no offset. Returns identical results.

### Fix

Add an `offset` state variable. When "Load more" is clicked, increment offset and append results:

```typescript
const [offset, setOffset] = useState(0)
```

Pass `offset` to `searchImages`. In `library-search.ts`, add `offset` to `LibrarySearchOptions` and use it:

```typescript
const page = scored.slice(offset, offset + limit)
```

The "Load more" handler should:
1. Call search with current offset + limit as new offset
2. Append new matches to existing matches (not replace)
3. Hide the button when returned matches < limit (no more results)

Reset offset to 0 whenever filters change.

The `searchImages` server action must accept and pass through the offset parameter.

---

## BUG 2 — Caption save stale closure

`handleCaptionBlur` references `images` from its closure, which is stale because `handleCaptionChange` just called `setImages` but React hasn't re-rendered.

### Fix

Use a ref to always have the latest images:

```typescript
const imagesRef = useRef<ArticleImage[]>(project.articleImages || [])
// Keep ref in sync
useEffect(() => { imagesRef.current = images }, [images])
```

Then in `handleCaptionBlur`:
```typescript
const handleCaptionBlur = useCallback(() => {
  handleSave(imagesRef.current)
}, [handleSave])
```

Or simpler: make `handleCaptionBlur` accept the updated images directly by merging the logic so the save uses the freshly computed array, not the stale closure value.

---

## BUG 3 — Heading extraction fails for Lexical content

`extractTextFromLexical` strips heading structure. `extractHeadings` looks for markdown `#` prefixes that don't exist. Falls back to "Section N" for every draft.

### Fix

Create a new function `extractHeadingsFromLexical(body: unknown): string[]` in `content-system/embeddings/lexical-text.ts` that walks the Lexical AST and returns heading text:

```typescript
export function extractHeadingsFromLexical(lexicalJson: unknown): string[] {
  if (!lexicalJson || typeof lexicalJson !== 'object') return []
  const root = (lexicalJson as Record<string, unknown>).root
  if (!root || typeof root !== 'object') return []
  const children = (root as Record<string, unknown>).children
  if (!Array.isArray(children)) return []
  
  const headings: string[] = []
  for (const child of children) {
    if (child && typeof child === 'object' && (child as Record<string, unknown>).type === 'heading') {
      const text = extractNode(child)
      if (text.trim()) headings.push(text.trim())
    }
  }
  return headings
}
```

Then in `ContentTabs.tsx`, change `ArticleImagesSection` to use the raw Lexical body instead of the extracted text. This means:

1. Add `draftBodyRaw` to `WorkspaceProject` type (the raw Lexical JSON, not the extracted text)
2. In both `transformProject` copies (now in `src/lib/transform-project.ts`), add: `draftBodyRaw: raw.body || undefined`
3. In `ArticleImagesSection`, replace `extractHeadings(project.draftBody)` with `extractHeadingsFromLexical(project.draftBodyRaw)`
4. Keep the `draftBody` (plain text) fallback: if `draftBodyRaw` headings return empty, fall back to paragraph-split "Section N" labels from `draftBody`

---

## BUG 4 — Position mismatch between UI and publisher

The publisher positions based on Lexical heading nodes. The UI must use the same reference system.

### Fix

This is automatically fixed by Bug 3's fix. Once the UI extracts headings from the Lexical AST (same as the publisher does), positions align. Position 0 = first heading in both systems.

### Verification

After fixing, manually verify: if the draft has headings "Introduction", "The Gorilla Experience", "The Chimpanzee Trail", the UI should show "After: Introduction" at Position 0, "After: The Gorilla Experience" at Position 1, etc. NOT "After: Section 1".

---

## BUG 5 — Article image picker has no generate button

### Fix

Add the same `CompactGenerationModal` from `ImageLibraryPicker.tsx` to the `ArticleImagePickerModal`. Add a "Generate New" button that opens it. After generation, refresh the picker's search results.

The generation modal component already exists — just import and wire it up.

---

## BUG 6 — No excludeIds on article image picker

### Fix

Pass already-assigned mediaIds to the picker:

```typescript
const assignedIds = images.map(img => img.mediaId)
```

Then in `ArticleImagePickerModal`, accept an `excludeIds` prop and pass it to `searchImages`:

```typescript
const result = await searchImages({
  ...filters,
  excludeIds: excludeIds,
})
```

---

## Verification Gates

### Gate 1: Investigation file exists and is accurate
```bash
cat content-engine/evidence/phase14a-bugfix2-investigation.txt
```

### Gate 2: Build passes
```bash
npm run build 2>&1 | tail -20 > content-engine/evidence/phase14a-bugfix2-build.txt
echo "EXIT: $?" >> content-engine/evidence/phase14a-bugfix2-build.txt
```
Must be `EXIT: 0`.

### Gate 3: Load more uses offset
```bash
echo "=== Pagination ===" > content-engine/evidence/phase14a-bugfix2-fixes.txt
grep -n "offset" src/app/\(payload\)/admin/image-library/page.tsx >> content-engine/evidence/phase14a-bugfix2-fixes.txt
grep -n "offset" content-system/images/library-search.ts >> content-engine/evidence/phase14a-bugfix2-fixes.txt
grep -n "offset" content-system/images/types.ts >> content-engine/evidence/phase14a-bugfix2-fixes.txt
grep -n "offset" src/app/\(payload\)/admin/image-library/actions.ts >> content-engine/evidence/phase14a-bugfix2-fixes.txt
```
Must show offset in all 4 files.

### Gate 4: Caption uses ref or fresh state
```bash
echo "" >> content-engine/evidence/phase14a-bugfix2-fixes.txt
echo "=== Caption fix ===" >> content-engine/evidence/phase14a-bugfix2-fixes.txt
grep -n "imagesRef\|useRef.*ArticleImage\|captionBlur\|handleCaptionBlur" src/components/content-system/workspace/ContentTabs.tsx >> content-engine/evidence/phase14a-bugfix2-fixes.txt
```

### Gate 5: Lexical heading extraction exists and is used
```bash
echo "" >> content-engine/evidence/phase14a-bugfix2-fixes.txt
echo "=== Heading extraction ===" >> content-engine/evidence/phase14a-bugfix2-fixes.txt
grep -n "extractHeadingsFromLexical" content-system/embeddings/lexical-text.ts >> content-engine/evidence/phase14a-bugfix2-fixes.txt
grep -n "extractHeadingsFromLexical\|draftBodyRaw" src/components/content-system/workspace/ContentTabs.tsx >> content-engine/evidence/phase14a-bugfix2-fixes.txt
grep -n "draftBodyRaw" src/lib/transform-project.ts >> content-engine/evidence/phase14a-bugfix2-fixes.txt
```
Must show: function definition, usage in ContentTabs, and draftBodyRaw in transform.

### Gate 6: Article image picker has generate and excludeIds
```bash
echo "" >> content-engine/evidence/phase14a-bugfix2-fixes.txt
echo "=== Article picker fixes ===" >> content-engine/evidence/phase14a-bugfix2-fixes.txt
grep -n "excludeIds\|Generate\|CompactGeneration\|showGenModal" src/components/content-system/workspace/ContentTabs.tsx >> content-engine/evidence/phase14a-bugfix2-fixes.txt
```
Must show excludeIds prop and generate modal.

### Gate 7: Final build
```bash
npm run build 2>&1 | tail -20 > content-engine/evidence/phase14a-bugfix2-final.txt
echo "EXIT: $?" >> content-engine/evidence/phase14a-bugfix2-final.txt
```
Must be `EXIT: 0`.

### ★ STOP GATE
Show contents of ALL evidence files. Wait for confirmation before committing.

### Gate 8: Commit and push
```bash
git add -A
git commit -m "Phase 14a bugfix: pagination, caption save, Lexical heading extraction, article image picker improvements"
git push origin main
```

---

## Rules

- Do not skip the investigation step.
- The heading extraction fix is the most important change. Get this right.
- Do not weaken any existing functionality to make bugs easier to fix.
- Build must pass before commit. No exceptions.
- Show all evidence before committing.
