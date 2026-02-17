# Phase A: Clean and Verify — Report

**Date:** 2026-02-17T14:58Z
**Executed by:** Claude CLI

## Task 1: Git Cleanup

### 1.1 .gitignore additions

Appended to `.gitignore`:

```
# Runtime logs
tools/mcp-server/server.log
tools/mcp-server/server-error.log
tools/mcp-filesystem-server/

# Build cache
tsconfig.tsbuildinfo

# Env check file (contains secrets)
.env.vercel-check
```

### 1.2 Untracked artifacts

```
$ git rm --cached tools/mcp-server/server.log
rm 'tools/mcp-server/server.log'

$ git rm --cached tools/mcp-server/server-error.log
rm 'tools/mcp-server/server-error.log'

$ git rm --cached tsconfig.tsbuildinfo
rm 'tsconfig.tsbuildinfo'
```

Note: `server-error.log` was also tracked, so all three files were untracked.

### 1.3 Staged files

```
git add content-engine/prompts/phase2.5-bootstrap-embeddings.md
git add content-engine/reports/phase1-db-reconciliation.md
git add content-engine/reports/phase4-embeddings-engine.md
git add src/payload-types.ts
git add content-engine/evidence/
git add content-engine/prompts/fix-auth-bypass.md
git add content-engine/prompts/phase11-execute-and-verify.md
git add content-engine/prompts/phase11-gap-closure.md
git add content-engine/prompts/phase11-mechanism-verification.md
git add content-engine/prompts/phase4-verify-all-types.md
git add content-engine/prompts/phase8-research-source-monitor.md
git add content-engine/prompts/phaseA-clean-and-verify.md
git add .gitignore
```

### 1.4 Commit

Initial push was blocked by GitHub push protection — `content-engine/prompts/phase8-research-source-monitor.md` line 19 contained a Perplexity API key in cleartext. Key was redacted to `[REDACTED — set in Vercel dashboard]`, commit amended.

```
$ git commit (amended)
[main d09a8b7] chore: clean git state — commit evidence/prompts/reports, untrack runtime artifacts
 23 files changed, 3556 insertions(+), 474 deletions(-)

$ git push
To https://github.com/kiuli-travel/kiuli-website.git
   05e3684..d09a8b7  main -> main
```

### 1.5 Final git status

```
$ git status
On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

### Gate 1: PASS

---

## Task 2: Database Audit

### 2a: Projects by stage

```
  stage   | count
----------+-------
 brief    |    30
 idea     |    20
 draft    |     5
 research |     3
 rejected |     1
(5 rows)
```

### 2b: Draft/review/published detail

```
 id |   content_type    | stage | processing_status | has_body | has_sections | has_meta_title | has_capsule
----+-------------------+-------+-------------------+----------+--------------+----------------+-------------
 27 | itinerary_cluster | draft | completed         | t        | f            | t              | f
 53 | itinerary_cluster | draft | failed            | f        | f            | f              | f
 79 | authority         | draft | completed         | f        | f            | f              | f
 87 | authority         | draft | completed         | f        | f            | f              | f
 89 | itinerary_cluster | draft | completed         | f        | f            | f              | f
(5 rows)
```

### 2c: Ghost completions

```
 id |   content_type    |                                                title                                                 | stage | processing_status | has_body | has_sections | has_real_sections
----+-------------------+------------------------------------------------------------------------------------------------------+-------+-------------------+----------+--------------+-------------------
 89 | itinerary_cluster | The Science of Gorilla Family Dynamics: Understanding Social Structures Before Your Trek             | draft | completed         | f        | f            | f
 79 | authority         | The Kazinga Channel Phenomenon: Understanding Africa's Highest Hippo Density from Your Private Lodge | draft | completed         | f        | f            | f
 87 | authority         | Uganda's Primate Diversity Hotspot: Why Kibale Forest Hosts 13 Species in One Ecosystem              | draft | completed         | f        | f            | f
(3 rows)
```

### 2d: Content jobs health

```
    job_type    |  status   | count
----------------+-----------+-------
 cascade        | completed |     4
 cascade        | failed    |     5
 decompose      | completed |     8
 source_monitor | completed |     3
(4 rows)
```

### 2e: Embedding store health

```
     chunk_type      | chunks | with_embedding
---------------------+--------+----------------
 itinerary_segment   |     65 |             65
 article_section     |     39 |             39
 property_section    |     33 |             33
 destination_section |      1 |              1
 faq_answer          |     44 |             44
(5 rows)
```

### 2f: BrandVoice populated

```
 has_summary | has_audience |        updated_at
-------------+--------------+---------------------------
 t           | t            | 2026-02-16 20:45:38.75+00
(1 row)
```

### 2g: Banned phrases count

```
 count
-------
    11
(1 row)
```

### 2h: Source registry entries

```
 id |             name             | category | active |      last_checked_at
----+------------------------------+----------+--------+----------------------------
  1 | bioRxiv Conservation Biology | science  | t      | 2026-02-17 06:00:52.528+00
