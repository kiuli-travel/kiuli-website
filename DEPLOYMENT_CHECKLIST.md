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
- [ ] Commit changes: `git add -A && git commit -m "..."`
- [ ] Push to origin: `git push origin main`
- [ ] Wait for Vercel deployment (~2-3 minutes)
- [ ] Verify kiuli.com loads correctly
- [ ] Verify admin.kiuli.com loads correctly

### For Lambda Function Changes

- [ ] Make changes in `lambda/[function-name]/`
- [ ] Run `lambda/sync-shared.sh` if shared code changed
- [ ] Create deploy package:
  ```bash
  cd lambda/[function-name]
  zip -r deploy.zip . -x "*.git*"
  ```
- [ ] Deploy to AWS:
  ```bash
  aws lambda update-function-code \
    --function-name kiuli-v6-[function-name] \
    --zip-file fileb://deploy.zip \
    --region eu-north-1
  ```
- [ ] Verify function works (trigger a test job)
- [ ] Check CloudWatch logs for errors

### For Payload Admin Component Changes

- [ ] Make changes in `src/components/admin/`
- [ ] Regenerate import map:
  ```bash
  npx payload generate:importmap
  ```
- [ ] Commit the regenerated `src/app/(payload)/admin/importMap.js`
- [ ] Push and deploy

---

## Verification Steps

### Website (kiuli.com)

1. Page loads without errors
2. Correct fonts displaying (General Sans headings, Satoshi body)
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

1. Check Vercel dashboard for error details
2. Run `npm run build` locally to reproduce
3. Fix TypeScript/ESLint errors
4. Push fix

### Changes not visible in production

1. Verify commit was pushed: `git log origin/main -1`
2. Check Vercel dashboard for deployment status
3. Clear browser cache / hard refresh (Cmd+Shift+R)
4. Ensure you're on correct URL (not preview URL)

### Lambda not working

1. Check CloudWatch logs:
   ```bash
   aws logs tail /aws/lambda/kiuli-v6-[function-name] --since 1h --region eu-north-1
   ```
2. Verify environment variables in Lambda console
3. Test with minimal input
4. Redeploy if code changes weren't applied

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

# Commit and deploy
git add -A && git commit -m "message" && git push origin main

# Check Vercel deployment status
vercel ls

# Lambda deployment
cd lambda/orchestrator && zip -r deploy.zip . && \
aws lambda update-function-code \
  --function-name kiuli-v6-orchestrator \
  --zip-file fileb://deploy.zip \
  --region eu-north-1

# Check Lambda logs
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 30m --region eu-north-1
```

---

*If in doubt, verify before assuming.*
