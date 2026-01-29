# Kiuli

**Luxury African Safari Platform**

Kiuli connects discerning travellers with transformative African safari experiences. The platform imports, enhances, and presents curated safari itineraries from travel designers.

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Next.js 15 (App Router) |
| **CMS** | Payload CMS 3.63 |
| **Database** | Vercel Postgres |
| **Storage** | AWS S3 (eu-north-1) |
| **CDN** | imgix |
| **Pipeline** | AWS Lambda (5 functions) |
| **AI Labeling** | GPT-4o via OpenRouter |
| **AI Enhancement** | Claude 3.5 Sonnet |
| **Hosting** | Vercel |
| **Styling** | Tailwind CSS 3.4 |

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

- **Frontend:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin

## Production URLs

| Domain | Purpose |
|--------|---------|
| https://kiuli.com | Customer-facing website |
| https://admin.kiuli.com | Payload CMS admin panel |

## Architecture Overview

Kiuli is a **hybrid Next.js application** hosting both the customer website and Payload CMS admin in a single deployment. Safari itineraries are imported via an **AWS Lambda pipeline** that:

1. **Scrapes** itinerary data from iTrvl portal
2. **Transforms** raw data to structured content
3. **Processes** images (download, S3 upload, CDN optimization)
4. **Labels** images with AI (scene, mood, animals, etc.)
5. **Converts** HLS videos to MP4
6. **Generates** JSON-LD schemas for SEO

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  Admin UI   │────▶│  Orchestrator │────▶│    Scraper      │
└─────────────┘     └──────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │   Image      │────▶│    Labeler      │
                    │   Processor  │     └─────────────────┘
                    └──────────────┘            │
                           │                    │
                    ┌──────────────┐            │
                    │    Video     │            ▼
                    │   Processor  │     ┌─────────────────┐
                    └──────────────┘     │    Finalizer    │
                                         └─────────────────┘
```

## Project Structure

```
/
├── src/
│   ├── app/
│   │   ├── (frontend)/          # Customer pages
│   │   │   ├── safaris/[slug]/  # Itinerary pages
│   │   │   ├── posts/           # Blog
│   │   │   └── [slug]/          # Static pages
│   │   └── (payload)/           # Admin + API
│   │       ├── admin/           # Payload admin UI
│   │       └── api/             # API endpoints
│   ├── collections/             # Payload CMS schemas
│   ├── components/              # React components
│   │   ├── admin/               # Custom admin UI
│   │   ├── itinerary/           # Safari page components
│   │   └── layout/              # Header, Footer
│   └── utilities/               # Helper functions
├── lambda/                      # AWS Lambda functions
│   ├── orchestrator/
│   ├── image-processor/
│   ├── labeler/
│   ├── video-processor/
│   └── finalizer/
└── docs/                        # Documentation
```

## Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](./CLAUDE.md) | AI assistant guide with rules and procedures |
| [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | Technical architecture overview |
| [KIULI_LAMBDA_ARCHITECTURE.md](./KIULI_LAMBDA_ARCHITECTURE.md) | Scraper pipeline details (26KB) |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Pre/post deployment procedures |
| [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md) | Local development setup |
| [docs/API_REFERENCE.md](./docs/API_REFERENCE.md) | API endpoint documentation |
| [docs/COLLECTIONS.md](./docs/COLLECTIONS.md) | Payload CMS schema reference |

## Key Concepts

### V7 Two-Field Pattern
All itinerary text fields use a versioning pattern:
- `*Itrvl` - Original scraped content (read-only)
- `*Enhanced` - AI-improved version (editable)
- `*Reviewed` - Boolean marking completion

### Collections
- **Itineraries** - Safari trips with days/segments
- **Media** - Images and videos with AI labels
- **ItineraryJobs** - Pipeline job tracking
- **ImageStatuses** - Per-image processing status

## Commands

```bash
# Development
npm run dev                  # Start dev server
npm run build                # Production build
npm run lint                 # ESLint check

# Deployment
vercel deploy                # Deploy preview
vercel --prod                # Deploy production

# Payload CMS
npm run generate:importmap   # Regenerate admin component map
npm run generate:types       # Regenerate TypeScript types
npm run payload migrate      # Run database migrations
```

## Environment Setup

Copy `.env.example` to `.env.local` and configure:

```bash
# Required
POSTGRES_URL=              # Vercel Postgres connection
PAYLOAD_SECRET=            # JWT encryption key

# AWS (for Lambda/S3)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=kiuli-bucket
S3_REGION=eu-north-1

# AI Services
OPENROUTER_API_KEY=        # Image labeling
GEMINI_API_KEY=            # Content enhancement
```

See [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md) for complete setup instructions.

## Deployment

### Website (Vercel)
```bash
git push origin main        # Triggers build
vercel --prod              # Deploy to production domains
```

### Lambda Functions
```bash
cd lambda/orchestrator
zip -r deploy.zip handler.js transform.js shared/ node_modules/
aws lambda update-function-code \
  --function-name kiuli-v6-orchestrator \
  --zip-file fileb://deploy.zip \
  --region eu-north-1
```

See [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) for detailed procedures.

## Repository

- **GitHub:** https://github.com/kiuli-travel/kiuli-website
- **Vercel Project:** kiuli-website

## License

Private repository. All rights reserved.
