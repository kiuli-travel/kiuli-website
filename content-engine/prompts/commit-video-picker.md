# Commit: Hero Video Picker and MCP Audit Files

Two commits are required. Execute them in order. Do not combine them.

---

## Commit 1 — Hero video picker fix

Stage and commit only the two files changed by the video picker fix:

```bash
git add src/components/admin/VideoSelectionModal.tsx "src/app/(payload)/admin/itinerary-editor/[id]/page.tsx"
git commit -m "fix(editor): implement hero video picker, heroVideoId state tracking"
git push origin main 2>&1
echo "COMMIT1 EXIT: $?"
```

---

## Commit 2 — MCP server audit files

Stage and commit the untracked MCP files that have been sitting in the working tree:

```bash
git add \
  MCP_AUDIT_FINDINGS.md \
  MCP_AUDIT_REPORT.md \
  MCP_FASTMCP_UPGRADE_REPORT.md \
  MCP_OAUTH_CONNECTION_FAILURE_REPORT.md \
  MCP_UPGRADE_REPORT.md \
  tools/mcp-server/MCP_SERVER_REFERENCE.md \
  tools/mcp-server/oauth_provider.py \
  tools/mcp-server/server.py
git commit -m "chore(mcp): MCP server audit reports and oauth provider"
git push origin main 2>&1
echo "COMMIT2 EXIT: $?"
```

---

## Verification

After both commits, confirm git state is clean:

```bash
git status > content-engine/evidence/commit-video-picker.txt
git log --oneline -3 >> content-engine/evidence/commit-video-picker.txt
echo "GIT STATUS EXIT: $?" >> content-engine/evidence/commit-video-picker.txt
cat content-engine/evidence/commit-video-picker.txt
```

Show the raw output of both `COMMIT1 EXIT` and `COMMIT2 EXIT` lines.

---

## Rules

- Both exit codes must be 0. If either push fails, report the full error output and stop.
- git status after both commits must show a clean working tree with no untracked or modified files remaining (other than files excluded by .gitignore).
- Do not proceed past a non-zero exit code.
