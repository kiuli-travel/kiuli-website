ROUND 2 BUG FIX REPORT
Date: 2026-02-23T07:50:00Z

Bug A — Helicopter visibility: FIXED
  - 'helicopter' in mapSegmentToBlock blockType condition: YES
  - transferType = 'helicopter' mapping present: YES

Bug B — Activity observationCount dedup: FIXED
  - observedInItineraries field added to Activities.ts: YES
  - Migration generated and applied: YES (20260223_074555, 100ms, activities_rels table created)
  - observationCount removed from inline PATCH in linkActivities(): YES
  - pendingActivityObs collected across all 3 paths: YES
  - Activity obs block in handler.js with dedup check: YES

Syntax: PASS
Build: PASS
GIT: Committed f1305b2

BLOCKERS
None. Both bugs fixed. All 13 code review checks passed.
