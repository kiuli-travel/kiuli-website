# Claude Context Reference

Extended context for Claude CLI sessions working on Kiuli.

## Codebase Map

### Core Application

```
src/
├── app/
│   ├── (frontend)/                    # Customer-facing pages
│   │   ├── safaris/[slug]/page.tsx    # Individual itinerary pages
│   │   ├── safaris/page.tsx           # Safari listing page
│   │   ├── posts/[slug]/page.tsx      # Blog posts
│   │   ├── [slug]/page.tsx            # Static CMS pages
│   │   ├── layout.tsx                 # Frontend layout
│   │   └── page.tsx                   # Homepage
│   │
│   └── (payload)/                     # Admin and API
│       ├── admin/[[...segments]]/     # Payload admin UI
│       │   ├── page.tsx               # Admin page handler
│       │   └── importMap.js           # Component registry (auto-generated)
│       │
│       └── api/                       # Custom API routes
│           ├── scrape-itinerary/      # Trigger scraper pipeline
│           ├── job-status/[jobId]/    # Poll job progress
│           ├── job-control/[jobId]/   # Cancel/retry jobs
│           ├── enhance/               # AI content enhancement
│           ├── notifications/         # Notification management
│           └── scraper-health/        # Health check
│
├── collections/                       # Payload CMS schemas
│   ├── Itineraries/
│   │   ├── index.ts                   # Main schema (~1400 lines)
│   │   └── hooks/                     # beforeChange, afterRead hooks
│   ├── ItineraryJobs/
│   │   └── index.ts                   # Job tracking schema
│   ├── Media.ts                       # Images/videos with AI labels
│   ├── ImageStatuses/                 # Per-image processing status
│   ├── Pages/                         # Static CMS pages
│   ├── Posts/                         # Blog articles
│   ├── Users.ts                       # Admin users
│   └── ...                            # Other collections
│
├── components/
│   ├── admin/                         # Payload admin customizations
│   │   ├── ImageSelectorField.tsx     # Image picker
│   │   ├── VideoSelectorField.tsx     # Video picker
│   │   ├── FieldPairEditor.tsx        # V7 pattern editor
│   │   ├── NotificationBell.tsx       # Admin notifications
│   │   └── ...                        # Other admin components
│   │
│   ├── itinerary/                     # Safari page components
│   │   ├── ItineraryHero.tsx          # Hero section
│   │   ├── TripOverview.tsx           # Trip summary
│   │   ├── JourneyNarrative.tsx       # Day-by-day display
│   │   ├── StayCard.tsx               # Accommodation cards
│   │   ├── ActivityBlock.tsx          # Activity sections
│   │   ├── TransferRow.tsx            # Transport segments
│   │   ├── FAQSection.tsx             # FAQ accordion
│   │   └── InvestmentLevel.tsx        # Pricing CTA
│   │
│   └── layout/                        # Site-wide layout
│       ├── Header.tsx                 # Navigation header
│       └── Footer.tsx                 # Site footer
│
├── utilities/                         # Helper functions
│   ├── getMediaUrl.ts                 # Media URL resolution
│   ├── getMeUser.ts                   # Current user retrieval
│   ├── generateMeta.ts                # SEO metadata
│   ├── deepMerge.ts                   # Object merging
│   └── ...                            # Other utilities
│
└── payload-types.ts                   # Auto-generated TypeScript types
```

### Lambda Pipeline

```
lambda/
├── orchestrator/                      # Pipeline coordinator
│   ├── handler.js                     # Main entry point
│   ├── transform.js                   # Data transformation
│   └── shared/                        # Shared utilities
│       ├── payloadClient.js           # Payload API client
│       ├── s3Client.js                # S3 operations
│       └── progress.js                # Progress tracking
│
├── image-processor/                   # Image re-hosting
│   └── handler.js                     # Downloads from iTrvl, uploads to S3
│
├── labeler/                           # AI image labeling
│   └── handler.js                     # Nemotron via OpenRouter
│
├── video-processor/                   # Video conversion
│   └── handler.js                     # HLS to MP4
│
└── finalizer/                         # Completion tasks
    └── handler.js                     # Schema generation, hero selection
```

---

## Architecture Decisions

### Why V7 Two-Field Pattern?

**Problem:** Needed to preserve original scraped content while allowing AI enhancement.

**Solution:** Every text field has three variants:
- `*Itrvl` - Original (read-only, source of truth)
- `*Enhanced` - AI-improved (editable)
- `*Reviewed` - Boolean tracking review status

**Trade-off:** More complex schema, but:
- Never lose original content
- Safe rollback capability
- Clear review workflow
- Side-by-side comparison possible

### Why Lambda Pipeline (Not Server Actions)?

**Problem:** iTrvl scraping + image processing can take 3-5 minutes.

