#!/bin/bash
# =============================================================================
# Kiuli Lambda Deployment Verification
# =============================================================================
#
# Usage:
#   ./verify.sh             # Check all functions
#   ./verify.sh orchestrator # Check one function
#
# Reads the deployed Description field (which contains the git hash stamped
# by deploy.sh) and compares it against the current HEAD.
#
# This script does NOT deploy anything. It is safe to run at any time.
#
# Exit codes:
#   0 — all checked functions match HEAD
#   1 — one or more functions are behind HEAD or have no hash stamped
#
# =============================================================================

set -o pipefail

REGION="eu-north-1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

declare -A FUNCTIONS=(
  ["scraper"]="kiuli-scraper"
  ["orchestrator"]="kiuli-v6-orchestrator"
  ["image-processor"]="kiuli-v6-image-processor"
  ["labeler"]="kiuli-v6-labeler"
  ["finalizer"]="kiuli-v6-finalizer"
)

# Current HEAD
CURRENT_HASH=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
CURRENT_COMMIT=$(git -C "$PROJECT_ROOT" log -1 --format="%h %s %cd" --date=format:"%Y-%m-%d %H:%M" 2>/dev/null || echo "unknown")

echo ""
echo "============================================================"
echo "  KIULI LAMBDA DEPLOYMENT STATUS"
echo "============================================================"
echo "  Current HEAD: $CURRENT_HASH"
echo "  Commit:       $CURRENT_COMMIT"
echo "============================================================"
printf "  %-20s %-12s %-30s %s\n" "FUNCTION" "STATUS" "DEPLOYED HASH" "LAST MODIFIED"
echo "  ----------------------------------------------------------------------------"

TARGET="${1:-all}"
ALL_CURRENT=true

for KEY in scraper orchestrator image-processor labeler finalizer; do
  # Skip if targeting a specific function
  if [ "$TARGET" != "all" ] && [ "$TARGET" != "$KEY" ]; then
    continue
  fi

  AWS_NAME="${FUNCTIONS[$KEY]}"

  RESULT=$(aws lambda get-function-configuration \
    --function-name "$AWS_NAME" \
    --region "$REGION" \
    --query '{LastModified:LastModified,State:State,Description:Description}' \
    --output json 2>/dev/null)

  if [ $? -ne 0 ] || [ -z "$RESULT" ]; then
    printf "  %-20s %-12s %-30s %s\n" "$KEY" "ERROR" "could not reach AWS" ""
    ALL_CURRENT=false
    continue
  fi

  STATE=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['State'])" 2>/dev/null)
  DESC=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('Description',''))" 2>/dev/null)
  LAST_MODIFIED=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['LastModified'][:16])" 2>/dev/null)

  # Extract git hash from description (format: "git:abc1234 deployed:...")
  DEPLOYED_HASH=$(echo "$DESC" | grep -oE 'git:[a-f0-9]+' | cut -d: -f2 || echo "")

  if [ -z "$DEPLOYED_HASH" ]; then
    STATUS="NO HASH"
    ALL_CURRENT=false
  elif [ "$DEPLOYED_HASH" = "$CURRENT_HASH" ]; then
    STATUS="CURRENT"
  else
    STATUS="BEHIND"
    ALL_CURRENT=false
  fi

  printf "  %-20s %-12s %-30s %s\n" "$KEY" "$STATUS" "${DEPLOYED_HASH:-none}" "$LAST_MODIFIED"
done

echo "============================================================"

if [ "$ALL_CURRENT" = true ]; then
  echo "  All functions are current."
  echo ""
  exit 0
else
  echo "  One or more functions are not current with HEAD."
  echo "  Run: cd lambda/scripts && ./deploy.sh <function>"
  echo ""
  exit 1
fi
