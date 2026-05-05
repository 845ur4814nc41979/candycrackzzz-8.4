#!/usr/bin/env bash
set -euo pipefail

# Candy CrackZZZ — Replit starter
#
# Starts all three services:
#   3001 = Express/API server
#   5001 = Vite frontend dev server
#   5000 = Preview proxy (forwards to Vite on 5001)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ── Lock: only one instance at a time ────────────────────────────────────────
LOCK_DIR="/tmp/candy-crackzzz-start.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another Candy CrackZZZ startup is already running. Waiting for port 5000..."
  while ! curl -fsS "http://127.0.0.1:5000/" >/dev/null 2>&1; do
    sleep 1
  done
  echo "Port 5000 is up. Holding workflow alive."
  tail -f /dev/null
fi
cleanup_lock() { rmdir "$LOCK_DIR" 2>/dev/null || true; }
trap cleanup_lock EXIT

# ── Free ports ────────────────────────────────────────────────────────────────
freeport() {
  local port="$1"
  local pids=""
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
  fi
  if [ -n "$pids" ]; then
    echo "Freeing port $port (pids: $pids)..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}
freeport 5000
freeport 5001
freeport 3001

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  kill "${PROXY_PID:-}" "${VITE_PID:-}" "${API_PID:-}" 2>/dev/null || true
}
trap 'cleanup; cleanup_lock' EXIT

# ── Install dependencies ──────────────────────────────────────────────────────
echo "Installing dependencies..."
pnpm install

# ── Push DB schema if DATABASE_URL is available ───────────────────────────────
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Creating/updating database tables..."
  pnpm --filter @workspace/db run push
else
  echo "DATABASE_URL not set — using file-storage fallback."
fi

# ── Build and start API server ────────────────────────────────────────────────
echo "Building API server..."
PORT=3001 API_PORT=3001 pnpm --filter @workspace/api-server run build

echo "Starting API server on port 3001..."
PORT=3001 API_PORT=3001 NODE_ENV=development node --enable-source-maps artifacts/api-server/dist/index.mjs &
API_PID=$!

# ── Start Vite frontend dev server ────────────────────────────────────────────
echo "Starting Vite frontend on port 5001..."
FRONTEND_PORT=5001 API_PORT=3001 pnpm --filter @workspace/candy-crackzzz run dev &
VITE_PID=$!

# ── Start preview proxy so port 5000 opens immediately ───────────────────────
echo "Starting Preview proxy 5000 → Vite 5001..."
PREVIEW_PROXY_PORT=5000 VITE_TARGET_PORT=5001 node scripts/proxy-server.cjs &
PROXY_PID=$!

# ── Wait for any child to exit ────────────────────────────────────────────────
wait -n "${PROXY_PID}" "${VITE_PID}" "${API_PID}" 2>/dev/null || wait
