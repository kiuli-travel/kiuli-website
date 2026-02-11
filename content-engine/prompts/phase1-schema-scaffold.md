# Phase 1: Schema Scaffold — CLI Prompt

**Date:** 2026-02-11
**Author:** Claude.ai (Strategic)
**Executor:** Claude CLI (Tactical)
**Phase:** 1 of 15
**Depends on:** Phase 0 (complete)

---

## Context

You are implementing Phase 1 of the Kiuli Content Engine. This phase creates the Payload CMS collections and globals that underpin the entire content production system. These schemas define how every piece of content flows from idea through to publication.

Read this prompt completely before writing any code.

---

## Spec Corrections (Override V6 and V4 where they conflict)

These decisions were made on 2026-02-11 and are recorded in `content-engine/status.md`. They override the V6 spec and V4 dev plan:

1. **EditorialDirectives is a Collection, NOT a Global.** It requires individual records with relationships, querying, filtering, and lifecycle management. Create it as `src/collections/EditorialDirectives.ts`.
2. **Lambda directory is `lambda/`, not `lambdas/`.** The `lambda/` directory already exists with scraper Lambdas. Content system Lambdas go alongside them.
3. **Lambda handlers in JS, content-system modules in TS.** Matches existing scraper pattern.

---

## Pre-Task: Commit Uncommitted Files

Before any Phase 1 work, commit the existing uncommitted files from Pre-Phase 0:

```bash
git add content-engine/ tools/ tsconfig.tsbuildinfo
git commit -m "chore: add content-engine orchestration dir and enhanced MCP server"
git push
```

Verify `git status` shows clean working tree before proceeding.

---

## Task 1: ContentProjects Collection

**File:** `src/collections/ContentProjects/index.ts`

This is the central collection of the entire content engine. One record per piece of content. Every field matters. Follow the exact patterns used in `src/collections/ItineraryJobs/index.ts` (tabs, admin config) and `src/collections/Properties.ts` (versioning, access).

### Collection Config

```typescript
import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
```

- **slug:** `'content-projects'`
- **admin.useAsTitle:** `'title'`
- **admin.group:** `'Content Engine'`
- **admin.defaultColumns:** `['title', 'contentType', 'stage', 'processingStatus', 'updatedAt']`
- **admin.listSearchableFields:** `['title', 'slug']`
- **admin.description:** `'Content production projects — from idea through to publication'`
- **versions:** `{ drafts: true }` — enables full draft history
- **access:** `create: authenticated, update: authenticated, delete: authenticated, read: () => true`
- **timestamps:** `true`

### Fields

The top-level fields (before tabs) are:

#### `title`
- type: `text`
- required: `true`
- admin.description: `'Working title for this content project'`

#### `slug`
- type: `text`
- unique: `true`
- index: `true`
- admin.description: `'URL-friendly identifier — auto-generated or manual'`

Then a `tabs` field containing 12 tabs. Every field below is assigned to its specified tab.

---

### Tab 1: Overview

#### `stage`
- type: `select`
- required: `true`
- defaultValue: `'idea'`
- options (label/value pairs):
  - `Idea` / `idea`
  - `Brief` / `brief`
  - `Research` / `research`
  - `Draft` / `draft`
  - `Review` / `review`
  - `Published` / `published`
  - `Proposed` / `proposed`
  - `Rejected` / `rejected`
  - `Filtered` / `filtered`
- admin.description: `'Current workflow stage'`

#### `contentType`
- type: `select`
- required: `true`
- options:
  - `Itinerary Cluster` / `itinerary_cluster`
  - `Authority Article` / `authority`
  - `Designer Insight` / `designer_insight`
  - `Destination Page` / `destination_page`
  - `Property Page` / `property_page`
  - `Itinerary Enhancement` / `itinerary_enhancement`
  - `Page Update` / `page_update`
- admin.description: `'Type of content this project produces'`

#### `originPathway`
- type: `select`
- options:
  - `Itinerary Decomposition` / `itinerary`
  - `External Source` / `external`
  - `Designer Suggestion` / `designer`
  - `Cascade` / `cascade`
