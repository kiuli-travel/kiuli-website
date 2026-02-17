# Phase B: Bug Fixes, Ghost Resets, and Re-Drafts

**Context:** Phase A passed all gates. Three bugs need fixing, three ghost completions need resetting, and five projects need (re-)drafting. This phase modifies application code, writes to the production database, and triggers LLM-powered drafting on production.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Follow the task order exactly.** Tasks are sequenced so that fixes are verified before drafts run.
2. **Every finding must be raw data** — SQL output, curl responses, file diffs. Not summaries.
3. **If a gate fails, STOP.** Do not attempt repairs. Write the report up to that point.
4. **Write your report as you go** to `content-engine/reports/phaseB-bug-fixes.md`.
5. **Do not skip any step.** Do not summarise. Do not paraphrase.
6. **Do not modify any files not listed in this prompt.**

---

## Task 1: Fix BUG-1 — Stage Advance Doesn't Reset processingStatus

Two files have the same bug: when a project is advanced to the next stage, `processingStatus` is not reset. This means projects that completed drafting keep `processingStatus: 'completed'` when advanced to review, creating misleading state.

### Fix 1a: `src/app/(payload)/api/content/dashboard/batch/route.ts`

In the `advance` action block, find this code:

```typescript
        if (nextStage) {
          const updateData: Record<string, unknown> = { stage: nextStage }
          if (nextStage === 'published') {
            updateData.publishedAt = new Date().toISOString()
          }
```

Change it to:

```typescript
        if (nextStage) {
          const updateData: Record<string, unknown> = {
            stage: nextStage,
            processingStatus: 'idle',
            processingError: null,
            processingStartedAt: null,
          }
          if (nextStage === 'published') {
            updateData.publishedAt = new Date().toISOString()
          }
```

No other changes to this file.

### Fix 1b: `content-system/conversation/handler.ts`

In the `processProjectActions` function, find the `stage_change` case:

```typescript
        case 'stage_change': {
          const currentStage = project.stage as string
          const contentType = project.contentType as string
          if (isValidTransition(currentStage, action.newStage!, contentType)) {
            data.stage = action.newStage
            if (action.newStage === 'published') {
              data.publishedAt = new Date().toISOString()
            }
```

Change it to:

```typescript
        case 'stage_change': {
          const currentStage = project.stage as string
          const contentType = project.contentType as string
          if (isValidTransition(currentStage, action.newStage!, contentType)) {
            data.stage = action.newStage
            data.processingStatus = 'idle'
            data.processingError = null
            data.processingStartedAt = null
            if (action.newStage === 'published') {
              data.publishedAt = new Date().toISOString()
            }
```

No other changes to this file.

### Verification 1: Read both files back and confirm the fix is present

After editing, `cat` or read the relevant section of each file and paste the output into the report. The output must show `processingStatus: 'idle'` inside the advance/stage_change blocks.

---

## Task 2: Fix BUG-2 — parseArticleOutput Silently Defaults Missing Fields

File: `content-system/drafting/article-drafter.ts`

### Fix 2a: Add raw LLM response logging

Find the `parseArticleOutput` function. Before the `JSON.parse(text)` line, add logging:

```typescript
  console.log(`[article-drafter] Raw LLM response (${text.length} chars):`, text.substring(0, 500))
```

### Fix 2b: Replace the validation and return block

The current function body after `JSON.parse(text)` has two checks (body and faqSection) then silently defaults metaTitle, metaDescription, and answerCapsule to empty strings. Replace the entire section after `const parsed = JSON.parse(text)` with strict validation:

```typescript
  // Validate body
  if (!parsed.body || typeof parsed.body !== 'string') {
    throw new Error('Article draft missing body field')
  }
  if (parsed.body.length < 500) {
    throw new Error(`Article draft body too short: ${parsed.body.length} chars (minimum 500)`)
  }

  // Validate FAQ
  if (!Array.isArray(parsed.faqSection) || parsed.faqSection.length < 5) {
    throw new Error(`Article draft has ${Array.isArray(parsed.faqSection) ? parsed.faqSection.length : 0} FAQ items (minimum 5)`)
  }
  for (let i = 0; i < parsed.faqSection.length; i++) {
    const f = parsed.faqSection[i]
    if (!f.question || typeof f.question !== 'string' || f.question.trim().length === 0) {
      throw new Error(`FAQ item ${i} has empty question`)
    }
    if (!f.answer || typeof f.answer !== 'string' || f.answer.trim().length === 0) {
      throw new Error(`FAQ item ${i} has empty answer`)
    }
  }

  // Validate meta fields
  if (!parsed.metaTitle || typeof parsed.metaTitle !== 'string' || parsed.metaTitle.trim().length === 0) {
    throw new Error('Article draft missing metaTitle')
  }
  if (!parsed.metaDescription || typeof parsed.metaDescription !== 'string' || parsed.metaDescription.trim().length === 0) {
    throw new Error('Article draft missing metaDescription')
  }
  if (!parsed.answerCapsule || typeof parsed.answerCapsule !== 'string' || parsed.answerCapsule.trim().length === 0) {
    throw new Error('Article draft missing answerCapsule')
  }

  return {
    body: parsed.body,
    faqSection: parsed.faqSection.map((f: Record<string, unknown>) => ({
      question: String(f.question).trim(),
      answer: String(f.answer).trim(),
    })),
    metaTitle: String(parsed.metaTitle).trim().substring(0, 60),
    metaDescription: String(parsed.metaDescription).trim().substring(0, 160),
    answerCapsule: String(parsed.answerCapsule).trim(),
  }
```

