#!/usr/bin/env bash
set -euo pipefail

# Candy CrackZZZ Replit import starter
#
# Ports:
#   5000 = instant preview proxy for Replit webview
#   5001 = Vite dev server
#   3001 = Express/API server

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

freeport 3001
freeport 5000
freeport 5001

# Start the preview proxy first so Replit registers port 5000 immediately.
echo "Starting Replit preview proxy on port 5000 -> Vite 5001..."
PREVIEW_PROXY_PORT=5000 VITE_TARGET_PORT=5001 node scripts/proxy-server.cjs &
PROXY_PID=$!

cleanup() {
  kill "${API_PID:-}" 2>/dev/null || true
  kill "${VITE_PID:-}" 2>/dev/null || true
  kill "${PROXY_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT

echo "Installing dependencies..."
pnpm install

if [ -n "${DATABASE_URL:-}" ]; then
  echo "Creating/updating database tables..."
  pnpm --filter @workspace/db run push
else
  echo "DATABASE_URL not set; using file storage fallback"
fi

echo "Starting API server on port 3001..."
PORT=3001 API_PORT=3001 pnpm --filter @workspace/api-server run dev &
API_PID=$!

echo "Starting Candy CrackZZZ Vite frontend on port 5001..."
FRONTEND_PORT=5001 PORT=5001 API_PORT=3001 pnpm --filter @workspace/candy-crackzzz run dev &
VITE_PID=$!

# Keep this workflow alive while either child process is alive.
wait -n "$API_PID" "$VITE_PID" "$PROXY_PID"