- admin.description: `'How this project was created'`

#### `originItinerary`
- type: `relationship`
- relationTo: `'itineraries'`
- hasMany: `false`
- admin.description: `'Source itinerary (if origin is itinerary or cascade)'`
- admin.condition: show when `originPathway` is `'itinerary'` or `'cascade'`

#### `originSource`
- type: `relationship`
- relationTo: `'source-registry'`
- hasMany: `false`
- admin.description: `'Source feed entry (if origin is external)'`
- admin.condition: show when `originPathway` is `'external'`

#### `originUrl`
- type: `text`
- admin.description: `'External URL that triggered this project'`
- admin.condition: show when `originPathway` is `'external'`

#### `filterReason`
- type: `text`
- admin.description: `'Why this project was filtered during ideation'`
- admin.condition: show when `stage` is `'filtered'`

---

### Tab 2: Processing

#### `processingStatus`
- type: `select`
- defaultValue: `'idle'`
- options:
  - `Idle` / `idle`
  - `Processing` / `processing`
  - `Completed` / `completed`
  - `Failed` / `failed`
- admin.description: `'Status of current async operation (draft generation, research, etc.)'`

#### `processingError`
- type: `text`
- admin.description: `'Human-readable error from last failed operation'`
- admin.condition: show when `processingStatus` is `'failed'`

#### `processingStartedAt`
- type: `date`
- admin.date.pickerAppearance: `'dayAndTime'`
- admin.description: `'When the current async operation started'`
- admin.readOnly: `true`

---

### Tab 3: Target

#### `targetCollection`
- type: `select`
- options:
  - `Destinations` / `destinations`
  - `Itineraries` / `itineraries`
  - `Posts (Articles)` / `posts`
  - `Properties` / `properties`
- admin.description: `'Which Payload collection this content publishes to'`

#### `targetRecordId`
- type: `text`
- admin.description: `'Payload ID of the target record (for updates and enhancements)'`

#### `targetField`
- type: `text`
- admin.description: `'Specific field or block name being updated (for page_update type)'`
- admin.condition: show when `contentType` is `'page_update'`

#### `targetCurrentContent`
- type: `richText`
- admin.description: `'Snapshot of existing content at read time (for page_update type)'`
- admin.condition: show when `contentType` is `'page_update'`

#### `targetUpdatedAt`
- type: `date`
- admin.date.pickerAppearance: `'dayAndTime'`
- admin.description: `'updatedAt of target record at read time — used for optimistic locking on publish'`

---

### Tab 4: Brief

#### `briefSummary`
- type: `textarea`
- admin.description: `'What this article will cover and why it matters'`

#### `targetAngle`
- type: `textarea`
- admin.description: `'The specific angle or perspective — what makes this different from competitors'`

#### `targetAudience`
- type: `select`
- hasMany: `true`
- options:
  - `Customer` / `customer`
  - `Professional` / `professional`
  - `Guide` / `guide`
- admin.description: `'Who this content is for'`

#### `competitiveNotes`
- type: `textarea`
- admin.description: `'What competitors have published on this topic and how we differ'`

---

### Tab 5: Research

#### `synthesis`
- type: `richText`
- admin.description: `'Compiled research findings — editable by designer'`

#### `existingSiteContent`
- type: `richText`
- admin.description: `'Relevant content already on kiuli.com (from embedding store query)'`

#### `sources`
- type: `array`
- admin.description: `'External sources used in research'`
- fields:
  - `title` — type: `text`, admin.description: `'Source title or headline'`
  - `url` — type: `text`, admin.description: `'Source URL'`
  - `credibility` — type: `select`, options: `Authoritative` / `authoritative`, `Peer Reviewed` / `peer_reviewed`, `Preprint` / `preprint`, `Trade Publication` / `trade`, `Other` / `other`; admin.description: `'Source credibility rating'`
  - `notes` — type: `textarea`, admin.description: `'Key takeaways from this source'`

