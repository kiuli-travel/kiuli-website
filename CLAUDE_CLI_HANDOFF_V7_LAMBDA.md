# CLAUDE CLI HANDOFF: V7 Lambda Implementation

**Mission:** Implement V7 specification using Lambda architecture  
**Owner:** Graham Wallington  
**Execution Mode:** Full autonomy  
**Date:** January 21, 2026

---

## SITUATION

The Kiuli scraper has three incomplete implementations layered on top of each other:

1. **Old Vercel Sync** (Nov 2024) — Documented but timeout-prone
2. **V4 Lambda Async** (Jan 11-15) — Code exists, database incomplete, HTTP 500
3. **V7 Two-Field Pattern** (Jan 20) — Schema complete, transform logic missing

**Current State:** Pipeline broken. No working end-to-end scrape.

**Target State:** V7 specification running on Lambda architecture.

---

## YOUR MISSION

Execute these documents in order with full autonomy:

### PHASE 1: AUDIT (30 min)

**File:** `KIULI_V7_LAMBDA_AUDIT.md`

**Purpose:** Establish ground truth of current state

**Execute:**
```bash
# Run the entire audit script
bash KIULI_V7_LAMBDA_AUDIT.md
```

**Output:** `AUDIT_REPORT.md` with findings

**Report:** Structured report showing:
- Lambda deployment status
- Database schema state (V4/V7 fields)
- Vercel configuration
- Code state
- Blocking issues

**Do not proceed to Phase 2 until audit complete.**

---

### PHASE 2: IMPLEMENTATION (8-12 hours)

**File:** `KIULI_V7_LAMBDA_IMPLEMENTATION_PLAN.md`

**Purpose:** Fix database, implement V7 transform, deploy Lambda

**Execute in 3 phases:**

#### Phase 1: Foundation (2-3 hours)
- Database migration for V4 fields
- Fix media permissions (403 error)
- Verify Lambda deployment

**Gate:** All foundation issues resolved before continuing.

#### Phase 2: Transformation (4-6 hours)
- Create `lambda/pipeline-worker/phases/transform.js`
- Create `lambda/pipeline-worker/utils/richTextConverter.js`
- Update `lambda/pipeline-worker/handler.js` to use transform
- Update `lambda/pipeline-worker/phases/ingest.js` for V7 structure
- Deploy to Lambda
- Test end-to-end

**Gate:** Fresh scrape creates V7-compliant itinerary before cleanup.

#### Phase 3: Cleanup (1-2 hours)
- Delete obsolete files (see KIULI_FILE_CLEANUP_CHECKLIST.md)
- Create KIULI_LAMBDA_ARCHITECTURE.md
- Update CLAUDE.md
- Update V7 specification with IMPLEMENTED status
- Commit and push

**Gate:** Documentation consolidated, git clean.

---

### PHASE 3: VERIFICATION (30 min)

**Verify SUCCESS CRITERIA:**

1. Fresh scrape succeeds:
   ```bash
   curl -X POST "https://admin.kiuli.com/api/scrape-itinerary" \
     -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
     -d '{"itrvlUrl": "https://itrvl.com/client/portal/Op4IPe4KvCsHC7QuCxjWLQEa0JlM5eVGE0vAGUD9yRnUmAIwpwstlE85upkxlfTJ/680dfc35819f37005c255a29"}'
   ```
   Returns: `{"success": true, "jobId": "..."}`

2. V7 fields verified:
   ```bash
   # Get latest itinerary
   curl "https://admin.kiuli.com/api/itineraries?sort=-createdAt&limit=1" \
     -H "Authorization: Bearer cafGjXq0BOR3sH8zgxoFxcGLzZGyZeOxHoxrM9dyRM0=" \
     | python3 -c "
   import sys, json
   d = json.load(sys.stdin)['docs'][0]
   print('✓ titleItrvl:', 'PRESENT' if d.get('titleItrvl') else 'MISSING')
   print('✓ titleEnhanced:', 'NULL' if d.get('titleEnhanced') is None else 'NOT NULL')
   print('✓ titleReviewed:', d.get('titleReviewed') == False)
   print('✓ Days:', len(d.get('days', [])))
   print('✓ Day 0 titleItrvl:', 'PRESENT' if d.get('days',[{}])[0].get('titleItrvl') else 'MISSING')
   "
   ```

3. Data gaps fixed:
   - Day titles generated (not NULL for activity-only days)
   - Stay inclusions populated
   - Transfer.to extracted
   - investmentLevel.includes populated

