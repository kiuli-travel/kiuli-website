#!/bin/bash
# =============================================================================
# Kiuli Lambda Deployment Script
# =============================================================================
#
# Usage:
#   ./deploy.sh <function>
#   ./deploy.sh orchestrator
#   ./deploy.sh image-processor
#   ./deploy.sh labeler
#   ./deploy.sh finalizer
#   ./deploy.sh scraper
#   ./deploy.sh video-processor
#
# What this script does:
#   1. Verifies AWS credentials are valid
#   2. Syncs shared modules to all Lambda directories
#   3. Installs dependencies (npm ci with linux-x64 target)
#   4. Packages the function into a zip
#   5. Deploys to AWS Lambda
#   6. Waits for the update to complete (aws lambda wait)
#   7. Stamps the function Description with the current git hash + timestamp
#   8. Waits for configuration update to complete
#   9. Verifies: State=Active and Description contains correct git hash
#  10. Cleans up the zip file
#
# The git hash stamp in the Description is the verification mechanism.
# It lets Claude (Strategic) confirm what's deployed by calling lambda_status.
#
# Note on --platform=linux --arch=x64:
#   Native modules (Sharp, etc.) ship architecture-specific prebuilt binaries.
#   npm ci without platform flags installs host-native binaries (e.g. darwin-arm64
#   on macOS Apple Silicon), which fail on Lambda (linux-x64). These flags force
#   npm to install the correct Lambda-compatible binaries regardless of host OS.
#
# =============================================================================

set -e          # Exit immediately on any error
set -o pipefail # Pipe failures are also errors

REGION="eu-north-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LAMBDA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$LAMBDA_DIR/.." && pwd)"

# ---------------------------------------------------------------------------
# Function definitions
# ---------------------------------------------------------------------------

# AWS function names for each logical name
get_aws_name() {
  case "$1" in
    scraper)          echo "kiuli-scraper" ;;
    orchestrator)     echo "kiuli-v6-orchestrator" ;;
    image-processor)  echo "kiuli-v6-image-processor" ;;
    labeler)          echo "kiuli-v6-labeler" ;;
    finalizer)        echo "kiuli-v6-finalizer" ;;
    video-processor)  echo "kiuli-v6-video-processor" ;;
    *)                echo "" ;;
  esac
}

# Source directory for each function
get_func_dir() {
  case "$1" in
    scraper)          echo "$LAMBDA_DIR" ;;           # scraper lives at lambda root
    orchestrator)     echo "$LAMBDA_DIR/orchestrator" ;;
    image-processor)  echo "$LAMBDA_DIR/image-processor" ;;
    labeler)          echo "$LAMBDA_DIR/labeler" ;;
    finalizer)        echo "$LAMBDA_DIR/finalizer" ;;
    video-processor)  echo "$LAMBDA_DIR/video-processor" ;;
  esac
}

# Files to include in the zip for each function
get_func_files() {
  case "$1" in
    scraper)          echo "handler.js node_modules/" ;;
    orchestrator)     echo "handler.js transform.js shared/ node_modules/" ;;
    image-processor)  echo "handler.js processImage.js shared/ node_modules/" ;;
    labeler)          echo "handler.js labelImage.js shared/ node_modules/" ;;
    finalizer)        echo "handler.js generateSchema.js selectHero.js schemaValidator.js shared/ node_modules/" ;;
    video-processor)  echo "handler.js shared/ node_modules/" ;;
  esac
}

step() {
  echo ""
  echo "[$1/$TOTAL_STEPS] $2"
}

ok() {
  echo "             OK — $1"
}

fail() {
  echo ""
  echo "ERROR: $1"
  echo ""
  exit 1
}

# ---------------------------------------------------------------------------
# Validate input
# ---------------------------------------------------------------------------

FUNCTION="$1"
TOTAL_STEPS=9

if [ -z "$FUNCTION" ]; then
  echo "Usage: ./deploy.sh <function>"
  echo "Available: scraper, orchestrator, image-processor, labeler, finalizer, video-processor"
  exit 1
fi

AWS_FUNCTION_NAME=$(get_aws_name "$FUNCTION")
if [ -z "$AWS_FUNCTION_NAME" ]; then
  fail "Unknown function '$FUNCTION'. Available: scraper, orchestrator, image-processor, labeler, finalizer, video-processor"
fi

FUNC_DIR=$(get_func_dir "$FUNCTION")
FUNC_FILES=$(get_func_files "$FUNCTION")
ZIP_PATH="$LAMBDA_DIR/${FUNCTION}-deploy.zip"