#### `proprietaryAngles`
- type: `array`
- admin.description: `'Unique angles from Kiuli internal sources'`
- fields:
  - `angle` — type: `textarea`, admin.description: `'The proprietary insight or angle'`
  - `source` — type: `select`, options: `Designer` / `designer`, `Client Feedback` / `client`, `Booking Data` / `booking`, `Supplier` / `supplier`; admin.description: `'Where this insight came from'`

#### `uncertaintyMap`
- type: `array`
- admin.description: `'Claims that need verification or have varying confidence'`
- fields:
  - `claim` — type: `text`, admin.description: `'The factual claim'`
  - `confidence` — type: `select`, options: `Verified Fact` / `fact`, `Reasonable Inference` / `inference`, `Uncertain` / `uncertain`; admin.description: `'Confidence level'`
  - `notes` — type: `textarea`, admin.description: `'Verification notes or sources'`

#### `editorialNotes`
- type: `richText`
- admin.description: `'Designer notes on research — context, corrections, additions'`

---

### Tab 6: Draft

#### `body`
- type: `richText`
- admin.description: `'Full article body (Lexical editor). For compound types, use sections field instead.'`

#### `sections`
- type: `json`
- admin.description: `'Structured section content for compound types (destination_page, property_page). JSON object keyed by section name.'`

#### `faqSection`
- type: `array`
- admin.description: `'FAQ items for this content'`
- fields:
  - `question` — type: `text`, required: `true`
  - `answer` — type: `textarea`, required: `true`

#### `metaTitle`
- type: `text`
- maxLength: `60`
- admin.description: `'SEO meta title (max 60 chars)'`

#### `metaDescription`
- type: `textarea`
- maxLength: `160`
- admin.description: `'SEO meta description (max 160 chars)'`

#### `answerCapsule`
- type: `textarea`
- admin.description: `'AI Overview optimised summary (50-70 words)'`

---

### Tab 7: Images

#### `heroImage`
- type: `relationship`
- relationTo: `'media'`
- hasMany: `false`
- admin.description: `'Selected hero image for this content'`

#### `libraryMatches`
- type: `json`
- admin.description: `'Auto-populated matches from media library search'`
- admin.readOnly: `true`

#### `generatedCandidates`
- type: `array`
- admin.description: `'AI-generated image candidates'`
- fields:
  - `imageUrl` — type: `text`, admin.description: `'URL of generated image'`
  - `prompt` — type: `textarea`, admin.description: `'Generation prompt used'`
  - `status` — type: `select`, options: `Candidate` / `candidate`, `Selected` / `selected`, `Rejected` / `rejected`; defaultValue: `'candidate'`

---

### Tab 8: Distribution

#### `linkedinSummary`
- type: `textarea`
- admin.description: `'LinkedIn post text'`

#### `facebookSummary`
- type: `textarea`
- admin.description: `'Facebook post text'`

#### `facebookPinnedComment`
- type: `textarea`
- admin.description: `'Facebook pinned comment (often a call to action)'`

#### `postedToLinkedin`
- type: `checkbox`
- defaultValue: `false`
- admin.description: `'Whether this has been posted to LinkedIn'`

#### `postedToFacebook`
- type: `checkbox`
- defaultValue: `false`
- admin.description: `'Whether this has been posted to Facebook'`

#### `linkedinPostId`
- type: `text`
- admin.description: `'LinkedIn post ID (for tracking)'`
- admin.condition: show when `postedToLinkedin` is `true`

#### `facebookPostId`
- type: `text`
- admin.description: `'Facebook post ID (for tracking)'`
- admin.condition: show when `postedToFacebook` is `true`

---

### Tab 9: Linking

#### `internalLinks`
- type: `relationship`
- relationTo: `'content-projects'`
- hasMany: `true`
- admin.description: `'Other content projects this links to'`

#### `itineraryLinks`
- type: `relationship`
- relationTo: `'itineraries'`
- hasMany: `true`
- admin.description: `'Itineraries this content links to'`

#### `destinationLinks`
- type: `relationship`
- relationTo: `'destinations'`
- hasMany: `true`
- admin.description: `'Destinations this content links to'`

#### `propertyLinks`
- type: `relationship`
- relationTo: `'properties'`
- hasMany: `true`
- admin.description: `'Properties this content links to'`

