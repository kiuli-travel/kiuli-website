# Payload CMS Collections Reference

Documentation for all Payload CMS collections in Kiuli.

## Overview

Kiuli uses 12 Payload CMS collections to manage content:

| Collection | Purpose | Key Features |
|------------|---------|--------------|
| `itineraries` | Safari trip content | V7 two-field pattern, days/segments |
| `itinerary-jobs` | Pipeline job tracking | Progress, phases, counters |
| `media` | Images and videos | AI labeling, deduplication |
| `image-statuses` | Per-image processing | Context preservation |
| `pages` | Static CMS pages | Blocks layout |
| `posts` | Blog articles | Author relationships |
| `users` | Admin access | Role-based |
| `categories` | Content tags | Taxonomy |
| `destinations` | Location taxonomy | Country/region/park |
| `trip-types` | Trip categorization | Honeymoon, family, etc. |
| `voice-configuration` | AI tone settings | Enhancement voice |
| `notifications` | Admin alerts | Job status updates |

---

## Itineraries

**Slug:** `itineraries`
**Purpose:** Safari itineraries imported from iTrvl with V7 two-field content pattern.

### Access Control
- **Read:** Authenticated users OR API key
- **Create:** API key only (prevents admin UI creation)
- **Update:** Authenticated users OR API key
- **Delete:** Authenticated users only

### Key Fields

#### Basic Info
| Field | Type | Description |
|-------|------|-------------|
| `title` | text | Display title (V7 pattern) |
| `titleItrvl` | text | Original from iTrvl (read-only) |
| `titleEnhanced` | text | AI-improved version |
| `titleReviewed` | checkbox | Review completion |
| `slug` | text | URL slug (unique, indexed) |
| `itineraryId` | text | iTrvl ID for deduplication |

#### SEO (V7 Pattern)
| Field | Type | Description |
|-------|------|-------------|
| `metaTitle` | text | SEO title (max 60 chars) |
| `metaTitleItrvl` / `metaTitleEnhanced` / `metaTitleReviewed` | | V7 pattern |
| `metaDescription` | textarea | SEO description (max 160 chars) |
| `metaDescriptionItrvl` / `metaDescriptionEnhanced` / `metaDescriptionReviewed` | | V7 pattern |

#### Hero Media
| Field | Type | Description |
|-------|------|-------------|
| `heroImage` | relationship→media | Primary hero image |
| `heroImageLocked` | checkbox | Prevent auto-replacement |
| `heroImageReviewed` | checkbox | Review completion |
| `heroVideo` | relationship→media | Hero video (filter: video) |
| `heroVideoLocked` | checkbox | Prevent auto-replacement |
| `showHeroVideo` | checkbox | Display video on frontend |

#### Categorization
| Field | Type | Description |
|-------|------|-------------|
| `destinations` | relationship→destinations | Countries/regions/parks (hasMany) |
| `tripTypes` | relationship→trip-types | Trip categories (hasMany) |

#### Overview Group
| Field | Type | Description |
|-------|------|-------------|
| `overview.summaryItrvl` | richText | Original summary (read-only) |
| `overview.summaryEnhanced` | richText | AI-improved summary |
| `overview.summaryReviewed` | checkbox | Review completion |
| `overview.nights` | number | Total nights |
| `overview.countries` | array | Country list |
| `overview.highlights` | array | Key experiences |

#### Investment Level Group
| Field | Type | Description |
|-------|------|-------------|
| `investmentLevel.fromPrice` | number | Starting price (USD) |
| `investmentLevel.toPrice` | number | Max price (optional) |
| `investmentLevel.currency` | text | Currency code |
| `investmentLevel.includesItrvl` / `includesEnhanced` / `includesReviewed` | | What's included (V7 pattern) |

#### Days Array
Each day contains:
| Field | Type | Description |
|-------|------|-------------|
| `dayNumber` | number | Day sequence |
| `date` | date | Specific date (optional) |
| `title` | text | Day title (V7 pattern) |
| `location` | text | Day location |
| `segments` | blocks | Stay/Activity/Transfer blocks |

#### Segment Blocks
**Stay Block:**
- `accommodationName` (V7 pattern)
- `description` (V7 pattern, richText)
- `nights`, `location`, `country`
- `images` (relationship→media, hasMany)
- `inclusions` (V7 pattern, richText)
- `roomType`

