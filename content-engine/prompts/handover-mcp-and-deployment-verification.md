# Handover: MCP Verification + Lambda Deployment Analysis

**For:** New Claude.ai conversation (Kiuli project)
**From:** Current Claude session (cannot access new MCP tools — connected before server restart)
**Date:** 2026-02-23

---

## What This Conversation Must Do

Two things, in order:

1. Confirm the new MCP tools (`lambda_status`, `lambda_logs`) are working
2. Analyse the result of CLI's first proper Lambda deployment and confirm
   the M2 + round 1 + round 2 bug fixes are actually running in AWS

---

## Background You Need

The Kiuli project has a Lambda scraper pipeline (5 functions in AWS eu-north-1)
that transforms iTrvl travel itineraries into Payload CMS content. Until today,
there was no proper deployment process — code changes were committed to git but
never reliably deployed to AWS. Every "fix confirmed" in previous sessions was
confirming source code on disk, not running code in AWS.

Today we built:
- `lambda/scripts/deploy.sh` — canonical deploy script that stamps a git hash
  into the Lambda Description field for verification
- `lambda/scripts/verify.sh` — check deployed state without deploying
- Two new MCP tools added to `tools/mcp-server/server.mjs`:
  - `lambda_status` — reads deployed git hash from AWS, compares to HEAD
  - `lambda_logs` — tails CloudWatch logs for a specific Lambda, with filter
- `lambda/DEPLOYMENT.md` — canonical deployment documentation (replaces all
  previous deployment docs)

CLI was given `content-engine/prompts/first-proper-deployment.md` to execute.
That prompt covers: making scripts executable, restarting MCP server, deploying
the orchestrator Lambda, clearing the database, running a test scrape, and
verifying with CloudWatch logs.

The code changes that should now be deployed include:
- M2: TransferRoute observations with itineraryId (pendingTransferObs pattern)
- M2: Activities multi-property linking
- M2: createdThisRun Set for backfill guard
- Round 1 Bug 5: helicopter in transferTypes
- Round 2 Bug A: helicopter in mapSegmentToBlock blockType condition
- Round 2 Bug B: activity observationCount dedup via observedInItineraries

---

## Task 1: Confirm new MCP tools are working

In this new conversation you should have access to `lambda_status` and
`lambda_logs` via the Kiuli Files MCP (after CLI restarted the server).

Call `lambda_status` with function="all".

Expected response structure:
```json
{
  "currentHead": "<7-char hash>",
  "currentCommit": "<hash> <commit message>",
  "allCurrent": true/false,
  "syncStatus": {
    "scraper": "CURRENT / BEHIND / NO_HASH_STAMPED",
    "orchestrator": "CURRENT / BEHIND / ...",
    ...
  },
  "functions": { ... }
}
```

If `lambda_status` is not available, the MCP server was not restarted or did
not pick up the new tools. In that case:
- Check `tools/mcp-server/server.mjs` to confirm the tools are defined in the file
- Report that the tools are not available and state why
- Do NOT proceed to Task 2 — the deployment cannot be verified without them

---

## Task 2: Verify the orchestrator deployment

If `lambda_status` works, check:

**2a. Is the orchestrator current?**
`syncStatus.orchestrator` must be `"CURRENT"`. If it shows BEHIND or NO_HASH_STAMPED,
the deployment either did not run or failed. Check CLI's report.

**2b. Read CLI's deployment report**
CLI should have written a report to `content-engine/reports/`. Look for a file
created today mentioning "first-proper-deployment" or "deployment".

Read it and check all items against the report format specified in
`content-engine/prompts/first-proper-deployment.md`.

**2c. Check CloudWatch for the 4 required signatures**

Call `lambda_logs` four times with these filters:

1. `function="orchestrator"`, `since="2h"`, `filter="TransferRoute obs saved"`
2. `function="orchestrator"`, `since="2h"`, `filter="Activity obs recorded"`
3. `function="orchestrator"`, `since="2h"`, `filter="Updated accumulatedData"`
4. `function="orchestrator"`, `since="2h"`, `filter="ItineraryPattern"`

Each must return `lineCount > 0`. These log messages only exist in the new code.
If any return 0 lines, that code path did not execute.

---

## Task 3: Verify database state

Use `db_query` to confirm knowledge base records were created correctly:

```sql
-- Transfer routes with observations
SELECT slug, "observationCount"
FROM transfer_routes
WHERE "observationCount" > 0
ORDER BY "observationCount" DESC
LIMIT 10;
```

```sql
-- Activities with observation count
SELECT name, "observationCount"
FROM activities
WHERE "observationCount" > 0
ORDER BY "observationCount" DESC
LIMIT 10;
```

```sql
-- Properties created
SELECT name, slug
FROM properties
ORDER BY "createdAt" DESC
LIMIT 15;
```

```sql
-- Itinerary patterns
SELECT "totalNights", "priceTier", "paxType", "travelMonth"
FROM itinerary_patterns
LIMIT 5;
```

Expected for 1 test itinerary (Tanzania):
- Transfer routes with observations: > 0
- Activities with observationCount > 0: > 0
- Properties: ~5-8 (number of unique accommodations in the Tanzania itinerary)
- Itinerary patterns: 1

---

## Task 4: Report

Produce a summary in this format:

```
MCP + DEPLOYMENT VERIFICATION REPORT
=====================================

MCP TOOLS
  lambda_status available: YES / NO
  lambda_logs available: YES / NO

DEPLOYMENT STATUS
  orchestrator syncStatus: CURRENT / BEHIND / NO_HASH_STAMPED / ERROR
  Deployed git hash: [hash]
  Current HEAD: [hash]

CLOUDWATCH VERIFICATION
  TransferRoute obs saved: FOUND (N lines) / NOT FOUND
  Activity obs recorded: FOUND (N lines) / NOT FOUND
  Updated accumulatedData: FOUND (N lines) / NOT FOUND
  ItineraryPattern: FOUND (N lines) / NOT FOUND

DATABASE STATE
  Transfer routes with observations: [n]
  Activities with observationCount > 0: [n]
  Properties: [n]
  Itinerary patterns: [n]

VERDICT
  Code in git == code running in AWS: YES / NO
  Knowledge base populating correctly: YES / NO

BLOCKERS
[Anything that failed, with exact error]
```

---

## What Comes Next (After This Conversation)

If all checks pass:
- Delete the test itinerary and re-scrape all 6 test URLs from
  `content-engine/prompts/deploy-and-rescrape.md` using mode: "create"
- The system is then ready for production scraping of 75-100 itineraries

If checks fail:
- Report exact failures back so the appropriate fix can be designed
- Do not proceed to production scraping with unverified code