---

### Tab 10: Consistency

#### `consistencyCheckResult`
- type: `select`
- defaultValue: `'not_checked'`
- options:
  - `Pass` / `pass`
  - `Hard Contradiction` / `hard_contradiction`
  - `Soft Contradiction` / `soft_contradiction`
  - `Not Checked` / `not_checked`
- admin.description: `'Result of last consistency check against existing site content'`

#### `consistencyIssues`
- type: `array`
- admin.description: `'Specific contradictions or staleness issues found'`
- fields:
  - `issueType` — type: `select`, options: `Hard Contradiction` / `hard`, `Soft Contradiction` / `soft`, `Staleness` / `staleness`
  - `existingContent` — type: `textarea`, admin.description: `'The existing content that conflicts'`
  - `newContent` — type: `textarea`, admin.description: `'The new content that conflicts'`
  - `sourceRecord` — type: `text`, admin.description: `'ID and collection of the conflicting record'`
  - `resolution` — type: `select`, options: `Pending` / `pending`, `Updated Draft` / `updated_draft`, `Updated Existing` / `updated_existing`, `Overridden` / `overridden`; defaultValue: `'pending'`
  - `resolutionNote` — type: `textarea`, admin.description: `'How this was resolved'`

---

### Tab 11: Metadata

#### `destinations`
- type: `json`
- admin.description: `'String array of destination names this content covers'`

#### `properties`
- type: `json`
- admin.description: `'String array of property names this content covers'`

#### `species`
- type: `json`
- admin.description: `'String array of wildlife species mentioned'`

#### `freshnessCategory`
- type: `select`
- options:
  - `Monthly` / `monthly`
  - `Quarterly` / `quarterly`
  - `Annual` / `annual`
  - `Evergreen` / `evergreen`
- admin.description: `'How frequently this content needs freshness review'`

#### `publishedAt`
- type: `date`
- admin.date.pickerAppearance: `'dayAndTime'`
- admin.description: `'When this content was published to its target collection'`

#### `lastReviewedAt`
- type: `date`
- admin.date.pickerAppearance: `'dayAndTime'`
- admin.description: `'When a designer last reviewed this content'`

---

### Tab 12: Conversation

#### `messages`
- type: `array`
- admin.description: `'Conversation thread between designer and Kiuli AI'`
- fields:
  - `role` — type: `select`, required: `true`, options: `Designer` / `designer`, `Kiuli` / `kiuli`
  - `content` — type: `textarea`, required: `true`, admin.description: `'Message text'`
  - `timestamp` — type: `date`, required: `true`, admin.date.pickerAppearance: `'dayAndTime'`
  - `actions` — type: `json`, admin.description: `'Structured record of edits or operations performed in response to this message'`

---

## Task 2: ContentJobs Collection

**File:** `src/collections/ContentJobs/index.ts`

Tracks background Lambda jobs. Simpler than ContentProjects.

### Collection Config

- **slug:** `'content-jobs'`
- **admin.useAsTitle:** `'jobType'`
- **admin.group:** `'Content Engine'`
- **admin.defaultColumns:** `['jobType', 'status', 'createdAt', 'completedAt']`
- **admin.description:** `'Background processing jobs — cascade, decompose, embed, monitor'`
- **access:** `create: authenticated, update: authenticated, delete: authenticated, read: () => true`
- **timestamps:** `true`

### Fields (no tabs needed — flat structure)

#### `jobType`
- type: `select`
- required: `true`
- options:
  - `Cascade` / `cascade`
  - `Decompose` / `decompose`
  - `Source Monitor` / `source_monitor`
  - `Batch Embed` / `batch_embed`
  - `Bootstrap` / `bootstrap`
- admin.description: `'Type of background job'`

#### `status`
- type: `select`
- required: `true`
- defaultValue: `'pending'`
- options:
  - `Pending` / `pending`
  - `Running` / `running`
  - `Completed` / `completed`
  - `Failed` / `failed`
- admin.description: `'Current job status'`

#### `itineraryId`
- type: `relationship`
- relationTo: `'itineraries'`
- hasMany: `false`
- admin.description: `'Source itinerary (for cascade and decompose jobs)'`

