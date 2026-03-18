# generate-destination-content.ts

**Auto-generation script for destination and property content projects.**

This script identifies destinations and properties with minimal or missing content and creates Content Engine projects to trigger the full content pipeline (research → drafting → review).

---

## Overview

The Kiuli scraper cascade creates skeleton records for destinations and properties with minimal data. This script:

1. **Queries** all destinations (countries + child destinations) and properties in the database
2. **Identifies** entities with empty or minimal description content
3. **Creates** Content Projects with:
   - `contentType: "destination_page"` (for destinations) or `"property_page"` (for properties)
   - HNWI-targeted briefs and angles
   - `stage: "idea"` (not auto-published)
   - `originPathway: "cascade"` (for tracking)
4. **Triggers** research pipeline asynchronously (Perplexity-backed research compilation)
5. **Triggers** drafting pipeline asynchronously (multi-section content generation)
6. **Leaves as drafts** for travel designer review, quality checking, and image assignment

No content is published automatically. All projects land in the designer workspace for approval.

---

## Usage

### Basic Run
```bash
npx tsx scripts/generate-destination-content.ts
```

### Dry Run (Preview Only)
```bash
npx tsx scripts/generate-destination-content.ts --dry-run
```

No projects or workflows are created in dry-run mode. Useful for previewing what would be generated.

### Filter by Type
```bash
# Only countries
npx tsx scripts/generate-destination-content.ts --type=country

# Only child destinations
npx tsx scripts/generate-destination-content.ts --type=destination

# Only properties
npx tsx scripts/generate-destination-content.ts --type=property

# All (default)
npx tsx scripts/generate-destination-content.ts --type=all
```

### Combine Flags
```bash
# Preview property content generation
npx tsx scripts/generate-destination-content.ts --type=property --dry-run
```

---

## How It Works

### Content Detection

An entity is considered to have **minimal content** if:

**For Destinations:**
- No `description` field, OR
- `description` is empty or has fewer than 2 meaningful text nodes in the Lexical structure, OR
- All text content is less than 20 characters

**For Properties:**
- `description_reviewed`, `description_enhanced`, and `description_itrvl` are all empty or minimal

### Content Project Creation

Each entity without sufficient content becomes a ContentProject with:

**Destinations:**
- `contentType: "destination_page"`
- `briefSummary`: "Create a comprehensive HNWI-focused destination page..."
- `targetAngle`: "Luxury safari enthusiasts, conservationists, and HNWI travelers"

**Properties:**
- `contentType: "property_page"`
- `briefSummary`: "Create a rich, HNWI-focused property page..."
- `targetAngle`: "High-net-worth travelers seeking luxury and exclusivity"

### Research Queries

The script does NOT directly trigger research. Instead, it creates projects and relies on fire-and-forget HTTP calls to `/api/content/research`. The research endpoint will:

**For Destinations:**
- "What makes [destination] special for luxury safari travelers?"
- "Best time to visit [destination]..."
- "Conservation status and exclusive access..."
- "...luxury lodges and camps..."
- "...costs and investment expectations..."

**For Properties:**
- "What sets [property] apart from other luxury lodges?"
- "[property] luxury accommodations and amenities..."
- "[property] conservation initiatives..."
- "[property] seasonal access and costs..."

### Drafting Pipeline

After research, the drafting endpoint creates multi-section content:

**Destinations:**
- Overview
- When to Visit
- Why Choose This Destination
- Key Experiences
- Getting There
- Health & Safety
- Investment Expectations
- Top Lodges
- FAQ

**Properties:**
- Overview
- The Experience
- Amenities & Rooms
- Activities & Experiences
- Conservation & Impact
- Booking & Investment
- FAQ

---

## Authentication

The script requires:

```bash
export CONTENT_SYSTEM_SECRET="your-secret"
```

This is read from the environment and used as a Bearer token for API calls to `/api/content/research` and `/api/content/draft`.

Without it, the script will fail immediately.

---

## Output

### Console Output

```
══════════════════════════════════════════════════════════════════════════
  KIULI DESTINATION CONTENT AUTO-GENERATOR
══════════════════════════════════════════════════════════════════════════

Options:
  --dry-run: disabled
  --type: all

Step 1: Fetching entities with minimal content...
Found 47 total entities

23 entities need content:
  • Serengeti National Park
  • Masai Mara
  • Angama Mara (in Kenya)
  • ...

Step 2: Creating content projects...
  ✓ Created (ID: 1045) | Serengeti National Park
  ✓ Created (ID: 1046) | Masai Mara
  ✓ Created (ID: 1047) | Angama Mara (in Kenya)
  ⊘ Skipped (exists) | Amboseli National Park
  ✗ Error: CONTENT_SYSTEM_SECRET not set | Lake Nakuru

══════════════════════════════════════════════════════════════════════════
SUMMARY
══════════════════════════════════════════════════════════════════════════
Created:  22
Skipped:  0
Errors:   1
Total:    23

Failed entities:
  ✗ Lake Nakuru: CONTENT_SYSTEM_SECRET not set
```

