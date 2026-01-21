# KIULI V7 LAMBDA IMPLEMENTATION PLAN

**Purpose:** Implement V7 specification using Lambda architecture  
**Prerequisites:** AUDIT_REPORT.md completed  
**Owner:** Graham Wallington  
**Date:** January 21, 2026

---

## OVERVIEW

This plan implements the V7 two-field editorial pattern in the Lambda pipeline architecture. It is structured in three phases:

1. **FOUNDATION** — Fix database schema and Lambda deployment
2. **TRANSFORMATION** — Implement V7 transform logic in Lambda
3. **CLEANUP** — Delete obsolete files and consolidate documentation

**Total Estimated Time:** 8-12 hours across multiple sessions

---

## PHASE 1: FOUNDATION (2-3 hours)

### 1.1 Database Migration for V4 Fields

**Required if audit shows:** V4 fields (itineraryId, price, job progress fields) are MISSING

**Action:**
```bash
cd /Users/grahamwallington/Projects/kiuli-website

# Generate migration
npx payload migrate:create add_v4_fields

# Edit the generated migration to add:
# - itineraries.itinerary_id (text, unique, indexed)
# - itineraries.price (integer)
# - itineraries.price_formatted (text)
# - itinerary_jobs.progress (integer)
# - itinerary_jobs.total_images (integer)
# - itinerary_jobs.processed_images (integer)
# - itinerary_jobs.skipped_images (integer)
# - itinerary_jobs.failed_images (integer)
# - itinerary_jobs.error_phase (text)
# - itinerary_jobs.failed_at (timestamp)

# Run migration
npx payload migrate

# Verify
curl -s "https://admin.kiuli.com/api/itineraries?limit=1" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  | python3 -c "import sys,json; d=json.load(sys.stdin)['docs'][0]; print('itineraryId:', 'itineraryId' in d, '| price:', 'price' in d)"
```

**Acceptance:**
- [ ] V4 fields present in database
- [ ] No errors when querying itineraries
- [ ] Existing data preserved

### 1.2 Fix Media Creation Permissions

**Required if audit shows:** Media creation returns 403 or 401

**Diagnosis:**
```bash
# Check current media access rules
cat src/collections/Media.ts | grep -A 20 "access:"

# Check API key permissions
curl -s "https://admin.kiuli.com/api/users/me" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  | python3 -c "import sys,json; print(json.load(sys.stdin))"
```

**Likely Fix:**
Update `src/collections/Media.ts` access rules:

```typescript
access: {
  read: () => true,
  create: ({ req }) => {
    // Allow API key creation
    if (req.headers.authorization?.startsWith('Bearer ')) {
      return true;
    }
    // Allow authenticated users
    return !!req.user;
  },
  update: ({ req }) => !!req.user,
  delete: ({ req }) => !!req.user,
},
```

**Alternative Fix:**
If API key lacks permissions, regenerate:
```bash
# In Payload admin UI: Settings > API Keys
# Create new key with full Media collection access
# Update Lambda environment variable
```

**Acceptance:**
- [ ] Media creation via API succeeds
- [ ] Test upload completes without 403/401
- [ ] Lambda can create media records

### 1.3 Verify Lambda Deployment

**Action:**
```bash
# Check Lambda is deployed and current
aws lambda get-function \
  --function-name kiuli-pipeline-worker \
  --region eu-north-1 \
  --query 'Configuration.[FunctionName,Runtime,Timeout,LastModified]' \
  --output table

# Check Lambda URL exists
aws lambda get-function-url-config \
  --function-name kiuli-pipeline-worker \
  --region eu-north-1 \
  --query 'FunctionUrl' \
  --output text

# Verify Vercel has Lambda env vars
vercel env ls | grep LAMBDA
```

**If Lambda not deployed or outdated:**
```bash
cd lambda/pipeline-worker
npm install
zip -r function.zip .

aws lambda update-function-code \
  --function-name kiuli-pipeline-worker \
  --zip-file fileb://function.zip \
  --region eu-north-1
```

