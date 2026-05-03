# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Candy Crackzzz App

**Artifact**: `artifacts/candy-crackzzz` (React + Vite frontend) + `artifacts/api-server` (Express API at `/api/cc/*`)
**Preview path**: `/`

### Architecture
- **Backend persistence**: PostgreSQL via Drizzle (`@workspace/db`). Tables: `cc_state`, `cc_messages`, `cc_notifications`. JSON-file fallback only used when `DATABASE_URL` is unavailable.
- **Auth**: Multi-admin role-based access control. The bootstrap owner is seeded from `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars; additional admins are created from the `/admin/team` page (owners only). Passwords hashed with HMAC-SHA256 keyed by `SESSION_SECRET` (legacy SHA256 hashes are auto-migrated on first login). Sessions are signed cookies issued by the API server.
- **Roles & permissions**: 6 roles — `owner`, `site_admin`, `system_admin`, `campaign_admin`, `staff` (alias: `employee`), `viewer`. Each role maps to a set of permission flags (e.g. `manageProducts`, `manageOrders`, `manageRewards`, `manageMerch`, `manageCampaigns`, `manageBranding`, `managePayments`, `manageSiteSettings`, `manageSystemSettings`, `manageAdmins`, `manageMessages`, plus their `view*` counterparts). The map lives in `artifacts/api-server/src/routes/candy-storage.ts` (server) and `artifacts/candy-crackzzz/src/lib/permissions.ts` (client) — keep these two in sync. Owner has all permissions implicitly.
- **Route guarding**: `ProtectedRoute` accepts `requirePermission` or `requireAnyPermission` props and renders a friendly access-denied page (rather than silently redirecting) when an authenticated user lacks permission. The admin sidebar (`AdminLayout.tsx`) filters nav items by the same permissions.
- **Team management**: `/admin/team` (owner-only) lets owners add/edit/disable/delete admins and reset their temporary passwords. Backend endpoints at `POST/PATCH/DELETE /cc/auth/admin-users` and `POST /cc/auth/admin-users/:id/reset-password` are gated by `manageAdmins` and protect the last active owner from being demoted/disabled/deleted. Temporary passwords are returned exactly once in the API response (the "invite" payload) and shown in a dismissible banner on the Team page.
- **Public setup is disabled** — `/admin/setup` redirects to `/admin/login`; the bootstrap owner comes from env vars.
- **Notifications**: Email via Resend, SMS via Twilio. Both providers gracefully skip (with reason) when their secrets are missing — orders and messages still save and appear in the admin inbox + bell.
- ProtectedRoute redirects unauthenticated users to `/admin/login`.

### Public Pages
- `/` — Home: hero + logo, featured items, seasonal banner, reviews section
- `/menu` — Menu with category filter, search, product cards
- `/menu/:slug` — Product detail with add to cart
- `/gallery` — Photo gallery
- `/seasonal` — Seasonal specials
- `/custom-orders` — Custom order inquiry form
- `/cart` — Cart + order request form with conditional payment methods
- `/order-success` — Success after order submission
- `/contact` — Contact info, social links, contact form, leave-a-review form

### Admin Auth Flow
- `/admin/setup` — First-run only. Creates admin username + password. Never shown again after setup.
- `/admin/login` — Normal login after setup. Username visible, password masked with show/hide toggle.
- All `/admin/*` routes are protected by ProtectedRoute — redirects to setup or login if unauthorized.
- Logout clears sessionStorage session only (account stays in localStorage).

### Admin Pages (all protected)
- `/admin` — Dashboard with stats, recent orders, **System Health card** (DB / admin secrets / email / SMS) with Test Email + Test SMS buttons
- `/admin/products` — Product list management
- `/admin/products/new` — Add product with real image upload
- `/admin/products/:id/edit` — Edit product
- `/admin/orders` — Mobile-friendly order management with expandable cards and tap-friendly status buttons
- `/admin/messages` — Customer message inbox (read/unread, archive, delete, reply via mailto/sms)
- `/admin/reviews` — Review moderation (approve / hide / delete / feature)
- `/admin/settings` — 4-tab settings: General, Messages, Features, Logistics
- `/admin/branding` — Logo upload, preview, replace, remove
- `/admin/payments` — Full payment method toggles (Cash App, Venmo, Zelle, QR Code, Manual Invoice, Cash at Pickup, Square placeholder)
- `/admin/account` — Change admin password (account changes require env updates)

### Referral Sharing
- `src/lib/referralShare.ts` builds the share message from `settings.businessName`, `referralReferrerBonusPoints`, and `referralReferredCustomerBonusPoints`. Provides Web Share API + clipboard helpers and SMS / mailto fallback URL builders.
- `src/components/referrals/ReferralShareButton.tsx` is the reusable share button. It hides itself when `settings.enableReferrals` is false or when no code is provided. Uses `navigator.share` when available and falls back to a dropdown with Copy code, Copy message, SMS, and Email options. Wired into `RewardsPage`, `RewardsPagePlus`, `CartPage` (customer's own code), and `AdminRewards` (selected profile only — no other customer data is shared).

### Notification Bell & Sounds
- Bell icon in admin top bar polls `/api/cc/notifications` (default 12s, 4× slower when tab hidden).
- Shows unread count, lists recent notifications, supports mark-all-read, mark single read/unread, delete, and click-through to `/admin/messages` or `/admin/orders`.
- Sound system lives in `src/lib/notificationSounds.ts`. `unlockNotificationAudio()` is **async** and awaits `ctx.resume()` before flipping the in-memory `unlocked` flag — this is the gate that prevents silent first-call failures. `canPlayNotificationAudio()` returns true only when unlocked AND `ctx.state === 'running'`. All `play*` helpers are async, return `boolean`, and self-clear `unlocked` if the context dies mid-session so the UI re-prompts.
- `subscribeNotificationAudio(listener)` lets React components react to global unlock/lock state changes without polling.
- Debug logging is gated by `localStorage.cc_audio_debug === '1'` — set it in DevTools to trace `[notificationSounds]` / `[NotificationBell]` events while debugging.
- `NotificationSoundUnlockBanner` (rendered in `AdminLayout` above `{children}`) shows a full-width "Click to enable notification sounds" prompt whenever `notificationSoundsEnabled` is on but audio is locked. Clicking it awaits unlock and plays a confirmation chime.
- `NotificationBell` maps `type === 'order'` → order chime, `type === 'message'` → message chime, anything else → general chime. If a notification arrives while audio is locked, it sets a "Notification received. Click Enable Sounds…" warning inside the dropdown (not silent).
- `AdminSettings → Alerts → Notification Sounds` exposes the master toggle, volume slider, per-type toggles, and **Test Order/Message/General Sound** buttons that await unlock before playing and toast on browser block.
- Sounds are admin-only — customer pages never import the sound module.
- Backend (`artifacts/api-server/src/routes/candy.ts`) creates `type: "order"` for new orders and `type: "message"` for new contact submissions; everything else falls through to general.

### Key Features
- First-run admin setup → normal login → session-based auth → logout
- All admin routes protected; public storefront always accessible
- Payments are OFF by default; Square is disabled (Coming Soon)
- Customers only see payment methods the admin has enabled
- Reviews: customers submit on /contact (pending status) → admin approves/features → shown on homepage
- Featured reviews appear first on homepage; falls back to placeholder testimonials until real ones exist
- Message destination emails configurable in admin/settings → Messages tab
- Mobile admin: orders use expandable card layout with grid of tap-friendly status buttons
- Order statuses: New, Pending, Confirmed, Ready, Picked Up, Completed, Cancelled
- Logo management: upload custom logo, preview, remove (falls back to default Candy Crackzzz logo)

### Brand
- Default brand: Candy Crackzzz (never removed)
- Logo: `attached_assets/candy_crackzzz_2_1776628492110.png`
- Colors: hot pink (primary), electric blue (secondary), purple (accent), very dark purple background
- Font: Nunito (Google Fonts)
- Wouter v3 routing: Link renders as `<a>` directly — never nest `<a>` inside Link

## WHAT AUSTIN NEEDS TO DO NEXT

The app is production-ready and runs gracefully without the optional secrets below — orders and messages will still save and appear in the admin inbox + bell. Add the optional secrets only when you want live email/SMS alerts.

### Required (already set in this environment)
- `DATABASE_URL` — Postgres connection. Without it the app falls back to a temporary JSON file (data will not survive redeploys).
- `ADMIN_USERNAME` — admin login username (currently: `admin`)
- `ADMIN_PASSWORD` — admin login password (currently: `1234321` — change in Deployments → Secrets before going live)
- `SESSION_SECRET` — long random string used to sign session cookies and hash the admin password. Rotating this invalidates all sessions.

### Optional — Email alerts (Resend)
- `RESEND_API_KEY` — from https://resend.com/api-keys
- `ORDER_FROM_EMAIL` — verified sender address on your Resend domain (e.g. `orders@candycrackzzz.com`)
- `ORDER_NOTIFICATION_EMAIL` — where order/message alerts are delivered (defaults to the business email in admin settings)

### Optional — SMS alerts (Twilio)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_PHONE` — your Twilio number in E.164 format (e.g. `+15555550123`)
- `ORDER_NOTIFICATION_PHONE` — where order/message alerts are texted (defaults to the phone in admin settings)

### Optional — Branding
- `BUSINESS_NAME` — used in email subjects and SMS body when set (defaults to "Candy Crackzzz")

### How to add secrets
1. Open the Secrets pane in this Repl (or Deployments → Secrets for production).
2. Add each key/value pair from the list above.
3. Restart the **API Server** workflow (or redeploy).
4. Open `/admin` → **System Health** card → click **Test Email** / **Test SMS** to verify delivery.