**Solution:** Async Lambda pipeline with:
- Orchestrator coordinates phases
- Parallel image processing
- Progress tracking via Payload
- No timeout issues

**Trade-off:** More infrastructure, but:
- Handles large itineraries
- Real-time progress updates
- Fault tolerance with retries
- No blocking the web server

### Why imgix for Images?

**Problem:** Need optimized images without server-side processing.

**Solution:** Store originals in S3, serve via imgix CDN.

**Benefits:**
- On-the-fly resize/crop
- WebP/AVIF auto-conversion
- Global CDN delivery
- No pre-generation needed

### Why Separate Labeler Lambda?

**Problem:** AI labeling is slow and can timeout.

**Solution:** Dedicated labeler Lambda invoked per-image.

**Benefits:**
- Parallel execution
- Individual retry per image
- Isolated timeout handling
- Easy to swap AI models

---

## Common Pitfalls

### 1. Forgot importMap Regeneration

**Symptom:** New admin component doesn't appear.

**Fix:**
```bash
npx payload generate:importmap
git add src/app/\(payload\)/admin/importMap.js
```

### 2. Deployment Without vercel --prod

**Symptom:** Changes visible in Vercel dashboard but not on kiuli.com.

**Fix:**
```bash
vercel --prod  # Updates custom domain aliases
```

### 3. Missing Environment Variable

**Symptom:** Lambda fails with undefined error.

**Fix:** Check Lambda console environment variables match `.env.example`.

### 4. RichText Field Handling

**Symptom:** Content displays as [object Object].

**Cause:** RichText stored as Lexical JSON, needs rendering.

**Fix:** Use `serializeLexical` or check if field is already serialized.

### 5. Image Deduplication Bypass

**Symptom:** Same image uploaded multiple times.

**Cause:** `sourceS3Key` not set correctly.

**Fix:** Ensure `sourceS3Key` is extracted from iTrvl URL path.

---

## Debugging Workflows

### Pipeline Stuck?

1. Check job status:
```bash
curl https://admin.kiuli.com/api/itinerary-jobs/JOB_ID
```

2. Check CloudWatch logs:
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 1h --region eu-north-1
```

3. Check image-statuses for failures:
```bash
curl "https://admin.kiuli.com/api/image-statuses?where[job][equals]=JOB_ID&where[status][equals]=failed"
```

### Admin Component Not Working?

1. Check browser console for errors
2. Verify component is in importMap.js
3. Check component path in collection config matches

### Images Not Displaying?

1. Check Media collection for the image
2. Verify `imgixUrl` is populated
3. Check S3 for the original file
4. Verify imgix domain configuration

### AI Enhancement Failing?

1. Check `/api/enhance` response
2. Verify OpenRouter API key (Gemini) is set
3. Check Voice Configuration collection has entries
4. Review request body format

---

## Performance Considerations

### Database Queries

- Use `depth: 0` when you don't need relationships
- Add indexes for frequently queried fields
- Use `limit` to paginate large collections

### Image Loading

- Always use imgix URLs with size parameters
- Implement lazy loading for below-fold images
- Use appropriate image sizes (not `xlarge` for thumbnails)

### Pipeline Processing

- Images are processed in parallel (default: 5 concurrent)
- Large itineraries may hit Lambda timeouts
- Video processing is slowest phase (~2-3 minutes)

---

## Testing Checklist

### Before Committing

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Changes work locally

### Before Deploying

- [ ] All tests pass
- [ ] No console errors in browser
- [ ] Admin panel loads correctly
- [ ] API endpoints respond

### After Deploying

- [ ] kiuli.com shows new changes
- [ ] admin.kiuli.com is accessible
- [ ] Can create/edit itineraries
- [ ] Images load correctly

---

## Quick Command Reference

```bash
# Development
npm run dev                     # Start dev server
npm run build                   # Production build
npm run lint                    # Check linting
npm run lint:fix                # Fix lint issues

# Payload
npx payload generate:importmap  # Regenerate admin components
npx payload generate:types      # Regenerate TypeScript types
npm run payload migrate         # Run migrations

# Deployment
vercel deploy                   # Deploy preview
vercel --prod                   # Deploy production

# Lambda
aws logs tail /aws/lambda/FUNCTION --since 1h --region eu-north-1

# Git
git status                      # Check for uncommitted changes
git add -A && git commit -m ""  # Commit all
git push origin main            # Push to remote
```

---

## Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Main rules and procedures
- [KIULI_LAMBDA_ARCHITECTURE.md](../KIULI_LAMBDA_ARCHITECTURE.md) - Pipeline details
- [COLLECTIONS.md](./COLLECTIONS.md) - Database schemas
- [API_REFERENCE.md](./API_REFERENCE.md) - API endpoints