**Activity Block:**
- `title` (V7 pattern)
- `description` (V7 pattern, richText)
- `images` (relationship→media, hasMany)

**Transfer Block:**
- `type` (select: flight/road/boat/entry/exit/point)
- `title` (V7 pattern)
- `from`, `to`
- `description` (V7 pattern, richText)
- `departureTime`, `arrivalTime`

#### FAQ Items Array
| Field | Type | Description |
|-------|------|-------------|
| `question` | text | FAQ question (V7 pattern) |
| `answer` | richText | FAQ answer (V7 pattern) |
| `reviewed` | checkbox | Review completion |

#### Publishing
| Field | Type | Description |
|-------|------|-------------|
| `publishChecklist.*` | checkboxes | Pre-publish checks |
| `publishBlockers` | array | Issues blocking publication |
| `_status` | select | draft/published (via versions) |

#### Schema (JSON-LD)
| Field | Type | Description |
|-------|------|-------------|
| `schema` | json | Product schema (auto-generated) |
| `schemaStatus` | select | pass/warn/fail |

### Hooks
- `beforeChange`: Calculates publish checklist, validates publish
- `afterRead`: Resolves V7 fields (shows Enhanced if exists, else Itrvl)

---

## Itinerary Jobs

**Slug:** `itinerary-jobs`
**Purpose:** Tracks Lambda pipeline execution for each import.

### Key Fields

#### Input
| Field | Type | Description |
|-------|------|-------------|
| `itrvlUrl` | text | Full iTrvl portal URL |
| `itineraryId` | text | Extracted from URL (auto) |
| `accessKey` | text | Extracted from URL (auto) |

#### Status
| Field | Type | Description |
|-------|------|-------------|
| `status` | select | pending/processing/completed/failed |
| `currentPhase` | text | Current pipeline phase |
| `progress` | number | 0-100 percentage |
| `version` | number | Pipeline run version |
| `previousVersions` | array | History of previous runs |

#### Counters
| Field | Type | Description |
|-------|------|-------------|
| `totalImages` | number | Images to process |
| `processedImages` | number | Successfully processed |
| `skippedImages` | number | Skipped (duplicates) |
| `failedImages` | number | Failed to process |
| `imagesLabeled` | number | AI-labeled count |
| `totalVideos` | number | Videos to process |
| `videoProcessingError` | text | Video error message |

#### Timing
| Field | Type | Description |
|-------|------|-------------|
| `startedAt` | date | Processing start time |
| `completedAt` | date | Completion time |
| `duration` | number | Total seconds |
| `phase1CompletedAt` - `phase5CompletedAt` | date | Phase timestamps |
| `estimatedTimeRemaining` | number | Estimated seconds |

#### Results
| Field | Type | Description |
|-------|------|-------------|
| `processedItinerary` | relationship→itineraries | Created itinerary |
| `payloadId` | text | Payload entry ID |
| `errorMessage` | textarea | Error details |
| `errorPhase` | text | Phase where error occurred |

### Hooks
- `beforeChange`: Auto-extracts itineraryId/accessKey from URL
- `beforeDelete`: Validates safe deletion

---

## Media

**Slug:** `media`
**Purpose:** Images and videos with AI-generated labels and deduplication.

### Access Control
- **Read:** Anyone (public images)
- **Create/Update:** Authenticated OR API key
- **Delete:** Authenticated only

### Key Fields

#### Deduplication
| Field | Type | Description |
|-------|------|-------------|
| `sourceS3Key` | text | iTrvl S3 key (unique, indexed) - CRITICAL for global dedup |

#### Type & Status
| Field | Type | Description |
|-------|------|-------------|
| `mediaType` | select | image/video |
| `videoContext` | select | hero/background/gallery (videos only) |
| `processingStatus` | select | pending/processing/complete/failed |
| `labelingStatus` | select | pending/processing/complete/failed/skipped |

#### URLs
| Field | Type | Description |
|-------|------|-------------|
| `url` | text | Display URL |
| `imgixUrl` | text | Optimized CDN URL |
| `originalS3Key` | text | Our S3 path |
| `sourceUrl` | text | Original iTrvl URL |

#### Source Context (from scrape)
| Field | Type | Description |
|-------|------|-------------|
| `sourceItinerary` | text | Origin itinerary ID |
| `sourceProperty` | text | Lodge/property name |
| `sourceSegmentType` | select | stay/activity/transfer |
| `sourceSegmentTitle` | text | Segment title |
| `sourceDayIndex` | number | Day number |