**Acceptance:**
- [ ] Lambda exists and is accessible
- [ ] Lambda URL configured
- [ ] Vercel has LAMBDA_PIPELINE_URL and LAMBDA_INVOKE_SECRET

---

## PHASE 2: TRANSFORMATION (4-6 hours)

### 2.1 Create V7 Transform Module

**Location:** `lambda/pipeline-worker/phases/transform.js`

**Purpose:** Transform raw iTrvl data into V7 two-field pattern structure

**Implementation:**

```javascript
// lambda/pipeline-worker/phases/transform.js

/**
 * V7 Transform Module
 * 
 * Transforms raw iTrvl data into V7 two-field pattern:
 * - All *Itrvl fields populated from source
 * - All *Enhanced fields set to null
 * - All *Reviewed flags set to false
 */

const { convertToRichText } = require('../utils/richTextConverter');

/**
 * Transform raw itinerary to V7 structure
 */
async function transformToV7(rawData) {
  const transformed = {
    // Root level fields
    titleItrvl: rawData.title || 'Untitled Safari',
    titleEnhanced: null,
    titleReviewed: false,
    
    metaTitleItrvl: rawData.title || '',
    metaTitleEnhanced: null,
    metaTitleReviewed: false,
    
    metaDescriptionItrvl: generateMetaDescription(rawData),
    metaDescriptionEnhanced: null,
    metaDescriptionReviewed: false,
    
    whyKiuliItrvl: convertToRichText(generateWhyKiuli(rawData)),
    whyKiuliEnhanced: null,
    whyKiuliReviewed: false,
    
    // Overview
    overview: {
      summaryItrvl: convertToRichText(rawData.presentation?.overview || ''),
      summaryEnhanced: null,
      summaryReviewed: false,
      duration: rawData.duration || 0,
      countries: extractCountries(rawData),
      highlights: extractHighlights(rawData),
    },
    
    // Investment Level
    investmentLevel: {
      fromPrice: rawData.price || 0,
      toPrice: null,
      currency: rawData.currency || 'USD',
      includesItrvl: convertToRichText(generateInclusions(rawData)),
      includesEnhanced: null,
      includesReviewed: false,
      notIncluded: null,
    },
    
    // Days with segments
    days: transformDays(rawData),
    
    // FAQs
    faqItems: transformFaqs(rawData),
    
    // Status
    _status: 'draft',
  };
  
  return transformed;
}

/**
 * Transform days array with V7 pattern
 */
function transformDays(rawData) {
  if (!rawData.presentation?.days) return [];
  
  return rawData.presentation.days.map((day, index) => {
    // Generate day title (C.1: Day title generation)
    const dayTitle = generateDayTitle(day, index);
    
    return {
      dayNumber: index + 1,
      titleItrvl: dayTitle,
      titleEnhanced: null,
      titleReviewed: false,
      
      segments: transformSegments(day.segments || []),
    };
  });
}

/**
 * Generate day title with priority: Stay name > Activity title > Location > Fallback
 */
function generateDayTitle(day, index) {
  const segments = day.segments || [];
  
  // Priority 1: Stay accommodation name
  const stay = segments.find(s => s.type === 'accommodation');
  if (stay?.accommodationName) {
    return stay.accommodationName;
  }
  
  // Priority 2: First activity title
  const activity = segments.find(s => s.type === 'activity');
  if (activity?.title) {
    return activity.title;
  }
  
  // Priority 3: Location from any segment
  const location = day.location || segments[0]?.location;
  if (location) {
    return `Day ${index + 1}: ${location}`;
  }
  
  // Fallback
  return `Day ${index + 1}`;
}

/**
 * Transform segments with V7 pattern and typed blocks
 */
function transformSegments(rawSegments) {
  if (!rawSegments) return [];
  
  return rawSegments
    .map(seg => transformSegment(seg))
    .filter(seg => seg !== null);
}

/**
 * Transform individual segment to typed block
 */
function transformSegment(raw) {
  const blockType = mapSegmentType(raw.type);
  
  if (!blockType) return null; // Skip unknown types
  
  const base = {
    blockType,
    id: raw.id || generateId(),
  };
  
  if (blockType === 'stay') {
    return {
      ...base,
      accommodationNameItrvl: raw.accommodationName || 'Unnamed Accommodation',
      accommodationNameEnhanced: null,
      accommodationNameReviewed: false,
      
      descriptionItrvl: convertToRichText(raw.description || ''),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      
      // C.2: Stay inclusions mapping
      inclusionsItrvl: convertToRichText(mapInclusions(raw)),
      inclusionsEnhanced: null,
      inclusionsReviewed: false,
      
      images: [], // Populated later by media processor
      imagesReviewed: false,
    };
  }
  
  if (blockType === 'activity') {
    return {
      ...base,
      titleItrvl: raw.title || 'Activity',
      titleEnhanced: null,
      titleReviewed: false,
      
      descriptionItrvl: convertToRichText(raw.description || ''),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      
      images: [],
      imagesReviewed: false,
    };
  }
  
  if (blockType === 'transfer') {
    // C.3: Transfer.to extraction
    const transferTo = extractTransferTo(raw.title || '');
    
    return {
      ...base,
      titleItrvl: raw.title || 'Transfer',
      titleEnhanced: null,
      titleReviewed: false,
      
      descriptionItrvl: convertToRichText(raw.description || ''),
      descriptionEnhanced: null,
      descriptionReviewed: false,
      
      from: raw.from || null,
      to: transferTo,
      transportType: raw.transportType || null,
    };
  }
  
  return null;
}

/**
 * Map iTrvl segment type to Kiuli block type
 */
function mapSegmentType(type) {
  const mapping = {
    'accommodation': 'stay',
    'activity': 'activity',
    'transfer': 'transfer',
    'entry': 'transfer', // Entry points treated as transfers
    'exit': 'transfer',  // Exit points treated as transfers
    'point': 'transfer', // Waypoints treated as transfers
  };
  
  return mapping[type] || null;
}

/**
 * C.2: Map clientIncludeExclude to inclusions
 */
function mapInclusions(stay) {
  if (!stay.clientIncludeExclude) return '';
  
  const includes = stay.clientIncludeExclude
    .filter(item => item.included === true)
    .map(item => item.name)
    .join('\n');
    
  return includes || '';
}

/**
 * C.3: Extract transfer destination from title
 */
function extractTransferTo(title) {
  // Pattern: "Transfer from X to Y"
  const toMatch = title.match(/\bto\s+([^,]+)/i);
  if (toMatch) return toMatch[1].trim();
  
  // Pattern: "Drive to X"
  const driveMatch = title.match(/drive\s+to\s+([^,]+)/i);
  if (driveMatch) return driveMatch[1].trim();
  
  // Pattern: "Flight to X"
  const flightMatch = title.match(/flight\s+to\s+([^,]+)/i);
  if (flightMatch) return flightMatch[1].trim();
  
  return null;
}

/**
 * C.4: Generate investmentLevel.includes from all stay inclusions
 */
function generateInclusions(rawData) {
  if (!rawData.presentation?.days) return '';
  
  const allInclusions = new Set();
  
  rawData.presentation.days.forEach(day => {
    day.segments?.forEach(seg => {
      if (seg.type === 'accommodation' && seg.clientIncludeExclude) {
        seg.clientIncludeExclude
          .filter(item => item.included === true)
          .forEach(item => allInclusions.add(item.name));
      }
    });
  });
  
  return Array.from(allInclusions).join('\n');
}

/**
 * Transform FAQs with V7 pattern
 */
function transformFaqs(rawData) {
  const faqs = rawData.presentation?.faqs || [];
  
  return faqs.map(faq => ({
    questionItrvl: faq.question || '',
    questionEnhanced: null,
    questionReviewed: false,
    
    answerItrvl: convertToRichText(faq.answer || ''),
    answerEnhanced: null,
    answerReviewed: false,
  }));
}

/**
 * Helper functions
 */
function generateMetaDescription(rawData) {
  const title = rawData.title || 'Safari';
  const duration = rawData.duration || 'multi-day';
  return `Experience ${title}, a ${duration} luxury African safari with Kiuli Travel.`;
}

function generateWhyKiuli(rawData) {
  return `This itinerary has been carefully designed by Kiuli's expert travel designers to deliver an exceptional African safari experience.`;
}

