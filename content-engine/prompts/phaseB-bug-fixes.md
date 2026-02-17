# Phase B: Bug Fixes — Status Reset, Draft Output, Ghost Completions

**Context:** Phase A has completed. Git is clean, database state is audited, all routes are reachable. Three bugs must be fixed before any new features are built.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Fix ONLY the bugs described here.** Do not refactor unrelated code.
2. **Every fix must be verifiable via production database query.** Not "it looks right" — prove it works.
3. **Log raw evidence for every test.** Paste actual curl responses and SQL results into the report.
4. **If any fix has unexpected side effects, STOP and report.**
5. **Write your report to `content-engine/reports/phaseB-bug-fixes.md` as you go.**

---

## BUG-1: Stage Advance Does Not Reset processingStatus

### Problem

Two code paths advance a project's `stage` without resetting `processingStatus` to `'idle'`:

1. **`src/app/(payload)/api/content/dashboard/batch/route.ts`** — the `advance` action (around line 77) sets `stage: nextStage` but does NOT include `processingStatus: 'idle'`.
2. **`content-system/conversation/handler.ts`** — the `stage_change` case inside `processProjectActions` (around line 534) sets `data.stage = action.newStage` but does NOT set `data.processingStatus = 'idle'`.

### Fix — File 1: `src/app/(payload)/api/content/dashboard/batch/route.ts`

Find the `advance` action block. Currently it does:

```typescript
const updateData: Record<string, unknown> = { stage: nextStage }
if (nextStage === 'published') {
  updateData.publishedAt = new Date().toISOString()
}
```

Change it to:

```typescript
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

### Fix — File 2: `content-system/conversation/handler.ts`

Find the `stage_change` case inside `processProjectActions`. Currently it does:

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

Add the status reset:

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

### Verification for BUG-1

After deploying, use the batch API to advance a test project and then query the database:

```sql
-- Pick a project in 'idea' or 'brief' stage to test with
SELECT id, title, stage, processing_status FROM content_projects WHERE stage = 'idea' LIMIT 1;
```

Record the project id. Then advance it via curl:

```bash
# You'll need the CONTENT_SYSTEM_SECRET from Vercel env. Use Bearer auth.
curl -X POST https://kiuli.com/api/content/dashboard/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"action": "advance", "projectIds": [PROJECT_ID]}'
```

Wait — the batch route uses Payload session auth, not Bearer. You cannot test this via curl without a session cookie. Instead, verify the fix by:

1. Reading the code diff and confirming the 4 fields are set.
2. Checking that `npm run build` passes with no errors.
3. After deploy, use a direct SQL query to verify the mechanism. Manually update a test project's processing_status to 'completed' and stage to 'idea', then use the dashboard batch API from the admin UI to advance it, then check the database.

**Alternative verification (recommended):** Write a one-off Node.js script that:
1. Finds a project at 'idea' stage
2. Calls Payload's update API to set its processingStatus to 'completed' (simulating the bug state)
3. Calls the batch advance endpoint internally
4. Queries the database and asserts processingStatus is 'idle'

Place this script at `content-engine/scripts/verify-bug1-fix.ts`. DO NOT delete it after — it serves as regression evidence.

### Gate B1: Status Reset on Advance

```
PASS criteria:
1. Both files contain `processingStatus: 'idle'` in the stage advance path (diff evidence)
2. Build passes
3. Verification script runs and prints: "PASS: processingStatus is 'idle' after advance"
```

---

## BUG-2: Article Drafter Incomplete Output

### Problem

`content-system/drafting/article-drafter.ts` has two issues:

1. **No raw LLM response logging.** When the model returns malformed JSON or truncated output, there's no way to diagnose what happened. The catch block logs `errorMessage` but by then the raw response is lost.

2. **parseArticleOutput silently defaults missing fields.** If the LLM omits `metaDescription` or `answerCapsule`, they get `String(undefined || '')` which is `''`. The drafter then writes empty strings to the database and marks status as `completed`. Project 27 is evidence: it has a body and metaTitle but empty metaDescription and answerCapsule.

### Fix — `content-system/drafting/article-drafter.ts`

**Fix 2a: Add raw response logging.**

After the `callModel` call (step 10), before parsing, add:

```typescript
// 10. Call model
const result = await callModel('drafting', [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt },
], {
  maxTokens: 8192,
  temperature,
})

