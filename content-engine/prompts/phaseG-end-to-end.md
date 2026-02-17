# Phase G: End-to-End Validation

**Context:** Phases A-F complete. Every component of the Content Engine is implemented. This phase proves the system works by pushing one piece of content from idea to live on kiuli.com.

**Strategist:** Claude.ai (Graham's project)  
**Tactician:** You (Claude CLI)

---

## Rules

1. **This phase creates NOTHING new.** It only exercises existing code paths.
2. **Every step must produce database evidence.**
3. **The final gate requires a live page on kiuli.com.** If the frontend template does not exist yet, this gate will be BLOCKED (not failed) — that's expected and acceptable.
4. **Write report to `content-engine/reports/phaseG-end-to-end.md`.**

---

## The Pipeline

A content project flows through these stages:

```
idea → brief → research → draft → review → published
```

At each stage, an operation runs:
- **idea → brief**: Ideation/cascade produces the idea, brief shaper refines it
- **brief → research**: Research compiler gathers external + internal sources
- **research → draft**: Drafter generates body, meta fields, FAQ
- **draft → review**: Quality gates + consistency check
- **review → published**: Publishing pipeline writes to target collection

We will trace one project through every stage.

---

## Task 1: Select or Create the Test Project

Option A: Find an existing project at 'idea' or 'brief' stage that has enough context to draft:

```sql
SELECT id, title, content_type, stage, processing_status,
  brief_summary IS NOT NULL as has_brief,
  target_angle IS NOT NULL as has_angle
FROM content_projects
WHERE stage IN ('idea', 'brief')
  AND content_type IN ('authority', 'itinerary_cluster')
ORDER BY id DESC
LIMIT 5;
```

Pick one with `has_brief = true` and `has_angle = true`. This project has enough context for the research and draft stages.

Option B: If no suitable project exists, create one via the cascade or decompose API. Record the creation method and project ID.

Record the selected project:
```
TEST PROJECT ID: ___
TITLE: ___
CONTENT TYPE: ___
CURRENT STAGE: ___
```

---

## Task 2: Advance Through Research

If the project is at 'idea' stage, advance to 'brief' first:

```bash
curl -X POST https://kiuli.com/api/content/dashboard/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"action": "advance", "projectIds": [PROJECT_ID]}'
```

Verify status reset (BUG-1 fix):
```sql
SELECT id, stage, processing_status FROM content_projects WHERE id = PROJECT_ID;
```
Expected: `stage = 'brief'`, `processing_status = 'idle'`.

Then trigger research:

```bash
curl -X POST https://kiuli.com/api/content/research \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID}'
```

After completion, verify:
```sql
SELECT id, stage, processing_status,
  synthesis IS NOT NULL as has_synthesis,
  (SELECT COUNT(*) FROM content_projects_sources WHERE _parent_id = cp.id) as source_count
FROM content_projects cp
WHERE id = PROJECT_ID;
```

Advance to 'research' stage if needed (the research route may do this automatically, or it may need a manual advance):
```sql
SELECT stage FROM content_projects WHERE id = PROJECT_ID;
```

---

## Task 3: Advance Through Draft

Advance to 'draft' stage:
```bash
curl -X POST https://kiuli.com/api/content/dashboard/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"action": "advance", "projectIds": [PROJECT_ID]}'
```

Verify status reset:
```sql
SELECT stage, processing_status FROM content_projects WHERE id = PROJECT_ID;
```
Expected: `stage = 'draft'`, `processing_status = 'idle'`.

Trigger drafting:
```bash
curl -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID}'
```

After completion, verify ALL fields (BUG-2 fix):
```sql
SELECT id, stage, processing_status, processing_error,
  body IS NOT NULL as has_body,
  LENGTH(body::text) as body_length,
  meta_title IS NOT NULL as has_meta_title,
  meta_description IS NOT NULL as has_meta_desc,
  answer_capsule IS NOT NULL as has_capsule,
  (SELECT COUNT(*) FROM content_projects_faq_section WHERE _parent_id = cp.id) as faq_count
FROM content_projects cp
WHERE id = PROJECT_ID;
```

Expected: `processing_status = 'completed'`, all has_* = true, faq_count >= 5.

**If drafting fails:** Record the error, check Vercel function logs. STOP.

---

## Task 4: Run Quality Gates

```bash
curl -X POST https://kiuli.com/api/content/quality-gates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID}'
```

Record the full response. If there are error-severity violations, they must be resolved before publishing:
- Banned phrases: Edit them out via conversation handler or direct update
- Meta length: Fix the length
- Missing fields: Investigate why drafter didn't produce them

---

## Task 5: Run Consistency Check

```bash
curl -X POST https://kiuli.com/api/content/consistency \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID}'
```

Record the full response. Verify database:
```sql
SELECT consistency_check_result,
  (SELECT COUNT(*) FROM content_projects_consistency_issues WHERE _parent_id = cp.id) as issue_count
FROM content_projects cp
WHERE id = PROJECT_ID;
```

If hard contradictions found, resolve them:
- Update draft to fix the contradiction, OR
- Mark the issue as 'overridden' with a note explaining why

---

## Task 6: Advance to Review

```bash
curl -X POST https://kiuli.com/api/content/dashboard/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"action": "advance", "projectIds": [PROJECT_ID]}'
```

Verify:
```sql
SELECT stage, processing_status FROM content_projects WHERE id = PROJECT_ID;
```
Expected: `stage = 'review'`, `processing_status = 'idle'`.

---

## Task 7: Publish

Ensure the project has a slug:
```sql
SELECT id, slug FROM content_projects WHERE id = PROJECT_ID;
```

If slug is null, set one:
```sql
-- Only if slug is null
UPDATE content_projects SET slug = 'test-article-e2e-validation' WHERE id = PROJECT_ID AND slug IS NULL;
```

```bash
curl -X POST https://kiuli.com/api/content/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": PROJECT_ID}'
```

Record the full response.

Verify in database:
```sql
-- Content project stage
SELECT id, stage, published_at, target_collection, target_record_id, processing_status
FROM content_projects WHERE id = PROJECT_ID;

-- Target record (assuming article → posts)
SELECT id, title, slug, _status, published_at
FROM posts WHERE id = (
  SELECT target_record_id::integer FROM content_projects WHERE id = PROJECT_ID
);
```

Expected:
- Content project: `stage = 'published'`, `published_at` set, `target_collection = 'posts'`, `target_record_id` is a valid ID
- Posts record: exists, `_status = 'published'`

---

## Task 8: Verify Live Page

Check if the page is accessible on kiuli.com:

```bash
curl -s -o /dev/null -w "%{http_code}" https://kiuli.com/posts/SLUG
```

**If this returns 404:** The frontend template for posts may not be built yet. This is BLOCKED, not FAILED. Record this clearly.

If it returns 200, fetch the page and verify:
- Title is present in the HTML
- Meta description is present
- Structured data (JSON-LD) is present (if the template includes it)

---

## Gate G1: End-to-End Pipeline

```
PASS criteria (all required):
1. Project advanced from idea/brief through research → draft → review → published
2. At every stage advance, processing_status was reset to 'idle' (BUG-1 proof)
3. Drafter produced all required fields: body, metaTitle, metaDescription, answerCapsule, ≥5 FAQ items (BUG-2 proof)
4. Quality gates were run and passed (or violations were fixed)
5. Consistency check was run (result recorded)
6. Publish succeeded: content_projects.stage = 'published', target record exists in Posts collection

BLOCKED (acceptable):
7. Live page on kiuli.com — if frontend template doesn't exist yet, record as BLOCKED

FAILED (unacceptable):
- Any step errors out with an unexpected failure
- Drafter produces incomplete output after BUG-2 fix
- Publish is blocked by a gate that should have passed
- Processing status is not reset after advance
```

---

## Report Format

Write to `content-engine/reports/phaseG-end-to-end.md`:

```markdown
# Phase G: End-to-End Validation — Report

**Date:** [timestamp]
**Executed by:** Claude CLI

## Test Project
- **ID:** [id]
- **Title:** [title]
- **Content Type:** [type]
- **Starting Stage:** [stage]

## Stage Progression

### idea → brief
- Advance response: [response]
- DB after: stage=[stage], processing_status=[status]

### brief → research
- Research trigger response: [response]
- DB after: has_synthesis=[bool], source_count=[n]

### research → draft
- Advance response: [response]
- DB after: stage=draft, processing_status=idle ← BUG-1 PROOF

### Draft Execution
- Draft trigger response: [response]
- DB after: has_body=[bool], has_meta_title=[bool], has_meta_desc=[bool], has_capsule=[bool], faq_count=[n] ← BUG-2 PROOF

### Quality Gates
- Response: [full JSON]
- Passed: [yes/no]
- Violations fixed: [list, if any]

### Consistency Check
- Response: [full JSON]
- Result: [pass/soft/hard]
- Issues resolved: [list, if any]

### draft → review
- Advance response: [response]
- DB after: stage=review, processing_status=idle

### Publish
- Response: [full JSON]
- DB content_projects after: stage=[stage], published_at=[date], target_record_id=[id]
- DB posts after: id=[id], title=[title], _status=[status]

### Live Page Check
- URL: [url]
- HTTP Status: [code]
- Status: [PASS / BLOCKED — frontend template not built]

## Gate G1: [PASS / BLOCKED AT LIVE PAGE]

## Summary
The Content Engine pipeline has been validated end-to-end. Content flows from [starting stage] through all stages to publication in the Posts collection.

[If blocked: "The live page check is blocked because the frontend /posts/[slug] template has not been built yet. This is expected — frontend development is a separate workstream."]
```

---

## STOP CONDITIONS

- If any stage advance fails → STOP, the batch route may be broken
- If research fails → check PERPLEXITY_API_KEY or OPENROUTER_API_KEY. STOP.
- If drafting fails → check OpenRouter. STOP.
- If quality gates or consistency check error out → a previous phase's implementation is broken. STOP and identify which phase.
- If publish fails with a Payload validation error → the field mapping in the publisher is wrong. STOP.