### Verification 2: Read the function back

After editing, read the entire `parseArticleOutput` function and paste it into the report.

### Gate 1: Both Bugs Fixed

```
PASS criteria: Both files edited, both verifications show correct code, no other files modified.
FAIL action: STOP.
```

---

## Task 3: Build Verification

```bash
cd ~/Projects/kiuli-website
npm run build 2>&1 | tail -40
```

Record the exit code and output.

### Gate 2: Build Passes

```
PASS criteria: Exit code 0, no errors.
FAIL action: STOP. Record the full error output.
```

---

## Task 4: Reset Ghost Completions

Write a script at `content-system/scripts/reset-ghost-completions.ts`:

```typescript
/**
 * One-off script: reset ghost completion projects to idle state.
 * These projects have processing_status='completed' but no content.
 * Approved by Graham on 2026-02-17.
 *
 * Usage: npx tsx content-system/scripts/reset-ghost-completions.ts
 */
import { query, end } from '../db'

const GHOST_IDS = [79, 87, 89]

async function main() {
  console.log(`Resetting ${GHOST_IDS.length} ghost completions: ${GHOST_IDS.join(', ')}`)

  // Show before state
  const before = await query(
    `SELECT id, stage, processing_status, processing_error FROM content_projects WHERE id = ANY($1)`,
    [GHOST_IDS]
  )
  console.log('\nBEFORE:')
  for (const row of before.rows) {
    console.log(`  ID ${row.id}: stage=${row.stage}, processing_status=${row.processing_status}, error=${row.processing_error}`)
  }

  // Reset
  const result = await query(
    `UPDATE content_projects SET processing_status = 'idle', processing_error = NULL, processing_started_at = NULL WHERE id = ANY($1)`,
    [GHOST_IDS]
  )
  console.log(`\nUpdated ${result.rowCount} rows`)

  // Show after state
  const after = await query(
    `SELECT id, stage, processing_status, processing_error FROM content_projects WHERE id = ANY($1)`,
    [GHOST_IDS]
  )
  console.log('\nAFTER:')
  for (const row of after.rows) {
    console.log(`  ID ${row.id}: stage=${row.stage}, processing_status=${row.processing_status}, error=${row.processing_error}`)
  }

  await end()
}

main().catch((err) => {
  console.error('Script failed:', err)
  end().then(() => process.exit(1))
})
```

Run the script:

```bash
npx tsx content-system/scripts/reset-ghost-completions.ts
```

Record the full output.

### Gate 3: Ghost Completions Reset

```
PASS criteria: Script output shows all 3 projects changed from processing_status='completed' to processing_status='idle'. Updated 3 rows.
FAIL action: STOP.
```

---

## Task 5: Commit and Push

Stage ONLY these files:

```bash
git add src/app/(payload)/api/content/dashboard/batch/route.ts
git add content-system/conversation/handler.ts
git add content-system/drafting/article-drafter.ts
git add content-system/scripts/reset-ghost-completions.ts
```

Commit:

```bash
git commit -m "fix: BUG-1 reset processingStatus on stage advance, BUG-2 strict draft validation"
git push
```

### Gate 4: Committed and Pushed

```
PASS criteria: git status shows clean working tree (except gitignored files). Push succeeded.
FAIL action: STOP.
```

---

## Task 6: Wait for Deploy, Then Re-Draft

After pushing, Vercel auto-deploys from main. Wait at least 60 seconds, then verify the deploy is live:

```bash
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com/api/content/test-connection
```

If the response is not 405, wait another 60 seconds and try again. If it still fails after 3 attempts, STOP.

### Re-draft each project

The draft endpoint accepts Bearer authentication. Use the CONTENT_SYSTEM_SECRET environment variable:

```bash
export CONTENT_SYSTEM_SECRET=$(grep CONTENT_SYSTEM_SECRET .env | cut -d= -f2-)
```

