# Lambda Deployment Guide

This document covers the deployment process for Kiuli's V6 scraper pipeline Lambda functions.

## Architecture Overview

The pipeline consists of 6 Lambda functions:

| Function | Purpose | Memory | Timeout |
|----------|---------|--------|---------|
| kiuli-scraper | Puppeteer web scraping | 2048MB | 300s |
| kiuli-v6-orchestrator | Job creation, data transform | 512MB | 120s |
| kiuli-v6-image-processor | Image download, S3 upload | 1024MB | 300s |
| kiuli-v6-video-processor | HLS to MP4 conversion | 1024MB | 300s |
| kiuli-v6-labeler | AI image enrichment | 512MB | 120s |
| kiuli-v6-finalizer | Segment linking, schema gen | 512MB | 60s |

## Pre-deployment Checklist

1. **Sync shared code**
   ```bash
   cd lambda
   ./sync-shared.sh
   ```

2. **Install dependencies for each Lambda**
   ```bash
   for dir in orchestrator image-processor labeler finalizer video-processor; do
     (cd $dir && npm ci)
   done
   ```

3. **Verify environment variables in AWS**
   - `PAYLOAD_API_KEY` - Payload CMS API key
   - `PAYLOAD_API_URL` - Payload CMS URL
   - `S3_BUCKET` - S3 bucket name
   - `AWS_REGION` - AWS region (eu-north-1)
   - `OPENROUTER_API_KEY` - OpenRouter API key (for labeler)

## Lambda Layers

### Scraper Lambda
Requires Chromium layer for Puppeteer:
- ARN: `arn:aws:lambda:eu-north-1:XXX:layer:chromium:XX`
- The scraper expects `@sparticuz/chromium` at `/opt/nodejs/node_modules`

### Video Processor Lambda
Requires FFmpeg layer:
- ARN: `arn:aws:lambda:eu-north-1:XXX:layer:ffmpeg:XX`
- FFmpeg binary expected at `/opt/bin/ffmpeg`

## IAM Permissions

The `kiuli-scraper-lambda-role` requires:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::kiuli-bucket/media/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "lambda:InvokeFunction"
      ],
      "Resource": [
        "arn:aws:lambda:eu-north-1:*:function:kiuli-v6-*"
      ]
    }
  ]
}
```

## Deployment Commands

### Package and Deploy All Lambdas

```bash
cd lambda
./sync-shared.sh

# Package each function
for dir in orchestrator image-processor labeler finalizer video-processor; do
  echo "Packaging $dir..."
  (cd $dir && npm ci && zip -r ../$dir.zip .)
done

# Deploy using AWS CLI (example)
aws lambda update-function-code \
  --function-name kiuli-v6-orchestrator \
  --zip-file fileb://orchestrator.zip \
  --region eu-north-1

# Repeat for each function...
```

### Deploy Single Function

```bash
cd lambda/image-processor
npm ci
zip -r ../image-processor.zip .
aws lambda update-function-code \
  --function-name kiuli-v6-image-processor \
  --zip-file fileb://../image-processor.zip \
  --region eu-north-1
```

## Common Issues

### Missing @sparticuz/chromium
**Error:** `Cannot find module '@sparticuz/chromium'`
**Solution:** Ensure Chromium layer is attached to scraper Lambda.

### FFmpeg not found
**Error:** `ENOENT: /opt/bin/ffmpeg`
**Solution:** Ensure FFmpeg layer is attached to video-processor Lambda.

### S3 Access Denied
**Error:** `AccessDenied: User is not authorized to perform: s3:PutObject`
**Solution:** Update IAM policy to include s3:PutObject for video paths.

### 413 Payload Too Large
**Error:** `Request Entity Too Large`
**Solution:** Use `depth=0` in Payload API queries. Already implemented in shared/payload.js.

## Verification

After deployment, verify the pipeline works:

1. **Trigger a test scrape** via admin UI
2. **Monitor CloudWatch logs** for each Lambda
3. **Check job status** in Payload CMS admin
4. **Verify images** appear in S3 and itinerary

## Rollback

To rollback to a previous version:

```bash
aws lambda update-function-code \
  --function-name kiuli-v6-orchestrator \
  --s3-bucket kiuli-lambda-deployments \
  --s3-key backups/orchestrator-YYYY-MM-DD.zip \
  --region eu-north-1
```

## Support

- **Logs:** CloudWatch Logs in eu-north-1
- **Metrics:** CloudWatch Metrics for invocations, errors, duration
- **Alerts:** Configure SNS alerts for function errors
