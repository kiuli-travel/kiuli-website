# CI/CD Recovery — Gates 0b + 0d

Execute these tasks in order. STOP and report if any step fails.

## Prerequisites

Pull the latest changes first — code changes for Gates 0a, 0c, 2, and 3 have already been committed and pushed:

```bash
cd ~/Projects/kiuli-website
git pull origin main
```

Verify the commit landed:
```bash
git log --oneline -3
```
You should see: `feat: CI/CD pipeline, editor fixes, admin cleanup`

---

## Gate 0b: Fix video-processor IAM permissions

### Step 1: Verify AWS credentials

```bash
aws sts get-caller-identity
```

If this fails, stop. AWS CLI is not configured.

### Step 2: Verify the video-processor Lambda exists

```bash
aws lambda list-functions --region eu-north-1 --query 'Functions[*].FunctionName' --output text | tr '\t' '\n' | grep -i video
```

Expected: `kiuli-v6-video-processor` (or similar). If the function name is different from `kiuli-v6-video-processor`, you must update three files:
- `lambda/scripts/deploy.sh` — the `get_aws_name()` function
- `lambda/scripts/verify.sh` — the `FUNCTIONS` associative array
- `tools/mcp-server/server.mjs` — the `FUNCTION_MAP` objects in `lambda_status` and `lambda_logs`

### Step 3: Check current IAM role and policies

```bash
# Get the role name
aws lambda get-function-configuration --function-name kiuli-v6-video-processor --region eu-north-1 --query 'Role' --output text

# List attached policies (use the role name from above, likely kiuli-scraper-lambda-role)
aws iam list-attached-role-policies --role-name kiuli-scraper-lambda-role
aws iam list-role-policies --role-name kiuli-scraper-lambda-role
```

### Step 4: Check if S3 PutObject is already permitted

```bash
# Get the inline policy (if any)
aws iam get-role-policy --role-name kiuli-scraper-lambda-role --policy-name <policy-name-from-step-3>
```

Look for `s3:PutObject` on `arn:aws:s3:::kiuli-bucket/*`. If it exists, skip to Gate 0d. If not:

### Step 5: Add S3 PutObject permission

If the role uses an inline policy, update it. If it uses a managed policy, either update the managed policy or add an inline policy:

```bash
aws iam put-role-policy \
  --role-name kiuli-scraper-lambda-role \
  --policy-name kiuli-video-s3-write \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::kiuli-bucket/media/originals/*/videos/*"
    }]
  }'
```

Verify:
```bash
aws iam get-role-policy --role-name kiuli-scraper-lambda-role --policy-name kiuli-video-s3-write
```

---

## Gate 0c (cont): Verify GitHub Actions secrets

### Step 6: Check GitHub secrets

```bash
gh secret list --repo kiuli-travel/kiuli-website
```

You need `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. If missing:

```bash
# You'll be prompted for the value — paste your AWS access key
gh secret set AWS_ACCESS_KEY_ID --repo kiuli-travel/kiuli-website
gh secret set AWS_SECRET_ACCESS_KEY --repo kiuli-travel/kiuli-website
```

Use the same credentials that `aws sts get-caller-identity` uses. These must have permissions to: `lambda:UpdateFunctionCode`, `lambda:UpdateFunctionConfiguration`, `lambda:GetFunctionConfiguration`, `logs:TailLogEvents`.

---

## Gate 0d: Deploy all 6 Lambdas to current HEAD

### Step 7: Sync shared utilities

```bash
cd ~/Projects/kiuli-website/lambda
./sync-shared.sh
```

### Step 8: Deploy each Lambda

```bash
cd ~/Projects/kiuli-website/lambda/scripts
./deploy.sh scraper
./deploy.sh orchestrator
./deploy.sh image-processor
./deploy.sh labeler
./deploy.sh finalizer
./deploy.sh video-processor
```

Each deploy should output:
- `PASS` with a deploy hash matching current HEAD
- The function name it deployed to
- Size of the uploaded zip

### Step 9: Verify all deployments

```bash
cd ~/Projects/kiuli-website/lambda/scripts
./verify.sh
```

All 6 functions should show `CURRENT`. If any show `BEHIND` or `NO HASH`, re-run the deploy for that function.

---

## Gate 0d verification: End-to-end pipeline test

### Step 10: Trigger a test scrape

Pick any of the known iTrvl URLs. Use the scraper endpoint:

```bash
curl -s -X POST "https://kiuli.com/api/scrape-itinerary" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep SCRAPER_API_KEY ~/Projects/kiuli-website/.env.local | cut -d= -f2)" \
  -d '{"itrvlUrl": "https://itrvl.com/client/portal/sDafv7StYWDPEpQdzRZz4FB9ibXs803AxtuQ48eH15ixoHKVg3R5YvxOFCUZMzFa/680dff493cf205005cf76e8f"}'
```

### Step 11: Monitor the pipeline

Check Step Functions execution:
```bash
aws stepfunctions list-executions \
  --state-machine-arn arn:aws:states:eu-north-1:405531875262:stateMachine:kiuli-scraper-pipeline \
  --max-results 1 \
  --region eu-north-1
```

Monitor logs as the pipeline runs:
```bash
aws logs tail /aws/lambda/kiuli-v6-orchestrator --since 5m --region eu-north-1 --follow
```

### Step 12: Verify completion

Once the Step Functions execution shows SUCCEEDED:
1. Check the itinerary appeared in Payload admin at admin.kiuli.com
2. Check images loaded in the editor (should use imgixUrl now)
3. Check the hero image displays correctly
4. Try clicking the iTrvl source link in the editor header

---

## Completion checklist

- [ ] AWS CLI working (`aws sts get-caller-identity`)
- [ ] video-processor Lambda function name confirmed
- [ ] S3 PutObject permission added to Lambda role
- [ ] GitHub Actions secrets set (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
- [ ] shared/ synced across all Lambda directories
- [ ] All 6 Lambdas deployed to current HEAD
- [ ] `verify.sh` shows all CURRENT
- [ ] Test scrape completed end-to-end
- [ ] Itinerary visible in admin
- [ ] Images loading from imgix in editor
