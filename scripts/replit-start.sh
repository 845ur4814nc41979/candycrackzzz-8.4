#!/usr/bin/env bash
set -euo pipefail

# Candy CrackZZZ Replit import starter
#
# Replit's preview/canvas expects something to bind port 5000 quickly. The
# real Vite dev server runs on 5001, and scripts/proxy-server.cjs binds 5000
# immediately, then forwards HTTP/WebSocket traffic to Vite. This prevents the
# recurring white screen / 502 after checkpoints and fresh imports.
#
# Ports:
#   5000 = instant preview proxy for Replit webview
#   5001 = Vite dev server
#   3001 = Express/API server

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCK_DIR="/tmp/candy-crackzzz-start.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "Another Candy CrackZZZ startup is already running. Waiting quietly so we do not kill the active preview..."
  while ! curl -fsS "http://127.0.0.1:5000/" >/dev/null 2>&1; do
    sleep 1
  done
  echo "Preview is already available on port 5000. Holding workflow alive."
  tail -f /dev/null
fi
cleanup_lock() {
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup_lock EXIT

# If a previous workflow already has the app healthy, do not disrupt it.
if curl -fsS "http://127.0.0.1:5000/" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:3001/api/cc/bootstrap" >/dev/null 2>&1; then
  echo "Candy CrackZZZ is already healthy on ports 5000 and 3001. Holding workflow alive."
  tail -f /dev/null
fi

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

# Clean only the specific app ports. 5000 is the preview proxy, 5001 is Vite,
# and 3001 is the API. Do this after the health check so we do not kill a good run.
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
trap 'cleanup; cleanup_lock' EXIT

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
