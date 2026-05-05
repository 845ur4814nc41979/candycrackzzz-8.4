#!/usr/bin/env bash
set -euo pipefail

fail=0

fail_msg() {
  printf '%s
' "$1"
  fail=1
}

if [ ! -f scripts/replit-start.sh ]; then
  fail_msg "scripts/replit-start.sh is missing. Fresh Replit imports need the proxy-only start script. Fix scripts/replit-start.sh."
  exit 1
fi

if [ ! -f .replit ]; then
  fail_msg ".replit is missing. Workflow ownership cannot be validated. Fix .replit."
  exit 1
fi

if [ ! -f artifacts/candy-crackzzz/.replit-artifact/artifact.toml ]; then
  fail_msg "artifacts/candy-crackzzz/.replit-artifact/artifact.toml is missing. The web workflow cannot own port 5001. Fix that file."
  exit 1
fi

if [ ! -f artifacts/api-server/.replit-artifact/artifact.toml ]; then
  fail_msg "artifacts/api-server/.replit-artifact/artifact.toml is missing. The API workflow cannot own port 3001. Fix that file."
  exit 1
fi

if grep -qF 'pnpm --filter @workspace/candy-crackzzz run dev' scripts/replit-start.sh; then
  fail_msg "scripts/replit-start.sh starts Vite. That breaks fresh imports by causing port conflicts with the artifact web workflow. Fix scripts/replit-start.sh."
fi

if grep -qF 'pnpm --filter @workspace/api-server run dev' scripts/replit-start.sh; then
  fail_msg "scripts/replit-start.sh starts the API server. That breaks fresh imports by causing port conflicts with the artifact API workflow. Fix scripts/replit-start.sh."
fi

if grep -qF 'REPLIT_ARTIFACT_ROUTER' scripts/replit-start.sh; then
  fail_msg "scripts/replit-start.sh references REPLIT_ARTIFACT_ROUTER. That is owned by native artifact workflows and must not be started here. Fix scripts/replit-start.sh."
fi

if grep -qF 'artifact-router' scripts/replit-start.sh; then
  fail_msg "scripts/replit-start.sh references artifact-router. That causes routing/startup confusion in fresh imports. Fix scripts/replit-start.sh."
fi

if [ "$(grep -cF 'scripts/replit-start.sh' .replit || true)" -ne 1 ]; then
  fail_msg ".replit must contain exactly one Start application workflow that calls scripts/replit-start.sh. Duplicate calls break fresh imports. Fix .replit."
fi

frontend_file=artifacts/candy-crackzzz/.replit-artifact/artifact.toml
if ! grep -qF 'localPort = 5001' "$frontend_file"; then
  fail_msg "$frontend_file must declare localPort = 5001. Without it, the web workflow cannot own the frontend port."
fi
if ! grep -qF 'PORT = "5001"' "$frontend_file"; then
  fail_msg "$frontend_file must declare PORT = \"5001\". Without it, the frontend workflow can drift off the expected port."
fi
if ! grep -qF 'FRONTEND_PORT = "5001"' "$frontend_file"; then
  fail_msg "$frontend_file must declare FRONTEND_PORT = \"5001\". Without it, the preview proxy target can break."
fi
if ! grep -qF 'API_PORT = "3001"' "$frontend_file"; then
  fail_msg "$frontend_file must declare API_PORT = \"3001\". Without it, API proxying can break."
fi

api_file=artifacts/api-server/.replit-artifact/artifact.toml
if ! grep -qF 'localPort = 3001' "$api_file"; then
  fail_msg "$api_file must declare localPort = 3001. Without it, the API workflow cannot own the backend port."
fi
if ! grep -qF 'PORT = "3001"' "$api_file"; then
  fail_msg "$api_file must declare PORT = \"3001\". Without it, the API workflow can drift off the expected port."
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "Replit startup architecture validation passed."
