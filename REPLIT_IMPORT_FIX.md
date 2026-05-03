# Candy CrackZZZ 8.4 — Replit Import Fix & Architecture Reference

Run `bash scripts/diagnose-replit.sh` first whenever something breaks.

---

## Final port architecture

| Port | Role | Managed by |
|------|------|-----------|
| **5000** | Embedded Replit Preview proxy/webview | `scripts/proxy-server.cjs` via `scripts/replit-start.sh` |
| **5001** | Vite dev server / public artifact URL | `artifacts/candy-crackzzz: web` artifact workflow |
| **3001** | Express / API server | `artifacts/api-server: API Server` artifact workflow |

The proxy on **5000** binds immediately so the Replit IDE preview pane sees an open port fast, then forwards HTTP/WebSocket to Vite on **5001**.

The public `picard.replit.dev` URL is routed by Replit's native artifact-router, which the platform starts automatically (in `previewMode=true`) when the `artifacts/candy-crackzzz: web` workflow runs.

---

## Symptom → cause → fix

### Public URL returns HTTP 502, but local ports 5000/5001/3001 all respond

**Cause:** Artifact workflow / public routing issue — nothing to do with React.

**Fix:**
1. Check the `artifacts/candy-crackzzz: web` workflow in the Replit IDE.
2. Confirm `artifacts/candy-crackzzz/.replit-artifact/artifact.toml` has `localPort = 5001`.
3. Confirm `artifacts/api-server/.replit-artifact/artifact.toml` has `localPort = 3001`.
4. Restart the `artifacts/candy-crackzzz: web` workflow.
5. Do **not** touch React, Vite config, or `scripts/replit-start.sh`.

### Embedded Preview (IDE webview) is broken, public URL works

**Cause:** `Start application` workflow / proxy / Vite issue.

**Fix:**
1. Check the `Start application` workflow output.
2. Confirm `scripts/proxy-server.cjs` is binding port 5000 and forwarding to 5001.
3. Confirm Vite is starting on port 5001 (`FRONTEND_PORT=5001`).
4. Restart the `Start application` workflow.

### HTTP 200 but blank white screen

**Cause:** React runtime / bootstrap / hydration error.

**Fix:**
1. Open browser DevTools → Console.
2. Look for JS errors, failed `/api/cc/bootstrap` requests, or React render panics.
3. Check `#root` in DevTools Elements to see if React mounted.
4. Check `artifacts/candy-crackzzz/src/main.tsx` — must use static `import App from "./App"`, no `await import()`.

---

## Rules — do not break these

- **Do NOT manually start Replit artifact-router** from `scripts/replit-start.sh` or any shell script.
  Manual runs use `previewMode=false` and do not register the public URL.
  The platform starts artifact-router automatically via the native artifact workflow.

- **Do NOT remove `FRONTEND_PORT=5001`** from `.replit [userenv.shared]` or artifact env config.
  5001 is the correct Vite / public URL port in this 8.4 architecture.

- **Do NOT switch Vite to port 5000** in `vite.config.ts`.
  Port 5000 is reserved for `scripts/proxy-server.cjs` (the embedded Preview proxy).

- **Do NOT add duplicate workflows** — only one `Start application` workflow; no extra `Project` workflow that also runs `Start application`.

- **Do NOT use `await import("./App")` or top-level async boot** in `main.tsx`.
  Static import only — async boot breaks Vite HMR.

---

## After importing into a fresh Replit

1. The platform will run `pnpm install` and start workflows automatically.
2. Add the required secrets in **Secrets**:
   - `DATABASE_URL` — Postgres connection string (add via Replit Database integration, or bring your own)
   - `SESSION_SECRET` — long random string (e.g. `openssl rand -hex 32`)
   - `ADMIN_USERNAME` — admin login username
   - `ADMIN_PASSWORD` — admin login password
3. Optional secrets for notifications:
   - `RESEND_API_KEY`, `ORDER_FROM_EMAIL`, `ORDER_NOTIFICATION_EMAIL` (email via Resend)
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_PHONE`, `ORDER_NOTIFICATION_PHONE` (SMS via Twilio)
   - `OPENAI_API_KEY` (AI product description writing)
4. Restart the **API Server** workflow after adding secrets.
5. Open `/admin` → **System Health** card to verify DB / email / SMS status.
6. If anything looks wrong, run: `bash scripts/diagnose-replit.sh`

---

## What changed in 8.4 import hardening

- `scripts/replit-start.sh` — lock folder prevents duplicate startup fights; health-check skips restart if app is already healthy; frees only ports 3001/5000/5001; never touches artifact-router; comments explain embedded-Preview-only role.
- `.replit` — single `Start application` workflow only; all four port env vars preserved; only ports 3001/5000/5001 mapped (8081 removed).
- `artifacts/candy-crackzzz/.replit-artifact/artifact.toml` — `localPort = 5001`, correct env vars.
- `artifacts/api-server/.replit-artifact/artifact.toml` — `localPort = 3001`, correct env vars, production run env set.
- `scripts/diagnose-replit.sh` — non-destructive diagnostic; prints architecture, env, processes, port checks, public URL check, artifact alignment, diagnosis guide.
- `REPLIT_IMPORT_FIX.md` — this file; replaces the old minimal version.
