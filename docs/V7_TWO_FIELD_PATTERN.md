# V7 Two-Field Pattern

Documentation for the content versioning pattern used throughout Kiuli's itinerary content.

## Overview

The V7 Two-Field Pattern preserves original scraped content while enabling AI enhancement. Every text field that can be enhanced has three components:

| Component | Naming | Purpose |
|-----------|--------|---------|
| **Original** | `*Itrvl` | Scraped from iTrvl (read-only) |
| **Enhanced** | `*Enhanced` | AI-improved version (editable) |
| **Reviewed** | `*Reviewed` | Boolean marking review complete |

## Why This Pattern?

1. **Content Preservation** - Original iTrvl content is never lost
2. **Safe Enhancement** - AI can improve without overwriting originals
3. **Review Workflow** - Clear tracking of what's been reviewed
4. **Rollback Support** - Can always revert to original if needed
5. **Comparison** - Side-by-side viewing for quality control

---

## Fields Using This Pattern

### Top-Level Fields

| Display Field | Original Field | Enhanced Field | Reviewed Field |
|---------------|----------------|----------------|----------------|
| `title` | `titleItrvl` | `titleEnhanced` | `titleReviewed` |
| `metaTitle` | `metaTitleItrvl` | `metaTitleEnhanced` | `metaTitleReviewed` |
| `metaDescription` | `metaDescriptionItrvl` | `metaDescriptionEnhanced` | `metaDescriptionReviewed` |
| `whyKiuli` | `whyKiuliItrvl` | `whyKiuliEnhanced` | `whyKiuliReviewed` |

### Overview Group

| Display Field | Original Field | Enhanced Field | Reviewed Field |
|---------------|----------------|----------------|----------------|
| `overview.summary` | `overview.summaryItrvl` | `overview.summaryEnhanced` | `overview.summaryReviewed` |

### Investment Level Group

| Display Field | Original Field | Enhanced Field | Reviewed Field |
|---------------|----------------|----------------|----------------|
| `investmentLevel.includes` | `investmentLevel.includesItrvl` | `investmentLevel.includesEnhanced` | `investmentLevel.includesReviewed` |

### Days Array

Each day has:
| Display Field | Original Field | Enhanced Field | Reviewed Field |
|---------------|----------------|----------------|----------------|
| `days[n].title` | `days[n].titleItrvl` | `days[n].titleEnhanced` | `days[n].titleReviewed` |

### Segment Blocks

**Stay Segments:**
| Display Field | Original Field | Enhanced Field | Reviewed Field |
|---------------|----------------|----------------|----------------|
| `accommodationName` | `accommodationNameItrvl` | `accommodationNameEnhanced` | `accommodationNameReviewed` |
| `description` | `descriptionItrvl` | `descriptionEnhanced` | `descriptionReviewed` |
| `inclusions` | `inclusionsItrvl` | `inclusionsEnhanced` | `inclusionsReviewed` |

**Activity Segments:**
| Display Field | Original Field | Enhanced Field | Reviewed Field |
|---------------|----------------|----------------|----------------|
| `title` | `titleItrvl` | `titleEnhanced` | `titleReviewed` |
| `description` | `descriptionItrvl` | `descriptionEnhanced` | `descriptionReviewed` |

**Transfer Segments:**
| Display Field | Original Field | Enhanced Field | Reviewed Field |
|---------------|----------------|----------------|----------------|
| `title` | `titleItrvl` | `titleEnhanced` | `titleReviewed` |
| `description` | `descriptionItrvl` | `descriptionEnhanced` | `descriptionReviewed` |

### FAQ Items

| Display Field | Original Field | Enhanced Field | Reviewed Field |
|---------------|----------------|----------------|----------------|
| `faqItems[n].question` | `faqItems[n].questionItrvl` | `faqItems[n].questionEnhanced` | `faqItems[n].questionReviewed` |
| `faqItems[n].answer` | `faqItems[n].answerItrvl` | `faqItems[n].answerEnhanced` | `faqItems[n].answerReviewed` |

---

## Field Resolution Logic

The `afterRead` hook resolves which value to display:

```typescript
// Simplified resolution logic
function resolveField(itrvlValue, enhancedValue) {
  // Enhanced takes priority if it exists
  if (enhancedValue && enhancedValue !== '') {
    return enhancedValue;
  }
  // Fall back to original
  return itrvlValue;
}
```

**Resolution Priority:**
1. `*Enhanced` field (if populated)
2. `*Itrvl` field (fallback)

The resolved value is exposed as the "display" field (e.g., `title` shows `titleEnhanced` or `titleItrvl`).

---

## Admin UI Components

### FieldPairEditor

The `FieldPairEditor` component renders V7 fields in the admin UI:

```
┌─────────────────────────────────────────────────────────┐
│ Title                                                    │
├─────────────────────────────────────────────────────────┤
│ Original (iTrvl):                                       │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Luxury Safari Adventure                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Enhanced:                              [✨ Enhance]     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Discover Africa's Hidden Wilderness                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ☑ Reviewed                                              │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Read-only display of original content
- Editable enhanced field
- One-click AI enhancement button
- Review checkbox for tracking

### EnhanceButton

Triggers AI enhancement via `/api/enhance`:

```typescript
// Request
POST /api/enhance
{
  "itineraryId": "123",
  "fieldPath": "overview.summary",
  "voiceConfig": { ... }
}

// Response
{
  "success": true,
  "enhanced": "Your luxurious journey begins...",
  "fieldPath": "overview.summaryEnhanced"
}
```

---

## Data Flow

### 1. Import (Scraper → Payload)

```
iTrvl Portal
    │
    ▼
Scraper Lambda
    │
    ▼
┌──────────────────────────┐
│ titleItrvl: "Safari..."  │
│ titleEnhanced: null      │  ← Empty enhanced fields
│ titleReviewed: false     │
└──────────────────────────┘
```

### 2. Enhancement (Admin → AI → Payload)

```
Admin clicks "Enhance"
    │
    ▼
/api/enhance
    │
    ▼
Claude 3.5 Sonnet
    │
    ▼
┌──────────────────────────┐
│ titleItrvl: "Safari..."  │
│ titleEnhanced: "Discover…"│  ← AI-populated
│ titleReviewed: false     │
└──────────────────────────┘
```

### 3. Review (Admin marks complete)

```
Admin reviews and checks box
    │
    ▼
┌──────────────────────────┐
│ titleItrvl: "Safari..."  │
│ titleEnhanced: "Discover…"│
│ titleReviewed: true      │  ← Marked reviewed
└──────────────────────────┘
```

### 4. Display (Frontend reads)

```
Frontend requests itinerary
    │
    ▼
afterRead hook resolves
    │
    ▼
┌──────────────────────────┐
│ title: "Discover…"       │  ← Enhanced value displayed
└──────────────────────────┘
```

---

## Review Workflow

### States

| State | Itrvl | Enhanced | Reviewed | Display |
|-------|-------|----------|----------|---------|
| **Imported** | "Original" | null | false | "Original" |
| **Enhanced** | "Original" | "Improved" | false | "Improved" |
| **Reviewed** | "Original" | "Improved" | true | "Improved" |
| **Rejected** | "Original" | null/edited | false | varies |

### Publish Checklist

The publish checklist tracks V7 field review status:

```typescript
publishChecklist: {
  titleReviewed: boolean,
  metaTitleReviewed: boolean,
  metaDescriptionReviewed: boolean,
  heroImageReviewed: boolean,
  overviewReviewed: boolean,
  // ... etc
}
```

All checklist items must be `true` before publishing.

---

## RichText Fields

Some V7 fields use Lexical RichText instead of plain text:

- `overview.summary`
- `whyKiuli`
- `investmentLevel.includes`
- Segment `description` fields
- FAQ `answer` fields

**RichText Structure:**
```json
{
  "root": {
    "type": "root",
    "children": [
      {
        "type": "paragraph",
        "children": [
          { "type": "text", "text": "Content here..." }
        ]
      }
    ]
  }
}
```

The AI enhancement endpoint handles RichText conversion automatically.

---

## API Access

### Reading V7 Fields

```bash
# Get itinerary with all V7 fields
curl https://admin.kiuli.com/api/itineraries/123 \
  -H "Authorization: Bearer $PAYLOAD_API_KEY"
```

Response includes:
- `title` - Resolved display value
- `titleItrvl` - Original value
- `titleEnhanced` - Enhanced value
- `titleReviewed` - Review status

### Updating Enhanced Fields

```bash
# Update enhanced title
curl -X PATCH https://admin.kiuli.com/api/itineraries/123 \
  -H "Authorization: Bearer $PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "titleEnhanced": "New enhanced title",
    "titleReviewed": true
  }'
```

**Important:** Never update `*Itrvl` fields via API - they're source-of-truth from scraping.

---

## Best Practices

### DO:
- Always enhance via the UI or `/api/enhance` endpoint
- Mark fields as reviewed after manual verification
- Check all reviews before publishing
- Use Voice Configuration to maintain brand consistency

### DON'T:
- Directly modify `*Itrvl` fields
- Skip the review step for published content
- Publish with unreviewed enhanced content
- Overwrite enhanced content without checking original

---

## Troubleshooting

### Enhanced content not showing

1. Check `*Enhanced` field is populated
2. Verify `afterRead` hook is running
3. Check for null vs empty string

### Enhancement fails

1. Check `/api/enhance` response
2. Verify Gemini API key is set
3. Check Voice Configuration exists

### Review status lost

1. Check field path in request
2. Verify the correct `*Reviewed` field
3. Check for hook interference

---

## See Also

- [COLLECTIONS.md](./COLLECTIONS.md) - Full collection schema reference
- [API_REFERENCE.md](./API_REFERENCE.md) - `/api/enhance` endpoint documentation
- [ADMIN_COMPONENTS.md](./ADMIN_COMPONENTS.md) - FieldPairEditor component details