function extractCountries(rawData) {
  const countries = new Set();
  rawData.presentation?.days?.forEach(day => {
    if (day.country) countries.add(day.country);
  });
  return Array.from(countries).map(c => ({ country: c }));
}

function extractHighlights(rawData) {
  // Extract from overview or first few activities
  const highlights = [];
  rawData.presentation?.days?.slice(0, 3).forEach(day => {
    day.segments?.filter(s => s.type === 'activity').forEach(activity => {
      if (activity.title && highlights.length < 5) {
        highlights.push({ highlight: activity.title });
      }
    });
  });
  return highlights;
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

module.exports = {
  transformToV7,
};
```

**Also create utility:**

```javascript
// lambda/pipeline-worker/utils/richTextConverter.js

/**
 * Convert plain text or HTML to Payload RichText format
 */
function convertToRichText(text) {
  if (!text) return null;
  
  // If already rich text, return as-is
  if (typeof text === 'object' && text.root) {
    return text;
  }
  
  // Convert string to simple rich text
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: String(text),
            },
          ],
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  };
}

module.exports = { convertToRichText };
```

**Acceptance:**
- [ ] transform.js created with all V7 logic
- [ ] richTextConverter.js created
- [ ] All data gap fixes implemented (C.1-C.4)
- [ ] Syntax checks pass

### 2.2 Update Lambda Handler to Use Transform

**File:** `lambda/pipeline-worker/handler.js`

**Changes:**

```javascript
// Add at top
const { transformToV7 } = require('./phases/transform');

