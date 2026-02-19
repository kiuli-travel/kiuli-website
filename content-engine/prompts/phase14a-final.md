# PHASE 14a — Final: Deduplicate, Commit, Deploy

All Phase 14a code changes are complete but uncommitted. Two things remain before commit.

---

## TASK 1 — Extract duplicated transformProject

`transformProject`, `parseArticleImages`, and `parseJsonArray` are duplicated in two files:
- `src/app/(payload)/admin/content-engine/project/[id]/page.tsx`
- `src/app/(payload)/admin/content-engine/project/[id]/actions.ts`

This is a defect. They already drifted once (hero image resolution was missing from the actions copy). Extract to a single shared module.

### Steps

1. Create `src/lib/transform-project.ts`
2. Move into it: `transformProject`, `parseArticleImages`, `parseJsonArray`, and the `ArticleImage` import from workspace-types
3. Export `transformProject`, `parseArticleImages`, `parseJsonArray`
4. In `page.tsx`: delete the local copies, import from `@/lib/transform-project`
5. In `actions.ts`: delete the local copies, import from `@/lib/transform-project`
6. Both files still do hero image and article image resolution AFTER calling `transformProject` — that stays in each file (it requires Payload instance). Only the pure transformation logic moves.

### What NOT to move

The hero image resolution and article image resolution blocks stay in their respective files because they require `payload.findByID` calls. `transformProject` is a pure function that takes raw DB output and returns a typed object. Keep it pure.

### Verification

```bash
# Confirm no duplicate definitions remain
echo "=== Duplicate check ===" > content-engine/evidence/phase14a-dedup.txt
grep -c "function transformProject" src/app/\(payload\)/admin/content-engine/project/\[id\]/page.tsx >> content-engine/evidence/phase14a-dedup.txt
grep -c "function transformProject" src/app/\(payload\)/admin/content-engine/project/\[id\]/actions.ts >> content-engine/evidence/phase14a-dedup.txt
grep -c "function transformProject" src/lib/transform-project.ts >> content-engine/evidence/phase14a-dedup.txt

echo "" >> content-engine/evidence/phase14a-dedup.txt
echo "=== Import check ===" >> content-engine/evidence/phase14a-dedup.txt
grep "transform-project" src/app/\(payload\)/admin/content-engine/project/\[id\]/page.tsx >> content-engine/evidence/phase14a-dedup.txt
grep "transform-project" src/app/\(payload\)/admin/content-engine/project/\[id\]/actions.ts >> content-engine/evidence/phase14a-dedup.txt
```

Expected:
- page.tsx: 0 definitions, 1 import
- actions.ts: 0 definitions, 1 import
- transform-project.ts: 1 definition

---

## TASK 2 — Build

```bash
npm run build 2>&1 | tail -30 > content-engine/evidence/phase14a-final-build.txt
echo "EXIT: $?" >> content-engine/evidence/phase14a-final-build.txt
```

Must be `EXIT: 0`. If it fails, fix the imports — do not revert the extraction.

---

## TASK 3 — Commit and push

```bash
git add -A
git status > content-engine/evidence/phase14a-commit.txt
git commit -m "Phase 14a: Image Library polish — hero feedback, free-text prompts, detail modal, article images, deduplicated transformProject"
git push origin main 2>&1 >> content-engine/evidence/phase14a-commit.txt
echo "DONE" >> content-engine/evidence/phase14a-commit.txt
```

---

## TASK 4 — Verify deploy

Wait 60 seconds after push, then:

```bash
echo "=== Deploy check ===" > content-engine/evidence/phase14a-deploy.txt
curl -s -o /dev/null -w "kiuli.com: %{http_code}\n" https://kiuli.com >> content-engine/evidence/phase14a-deploy.txt
curl -s -o /dev/null -w "admin.kiuli.com: %{http_code}\n" https://admin.kiuli.com >> content-engine/evidence/phase14a-deploy.txt
echo "DONE" >> content-engine/evidence/phase14a-deploy.txt
```

Both must return 200.

---

## Rules

- Do not skip the deduplication. It is not optional.
- Do not weaken the build gate. If build fails, fix the code.
- Do not commit without a passing build.
- Show me the contents of all 4 evidence files when done.
