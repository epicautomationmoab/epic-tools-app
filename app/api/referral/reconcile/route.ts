import { NextResponse } from "next/server";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}
async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) }, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

type WebhookRow = { id: string; created_at: string; payload: Record<string, any> };
type ReservationRow = { id: string; confirmation_code: string | null; tripworks_trip_id: string | null; booking_id: string | null; customer_name: string | null; customer_email: string | null; experience_name: string | null; business_line: string | null; reserved_at: string | null; start_time: string | null; total_sales_cents: number | null; total_amount_cents: number | null };
function slugFrom(payload: any) { try { const value = new URL(String(payload?.mkt_landing_url || "")).searchParams.get("ref")?.trim().toLowerCase() || ""; return /^[a-z0-9][a-z0-9-]{0,79}$/.test(value) ? value : null; } catch { return null; } }
function orders(payload: any) { return Array.isArray(payload?.tripOrders) ? payload.tripOrders : []; }
function bookingId(payload: any) { return orders(payload).flatMap((o: any) => Array.isArray(o?.bookings) ? o.bookings : [])[0]?.id?.toString() || null; }
function orderFor(payload: any, id: string | null) { const list = orders(payload); return id ? list.find((o: any) => (Array.isArray(o?.bookings) ? o.bookings : []).some((b: any) => String(b?.id) === id)) || list[0] : list[0]; }
function bookingFor(order: any, id: string | null) { const list = Array.isArray(order?.bookings) ? order.bookings : []; return id ? list.find((b: any) => String(b?.id) === id) || list[0] : list[0]; }
function revenue(payload: any, reservation: ReservationRow, order: any) { if (Number.isFinite(order?.total_sales)) return Number(order.total_sales); if (Number.isFinite(payload?.total_sales)) return Number(payload.total_sales); if (Number.isFinite(payload?.subtotal)) return Number(payload.subtotal); return reservation.total_sales_cents ?? reservation.total_amount_cents ?? 0; }
function isTripSafe(a: any) { const n = `${a?.name || ""} ${a?.experience_addon?.title || ""}`.toLowerCase(); return n.includes("tripsafe") || n.includes("optional travel protection"); }
function isAssure(a: any) { return `${a?.name || ""} ${a?.experience_addon?.title || ""}`.toLowerCase().includes("adventure assure"); }
function protection(order: any, booking: any) {
  const addons = Array.isArray(booking?.addons) ? booking.addons : [];
  const assure = addons.filter(isAssure).reduce((s: number, a: any) => s + (Number.isFinite(a?.price) ? Math.max(0, Number(a.price)) : 0), 0);
  const selectedTripSafe = addons.some((a: any) => isTripSafe(a) && /^yes\b/i.test(String(a?.name || "")));
  let tripSafe = 0;
  if (selectedTripSafe && Number.isFinite(order?.addons_total)) {
    const other = addons.reduce((s: number, a: any) => isTripSafe(a) ? s : s + (Number.isFinite(a?.price) ? Math.max(0, Number(a.price)) : 0), 0);
    tripSafe = Math.max(0, Number(order.addons_total) - other);
  }
  return { tripSafe, assure, total: Math.max(0, tripSafe + assure) };
}
function rewards(partner: any, eligible: number) { return partner.reward_basis === "percent" ? { partner: Math.max(0, Math.round(eligible * (Number(partner.partner_reward_percent) || 0) / 100)), guest: Math.max(0, Math.round(eligible * (Number(partner.guest_discount_percent) || 0) / 100)) } : { partner: Math.max(0, Number(partner.partner_reward_cents) || 0), guest: Math.max(0, Number(partner.guest_discount_cents) || 0) }; }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const events = await rest<WebhookRow[]>("webhook_events?event_type=eq.trip_reserved&select=id,created_at,payload&order=created_at.desc&limit=250");
    let attributed = 0, refreshed = 0, skipped = 0; const errors: string[] = [];
    for (const event of events) {
      try {
        const payload = event.payload || {}; const slug = slugFrom(payload); if (!slug) { skipped++; continue; }
        const confirmation = typeof payload?.confirmation_code === "string" ? payload.confirmation_code : null; const tripId = payload?.id ? String(payload.id) : null; if (!confirmation && !tripId) { skipped++; continue; }
        const partners = await rest<any[]>(`referral_partners?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id,slug,reward_mode,reward_basis,partner_reward_cents,partner_reward_percent,guest_discount_cents,guest_discount_percent,promo_code,attribution_window_days&limit=1`); const partner = partners[0]; if (!partner) { skipped++; continue; }
        const filter = confirmation ? `confirmation_code=eq.${encodeURIComponent(confirmation)}` : `tripworks_trip_id=eq.${encodeURIComponent(tripId!)}`;
        const reservations = await rest<ReservationRow[]>(`operational_reservations?${filter}&select=id,confirmation_code,tripworks_trip_id,booking_id,customer_name,customer_email,experience_name,business_line,reserved_at,start_time,total_sales_cents,total_amount_cents&order=updated_at.desc&limit=10`); if (!reservations.length) { skipped++; continue; }
        const bid = bookingId(payload); const reservation = bid ? reservations.find((r) => r.booking_id === bid) || reservations[0] : reservations[0];
        const order = orderFor(payload, reservation.booking_id || bid); const booking = bookingFor(order, reservation.booking_id || bid); const bookedAt = payload?.reserved_at || payload?.created_at || reservation.reserved_at || event.created_at;
        const existing = await rest<any[]>(`referral_bookings?operational_reservation_id=eq.${encodeURIComponent(reservation.id)}&select=id,metadata,reward_status&limit=1`);
        if (existing[0]) {
          await rest<void>(`referral_bookings?id=eq.${encodeURIComponent(existing[0].id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ confirmation_code: confirmation || reservation.confirmation_code, tripworks_trip_id: tripId || reservation.tripworks_trip_id, booking_id: reservation.booking_id || bid, customer_name: booking?.customer?.full_name || payload?.customer?.full_name || reservation.customer_name, customer_email: booking?.customer?.email || payload?.customer?.email || reservation.customer_email, experience_name: reservation.experience_name, business_line: reservation.business_line, activity_start_at: reservation.start_time, updated_at: new Date().toISOString() }) });
          refreshed++; continue;
        }
        const preTax = revenue(payload, reservation, order); const excluded = protection(order, booking); const eligible = partner.reward_basis === "percent" ? Math.max(0, preTax - excluded.total) : preTax; const calc = rewards(partner, eligible);
        const visits = await rest<any[]>(`referral_visits?partner_id=eq.${encodeURIComponent(partner.id)}&occurred_at=lte.${encodeURIComponent(bookedAt)}&expires_at=gte.${encodeURIComponent(bookedAt)}&select=id,occurred_at&order=occurred_at.desc&limit=1`);
        await rest<void>("referral_bookings", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ partner_id: partner.id, referral_visit_id: visits[0]?.id || null, operational_reservation_id: reservation.id, confirmation_code: confirmation || reservation.confirmation_code, tripworks_trip_id: tripId || reservation.tripworks_trip_id, booking_id: reservation.booking_id || bid, customer_name: booking?.customer?.full_name || payload?.customer?.full_name || reservation.customer_name, customer_email: booking?.customer?.email || payload?.customer?.email || reservation.customer_email, experience_name: reservation.experience_name, business_line: reservation.business_line, booked_at: bookedAt, activity_start_at: reservation.start_time, attributed_at: new Date().toISOString(), booking_status: "booked", booking_revenue_cents: preTax, eligible_revenue_cents: eligible, partner_reward_cents: calc.partner, guest_discount_cents: calc.guest, promo_code_used: partner.promo_code, reward_status: "pending", metadata: { attribution_source: "tripworks_mkt_landing_url", referral_slug: slug, webhook_event_id: event.id, mkt_landing_url: payload?.mkt_landing_url || null, reward_basis: partner.reward_basis, pre_tax_sales_cents: preTax, excluded_tripsafe_cents: excluded.tripSafe, excluded_adventure_assure_cents: excluded.assure, eligible_referral_revenue_cents: eligible, original_eligible_revenue_cents: eligible, original_partner_reward_cents: calc.partner, commission_ceiling_locked_at: new Date().toISOString() }, updated_at: new Date().toISOString() }) }); attributed++;
      } catch (error) { errors.push(error instanceof Error ? error.message : "Unknown referral reconciliation error"); }
    }
    return NextResponse.json({ ok: true, scanned: events.length, attributed, refreshed, skipped, errors: errors.slice(0, 10) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Referral reconciliation failed." }, { status: 500 }); }
}