// In handler, after Phase 1 (scrape):
await tracker.startPhase('scraping');
const rawData = await scrape(itrvlUrl);
await tracker.completePhase('scraping');

// NEW: Transform to V7
await tracker.startPhase('transforming');
const v7Data = await transformToV7(rawData);
await tracker.completePhase('transforming');

// Continue with Phase 2 (deduplicate) using rawData for images
// But Phase 7 (ingest) uses v7Data
```

**Acceptance:**
- [ ] Handler calls transformToV7
- [ ] V7 data passed to ingest phase
- [ ] Syntax check passes

### 2.3 Update Ingest Phase for V7

**File:** `lambda/pipeline-worker/phases/ingest.js`

**Change payload structure:**

```javascript
// OLD (remove):
const payloadData = {
  title: title,
  rawItinerary: rawItinerary,
  enhancedItinerary: enhancedItinerary,
  schema: schema,
  faq: faqHtml,
  images: mediaIds,
};

// NEW:
const payloadData = {
  // V7 transformed data (already has *Itrvl, *Enhanced, *Reviewed)
  ...v7Data,
  
  // Add media IDs to appropriate segments
  days: v7Data.days.map((day, dayIndex) => ({
    ...day,
    segments: day.segments.map((seg, segIndex) => ({
      ...seg,
      images: imagesBySegment[`${dayIndex}_${segIndex}`] || [],
    })),
  })),
  
  // Legacy fields for reference (optional, can remove later)
  rawItinerary: rawData,
  
  // Schema and metadata
  schema: schema,
  buildTimestamp: new Date().toISOString(),
};
```

**Acceptance:**
- [ ] Ingest uses V7 structure
- [ ] Media IDs correctly assigned to segments
- [ ] No rawItinerary/enhancedItinerary fields
- [ ] Syntax check passes

### 2.4 Deploy Updated Lambda

```bash
cd lambda/pipeline-worker
npm install
zip -r function.zip .

aws lambda update-function-code \
  --function-name kiuli-pipeline-worker \
  --zip-file fileb://function.zip \
  --region eu-north-1

# Verify deployment
aws lambda get-function \
  --function-name kiuli-pipeline-worker \
  --region eu-north-1 \
  --query 'Configuration.LastModified'