### Exit Codes

- `0`: All projects created/skipped successfully (no errors)
- `1`: One or more entities failed to create

---

## What Happens Next

### In the Designer Workspace

1. **New projects appear** in the Content Engine dashboard at `stage: "idea"`
2. **Research starts immediately** (async) — Perplexity queries run, findings compiled
3. **Drafting starts immediately** (async) — Claude generates multi-section content
4. **Designers review** draft content before publishing

### For Image Assignment

After drafting, travel designers can:
1. Visit the project in the workspace
2. Assign best-fit media from the media library
3. Review and refine drafted content
4. Move to `stage: "review"` or `"published"`

No images are auto-assigned by this script — that remains a designer responsibility.

---

## Integration with Cascade

This script is **complementary** to the itinerary cascade system:

- **Cascade** creates destinations/properties when an itinerary is published
- **Cascade** creates ContentProjects for those entities
- **This script** runs manually to backfill content for older destinations/properties that don't have it

Both pathways create projects with `originPathway: 'cascade'` for tracking.

---

## Development Notes

### Content Detection Strategy

The `hasContent()` function inspects Payload's Lexical RichText structure:

```typescript
{
  "root": {
    "children": [
      {
        "type": "paragraph",
        "children": [
          {
            "type": "text",
            "text": "..."
          }
        ]
      }
    ]
  }
}
```

An entity with fewer than 3 children nodes is considered "minimal" because Payload often creates default empty structures with 1-2 nodes.

### Fire-and-Forget Research/Drafting

The script makes **non-blocking HTTP calls** to:
- `/api/content/research` (POST with projectId)
- `/api/content/draft` (POST with projectId)

These endpoints handle authentication and run asynchronously. The script doesn't wait for them to complete — it just kicks them off.

If you need to track progress, check the ContentProject's `processingStatus` field in the admin panel.

### Why Not Trigger from Script Directly?

The script could import and call the research/drafting modules directly, but HTTP calls are preferred because:

1. **Isolation** — Keeps the script thin and testable
2. **Error handling** — Failures in research/drafting don't crash the script
3. **Observability** — Log entry points match the `/api/` routes
4. **Future flexibility** — Allows scaling research/drafting to separate workers

---

## Troubleshooting

### "CONTENT_SYSTEM_SECRET not set"

```bash
export CONTENT_SYSTEM_SECRET="your-secret-here"
npx tsx scripts/generate-destination-content.ts
```

### "Entity needs content but project creation failed"

Check:
1. Is the database reachable?
2. Is `PAYLOAD_API_KEY` set in `.env`?
3. Are you running against the correct Payload database?

### "Research or drafting didn't trigger"

Check:
1. `/api/content/research` endpoint exists and is accessible
2. `/api/content/draft` endpoint exists and is accessible
3. Look at the project's `processingStatus` field in the admin panel
4. Check Vercel logs for errors in those endpoints

### "Some entities were skipped as 'already exist'"

This means a ContentProject already exists for that entity (possibly from a previous cascade). The script will not duplicate.

To force regeneration, delete the existing project and re-run.

---

## Examples

### Full Run (Create All Needed Projects)
```bash
export CONTENT_SYSTEM_SECRET="$(grep CONTENT_SYSTEM_SECRET .env | cut -d= -f2)"
npx tsx scripts/generate-destination-content.ts
```

### Preview What Would Be Created
```bash
npx tsx scripts/generate-destination-content.ts --dry-run --type=destination
```

### Only Process Properties
```bash
npx tsx scripts/generate-destination-content.ts --type=property
```

### Check How Many Need Content (Without Creating)
```bash
npx tsx scripts/generate-destination-content.ts --dry-run --type=all 2>&1 | grep "entities need content"
```

---

## See Also

- `/src/collections/ContentProjects/` — ContentProject schema and admin UI
- `/content-system/cascade/cascade-orchestrator.ts` — Cascade pipeline that also creates projects
- `/src/app/(payload)/api/content/research/route.ts` — Research endpoint
- `/src/app/(payload)/api/content/draft/route.ts` — Drafting endpoint
- `/content-system/drafting/destination-page-drafter.ts` — Destination page drafting logic
- `/content-system/drafting/property-page-drafter.ts` — Property page drafting logic
