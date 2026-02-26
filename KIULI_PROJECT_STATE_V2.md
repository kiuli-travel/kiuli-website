# Kiuli Project State
## Master Reference — February 26, 2026

---

## Where We Are

### What is built and working

**Infrastructure**
- Next.js 15.4.10 + Payload CMS 3.76.0 deployed at kiuli.com / admin.kiuli.com
- Vercel Postgres with pgvector, AWS S3 (eu-north-1), imgix CDN
- Full DNS, HTTPS, S3 storage plugin with disableLocalStorage (phantom media fix applied)

**Scraper Pipeline**
- 5 Lambda functions (scraper, orchestrator, image-processor, labeler, finalizer) + AWS Step Functions
- Processes iTrvl portal URLs end-to-end: scrape → images → label → transform → ingest
- Read-back verification in createMediaRecord prevents phantom media IDs
- Deploy script forces linux-x64 binaries for Sharp on macOS ARM
- **5 itineraries in production database** (IDs 36–40), all in draft, all with hero images, schemas, and publish checklists complete

**Knowledge Base** (populated from the 5 itineraries)
- 21 properties, all obs_count=1, all linked to destination-type destinations
- 39 transfer routes, 9 airports, 5 activities, 5 itinerary patterns, 20 service items

**Content Engine**
- 15 phases complete: schema, vector store, OpenRouter, embeddings, cascade, ideation, dashboard, research, conversation, workspace, drafting + BrandVoice, consistency checking, publishing, image library, quality gates
- 4 articles published end-to-end (posts 22–25), live at kiuli.com
- Publishing pipeline fully verified: quality gates, consistency checking, target_record_id traceability, embeddings all working

**Inquiry Funnel**
- 9 phases complete: GCLID, HubSpot, GA4, Google Ads, sessions, modals, multi-slide qualification form

---

## What Needs To Be Done

The work ahead falls into five phases, each described below. They must be executed in this sequence — each phase either unlocks or informs the next.

---

## Phase A: Admin UI — Itinerary Review Interface

**Why this comes first:** We have 5 itineraries in draft. Before publishing them, the review interface must be fit for purpose. The current Payload admin itinerary page is a single enormous form with every field exposed at once — hundreds of fields across days, segments, images, and metadata. Working in it is slow and error-prone. Publishing 5 itineraries through it as it stands would be painful. Publishing 75–100 in the production run would be unworkable.

This phase replaces the default Payload itinerary admin view with a purpose-built editorial interface, then uses that interface to review and publish the 5 current drafts.

### Stage A1: Evaluation and Design

**What happens:** Claude.ai and Graham evaluate the current itinerary review page and design the ideal replacement together.

**Inputs needed from Graham before starting:**
- Screenshot or screen recording of the current itinerary admin page (admin.kiuli.com → Itineraries → any record)
- A clear description of the workflow: what does a designer actually need to do to review, enhance, and publish one itinerary?

**What the evaluation covers:**
- Current page structure: what fields exist, how they are organised, what is overwhelming
- What the designer actually needs: the minimum viable workflow to review scraped content, enhance copy, approve or edit each segment, check images, and publish
- What the ideal interface looks like: a focused, day-by-day editorial flow with clear status indicators, inline AI enhancement, and a publish checklist that makes completion obvious

**Output:** An agreed specification document for the new interface, covering layout, components, and interactions. This specification is the input to Stage A2.

**Principle:** Design the interface around the designer's task, not around the database schema. The schema serves the interface, not the other way around.

### Stage A2: Build with v0 and Deploy

**What happens:** The agreed specification is translated into prompts for v0.dev, which generates the React components. Claude CLI integrates them as Payload admin components, regenerates the import map, and deploys.

**Components to build (as defined by the Stage A1 spec — the list below is a starting point):**

*Itinerary Overview Panel*
- Hero image with swap control
- Title (iTrvl original → enhanced → reviewed)
- Key metadata: dates, duration, destinations, investment level
- Publish checklist with visual status (all items must be green before publish)
- One-click publish button

*Day-by-Day Segment Editor*
- Collapsible day cards with day title editing
- Per-segment edit panels showing: type badge, original text, enhanced text, reviewed toggle
- AI Enhance button inline (calls BrandVoice with segment context)
- Image strip per segment with add/remove controls
- Transfer segments shown as compact route cards (not full edit panels)
- Service/activity segments with inclusions editor

*Investment Level Panel*
- Price tier selector
- Includes/excludes editor (RichText)
- Investment callout text (enhanced and reviewed fields)

*FAQ Editor*
- List of Q&A pairs from scraped data
- Add, edit, remove controls
- Enhanced field per answer

*Metadata Panel*
- SEO title, meta description, canonical URL
- Open Graph image selector
- Schema status indicator

