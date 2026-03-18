# Content Auto-Generation Integration Guide

This guide explains how `generate-destination-content.ts` fits into the broader Kiuli content pipeline and when/how to use it.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTENT CREATION PATHWAYS                                      │
└─────────────────────────────────────────────────────────────────┘

PATHWAY 1: Itinerary → Cascade → ContentProject (Automatic)
────────────────────────────────────────────────────────────
  Designer publishes itinerary
      ↓
  Itinerary hooks trigger cascade
      ↓
  Cascade extracts entities (countries, destinations, properties)
      ↓
  Cascade creates/updates entities in collections
      ↓
  Cascade Step 5: generates ContentProjects for new entities
      ↓
  ContentProject stage='idea' lands in designer workspace
      ↓
  Designer manually triggers research, drafting, review

PATHWAY 2: Backfill → generate-destination-content.ts (Manual)
──────────────────────────────────────────────────────────────
  Designer runs: npx tsx scripts/generate-destination-content.ts
      ↓
  Script finds all entities with minimal/empty content
      ↓
  Script creates ContentProjects (same as Cascade)
      ↓
  Script auto-triggers research + drafting endpoints
      ↓
  Projects appear in designer workspace (ready for review)
      ↓
  Designer approves, refines, publishes
```

---

## When to Use This Script

### Use When:
- You have destinations or properties that were **created before content system existed**
- A scraper run created skeleton records that **never got researched/drafted**
- You want to **bulk-backfill** content for many entities at once
- The **cascade** created destination records but the content never got generated

### Don't Use When:
- An itinerary was just published (cascade already creates the project)
- A destination already has a ContentProject in progress
- You want to **replace** existing content (edit the project instead)

---

## Setup

### Prerequisites

1. **Environment variables** are configured:
   ```bash
   export CONTENT_SYSTEM_SECRET="your-secret-from-.env"
   export NEXT_PUBLIC_SERVER_URL="https://kiuli.com"  # or local dev URL
   ```

2. **Content Engine endpoints** are running:
   - `/api/content/research` — accepts POST with projectId
   - `/api/content/draft` — accepts POST with projectId

3. **Payload CMS** is accessible (database must be live)

---

## Usage Workflow

### Step 1: Preview What Would Be Generated

```bash
npx tsx scripts/generate-destination-content.ts --dry-run --type=destination
```

Output tells you:
- How many destinations need content
- Which ones
- No changes are made

### Step 2: Review Specific Type (Optional)

```bash
# Just properties
npx tsx scripts/generate-destination-content.ts --dry-run --type=property

# Just countries (rarely needed, but available)
npx tsx scripts/generate-destination-content.ts --dry-run --type=country
```

### Step 3: Create Projects

Once you're confident, remove `--dry-run`:

```bash
npx tsx scripts/generate-destination-content.ts
```

This:
- Creates ContentProject records
- Triggers research endpoint (non-blocking)
- Triggers drafting endpoint (non-blocking)
- Prints created/skipped/error counts

### Step 4: Monitor Progress

Navigate to **Admin → Content Engine → Projects** and look for:

- **Status**: `stage: "idea"` (new projects)
- **Processing**: Watch `processingStatus` change from `processing` → `completed` or `failed`
- **Research**: Look in `research` tab for findings
- **Draft**: Check `sections` tab for generated content

---

## Integration with Existing Systems

### Content Projects
- Script creates projects with `originPathway: 'cascade'` (same as real cascade)
- Projects use same schema as cascade-generated projects
- All projects are `stage: 'idea'` (not auto-published)

### Cascade System
- The cascade and this script **never conflict** because:
  - Cascade only runs when an itinerary is published
  - Script only creates projects for entities without one
  - If a project already exists, script skips it
- Both systems feed the same designer workflow

### Research & Drafting
- Script triggers endpoints, not modules directly
- Research runs async (Perplexity compilation)
- Drafting runs async (multi-section Claude generation)
- Same quality gates, consistency checks apply

### Designer Workflow
- Projects appear in workspace at `stage: 'idea'`
- Designers review research findings
- Designers review draft sections
- Designers assign images, refine content
- Designers move to `stage: 'review'` → `'published'` when ready

---

## Example Scenarios

### Scenario 1: Backfill Properties After Scraper Run

```bash
# Check what needs content
npx tsx scripts/generate-destination-content.ts --dry-run --type=property