#### `progress`
- type: `json`
- admin.description: `'Structured step tracking — see V6 spec Section 11.3 for schema'`

#### `error`
- type: `text`
- admin.description: `'Human-readable error summary'`
- admin.condition: show when `status` is `'failed'`

#### `startedAt`
- type: `date`
- admin.date.pickerAppearance: `'dayAndTime'`
- admin.description: `'When this job started executing'`

#### `completedAt`
- type: `date`
- admin.date.pickerAppearance: `'dayAndTime'`
- admin.description: `'When this job completed or failed'`

#### `retriedCount`
- type: `number`
- defaultValue: `0`
- admin.description: `'Number of retry attempts made'`

#### `maxRetries`
- type: `number`
- defaultValue: `2`
- admin.description: `'Maximum retry attempts before permanent failure'`

#### `createdBy`
- type: `select`
- options:
  - `Hook` / `hook`
  - `Manual` / `manual`
  - `Schedule` / `schedule`
- admin.description: `'How this job was triggered'`

---

## Task 3: SourceRegistry Collection

**File:** `src/collections/SourceRegistry/index.ts`

Tracks external data feeds the system monitors.

### Collection Config

- **slug:** `'source-registry'`
- **admin.useAsTitle:** `'name'`
- **admin.group:** `'Content Engine'`
- **admin.defaultColumns:** `['name', 'category', 'active', 'lastCheckedAt']`
- **admin.description:** `'External data sources monitored for content triggers'`
- **access:** `create: authenticated, update: authenticated, delete: authenticated, read: () => true`
- **timestamps:** `true`

### Fields (no tabs needed)

#### `name`
- type: `text`
- required: `true`
- admin.description: `'Human-readable source name'`

#### `feedUrl`
- type: `text`
- required: `true`
- admin.description: `'URL of RSS feed or API endpoint'`

#### `category`
- type: `select`
- options:
  - `Science` / `science`
  - `Conservation` / `conservation`
  - `Industry` / `industry`
  - `Policy` / `policy`
- admin.description: `'Content category of this source'`

#### `checkMethod`
- type: `select`
- options:
  - `RSS` / `rss`
  - `API` / `api`
- admin.description: `'How to check this source for new items'`

#### `active`
- type: `checkbox`
- defaultValue: `true`
- admin.description: `'Whether this source is actively monitored'`

#### `lastCheckedAt`
- type: `date`
- admin.date.pickerAppearance: `'dayAndTime'`
- admin.readOnly: `true`
- admin.description: `'When this source was last checked for new items'`

#### `lastProcessedItemId`
- type: `text`
- admin.description: `'ID or URL of the last processed feed item — used as cursor'`

#### `lastProcessedItemTimestamp`
- type: `date`
- admin.date.pickerAppearance: `'dayAndTime'`
- admin.description: `'Timestamp of the last processed feed item'`

#### `recentProcessedIds`
- type: `json`
- admin.description: `'JSON array of last 50 processed item IDs/URLs — used for deduplication'`

#### `notes`
- type: `textarea`
- admin.description: `'Notes about this source — quirks, reliability, contact info'`

---

## Task 4: EditorialDirectives Collection

**File:** `src/collections/EditorialDirectives.ts`

**IMPORTANT: This is a Collection, NOT a Global.** (Spec correction — see status.md)

Each record is one editorial rule the system has learned from designer decisions. Used during ideation (filtering), drafting (prompt context), and consistency checking.

### Collection Config

- **slug:** `'editorial-directives'`
- **admin.useAsTitle:** `'text'`
- **admin.group:** `'Content Engine'`
- **admin.defaultColumns:** `['text', 'active', 'filterCount30d', 'reviewAfter']`
- **admin.description:** `'Rules learned from designer decisions — persist across all content production'`
- **access:** `create: authenticated, update: authenticated, delete: authenticated, read: () => true`
- **timestamps:** `true`

### Fields (no tabs needed)

#### `text`
- type: `textarea`
- required: `true`
- admin.description: `'The editorial rule — e.g. "Do not produce comparison articles between specific lodges"'`

