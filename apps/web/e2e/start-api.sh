#!/usr/bin/env bash
# Starts an isolated CertiChain API for the E2E suite: fresh JSON store and encrypted document
# folder under apps/web/.e2e-run, seeded with the portfolio demo dataset. Never touches real data.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
RUN_DIR="$HERE/../.e2e-run"
rm -rf "$RUN_DIR"
mkdir -p "$RUN_DIR"
cd "$RUN_DIR"
export NODE_ENV=test
export PORT="${E2E_API_PORT:-4310}"
export CERTICHAIN_DATA_FILE="$RUN_DIR/data.json"
export CORS_ORIGIN="http://localhost:${E2E_WEB_PORT:-5310}"
export DATABASE_URL=""
export BLOCKCHAIN_RPC_URL=""
"$ROOT/node_modules/.bin/tsx" "$ROOT/apps/api/src/demoSeed.ts"
exec "$ROOT/node_modules/.bin/tsx" "$ROOT/apps/api/src/server.ts"