```

**Acceptance:**
- [ ] Lambda updated successfully
- [ ] LastModified timestamp is recent

### 2.5 Test End-to-End

```bash
# Trigger scrape
curl -X POST "https://admin.kiuli.com/api/scrape-itinerary" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  -d '{
    "itrvlUrl": "https://itrvl.com/client/portal/Op4IPe4KvCsHC7QuCxjWLQEa0JlM5eVGE0vAGUD9yRnUmAIwpwstlE85upkxlfTJ/680dfc35819f37005c255a29"
  }'

# Should return: {"success": true, "jobId": "xxx"}

# Poll job status
JOB_ID="xxx" # from above
for i in {1..60}; do
  curl -s "https://admin.kiuli.com/api/job-status/$JOB_ID" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'{d.get(\"status\")} | {d.get(\"currentPhase\")} | {d.get(\"progress\",0)}%')
"
  sleep 10
done

# Verify V7 fields in created itinerary
curl -s "https://admin.kiuli.com/api/itineraries?sort=-createdAt&limit=1" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)['docs'][0]
print('titleItrvl:', d.get('titleItrvl'))
print('titleEnhanced:', d.get('titleEnhanced'))
print('titleReviewed:', d.get('titleReviewed'))
print('Days:', len(d.get('days', [])))
if d.get('days'):
  print('Day 0 titleItrvl:', d['days'][0].get('titleItrvl'))
  if d['days'][0].get('segments'):
    seg = d['days'][0]['segments'][0]
    print(f'Segment 0 ({seg.get(\"blockType\")}):')
    print('  descriptionItrvl:', 'PRESENT' if seg.get('descriptionItrvl') else 'MISSING')
    print('  descriptionEnhanced:', seg.get('descriptionEnhanced'))
"
```

**Acceptance:**
- [ ] Scrape completes without error
- [ ] Job reaches "completed" status
- [ ] New itinerary created with V7 fields
- [ ] All *Itrvl fields populated
- [ ] All *Enhanced fields are null
- [ ] All *Reviewed fields are false
- [ ] Days have titles
- [ ] Stay segments have inclusions
- [ ] Transfer segments have "to" field

---

## PHASE 3: CLEANUP (1-2 hours)

### 3.1 Delete Obsolete Files

**Files to DELETE:**

```bash
cd /Users/grahamwallington/Projects/kiuli-website

# Old pipeline orchestration (replaced by Lambda)
rm -rf pipelines/run_full_pipeline.cjs

# Old processors (replaced by Lambda phases)
rm -rf processors/

# Old loaders (replaced by Lambda ingest)
rm -rf loaders/

# Old scrapers (replaced by separate kiuli-scraper Lambda)
# KEEP scrapers/ if it has the working itrvl_scraper.cjs
# Otherwise, document that scraping happens in separate Lambda

# Obsolete documentation
rm -f SCRAPER_DOCUMENTATION.md  # Outdated November 2024 version
rm -f KIULI_BACKEND_INVESTIGATION.md  # Pre-V7 investigation
rm -f KIULI_SCRAPER_AUDIT_REPORT.md  # Obsolete audit

# Old validation scripts (replaced by integrated testing)
rm -rf validation_scripts/

# Old bundling code (no longer needed)
rm -rf scrapers/dist/
rm -rf pipelines/dist/

