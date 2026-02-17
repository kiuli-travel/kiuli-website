# Phase B: Bug Fixes and Re-Draft

**Context:** Phase A passed all gates. Three ghost completions identified (79, 87, 89). Two additional projects need re-drafting (27 partial, 53 failed). Two bugs cause these failures and must be fixed before re-drafting.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Follow the task order exactly.** Tasks 1-3 must complete before Task 4. Task 4 must complete before Task 5.
2. **Every code change must use exact before/after blocks.** Do not refactor surrounding code.
3. **Build must pass after each code task.** If build fails, stop and report.
4. **Write your report as you go** to `content-engine/reports/phaseB-bug-fixes.md`.
5. **The report must contain raw output of every command and query.** Not paraphrased.
6. **Do not proceed past a failed gate.**

---

## Task 1: Fix BUG-1 — Stage Advance Does Not Reset processingStatus

When a project is advanced from one stage to the next, `processingStatus` is not reset. A project that completed research arrives at `draft` stage with `processingStatus: 'completed'` — appearing as if drafting already finished. This is the ghost completion mechanism.

Three locations need the same fix.

### 1a: `src/app/(payload)/api/content/dashboard/batch/route.ts` — advance action

Find this exact code in the `advance` block:

```typescript
        if (nextStage) {
          const updateData: Record<string, unknown> = { stage: nextStage }
          if (nextStage === 'published') {
```

Replace with:

```typescript
        if (nextStage) {
          const updateData: Record<string, unknown> = {
            stage: nextStage,
            processingStatus: 'idle',
            processingError: null,
            processingStartedAt: null,
          }
          if (nextStage === 'published') {
```

### 1b: Same file — retry action

Find this exact code in the `retry` block:

```typescript
          data: {
            processingStatus: 'idle',
            processingError: null,
          },
```

Replace with:

```typescript
          data: {
            processingStatus: 'idle',
            processingError: null,
            processingStartedAt: null,
          },
```

### 1c: `content-system/conversation/handler.ts` — stage_change case

Find this exact code inside the `stage_change` case in `processProjectActions`:

```typescript
          if (isValidTransition(currentStage, action.newStage!, contentType)) {
            data.stage = action.newStage
            if (action.newStage === 'published') {
```

Replace with:

```typescript
          if (isValidTransition(currentStage, action.newStage!, contentType)) {
            data.stage = action.newStage
            data.processingStatus = 'idle'
            data.processingError = null
            data.processingStartedAt = null
            if (action.newStage === 'published') {
```

### 1d: Build check

```bash
npm run build 2>&1 | tail -20
echo "EXIT: $?"
```

### Gate 1: BUG-1 Fix Compiles

```
PASS criteria: Build exit code 0.
FAIL action: Record full error output and STOP.
```

---

## Task 2: Fix BUG-2 — Silent Defaults in Draft Output Validation

The article drafter's `parseArticleOutput` silently converts missing/empty fields to empty strings instead of throwing. This is how project 27 ended up with body but no metaDescription or answerCapsule. The same pattern exists in the destination and property page drafters.

### 2a: `content-system/drafting/article-drafter.ts` — add raw response logging

Find this exact line (around line 172):

```typescript
    const output = parseArticleOutput(result.content)
```

Replace with:

```typescript
    console.log(`[article-drafter] Raw LLM response for project ${projectId} (first 500 chars):`, result.content.substring(0, 500))
    const output = parseArticleOutput(result.content)
```

### 2b: Same file — replace parseArticleOutput validation

Find the entire `return` block inside `parseArticleOutput`, starting from:

```typescript
  return {
    body: parsed.body,
    faqSection: parsed.faqSection.map((f: Record<string, unknown>) => ({
      question: String(f.question || ''),
      answer: String(f.answer || ''),
    })),
    metaTitle: String(parsed.metaTitle || '').substring(0, 60),
    metaDescription: String(parsed.metaDescription || '').substring(0, 160),
    answerCapsule: String(parsed.answerCapsule || ''),
  }
```

Replace with:

```typescript
  // Strict validation — throw on incomplete output
  if (parsed.body.length < 500) {
    throw new Error(`Article body too short: ${parsed.body.length} chars (minimum 500)`)
  }
  if (parsed.faqSection.length < 5) {
    throw new Error(`Article FAQ too few items: ${parsed.faqSection.length} (minimum 5)`)
  }

  const metaTitle = String(parsed.metaTitle || '').trim()
  const metaDescription = String(parsed.metaDescription || '').trim()
  const answerCapsule = String(parsed.answerCapsule || '').trim()

  if (!metaTitle) throw new Error('Article draft has empty metaTitle')
  if (!metaDescription) throw new Error('Article draft has empty metaDescription')
  if (!answerCapsule) throw new Error('Article draft has empty answerCapsule')

  const faqSection = parsed.faqSection.map((f: Record<string, unknown>, i: number) => {
    const question = String(f.question || '').trim()
    const answer = String(f.answer || '').trim()
    if (!question) throw new Error(`FAQ item ${i} has empty question`)
    if (!answer) throw new Error(`FAQ item ${i} has empty answer`)
    return { question, answer }
  })

  return {
    body: parsed.body,
    faqSection,
    metaTitle: metaTitle.substring(0, 60),
    metaDescription: metaDescription.substring(0, 160),
    answerCapsule,
  }
```