#### AI Labels (Enrichment)
| Field | Type | Description |
|-------|------|-------------|
| `scene` | text | Scene description |
| `mood` | select (multi) | serene/adventurous/romantic/etc |
| `timeOfDay` | select | dawn/morning/golden-hour/etc |
| `setting` | select (multi) | lodge-interior/savanna/etc |
| `composition` | select | hero/establishing/detail/etc |
| `animals` | json | Detected animals array |
| `tags` | json | Searchable tags array |
| `altText` | text | AI-generated alt text |
| `isHero` | checkbox | Suitable for hero banner |
| `quality` | select | high/medium/low |
| `imageType` | select | wildlife/landscape/accommodation/etc |
| `suitableFor` | select (multi) | hero-banner/gallery/social/etc |

### Upload Config
- **Allowed:** image/*, video/mp4, video/webm, video/quicktime
- **Image Sizes:** thumbnail (300w), square (500x500), small (600w), medium (900w), large (1400w), xlarge (1920w), og (1200x630)
- **Focal Point:** Enabled

---

## Image Statuses

**Slug:** `image-statuses`
**Purpose:** Per-image tracking during pipeline processing with context preservation.

### Key Fields
| Field | Type | Description |
|-------|------|-------------|
| `job` | relationship→itinerary-jobs | Parent job |
| `sourceS3Key` | text | iTrvl S3 key |
| `status` | select | pending/processing/complete/skipped/failed |
| `mediaType` | select | image/video |
| `mediaId` | text | Created media ID |
| `error` | text | Error message |

#### Source Context
| Field | Type | Description |
|-------|------|-------------|
| `propertyName` | text | Lodge/property name |
| `segmentType` | text | stay/activity/transfer |
| `segmentTitle` | text | Segment title |
| `dayIndex` | number | Day number |
| `segmentIndex` | number | Segment position |
| `country` | text | Country name |

This context is used by:
1. AI labeler for better label accuracy
2. Finalizer to link images to correct segments

---

## Voice Configuration

**Slug:** `voice-configuration`
**Purpose:** AI tone settings for content enhancement.

### Key Fields
| Field | Type | Description |
|-------|------|-------------|
| `name` | text | Voice name (e.g., "Kiuli Brand Voice") |
| `description` | textarea | Voice description |
| `tone` | text | Tone descriptors |
| `guidelines` | richText | Detailed enhancement guidelines |
| `fieldType` | select | Which field type this voice is for |

Used by the `/api/enhance` endpoint to control AI content generation.

---

## Other Collections

### Pages
Standard Payload CMS pages with block-based layout.
- `title`, `slug`, `hero`, `content` (blocks array)
- Used for static pages like About, Contact, etc.

### Posts
Blog articles with author relationships.
- `title`, `slug`, `content`, `authors`, `categories`
- Full-text search enabled

### Users
Admin user accounts.
- `email`, `password`, `role` (admin/editor)
- Authentication via Payload

### Destinations
Location taxonomy.
- `name`, `type` (country/region/park), `parent`
- Hierarchical structure

### Trip Types
Trip categorization.
- `name`, `description`, `slug`
- E.g., Honeymoon, Family, Migration, Gorilla Trekking

### Categories
General content tags.
- `name`, `slug`
- Used across posts and other content

### Notifications
Admin notification system.
- `type` (success/error/warning/info)
- `message`, `read`, `job`, `itinerary`
- Auto-created by pipeline

---

## Collection Relationships

```
itinerary-jobs ──┬── itineraries (processedItinerary)
                 └── posts (relatedArticles)

itineraries ────┬── media (heroImage, heroVideo, images, videos)
                ├── destinations (hasMany)
                └── trip-types (hasMany)

image-statuses ─── itinerary-jobs (job)

media ─────────── itineraries (usedInItineraries, hasMany)

notifications ──┬── itinerary-jobs (job)
                └── itineraries (itinerary)

posts ──────────── categories (hasMany)
```

---

## See Also

- [V7_TWO_FIELD_PATTERN.md](./V7_TWO_FIELD_PATTERN.md) - Content versioning pattern
- [API_REFERENCE.md](./API_REFERENCE.md) - API documentation
- [KIULI_LAMBDA_ARCHITECTURE.md](../KIULI_LAMBDA_ARCHITECTURE.md) - Pipeline details
