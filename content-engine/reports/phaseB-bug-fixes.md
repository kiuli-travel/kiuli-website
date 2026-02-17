# Phase B: Bug Fixes, Ghost Resets, and Re-Drafts — Report

**Date:** 2026-02-17T15:10Z
**Executed by:** Claude CLI

## Task 1: BUG-1 Fix

### 1a: batch/route.ts

Changed the `advance` action block to reset processing state on stage advance:

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

### 1b: handler.ts

Changed the `stage_change` case in `processProjectActions` to reset processing state:

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

### Verification 1

batch/route.ts lines 72-81:

```
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

handler.ts lines 534-544:

```
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

## Task 2: BUG-2 Fix

### 2a: Raw logging added

Line 213:

```typescript
  console.log(`[article-drafter] Raw LLM response (${text.length} chars):`, text.substring(0, 500))
```

### 2b: Strict validation

Full `parseArticleOutput` function after edit (lines 205-259):

```typescript
function parseArticleOutput(raw: string): ArticleDraftOutput {
  let text = raw.trim()

  // Strip markdown fences
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }

  console.log(`[article-drafter] Raw LLM response (${text.length} chars):`, text.substring(0, 500))

  const parsed = JSON.parse(text)

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
}
```

### Verification 2

Read back of lines 205-259 confirmed all changes present (see above).

### Gate 1: PASS

---

## Task 3: Build

```
$ npm run build 2>&1 | tail -40

├ ○ /properties/[slug]                                                  136 B         122 kB
├ ○ /safaris                                                            808 B         111 kB         10m      1y
├ ƒ /safaris-sitemap.xml                                                216 B         102 kB
├ ● /safaris/[slug]                                                   8.85 kB         126 kB         10m      1y
├   ├ /safaris/a-luxury-kenyan-honeymoon-bush-beach                                                  10m      1y
├   ├ /safaris/wild-romance-an-epic-honeymoon-across-southern-africa                                 10m      1y
├   ├ /safaris/a-unique-ugandan-adventure                                                            10m      1y
├   └ [+4 more paths]
└ ƒ /search                                                           6.75 kB         123 kB
+ First Load JS shared by all                                          101 kB
  ├ chunks/4bd1b696-cc729d47eba2cee4.js                               54.1 kB
  ├ chunks/5964-b14196516283122f.js                                     44 kB
  └ other shared chunks (total)                                       3.28 kB


ƒ Middleware                                                          33.1 kB

○  (Static)   prerendered as static content
●  (SSG)      prerendered as static HTML (uses generateStaticParams)
ƒ  (Dynamic)  server-rendered on demand


> with-vercel-website@1.0.0 postbuild
> next-sitemap --config next-sitemap.config.cjs

✨ [next-sitemap] Loading next-sitemap config: file:///Users/grahamwallington/Projects/kiuli-website/next-sitemap.config.cjs
✅ [next-sitemap] Generation completed
┌───────────────┬────────┐
│ (index)       │ Values │
├───────────────┼────────┤
│ indexSitemaps │ 1      │
│ sitemaps      │ 0      │
└───────────────┴────────┘
-----------------------------------------------------
 SITEMAP INDICES
-----------------------------------------------------

   ○ https://kiuli.com/sitemap.xml
```

Exit code: 0

### Gate 2: PASS

---

## Task 4: Ghost Completion Reset

```
$ export DATABASE_URL_UNPOOLED="..." && npx tsx content-system/scripts/reset-ghost-completions.ts

Resetting 3 ghost completions: 79, 87, 89

BEFORE:
  ID 89: stage=draft, processing_status=completed, error=null
  ID 79: stage=draft, processing_status=completed, error=
  ID 87: stage=draft, processing_status=completed, error=

Updated 3 rows

AFTER:
  ID 89: stage=draft, processing_status=idle, error=null
  ID 79: stage=draft, processing_status=idle, error=null
  ID 87: stage=draft, processing_status=idle, error=null
```

### Gate 3: PASS

---

## Task 5: Commit and Push

```
$ git commit -m "fix: BUG-1 reset processingStatus on stage advance, BUG-2 strict draft validation"
[main f81543d] fix: BUG-1 reset processingStatus on stage advance, BUG-2 strict draft validation
 4 files changed, 92 insertions(+), 8 deletions(-)
 create mode 100644 content-system/scripts/reset-ghost-completions.ts

$ git push
To https://github.com/kiuli-travel/kiuli-website.git
   95bc99a..f81543d  main -> main

$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

### Gate 4: PASS

---

## Task 6: Re-Drafts

### Project 27

```
$ curl -s -w "\n%{http_code}" --max-time 300 -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 27}'

{"success":true}
200
```

DB verification:

```
 id | processing_status | processing_error | has_body | has_meta_title | has_meta_description | has_capsule
----+-------------------+------------------+----------+----------------+----------------------+-------------
 27 | completed         |                  | t        | t              | t                    | t
(1 row)

 faq_count
-----------
        10
(1 row)
```

### Project 53

```
$ curl -s -w "\n%{http_code}" --max-time 300 -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 53}'

{"success":true}
200
```

DB verification:

```
 id | processing_status | processing_error | has_body | has_meta_title | has_meta_description | has_capsule
----+-------------------+------------------+----------+----------------+----------------------+-------------
 53 | completed         |                  | t        | t              | t                    | t
(1 row)

 faq_count
-----------
        10
(1 row)
```

### Project 79

```
$ curl -s -w "\n%{http_code}" --max-time 300 -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 79}'

{"success":true}
200
```

DB verification:

```
 id | processing_status | processing_error | has_body | has_meta_title | has_meta_description | has_capsule
----+-------------------+------------------+----------+----------------+----------------------+-------------
 79 | completed         |                  | t        | t              | t                    | t
(1 row)

 faq_count
-----------
        10
(1 row)
```

### Project 87

```
$ curl -s -w "\n%{http_code}" --max-time 300 -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 87}'

{"success":true}
200
```

DB verification:

```
 id | processing_status | processing_error | has_body | has_meta_title | has_meta_description | has_capsule
----+-------------------+------------------+----------+----------------+----------------------+-------------
 87 | completed         |                  | t        | t              | t                    | t
(1 row)

 faq_count
-----------
        10
(1 row)
```

### Project 89

```
$ curl -s -w "\n%{http_code}" --max-time 300 -X POST https://kiuli.com/api/content/draft \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CONTENT_SYSTEM_SECRET" \
  -d '{"projectId": 89}'

{"success":true}
200
```

DB verification:

```
 id | processing_status | processing_error | has_body | has_meta_title | has_meta_description | has_capsule
----+-------------------+------------------+----------+----------------+----------------------+-------------
 89 | completed         |                  | t        | t              | t                    | t
(1 row)

 faq_count
-----------
         8
(1 row)
```

### Gate 5: PASS

---

## Task 7: Final State

```
 id |   content_type    | stage | processing_status | has_body | has_meta_title | has_meta_description | has_capsule
----+-------------------+-------+-------------------+----------+----------------+----------------------+-------------
 27 | itinerary_cluster | draft | completed         | t        | t              | t                    | t
 53 | itinerary_cluster | draft | completed         | t        | t              | t                    | t
 79 | authority         | draft | completed         | t        | t              | t                    | t
 87 | authority         | draft | completed         | t        | t              | t                    | t
 89 | itinerary_cluster | draft | completed         | t        | t              | t                    | t
(5 rows)
```

FAQ counts:

```
 project_id | faq_count
------------+-----------
         27 |        10
         53 |        10
         79 |        10
         87 |        10
         89 |         8
(5 rows)
```

---

## Overall: ALL GATES PASS