### 2c: `content-system/drafting/destination-page-drafter.ts` — strict meta validation

Find the return block inside `generateMeta` (near end of function):

```typescript
  return {
    metaTitle: String(parsed.metaTitle || '').substring(0, 60),
    metaDescription: String(parsed.metaDescription || '').substring(0, 160),
    answerCapsule: String(parsed.answerCapsule || ''),
  }
```

Replace with:

```typescript
  const metaTitle = String(parsed.metaTitle || '').trim()
  const metaDescription = String(parsed.metaDescription || '').trim()
  const answerCapsule = String(parsed.answerCapsule || '').trim()

  if (!metaTitle) throw new Error('Destination page draft has empty metaTitle')
  if (!metaDescription) throw new Error('Destination page draft has empty metaDescription')
  if (!answerCapsule) throw new Error('Destination page draft has empty answerCapsule')

  return {
    metaTitle: metaTitle.substring(0, 60),
    metaDescription: metaDescription.substring(0, 160),
    answerCapsule,
  }
```

### 2d: Same file — strict FAQ item validation

Find this code inside the FAQ section handling in `draftDestinationPage` (inside the `if (sectionKey === 'faq')` block):

```typescript
      if (sectionKey === 'faq') {
        // Parse FAQ section into structured items
        const parsed = parseFaqFromText(sectionContent)
        for (const item of parsed) {
          faqItems.push(item)
        }
```

Replace with:

```typescript
      if (sectionKey === 'faq') {
        // Parse FAQ section into structured items
        const parsed = parseFaqFromText(sectionContent)
        for (let i = 0; i < parsed.length; i++) {
          if (!parsed[i].question.trim()) throw new Error(`Destination FAQ item ${i} has empty question`)
          if (!parsed[i].answer.trim()) throw new Error(`Destination FAQ item ${i} has empty answer`)
          faqItems.push(parsed[i])
        }
```

### 2e: `content-system/drafting/property-page-drafter.ts` — strict meta validation

Find these three lines in the final write block (step 10):

```typescript
        metaTitle: String(meta.metaTitle || '').substring(0, 60),
        metaDescription: String(meta.metaDescription || '').substring(0, 160),
        answerCapsule: String(meta.answerCapsule || ''),
```

Replace with:

```typescript
        metaTitle: (() => { const v = String(meta.metaTitle || '').trim(); if (!v) throw new Error('Property page draft has empty metaTitle'); return v.substring(0, 60) })(),
        metaDescription: (() => { const v = String(meta.metaDescription || '').trim(); if (!v) throw new Error('Property page draft has empty metaDescription'); return v.substring(0, 160) })(),
        answerCapsule: (() => { const v = String(meta.answerCapsule || '').trim(); if (!v) throw new Error('Property page draft has empty answerCapsule'); return v })(),
```

### 2f: Same file — strict FAQ item validation

Find this code inside the FAQ parsing block:

```typescript
            for (const f of parsed) {
              faqItems.push({
                question: String(f.question || ''),
                answer: String(f.answer || ''),
              })
            }
```

Replace with:

```typescript
            for (let i = 0; i < parsed.length; i++) {
              const question = String(parsed[i].question || '').trim()
              const answer = String(parsed[i].answer || '').trim()
              if (!question) throw new Error(`Property FAQ item ${i} has empty question`)
              if (!answer) throw new Error(`Property FAQ item ${i} has empty answer`)
              faqItems.push({ question, answer })
            }
```

### 2g: Build check

```bash
npm run build 2>&1 | tail -20
echo "EXIT: $?"
```

### Gate 2: BUG-2 Fix Compiles

```
PASS criteria: Build exit code 0.
FAIL action: Record full error output and STOP.
```

---

## Task 3: Commit, Push, Verify Deployment

### 3a: Commit and push

```bash
git add src/app/\(payload\)/api/content/dashboard/batch/route.ts
git add content-system/conversation/handler.ts
git add content-system/drafting/article-drafter.ts
git add content-system/drafting/destination-page-drafter.ts
git add content-system/drafting/property-page-drafter.ts
git commit -m "fix: reset processingStatus on stage advance, strict draft output validation"
git push
```