// 10a. Log raw response for diagnostics (truncated for sanity)
console.log(`[article-drafter] Raw response length: ${result.content.length} chars`)
console.log(`[article-drafter] Raw response preview: ${result.content.substring(0, 500)}`)
```

**Fix 2b: Validate all required fields in parseArticleOutput.**

Replace the current `parseArticleOutput` function with:

```typescript
function parseArticleOutput(raw: string): ArticleDraftOutput {
  let text = raw.trim()

  // Strip markdown fences
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    // Log the raw text that failed to parse
    console.error(`[article-drafter] JSON parse failed. Raw text (first 1000 chars): ${text.substring(0, 1000)}`)
    throw new Error(`Article draft response is not valid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }

  // Validate body (required, must be non-trivial)
  if (!parsed.body || typeof parsed.body !== 'string') {
    throw new Error('Article draft missing body field')
  }
  if (parsed.body.length < 500) {
    throw new Error(`Article draft body too short: ${parsed.body.length} chars (minimum 500)`)
  }

  // Validate faqSection (required, minimum 5 items)
  if (!Array.isArray(parsed.faqSection) || parsed.faqSection.length < 5) {
    throw new Error(`Article draft has ${Array.isArray(parsed.faqSection) ? parsed.faqSection.length : 0} FAQ items (minimum 5)`)
  }

  // Validate metaTitle (required, non-empty)
  if (!parsed.metaTitle || typeof parsed.metaTitle !== 'string' || parsed.metaTitle.trim().length === 0) {
    throw new Error('Article draft missing or empty metaTitle')
  }

  // Validate metaDescription (required, non-empty)
  if (!parsed.metaDescription || typeof parsed.metaDescription !== 'string' || parsed.metaDescription.trim().length === 0) {
    throw new Error('Article draft missing or empty metaDescription')
  }

  // Validate answerCapsule (required, non-empty)
  if (!parsed.answerCapsule || typeof parsed.answerCapsule !== 'string' || parsed.answerCapsule.trim().length === 0) {
    throw new Error('Article draft missing or empty answerCapsule')
  }

  return {
    body: parsed.body,
    faqSection: parsed.faqSection.map((f: Record<string, unknown>) => ({
      question: String(f.question || ''),
      answer: String(f.answer || ''),
    })),
    metaTitle: String(parsed.metaTitle).substring(0, 60),
    metaDescription: String(parsed.metaDescription).substring(0, 160),
    answerCapsule: String(parsed.answerCapsule),
  }
}
```

This ensures:
- Body must be at least 500 characters
- FAQ must have at least 5 items (relaxed from 8 to account for LLM variability — the prompt still asks for 8-10)
- metaTitle, metaDescription, answerCapsule must all be non-empty strings
- If any validation fails, the drafter throws, and the catch block marks `processingStatus: 'failed'` with the error message

### Gate B2: Drafter Validates All Fields

```
PASS criteria:
1. parseArticleOutput throws on: empty body, body < 500 chars, missing FAQ, < 5 FAQ items, empty metaTitle, empty metaDescription, empty answerCapsule (write a unit test or verification script that calls parseArticleOutput with bad inputs and confirms it throws for each case)
2. Build passes
3. Raw response logging is present (grep the code)
```

Place the verification at `content-engine/scripts/verify-bug2-fix.ts`. This script must:
- Import `parseArticleOutput` (you may need to export it)
- Call it with 7 different invalid inputs (one for each validation rule)
- Confirm each throws with the expected error message
- Call it with one valid input and confirm it returns the correct shape
- Print PASS/FAIL for each case

---

## Task 3: Reset Ghost Completions

After both bug fixes are committed and the build passes, reset the ghost completion projects identified in Phase A.

Run the following SQL queries via MCP db_query:

```sql
-- Identify ghost completions: processing_status = 'completed' but no body and no sections
SELECT id, title, content_type, stage, processing_status
FROM content_projects
WHERE processing_status = 'completed'
  AND body IS NULL
  AND (sections IS NULL OR sections::text = '{}' OR sections::text = 'null');
```

For each ghost completion found, reset it:

```sql
-- DO NOT run this yet. Record the list of IDs first and show them.
-- Then, after Graham confirms, execute this for each ID:
UPDATE content_projects
SET processing_status = 'idle',
    processing_error = NULL,
    processing_started_at = NULL
WHERE id = [ID]
  AND processing_status = 'completed'
  AND body IS NULL;
```

**STOP HERE AND REPORT THE LIST OF IDS TO GRAHAM.** Do not execute the reset without confirmation.

### Gate B3: Ghost Completions Resolved

```
PASS criteria:
1. Ghost completion IDs listed with evidence
2. After Graham's approval and reset: SELECT count(*) FROM content_projects WHERE processing_status = 'completed' AND body IS NULL AND sections IS NULL returns 0 (excluding projects that legitimately don't need body/sections, like those at 'research' stage whose 'completed' refers to research completion)

IMPORTANT NUANCE: Projects at 'research' stage with processing_status='completed' are NOT ghost completions IF they have synthesis data. Only flag projects where the stage implies content should exist (draft, review) but it doesn't.
```

---

## Task 4: Re-Draft Articles

After ghost completions are reset, trigger drafting for projects that are at `draft` stage with `processingStatus = 'idle'` and no body content.

```sql
-- Find projects that need drafting
SELECT id, title, content_type, stage, processing_status
FROM content_projects
WHERE stage = 'draft'
  AND processing_status = 'idle'
  AND body IS NULL
  AND content_type IN ('itinerary_cluster', 'authority', 'designer_insight');
```

For each project found, trigger the draft API:

```bash
curl -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID}'
```

After each draft completes (or fails), query the database:

```sql
SELECT id, title, processing_status, processing_error,
  body IS NOT NULL as has_body,
  meta_title IS NOT NULL as has_meta_title,
  meta_description IS NOT NULL as has_meta_desc,
  answer_capsule IS NOT NULL as has_capsule,
  (SELECT COUNT(*) FROM content_projects_faq_section WHERE _parent_id = cp.id) as faq_count
FROM content_projects cp
WHERE id = [PROJECT_ID];
```

### Gate B4: Drafts Produce Complete Output

```
PASS criteria:
For every project re-drafted:
- processing_status = 'completed' OR 'failed' (not stuck at 'processing')
- If completed: has_body = true, has_meta_title = true, has_meta_desc = true, has_capsule = true, faq_count >= 5
- If failed: processing_error contains a meaningful error message (not null, not empty)

At least ONE project must have completed successfully with all fields populated.
```

---

## Task 5: Investigate Cascade Failures

Run:

```sql
SELECT id, status, error, created_at, completed_at
FROM content_jobs
WHERE job_type = 'cascade'
ORDER BY created_at DESC;
```

For each failed cascade job, record the error. If the errors share a common pattern, note it. Do not fix — just document.

### Gate B5: Cascade Failures Documented

```
PASS criteria: Every failed cascade job's error is recorded in the report. If a pattern exists, it is identified.
```

---

## Commit and Deploy

After all fixes pass local build:

1. `git add -A`
2. `git commit -m "fix: BUG-1 processingStatus reset on stage advance, BUG-2 drafter output validation"`
3. `git push`
4. Deploy to Vercel (either via push-triggered deploy or `vercel --prod`)
5. Wait for deploy to complete
6. Run Gate B4 (re-drafting) against PRODUCTION

---

## Report Format

Write to `content-engine/reports/phaseB-bug-fixes.md`:

```markdown
# Phase B: Bug Fixes — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## BUG-1: Status Reset Fix
### Code Changes
[diff or description of exact changes in both files]
### Verification Script Output
[full output of verify-bug1-fix.ts]
### Gate B1: [PASS/FAIL]

## BUG-2: Drafter Output Validation
### Code Changes
[diff or description]
### Verification Script Output
[full output of verify-bug2-fix.ts]
### Gate B2: [PASS/FAIL]

## Ghost Completions
### Identified
[list of IDs with evidence]
### Reset Status
[pending Graham approval / executed]
### Gate B3: [PASS/FAIL]

## Re-Drafting
### Projects Drafted
[table: id, title, status, has_body, has_meta, faq_count]
### Gate B4: [PASS/FAIL]

## Cascade Failures
### Failed Jobs
[table: id, error, date]
### Pattern Analysis
[analysis or "no common pattern"]
### Gate B5: [PASS/FAIL]

## Git
- Committed: [YES/NO]
- Pushed: [YES/NO]
- Deploy: [status]

## Overall: [ALL GATES PASS / BLOCKED AT GATE N]
```

---

## STOP CONDITIONS

- If BUG-1 fix causes build failure → stop, report
- If BUG-2 verification script shows any FAIL → stop, report
- If ghost completion reset list needs Graham approval → stop, report, wait
- If ALL re-draft attempts fail → stop, report (this suggests an upstream issue like OpenRouter API key or model availability)
- If any unexpected database state appears → stop, report
