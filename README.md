# xPortal — Standalone Client Portal

Client-facing companion to xPM: project status, deliverable approvals, messaging,
meeting booking, and billing in one white-labeled workspace.

## Phase 1 (local) — current state

```bash
cd xportal
cp .env.example .env.local   # dev defaults work as-is, no real secrets needed
npm install
npm run dev                  # http://localhost:3100
```

- **Database:** built-in `node:sqlite` at `data/xportal.db` (auto-created and
  auto-seeded in dev; schema bumps recreate it automatically via `PRAGMA user_version`).
- **Client sign-in:** `client@example.com` (Jane) or `sam@example.com` at `/` or the
  branded `/p/acme`, then copy the magic link printed in the **server console**.
- **Operator sign-in:** `operator@example.com` at `/admin/login` — manage clients,
  branding (logo + accent color), contacts, projects, milestones, deliverables
  (file upload or link, versioned), invoices (issue / mark paid / resolve disputes),
  and message replies.
- **Files:** uploads stored under `uploads/`, served via authenticated
  `/api/files/...`; swap `src/lib/storage.js` for Supabase Storage in Phase 2.
- **Stripe:** `POST /api/webhooks/stripe` accepts unsigned `payment_intent.succeeded`
  test payloads locally (it flips the invoice matching `metadata.invoice_number`
  to Paid). Signature verification activates as soon as `STRIPE_WEBHOOK_SECRET` is set,
  and is mandatory in production.
- **xPM bridge:**
  - Inbound: `POST /api/bridge/xpm` with header `X-XPM-Bridge-Secret` upserts
    top-level project status by `xpm_project_id`.
  - Outbound: approvals/revisions/messages/bookings POST to `XPM_WEBHOOK_URL`
    (or log to console when unset).
- **Calendar:** local slot generator in `src/lib/calendar.js`; bookings table is
  the source of truth.

## Phase 2 (Vercel + Supabase) migration map

| Concern | Phase 1 | Phase 2 swap point |
|---|---|---|
| Database | `node:sqlite` via `src/lib/db.js` | Supabase Postgres — schema in `db.js` is a 1:1 mirror of the spec's Postgres DDL; replace `getDb()` call sites' prepared statements with supabase-js or a pg pool |
| Email | console logger | set `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` (already implemented in `src/lib/mailer.js`) |
| Payments | unsigned test webhooks | set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Vercel env |
| Calendar | local slot stub | Google Calendar freebusy behind `getAvailableSlots()` |
| Files | local paths / external URLs | Supabase Storage URLs in `deliverables_approvals.asset_url` |

**Secrets policy:** all credentials go in `.env.local` (local) or Vercel project env
(production). Never commit them; never share them in chat or tickets.
