#!/bin/bash
# Sync canonical shared/ to each Lambda's shared/ directory
#
# Run this before deployment to ensure all Lambda functions have
# the same version of shared utilities.
#
# Usage: cd lambda && ./sync-shared.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$SCRIPT_DIR/shared"
LAMBDAS="orchestrator image-processor labeler finalizer video-processor"

echo "Syncing shared files from $SHARED_DIR..."

for lambda in $LAMBDAS; do
  target="$SCRIPT_DIR/$lambda/shared"
  if [ -d "$target" ]; then
    echo "  -> $lambda/shared/"
    cp -f "$SHARED_DIR"/*.js "$target/"
    cp -f "$SHARED_DIR"/package.json "$target/" 2>/dev/null || true
  else
    echo "  [SKIP] $lambda/shared/ does not exist"
  fi
done

echo ""
echo "Sync complete. Verifying..."

# Verify all openrouter.js files are identical
CANONICAL_HASH=$(md5 -q "$SHARED_DIR/openrouter.js" 2>/dev/null || md5sum "$SHARED_DIR/openrouter.js" | cut -d' ' -f1)
ALL_MATCH=true

for lambda in $LAMBDAS; do
  target="$SCRIPT_DIR/$lambda/shared/openrouter.js"
  if [ -f "$target" ]; then
    TARGET_HASH=$(md5 -q "$target" 2>/dev/null || md5sum "$target" | cut -d' ' -f1)
    if [ "$CANONICAL_HASH" != "$TARGET_HASH" ]; then
      echo "  [MISMATCH] $lambda/shared/openrouter.js"
      ALL_MATCH=false
    fi
  fi
done

if [ "$ALL_MATCH" = true ]; then
  echo "  All shared files in sync!"
else
  echo "  WARNING: Some files did not sync correctly"
  exit 1
fi
