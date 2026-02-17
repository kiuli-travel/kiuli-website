# Phase D: Consistency Checking Implementation

**Context:** Phase C is complete. Quality gates are operational — banned phrases, superlatives, meta lengths, FAQ counts, and required fields are all checked. Now we need consistency checking to prevent contradictory content from being published.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **Consistency checking uses the embedding store.** The 182 embeddings in production are the reference corpus.
2. **Use OpenRouter LLM to detect contradictions.** Pattern matching alone cannot find semantic contradictions like "best time is June-October" vs "November is ideal".
3. **Hard contradictions block publish. Soft contradictions warn.**
4. **Write report to `content-engine/reports/phaseD-consistency-checking.md`.**

---

## What Consistency Checking Does

Before publishing, the system:
1. Extracts factual claims from the draft content
2. Searches the embedding store for related existing content
3. Uses an LLM to detect contradictions between the draft and existing content
4. Categorises contradictions as hard (factual conflict) or soft (subjective/nuance difference)
5. Writes results to the `consistencyCheckResult` and `consistencyIssues` fields on the content project

---

## Task 1: Implement `content-system/quality/consistency-checker.ts`

Replace the stub. The function signature from types.ts:

```typescript
export async function checkConsistency(options: ConsistencyCheckOptions): Promise<ConsistencyResult>
```

Where `ConsistencyCheckOptions` is:
```typescript
{
  projectId: string
  draftContent: string
  targetCollection: string
  targetRecordId?: string
}
```

### Step 1: Extract claims from draft content

Use OpenRouter to extract factual claims:

```typescript
import { callModel } from '../openrouter-client'

const claimExtractionPrompt = `Extract all factual claims from this content. A factual claim is a statement that can be verified as true or false — dates, locations, species, seasonal information, pricing tiers, distances, durations, conservation status, etc.

Return a JSON array of strings, each being one distinct factual claim. Return ONLY the JSON array, no markdown fences, no preamble.

CONTENT:
${draftContent}`

const claimResult = await callModel('editing', [
  { role: 'system', content: 'You extract factual claims from safari travel content. Return only a JSON array of strings.' },
  { role: 'user', content: claimExtractionPrompt },
], { maxTokens: 2048, temperature: 0.1 })
```

Parse the response as `string[]`. If parsing fails, return `{ overallResult: 'pass', issues: [] }` with a logged warning — don't block on extraction failure.

### Step 2: Search embeddings for related content

For each claim (or batch of claims), use `semanticSearch` from `content-system/embeddings/query.ts`:

```typescript
import { semanticSearch } from '../embeddings/query'

const relatedChunks: Array<{ claim: string, matches: Array<{ chunkText: string, chunkType: string, score: number }> }> = []

for (const claim of claims) {
  const matches = await semanticSearch(claim, {
    topK: 3,
    minScore: 0.5,
    excludeProjectId: Number(options.projectId),
  })
  if (matches.length > 0) {
    relatedChunks.push({ claim, matches })
  }
}
```

If no related chunks found for any claims, return `{ overallResult: 'pass', issues: [] }`.

### Step 3: Detect contradictions via LLM

For each claim that has related content, ask the LLM to assess:

```typescript
const contradictionPrompt = `You are checking for factual contradictions between new content and existing published content on a safari travel website.

NEW CLAIM: "${chunk.claim}"

EXISTING CONTENT:
${chunk.matches.map(m => `- [${m.chunkType}] ${m.chunkText}`).join('\n')}

Does the new claim contradict any of the existing content?

Respond with ONLY a JSON object:
{
  "contradiction": "none" | "hard" | "soft",
  "explanation": "Brief explanation if contradiction found",
  "existingText": "The specific existing text that conflicts (if any)"
}

- "hard" = direct factual conflict (e.g., different dates, contradictory statements about a species, conflicting pricing info)
- "soft" = subjective difference or nuance that might confuse readers but isn't a factual error
- "none" = no contradiction`
```

### Step 4: Build ConsistencyResult

Aggregate all findings:

```typescript
const issues: ConsistencyIssue[] = []

for (const finding of findings) {
  if (finding.contradiction !== 'none') {
    issues.push({
      issueType: finding.contradiction as 'hard' | 'soft',
      existingContent: finding.existingText,
      newContent: finding.claim,
      sourceRecord: finding.sourceChunkId || 'embedding_store',
      resolution: 'pending',
    })
  }
}

const hasHard = issues.some(i => i.issueType === 'hard')
const hasSoft = issues.some(i => i.issueType === 'soft')

return {
  overallResult: hasHard ? 'hard_contradiction' : hasSoft ? 'soft_contradiction' : 'pass',
  issues,
}
```