### 3b: Verify Vercel deployment

After push, Vercel will auto-deploy. Wait for deployment to complete:

```bash
# Check deployment status — repeat until status is "READY"
npx vercel inspect --token="$VERCEL_TOKEN" 2>&1 | head -20
```

If you cannot check Vercel status programmatically, wait 90 seconds after push, then verify the production site responds:

```bash
sleep 90
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com/api/content/draft
```

Expected: 401 (route exists but unauthenticated). Any response other than 404 confirms the deployment included the route.

### Gate 3: Code Deployed

```
PASS criteria: Code pushed to main. kiuli.com/api/content/draft returns non-404.
FAIL action: Record output and STOP.
```

---

## Task 4: Reset Ghost Completions and Failed Projects

All 5 projects need `processingStatus` reset to `idle` before re-drafting. The drafter will overwrite this when it starts, but resetting ensures clean state.

### 4a: Read CONTENT_SYSTEM_SECRET from local env

```bash
# Extract the bearer token for API calls in Task 5
export CONTENT_SECRET=$(grep CONTENT_SYSTEM_SECRET .env.local | cut -d= -f2- | tr -d "'\"")
echo "Token length: ${#CONTENT_SECRET}"
```

If the token is empty or `.env.local` doesn't contain `CONTENT_SYSTEM_SECRET`, check `.env` instead. Record which file the token came from.

If no token is found in any env file, STOP and report. Task 5 cannot proceed without it.

### 4b: Execute ghost resets

Create and run a script:

```bash
cat > /tmp/reset-projects.ts << 'EOF'
import { query, end } from './content-system/db'

async function main() {
  const ids = [27, 53, 79, 87, 89]
  
  // Show before state
  const before = await query(
    `SELECT id, stage, processing_status, processing_error,
       body IS NOT NULL AS has_body, meta_title IS NOT NULL AND meta_title != '' AS has_meta
     FROM content_projects WHERE id = ANY($1) ORDER BY id`,
    [ids]
  )
  console.log('BEFORE RESET:')
  console.table(before.rows)

  // Reset all 5
  const result = await query(
    `UPDATE content_projects 
     SET processing_status = 'idle', processing_error = NULL, processing_started_at = NULL
     WHERE id = ANY($1)
     RETURNING id, processing_status`,
    [ids]
  )
  console.log(`\nReset ${result.rowCount} projects:`)
  console.table(result.rows)

  // Verify
  const after = await query(
    `SELECT id, stage, processing_status, processing_error
     FROM content_projects WHERE id = ANY($1) ORDER BY id`,
    [ids]
  )
  console.log('\nAFTER RESET:')
  console.table(after.rows)

  await end()
}

main().catch(err => { console.error(err); process.exit(1) })
EOF

npx tsx /tmp/reset-projects.ts
```

### Gate 4: Resets Confirmed

```
PASS criteria: All 5 projects show processing_status = 'idle' and processing_error = NULL in AFTER output.
FAIL action: Record output and STOP.
```

---

## Task 5: Re-Draft All 5 Projects

Call the production draft API for each project. The draft route accepts `CONTENT_SYSTEM_SECRET` as a Bearer token.

### 5a: Draft each project

For EACH of these project IDs — 27, 53, 79, 87, 89 — run:

```bash
echo "--- Drafting project [ID] ---"
curl -s -w "\nHTTP_STATUS: %{http_code}\n" \
  -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SECRET" \
  -d '{"projectId": [ID]}'
```

Replace `[ID]` with each project ID. Run them ONE AT A TIME. Wait for each response before starting the next.

Record the full response body and HTTP status for each.

If any draft returns a non-200 status, record the error but continue to the next project. Do not stop.

### 5b: Verify all drafts

After all 5 have been attempted, run this verification script:

