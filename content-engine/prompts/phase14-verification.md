# PHASE 14 VERIFICATION

## Rules

1. Every step produces an evidence file. The evidence file is the ONLY proof a step passed.
2. Evidence files are created by piping stdout/stderr to the file. You do not write evidence files by hand.
3. You run every step in order. You do not skip steps.
4. If a step fails, you fix the cause and re-run. Both the failure output AND the passing output go in the evidence file (append, don't overwrite).
5. You do not modify test scripts to make them pass by weakening assertions. You fix the code the tests exercise.
6. You do not proceed past STOP gates without reporting back with the evidence file contents.

## Setup

```bash
mkdir -p content-engine/evidence
```

---

## GATE 1 — Database model setting

The image generation model in the database must be `black-forest-labs/flux.2-max`, not a text model.

Query the current value. If wrong, update it. Query again to confirm.

Evidence: `content-engine/evidence/gate1.txt` must contain:
- The before-value query result
- The UPDATE statement (if needed)
- The after-value query result showing `black-forest-labs/flux.2-max`

You cannot generate this evidence file without running the actual queries.

---

## GATE 2 — Prompt generator

Run the test:

```bash
npx tsx content-engine/scripts/test-prompt-generator.ts 2>&1 | tee content-engine/evidence/gate2.txt
```

The evidence file must end with `PASS: All assertions passed`. If the test crashes or fails, read the error, fix the source code that caused it, and re-run (appending to the same file):

```bash
npx tsx content-engine/scripts/test-prompt-generator.ts 2>&1 | tee -a content-engine/evidence/gate2.txt
```

The final run in the evidence file must show PASS. The evidence file must also contain:
- At least 9 generated prompts (3 wildlife + 3 landscape + 3 destination)
- The word "Rejected" for the accommodation test
- Camera terms (mm, f/, lens) in prompt output

---

## GATE 3 — Image generation

Run the test:

```bash
npx tsx content-engine/scripts/test-image-generation.ts 2>&1 | tee content-engine/evidence/gate3.txt
```

Same rules. If it crashes, fix source code, append re-run output.

The evidence file must contain:
- `Model used:` with a FLUX model name (not claude, not gpt)
- `Dimensions:` with numbers above 256
- `Decoded buffer size:` with a value above 100
- `PASS: All assertions passed`
- `Saved to:` with a real file path

After the test passes, append file proof:

```bash
ls -la content-engine/scripts/tmp/test-generated-image.* >> content-engine/evidence/gate3.txt 2>&1
```

**This step costs real money (~$0.07). Run it only when you believe the code is correct.**

---

## ★ STOP GATE 1 ★

Stop here. Show me the contents of gate1.txt, gate2.txt, and gate3.txt. Do not proceed until I confirm.

---

## GATE 4 — Upload pipeline

Run the test:

```bash
npx tsx content-engine/scripts/test-upload-pipeline.ts 2>&1 | tee content-engine/evidence/gate4.txt
```

Same rules. Fix source, re-run, append.

The evidence file must contain:
- `Media ID:` with a real number
- `imgix URL:` starting with `https://kiuli.imgix.net/`
- `imgix HTTP status: 200`
- `labelingStatus: complete`
- `scene:` with actual descriptive text (not null, not undefined)
- `PASS: All assertions passed`

After the test passes, append a database check:

```bash
echo "--- DB verification ---" >> content-engine/evidence/gate4.txt
```

Then query: `SELECT id, alt, image_type, country, labeling_status, scene, source_s3_key FROM media WHERE source_s3_key LIKE 'generated:%' ORDER BY id DESC LIMIT 1;` and append the result to gate4.txt.

The DB row must exist with labeling_status = complete and a non-null scene.

**This step costs real money (~$0.10). Run it only when you believe the code is correct.**

---

## GATE 5 — Library search

Run the test:

```bash
npx tsx content-engine/scripts/test-library-search.ts 2>&1 | tee content-engine/evidence/gate5.txt
```

Same rules.

The evidence file must contain:
- 9 test headers (`Test 1:` through `Test 9:`)
- `Accommodation` test showing results > 0
- `Facet keys:` with at least countries and imageTypes
- `PASS: All critical assertions passed`

---

## GATE 6 — Build

```bash
npm run build 2>&1 | tail -80 > content-engine/evidence/gate6.txt
echo "EXIT: $?" >> content-engine/evidence/gate6.txt
```

The evidence file must end with `EXIT: 0`.

---

## GATE 7 — Workspace integration

```bash
echo "=== Placeholder check ===" > content-engine/evidence/gate7.txt
grep -rn "Image management coming" src/components/content-system/ >> content-engine/evidence/gate7.txt 2>&1
echo "EXIT: $?" >> content-engine/evidence/gate7.txt
echo "" >> content-engine/evidence/gate7.txt

echo "=== hero_image column ===" >> content-engine/evidence/gate7.txt
```

Then query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'content_projects' AND column_name = 'hero_image_id';` and append to gate7.txt.

```bash
echo "" >> content-engine/evidence/gate7.txt
echo "=== ImageLibraryPicker import ===" >> content-engine/evidence/gate7.txt
grep -rn "ImageLibraryPicker" src/components/content-system/workspace/ >> content-engine/evidence/gate7.txt 2>&1
```

The evidence file must show:
- The placeholder grep returns nothing (EXIT: 1 means grep found nothing — that's correct)
- hero_image_id column exists with integer type
- ImageLibraryPicker is imported in the workspace

---

## GATE 8 — Property guard

```bash
echo "=== Property guard in prompt-generator ===" > content-engine/evidence/gate8.txt
grep -n "ALLOWED_TYPES\|isPropertyType\|PROPERTY_GUARD" content-system/images/prompt-generator.ts >> content-engine/evidence/gate8.txt

echo "" >> content-engine/evidence/gate8.txt
echo "=== Property guard in upload-pipeline ===" >> content-engine/evidence/gate8.txt
grep -n "isPropertyType\|PROPERTY_GUARD" content-system/images/upload-pipeline.ts >> content-engine/evidence/gate8.txt

echo "" >> content-engine/evidence/gate8.txt
echo "=== Property guard in image-generator ===" >> content-engine/evidence/gate8.txt
grep -n "isPropertyType\|PROPERTY_GUARD" content-system/images/image-generator.ts >> content-engine/evidence/gate8.txt

echo "" >> content-engine/evidence/gate8.txt
echo "=== Property guard in server actions ===" >> content-engine/evidence/gate8.txt
grep -n "isPropertyType\|PROPERTY_GUARD" src/app/\(payload\)/admin/image-library/actions.ts >> content-engine/evidence/gate8.txt
```

The evidence file must show guard checks in ALL FOUR files. If any file has zero matches, the guard has a gap.

---

## ★ STOP GATE 2 ★

Stop here. Show me the contents of gate4.txt through gate8.txt. Do not proceed until I confirm.

---

## GATE 9 — Commit and push

Only after I confirm both stop gates:

```bash
git add -A
git status > content-engine/evidence/gate9.txt
git commit -m "Phase 14: Image Library — all gates verified with runtime evidence"
git push origin main 2>&1 >> content-engine/evidence/gate9.txt
echo "DONE" >> content-engine/evidence/gate9.txt
```

The evidence file must contain the commit hash and `DONE`.

---

## What "done" means

Phase 14 is done when:
- All 9 gate evidence files exist in `content-engine/evidence/`
- Gates 2-5 contain `PASS` from actual test execution
- Gate 6 contains `EXIT: 0`
- Gate 9 contains a commit hash and `DONE`
- I have reviewed both stop gates and confirmed

If any evidence file is missing, empty, or contains only FAIL output with no subsequent PASS, the phase is not done.
