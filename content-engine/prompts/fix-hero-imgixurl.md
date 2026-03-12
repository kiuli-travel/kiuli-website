# Fix: Hero Image URL — use imgixUrl for display

Three targeted changes to `src/app/(payload)/admin/itinerary-editor/[id]/page.tsx`.

---

## Change 1 — Hero image URL on load

Find this exact block (around line 381):
```ts
        setHeroImageUrl(mediaUrl(doc.heroImage))
        setHeroImageAlt(mediaAlt(doc.heroImage))
```

Replace with:
```ts
        const heroImgObj = doc.heroImage && typeof doc.heroImage === 'object' ? doc.heroImage as Doc : null
        setHeroImageUrl(heroImgObj ? (str(heroImgObj.imgixUrl) || str(heroImgObj.url) || null) : null)
        setHeroImageAlt(mediaAlt(doc.heroImage))
```

---

## Change 2 — Hero image URL after picker selection

Find this block in the ImageSelectionModal `onSelect` handler (around line 900):
```ts
                const media = await res.json()
                setHeroImageUrl(typeof media.url === 'string' ? media.url : null)
                setHeroImageAlt(typeof media.alt === 'string' ? media.alt : typeof media.filename === 'string' ? media.filename : '')
```

Replace with:
```ts
                const media = await res.json()
                setHeroImageUrl(typeof media.imgixUrl === 'string' ? media.imgixUrl : typeof media.url === 'string' ? media.url : null)
                setHeroImageAlt(typeof media.alt === 'string' ? media.alt : typeof media.filename === 'string' ? media.filename : '')
```

---

## Build and commit

```bash
npm run build 2>&1 | tail -10 > content-engine/evidence/hero-imgixurl-fix-build.txt
echo "BUILD EXIT: $?" >> content-engine/evidence/hero-imgixurl-fix-build.txt
cat content-engine/evidence/hero-imgixurl-fix-build.txt
```

Required: `BUILD EXIT: 0`.

```bash
git add "src/app/(payload)/admin/itinerary-editor/[id]/page.tsx" content-engine/evidence/hero-imgixurl-fix-build.txt
git commit -m "fix(editor): use imgixUrl for hero image display"
git push origin main 2>&1
echo "PUSH EXIT: $?"
git status --short
```

Required: `PUSH EXIT: 0`. Show both exit codes and `git status --short`.

---

## Rules

- No other files modified.
- Build must pass before commit.
- Do not summarise build output — show the raw tail and exit code.
