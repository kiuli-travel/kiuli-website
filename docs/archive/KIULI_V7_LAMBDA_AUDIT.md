# KIULI V7 LAMBDA AUDIT — Diagnostic Script

**Purpose:** Establish ground truth of what's actually deployed and working  
**Owner:** Graham Wallington  
**Date:** January 21, 2026

---

## EXECUTION INSTRUCTIONS

Run this entire script autonomously. Do not stop for approval. Report findings in structured format at the end.

```bash
#!/bin/bash

echo "======================================================================"
echo "KIULI V7 LAMBDA AUDIT"
echo "======================================================================"
echo ""

# Navigate to project
cd /Users/grahamwallington/Projects/kiuli-website || exit 1

# Section 1: LAMBDA DEPLOYMENT STATE
echo "=== 1. LAMBDA DEPLOYMENT STATE ==="
echo ""

# Check if Lambda exists
LAMBDA_EXISTS=$(aws lambda get-function --function-name kiuli-pipeline-worker --region eu-north-1 2>&1)
if echo "$LAMBDA_EXISTS" | grep -q "FunctionName"; then
  echo "Lambda Status: DEPLOYED"
  
  # Get Lambda details
  aws lambda get-function-configuration \
    --function-name kiuli-pipeline-worker \
    --region eu-north-1 \
    --query '{Runtime:Runtime,Timeout:Timeout,Memory:MemorySize,LastModified:LastModified}' \
    --output json
    
  # Get Lambda URL
  LAMBDA_URL=$(aws lambda get-function-url-config \
    --function-name kiuli-pipeline-worker \
    --region eu-north-1 \
    --query 'FunctionUrl' \
    --output text 2>/dev/null)
  
  if [ -n "$LAMBDA_URL" ]; then
    echo "Lambda URL: $LAMBDA_URL"
  else
    echo "Lambda URL: NOT CONFIGURED"
  fi
  
  # Check environment variables
  echo ""
  echo "Lambda Environment Variables:"
  aws lambda get-function-configuration \
    --function-name kiuli-pipeline-worker \
    --region eu-north-1 \
    --query 'Environment.Variables' \
    --output json | python3 -c "
import sys, json
env = json.load(sys.stdin)
for key in sorted(env.keys()):
  val = env[key]
  if 'KEY' in key or 'SECRET' in key:
    print(f'  {key}: [REDACTED]')
  else:
    print(f'  {key}: {val}')
"
else
  echo "Lambda Status: NOT DEPLOYED"
  echo "Error: $LAMBDA_EXISTS"
fi

echo ""

# Section 2: VERCEL CONFIGURATION
echo "=== 2. VERCEL CONFIGURATION ==="
echo ""

# Check Vercel environment variables
echo "Vercel Environment Variables (production):"
vercel env ls 2>&1 | grep -E "LAMBDA_|PAYLOAD_|GEMINI_|S3_" || echo "No Lambda-related env vars found"

echo ""

# Check actual endpoint behavior
echo "Testing /api/scrape-itinerary endpoint:"
ENDPOINT_TEST=$(curl -s -X POST "https://admin.kiuli.com/api/scrape-itinerary" \
  -H "Content-Type: application/json" \
  -d '{"test": true}' 2>&1)

if echo "$ENDPOINT_TEST" | grep -q "jobId"; then
  echo "Endpoint Mode: ASYNC (V4 Lambda)"
elif echo "$ENDPOINT_TEST" | grep -q "payloadId"; then
  echo "Endpoint Mode: SYNC (Old Vercel)"
elif echo "$ENDPOINT_TEST" | grep -q "500"; then
  echo "Endpoint Mode: ERROR (500)"
  echo "Error: $ENDPOINT_TEST"
else
  echo "Endpoint Mode: UNKNOWN"
  echo "Response: $ENDPOINT_TEST"
fi

echo ""

# Section 3: DATABASE SCHEMA STATE
echo "=== 3. DATABASE SCHEMA STATE ==="
echo ""

# Check for V4 fields (itineraryId, price)
echo "Testing V4 Fields (itineraryId, price):"
curl -s "https://admin.kiuli.com/api/itineraries?limit=1" \
  -H "Authorization: Bearer YOUR_PAYLOAD_API_KEY" \
  | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  if data.get('docs') and len(data['docs']) > 0:
    doc = data['docs'][0]
    has_itinerary_id = 'itineraryId' in doc
    has_price = 'price' in doc
    print(f'  itineraryId field: {'PRESENT' if has_itinerary_id else 'MISSING'}')
    print(f'  price field: {'PRESENT' if has_price else 'MISSING'}')
  else:
    print('  No itineraries in database')
except Exception as e:
  print(f'  Error: {e}')
"

echo ""

# Check for V7 fields (titleItrvl, titleEnhanced, etc)
echo "Testing V7 Fields (two-field pattern):"
curl -s "https://admin.kiuli.com/api/itineraries?limit=1" \
  -H "Authorization: Bearer YOUR_PAYLOAD_API_KEY" \
  | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  if data.get('docs') and len(data['docs']) > 0:
    doc = data['docs'][0]
    
    # Check root level V7 fields
    has_title_itrvl = 'titleItrvl' in doc
    has_title_enhanced = 'titleEnhanced' in doc
    has_title_reviewed = 'titleReviewed' in doc
    
    print(f'  titleItrvl: {'PRESENT' if has_title_itrvl else 'MISSING'}')
    print(f'  titleEnhanced: {'PRESENT' if has_title_enhanced else 'MISSING'}')
    print(f'  titleReviewed: {'PRESENT' if has_title_reviewed else 'MISSING'}')
    
    # Check days structure
    if 'days' in doc and len(doc['days']) > 0:
      day = doc['days'][0]
      has_day_title_itrvl = 'titleItrvl' in day
      print(f'  days[0].titleItrvl: {'PRESENT' if has_day_title_itrvl else 'MISSING'}')
      
      if 'segments' in day and len(day['segments']) > 0:
        seg = day['segments'][0]
        has_seg_desc_itrvl = 'descriptionItrvl' in seg
        print(f'  days[0].segments[0].descriptionItrvl: {'PRESENT' if has_seg_desc_itrvl else 'MISSING'}')
    
  else:
    print('  No itineraries in database')
except Exception as e:
  print(f'  Error: {e}')
"

echo ""

# Check ItineraryJobs for V4 progress fields
echo "Testing ItineraryJobs V4 Fields:"
curl -s "https://admin.kiuli.com/api/itinerary-jobs?limit=1&sort=-createdAt" \
  -H "Authorization: Bearer YOUR_PAYLOAD_API_KEY" \
  | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  if data.get('docs') and len(data['docs']) > 0:
    job = data['docs'][0]
    has_progress = 'progress' in job
    has_total_images = 'totalImages' in job
    print(f'  progress field: {'PRESENT' if has_progress else 'MISSING'}')
    print(f'  totalImages field: {'PRESENT' if has_total_images else 'MISSING'}')
  else:
    print('  No jobs in database')
except Exception as e:
  print(f'  Error: {e}')
"

echo ""

# Section 4: LAMBDA CODE STATE
echo "=== 4. LAMBDA CODE STATE ==="
echo ""

# Check if Lambda handler exists locally
if [ -f "lambda/pipeline-worker/handler.js" ]; then
  echo "Local Lambda Code: EXISTS"
  
  # Check for V7 transform logic
  if grep -q "titleItrvl\|titleEnhanced" lambda/pipeline-worker/handler.js; then
    echo "V7 Transform Logic: PRESENT in handler.js"
  else
    echo "V7 Transform Logic: MISSING from handler.js"
  fi
  
  # Check if there's a separate transform file
  if [ -f "lambda/pipeline-worker/phases/transform.js" ]; then
    echo "Transform Module: EXISTS"
    if grep -q "titleItrvl\|titleEnhanced" lambda/pipeline-worker/phases/transform.js; then
      echo "V7 Transform Logic: PRESENT in transform.js"
    else
      echo "V7 Transform Logic: MISSING from transform.js"
    fi
  else
    echo "Transform Module: DOES NOT EXIST"
  fi
  
  # Check ingest phase
  if [ -f "lambda/pipeline-worker/phases/ingest.js" ]; then
    echo "Ingest Module: EXISTS"
    if grep -q "titleItrvl\|titleEnhanced" lambda/pipeline-worker/phases/ingest.js; then
      echo "V7 Field Mapping: PRESENT in ingest.js"
    else
      echo "V7 Field Mapping: MISSING from ingest.js"
    fi
  fi
else
  echo "Local Lambda Code: DOES NOT EXIST"
fi

echo ""

# Check old pipeline files
echo "Old Pipeline Files:"
if [ -f "pipelines/run_full_pipeline.cjs" ]; then
  echo "  run_full_pipeline.cjs: EXISTS (legacy)"
fi
if [ -f "loaders/payload_ingester.cjs" ]; then
  echo "  payload_ingester.cjs: EXISTS"
  if grep -q "titleItrvl\|titleEnhanced" loaders/payload_ingester.cjs; then
    echo "    V7 Logic: PRESENT"
  else
    echo "    V7 Logic: MISSING"
  fi
fi

echo ""

# Section 5: COLLECTION STATE
echo "=== 5. COLLECTION STATE ==="
echo ""

# Check VoiceConfiguration collection
VOICE_COUNT=$(curl -s "https://admin.kiuli.com/api/voice-configuration" \
  -H "Authorization: Bearer YOUR_PAYLOAD_API_KEY" \
  | python3 -c "import sys, json; print(json.load(sys.stdin).get('totalDocs', 0))")
echo "VoiceConfiguration docs: $VOICE_COUNT"

# Check Destinations collection
DEST_COUNT=$(curl -s "https://admin.kiuli.com/api/destinations" \
  -H "Authorization: Bearer YOUR_PAYLOAD_API_KEY" \
  | python3 -c "import sys, json; print(json.load(sys.stdin).get('totalDocs', 0))")
echo "Destinations docs: $DEST_COUNT"

# Check TripTypes collection
TRIP_COUNT=$(curl -s "https://admin.kiuli.com/api/trip-types" \
  -H "Authorization: Bearer YOUR_PAYLOAD_API_KEY" \
  | python3 -c "import sys, json; print(json.load(sys.stdin).get('totalDocs', 0))")
echo "TripTypes docs: $TRIP_COUNT"

echo ""

# Section 6: MEDIA PERMISSIONS TEST
echo "=== 6. MEDIA PERMISSIONS TEST ==="
echo ""

# Try to create a test media record
echo "Testing media creation permissions:"
TEST_RESULT=$(curl -s -X POST "https://admin.kiuli.com/api/media" \
  -H "Authorization: Bearer YOUR_PAYLOAD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "alt": "Test image",
    "sourceUrl": "https://example.com/test.jpg"
  }' 2>&1)

if echo "$TEST_RESULT" | grep -q "\"id\""; then
  echo "Media Creation: SUCCESS"
  # Delete test record
  TEST_ID=$(echo "$TEST_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('doc',{}).get('id',''))")
  if [ -n "$TEST_ID" ]; then
    curl -s -X DELETE "https://admin.kiuli.com/api/media/$TEST_ID" \
      -H "Authorization: Bearer YOUR_PAYLOAD_API_KEY" > /dev/null
    echo "Test record cleaned up"
  fi
elif echo "$TEST_RESULT" | grep -q "403"; then
  echo "Media Creation: FAILED (403 Forbidden)"
elif echo "$TEST_RESULT" | grep -q "401"; then
  echo "Media Creation: FAILED (401 Unauthorized)"
else
  echo "Media Creation: UNKNOWN"
  echo "Response: $TEST_RESULT"
fi

echo ""

# Section 7: GIT STATE
echo "=== 7. GIT STATE ==="
echo ""

git status --short | head -20
echo ""
echo "Uncommitted files count: $(git status --short | wc -l)"

echo ""
echo "======================================================================"
echo "AUDIT COMPLETE"
echo "======================================================================"
```

