M2 BUG FIX REPORT
Date: 2026-02-23T00:15:00Z

Bug 1 — TransferRoute itineraryId: FIXED
  - pendingTransferObs returned from linkTransferRoutes: YES
  - Observation block in handler.js writes itineraryId: YES
  - Dedup check on route observation: YES

Bug 2 — Activity multi-property linking: FIXED
  - Else branch present: YES
  - activityPropertyLinks prevents redundant PATCHes: YES

Bug 3 — Backfill guard: FIXED
  - createdThisRun Set used: YES

Bug 4 — Conflict retry observation loss: FIXED
  - Resolved by Bug 1 restructure: YES (all 3 paths push to pendingTransferObs)

Bug 5 — Helicopter: FIXED
  - 'helicopter' in transferTypes Set: YES
  - Mode mapping present: YES

Bug 6 — Duplicate accumulatedData: FIXED
  - Dedup check by itineraryId: YES
  - Both observation and commonPairings skipped on duplicate: YES

Syntax checks: PASS
Build: PASS
GIT: Committed 885c9c3

BLOCKERS
None. All 6 bugs fixed. All 14 code review checks passed.