#### `topicTags`
- type: `json`
- admin.description: `'JSON string array of topic tags this directive applies to'`

#### `destinationTags`
- type: `json`
- admin.description: `'JSON string array of destination names this directive applies to'`

#### `contentTypeTags`
- type: `json`
- admin.description: `'JSON string array of content types this directive applies to (e.g. ["authority", "designer_insight"])'`

#### `active`
- type: `checkbox`
- defaultValue: `true`
- admin.description: `'Whether this directive is currently enforced'`

#### `reviewAfter`
- type: `date`
- admin.description: `'When this directive should be reviewed for continued relevance. Default: 6 months from creation.'`

#### `lastReviewedAt`
- type: `date`
- admin.date.pickerAppearance: `'dayAndTime'`
- admin.description: `'When a designer last confirmed this directive is still relevant'`

#### `filterCount30d`
- type: `number`
- defaultValue: `0`
- admin.readOnly: `true`
- admin.description: `'Number of candidates this directive filtered in the last 30 days — updated by system'`

#### `originProject`
- type: `relationship`
- relationTo: `'content-projects'`
- hasMany: `false`
- admin.description: `'The content project whose rejection led to this directive'`

#### `originRejectionReason`
- type: `textarea`
- admin.description: `'The designer original rejection text that inspired this directive'`

---

## Task 5: ContentSystemSettings Global

**File:** `src/globals/ContentSystemSettings.ts`

Central configuration for the content engine. One record. Editable in admin.

Follow the exact pattern of `src/globals/PropertyNameMappings.ts`.

### Global Config

- **slug:** `'content-system-settings'`
- **admin.group:** `'Configuration'`
- **access:** `read: () => true, update: authenticated`

### Fields

#### `ideationModel`
- type: `text`
- defaultValue: `'anthropic/claude-sonnet-4-20250514'`
- admin.description: `'OpenRouter model identifier for ideation and filtering'`

#### `researchModel`
- type: `text`
- defaultValue: `'anthropic/claude-sonnet-4-20250514'`
- admin.description: `'OpenRouter model identifier for research synthesis'`

#### `draftingModel`
- type: `text`
- defaultValue: `'anthropic/claude-sonnet-4-20250514'`
- admin.description: `'OpenRouter model identifier for content drafting'`

#### `editingModel`
- type: `text`
- defaultValue: `'anthropic/claude-sonnet-4-20250514'`
- admin.description: `'OpenRouter model identifier for conversation editing'`

#### `imageModel`
- type: `text`
- defaultValue: `'anthropic/claude-sonnet-4-20250514'`
- admin.description: `'OpenRouter model identifier for image prompt generation'`

#### `embeddingModel`
- type: `text`
- defaultValue: `'openai/text-embedding-3-large'`
- admin.description: `'Model for generating embeddings (3072 dimensions)'`

#### `defaultImagePromptPrefix`
- type: `textarea`
- admin.description: `'Default prefix prepended to all image generation prompts'`

#### `consistencyCheckEnabled`
- type: `checkbox`
- defaultValue: `true`
- admin.description: `'Whether consistency checking runs before publication'`

#### `autoPopulateRelationships`
- type: `checkbox`
- defaultValue: `true`
- admin.description: `'Whether cascade auto-populates bidirectional relationships'`

---

## Task 6: DestinationNameMappings Global

**File:** `src/globals/DestinationNameMappings.ts`

Identical pattern to the existing `PropertyNameMappings` global but for destinations.

### Global Config

- **slug:** `'destination-name-mappings'`
- **admin.group:** `'Configuration'`
- **access:** `read: () => true, update: authenticated`

### Fields

#### `mappings`
- type: `array`
- admin.description: `'Maps alternative destination names to canonical Destinations records'`
- fields:
  - `canonical` — type: `text`, required: `true`, admin.description: `'Name used in Destinations collection'`
  - `aliases` — type: `json`, admin.description: `'JSON array of alternative names, e.g. ["Serengeti NP", "Serengeti National Park", "The Serengeti"]'`
  - `destination` — type: `relationship`, relationTo: `'destinations'`, required: `true`