4. Git clean:
   ```bash
   git status
   # Should show: nothing to commit, working tree clean
   ```

5. Documentation complete:
   - KIULI_LAMBDA_ARCHITECTURE.md exists
   - CLAUDE.md updated
   - Obsolete files deleted

---

## REPORTING

After each phase, report:

```
PHASE [X]: [NAME] — COMPLETE ✓

Time: [duration]

Changes:
- [list of changes made]

Verification:
- [list of tests passed]

Blockers (if any):
- [list of issues]

Status: READY FOR NEXT PHASE / BLOCKED
```

---

## FINAL DELIVERABLE

**File:** `V7_IMPLEMENTATION_COMPLETE.md`

```markdown
# V7 Lambda Implementation — COMPLETE ✓

**Date:** [DATE]
**Duration:** [total hours]
**Implemented By:** Claude CLI

## What Was Built

### Database
- V4 fields added: itineraryId, price, job progress tracking
- V7 fields verified: All two-field patterns working
- Media permissions: Fixed (403 resolved)

### Lambda
- transform.js: V7 transformation with all data gap fixes
- handler.js: Updated to use V7 transform
- ingest.js: Updated to use V7 structure
- Deployed: kiuli-pipeline-worker (eu-north-1)

### Verification
- Fresh scrape: SUCCESS
- V7 fields: VERIFIED
- Data gaps: FIXED
- Job tracking: WORKING

## What Was Cleaned Up

### Deleted Files
- pipelines/run_full_pipeline.cjs
- processors/
- loaders/
- validation_scripts/
- Obsolete documentation (11 files)

### Updated Files
- CLAUDE.md (Lambda architecture)
- KIULI_SCRAPER_V7_DEFINITIVE_SPECIFICATION.md (IMPLEMENTED status)

### Created Files
- KIULI_LAMBDA_ARCHITECTURE.md (single source of truth)

## Verification Evidence

[Paste curl outputs showing V7 fields working]

## Next Steps

1. Manual UI testing (Phase G tasks 2-5, 7)
2. Front-end development can begin
3. Content team can start reviewing itineraries

## Architecture Now

```
User → Vercel (/api/scrape-itinerary)
         ↓
    AWS Lambda (kiuli-pipeline-worker)
      ↓
    Phases 1-7 (scrape, transform, media, ingest)
      ↓
    Payload CMS (V7 structure)
      ↓
    Poll /api/job-status for progress
```

## Documentation Hierarchy

1. **CLAUDE.md** — Project instructions, debugging
2. **KIULI_LAMBDA_ARCHITECTURE.md** — How it works
3. **KIULI_SCRAPER_V7_DEFINITIVE_SPECIFICATION.md** — What it should do

No conflicting docs. No confusion.
```

---

## CRITICAL REMINDERS

1. **Do not guess.** If audit shows unexpected state, report and wait.
2. **No shortcuts.** Follow implementation plan exactly.
3. **Test at gates.** Do not proceed past a gate until tests pass.
4. **Commit frequently.** After each successful phase.
5. **Report blockers.** If stuck, stop and report the issue.

---

## AUTONOMY BOUNDARIES

**You have full autonomy to:**
- Run audit script
- Execute implementation plan
- Create/modify Lambda code
- Run database migrations
- Deploy to Lambda
- Delete obsolete files per checklist
- Update documentation
- Test and verify
- Commit and push

**You must report and wait for:**
- Unexpected audit findings requiring strategy change
- Persistent errors after troubleshooting attempts
- Database migration failures
- Lambda deployment failures
- End-to-end test failures

---

## START HERE

```bash
cd /Users/grahamwallington/Projects/kiuli-website

# Step 1: Run audit
# Execute KIULI_V7_LAMBDA_AUDIT.md script

# Step 2: Review findings
# Generate AUDIT_REPORT.md

# Step 3: Begin implementation
# Follow KIULI_V7_LAMBDA_IMPLEMENTATION_PLAN.md

# Step 4: Clean up
# Follow KIULI_FILE_CLEANUP_CHECKLIST.md

# Step 5: Verify
# Run success criteria checks

# Step 6: Document
# Create V7_IMPLEMENTATION_COMPLETE.md
```

---

**Expected completion:** One long session (8-12 hours) or split across 2-3 sessions with clear checkpoints.

**Result:** V7 specification running on Lambda. Clean codebase. Consolidated documentation. No confusion.

---

*"Slow is smooth, smooth is fast. No compromises. Evidence required."*
