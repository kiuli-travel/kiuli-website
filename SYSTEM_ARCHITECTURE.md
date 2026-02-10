# Kiuli System Architecture

**Last verified:** 2026-01-26
**Repository:** https://github.com/kiuli-travel/kiuli-website

---

## Overview

Kiuli is a luxury African safari travel website built with Next.js and Payload CMS. The system consists of:

1. **Website** — Customer-facing pages at kiuli.com
2. **Admin** — Payload CMS admin at admin.kiuli.com
3. **Scraper** — Lambda-based pipeline that extracts itineraries from iTrvl

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Next.js | 15.4.x |
| CMS | Payload CMS | 3.63.x |
| Styling | Tailwind CSS | 3.4.x |
| Database | Vercel Postgres | — |
| Image Storage | AWS S3 | eu-north-1 |
| Image CDN | imgix | kiuli.imgix.net |
| Hosting | Vercel | Auto-deploy from main |
| Scraper Runtime | AWS Lambda | Node.js 20.x |

---

## Repository Structure

```
kiuli-website/
├── src/
│   ├── app/
│   │   ├── (frontend)/      # Customer-facing routes
│   │   │   ├── layout.tsx   # Frontend layout (no Payload chrome)
│   │   │   ├── globals.css  # Global styles with Kiuli design system
│   │   │   ├── page.tsx     # Homepage
│   │   │   └── [slug]/      # Dynamic pages
│   │   └── (payload)/       # Payload admin routes
│   │       ├── admin/       # Admin UI
│   │       └── api/         # API endpoints
│   ├── collections/         # Payload collection definitions
│   ├── components/          # React components
│   │   ├── admin/           # Admin-specific components
│   │   └── ui/              # Shared UI components
│   └── payload.config.ts    # Payload configuration
├── lambda/                  # AWS Lambda functions
│   ├── orchestrator/        # Pipeline coordination
│   ├── image-processor/     # Image download and S3 upload
│   ├── labeler/             # AI image labeling (Nemotron via OpenRouter)
│   ├── video-processor/     # Video handling
│   ├── finalizer/           # Pipeline completion
│   └── shared/              # Shared utilities (config, payload, s3)
├── public/
│   ├── fonts/               # Kiuli typography (5 WOFF2 files)
│   └── logos/               # Kiuli logo assets (13 files)
├── scripts/                 # Utility scripts
└── [config files]           # next.config.js, tailwind.config.mjs, etc.
```

---

## Payload Collections

| Collection | Purpose |
|------------|---------|
| Itineraries | Safari trip itineraries (scraped from iTrvl) |
| ItineraryJobs | Scraper job tracking and status |
| Media | Image library with S3/imgix integration |
| ImageStatuses | Per-image processing status |
| Notifications | System notifications for admin |
| Pages | Static CMS pages |
| Posts | Blog posts |
| Users | Admin users |
| Destinations | Country/park destination pages |
| TripTypes | Trip categorization (honeymoon, family, etc.) |
| VoiceConfiguration | AI voice/tone settings for content |
| Categories | Content categories |
| Inquiries | Customer inquiry submissions |
| Properties | Safari properties/accommodations |
| PropertyNameMappings | Property name normalization |
| Authors | Blog post authors |
| Designers | Travel designers |
| Sessions | User sessions |
| ContentSystemSettings | AI content system configuration |

---

## API Routes

| Route | Purpose |
|-------|---------|
| `/api/scrape-itinerary` | Trigger scraper pipeline |
| `/api/job-status/[jobId]` | Get job processing status |
| `/api/job-control/[jobId]` | Control job execution (pause/resume/cancel) |
| `/api/enhance` | AI content enhancement |
| `/api/notifications` | Notification management |
| `/api/resolve-image` | Image URL resolution |
| `/api/scraper-health` | Health check endpoint |
| `/api/graphql` | GraphQL API |

---

## Environment Variables

Required environment variables are documented in `.env.example`.

### Key Categories

**Database:**
- `POSTGRES_URL` — Vercel Postgres connection string
- `DATABASE_URL` — Alternative connection string

**AWS:**
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — AWS credentials
- `S3_BUCKET` — kiuli-bucket
- `S3_REGION` — eu-north-1

**Payload:**
- `PAYLOAD_SECRET` — Encryption key
- `PAYLOAD_API_URL` — https://admin.kiuli.com/api
- `PAYLOAD_API_KEY` — API authentication

**AI Services:**
- `OPENROUTER_API_KEY` — For Nemotron image labeling (via OpenRouter)

---

## Deployment

### Automatic (Vercel)

Push to `main` branch triggers automatic deployment:

1. Vercel detects push to `kiuli-travel/kiuli-website`
2. Builds Next.js application
3. Deploys to production
4. Updates kiuli.com and admin.kiuli.com

No manual Vercel commands needed — just `git push origin main`.

### Lambda Functions

Lambda functions are deployed separately via AWS CLI:

```bash
cd lambda/[function-name]
zip -r deploy.zip . -x "*.git*" -x "node_modules/.cache/*"
aws lambda update-function-code \
  --function-name kiuli-v6-[function-name] \
  --zip-file fileb://deploy.zip \
  --region eu-north-1
```

See `lambda/DEPLOYMENT.md` for detailed instructions.

---

## Design System

### Colors

| Name | Hex | Tailwind Class |
|------|-----|----------------|
| Teal | #486A6A | `bg-kiuli-teal` |
| Teal Light | rgba(72,106,106,0.1) | `bg-kiuli-teal-light` |
| Clay | #DA7A5A | `bg-kiuli-clay` |
| Clay Hover | #C46B4D | `bg-kiuli-clay-hover` |
| Charcoal | #404040 | `bg-kiuli-charcoal` |
| Gray | #DADADA | `bg-kiuli-gray` |
| Ivory | #F5F3EB | `bg-kiuli-ivory` |

### Typography

| Usage | Font | Weight | Tailwind Class |
|-------|------|--------|----------------|
| Headings | General Sans | 500-700 | `font-heading` |
| Body | Satoshi | 300 | `font-body` or `font-sans` |
| Accent | Waterfall | 400 | `font-accent` |

Font files located in `public/fonts/`.

### Utilities

| Class | Purpose |
|-------|---------|
| `.label-caps` | Small caps label text |
| `.accent-script` | Waterfall script font |

---

## Key Documentation

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Project instructions and rules |
| `KIULI_LAMBDA_ARCHITECTURE.md` | Detailed Lambda pipeline documentation |
| `lambda/DEPLOYMENT.md` | Lambda deployment instructions |

---

*This document describes the system as it exists. Update when architecture changes.*
