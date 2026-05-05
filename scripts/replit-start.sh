#!/usr/bin/env bash
set -euo pipefail

# Candy CrackZZZ — unified startup script
#
# PURPOSE: Start ALL three services so the preview never goes blank.
#
# Port architecture:
#   5000 = embedded Preview proxy      (this script — scripts/proxy-server.cjs)
#   5001 = Vite dev server             (artifact workflow OR this script)
#   3001 = Express/API server          (artifact workflow OR this script)
#
# Each service is started here only if its port is not already occupied.
# If the artifact workflows are already running, we skip — no conflicts.
# If they are NOT running (session resume, workflow restart, etc.), we
# start them in the background so the preview is never blank.

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

# ── Helper: is a port already bound? ────────────────────────────────────────
port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$port" >/dev/null 2>&1
  else
    curl -fsS "http://127.0.0.1:${port}/" >/dev/null 2>&1
  fi
}

# ── Helper: free a port (used only for the proxy on 5000) ───────────────────
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

# ── Cleanup on exit ──────────────────────────────────────────────────────────
API_PID=""
VITE_PID=""
PROXY_PID=""
cleanup() {
  kill "${PROXY_PID:-}" 2>/dev/null || true
  kill "${API_PID:-}" 2>/dev/null || true
  kill "${VITE_PID:-}" 2>/dev/null || true
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

# ── Start API server on port 3001 if not already running ────────────────────
if port_in_use 3001; then
  echo "API server already running on port 3001 (artifact workflow active)."
else
  echo "Starting API server on port 3001..."
  pnpm --filter @workspace/api-server run dev &
  API_PID=$!
  echo "API server started (pid $API_PID)."
fi

# ── Start Vite on port 5001 if not already running ──────────────────────────
if port_in_use 5001; then
  echo "Vite already running on port 5001 (artifact workflow active)."
else
  echo "Starting Vite dev server on port 5001..."
  pnpm --filter @workspace/candy-crackzzz run dev &
  VITE_PID=$!
  echo "Vite started (pid $VITE_PID)."
fi

# ── Wait for Vite to be ready before starting the proxy ─────────────────────
echo "Waiting for Vite on port 5001..."
for i in $(seq 1 60); do
  if port_in_use 5001; then
    echo "Vite is up."
    break
  fi
  sleep 1
done

# ── Free port 5000 and start the preview proxy ──────────────────────────────
freeport 5000
echo "Starting embedded Preview proxy  5000 → Vite 5001..."
PREVIEW_PROXY_PORT=5000 VITE_TARGET_PORT=5001 node scripts/proxy-server.cjs &
PROXY_PID=$!

# ── Keep alive ───────────────────────────────────────────────────────────────
wait "$PROXY_PID"