(1 row)
```

### 2i: FAQ items per project

```
 _parent_id | faq_count
------------+-----------
         27 |         1
(1 row)
```

### 2j: Itinerary state

```
 total | published
-------+-----------
     7 |         0
(1 row)
```

### Gate 2: PASS

---

## Task 3: API Route Smoke Test

| Route | Status Code |
|---|---|
| test-connection | 405 |
| dashboard | 401 |
| dashboard/batch | 401 |
| draft | 401 |
| cascade | 401 |
| research | 401 |
| conversation | 401 |
| embed | 401 |
| decompose | 401 |
| source-monitor | 401 |
| jobs | 401 |

Zero 404 responses. All routes are reachable.

### Gate 3: PASS

---

## Task 4: Ghost Completions

3 ghost completions found from query 2c:

### Project 79

- **Title:** The Kazinga Channel Phenomenon: Understanding Africa's Highest Hippo Density from Your Private Lodge
- **Content type:** authority
- **Stage:** draft
- **Message count:** 2
- **FAQ count:** 0

```sql
-- PENDING GRAHAM APPROVAL — do not execute
UPDATE content_projects
SET processing_status = 'idle', processing_error = NULL, processing_started_at = NULL
WHERE id = 79;
```

### Project 87

- **Title:** Uganda's Primate Diversity Hotspot: Why Kibale Forest Hosts 13 Species in One Ecosystem
- **Content type:** authority
- **Stage:** draft
- **Message count:** 0
- **FAQ count:** 0

```sql
-- PENDING GRAHAM APPROVAL — do not execute
UPDATE content_projects
SET processing_status = 'idle', processing_error = NULL, processing_started_at = NULL
WHERE id = 87;
```

### Project 89

- **Title:** The Science of Gorilla Family Dynamics: Understanding Social Structures Before Your Trek
- **Content type:** itinerary_cluster
- **Stage:** draft
- **Message count:** 4
- **FAQ count:** 0

```sql
-- PENDING GRAHAM APPROVAL — do not execute
UPDATE content_projects
SET processing_status = 'idle', processing_error = NULL, processing_started_at = NULL
WHERE id = 89;
```

### Gate 4: PASS

---

## Task 5: Build

```
$ npm run build 2>&1 | tail -80

├ ƒ /api/content/jobs                                                   216 B         102 kB
├ ƒ /api/content/research                                               216 B         102 kB
├ ƒ /api/content/source-monitor                                         216 B         102 kB
├ ƒ /api/content/test-connection                                        216 B         102 kB
├ ƒ /api/enhance                                                        216 B         102 kB
├ ƒ /api/graphql                                                        216 B         102 kB
├ ƒ /api/graphql-playground                                             176 B         102 kB
├ ƒ /api/inquiry                                                        216 B         102 kB
├ ƒ /api/job-control/[jobId]                                            216 B         102 kB
├ ƒ /api/job-status/[jobId]                                             216 B         102 kB
├ ƒ /api/notifications                                                  216 B         102 kB
├ ƒ /api/resolve-image                                                  216 B         102 kB
├ ƒ /api/scrape-itinerary                                               216 B         102 kB
├ ƒ /api/scraper-health                                                 216 B         102 kB
├ ƒ /api/seed-homepage                                                  216 B         102 kB
├ ƒ /api/session-init                                                   216 B         102 kB
├ ○ /apple-icon.png                                                       0 B            0 B
├ ○ /articles                                                           808 B         111 kB         10m      1y
├ ƒ /articles-sitemap.xml                                               216 B         102 kB
├ ○ /articles/[slug]                                                    136 B         122 kB
├ ƒ /authors-sitemap.xml                                                216 B         102 kB
├ ● /authors/[slug]                                                   3.96 kB         121 kB         10m      1y
├   └ /authors/graham-wallington                                                                     10m      1y
├ ○ /contact                                                          1.48 kB         120 kB
├ ○ /destinations                                                       808 B         111 kB         10m      1y
├ ƒ /destinations-sitemap.xml                                           216 B         102 kB
├ ● /destinations/[...slug]                                            4.6 kB         121 kB         10m      1y
├   └ /destinations/rwanda                                                                           10m      1y
├ ○ /icon0.svg                                                            0 B            0 B
├ ○ /icon1.png                                                            0 B            0 B
├ ○ /manifest.json                                                        0 B            0 B
├ ƒ /next/exit-preview                                                  216 B         102 kB
├ ƒ /next/preview                                                       216 B         102 kB
├ ƒ /pages-sitemap.xml                                                  216 B         102 kB
├ ○ /posts                                                              326 B         124 kB         10m      1y
├ ƒ /posts-sitemap.xml                                                  216 B         102 kB
├ ● /posts/[slug]                                                     5.16 kB         122 kB
├ ● /posts/page/[pageNumber]                                            327 B         124 kB
├ ○ /properties                                                         808 B         111 kB         10m      1y
├ ƒ /properties-sitemap.xml                                             216 B         102 kB
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

### Gate 5: PASS

---

## Overall: ALL GATES PASS