---

## REQUIRED OUTPUT FORMAT

After running the script, produce this report:

```
KIULI V7 LAMBDA AUDIT REPORT
=============================
Date: [timestamp]

1. LAMBDA DEPLOYMENT
   Status: DEPLOYED / NOT DEPLOYED / ERROR
   Runtime: [runtime]
   Timeout: [seconds]
   Memory: [MB]
   URL: [url or NOT CONFIGURED]
   Last Modified: [date]
   
   Environment Variables:
   - PAYLOAD_API_URL: [present/missing]
   - PAYLOAD_API_KEY: [present/missing]
   - GEMINI_API_KEY: [present/missing]
   - S3_BUCKET: [present/missing]
   - INVOKE_SECRET: [present/missing]

2. VERCEL CONFIGURATION
   Lambda env vars in Vercel: [present/missing]
   Endpoint behavior: ASYNC (V4) / SYNC (Old) / ERROR / UNKNOWN
   
3. DATABASE SCHEMA
   V4 Fields (itineraryId, price): PRESENT / MISSING / PARTIAL
   V7 Fields (titleItrvl, titleEnhanced): PRESENT / MISSING / PARTIAL
   ItineraryJobs V4 Fields: PRESENT / MISSING
   
4. LAMBDA CODE
   Local handler.js: EXISTS / MISSING
   V7 transform logic in Lambda: PRESENT / MISSING
   Transform module: EXISTS / MISSING
   V7 logic in ingest: PRESENT / MISSING
   
   Legacy Files:
   - run_full_pipeline.cjs: [exists/missing]
   - payload_ingester.cjs: [exists/missing] (V7: [present/missing])

5. COLLECTIONS
   VoiceConfiguration: [count] docs
   Destinations: [count] docs
   TripTypes: [count] docs

6. PERMISSIONS
   Media creation: SUCCESS / FAILED (403) / FAILED (401) / UNKNOWN

7. GIT
   Uncommitted files: [count]
   
CRITICAL ISSUES
===============
[List all blocking issues found]

RECOMMENDATION
==============
[What needs to be done to reach V7 with Lambda]
```

---

## AFTER COMPLETION

Save this report to `/Users/grahamwallington/Projects/kiuli-website/AUDIT_REPORT.md` and report findings.