**v0 workflow:**
1. Write a detailed component specification prompt (Claude.ai produces this from the Stage A1 design doc)
2. Generate components in v0.dev
3. Review output with Graham before any integration
4. CLI integrates: copies components to `src/components/admin/`, updates Payload collection admin.components references, regenerates import map, runs build
5. Deploy to Vercel
6. Review in admin.kiuli.com and iterate if needed

**Definition of done:** A travel designer can open any of the 5 draft itineraries and complete a review workflow without referring to the default Payload field list.

### Stage A3: Review, Enhance, and Publish the 5 Drafts

**What happens:** Using the new interface, Graham reviews and publishes all 5 itineraries.

**For each itinerary:**
1. Open in the new editorial interface
2. Review hero image — accept or swap
3. Review and enhance title
4. Work through each day — review segment descriptions, trigger AI enhancement where needed, approve
5. Review inclusions and investment callout
6. Review FAQ
7. Complete all metadata fields
8. Confirm publish checklist is fully green
9. Publish

**Also during this stage:** Debug any issues with the new interface. If a component is not working correctly, fix it before continuing to the next itinerary. This stage is where the interface is proven in real use.

**Output:** 5 published itineraries live on kiuli.com, new admin interface debugged and stable.

---

## Phase B: Schema Evolution (M2)

**Status:** Currently blocked on KIULI_AGENTIC_VISION.md

The current schema was built to scrape and display itineraries. It does not support the full agentic vision: WebMCP tool surface, ResConnect availability, Wetu property content, flight APIs, or the AI-native itinerary builder.

Implementing the agentic vision after 100 itineraries are scraped into the current schema means a painful migration. Implementing it before means all content lands in the right shape from the start.

**This phase cannot begin until the KIULI_AGENTIC_VISION.md document is added to project knowledge.** Graham must extract it from conversation `ee9fbefe-a679-4875-a760-972039f84e7f` and upload it.

**What this phase covers:**

*Sub-phase B1: Schema Design*
- Map every collection, field, and relationship needed for launch and for the agentic future
- Design the evolved schema — what changes to existing collections (Itineraries, Properties, Destinations, Media), what new collections are needed
- Produce a migration plan that adds fields without breaking what exists
- Principle: add everything now, populate what we can at launch, leave future-only fields empty but structurally present

*Sub-phase B2: Scraper Upgrade*
- Upgrade the Lambda pipeline to populate the evolved schema
- Richer property data extraction (room types, amenities, descriptions)
- Destination enrichment
- FAQ generation improvement (property name fallback chain already specified in `content-engine/prompts/scraper-audit-and-upgrade.md`)
- Auth header fix: Bearer → users API-Key throughout
- Deploy updated Lambdas and run one test scrape

*Sub-phase B3: Content Engine Alignment*
- Assess whether schema changes affect ContentProjects, the cascade, ideation, or publishing pipelines
- Fix anything that breaks

---

## Phase C: Frontend Development (M3)

**Goal:** All customer-facing pages to Awwwards/Webby standard.

**Approach:** v0.dev for component generation, Claude CLI for integration, Vercel for deployment. Comprehensive design specifications written before any v0 prompts are sent.

**What this phase must deliver:**

### Global Components (can start immediately)
- Header — navigation, inquiry CTA, mobile responsive
- Footer — links, legal, contact
- Design tokens and typography system deployed as Tailwind config

### Article Pages (can start immediately — 4 published articles available as test content)
- `/articles/[slug]` — Article detail page: rich text body, hero image, FAQ section with FAQPage schema, related articles
- `/articles/` — Article listing page: browseable catalog, category filters

### Itinerary Pages (requires Phase B complete + at least 2–3 re-scraped itineraries)
- `/itineraries/[slug]` — Itinerary detail page: this is the primary commercial page, the one that must convert HNWI prospects. Day-by-day journey narrative, property spotlights, image galleries, investment level section (appears after value is established), inquiry CTA
- `/itineraries/` — Itinerary listing / browse page

### Supporting Pages
- `/destinations/[slug]` — Destination feature pages
- `/properties/[slug]` — Property spotlight pages (feeds into itinerary pages)

### Marketing Pages
- `/` — Home: hero, brand statement, featured itineraries, editorial pull quotes, inquiry entry point
- `/about/` — The Kiuli story, team, philosophy
- `/why-kiuli/` — Competitive differentiation: price transparency, expertise, qualification approach
- `/contact/` — Contact options: inquiry form, designer profiles, phone preference
- `/how-it-works/` — The qualification process made transparent and reassuring

