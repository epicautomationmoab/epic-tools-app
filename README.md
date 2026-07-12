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

## Development

```bash
npm install
npm run dev
```
