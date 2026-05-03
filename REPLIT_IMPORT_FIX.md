# Candy CrackZZZ Replit Import Fix

Use this when the app is imported into a new Replit account and shows a blank white screen.

## What usually causes the white screen

The app needs two things before it can load correctly in a fresh Replit account:

1. Dependencies must be installed with `pnpm install`.
2. The database tables must be created with `pnpm --filter @workspace/db run push`.

The frontend also expects the API server to be running. The API server listens on port `3001`, and the frontend listens on port `5000`.

## Quick fix

In the Replit Shell, run:

```bash
bash scripts/replit-start.sh
```

That script does all of this:

```bash
pnpm install
pnpm --filter @workspace/db run push
PORT=3001 pnpm --filter @workspace/api-server run dev
PORT=5000 pnpm --filter @workspace/candy-crackzzz run dev
```

## Manual fix

If you prefer to do it manually, run these in order:

```bash
pnpm install
pnpm --filter @workspace/db run push
```

Then start both app parts:

```bash
PORT=3001 pnpm --filter @workspace/api-server run dev
```

and in another shell/workflow:

```bash
PORT=5000 pnpm --filter @workspace/candy-crackzzz run dev
```

## What to test

Open the frontend preview, not the API preview.

The frontend should be on port `5000`.

Then test:

- `/`
- `/menu`
- `/merch`
- `/admin/login`
- `/api/cc/bootstrap`

`/api/cc/bootstrap` should return JSON instead of a 500 error.

## Build checks

Run:

```bash
pnpm run typecheck
pnpm --filter @workspace/candy-crackzzz run build
pnpm --filter @workspace/api-server run build
```

## Existing white-screen safety files

These files are already included to avoid a silent blank page:

- `artifacts/candy-crackzzz/src/components/layout/AppStatusOverlays.tsx`
- `artifacts/candy-crackzzz/src/context/AppContext.tsx`
- `artifacts/candy-crackzzz/src/components/layout/ProtectedRoute.tsx`

They add a loading screen, fallback defaults, and a development warning instead of returning `null` forever.
