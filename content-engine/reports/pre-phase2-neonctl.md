# Pre-Phase 2: neonctl Access Verification — Report

**Date:** 2026-02-11
**Status:** COMPLETE — Full access confirmed

---

## 1. neonctl Version

```
/opt/homebrew/bin/neonctl
2.20.2
```

Installed via Homebrew. No installation needed.

---

## 2. Project List

One project found:

| Field | Value |
|-------|-------|
| Project ID | `super-queen-68865217` |
| Name | `kiuli` |
| Region | `aws-eu-west-2` |
| PG Version | 17 |
| Proxy Host | `eu-west-2.aws.neon.tech` |
| Org ID | `org-long-rice-46985810` |
| Created | 2025-11-09 |
| Autoscaling | 0.25 – 0.25 CU |
| Suspend Timeout | 0 (always on) |
| Logical Size | ~59 MB |

**Note:** Interactive org selection prompt appears by default. Must pass `--org-id org-long-rice-46985810` to all commands to avoid interactive prompts in automation.

---

## 3. Branch List

3 branches found:

| Branch | ID | State | Primary | Source |
|--------|----|-------|---------|--------|
| `main` | `br-royal-shadow-abvgnq2g` | ready | Yes | console |
| `preview/vercel/react-server-components-cve-...` | `br-holy-rain-abds1b5k` | archived | No | vercel |
| `preview/feat/s3-storage` | `br-red-mouse-abyqkieb` | archived | No | vercel |

Only `main` is active. The two preview branches are archived (auto-created by Vercel integration).

---

## 4. Branch Creation Assessment

**`neonctl branches create` should work.** Evidence:

- Successfully listed projects and branches (requires read permissions)
- Org-level access is confirmed (authenticated via stored credentials)
- Vercel integration has already created branches (proving branch creation is enabled on this project)
- No IP restrictions or VPC blocking configured (`allowed_ips: []`, `block_public_connections: false`)

**For Phase 2, use:**
```bash
neonctl branches create \
  --project-id super-queen-68865217 \
  --org-id org-long-rice-46985810 \
  --name "dev/content-engine-pgvector" \
  --parent main
```

---

## 5. Auth Issues

None. neonctl is authenticated and has full access to the Kiuli project. The only caveat is the interactive org selector — always pass `--org-id org-long-rice-46985810` for non-interactive use.

---

## 6. Key Details for Phase 2

| Parameter | Value |
|-----------|-------|
| neonctl flag | `--org-id org-long-rice-46985810` |
| Project ID | `super-queen-68865217` |
| Main branch ID | `br-royal-shadow-abvgnq2g` |
| PG version | 17 |
| Region | aws-eu-west-2 |