If that doesn't work (no .env or variable not in it), check `.env.local` instead. If neither contains the variable, STOP and report — do not hardcode the value.

For each project, run the curl and wait for the response. These calls can take up to 300 seconds each.

**Project 27** (itinerary_cluster, has existing body — this will overwrite it):

```bash
curl -s -w "\n%{http_code}" -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 27}'
```

Record response body and status code. Then verify:

```sql
SELECT id, processing_status, processing_error, body IS NOT NULL AS has_body, meta_title IS NOT NULL AND meta_title != '' AS has_meta_title, meta_description IS NOT NULL AND meta_description != '' AS has_meta_description, answer_capsule IS NOT NULL AND answer_capsule != '' AS has_capsule FROM content_projects WHERE id = 27;
```

Also check FAQ count:

```sql
SELECT COUNT(*) AS faq_count FROM content_projects_faq_section WHERE _parent_id = 27;
```

**Project 53** (itinerary_cluster, failed, no content):

```bash
curl -s -w "\n%{http_code}" -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 53}'
```

Record response. Then run the same two verification queries with `WHERE id = 53` / `WHERE _parent_id = 53`.

**Project 79** (authority, ghost reset):

```bash
curl -s -w "\n%{http_code}" -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 79}'
```

Record response. Verify with same queries for id 79.

**Project 87** (authority, ghost reset):

```bash
curl -s -w "\n%{http_code}" -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 87}'
```

Record response. Verify with same queries for id 87.

**Project 89** (itinerary_cluster, ghost reset, NO research synthesis — brief only):

```bash
curl -s -w "\n%{http_code}" -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 89}'
```

Record response. Verify with same queries for id 89.

### Gate 5: All Five Projects Drafted

For each project, ALL of these must be true:
- `processing_status = 'completed'`
- `has_body = true`
- `has_meta_title = true`
- `has_meta_description = true`
- `has_capsule = true`
- `faq_count >= 5`

```
PASS criteria: All 5 projects meet all 6 conditions.
FAIL action: Record which project(s) failed and which condition(s). STOP.
```

---

## Task 7: Final State Summary

Run this query and record the output:

```sql
SELECT id, content_type, stage, processing_status, body IS NOT NULL AS has_body, meta_title IS NOT NULL AND meta_title != '' AS has_meta_title, meta_description IS NOT NULL AND meta_description != '' AS has_meta_description, answer_capsule IS NOT NULL AND answer_capsule != '' AS has_capsule FROM content_projects WHERE stage IN ('draft', 'review', 'published') ORDER BY id;
```

And FAQ counts for all draft+ projects:

```sql
SELECT f._parent_id AS project_id, COUNT(*) AS faq_count FROM content_projects_faq_section f JOIN content_projects cp ON cp.id = f._parent_id WHERE cp.stage IN ('draft', 'review', 'published') GROUP BY f._parent_id ORDER BY f._parent_id;
```

---

## Report Format

Write to `content-engine/reports/phaseB-bug-fixes.md`:

```markdown
# Phase B: Bug Fixes, Ghost Resets, and Re-Drafts — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## Task 1: BUG-1 Fix

### 1a: batch/route.ts
[code diff or relevant section after edit]

### 1b: handler.ts
[code diff or relevant section after edit]

### Verification 1
[raw file content showing fix]

## Task 2: BUG-2 Fix

### 2a: Raw logging added
[relevant line]

### 2b: Strict validation
[full parseArticleOutput function after edit]

### Verification 2
[raw file content showing fix]

### Gate 1: [PASS/FAIL]

---

## Task 3: Build
[output]
[exit code]

### Gate 2: [PASS/FAIL]

---

## Task 4: Ghost Completion Reset
[full script output]

### Gate 3: [PASS/FAIL]

---

## Task 5: Commit and Push
[commit hash]
[git status output]

### Gate 4: [PASS/FAIL]

---

## Task 6: Re-Drafts

### Project 27
[curl response]
[DB verification queries and output]

### Project 53
[curl response]
[DB verification queries and output]

### Project 79
[curl response]
[DB verification queries and output]

### Project 87
[curl response]
[DB verification queries and output]

### Project 89
[curl response]
[DB verification queries and output]

### Gate 5: [PASS/FAIL]

---

## Task 7: Final State
[query output]
[FAQ counts output]

---

## Overall: [ALL GATES PASS / BLOCKED AT GATE N]
```

---

## DO NOT

- Do not modify any files other than the three listed in Tasks 1-2 and the new script in Task 4
- Do not advance any project to review stage
- Do not run database migrations
- Do not investigate cascade failures (separate phase)
- Do not hardcode any secrets in files
- Do not retry a failed draft more than once per project
- Do not skip any verification query
- Do not summarise or paraphrase query outputs

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.** Do not attempt to fix the failure.
