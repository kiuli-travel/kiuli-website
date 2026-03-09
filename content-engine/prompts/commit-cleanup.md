# Commit: Evidence, Prompts, and Gitignore Cleanup

Three tasks. Execute in order.

---

## Task 1 — Add __pycache__ to .gitignore

`tools/mcp-server/__pycache__/` is showing as untracked. `__pycache__` is not in `.gitignore`. Add it.

```bash
echo "__pycache__/" >> .gitignore
git diff .gitignore
echo "GITIGNORE EXIT: $?"
```

Confirm the diff shows `__pycache__/` was appended. Then confirm `__pycache__` is no longer shown as untracked:

```bash
git status --short | grep pycache
echo "PYCACHE CHECK EXIT: $?"
```

Expected: no output (grep finds nothing). If `__pycache__` still appears, stop and report.

---

## Task 2 — Commit evidence, prompts, and .gitignore

Stage and commit all remaining untracked files:

```bash
git add \
  .gitignore \
  content-engine/evidence/commit-video-picker.txt \
  content-engine/evidence/hero-video-picker-build.txt \
  content-engine/evidence/hero-video-picker-gates.txt \
  content-engine/evidence/hero-video-picker-investigation.txt \
  content-engine/prompts/commit-video-picker.md \
  content-engine/prompts/fix-hero-video-picker.md
git commit -m "chore: add hero video picker evidence, prompts, and pycache gitignore"
git push origin main 2>&1
echo "COMMIT EXIT: $?"
```

---

## Task 3 — Verify clean working tree

```bash
git status > content-engine/evidence/final-clean-state.txt
git log --oneline -4 >> content-engine/evidence/final-clean-state.txt
echo "FINAL EXIT: $?" >> content-engine/evidence/final-clean-state.txt
cat content-engine/evidence/final-clean-state.txt
```

Required: `git status` shows `nothing to commit, working tree clean`. No untracked files except `.gitignore`-excluded items.

Show the raw `COMMIT EXIT` value and the full contents of `final-clean-state.txt`.

---

## Rules

- Do not proceed past a non-zero exit code.
- Do not commit `tools/mcp-server/__pycache__/` — it must be excluded by .gitignore before staging.
- `final-clean-state.txt` itself will be untracked after Task 3 — that is expected and acceptable.
