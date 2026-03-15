# Kiuli Foundation Assessment — 2026-03-12

## Verdict: The foundation is solid. The gaps are operational, not structural.

---

## What I Audited

1. Scraper pipeline: orchestrator → image-processor → labeler → video-processor → finalizer
2. Content engine: cascade → decompose → ideation → draft → publish
3. Payload CMS: 26 collections, 6 globals, admin config, hooks, custom components
4. Frontend: all routes, data queries, rendering, SEO
5. CI/CD: GitHub Actions, Vercel auto-deploy, Lambda deploy.sh, verify.sh
6. Database: all tables, relationships, data completeness
7. Live site: kiuli.com rendering, what shows, what doesn't

---

## Foundation: SOLID

### The pipeline chain works end-to-end

```
iTrvl URL → scrape-itinerary API → Step Functions pipeline
  → orchestrator (scrape + transform + link properties/destinations/transfers/activities)
  → image-processor (S3 + imgix, sharp working)
  → labeler (GPT-4o image enrichment)
  → video-processor (HLS → MP4)
  → finalizer (hero selection, schema, segment image linking, publish checklist)
  → Payload afterChange hook → cascade (fire-and-forget)
    → entity extraction → destination resolution → property resolution
    → relationship management → ContentProject generation
    → decompose (fire-and-forget) → article candidate generation
```

Every link in this chain is implemented and has been exercised. 5 itineraries scraped, 664 media items processed, 42 cascade ContentProjects created, 186 article candidates generated, 4 articles published.

### The code builds cleanly
`npm run build` passes with zero errors. Only minor Tailwind warnings.

### Admin UI is well-architected
68 custom components, all registered in importMap, all paths resolve. Itineraries hidden from default nav, accessed via custom editor with V7 field pattern. Content engine has its own dashboard and workspace views. No broken components detected.

### CI/CD is production-ready
GitHub Actions deploys Lambdas on push to main with change detection. Vercel auto-deploys website. deploy.sh handles sharp cross-compilation correctly. verify.sh confirms deployed versions match HEAD.

### Database schema is complete
Knowledge base tables (properties, transfer_routes, activities, itinerary_patterns) exist with correct schemas including seasonalityData, regions, toDestination. All M2 Phase 2 fixes verified.

---

## Gaps: All Operational

These are not bugs or missing code. They are steps in the workflow that haven't been executed yet.

### Gap 1: Delete-and-rescrape cycle not automated

Graham described the workflow: delete sample itineraries, rescrape, iterate. Currently this requires:
1. Manual deletion of itineraries + derived data (cascade content, media, etc.)
2. Manual trigger of scrape
3. Manual verification

**What's needed:** A "clean slate" reset tool and a "scrape all samples" batch tool.

### Gap 2: Content engine cascade → draft → publish not batch-automated

19 destination_page and 21 property_page ContentProjects exist at stage='idea'. Each needs to be individually drafted and published. There's no batch operation.

**What's needed:** Batch draft and batch publish capability.

### Gap 3: Hero images not assigned to properties/destinations

Properties and destinations created by the scraper have no hero images. The cascade doesn't assign them. The content engine doesn't assign them. Someone has to manually pick them.

**What's needed:** Auto-assignment of hero images from the itinerary's scraped media.

### Gap 4: 3 of 4 published articles missing hero images

Posts 22, 23, 24 have no hero_image_id. They're invisible on the articles listing page because the frontend filters them out.

### Gap 5: Country-level destinations have no ContentProjects

The cascade skips countries (line 279 of cascade-orchestrator.ts: `if (r.entityType === 'country') continue`). Only regions get destination_page projects. Countries need content too — they're the entry pages in the hierarchy.

### Gap 6: Static page content is placeholder

- Phone numbers are fake (+44 1234 567890, +254 700 000 000)
- Only 1 author (Graham) in Authors collection — Emily and Jody missing
- Home page testimonial may be placeholder
- No /why-kiuli standalone page

### Gap 7: Frontend queries inconsistent on draft filtering

- `/safaris` uses `overrideAccess: true` without `_status: 'published'` filter — shows all drafts
- `/destinations` correctly filters to published only
- `/properties` correctly filters to published only
- `/articles` correctly filters to published only

This means safaris show up even as drafts, but nothing else does until published. Need consistent behavior.

---

## What Does NOT Need Fixing

- **Admin UI**: No leaking between default and custom Payload UI. Collections are properly hidden or shown. Custom components all work.
- **Scraper data quality**: All 21 stays have iTrvl descriptions, inclusions, property links. All 74 transfers have from/to data. Images properly linked to segments.
- **Database schema**: Complete, correct, no missing fields or broken relationships.
- **CI/CD**: Works as designed. Lambda and Vercel deployments are automated.

---

## Recommended Execution Order

### Phase A: Tooling (enables everything else)

1. **Build a "clean slate" reset tool** — deletes all itineraries, derived data (cascade content projects, media, image statuses, properties, destinations, transfer routes, activities, itinerary patterns, posts), resets to empty state. This is what Graham does before each scrape iteration.

2. **Build batch cascade+draft+publish automation** — given an itinerary ID (or "all"), runs cascade → batch draft all destination_page and property_page projects → batch publish them. With hero image auto-selection from scraped media.

3. **Build "scrape all samples" batch trigger** — takes a list of iTrvl URLs, triggers scrapes sequentially or in parallel with monitoring.

### Phase B: Content Pipeline Run (uses Phase A tools)

1. Clean slate reset
2. Scrape all 5 sample itineraries
3. Wait for pipeline completion
4. Batch cascade+draft+publish all derived content
5. Verify: all destinations have content, all properties have content, articles have hero images
6. Manual: Graham reviews article candidates, selects ones for research/draft/publish

### Phase C: Frontend (M3) — Design against populated data

With Phase B complete, every page type has real content to design against.

### Phase D: Production Launch

1. Clean slate reset (delete all sample data)
2. Scrape 75-100 real itineraries
3. Batch cascade+draft+publish
4. Graham reviews articles
5. Fix static page content (phone numbers, team bios, testimonials)
6. Launch

---

*Generated 2026-03-12*