---

## Task 7: Verify PropertyNameMappings

**DO NOT recreate.** Verify it exists at `src/globals/PropertyNameMappings.ts` and is already registered in `payload.config.ts`. Report its location and confirm it is registered.

---

## Task 8: Directory Structures

Create the following directory structure with TypeScript files. Each `types.ts` file must contain complete, real type and interface definitions derived from the V6 spec — not empty files. Each module file must export its function signature with proper types. No function bodies. No `// TODO` comments. No `throw new Error('Not implemented')`. Just the typed export signature.

The types.ts files are the contracts that later phases implement against. They must be thorough, correct, and useful for type checking.

### content-system/ (at repository root)

```
content-system/
├── cascade/
│   ├── entity-extractor.ts
│   ├── destination-resolver.ts
│   ├── property-resolver.ts
│   ├── relationship-manager.ts
│   ├── cascade-orchestrator.ts
│   └── types.ts
├── signals/
│   ├── itinerary-decomposer.ts
│   ├── source-monitor.ts
│   └── types.ts
├── ideation/
│   ├── candidate-generator.ts
│   ├── candidate-filter.ts
│   ├── brief-shaper.ts
│   └── types.ts
├── research/
│   ├── perplexity-client.ts
│   ├── research-compiler.ts
│   └── types.ts
├── drafting/
│   ├── article-drafter.ts
│   ├── destination-page-drafter.ts
│   ├── property-page-drafter.ts
│   ├── segment-enhancer.ts
│   ├── social-summariser.ts
│   └── types.ts
├── images/
│   ├── library-search.ts
│   ├── image-generator.ts
│   └── types.ts
├── quality/
│   ├── hard-gates.ts
│   ├── consistency-checker.ts
│   └── types.ts
├── conversation/
│   ├── handler.ts
│   ├── context-builder.ts
│   └── types.ts
├── embeddings/
│   ├── chunker.ts
│   ├── embedder.ts
│   ├── query.ts
│   └── types.ts
├── publishing/
│   ├── article-publisher.ts
│   ├── destination-page-publisher.ts
│   ├── property-page-publisher.ts
│   ├── enhancement-publisher.ts
│   ├── update-publisher.ts
│   └── types.ts
├── openrouter-client.ts
└── db.ts
```

### lambda/ content system additions

```
lambda/
├── content-cascade/
│   ├── handler.js
│   └── package.json
├── content-decompose/
│   ├── handler.js
│   └── package.json
├── content-source-monitor/
│   ├── handler.js
│   └── package.json
├── content-batch-embed/
│   ├── handler.js
│   └── package.json
└── content-shared/
    ├── payload-client.js
    └── job-tracker.js
```

**Lambda handler.js files:** Minimal valid Lambda handler structure. Export a named `handler` async function that returns a 200 JSON response with `{ status: 'not_implemented', job: 'content-cascade' }` (or appropriate job name). Include the standard Lambda event/context signature. This is a valid deployable Lambda — not a placeholder. It runs, it responds, it reports its own status.

**Lambda package.json files:** Minimal valid package.json with name, version, and main pointing to handler.js. No dependencies yet.

**content-shared/ files:** Same pattern as existing `lambda/shared/` — JS module files exporting functions. `payload-client.js` exports stub functions for CRUD operations against Payload REST API. `job-tracker.js` exports stub functions for updating ContentJob progress.

### Types file guidance

Each `types.ts` file should define the interfaces and types that its sibling module files will use. Base these on the V6 spec. For example:

- `cascade/types.ts` should define `EntityMap`, `CascadeResult`, `DestinationResolution`, `PropertyResolution`, `RelationshipVerification`
- `embeddings/types.ts` should define `ChunkType`, `ContentChunk`, `EmbeddingRecord`, `SimilarityResult`, `QueryFilter`
- `quality/types.ts` should define `HardGateResult`, `QualityViolation`, `BannedWordMatch`, `ConsistencyResult`
- `publishing/types.ts` should define `PublishResult`, `OptimisticLockError`, `CompoundWritePayload`

