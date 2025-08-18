#!/usr/bin/env bash
set -euo pipefail
echo "[validate] checking /api/ready"
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/ready || echo "000")
if [[ "$code" != "200" ]]; then
  echo "❌ /api/ready returned $code"
  exit 1
fi
echo "✅ ready OK"