# Verify deletions
git status --short
```

**Acceptance:**
- [ ] All obsolete files deleted
- [ ] Git shows deletions
- [ ] No critical files accidentally removed

### 3.2 Update Project Documentation

**Keep and update these files:**

1. **KIULI_SCRAPER_V7_DEFINITIVE_SPECIFICATION.md**
   - Status: Keep as North Star
   - Update: Add "IMPLEMENTED" status and date
   - Add: Lambda architecture diagram

2. **CLAUDE.md**
   - Update Section 4 (Architecture) to reflect Lambda
   - Remove references to deleted files
   - Add Lambda debugging commands

3. **Create: KIULI_LAMBDA_ARCHITECTURE.md**
   - New single source of truth for how the pipeline works
   - Document all Lambda functions
   - Document environment variables
   - Document debugging procedures

**Delete:**
- SCRAPER_DOCUMENTATION.md (outdated)
- KIULI_BACKEND_INVESTIGATION.md (pre-V7)
- V4_IMPLEMENTATION_REPORT.md (incomplete, superseded)
- KIULI_SCRAPER_V6_ROADMAP.md (superseded by V7)
- KIULI_SCRAPER_V6_SPECIFICATION.md (superseded by V7)

### 3.3 Create Consolidated Lambda Architecture Doc

**File:** `KIULI_LAMBDA_ARCHITECTURE.md`

```markdown
# Kiuli Lambda Architecture

**Version:** 7.0  
**Status:** PRODUCTION  
**Last Updated:** [DATE]

## Overview

The Kiuli scraper uses an async AWS Lambda architecture to process iTrvl itineraries into structured Payload CMS content.

## Architecture Diagram

```
User → Vercel → AWS Lambda → Payload CMS
         ↓
    (returns immediately)
         ↓
    Poll /api/job-status
```

## Components

### 1. Vercel Endpoints

**POST /api/scrape-itinerary**
- Creates ItineraryJob record
- Invokes Lambda async
- Returns jobId immediately

**GET /api/job-status/[jobId]**
- Returns job progress
- Shows current phase
- Lists any errors

### 2. AWS Lambda: kiuli-pipeline-worker

**Name:** kiuli-pipeline-worker  
**Region:** eu-north-1  
**Runtime:** nodejs20.x  
**Timeout:** 900s (15 min)  
**Memory:** 1024 MB  

**Phases:**
1. Scrape (calls separate kiuli-scraper Lambda)
2. Transform (raw → V7 structure)
3. Deduplicate images
4. Process images (upload to S3, AI labeling)
5. Generate schema
6. Format FAQ
7. Ingest to Payload

**Environment Variables:**
- PAYLOAD_API_URL
- PAYLOAD_API_KEY
- GEMINI_API_KEY
- S3_BUCKET
- S3_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- LAMBDA_SCRAPER_URL
- LAMBDA_SCRAPER_SECRET

### 3. AWS Lambda: kiuli-scraper

Separate Lambda for Puppeteer scraping (requires large package size).

## V7 Data Flow

```
iTrvl URL
  → Scrape (raw data)
  → Transform (V7 structure)
    - titleItrvl populated
    - titleEnhanced = null
    - titleReviewed = false
    - (all fields follow this pattern)
  → Media processing
  → Ingest to Payload
  → Draft itinerary ready for review
```

## Debugging

### Check Lambda Status
```bash
aws lambda get-function \
  --function-name kiuli-pipeline-worker \
  --region eu-north-1
```

### View Lambda Logs
```bash
aws logs tail /aws/lambda/kiuli-pipeline-worker --follow
```

### Test Lambda Directly
```bash
aws lambda invoke \
  --function-name kiuli-pipeline-worker \
  --payload '{"jobId":"test","itrvlUrl":"..."}' \
  /tmp/response.json
```

### Deploy Lambda Updates
```bash
cd lambda/pipeline-worker
npm install
zip -r function.zip .
aws lambda update-function-code \
  --function-name kiuli-pipeline-worker \
  --zip-file fileb://function.zip \
  --region eu-north-1
```

## Collections

- **Itineraries:** V7 two-field pattern
- **ItineraryJobs:** Progress tracking
- **Media:** S3-backed with AI labels
- **VoiceConfiguration:** AI prompts
- **Destinations:** Countries/regions/parks
- **TripTypes:** Safari types for filtering

## Future Enhancements

- Image processing batching for >100 images
- Retry logic for failed phases
- Webhooks for completion notifications
```

### 3.4 Update CLAUDE.md

**Changes:**

```markdown
## 4. Architecture — Lambda-Based Pipeline

### Production Architecture

