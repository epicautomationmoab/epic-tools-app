-- REVIEW/STAGING ONLY — execute in this order after validating all consumers.
-- CURRENT STATE (2026-10-24): service_role lacks SELECT on this view.
-- 1. Grant server-role access before switching the Arrival Board query.
GRANT SELECT ON TABLE public.guest_arrival_board_with_handoff_v TO service_role;
-- 2. Deploy code that uses fetchView(..., true) for this view;
--    verify guest-facing Arrival Board renders and updates.
-- 3. Only then revoke anonymous SELECT on the view, alongside the
--    other planned, fully audited view revocations.
-- Do not use the service-role grant itself as a replacement for
-- app-level payload minimization (implemented separately).
