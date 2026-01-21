# KIULI PROJECT FILE CLEANUP CHECKLIST

**Purpose:** Remove obsolete files to prevent future confusion  
**Status:** Execute during Phase 3 of implementation  
**Date:** January 21, 2026

---

## FILES TO DELETE

### Obsolete Pipeline Code (Replaced by Lambda)

```bash
cd /Users/grahamwallington/Projects/kiuli-website

# Pipeline orchestration (replaced by Lambda handler.js)
rm -f pipelines/run_full_pipeline.cjs

# Processors (replaced by Lambda phases/)
rm -rf processors/

# Loaders (replaced by Lambda phases/ingest.js)
rm -rf loaders/

# Validation scripts (replaced by integration tests)
rm -rf validation_scripts/

# Old bundled outputs
rm -rf scrapers/dist/
rm -rf pipelines/dist/
rm -rf output/  # Local pipeline outputs (Lambda uses /tmp)
```

**Why:** These files implement the old Vercel serverless architecture. Lambda architecture is completely different.

### Obsolete Documentation

```bash
# Outdated architecture docs
rm -f SCRAPER_DOCUMENTATION.md  # November 2024, claims Vercel serverless
rm -f KIULI_BACKEND_INVESTIGATION.md  # Pre-V7 investigation
rm -f KIULI_SCRAPER_AUDIT_REPORT.md  # Obsolete audit

# Superseded specifications
rm -f KIULI_SCRAPER_V6_ROADMAP.md  # V7 is the standard now
rm -f KIULI_SCRAPER_V6_SPECIFICATION.md  # V7 supersedes this
rm -f V4_IMPLEMENTATION_REPORT.md  # Incomplete, V7 implementation supersedes

# Temporary investigation files (if they exist)
rm -f kiuli-investigation-phase4/*.txt
rm -f temp/*.js
```

**Why:** These create confusion about which architecture is actually running.

### Project Files to Keep

```bash
# Obsolete evolution queue (completed)
rm -f KIULI_SCRAPER_V7_EVOLUTION_QUEUE.md  # All tasks done, superseded by implementation

# Individual task files (completed)
rm -f TASK_*.md  # Individual task prompts, no longer needed
```

**Why:** These were planning documents. The work is complete and documented in the specification.

---

## FILES TO KEEP

### North Star Documentation

```
KEEP: KIULI_SCRAPER_V7_DEFINITIVE_SPECIFICATION.md
  - The North Star document
  - Update status to "IMPLEMENTED"
  - Add implementation date
```

### Project Instructions

```
KEEP: CLAUDE.md
  - Update to reflect Lambda architecture
  - Remove references to deleted files
  - Add Lambda debugging commands
```

### Reference Documentation

```
KEEP: ITRVL_SCRAPING_REFERENCE.md
  - Reference for iTrvl data structure
  - Still relevant for understanding source data
```

### Business Documentation

```
KEEP: Kiuli_Content_Strategy__Complete_Blueprint_for_Luxury_African_Safari_Success.md
KEEP: jacada_competitive_analysis.md
KEEP: The_Kiuli_Blueprint-final.docx
```

### Design Documentation

```
KEEP: KIULI_DESIGN_PRODUCTION_GUIDE.md
KEEP: KIULI_DESIGN_TOOL_ORCHESTRATION.md
KEEP: KIULI_DESIGN_MICRO_TASK_QUEUE.md
KEEP: KIULI_VERIFIED_MICRO_TASK_QUEUE.md
```

### Current Status Documentation

```
KEEP: KIULI_STATUS_JAN15.md (for historical reference)
KEEP: IMAGE_ENRICHMENT_VERIFIED.md
```

### Launch Planning

```
KEEP: KIULI_LAUNCH_ARCHITECTURE.md
KEEP: KIULI_PERFECTION_QUEUE_V5_FINAL.md
```

### New Documentation (to be created in Phase 3)

```
CREATE: KIULI_LAMBDA_ARCHITECTURE.md
  - Single source of truth for Lambda implementation
  - Replaces all previous architecture docs
```

---

## FILES TO UPDATE

### CLAUDE.md

**Section 4: Architecture**

Replace with:

```markdown
## 4. Architecture — Lambda-Based Pipeline

[Content from implementation plan]
```

**Section 5: Known Issues**

Remove:
- "5 uncommitted files" (will be resolved)
- "0 itineraries in production" (will be fixed)
- "Scrape endpoint has no authentication" (will be fixed)

Add:
- Lambda deployment checklist
- Database migration verification

### KIULI_SCRAPER_V7_DEFINITIVE_SPECIFICATION.md

**Update header:**

```markdown
**Version:** 7.0  
**Date:** January 20, 2026  
**Status:** ✅ IMPLEMENTED — Production Ready
**Implementation Date:** [DATE]
**Owner:** Graham Wallington  
```

**Add section at end:**

```markdown
## 12. IMPLEMENTATION STATUS

**Date Implemented:** [DATE]

**Architecture:** AWS Lambda (kiuli-pipeline-worker)

**Verified:**
- ✅ V7 two-field pattern working
- ✅ All data gaps fixed (C.1-C.4)
- ✅ Fresh scrape creates V7-compliant itineraries
- ✅ Media permissions resolved
- ✅ Job tracking functional
- ✅ Documentation consolidated

**Production Deployment:**
- Lambda: `kiuli-pipeline-worker` (eu-north-1)
- Endpoint: https://admin.kiuli.com/api/scrape-itinerary
- Status: https://admin.kiuli.com/api/job-status/[jobId]

**See:** KIULI_LAMBDA_ARCHITECTURE.md for implementation details
```

---

## VERIFICATION

After cleanup, verify:

```bash
# Check git status
git status --short

# Should only show:
# M  CLAUDE.md (updated)
# M  KIULI_SCRAPER_V7_DEFINITIVE_SPECIFICATION.md (updated)
# A  KIULI_LAMBDA_ARCHITECTURE.md (new)
# D  [multiple deleted files]
```

---

## COMMIT MESSAGE

```
chore: remove obsolete V4/V6 files, consolidate V7 Lambda docs

DELETED:
- pipelines/run_full_pipeline.cjs (replaced by Lambda)
- processors/ (replaced by Lambda phases)
- loaders/ (replaced by Lambda ingest)
- validation_scripts/ (replaced by integration tests)
- SCRAPER_DOCUMENTATION.md (outdated Nov 2024)
- V4_IMPLEMENTATION_REPORT.md (incomplete, superseded)
- V6 specifications (superseded by V7)
- Task files (implementation complete)

UPDATED:
- CLAUDE.md: Lambda architecture and debugging commands
- V7 spec: Added IMPLEMENTED status

CREATED:
- KIULI_LAMBDA_ARCHITECTURE.md: Single source of truth

RESULT: Clear project state, no conflicting documentation
```

---

## PREVENT FUTURE CONFUSION

After cleanup, the project will have:

1. **One architecture:** Lambda async
2. **One specification:** V7 definitive
3. **One implementation guide:** KIULI_LAMBDA_ARCHITECTURE.md
4. **Clear instructions:** CLAUDE.md updated

**No more:**
- Multiple competing specs (V4, V6, V7)
- Obsolete code (old pipeline)
- Confusing documentation (Vercel vs Lambda)
- Incomplete implementations

**Result:** Claude CLI (or any future session) can read:
1. CLAUDE.md → Understand current state
2. KIULI_LAMBDA_ARCHITECTURE.md → Understand how it works
3. KIULI_SCRAPER_V7_DEFINITIVE_SPECIFICATION.md → Understand what it should do

No confusion. No context loss.