```
Vercel (Next.js)
  ├── /api/scrape-itinerary → Triggers Lambda
  ├── /api/job-status/[id] → Returns progress
  └── /api/enhance → Manual AI enhancement

AWS Lambda (kiuli-pipeline-worker)
  ├── Phase 1: Scrape
  ├── Phase 2: Transform to V7
  ├── Phase 3: Deduplicate
  ├── Phase 4: Process images
  ├── Phase 5: Generate schema
  ├── Phase 6: Format FAQ
  └── Phase 7: Ingest to Payload
```

### Key Files

| File | Purpose |
|------|---------|
| `src/app/(payload)/api/scrape-itinerary/route.ts` | Trigger endpoint |
| `src/app/(payload)/api/job-status/[jobId]/route.ts` | Progress polling |
| `lambda/pipeline-worker/handler.js` | Lambda entry point |
| `lambda/pipeline-worker/phases/transform.js` | V7 transformation |
| `src/collections/Itineraries/index.ts` | V7 schema |
| `KIULI_SCRAPER_V7_DEFINITIVE_SPECIFICATION.md` | North Star |
| `KIULI_LAMBDA_ARCHITECTURE.md` | Implementation guide |

### Debugging Commands

```bash
# Check Lambda deployment
aws lambda get-function --function-name kiuli-pipeline-worker --region eu-north-1

# View Lambda logs
aws logs tail /aws/lambda/kiuli-pipeline-worker --follow

# Trigger test scrape
curl -X POST "https://admin.kiuli.com/api/scrape-itinerary" \
  -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
  -d '{"itrvlUrl": "..."}'
```

### What NOT to Look For

These files/patterns NO LONGER EXIST:
- `pipelines/run_full_pipeline.cjs` (deleted)
- `processors/*.cjs` (deleted)
- `loaders/payload_ingester.cjs` (deleted)
- Vercel serverless execution (moved to Lambda)
- Synchronous scrape endpoint (now async)
```

### 3.5 Commit Cleanup

```bash
cd /Users/grahamwallington/Projects/kiuli-website

git add -A
git commit -m "feat(v7): complete V7 Lambda implementation

IMPLEMENTED:
- V7 two-field pattern in Lambda transform
- All data gaps fixed (C.1-C.4)
- Lambda async architecture working end-to-end

CLEANED UP:
- Deleted obsolete pipeline files (run_full_pipeline.cjs, processors/, loaders/)
- Deleted outdated documentation
- Created KIULI_LAMBDA_ARCHITECTURE.md as single source of truth
- Updated CLAUDE.md with Lambda commands

VERIFIED:
- Fresh scrape creates V7-compliant itinerary
- All *Itrvl fields populated
- All *Enhanced fields null
- All *Reviewed flags false
- Media permissions working
- Job status tracking functional"

git push origin main
```

**Acceptance:**
- [ ] All changes committed
- [ ] Clean git status
- [ ] Documentation updated
- [ ] Single source of truth established

---

## SUCCESS CRITERIA

The V7 Lambda implementation is complete when:

1. **Fresh scrape succeeds:**
   - Endpoint returns jobId immediately
   - Job completes within timeout
   - Itinerary created in Payload

2. **V7 fields correct:**
   - All *Itrvl fields populated
   - All *Enhanced fields null
   - All *Reviewed flags false

3. **Data gaps fixed:**
   - Day titles generated
   - Stay inclusions mapped
   - Transfer.to extracted
   - investmentLevel.includes populated

4. **No obsolete code:**
   - Old pipeline files deleted
   - Documentation consolidated
   - Single architecture (Lambda)

5. **Future-proof:**
   - Clear debugging commands
   - Architecture documented
   - No confusion about what's running

---

## EXECUTION ORDER

1. Run AUDIT (KIULI_V7_LAMBDA_AUDIT.md)
2. Review audit findings
3. Execute PHASE 1 (Foundation)
4. Execute PHASE 2 (Transformation)
5. Execute PHASE 3 (Cleanup)
6. Verify SUCCESS CRITERIA
7. Document completion

**Total Time:** Plan for 8-12 hours across 2-3 sessions.