### Step 5: Write results to project

After the check completes, update the content project:

```typescript
const payload = await getPayload({ config: configPromise })
await payload.update({
  collection: 'content-projects',
  id: Number(options.projectId),
  data: {
    consistencyCheckResult: result.overallResult,
    consistencyIssues: result.issues.map(issue => ({
      issueType: issue.issueType,
      existingContent: issue.existingContent,
      newContent: issue.newContent,
      sourceRecord: issue.sourceRecord,
      resolution: issue.resolution,
      resolutionNote: issue.resolutionNote || null,
    })),
  },
})
```

---

## Task 2: Create API Route `/api/content/consistency/route.ts`

Create `src/app/(payload)/api/content/consistency/route.ts`:

- POST endpoint
- Accepts `{ projectId: number }`
- Auth via Bearer token or Payload session (same pattern as other routes)
- Loads the project, extracts body text (same as quality-gates route)
- Calls `checkConsistency()`
- Returns `{ success, overallResult, issues }`
- `maxDuration = 120` (consistency checking makes multiple LLM calls)

---

## Task 3: Verification

### Test 3a: Positive Test — No Contradictions

Find a project with a clean draft that discusses topics well-covered in the embedding store. Run consistency check.

```bash
curl -X POST https://kiuli.com/api/content/consistency \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID}'
```

Expected: `overallResult: 'pass'` or `'soft_contradiction'` (soft is acceptable — it means the system found related content and checked it).

Record the full response.

### Test 3b: Negative Test — Intentional Contradiction

This is the critical test. Pick a factual claim from the embedding store:

```sql
SELECT chunk_text FROM content_embeddings 
WHERE chunk_type = 'itinerary_segment'
LIMIT 5;
```

Find a chunk that contains a verifiable factual claim (a date, season, location, etc.). Then:

1. Pick a project at draft stage
2. Use Payload API or direct SQL to inject a contradictory claim into its body or metaTitle
3. Run consistency check against it

Example: If an embedding says "The Great Migration typically occurs between July and October in the Masai Mara", update a draft to say "The Great Migration in the Masai Mara peaks in March and April."

Expected: `overallResult: 'hard_contradiction'`, with at least one issue documenting the specific conflict.

### Test 3c: Database Verification

After both tests, verify the results were written:

```sql
SELECT id, consistency_check_result, 
  (SELECT COUNT(*) FROM content_projects_consistency_issues WHERE _parent_id = cp.id) as issue_count
FROM content_projects cp
WHERE id IN (TEST_PROJECT_A, TEST_PROJECT_B);
```

### Gate D1: Consistency Checking Works

```
PASS criteria:
1. Test 3a: API returns a result (pass or soft_contradiction) without error
2. Test 3b: API returns hard_contradiction with at least one issue identifying the planted contradiction
3. Test 3c: Both projects have consistency_check_result set in the database
4. Build passes
5. Route returns non-404 on production
```

---

## Commit

```bash
git add -A
git commit -m "feat: Phase D — consistency checking with claim extraction, embedding search, and LLM contradiction detection"
git push
```

---

## Report Format

Write to `content-engine/reports/phaseD-consistency-checking.md`:

```markdown
# Phase D: Consistency Checking — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## Implementation
### Files Created/Modified
[list]

### consistency-checker.ts
- Claim extraction: [how it works]
- Embedding search: [parameters]
- Contradiction detection: [model used, prompt approach]
- Result writing: [fields updated]

### API Route
[path, method, maxDuration]

## Verification
### Test 3a: Clean Content
**Project ID:** [id]
**Response:** [full JSON]
**Database after:** [SQL result]
**Result:** [PASS/FAIL]

### Test 3b: Planted Contradiction
**Existing fact:** [the embedding claim]
**Planted contradiction:** [what was inserted]
**Project ID:** [id]
**Response:** [full JSON]
**Database after:** [SQL result]
**Result:** [PASS/FAIL]

### Test 3c: Database Verification
[SQL output]

### Gate D1: [PASS/FAIL]

## Git
- Committed: [YES/NO]
- Pushed: [YES/NO]

## Overall: [PASS / BLOCKED AT GATE]
```

---

## STOP CONDITIONS

- If `semanticSearch` throws or returns empty for everything → the embedding store may be broken. STOP and check `content_embeddings` table.
- If OpenRouter call fails → check OPENROUTER_API_KEY in Vercel env. STOP and report.
- If Test 3b returns 'pass' when it should find a contradiction → the detection is broken. STOP and report the full LLM exchange.
- Do not proceed to Phase E until Gate D1 passes.
