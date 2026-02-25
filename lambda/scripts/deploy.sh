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
#
# What this script does:
#   1. Verifies AWS credentials are valid
#   2. Syncs shared modules to all Lambda directories
#   3. Installs dependencies (npm ci --platform=linux --arch=x64)
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
    scraper)         echo "kiuli-scraper" ;;
    orchestrator)    echo "kiuli-v6-orchestrator" ;;
    image-processor) echo "kiuli-v6-image-processor" ;;
    labeler)         echo "kiuli-v6-labeler" ;;
    finalizer)       echo "kiuli-v6-finalizer" ;;
    *)               echo "" ;;
  esac
}

# Source directory for each function
get_func_dir() {
  case "$1" in
    scraper)         echo "$LAMBDA_DIR" ;;           # scraper lives at lambda root
    orchestrator)    echo "$LAMBDA_DIR/orchestrator" ;;
    image-processor) echo "$LAMBDA_DIR/image-processor" ;;
    labeler)         echo "$LAMBDA_DIR/labeler" ;;
    finalizer)       echo "$LAMBDA_DIR/finalizer" ;;
  esac
}

# Files to include in the zip for each function
get_func_files() {
  case "$1" in
    scraper)         echo "handler.js node_modules/" ;;
    orchestrator)    echo "handler.js transform.js shared/ node_modules/" ;;
    image-processor) echo "handler.js processImage.js shared/ node_modules/" ;;
    labeler)         echo "handler.js labelImage.js shared/ node_modules/" ;;
    finalizer)       echo "handler.js generateSchema.js selectHero.js schemaValidator.js shared/ node_modules/" ;;
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
  echo "Available: scraper, orchestrator, image-processor, labeler, finalizer"
  exit 1
fi

AWS_FUNCTION_NAME=$(get_aws_name "$FUNCTION")
if [ -z "$AWS_FUNCTION_NAME" ]; then
  fail "Unknown function '$FUNCTION'. Available: scraper, orchestrator, image-processor, labeler, finalizer"
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

step 4 "Installing dependencies (npm ci --platform=linux --arch=x64)..."
cd "$FUNC_DIR"
# Force linux-x64 so native modules (e.g. Sharp) install Lambda-compatible
# binaries regardless of host architecture (macOS ARM, macOS Intel, etc.).
npm ci --silent \
  --platform=linux \
  --arch=x64 \
  --libc=glibc \
  2>&1 || fail "npm ci failed in $FUNC_DIR"
ok "Dependencies installed (linux-x64)"

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

step 6 "Deploying code to AWS Lambda..."
aws lambda update-function-code \
  --function-name "$AWS_FUNCTION_NAME" \
  --zip-file "fileb://$ZIP_PATH" \
  --region "$REGION" \
  --output text \
  --query "CodeSize" > /dev/null || fail "update-function-code failed"
ok "Code uploaded"

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
