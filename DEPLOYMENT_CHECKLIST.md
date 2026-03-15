# Kiuli Deployment Checklist

Use this checklist for every deployment.

---

## Before Making Changes

- [ ] Pull latest: `git pull origin main`
- [ ] Verify clean state: `git status` shows no uncommitted changes
- [ ] Run local build: `npm run build`

---

## After Making Changes

### For Website/Admin Changes

- [ ] Test locally: `npm run dev`
- [ ] Build passes: `npm run build`
- [ ] Commit changes: `git add <files> && git commit -m "..."`
- [ ] Push to origin: `git push origin main`
- [ ] Vercel auto-deploys from GitHub push (~2-3 minutes)
- [ ] Verify deployment: `vercel ls` (via MCP or CLI)
- [ ] Verify kiuli.com loads correctly
- [ ] Verify admin.kiuli.com loads correctly

### For Lambda Function Changes

- [ ] Make changes in `lambda/[function-name]/`
- [ ] Deploy using canonical script:
  ```bash
  lambda/scripts/deploy.sh [function-name]
  ```
- [ ] Verify deployment:
  ```bash
  lambda/scripts/verify.sh
  ```
- [ ] Check CloudWatch logs for errors

See `lambda/DEPLOYMENT.md` (v2.0) for full reference including platform-specific builds, S3 upload for large functions, and git hash verification.

### For Payload Admin Component Changes

- [ ] Make changes in component files
- [ ] Import map regenerates automatically during `next build` (via `withPayload` wrapper)
- [ ] If adding a NEW component to `payload.config.ts`, run locally: `npx payload generate:importmap`
- [ ] Commit the regenerated `src/app/(payload)/admin/importMap.js`
- [ ] Push and deploy

---

## Verification Steps

### Website (kiuli.com)

1. Page loads without errors
2. Correct fonts (General Sans headings, Satoshi body)
3. Correct colors (Teal #486A6A, Clay #DA7A5A, Ivory #F5F3EB background)
4. No Payload header/footer on frontend pages
5. Images loading from imgix (check Network tab)

### Admin (admin.kiuli.com)

1. Login page loads
2. Can authenticate with valid credentials
3. Collections visible in sidebar
4. Can view/edit itineraries
5. Import Itinerary link visible in navigation

### Scraper Pipeline

1. Navigate to ItineraryJobs in admin
2. Trigger new scrape with iTrvl URL
3. Job appears with "pending" status
4. Status progresses through phases
5. Images appear in Media collection
6. Itinerary data populates correctly

---

## Common Issues

### Vercel build fails

1. Check via MCP: `vercel_list` then `vercel_inspect(url)`
2. Run `npm run build` locally to reproduce
3. Fix TypeScript/ESLint errors
4. Push fix — auto-deploy will retry

### Changes not visible in production

1. Verify commit was pushed: `git log origin/main -1`
2. Check deployment: `vercel_list` — is a new deployment present?
3. Inspect deployment: `vercel_inspect(url)` — check commit hash
4. Clear browser cache / hard refresh (Cmd+Shift+R)

### Lambda not working

1. Check logs via MCP: `lambda_logs(function='orchestrator')`
2. Or CLI: `aws logs tail /aws/lambda/kiuli-v6-[function-name] --since 1h --region eu-north-1`
3. Verify Lambda matches HEAD: `lambda/scripts/verify.sh`
4. Redeploy if needed: `lambda/scripts/deploy.sh [function-name]`

### New admin component not appearing

1. Check component is exported correctly
2. Run `npx payload generate:importmap`
3. Commit and push the updated importMap.js
4. Verify component path in payload.config.ts

### Images not loading

1. Check S3 bucket permissions
2. Verify imgix domain is correct (kiuli.imgix.net)
3. Check image URL in browser devtools
4. Verify AWS credentials in environment

---

## Quick Commands

```bash
# Local development
npm run dev

# Production build test
npm run build

# Commit and deploy (auto-deploys to Vercel)
git add <files> && git commit -m "message" && git push origin main

# Check Vercel deployments (via CLI)
vercel ls

# Lambda deployment
lambda/scripts/deploy.sh orchestrator
lambda/scripts/verify.sh

# Check Lambda logs
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1
```

---

*If in doubt, verify before assuming.*