Use the V6 spec to determine what each module needs. These types are real, permanent, and will be imported by implementation code in later phases.

---

## Task 9: Update payload.config.ts

Add the new collections and globals to `src/payload.config.ts`.

### Imports to add

```typescript
import { ContentProjects } from './collections/ContentProjects'
import { ContentJobs } from './collections/ContentJobs'
import { SourceRegistry } from './collections/SourceRegistry'
import { EditorialDirectives } from './collections/EditorialDirectives'
import { ContentSystemSettings } from './globals/ContentSystemSettings'
import { DestinationNameMappings } from './globals/DestinationNameMappings'
```

### Registration

- Add `ContentProjects`, `ContentJobs`, `SourceRegistry`, `EditorialDirectives` to the `collections` array
- Add `ContentSystemSettings`, `DestinationNameMappings` to the `globals` array

Preserve the existing order. Add content engine collections after the existing collections. Add content engine globals after PropertyNameMappings.

---

## Task 10: Build Verification

```bash
npm run build
```

The build must pass. If it fails, fix the issue before proceeding. Do not move on with a failing build.

---

## Task 11: Generate Import Map

```bash
npx payload generate:importmap
```

This updates the Payload import map after new collections/globals are registered. Run it after the build passes.

---

## DO NOT

- Do not create API routes
- Do not create React admin components
- Do not modify existing collections (Properties, Destinations, Itineraries, Authors, Posts, Media, Pages, etc.)
- Do not add afterChange or beforeChange hooks to the new collections (except where explicitly specified)
- Do not install new npm packages
- Do not recreate PropertyNameMappings
- Do not run database migrations (Payload handles this automatically on deploy)
- Do not create .env files or modify environment variables
- Do not create test files

---

## Verification & Report

After all tasks complete, write a report to `content-engine/reports/phase1-schema-scaffold.md` containing:

### 1. Build Output
Last 30 lines of `npm run build` output.

### 2. File Manifest
Every file created or modified, with line counts.

### 3. Collection Registration Check
Output of `grep -n 'ContentProjects\|ContentJobs\|SourceRegistry\|EditorialDirectives' src/payload.config.ts`

### 4. Global Registration Check
Output of `grep -n 'ContentSystemSettings\|DestinationNameMappings' src/payload.config.ts`

### 5. PropertyNameMappings Verification
Confirm file exists and is registered.

### 6. Directory Structure Verification
Output of `find content-system -type f | sort` and `find lambda/content-* -type f | sort`

### 7. Git Status
Output of `git status`

### 8. Commit
Commit all changes:
```bash
git add -A
git commit -m "feat(content-engine): Phase 1 — schema scaffold

Collections: ContentProjects, ContentJobs, SourceRegistry, EditorialDirectives
Globals: ContentSystemSettings, DestinationNameMappings
Directories: content-system/ (TypeScript modules), lambda/content-* (JS handlers)
Versioning enabled on ContentProjects.
EditorialDirectives implemented as Collection (spec correction from Global)."
git push
```

### 9. Status Update
Update `content-engine/status.md`:
- Mark Phase 1 as COMPLETED with date
- Check off all Pre-Phase 0 remaining tasks (git clean, build verified)
- Add any decisions or issues encountered

---

## Success Criteria

Phase 1 is complete when ALL of the following are true:

1. `npm run build` passes with zero errors
2. ContentProjects collection exists with all 12 tabs and every field from V6 spec Section 11.2
3. ContentJobs collection exists with all fields from V6 spec Section 11.3
4. SourceRegistry collection exists with all fields from V6 spec Section 11.4
5. EditorialDirectives collection exists with all fields from V6 spec Section 11.5 (as Collection, not Global)
6. ContentSystemSettings global exists with all fields from V6 spec Section 11.6
7. DestinationNameMappings global exists with all fields from V6 spec Section 11.7
8. PropertyNameMappings global verified existing and registered
9. All new collections and globals registered in payload.config.ts
10. content-system/ directory exists with all subdirectories and typed files
11. lambda/content-*/ directories exist with handler.js and package.json
12. Git state is clean with all changes committed and pushed
13. Import map regenerated
