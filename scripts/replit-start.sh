#!/usr/bin/env bash
set -euo pipefail

# Candy CrackZZZ — embedded Replit Preview starter
#
# PURPOSE: This script drives the *embedded* Replit Preview pane (the
# webview inside the IDE). It only starts the proxy on port 5000.
#
# The artifact workflows handle everything else:
#   artifacts/api-server: API Server  → port 3001
#   artifacts/candy-crackzzz: web     → port 5001 (Vite)
#
# Port architecture:
#   5000 = embedded Preview proxy/webview  (scripts/proxy-server.cjs)
#   5001 = Vite dev server                 (artifact workflow)
#   3001 = Express/API server              (artifact workflow)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# ── Lock: only one instance of this startup script at a time ────────────────
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

# ── Free port 5000 (proxy only — do NOT touch 3001 or 5001) ─────────────────
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

# ── Cleanup on exit ──────────────────────────────────────────────────────────
cleanup() {
  kill "${PROXY_PID:-}" 2>/dev/null || true
}
trap 'cleanup; cleanup_lock' EXIT

# ── Install dependencies ─────────────────────────────────────────────────────
echo "Installing dependencies..."
pnpm install

# ── Push DB schema if DATABASE_URL is available ──────────────────────────────
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Creating/updating database tables..."
  pnpm --filter @workspace/db run push
else
  echo "DATABASE_URL not set — using file-storage fallback."
fi

# ── Start preview proxy so port 5000 opens immediately ───────────────────────
echo "Starting embedded Preview proxy  5000 → Vite 5001..."
PREVIEW_PROXY_PORT=5000 VITE_TARGET_PORT=5001 node scripts/proxy-server.cjs &
PROXY_PID=$!

# ── Keep alive while proxy is alive ──────────────────────────────────────────
wait "$PROXY_PID"
