# PHASE 14 CLEANUP & FINAL COMMIT

Phase 14 code is complete and verified but nothing is committed. imgix was returning 402 due to account credits — now resolved. This prompt cleans up, re-verifies imgix, and commits.

## Rules

Same as before: evidence files are stdout captures, not hand-written. Fix and re-run, don't weaken assertions.

---

## STEP 1 — Re-verify imgix for generated images

The two test images (Media IDs 1274 and 1275) previously got 402 from imgix. Credits are now topped up. Verify they serve.

```bash
echo "=== imgix re-verification ===" > content-engine/evidence/cleanup-imgix.txt

# Test both generated images
for ID in 1274 1275; do
  URL=$(psql "$DATABASE_URL" -t -c "SELECT imgix_url FROM media WHERE id = $ID;" 2>/dev/null | xargs)
  echo "Media $ID: $URL" >> content-engine/evidence/cleanup-imgix.txt
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${URL}?w=100&auto=format" 2>/dev/null)
  echo "  HTTP status: $STATUS" >> content-engine/evidence/cleanup-imgix.txt
done
```

If you can't use psql directly, query via Payload or the db_query tool to get the imgix URLs, then curl them. The evidence file must show HTTP 200 for both. If still 402, stop and report — do not proceed.

---

## STEP 2 — Fix the upload pipeline test assertion

The test currently treats imgix 402 as a warning. It must be a hard failure. Find the assertion that was weakened and restore it:

imgix returning anything other than 200 must cause the test to fail with an error pushed to the errors array. No warnings, no soft passes.

After fixing, run the test to confirm it now passes cleanly (not with warnings):

```bash
npx tsx content-engine/scripts/test-upload-pipeline.ts 2>&1 | tee content-engine/evidence/cleanup-upload-retest.txt
```

The evidence file must contain `imgix HTTP status: 200` and `PASS` with zero warnings. This will cost ~$0.10 (one image generation + one labeling call).

---

## STEP 3 — Clean up test artifacts

Delete the tmp directory with test-generated images:

```bash
rm -rf content-engine/scripts/tmp
```

The two test Media records (1274, 1275) in the database can stay — they're legitimate generated images that prove the pipeline works. They're properly labeled and serve as examples in the library.

---

## STEP 4 — Verify library search finds generated images

Gate 5 ran before any images were generated, so the "source filter generated" test returned 0. Now there are 2 generated images. Confirm the source filter works:

```bash
npx tsx content-engine/scripts/test-library-search.ts 2>&1 | tee content-engine/evidence/cleanup-search-retest.txt
```

Test 9 (source filter "generated") must now show `Generated images: 2` (not 0).

---

## STEP 5 — Build

```bash
npm run build 2>&1 | tail -30 > content-engine/evidence/cleanup-build.txt
echo "EXIT: $?" >> content-engine/evidence/cleanup-build.txt
```

Must end with `EXIT: 0`.

---

## STEP 6 — Commit and push

```bash
git add -A
git status
```

Review what's being committed. The following should NOT be committed:
- `content-engine/scripts/tmp/` (should already be deleted in Step 3)
- Any `.env` files
- Any `node_modules`

Everything else is legitimate Phase 14 work. Commit:

```bash
git commit -m "Phase 14: Image Library — generation, labeling, search, workspace integration"
git push origin main
```

Capture evidence:

```bash
git log --oneline -1 > content-engine/evidence/cleanup-commit.txt
git status >> content-engine/evidence/cleanup-commit.txt
echo "DONE" >> content-engine/evidence/cleanup-commit.txt
```

The evidence file must contain a commit hash, a clean working tree, and `DONE`.

---

## Evidence checklist

```
content-engine/evidence/cleanup-imgix.txt          — HTTP 200 for both generated images
content-engine/evidence/cleanup-upload-retest.txt   — PASS with imgix 200, zero warnings
content-engine/evidence/cleanup-search-retest.txt   — PASS, generated images: 2
content-engine/evidence/cleanup-build.txt           — EXIT: 0
content-engine/evidence/cleanup-commit.txt          — commit hash + clean tree + DONE
```

All five must exist with passing content. Then Phase 14 is done.
