# EpicTools App

First hosted app for Epic 4x4 guest readiness tools.

## Routes

- `/team/readiness` - staff readiness dashboard
- `/team/arrival-board` - TV arrival board
- `/kiosk` - guest kiosk gateway placeholder
- `/visit/[token]` - guest portal placeholder

## Guest Readiness Architecture

Technical architecture and the current Guest Readiness / MPWR data path are documented in [`docs/guest-readiness-architecture.md`](docs/guest-readiness-architecture.md).

The staff readiness page currently reads from:

- `guest_readiness_with_handoff_v`

That view is built on the app-facing readiness layer and `guest_readiness_operational`. Do not infer production behavior from the existence of old Supabase functions, trigger functions, tables, or columns; verify the live frontend caller and active database path before changing automation.

## Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Cancellation Agreement

EpicTools can send a reservation-specific cancellation agreement through Podium text, Resend email, both channels, or a copied secure link. The guest opens the link, accepts the applicable TripSafe policy, signs on their phone, and the dashboard displays the result.

Before deployment:

1. Apply `supabase/migrations/20260805_cancellation_agreements.sql` to the Epic Supabase project.
2. Create a Podium Developer application with the `read_locations`, `write_messages`, and `read_messages` scopes. Use `https://epic-tools-app.vercel.app/api/podium/oauth/callback` as its redirect URL.
3. Add these server-only variables in Vercel:

```bash
PODIUM_CLIENT_ID=
PODIUM_CLIENT_SECRET=
PODIUM_REDIRECT_URI=https://epic-tools-app.vercel.app/api/podium/oauth/callback
AGREEMENT_BASE_URL=https://epic-tools-app.vercel.app
```

Never prefix Podium credentials with `NEXT_PUBLIC_` or commit their values. Existing Resend email variables, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `EPIC_PREVIEW_TOKEN` variables are also required.

4. After deploying, sign in to EpicTools once and open `/api/podium/oauth/start` to connect the Epic Podium account.

Until Podium is connected, staff can send through Resend email or use **Copy Link** in the reservation drawer. Every delivery method uses the same secure link and evidence workflow.

## Development

```bash
npm install
npm run dev
```

Deployment trigger refreshed for Vercel.
