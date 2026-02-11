#!/usr/bin/env bash
set -euo pipefail

# Run content-system SQL migrations
# Usage: ./content-system/migrations/run.sh "$DATABASE_URL_UNPOOLED"

DB_URL="${1:?Usage: run.sh <DATABASE_URL>}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Running content-system migrations ==="

for sql_file in "$SCRIPT_DIR"/0*.sql; do
  filename=$(basename "$sql_file")
  echo "→ Running $filename..."
  psql "$DB_URL" -f "$sql_file" -v ON_ERROR_STOP=1
  echo "  ✓ $filename complete"
done

echo "=== All migrations complete ==="
