# KIULI LAUNCH ROADMAP

**Version:** 2.0
**Date:** February 23, 2026
**Purpose:** Master plan from current state to kiuli.com launch and beyond. Each milestone is a self-contained sub-project executable in a dedicated Claude conversation.

---

## Current State Summary

**What works:**
- Next.js 15.4.10 + Payload CMS 3.76.0 deployed at kiuli.com / admin.kiuli.com
- AWS scraper pipeline: 5 Lambda functions + Step Functions orchestration, 7 test itineraries processed, 650 images, zero failures
- Content Engine: 15 phases complete (schema, vector store, OpenRouter, embeddings, cascade, ideation, dashboard, research, conversation, workspace, drafting+BrandVoice, consistency checking, publishing, image library, quality gates)
- Inquiry funnel: 9 phases complete (GCLID, HubSpot, GA4, Google Ads, sessions, modals)
- **4 articles published end-to-end** (projects 79, 27, 53, 87 → posts 22–25), all live at kiuli.com
- Publishing pipeline fully verified: quality gates, consistency checking, target_record_id traceability, embeddings all working
- Vector DB clean: 60 embeddings for the 4 published articles only
- **Knowledge base collections live:** Properties, TransferRoutes, Activities, ItineraryPatterns, availability_cache — all populated by the scraper from every itinerary scraped
- **M2 Phase 1 complete:** Schema evolved, scraper upgraded, knowledge base accumulation validated end-to-end with test scrape
- Git: clean, all committed and pushed

**What doesn't work / is not done:**
- Frontend pages use placeholder/template designs — no v0 polish
- Admin UI is default Payload — no integrated scraper/content/image workflow
- Scraper has known gaps to fix before production run (see M2 Phase 2)
- Source monitor needs geographic filter before next run (currently ingests global conservation research, not Africa-specific)
- Wetu, ResConnect, flight API integrations not started (Phase 2–4 of agentic vision)
- WebMCP `plan_safari()` tool not built (Phase 5 of agentic vision)

---

## The Sequence

```
Launch Path:
M1 ✅ → M2 (Phase 2 remaining) → M3 → M4 → M5 → M6 → M7 LAUNCH

Post-Launch Agentic Path:
M8 (Wetu) → M9 (ResConnect) → M10 (Flights) → M11 (WebMCP) → M12 (Speech Agent)
```

**Principle on sequencing:** The knowledge base accumulates from every itinerary scraped through M5 and M6. By the time M8 (Wetu) integration goes live, the knowledge base will have patterns from 75–100 itineraries. The agentic intelligence compounds before the APIs even connect. This is by design.

---

## M1: Pipeline Validation ✅ COMPLETE

**Completed:** February 22, 2026

**What was done:**
1. Ghost completion bug fixed — `processingStatus` now resets to `idle` on stage advance
2. Quality gates migration applied to production DB (migration `20260222_143340.ts`, batch 34)
3. Batch route Bearer token auth added
4. Publish route fixed to write `targetRecordId` and `targetCollection` back to `content_projects`
5. Projects 27, 53, 87 published (joining pre-existing project 79) — 4 articles total, all HTTP 200
6. Project 87 false-positive hard contradictions resolved (Kibale vs Nyungwe geographic context)
7. Vector DB stubs purged — 60 embeddings remain for published articles only
8. Off-topic content project 141 (Amazon deforestation article from bioRxiv) deleted
9. Git clean: all committed and pushed

**Outputs:** 4 published content projects, confirmed working pipeline, all bugs fixed, clean state

---

## M2: Schema Evolution & Scraper Upgrade (Knowledge Base Foundation)

**Goal:** Evolve the database schema and scraper to support both launch requirements and the future WebMCP agentic itinerary builder. Every itinerary scraped after M2 populates a knowledge base that compounds in intelligence across the production run.

**Why this order:** The schema must be correct before scraping 75–100 production itineraries. Retrofitting schema changes after a production run requires migrating all that data or re-scraping everything.

**Reference:** KIULI_AGENTIC_VISION.md — the north star document for all M2+ decisions.

---

### M2 Phase 1: Schema Evolution & Knowledge Base Foundation ✅ COMPLETE

**Completed:** ~February 23, 2026

**What was done:**

