# Local Development Setup

Complete guide to setting up the Kiuli development environment.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 20+ | Runtime |
| npm | 10+ | Package manager |
| Git | Latest | Version control |
| AWS CLI | 2.x | Lambda deployment (optional) |

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/kiuli-travel/kiuli-website.git
cd kiuli-website

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env.local

# 4. Configure environment variables (see below)

# 5. Start development server
npm run dev
```

The site will be available at:
- **Frontend:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin

## Environment Variables

### Required Variables

```bash
# Database - Get from Vercel Dashboard > Storage > Postgres
POSTGRES_URL=postgresql://...

# Payload CMS encryption key - Generate with: openssl rand -base64 32
PAYLOAD_SECRET=your-secret-key-here

# Server URL (no trailing slash)
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
```

### Optional - AWS/S3 (for image uploads)

```bash
# AWS Credentials - Get from AWS IAM
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# S3 Configuration
S3_BUCKET=kiuli-bucket
S3_REGION=eu-north-1
```

### Optional - AI Services

```bash
# OpenRouter (for image labeling in Lambda)
OPENROUTER_API_KEY=sk-or-v1-...

# Gemini (for content enhancement)
GEMINI_API_KEY=...
```

### Optional - API Access

```bash
# API key for programmatic access to Payload
PAYLOAD_API_URL=http://localhost:3000/api
PAYLOAD_API_KEY=your-api-key

# Secrets for auth
CRON_SECRET=your-cron-secret
PREVIEW_SECRET=your-preview-secret
SCRAPER_API_KEY=your-scraper-key
```

## Database Options

### Option 1: Use Vercel Postgres (Recommended)

Use the production or preview database directly:

1. Go to Vercel Dashboard → kiuli-website → Storage
2. Select your Postgres database
3. Copy the connection string to `POSTGRES_URL`

**Note:** This uses the remote database, so changes affect it directly.

### Option 2: Local PostgreSQL

Run PostgreSQL locally:

```bash
# macOS with Homebrew
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb kiuli_dev
```

Then set:
```bash
POSTGRES_URL=postgresql://localhost:5432/kiuli_dev
```

After connecting, run migrations:
```bash
npm run payload migrate
```

## Common Commands

```bash
# Development
npm run dev                  # Start dev server (hot reload)
npm run build                # Production build
npm run lint                 # Run ESLint
npm run lint:fix             # Fix ESLint issues

# Payload CMS
npm run payload migrate      # Run database migrations
npm run generate:importmap   # Regenerate admin component map
npm run generate:types       # Generate TypeScript types

# Testing
npm run test                 # Run all tests
npm run test:int             # Integration tests only
npm run test:e2e             # E2E tests only
```

## Admin Panel First Login

1. Start the dev server: `npm run dev`
2. Navigate to http://localhost:3000/admin
3. You'll be prompted to create the first user
4. Enter email and password
5. This creates an admin user in the database

## Working with Collections

### Creating Content

1. Log into admin panel
2. Navigate to collection (e.g., Pages, Posts)
3. Click "Create New"
4. Fill in fields and save

### Importing Itineraries

1. Go to admin panel
2. Click "Import Itinerary" in sidebar
3. Paste iTrvl portal URL
4. Pipeline runs automatically via Lambda

**Note:** Local development cannot trigger Lambda functions directly. Use the production admin panel for imports, or configure Lambda Function URLs.

## Troubleshooting

### "Module not found" errors

```bash
rm -rf node_modules .next
npm install
```

### Admin components not appearing

```bash
npm run generate:importmap
```

### Database connection errors

1. Check `POSTGRES_URL` is correct
2. For Vercel Postgres: ensure IP is allowlisted (Settings → Security)
3. For local: ensure PostgreSQL is running

### TypeScript errors after schema changes

```bash
npm run generate:types
```

### Port 3000 already in use

```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

### Payload schema drift warnings

If you see warnings about schema differences:

```bash
# Run migrations to sync
npm run payload migrate
```

Or accept schema push in dev mode (follow prompts).

## Lambda Development

To work on Lambda functions locally:

```bash
cd lambda/orchestrator

# Install dependencies
npm install

# Test handler (requires setting up test event)
node -e "require('./handler').handler({...})"
```

For full pipeline testing, deploy to AWS and use CloudWatch logs:

```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 1h --region eu-north-1
```

See [KIULI_LAMBDA_ARCHITECTURE.md](../KIULI_LAMBDA_ARCHITECTURE.md) for complete Lambda documentation.

## IDE Setup

### VS Code Extensions (Recommended)

- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript Vue Plugin (Volar)

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.preferences.importModuleSpecifier": "relative"
}
```

## Next Steps

- Review [CLAUDE.md](../CLAUDE.md) for project rules
- Read [SYSTEM_ARCHITECTURE.md](../SYSTEM_ARCHITECTURE.md) for architecture overview
- Check [API_REFERENCE.md](./API_REFERENCE.md) for API documentation
- See [COLLECTIONS.md](./COLLECTIONS.md) for database schema