# Output:
# Found 47 total entities
# 23 entities need content

# Create projects
npx tsx scripts/generate-destination-content.ts --type=property

# Output:
# ✓ Created (ID: 1234) | Angama Mara (in Kenya)
# ✓ Created (ID: 1235) | Singita Grumeti (in Tanzania)
# ...
# Created:  23
# Skipped:  0
# Errors:   0
```

**Next**: Designers open Content Engine → Projects, see 23 new property pages in research phase.

### Scenario 2: Periodic Backfill of All Destinations

```bash
# Run monthly to catch any with missing content
npx tsx scripts/generate-destination-content.ts --type=destination

# Creates projects only for destinations without meaningful description
# Projects auto-trigger research + drafting
# Designers queue them in their workflow
```

### Scenario 3: One-Off Property Update

```bash
# Create project for a single property that was added outside the cascade
npx tsx scripts/generate-destination-content.ts --type=property

# Script finds it, creates project, triggers workflows
# Designer gets notification in workspace
```

---

## Troubleshooting

### No Projects Were Created

**Check:**
1. Do entities actually need content?
   ```bash
   npx tsx scripts/generate-destination-content.ts --dry-run
   ```
   If it shows "0 entities need content", all have sufficient descriptions.

2. Is `CONTENT_SYSTEM_SECRET` set?
   ```bash
   echo $CONTENT_SYSTEM_SECRET
   ```

3. Are you running against the correct database?
   Check `.env` → `DATABASE_URL`

### Research/Drafting Didn't Start

**Check:**
1. Project was created (check admin panel)
2. Look at `processingStatus` on the project
3. Check Vercel logs for `/api/content/research` and `/api/content/draft`
4. Verify endpoints exist and are responding

### Script Created Duplicates

**Can't happen.** Script explicitly checks if a project already exists before creating.

If you see duplicates, they were created by different runs or pathways (cascade).

### Want to Reset and Rerun

```bash
# Delete the projects (admin panel)
# Re-run the script
npx tsx scripts/generate-destination-content.ts
```

New projects will be created, research/drafting will restart.

---

## Configuration

### HNWI-Targeted Research Queries

The script automatically builds research queries for different entity types:

**Destinations:**
```
What makes [destination] special for luxury safari travelers?
Best time to visit [destination] — seasonal wildlife patterns
Conservation status and exclusive access at [destination]
[destination] luxury lodges and camps
[destination] safari costs for luxury travelers
```

**Properties:**
```
What sets [property] apart from other luxury lodges?
[property] luxury accommodations and exclusive experiences
[property] conservation initiatives and impact
[property] seasonal access, cost per night, booking exclusivity
```

To customize, edit the `buildDestinationResearchQueries()` and `buildPropertyResearchQueries()` functions in the script.

### Content Detection Threshold

The script considers an entity to have "minimal content" if:

- **Destination**: Description has <3 meaningful text nodes in Lexical structure
- **Property**: All three description fields (reviewed/enhanced/itrvl) are empty

To adjust sensitivity, modify the `hasContent()` function.

---

## Performance

- **Query time**: ~1-2 seconds per 100 entities
- **Project creation**: ~0.1 seconds per project
- **API triggers**: ~0.5 seconds per API call (non-blocking)
- **Total for 50 projects**: ~10-15 seconds

The script runs synchronously but fires off async research/drafting, so designer workflow isn't blocked.

---

## Monitoring & Logging

### Console Output
- Shows each entity being created/skipped
- Final summary of created/skipped/error counts
- Useful for immediate feedback

### Payload Admin Panel
- Visit **Projects** collection
- Filter by `originPathway: 'cascade'` to see script-created projects
- Watch `processingStatus` change as research/drafting run
- Check `research` and `sections` tabs for generated content

### Vercel Logs
- `/api/content/research` and `/api/content/draft` endpoints log progress
- Check for errors in cascade-generated projects

---

## See Also

- `/scripts/generate-destination-content.ts` — The script itself
- `/scripts/GENERATE_DESTINATION_CONTENT.md` — Full documentation
- `/content-system/cascade/cascade-orchestrator.ts` — Cascade system
- `/src/collections/ContentProjects/` — ContentProject schema
- `/src/app/(payload)/api/content/research/route.ts` — Research endpoint
- `/src/app/(payload)/api/content/draft/route.ts` — Drafting endpoint
