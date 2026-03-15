# CLAUDE.md — Kiuli

**READ THIS ENTIRE FILE BEFORE TAKING ANY ACTION.**

---

## 1. What This Project Is

Kiuli is a **luxury African safari travel company**. The website at kiuli.com is a **qualification machine** — it builds overwhelming value through comprehensive content, then reveals pricing ("Investment Level") to filter for high-net-worth US prospects spending $25,000–$100,000+ on safari experiences.

The website is not a brochure. Every technical decision supports: **Attract → Qualify → Convert**.

Travel designers Emily and Jody handle all post-qualification conversations. The AI builds content. The designers build relationships and close bookings.

### The Agentic Vision

Kiuli is building toward becoming the world's first WebMCP-powered AI agentic itinerary builder. AI agents will call `plan_safari()` to receive structured, priced itinerary drafts with confirmed availability. This requires a knowledge base of properties, routes, activities, and pricing patterns — which the scraper is accumulating now. See KIULI_AGENTIC_VISION.md in project knowledge.

**Schema decisions today must support this vision. Do not build anything that will require migration later.**

---

## 2. Technology Stack

| Component | Technology | Version/Details |
|-----------|------------|-----------------|
| Framework | Next.js | 15.4.10 (App Router, React 19) |
| CMS | Payload CMS | 3.76.0 |
| Database | Neon Postgres | Managed, pgvector extension for RAG |
| Image Storage | AWS S3 | kiuli-bucket, eu-north-1 |
| Image CDN | imgix | kiuli.imgix.net |
| Hosting | Vercel | Auto-deploy from main branch |
| Scraper Pipeline | AWS Step Functions + 5 Lambda | eu-north-1 |
| AI (Content Engine) | OpenRouter | Claude Sonnet 4, configurable per purpose |
| AI (Image Generation) | OpenRouter | FLUX models |
| AI (Image Labeling) | OpenRouter | GPT-4o |
| AI (Embeddings) | OpenAI | text-embedding-3-large, 3072 dimensions |
| Email | Resend | Transactional |
| CRM | HubSpot | Contact + deal creation |
| Analytics | GA4 + Google Ads | Enhanced Conversions for Leads |

**No Gemini. All AI goes through OpenRouter. Do not add Gemini references.**

---

## 3. Architecture

### Repository Structure

```
kiuli-website/
├── src/
│   ├── app/
│   │   ├── (frontend)/              # Customer-facing routes
│   │   │   ├── safaris/[slug]/      # Itinerary detail pages
│   │   │   ├── destinations/        # Destination listing + detail
│   │   │   ├── articles/            # Article listing + detail
│   │   │   ├── properties/          # Property listing + detail
│   │   │   └── contact/             # Inquiry form
│   │   └── (payload)/
│   │       ├── api/                 # API routes
│   │       │   ├── content/         # Content Engine (15 endpoints)
│   │       │   ├── scrape-itinerary/# Triggers Step Functions
│   │       │   ├── enhance/         # iTrvl segment enhancement
│   │       │   └── inquiry/         # Inquiry submission
│   │       └── admin/
│   │           └── content-engine/  # Custom admin views (dashboard, workspace)
│   ├── collections/                 # 21 Payload collections + 4 knowledge base collections
│   ├── globals/                     # 6 Payload globals
│   ├── services/enhancer.ts         # iTrvl enhancement (legacy path — see note below)
│   ├── components/content-system/   # Content Engine UI components
│   └── payload.config.ts
├── content-system/                  # Content Engine core
│   ├── voice/                       # BrandVoice loader + prompt builder
│   ├── drafting/                    # Article, destination, property, segment drafters
│   ├── conversation/                # Designer ↔ AI conversation handler
│   ├── embeddings/                  # Vector store (pgvector, 3072d)
│   ├── cascade/                     # Itinerary cascade (entity extraction)
│   ├── ideation/                    # Content candidate generation
│   ├── research/                    # Perplexity research compilation
│   ├── publishing/                  # Content → collection publishers
│   ├── quality/                     # Hard gates + consistency checking
│   ├── signals/                     # Source monitoring + itinerary decomposer
│   ├── images/                      # Image library search + generation
│   └── openrouter-client.ts         # Centralised LLM client
├── content-engine/
│   ├── prompts/                     # Claude CLI execution prompts (historical)
│   ├── evidence/                    # Verification evidence files
│   └── reports/                     # Phase completion reports
├── lambda/                          # AWS Lambda functions
│   ├── orchestrator/                # Pipeline coordination + transform.js
│   ├── image-processor/             # Image re-hosting to S3
│   ├── labeler/                     # AI image enrichment (GPT-4o)
│   ├── video-processor/             # HLS to MP4 conversion
│   └── finalizer/                   # Schema generation, hero selection
├── stepfunctions/                   # AWS Step Functions definitions
└── docs/                            # Legacy documentation (may be outdated)
```