**Schema changes (all additive — zero breaking changes):**
- Properties collection evolved with full agentic vision schema: `externalIds` group (itrvlSupplierCode, itrvlPropertyName, resRequestPropertyId, resRequestPrincipalId, resRequestAccommTypes, wetuContentEntityId), `canonicalContent` group (coordinates, contactEmail, contactPhone), `availability` group (source, defaultValue: 'none'), `accumulatedData` group (pricePositioning.observations via `prop_price_obs` table, pricePositioning.observationCount, commonPairings), `roomTypes` array
- TransferRoutes collection created: from/to text, fromDestination/toDestination relationships, fromProperty/toProperty relationships, mode select, typicalDurationMinutes, distanceKm, airlines array (name, go7Airline, duffelAirline), fromCoordinates/toCoordinates groups, observations array (itineraryId, departureTime, arrivalTime, airline, dateObserved), observationCount, wetuRouteId
- Activities collection created: name, slug, type select (20 values), destinations/properties relationships, description, typicalDuration, bestTimeOfDay, suitability, minimumAge, fitnessLevel, wetuContentEntityId, observationCount, observedInItineraries relationship
- ItineraryPatterns collection created: sourceItinerary (unique), extractedAt, countries relationships, totalNights, paxType, adults, children, propertySequence array, transferSequence array, priceTotal, currency, pricePerNightAvg, priceTier, travelMonth, travelYear
- availability_cache direct SQL table created (high-frequency, low-durability data — not a Payload collection)

**Scraper changes (transform.js + orchestrator/handler.js):**
- `linkProperties()` — creates or finds Property records per stay segment. Captures `supplierCode` → `externalIds.itrvlSupplierCode`. Captures `notes.contactEmail` and `notes.contactNumber` → `canonicalContent`. Slug-based dedup with PropertyNameMappings alias fallback. Backfills supplierCode on existing records.
- `linkTransferRoutes()` — creates or finds TransferRoute records per flight/road/boat segment. Captures airline name, departure/arrival times. Slug-based dedup. Returns pendingTransferObs for handler to write after itineraryId is known.
- `linkActivities()` — creates or finds Activity records per service/activity segment. Links to current property and destination. Returns pendingActivityObs for handler to write after itineraryId is known.
- Knowledge base writes in handler.js: TransferRoute observations (deduped by itineraryId), Activity observations (deduped by itineraryId via observedInItineraries), Property accumulatedData (pricePositioning observations, commonPairings with before/after position tracking), ItineraryPattern upsert (handles re-scrape without doubling).
- Bidirectional property-itinerary linking (properties.relatedItineraries updated after itinerary is saved).

**Validated with test scrape:**
- 1 itinerary scraped, SUCCEEDED in Step Functions
- 4 properties created (Legendary Lodge LEG007, Little Chem Chem CHE019, Nyasi Tented Camp NYA006, Mwiba Lodge MWI002)
- 6 transfer routes created
- 7 activities created
- 1 itinerary pattern created
- CloudWatch signatures confirmed: TransferRoute obs, Activity obs, accumulatedData, ItineraryPattern
- All dedup logic verified: re-scraping the same itinerary does not double-count any knowledge base writes

---

### M2 Phase 2: Scraper Fixes — Required Before Production Run

**Status: COMPLETE — verified 2026-03-12**

**Goal:** Fix the known gaps in the scraper before scraping 75–100 production itineraries. Each gap would pollute the knowledge base at scale if left unfixed.

**Sub-task 1: Activity noise filter**

**Problem:** The scraper creates Activity records for logistics items that are not activities: airport assist services ("Meet and Assist — Kilimanjaro Airport"), VIP lounges, park fees, camping fees, conservation fees. These exist in the DB as type='other'. At scale (75–100 itineraries), the Activities collection will be filled with hundreds of noise records that degrade the builder's pattern matching.

**Fix:** Add a pre-filter in `linkActivities()` before creating any Activity record. Rules:
- If `classifyActivity()` returns `'other'` AND the name matches known noise patterns (airport|assist|vip lounge|park fee|camping fee|conservation fee|departure|arrival tax), skip it — do not create an Activity record.
- If `classifyActivity()` returns `'other'` but the name doesn't match noise patterns, still create the record — it may be a genuine activity we haven't classified yet.
- Add the filter as a `isActivityNoise(name)` function in `transform.js` alongside `classifyActivity()`.