GIT_HASH=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
GIT_COMMIT=$(git -C "$PROJECT_ROOT" log -1 --format="%h %s" 2>/dev/null || echo "unknown")
DEPLOYED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DESCRIPTION="git:${GIT_HASH} deployed:${DEPLOYED_AT}"

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  KIULI LAMBDA DEPLOYMENT"
echo "============================================================"
echo "  Function:  $FUNCTION"
echo "  AWS name:  $AWS_FUNCTION_NAME"
echo "  Region:    $REGION"
echo "  Git hash:  $GIT_HASH"
echo "  Commit:    $GIT_COMMIT"
echo "  Timestamp: $DEPLOYED_AT"
echo "============================================================"

# ---------------------------------------------------------------------------
# Step 1: Verify AWS credentials
# ---------------------------------------------------------------------------

step 1 "Verifying AWS credentials..."
IDENTITY=$(aws sts get-caller-identity --region "$REGION" 2>&1) || fail "AWS credentials invalid or not configured. Run 'aws configure' or check your environment."
ACCOUNT=$(echo "$IDENTITY" | python3 -c "import sys,json; print(json.loads(sys.stdin.read())['Account'])" 2>/dev/null || echo "unknown")
ok "Account $ACCOUNT"

# ---------------------------------------------------------------------------
# Step 2: Verify Lambda function exists
# ---------------------------------------------------------------------------

step 2 "Verifying Lambda function exists..."
aws lambda get-function-configuration \
  --function-name "$AWS_FUNCTION_NAME" \
  --region "$REGION" \
  --query "State" \
  --output text > /dev/null || fail "Lambda function '$AWS_FUNCTION_NAME' not found in $REGION. Check function name."
ok "$AWS_FUNCTION_NAME found"

# ---------------------------------------------------------------------------
# Step 3: Sync shared modules
# ---------------------------------------------------------------------------

step 3 "Syncing shared modules..."
cd "$LAMBDA_DIR"
./sync-shared.sh || fail "sync-shared.sh failed"
ok "Shared modules in sync"

# ---------------------------------------------------------------------------
# Step 4: Install dependencies
# ---------------------------------------------------------------------------

step 4 "Installing dependencies for linux-x64 Lambda runtime..."
cd "$FUNC_DIR"
# npm 11 dropped --platform/--arch CLI flags but the config settings still
# work as environment variables. Setting npm_config_os=linux and
# npm_config_cpu=x64 makes npm resolve platform-specific packages (Sharp,
# etc.) as if running on linux-x64. This means:
#   - @img/sharp-linux-x64 installs naturally (no EBADPLATFORM)
#   - @img/sharp-darwin-arm64 is skipped (wrong platform)
#   - The zip contains only linux-x64 native binaries
# This applies harmlessly to functions without native modules.
npm_config_os=linux npm_config_cpu=x64 npm ci --silent \
  2>&1 || fail "npm ci failed in $FUNC_DIR"
ok "Dependencies installed (linux-x64 target)"

# ---------------------------------------------------------------------------
# Step 5: Package
# ---------------------------------------------------------------------------

step 5 "Creating deployment package..."
rm -f "$ZIP_PATH"
cd "$FUNC_DIR"

# shellcheck disable=SC2086  # word splitting is intentional for FUNC_FILES
zip -r "$ZIP_PATH" $FUNC_FILES \
  --exclude "*.DS_Store" \
  --exclude "*.git*" \
  --exclude "node_modules/.cache/*" \
  > /dev/null || fail "zip packaging failed"

ZIP_SIZE=$(du -h "$ZIP_PATH" | cut -f1)
ok "Package created: $(basename "$ZIP_PATH") ($ZIP_SIZE)"

# ---------------------------------------------------------------------------
# Step 6: Deploy code
# ---------------------------------------------------------------------------

# AWS Lambda direct upload limit is ~70MB. The scraper includes Puppeteer +
# Chromium and exceeds this. For zips over 50MB, upload to S3 first, then
# reference the S3 object in update-function-code. This is the standard AWS
# pattern for large Lambda packages.

S3_DEPLOY_BUCKET="kiuli-bucket"
S3_DEPLOY_PREFIX="lambda-deploys"
MAX_DIRECT_UPLOAD_BYTES=$((50 * 1024 * 1024))  # 50MB threshold

ZIP_SIZE_BYTES=$(wc -c < "$ZIP_PATH" | tr -d ' ')

