# CLAUDE.md — Kiuli

**READ THIS ENTIRE FILE BEFORE TAKING ANY ACTION.**

---

## 1. Mission

Kiuli connects discerning travellers with high-margin African safaris. The website qualifies prospects before they reach travel designers. Every page must build overwhelming value, then present investment level to filter for profitability.

**The mission: Attract, qualify, convert — in that order.**

---

## 2. Failure History

| Date | What Happened | Cause | Consequence |
|------|---------------|-------|-------------|
| Jan 2026 | 5 files with critical S3 fixes uncommitted | Work done but not committed | Risk of lost work, divergent state |
| Jan 2026 | 0 itineraries in production | Pipeline never completed full cycle | No content despite working components |
| Jan 2026 | Scrape endpoint publicly accessible | No authentication implemented | Security vulnerability, DoS risk |
| Multiple | Documentation says gemini-1.5-pro | Code uses gemini-2.0-flash | Confusion, wrong assumptions |

**Uncommitted work is the most common failure. Commit early, commit often.**

---

## 3. THE RULES — NON-NEGOTIABLE

### Rule 0: STOP on Failure

If ANY command fails: **STOP. Report. Wait for instructions. Do NOT improvise.**

### Rule 1: Commit Before Context Switch

Before switching tasks, ending a session, or changing files:
```bash
git status  # Check for uncommitted changes
git add -A && git commit -m "description"
git push origin main
```

**NEVER leave uncommitted changes.**

### Rule 2: Verify Environment

Before running any command:
```bash
pwd                     # Must be /Users/grahamwallington/Projects/kiuli-website
node --version          # Check Node version
vercel whoami           # Check Vercel context
```

### Rule 3: No Placeholders

**WRONG:** `// TODO: implement later`, `pass # fix this`
**CORRECT:** Complete, working implementation or explicit STOP

### Rule 4: Documentation = Code

If documentation says one thing and code says another, **code is truth**. Update documentation to match.

---

## 4. Quick Reference

### Stack
| Component | Technology |
|-----------|------------|
| Framework | Next.js 15.4.7 |
| CMS | Payload CMS 3.63.0 |
| Database | Vercel Postgres |
| Storage | AWS S3 (kiuli-bucket, eu-north-1) |
| AI | Google Gemini (gemini-2.0-flash) |
| Deploy | Vercel |

### Domains
| Domain | Purpose |
|--------|---------|
| kiuli.com | Production frontend |
| admin.kiuli.com | Payload admin panel |

### Repository
```bash
# Location
/Users/grahamwallington/Projects/kiuli-website

# Remote
https://github.com/kiuli-travel/kiuli-website.git
```

### Commands
```bash
npm run dev          # Local development
npm run build        # Production build
vercel deploy        # Deploy preview
vercel --prod        # Deploy production
```

### Pipeline Phases
| Phase | Script | Output |
|-------|--------|--------|
| 2 | itrvl_scraper.cjs | raw-itinerary.json |
| 3 | media_rehoster.cjs | media-mapping.json |
| 4 | content_enhancer.cjs | enhanced-itinerary.json |
| 5 | schema_generator.cjs | schema.jsonld |
| 6 | faq_formatter.cjs | faq.html |
| 7 | payload_ingester.cjs | payload_id.txt |

---

## 5. Environment Variables

**Required (NOT values, just names):**
- POSTGRES_URL, PAYLOAD_SECRET, PAYLOAD_API_URL, PAYLOAD_API_KEY
- GEMINI_API_KEY
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION

**Check local vs Vercel parity before deploying.**

---

## 6. Dangerous Operations

| Operation | Risk | When Safe |
|-----------|------|-----------|
| `vercel --prod` | Deploys to live site | After local build passes |
| Editing payload.config.ts | Can break CMS | After backup, verify after |
| Modifying S3 files | Can break existing images | With explicit plan |
| Running full pipeline | Creates production content | After validation scripts pass |

---

## 7. Verification

After any change:
```bash
npm run build         # Must pass
npm run dev           # Must work locally
# If pipeline change, run validation scripts
node validation_scripts/validate_phase_N.cjs
```

---

## 8. When to STOP and Ask

- Any command fails or produces unexpected output
- You're about to modify payload.config.ts
- You're about to deploy to production
- Requirements are unclear
- You're tempted to use a placeholder

---

*Last updated: January 2026*