**Verification:** Scrape 1 itinerary after the fix. Confirm the Activities collection contains only genuine safari experiences, not logistics items.

**Sub-task 2: observationCount: 2 bug**

**Problem:** When an Activity is created, the POST body sets `observationCount: 1`. Then `handler.js` increments it by 1 via `(activity.observationCount || 0) + 1`. Result: after 1 scrape, observationCount is 2 for all newly created activities.

**Fix:** Set `observationCount: 0` in the Activity POST body in `linkActivities()`. The handler's first increment will bring it to 1. Existing records with inflated counts can be corrected via a one-time SQL update after the fix is deployed.

**Verification:** After fix, scrape 1 itinerary. Confirm all newly created activities show observationCount: 1.

**Sub-task 3: toDestination not populated on TransferRoutes**

**Problem:** `linkTransferRoutes()` populates `fromDestination` but not `toDestination`. The vision schema requires both for the builder to understand which destination each route connects to.

**Fix:** In `linkTransferRoutes()`, after resolving `fromDestinationId` from `segment.country`, also look ahead in the segments array to find the next stay segment and resolve its country as the `toDestination`. If no next stay exists, use the segment's `toPoint` or `to` country if available in the raw data.

**Verification:** After fix, scrape 1 itinerary. Inspect TransferRoutes — confirm toDestination is populated on routes where it can be determined.

**Sub-task 4: Missing accumulatedData fields in Properties schema**

**Problem:** The Properties Payload schema has `pricePositioning` and `commonPairings` but is missing `seasonalityData` (which month the property appears in) from the agentic vision specification. This field cannot be added later without a migration.

**Fix:** Add `seasonalityData` array field to Properties collection in `src/collections/Properties.ts`:
```typescript
{
  name: 'seasonalityData',
  type: 'array',
  admin: { description: 'Monthly observation counts — how many itineraries include this property in each month' },
  fields: [
    { name: 'month', type: 'number', admin: { description: '1–12' } },
    { name: 'observationCount', type: 'number', defaultValue: 0 },
  ],
}
```
Add corresponding scraper logic in `handler.js` to increment the monthly counter using `travelMonth` from the itinerary start date.

Run `npm run payload migrate:create`, apply migration, verify with `npm run payload migrate:status`.

**Sub-task 5: availability.source naming inconsistency**

**Problem:** Properties `availability.source` has option `'direct'` but the agentic vision specifies `'manual'`. Minor but creates confusion when both documents are referenced.

**Fix:** Change the `'direct'` option to `'manual'` in `src/collections/Properties.ts`. This requires a DB migration because the enum value changes. Alternatively, add `'manual'` as an additional option alongside `'direct'`. Simpler: add `'manual'`, deprecate `'direct'` (leave it present so existing records don't break, just don't use it going forward).

**Sub-task 6: ItineraryPatterns — regions field**

**Problem:** The agentic vision schema distinguishes `countries` (Tanzania, Kenya) from `regions` (Serengeti, Masai Mara). Currently only `countries` is captured in ItineraryPatterns. The builder needs region-level matching for sub-destination pattern queries.

**Fix:** Add a `regions` relationship field to ItineraryPatterns:
```typescript
{
  name: 'regions',
  type: 'relationship',
  relationTo: 'destinations',
  hasMany: true,
  admin: { description: 'Sub-destination regions covered — Serengeti, Masai Mara, etc.' },
},
```
In the scraper, populate this by resolving each property's destination (which may be a region-level destination) and adding it to the pattern's regions array. The Destinations collection already has hierarchical data — use the property's `destination` relationship to derive the region.

**Sub-task 7: Content engine alignment assessment**

**Problem:** The content engine cascade extracts data from Itineraries. The schema changes in M2 Phase 1 were additive, but the cascade may need updating if it references properties that now have richer data.

**Fix:** Read the cascade Lambda (`lambda/content-cascade/handler.js`) and assess whether any cascade logic references Properties, TransferRoutes, Activities, or ItineraryPatterns. Identify any updates needed. If none needed, document that explicitly as verified.

**Outputs:** All 7 sub-tasks complete. One verification scrape after all fixes deployed. Knowledge base state confirmed clean. Git committed and pushed.

---

### M2 Phase 3: Production Scrape Preparation

**Status: NOT STARTED — depends on M2 Phase 2**