if [ "$ZIP_SIZE_BYTES" -gt "$MAX_DIRECT_UPLOAD_BYTES" ]; then
  # S3-based deployment for large packages
  S3_KEY="${S3_DEPLOY_PREFIX}/${FUNCTION}-deploy.zip"
  step 6 "Deploying code via S3 (zip is ${ZIP_SIZE}, exceeds direct upload limit)..."

  aws s3 cp "$ZIP_PATH" "s3://${S3_DEPLOY_BUCKET}/${S3_KEY}" \
    --region "$REGION" \
    --quiet || fail "S3 upload failed for s3://${S3_DEPLOY_BUCKET}/${S3_KEY}"
  ok "Uploaded to s3://${S3_DEPLOY_BUCKET}/${S3_KEY}"

  aws lambda update-function-code \
    --function-name "$AWS_FUNCTION_NAME" \
    --s3-bucket "$S3_DEPLOY_BUCKET" \
    --s3-key "$S3_KEY" \
    --region "$REGION" \
    --output text \
    --query "CodeSize" > /dev/null || fail "update-function-code (via S3) failed"
  ok "Code deployed from S3"
else
  # Direct upload for smaller packages
  step 6 "Deploying code to AWS Lambda (direct upload, ${ZIP_SIZE})..."
  aws lambda update-function-code \
    --function-name "$AWS_FUNCTION_NAME" \
    --zip-file "fileb://$ZIP_PATH" \
    --region "$REGION" \
    --output text \
    --query "CodeSize" > /dev/null || fail "update-function-code failed"
  ok "Code uploaded"
fi

# ---------------------------------------------------------------------------
# Step 7: Wait for code update to complete
# ---------------------------------------------------------------------------

step 7 "Waiting for code update to complete..."
aws lambda wait function-updated \
  --function-name "$AWS_FUNCTION_NAME" \
  --region "$REGION" || fail "Lambda failed to reach Active state after code update"
ok "Code update complete"

# ---------------------------------------------------------------------------
# Step 8: Stamp description with git hash
# ---------------------------------------------------------------------------

step 8 "Stamping function with git hash ($GIT_HASH)..."
aws lambda update-function-configuration \
  --function-name "$AWS_FUNCTION_NAME" \
  --description "$DESCRIPTION" \
  --region "$REGION" \
  --output text \
  --query "LastModified" > /dev/null || fail "update-function-configuration failed"

aws lambda wait function-updated \
  --function-name "$AWS_FUNCTION_NAME" \
  --region "$REGION" || fail "Lambda failed to reach Active state after configuration update"
ok "Description stamped"

# ---------------------------------------------------------------------------
# Step 9: Verify
# ---------------------------------------------------------------------------

step 9 "Verifying deployment..."
RESULT=$(aws lambda get-function-configuration \
  --function-name "$AWS_FUNCTION_NAME" \
  --region "$REGION" \
  --query '{LastModified:LastModified,CodeSize:CodeSize,State:State,Description:Description}' \
  --output json) || fail "get-function-configuration failed"

DEPLOYED_STATE=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['State'])")
DEPLOYED_DESC=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Description',''))")
DEPLOYED_SIZE=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['CodeSize'])")
DEPLOYED_TIME=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['LastModified'])")

if [ "$DEPLOYED_STATE" != "Active" ]; then
  fail "Function state is '$DEPLOYED_STATE', expected 'Active'"
fi

if [[ "$DEPLOYED_DESC" != *"$GIT_HASH"* ]]; then
  fail "Git hash $GIT_HASH not found in function description: '$DEPLOYED_DESC'"
fi

# Clean up zip
rm -f "$ZIP_PATH"
ok "Zip cleaned up"

# ---------------------------------------------------------------------------
# Success banner
# ---------------------------------------------------------------------------

echo ""
echo "============================================================"
echo "  DEPLOYMENT SUCCESSFUL"
echo "============================================================"
echo "  Function:     $AWS_FUNCTION_NAME"
echo "  State:        $DEPLOYED_STATE"
echo "  Git hash:     $GIT_HASH"
echo "  Code size:    $DEPLOYED_SIZE bytes"
echo "  Last modified: $DEPLOYED_TIME"
echo "  Description:  $DEPLOYED_DESC"
echo "============================================================"
echo ""
echo "Next step: Run a test scrape and check CloudWatch logs"
echo "  aws logs tail /aws/lambda/$AWS_FUNCTION_NAME --since 10m --region $REGION"
echo ""
