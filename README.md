# EpicTools App

First hosted app for Epic 4x4 guest readiness tools.

## Routes

- `/team/readiness` - staff readiness dashboard
- `/team/arrival-board` - TV arrival board
- `/kiosk` - guest kiosk gateway placeholder
- `/visit/[token]` - guest portal placeholder

## Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The app reads:

- `guest_readiness_dashboard_scan_document_links_v3`
- `guest_arrival_board_v`

## Cancellation Agreement

EpicTools can send a reservation-specific cancellation agreement through CallRail SMS, Resend email, both channels, or a copied secure link. The guest opens the link, accepts the applicable TripSafe policy, signs on their phone, and the dashboard displays the result.

Before deployment:

1. Apply `supabase/migrations/20260805_cancellation_agreements.sql` to the Epic Supabase project.
2. Create a dedicated CallRail API V3 key with **Allow Writes** enabled and select one SMS-enabled CallRail tracking number for agreement delivery.
3. Add these server-only variables in Vercel:

```bash
CALLRAIL_API_KEY=
CALLRAIL_ACCOUNT_NUMERIC_ID=
CALLRAIL_COMPANY_NUMERIC_ID=
CALLRAIL_TRACKING_NUMBER=+14355551234
AGREEMENT_BASE_URL=https://team.myepicreservation.com
```

Never prefix CallRail credentials with `NEXT_PUBLIC_` or commit their values. Existing Resend email variables, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`, and `EPIC_PREVIEW_TOKEN` variables are also required.

Until CallRail SMS is fully configured, staff can send through Resend email or use **Copy Link** in the reservation drawer. Every delivery method uses the same secure link and evidence workflow.

## Development

```bash
npm install
npm run dev
```

Deployment trigger refreshed for Vercel.