**Goal:** Prepare for the production scrape of 75–100 itineraries. This is not the scrape itself (that's M5) but the prerequisites.

**Sub-task 1: Delete test data**

The current DB has 1 test itinerary, 4 properties, 6 transfer routes, 7 activities (of which several are noise), 1 itinerary pattern, 651 media records. Before the production scrape, this test data should be cleared so the knowledge base starts from a clean state.

Document the SQL for this. Do not execute until immediately before M5.

**Sub-task 2: iTrvl URL inventory**

Compile the complete list of 75–100 iTrvl URLs to scrape. Verify each URL is accessible. Store in a documented location (spreadsheet or config file in the repo).

**Sub-task 3: Verify Step Functions capacity**

Confirm the Step Functions state machine and Lambda concurrency limits can handle the bulk scrape. The current state machine processes one itinerary at a time. For 75–100 itineraries, either run sequentially or verify concurrent execution doesn't cause Payload API rate limit issues.

**Outputs:** Documented URL list, clean-slate SQL script, capacity assessment.

---

## M3: Frontend Development

**Goal:** Build all customer-facing pages to Awwwards/Webby standard using v0.dev + Claude CLI integration.

**Dependencies:**
- Article pages, article listing, header, footer: can begin **now** against the 4 published test articles
- Itinerary detail, destination, property pages: require M2 Phase 2 complete (renders data from evolved schema)
- At minimum 2–3 production itineraries scraped before building itinerary pages

### Sub-project A: Global Components (can start immediately)

- Site header with navigation
- Site footer with links
- Inquiry modal integration (already built — wire into global layout)

### Sub-project B: Article Pages (can start immediately)

4 published articles available as test content right now:
- **Article detail page** (`/articles/[slug]`) — renders Posts collection content, FAQ, structured data, author
- **Articles listing page** (`/articles/`) — browseable article catalog

### Sub-project C: Itinerary Pages (requires M2 Phase 2 + sample itineraries)

- **Itinerary detail page** (`/itineraries/[slug]`) — the primary commercial page. Renders days/segments, gallery, investment level (shown after value established), structured data (Product schema + TouristTrip)
- **Itineraries listing page** (`/itineraries/`) — browseable catalog

### Sub-project D: Destination Pages (requires sample itineraries with linked destinations)

- **Destination detail page** (`/destinations/[slug]`) — rich destination content with linked itineraries and properties

### Sub-project E: Property Pages (requires sample itineraries with linked properties)

- **Property detail page** (`/properties/[slug]`) — lodge/camp page with room types, gallery, featured itineraries

### Sub-project F: Home Page

- **Home page** — editorial hero, featured itineraries, destination showcase, trust signals, inquiry CTA

### Sub-project G: Supporting Pages

- **About/Contact** — company story, designer profiles, contact
- **Legal** — privacy policy, terms

**Design requirements for all pages:**
- Kiuli brand colours (Teal #486A6A, Clay #DA7A5A, Charcoal #404040, Ivory #F5F3EB)
- General Sans + Satoshi + Waterfall typography
- Mobile-first, LCP < 2.5s
- Investment level only shown after value is established (never top-of-page)
- Editorial feel — generous whitespace, photography-forward

---

## M4: Admin UI Overhaul

**Goal:** Replace the default Payload admin with an integrated workflow that supports travel designers doing their job.

### Sub-project A: Itinerary Import Workflow

- Streamlined scrape trigger (URL input → progress tracking → result preview)
- Knowledge base review panel (what was extracted, dedup hits, new entities)

### Sub-project B: Content Enhancement Workflow

- Per-field enhancement UI for all Itrvl/Enhanced/Reviewed field pairs
- Bulk enhancement triggers
- Review status tracking

### Sub-project C: Knowledge Base Review UI

- Properties dashboard — view all properties, fill in missing data (coordinates, room types manually)
- Transfer routes review — flag routes for manual airline verification
- Activities review — confirm/dismiss noise records

### Sub-project D: Publishing Workflow

- Publish checklist view
- One-click publish with quality gate confirmation
- Itinerary status board

---

## M5: Integration Test Cycle

**Goal:** Delete all test data, scrape 6–10 representative itineraries through the full pipeline (scraper → knowledge base → content engine → publishing), and verify end-to-end quality.

**Prerequisites:** M2 Phases 2 and 3 complete, M3 frontend at least partially deployed (need pages to test on)

**Steps:**
1. Execute clean-slate SQL (documented in M2 Phase 3)
2. Scrape 6–10 diverse itineraries (mix of countries, durations, price tiers)
3. Verify knowledge base state (properties, transfer routes, activities, patterns all correct)
4. Run content engine cascade, ideation, and publishing on 3 itineraries
5. Publish to production — confirm pages render correctly
6. Run Google Rich Results Test on published itinerary pages
7. Document any issues and fix

**Outputs:** 6–10 published itineraries live on kiuli.com, Rich Results passing, pipeline verified end-to-end

---

## M6: Production Content Run

**Goal:** Scrape and publish 75–100 itineraries with full content engine processing.

**Prerequisites:** M5 complete, M3 frontend complete

**Steps:**
1. Bulk scrape all URLs from the inventory (compiled in M2 Phase 3)
2. Monitor CloudWatch for failures — fix any Lambda errors
3. Run content engine on all itineraries
4. Publish all — verify pages live
5. Generate Google sitemap
6. Submit to Google Search Console

**Note on knowledge base at this point:** After 75–100 itineraries, the knowledge base will have hundreds of property observations, pairing intelligence, price positioning data across multiple seasons, and a rich pattern library. This is the foundation Wetu and ResConnect will connect to in M8 and M9.

---

## M7: Launch Preparation

**Goal:** Everything required for kiuli.com to be publicly discoverable and converting.

### Sub-project A: SEO Foundation

- All itinerary pages have Product + TouristTrip schema
- All article pages have Article + FAQPage schema
- Google Search Console verified, sitemap submitted
- All pages pass Core Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms)
- robots.txt and canonical tags correct

### Sub-project B: Google Ads

- Three-campaign structure: brand + destination + trip type
- Enhanced Conversions for Leads wired to inquiry form (GCLID already captured)
- Conversion import to Google Ads from GA4
- Initial budget set, targeting California, New Jersey, Florida, New York
- 50 historical customers seeded as audience

### Sub-project C: Legal & Compliance

- Privacy policy live
- Cookie consent (CCPA/GDPR)
- Terms and conditions

### Sub-project D: Operational Readiness

- Emily and Jody notified of inquiry routing and workflow
- HubSpot pipeline configured for designer workflow
- Resend email notifications tested
- Monitored for 48 hours post-launch

**Launch target:** First inquiries in the system within 2 weeks of launch

---

## M8: Wetu Content Enrichment (Phase 2 of Agentic Vision)

**Goal:** Connect Wetu API to enrich Properties with canonical content — GPS coordinates, room types, images, and full property descriptions — from the authoritative industry content platform.

**Business prerequisite:** Wetu API credentials. Graham to arrange.

**Why Wetu is Phase 2:** GPS coordinates are the single most important missing field after Phase 1. Without coordinates, the builder cannot display maps, calculate transfer distances, or support the route display on itinerary pages. Wetu holds accurate coordinates for every significant safari property in Africa.

**What Wetu provides:**
- GPS coordinates for every property
- Canonical property descriptions (hotel-quality copy)
- Room type detail with images
- Activity catalogs per property
- Content completeness scores

**Sub-project A: Property Wetu ID Mapping**

For each property in the Properties collection, find the Wetu ContentEntityId. Two methods:
1. Name-based search via Wetu API (`/content/search?query=angama+mara`)
2. Cross-reference ResRequest mapping table once ResConnect is live (Phase 3)

Target: Map at least 80% of properties to Wetu IDs.

**Sub-project B: Wetu Sync Job**

Build a scheduled Lambda that:
1. Queries Properties with no `wetuContentEntityId` → name-search Wetu, write ID if found
2. Queries Properties with `wetuContentEntityId` and `canonicalContent.source !== 'wetu'` → fetch full content, populate coordinates, description, room types, images
3. Marks `canonicalContent.source = 'wetu'` and `canonicalContent.lastSynced = now()`

**Sub-project C: Coordinate Backfill**

After Wetu sync, all mapped properties have coordinates. Verify:
- TransferRoutes with `fromProperty` or `toProperty` links can derive coordinates from the property
- Map display on itinerary pages renders correctly

**Outputs:** Properties collection enriched with coordinates and canonical content. Room types populated. Map display working on itinerary pages.

---

## M9: ResConnect Live Availability (Phase 3 of Agentic Vision)

**Goal:** Connect ResConnect (ResRequest) API to enable real-time availability checking and live pricing in the itinerary builder.

**Business prerequisite:** ResConnect Partner onboarding ($175, NDA, audit). Emily and Jody's existing lodge relationships are the fast path to property-by-property agreements. Graham to initiate.

**Why ResConnect is Phase 3:** Availability and real pricing are what transform the builder from a pattern matcher into a bookable product. The knowledge base needs to be built (Phase 1), properties need coordinates (Phase 2), and then live pricing can be layered on top.

**Sub-project A: ResRequest Property ID Mapping**

For each property in the Properties collection:
1. Check if `externalIds.itrvlSupplierCode` matches a ResRequest property ID (some supplier codes are ResRequest IDs directly)
2. Map remaining properties via ResConnect partner API or manual lodge relationship confirmation
3. Populate `externalIds.resRequestPropertyId` and `externalIds.resRequestPrincipalId`

Target: Map every property that Kiuli actively sells through Wilderness.

**Sub-project B: Availability Check Integration**

Implement `ac_get_stock` API call within the itinerary builder:
```
ac_get_stock(propertyId, checkIn, checkOut, adults, children)
→ { available: boolean, unitsAvailable: number }
```

Cache results in `availability_cache` table with 60-minute TTL.

**Sub-project C: Rate Integration**

Implement `rt_get_rate_total` API call:
```
rt_get_rate_total(propertyId, roomTypeId, checkIn, checkOut, pax)
→ { rateTotal: number, ratePerNight: number, currency: string, rateType: string }
```

**Sub-project D: Coverage Report**

Every generated itinerary includes a coverage report distinguishing:
- `availabilityConfirmed` — checked via ResConnect, available
- `availabilityEstimated` — ResConnect not available for this property, pattern-based estimate
- `wetuContentAvailable` — property has Wetu canonical content
- `scraperContentOnly` — property has scraper content only

**Outputs:** Live availability checking working for all mapped properties. Itinerary builder generates drafts with real pricing.

---

## M10: Flight Integration (Phase 4 of Agentic Vision)

**Goal:** Connect Duffel and GO7/AeroCRS to add real flight availability and routing to generated itineraries.

**Tier 1 — Duffel API (major carriers):**
- Kenya Airways, Ethiopian Airlines, Safarilink (major routes)
- Standard REST API

**Tier 2 — GO7/AeroCRS (regional safari airlines):**
- Safarilink, Auric Air, Coastal Aviation, CemAir, SA Airlink, etc.
- All significant bush routes covered

**Tier 3 — Private charter (no API):**
- Wilderness Air, Federal Air, Mack Air, Grumeti Air, andBeyond Air
- Handled as manual entries in TransferRoutes: the knowledge base knows the typical airline, the builder routes accordingly without a live API call

**Sub-project A: GO7 Airline Tagging**

For each airline in every TransferRoute's airlines array, determine whether it is in the GO7 network. Update `airlines[n].go7Airline = true` for confirmed GO7 airlines. This enables the builder to know which routes can have live availability checked.

**Sub-project B: Duffel Airline Tagging**

Same for Duffel: update `airlines[n].duffelAirline = true` for major carriers bookable via Duffel.

**Sub-project C: Flight Search Integration**

Implement flight search in the builder:
1. For each TransferRoute in a generated itinerary with `mode: 'flight'`
2. Check if any airline on the route has `go7Airline: true` → call GO7 `getFlights`
3. Check if any airline has `duffelAirline: true` → call Duffel flight search
4. Return available flights with pricing
5. If no live flight data available → return `availability: 'estimated'` with typical airline from knowledge base

**Outputs:** Flight availability integrated into itinerary builder. Coverage report includes flight availability status.

---

## M11: WebMCP Exposure — plan_safari() (Phase 5 of Agentic Vision)

**Goal:** Expose Kiuli's itinerary builder as a WebMCP tool so AI agents (Google AI Mode, Perplexity, ChatGPT, autonomous travel agents) can discover and call it directly.

**What WebMCP is:** A protocol by which AI agents discover tools exposed by websites via a manifest at `/.well-known/webmcp.json`. When Kiuli publishes this manifest, any AI agent capable of tool use can find and call `plan_safari()` without human intermediation.

**Sub-project A: WebMCP Manifest**

Create `kiuli.com/.well-known/webmcp.json`:
```json
{
  "name": "Kiuli Luxury Safari Planner",
  "description": "Plan bespoke African safari itineraries from Kiuli's curated knowledge base of luxury lodges, routes, and seasonal intelligence.",
  "tools": [
    {
      "name": "plan_safari",
      "description": "Generate a complete luxury safari itinerary with property recommendations, transfers, pricing, and availability.",
      "endpoint": "https://kiuli.com/api/plan-safari",
      "input_schema": { ... },
      "output_schema": { ... }
    }
  ]
}
```

**Sub-project B: plan_safari() Endpoint**

Build the `/api/plan-safari` Next.js API route that:
1. Receives the structured constraints (countries, nights, pax, budget, trip types, dates)
2. Queries ItineraryPatterns for matching templates (country, nights ≈ requested, priceTier matches budget)
3. Resolves the property sequence for the best matching pattern
4. Fetches availability and pricing from ResConnect for each property (M9 prerequisite)
5. Adds flight routing from GO7/Duffel where available (M10 prerequisite)
6. Returns the structured response with `inquireUrl` and `viewUrl`

The tool signature and return format are fully specified in KIULI_AGENTIC_VISION.md Section 4.

**Sub-project C: Agent Discovery Validation**

Test that AI agents can discover and call the tool:
- Verify manifest is accessible and valid
- Test `plan_safari()` call from a Claude tool-use session
- Verify `inquireUrl` routes correctly to the inquiry form with pre-populated itinerary data

**Outputs:** WebMCP manifest live. `plan_safari()` returns structured itinerary with availability and pricing. AI agents can discover Kiuli autonomously.

---

## M12: Call Kiuli — Speech Agent (Phase 6 of Agentic Vision)

**Goal:** Build the speech-to-speech AI agent that qualifies inbound phone calls from HNWI prospects. Uses the same knowledge base as the WebMCP tool but via voice interface.

**Design constraint:** The pgvector semantic search must return results in < 500ms for the speech agent. Design the knowledge base queries accordingly from Phase 1.

**This milestone is defined but not yet specified in detail.** Specification to follow when M11 is complete.

---

## Rules For All Future Conversations

1. **KIULI_AGENTIC_VISION.md is the north star.** Every schema decision, every scraper change, every API integration must trace back to this document. Do not add fields or collections not in the vision without explicit discussion.

2. **M2 Phase 2 before any production scraping.** Do not scrape 75–100 itineraries with the activity noise bug, observationCount bug, or missing seasonalityData field. The knowledge base will accumulate errors at scale.

3. **Every itinerary scrape populates the knowledge base.** The scraper is not just a content pipeline — it is the intelligence accumulator. Every property observation, pairing, and pattern makes the builder smarter.

4. **Empty fields are correct. Missing fields are migrations.** A property with `wetuContentEntityId: null` is correct. A properties schema with no `wetuContentEntityId` field requires a migration after 100 records exist.

5. **Content engine alignment must be verified before M5.** The cascade extracts data from Itineraries. If schema changes affect cascade behaviour, find it in M2 Phase 2 — not during the production run.

6. **Source monitor geographic filter.** Before running the source monitor again, add a filter to reject non-African-wildlife content at ingestion. The bioRxiv RSS feed is global.

7. **The agentic phases (M8–M12) require business actions.** M9 requires ResConnect partner onboarding ($175, NDA, audit). M8 requires Wetu API credentials. These business actions have lead times. Start them in parallel with M3 development.

---

## Document Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | February 22, 2026 | Initial roadmap. M1 complete. M2 blocked on KIULI_AGENTIC_VISION.md. |
| 2.0 | February 23, 2026 | Major revision. M2 Phase 1 complete. KIULI_AGENTIC_VISION.md produced and uploaded. M2 Phase 2 gaps documented with specific fixes. Post-launch agentic milestones M8–M12 added (Wetu, ResConnect, Flights, WebMCP, Speech Agent). |

---

*Version 2.0 — February 23, 2026*
*M1 complete. M2 Phase 1 complete. Next: M2 Phase 2 (scraper fixes) → M3 (frontend).*