```bash
cat > /tmp/verify-drafts.ts << 'EOF'
import { query, end } from './content-system/db'

async function main() {
  const ids = [27, 53, 79, 87, 89]
  
  // Check project fields
  const projects = await query(
    `SELECT id, title, content_type, stage, processing_status, processing_error,
       body IS NOT NULL AS has_body,
       CASE WHEN body IS NOT NULL THEN length(body::text) ELSE 0 END AS body_length,
       meta_title IS NOT NULL AND meta_title != '' AS has_meta_title,
       meta_description IS NOT NULL AND meta_description != '' AS has_meta_description,
       answer_capsule IS NOT NULL AND answer_capsule != '' AS has_capsule
     FROM content_projects WHERE id = ANY($1) ORDER BY id`,
    [ids]
  )
  console.log('PROJECT STATE:')
  for (const row of projects.rows) {
    console.log(`\nProject ${row.id}: ${row.title}`)
    console.log(`  content_type: ${row.content_type}`)
    console.log(`  stage: ${row.stage}`)
    console.log(`  processing_status: ${row.processing_status}`)
    console.log(`  processing_error: ${row.processing_error || 'none'}`)
    console.log(`  has_body: ${row.has_body}`)
    console.log(`  body_length: ${row.body_length}`)
    console.log(`  has_meta_title: ${row.has_meta_title}`)
    console.log(`  has_meta_description: ${row.has_meta_description}`)
    console.log(`  has_capsule: ${row.has_capsule}`)
  }

  // Check FAQ counts
  const faqs = await query(
    `SELECT cp.id, COUNT(f.id) AS faq_count
     FROM content_projects cp
     LEFT JOIN content_projects_faq_section f ON f._parent_id = cp.id
     WHERE cp.id = ANY($1)
     GROUP BY cp.id ORDER BY cp.id`,
    [ids]
  )
  console.log('\nFAQ COUNTS:')
  console.table(faqs.rows)

  // Summary
  let allPass = true
  for (const row of projects.rows) {
    const faq = faqs.rows.find((f: Record<string, unknown>) => f.id === row.id)
    const faqCount = faq ? Number(faq.faq_count) : 0
    const pass = row.processing_status === 'completed' 
      && row.has_body === true
      && row.has_meta_title === true
      && row.has_meta_description === true
      && row.has_capsule === true
      && faqCount >= 5
    console.log(`Project ${row.id}: ${pass ? 'PASS' : 'FAIL'}`)
    if (!pass) allPass = false
  }

  console.log(`\nOVERALL: ${allPass ? 'ALL PASS' : 'SOME FAILED'}`)
  await end()
}

main().catch(err => { console.error(err); process.exit(1) })
EOF

npx tsx /tmp/verify-drafts.ts
```

### Gate 5: All Projects Drafted

```
PASS criteria: All 5 projects show:
  - processing_status = 'completed'
  - has_body = true
  - has_meta_title = true
  - has_meta_description = true  
  - has_capsule = true
  - faq_count >= 5

FAIL action: Record which projects failed and why. If a project failed with processing_error, record the error. If the API call returned non-200, record the response. STOP.
```

---

## Report Format

Write to `content-engine/reports/phaseB-bug-fixes.md`:

```markdown
# Phase B: Bug Fixes and Re-Draft — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## Task 1: BUG-1 Fix

### 1a: batch/route.ts advance action
[exact code changed]

### 1b: batch/route.ts retry action
[exact code changed]

### 1c: handler.ts stage_change
[exact code changed]

### 1d: Build
[raw output, exit code]

### Gate 1: [PASS/FAIL]

---

## Task 2: BUG-2 Fix

### 2a: article-drafter.ts raw logging
[exact code changed]

### 2b: article-drafter.ts strict validation
[exact code changed]

### 2c: destination-page-drafter.ts meta validation
[exact code changed]

### 2d: destination-page-drafter.ts FAQ validation
[exact code changed]

### 2e: property-page-drafter.ts meta validation
[exact code changed]

### 2f: property-page-drafter.ts FAQ validation
[exact code changed]

### 2g: Build
[raw output, exit code]

### Gate 2: [PASS/FAIL]

---

## Task 3: Deploy

### 3a: Commit
[commit hash, files]

### 3b: Vercel verification
[raw output]

### Gate 3: [PASS/FAIL]

---

## Task 4: Ghost Resets

### 4a: Bearer token
[source file, token length]

### 4b: Reset execution
[raw script output — before, reset result, after]

### Gate 4: [PASS/FAIL]

---

## Task 5: Re-Draft

### 5a: Draft responses
[for each project: ID, HTTP status, response body]

### 5b: Verification
[raw script output]

### Gate 5: [PASS/FAIL]

---

## Overall: [ALL GATES PASS / BLOCKED AT GATE N]
```

---

## DO NOT

- Do not refactor code beyond the specified changes
- Do not modify any files other than the 5 listed (batch/route.ts, handler.ts, article-drafter.ts, destination-page-drafter.ts, property-page-drafter.ts)
- Do not run drafts before deployment is confirmed (Gate 3)
- Do not run drafts before resets are confirmed (Gate 4)
- Do not skip any project in Task 5 — attempt all 5
- Do not re-attempt a failed draft automatically — record the failure and continue to next project
- Do not create scripts in the repo — use /tmp for throwaway scripts
- Do not summarise or paraphrase command outputs

---

## STOP CONDITIONS

If any gate fails, **stop and write the report up to that point.** Do not attempt to fix the failure. The strategist decides next steps.