**Design constraints for all pages:**
- Understated luxury aesthetic: clean, matte, editorial
- Not safari clichés — no generic sunset silhouettes, zebra stripes, or stock photography
- Magazine quality whitespace and typography
- General Sans + Satoshi + Waterfall type system
- Brand palette: Kiuli Teal (#486A6A), Kiuli Clay (#DA7A5A), Kiuli Charcoal (#404040), Kiuli Ivory (#F5F3EB)
- LCP < 2.5s, CLS < 0.1 — non-negotiable for luxury premium experience
- Every page: structured data, meta description, canonical URL, Open Graph image

**Workflow for each page:**
1. Claude.ai writes a detailed component specification (layout, interactions, content strategy, schema)
2. Specification reviewed and approved by Graham
3. v0.dev generates components from the specification prompt
4. CLI integrates and deploys
5. Review, iterate, approve

---

## Phase D: Admin UI — Content Engine and Operations (M4)

**Goal:** Integrated admin interface covering the full operational workflow: scrape → review → enhance → publish, plus content engine management.

Note: The itinerary editorial interface is built in Phase A. This phase covers the rest of the admin — the operational and content surfaces that support ongoing production.

**What this phase covers:**

*Scraper Dashboard*
- Job submission: paste iTrvl URLs, trigger scrape
- Step Functions execution status with live progress
- Image processing progress per job
- Error tracking and retry controls
- Batch import interface for multiple URLs

*Content Engine Workspace Polish*
- Content dashboard (already built — assess whether v0 polish is needed)
- Project workspace (already built — assess whether v0 polish is needed)
- Image library browser with filtering by country, property, image type
- BrandVoice management interface

*Source Monitor Controls*
- Geographic filter configuration (Africa-specific content only — must be added before next run)
- Source management: add/remove RSS feeds and research sources

*Unified Navigation*
- Single admin sidebar covering: Itineraries, Content Engine, Image Library, Inquiries, Settings
- Contextual actions that guide the workflow (scrape → edit → enhance → publish)
- System health overview

---

## Phase E: Integration Test, Production Run, and Launch (M5–M7)

### M5: Integration Test Cycle

**Goal:** Prove the complete system works end-to-end with the evolved schema, upgraded scraper, and new frontend.

**Scope:**
1. Delete ALL test data: itineraries, content projects, posts, properties, destinations, embeddings, jobs. **Do NOT delete:** Media collection, S3 images, imgix assets, BrandVoice global, ContentSystemSettings global, editorial directives
2. Scrape 6 test itineraries through the upgraded scraper (evolved schema)
3. Verify scraper populates evolved schema correctly
4. Run itinerary cascade (entity extraction, destination/property enrichment)
5. Process content projects through content engine (ideation → brief → research → draft → review → publish)
6. Verify published content renders correctly on frontend
7. Verify source monitor operates correctly with geographic filter
8. Verify quality gates and consistency checking
9. Verify image library (media from new scrape)
10. Test inquiry funnel on live pages
11. Performance check (LCP < 2.5s, CLS < 0.1)

If issues found: fix and re-run affected tests before proceeding.

### M6: Production Content Run

**Goal:** Populate kiuli.com with all launch content.

**Scope:**
1. Delete all test data (same rules as M5)
2. Scrape 75–100 production itineraries
3. Run content engine to produce supporting articles for each itinerary cluster
4. Review and publish all itineraries through the editorial interface
5. Review and publish all articles through content engine workspace
6. Verify all structured data, sitemaps, and internal linking

### M7: Launch Preparation

- Google Search Console: verify, submit sitemap
- Google Ads: confirm conversion tracking firing correctly (GCLID → HubSpot → deal creation)
- Performance audit: final LCP/CLS/FID across all page types
- Legal pages: Privacy Policy, Terms of Service, Cookie notice
- Redirect map: handle any legacy URL structure
- Pre-launch checklist: all itineraries published, all articles published, all metadata complete, no broken links
- Go live

---

## Key Principles That Must Not Be Forgotten

- **No schema migrations after production content is scraped.** Get the schema right in Phase B before M6.
- **Source monitor needs a geographic filter before it runs again.** It currently ingests global research. Add Africa-specific filtering before the next run.
- **Luxury customers prefer phone over forms.** Every page must present the phone number prominently, not just the inquiry form.
- **Investment Level appears after value is established.** This is a conversion design principle — price is never the first thing a prospect sees.
- **Travel designers only speak to pre-qualified prospects.** The funnel must filter, not invite. Design every page with this in mind.
- **Price transparency is the primary competitive differentiator.** Only 5% of competitors show pricing upfront. Lean into it.

---

## Current Git State

Clean. All changes committed and pushed to `main`.

**Recent significant commits:**
- `fix(media): disable local storage + add read-back verification` — prevents phantom media IDs on Vercel
- `fix(deploy): force linux-x64 platform in npm ci for Lambda compatibility`
- `fix(orchestrator): resolveLocationToDestination uses ?draft=true` — prevents country fallback on new destinations

---

*Last updated: February 26, 2026*
*Status: 5 itineraries in production database, pipeline clean, ready for Phase A.*