### Scraper Pipeline

```
Orchestrate → ProcessImageChunk ⟲ → ProcessVideos → LabelBatch ⟲ → Finalize
```

State machine ARN: `arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline`

7 itineraries processed, 650 media items, zero failures. M2 Phase 1 (schema evolution + knowledge base foundation) complete. M2 Phase 2 fixes required before production scrape — see KIULI_LAUNCH_ROADMAP.md.

### Knowledge Base Collections (M2 Phase 1 — Live)

Every itinerary scrape now populates four knowledge base collections that accumulate intelligence across all scraped itineraries:

| Collection | Purpose |
|-----------|---------|
| Properties | Lodge/camp records with externalIds, canonicalContent, accumulatedData, availability |
| TransferRoutes | Air/road transfer patterns with observations and airline intelligence |
| Activities | Safari activities linked to properties and destinations |
| ItineraryPatterns | Complete property+transfer sequences extracted from each itinerary |

Plus `availability_cache` direct SQL table for ResConnect responses (Phase 3).

### Content Engine — ALL 15 PHASES COMPLETE

Schema → Vector Store → Embeddings → OpenRouter → Cascade → Ideation → Dashboard → Research → Conversation → Workspace → Drafting+BrandVoice → Consistency Checking → Publishing → Image Pipeline → Quality Gates

4 articles published end-to-end (Projects 79, 27, 53, 87 → Posts 22–25). 60 content projects exist. Zero production content run yet.

### Inquiry Funnel — COMPLETE

9-phase system: form → backend → email → HubSpot → client-side → GA4 → Google Ads → session tracking → modal.

### Two Enhancer Files — Do Not Confuse

1. **`src/services/enhancer.ts`** — iTrvl scraper's enhance endpoint (`/api/enhance`). Called when designer clicks "Enhance" on itinerary segment. Calls OpenRouter directly.
2. **`content-system/drafting/segment-enhancer.ts`** — Content Engine's draft dispatch. Called via `/api/content/draft`. Uses content-system's `callModel`.

Both use BrandVoice via the voice loader, but through different code paths. Know which one you're editing.

---

## 4. Payload CMS Schema

### Collections (25 total: 21 original + 4 knowledge base)

Pages, Posts, Media, Categories, Users, Itineraries, ItineraryJobs, ImageStatuses, Notifications, VoiceConfiguration (LEGACY), Destinations, TripTypes, Inquiries, Sessions, Designers, Authors, Properties, **ContentProjects**, **ContentJobs**, **SourceRegistry**, **EditorialDirectives**, **Properties** (KB), **TransferRoutes** (KB), **Activities** (KB), **ItineraryPatterns** (KB)

### Globals (6)

Header, Footer, PropertyNameMappings, DestinationNameMappings, **ContentSystemSettings**, **BrandVoice**

### BrandVoice Global

