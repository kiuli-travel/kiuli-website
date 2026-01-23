# CLAUDE.md — Kiuli

**READ THIS ENTIRE FILE BEFORE TAKING ANY ACTION.**

---

## 1. Mission

Kiuli connects discerning travellers with high-margin African safaris. The website qualifies prospects before they reach travel designers. Every page must build overwhelming value, then present investment level to filter for profitability.

**The mission: Attract, qualify, convert — in that order.**

---

## 2. Architecture Overview

Kiuli uses a **Lambda-based async pipeline** for importing safari itineraries from iTrvl.

**For complete pipeline documentation, see: `KIULI_LAMBDA_ARCHITECTURE.md`**

### Pipeline Flow
```
Admin UI → Orchestrator → Scraper → Image Processor → Labeler → Finalizer
```

### Lambda Functions
| Function | Purpose |
|----------|---------|
| `kiuli-scraper` | Web scraping with Puppeteer |
| `kiuli-v6-orchestrator` | Pipeline coordination |
| `kiuli-v6-image-processor` | Image re-hosting to S3 |
| `kiuli-v6-labeler` | AI image enrichment (Nemotron via OpenRouter) |
| `kiuli-v6-video-processor` | HLS to MP4 video conversion |
| `kiuli-v6-finalizer` | Schema generation, hero selection |

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
| CDN | imgix (kiuli.imgix.net) |
| AI Labeling | Nemotron (free) via OpenRouter |
| AI Enhancement | Claude 3.5 Sonnet via OpenRouter |
| Pipeline | AWS Lambda (eu-north-1) |
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
npm run dev              # Local development
npm run build            # Production build
vercel deploy            # Deploy preview
vercel --prod            # Deploy production
```

### Lambda Deployment
```bash
# Deploy a Lambda function
cd lambda/orchestrator
zip -r function.zip handler.js transform.js shared/ node_modules/ -x "*.DS_Store"
aws lambda update-function-code \
  --function-name kiuli-v6-orchestrator \
  --zip-file fileb://function.zip \
  --region eu-north-1
```

---

## 5. Environment Variables

### Vercel (Website)
- `POSTGRES_URL` - Database connection
- `PAYLOAD_SECRET` - Payload encryption key
- `PAYLOAD_API_URL` - Admin API URL
- `PAYLOAD_API_KEY` - API authentication

### Lambda Functions
- `AWS_REGION` - eu-north-1
- `PAYLOAD_API_URL`, `PAYLOAD_API_KEY` - Payload access
- `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` - S3 storage
- `IMGIX_DOMAIN` - CDN domain
- `OPENROUTER_API_KEY` - AI enrichment
- `LAMBDA_*_ARN` - Inter-Lambda invocation
- `ITRVL_IMAGE_CDN_BASE` - iTrvl image CDN (fallback: itrvl-production-media.imgix.net)
- `ITRVL_VIDEO_CDN_BASE` - iTrvl video CDN (fallback: cdn-media.itrvl.com/video/hls)

**Check local vs Vercel parity before deploying.**

---

## 6. Dangerous Operations

| Operation | Risk | When Safe |
|-----------|------|-----------|
| `vercel --prod` | Deploys to live site | After local build passes |
| Editing payload.config.ts | Can break CMS | After backup, verify after |
| Modifying S3 files | Can break existing images | With explicit plan |
| Lambda deployment | Affects pipeline | After testing in dev |

---

## 7. Verification

After any change:
```bash
npm run build         # Must pass
npm run dev           # Must work locally
```

After Lambda changes:
```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 1h --region eu-north-1
```

---

## 8. When to STOP and Ask

- Any command fails or produces unexpected output
- You're about to modify payload.config.ts
- You're about to deploy to production
- Requirements are unclear
- You're tempted to use a placeholder

---

## 9. Key Documentation Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | This file - project overview and rules |
| `KIULI_LAMBDA_ARCHITECTURE.md` | Complete pipeline documentation |
| `README.md` | Public repository readme |

---

## 10. Important Notes

### FAQ Generation
FAQs are **auto-generated** by the orchestrator from segment data, NOT scraped from iTrvl.
The `transform.js` file generates questions like:
- "What is included at [accommodation]?"
- "Best time to visit [country]?"

### Two AI Systems
1. **Image Labeling** (Lambda/labeler) → Nemotron → labels: scene, mood, animals, etc.
2. **Text Enhancement** (Admin UI) → Claude 3.5 Sonnet → controlled by Voice Configurator

### V7 Two-Field Pattern
Itinerary text fields use: `*Itrvl` (original scraped) + `*Enhanced` (AI improved) + `*Reviewed` (final)

---

*Last updated: January 23, 2026*
