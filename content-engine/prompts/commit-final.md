# Commit: Final Cleanup Prompt and Evidence

```bash
git add \
  content-engine/evidence/final-clean-state.txt \
  content-engine/prompts/commit-cleanup.md
git commit -m "chore: add final clean state evidence and commit-cleanup prompt"
git push origin main 2>&1
echo "EXIT: $?"
git status --short
```

Required: `EXIT: 0` and `git status --short` shows no output (clean working tree).