Single source of truth for all Kiuli writing. 4 layers, 12 database tables:
- Layer 1: Core identity (principles, banned phrases, anti-patterns, gold standards)
- Layer 2: Content type guidance (6 types with temperatures)
- Layer 3: Section guidance (17 sections with DO/DON'T lists)
- Layer 4: Evolution log (audit trail)

All drafters load voice through `content-system/voice/loader.ts`. The old VoiceConfiguration collection is legacy — do not use it for new code.

---

## 5. Content Engine API Routes

All under `/api/content/`:

cascade, consistency, conversation, dashboard, dashboard/batch, decompose, draft, embed, generate-image, jobs, publish, quality-gates, research, source-monitor, test-connection

Server actions in `src/app/(payload)/admin/content-engine/project/[id]/actions.ts` — 14 actions covering conversation, project management, research, drafting, consistency, quality gates, publishing, and image handling.

All authenticated via Bearer token (CONTENT_SYSTEM_SECRET) or Payload admin session.

---

## 6. THE RULES — NON-NEGOTIABLE

### Rule 0: STOP on Failure

If ANY command fails: **STOP. Report. Wait for instructions. Do NOT improvise.**

### Rule 1: No Assumptions

Never assume code works because it compiles. Run it. Never assume environment variables are correct. Check them. Never assume Vercel matches local. Verify explicitly. When in doubt, ask. Do not guess and proceed.

### Rule 2: No Shortcuts, No Placeholders, No Workarounds

**WRONG:** `// TODO: implement later`, `pass # fix this`, workarounds that mask problems
**CORRECT:** Complete, working implementation or explicit STOP

Every piece of work must be complete before moving on. Deferred work creates future confusion.

### Rule 3: Code is Truth

If documentation says one thing and code says another, **code is truth**. Update documentation to match.

### Rule 4: Evidence-Based Verification

"It should work" is not verification. Run it, save the evidence, inspect the evidence. All completions require:
- **Positive proof** — the thing works as intended
- **Negative proof** — it rejects what it should reject
- **Mechanism proof** — it works for the right reason, not by accident

### Rule 5: Commit Before Context Switch

Before switching tasks, ending a session, or changing direction:
```bash
git status
git add -A && git commit -m "description"
git push origin main
```
Never leave uncommitted changes.

### Rule 6: Payload Admin Component Changes

When adding or modifying Payload admin components:
```bash
npx payload generate:importmap
git add src/app/\(payload\)/admin/importMap.js
```
New components will NOT appear in admin without regenerating the import map.

### Rule 7: Collection Changes Need Schema Review

When adding a new Payload collection:
1. Check if `payload_locked_documents_rels` needs a new column
2. Check if `payload_preferences_rels` needs a new column
3. Create migration BEFORE deploying
4. Run `npx payload migrate` locally to verify
5. Test admin dashboard: `npm run build && npm start`

### Rule 8: Diagnose Before Changing

When admin panel shows errors:
1. FIRST: `vercel logs production --error --since 1h`
2. SECOND: Read the full error message and stack trace
3. THIRD: Fix the specific issue
4. NEVER: Randomly disable components hoping something works

### Rule 9: Schema Evolution Before Production Scraping

M2 Phase 2 schema fixes are complete (verified 2026-03-12). Production scraping is unblocked. However, the image-processor Lambda has an open sharp module issue on linux-x64 — resolve before running production scrape batches.

### Rule 10: Knowledge Base Accumulation Is the Product

The scraper is not just a content pipeline — it is an intelligence accumulator. Every itinerary scrape makes the knowledge base richer. Every schema compromise degrades that intelligence. Treat the knowledge base with the same care as production content.

---

## 7. Lambda Deployment

Use the canonical deploy script. See `lambda/DEPLOYMENT.md` (v2.0) for full reference.

```bash
# Deploy a specific Lambda (from project root)
lambda/scripts/deploy.sh <function-name>

# Deploy all Lambdas
lambda/scripts/deploy.sh all

# Verify all Lambdas match current HEAD
lambda/scripts/verify.sh
```

The deploy script handles: shared/ sync, platform-specific npm install (linux-x64 for Lambda), zip packaging, S3 upload for large functions (>50MB), git hash stamping in Lambda description, and post-deploy verification.

Lambda functions: orchestrator, image-processor, labeler, video-processor, finalizer, scraper.

---

## 8. Common Commands

```bash
npm run dev              # Local development
npm run build            # Production build (must pass before deploy)
vercel --prod            # Deploy production
npx payload migrate      # Run database migrations
npx payload generate:importmap  # Regenerate admin component map
```

---

## 9. Environment Variables

### Vercel (Website)

POSTGRES_URL, DATABASE_URL_UNPOOLED, PAYLOAD_SECRET, OPENROUTER_API_KEY, OPENAI_API_KEY, CONTENT_SYSTEM_SECRET, PERPLEXITY_API_KEY, S3_BUCKET, S3_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, IMGIX_URL, RESEND_API_KEY, HUBSPOT_ACCESS_TOKEN, HUBSPOT_PIPELINE_ID, HUBSPOT_STAGE_ID, NEXT_PUBLIC_GA_MEASUREMENT_ID, NEXT_PUBLIC_GOOGLE_ADS_ID, NEXT_PUBLIC_INQUIRY_CONVERSION_LABEL, NEXT_PUBLIC_ENGAGED_VISITOR_CONVERSION_LABEL

### Lambda Functions

AWS_REGION (eu-north-1), PAYLOAD_API_URL, PAYLOAD_API_KEY, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, IMGIX_DOMAIN, OPENROUTER_API_KEY, STEP_FUNCTION_ARN

---

## 10. Project Knowledge (claude.ai)

These files are in the Claude.ai project knowledge and are the authoritative references:

| File | Purpose |
|------|---------|
| KIULI_PROJECT_STATE.md | Complete current state — read first in every conversation |
| KIULI_LAUNCH_ROADMAP.md | Sequenced plan from current state to launch and beyond (M1–M12) |
| KIULI_AGENTIC_VISION.md | WebMCP itinerary builder architecture and schema requirements |
| KIULI_CONTENT_SYSTEM_V6.md | Content Engine specification |
| KIULI_FUNNEL_SPECIFICATION_V2.md | Complete inquiry funnel reference |
| ITRVL_SCRAPING_REFERENCE.md | Scraper pipeline reference |
| KIULI_DESIGN_PRODUCTION_GUIDE.md | Design system and v0 workflow |
| Kiuli_Content_Strategy.md | Content strategy blueprint |
| jacada_competitive_analysis.md | Competitive analysis |

### In-repo Documentation

| File | Purpose |
|------|---------|
| CLAUDE.md | This file |
| KIULI_LAUNCH_ROADMAP.md | Sequenced plan (also in project knowledge — keep in sync) |
| KIULI_LAMBDA_ARCHITECTURE.md | Detailed scraper pipeline documentation |
| SYSTEM_ARCHITECTURE.md | System overview |
| DEPLOYMENT_CHECKLIST.md | Pre/post deployment procedures |
| lambda/DEPLOYMENT.md | Lambda deployment procedures |
| docs/ | Collection schemas, API reference, admin components, frontend components |

---

## 11. Design System

| Element | Value |
|---------|-------|
| Kiuli Teal | #486A6A (primary) |
| Kiuli Clay | #DA7A5A (accent/CTA) |
| Kiuli Charcoal | #404040 (text) |
| Kiuli Gray | #DADADA (borders) |
| Kiuli Ivory | #F5F3EB (backgrounds) |
| Headlines/Body | General Sans |
| Secondary | Satoshi |
| Accent Script | Waterfall (sparingly) |

Aesthetic: understated luxury, editorial magazine feel, generous whitespace, no safari clichés.

---

## 12. Current Launch Status

All Content Engine phases (1–15) are complete. The scraper pipeline works. The inquiry funnel works. The knowledge base collections are live and accumulating from every scrape. Zero production content exists.

The launch roadmap (KIULI_LAUNCH_ROADMAP.md) defines milestones:

| Milestone | Status |
|-----------|--------|
| M1: Pipeline Validation | ✅ COMPLETE |
| M2 Phase 1: Schema Evolution + Knowledge Base | ✅ COMPLETE |
| M2 Phase 2: Scraper Fixes | ✅ COMPLETE (verified 2026-03-12) |
| M2.5: Admin UI Polish | ✅ COMPLETE (11 issues fixed, deployed 2026-03-15) |
| M3: Frontend Development | Not started |
| M4: Admin UI Overhaul | Not started |
| M5: Integration Test Cycle | Not started |
| M6: Production Content Run | Not started |
| M7: Launch | Not started |
| M8: Wetu Integration | Post-launch |
| M9: ResConnect Live Availability | Post-launch |
| M10: Flight Integration | Post-launch |
| M11: WebMCP plan_safari() | Post-launch |
| M12: Speech Agent | Post-launch |

**Open blocker:** image-processor Lambda sharp module fails on linux-x64 despite correct ELF binaries in deploy zip. Must resolve before production scrape batches.

**CI/CD:** MCP server provides 30 tools including full Vercel CI/CD (vercel_list, vercel_inspect, vercel_logs, vercel_deploy, vercel_rollback) and Lambda deployment (deploy_lambda, verify_lambdas, trigger_pipeline). Auto-deploy from GitHub main to Vercel is active.

---

*Last updated: March 15, 2026*
