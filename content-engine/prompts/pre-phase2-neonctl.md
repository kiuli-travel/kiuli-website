# Pre-Phase 2: Verify neonctl Access

**Date:** 2026-02-11
**Author:** Claude.ai (Strategic)
**Executor:** Claude CLI (Tactical)

---

## Context

Phase 2 requires creating a Neon dev branch to safely test pgvector setup before applying to production. Before writing the Phase 2 prompt, we need to confirm neonctl is installed and can reach the Kiuli Neon project.

---

## Tasks

### 1. Check neonctl is installed

```bash
which neonctl && neonctl --version
```

If not installed, install it:

```bash
npm install -g neonctl
```

### 2. List Neon projects

```bash
neonctl projects list --output json
```

This should return JSON showing the Kiuli Neon project. If it requires authentication, report what auth method is needed (API key, browser OAuth, etc.) and stop.

### 3. List branches on the project

```bash
neonctl branches list --output json
```

This confirms we can interact with branches — required for Phase 2's dev branch workflow.

---

## Report

Write results to `content-engine/reports/pre-phase2-neonctl.md`:

- neonctl version
- Project list output (redact connection strings)
- Branch list output
- Whether `neonctl branches create` would work (based on permissions observed)
- Any auth issues encountered

Do NOT create or delete any branches. Read-only operations only.
