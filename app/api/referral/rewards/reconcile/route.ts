import { NextResponse } from "next/server";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

function getTripOrders(payload: any) { return Array.isArray(payload?.tripOrders) ? payload.tripOrders : []; }
function findOrder(payload: any, bookingId: string | null) {
  const orders = getTripOrders(payload);
  if (!bookingId) return orders[0] || null;
  return orders.find((order: any) => (Array.isArray(order?.bookings) ? order.bookings : []).some((b: any) => String(b?.id) === bookingId)) || orders[0] || null;
}
function findBooking(order: any, bookingId: string | null) {
  const bookings = Array.isArray(order?.bookings) ? order.bookings : [];
  if (!bookingId) return bookings[0] || null;
  return bookings.find((b: any) => String(b?.id) === bookingId) || bookings[0] || null;
}
function isTripSafe(addon: any) {
  const name = `${addon?.name || ""} ${addon?.experience_addon?.title || ""}`.toLowerCase();
  return name.includes("tripsafe") || name.includes("optional travel protection");
}
function isAdventureAssure(addon: any) {
  const name = `${addon?.name || ""} ${addon?.experience_addon?.title || ""}`.toLowerCase();
  return name.includes("adventure assure");
}
function protectionExclusion(order: any, booking: any) {
  const addons = Array.isArray(booking?.addons) ? booking.addons : [];
  const selectedTripSafe = addons.some((addon: any) => isTripSafe(addon) && /^yes\b/i.test(String(addon?.name || "")));
  const assureTotal = addons.filter((addon: any) => isAdventureAssure(addon)).reduce((sum: number, addon: any) => sum + (Number.isFinite(addon?.price) ? Math.max(0, Number(addon.price)) : 0), 0);
  let tripSafeTotal = 0;
  if (selectedTripSafe && Number.isFinite(order?.addons_total)) {
    const other = addons.reduce((sum: number, addon: any) => isTripSafe(addon) ? sum : sum + (Number.isFinite(addon?.price) ? Math.max(0, Number(addon.price)) : 0), 0);
    tripSafeTotal = Math.max(0, Number(order.addons_total) - other);
  }
  return Math.max(0, tripSafeTotal + assureTotal);
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const referrals = await rest<any[]>(`referral_bookings?reward_status=in.(pending,earned)&select=${encodeURIComponent("id,partner_id,operational_reservation_id,confirmation_code,booking_id,business_line,eligible_revenue_cents,partner_reward_cents,reward_status,earned_at,metadata")}&limit=500`);
    let earned = 0, voided = 0, adjusted = 0, skipped = 0;
    const errors: string[] = [];

    for (const referral of referrals) {
      try {
        const reservations = await rest<any[]>(`operational_reservations?id=eq.${encodeURIComponent(referral.operational_reservation_id)}&select=${encodeURIComponent("id,confirmation_code,booking_id,business_line,total_sales_cents,total_amount_cents,is_cancelled,cancellation_status,latest_payload,trip_payload,booking_payload,start_time")}&limit=1`);
        const reservation = reservations[0];
        if (!reservation) { skipped++; continue; }

        if (reservation.is_cancelled || String(reservation.cancellation_status || "").toLowerCase().includes("cancel")) {
          if (referral.reward_status !== "voided") {
            await rest<void>(`referral_bookings?id=eq.${encodeURIComponent(referral.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ booking_status: "cancelled", reward_status: "voided", partner_reward_cents: 0, voided_at: new Date().toISOString(), updated_at: new Date().toISOString() }) });
            await rest<void>("referral_reward_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ referral_booking_id: referral.id, event_type: "voided", amount_cents: 0, notes: "Referral booking cancelled before reward completion." }) });
            voided++;
          }
          continue;
        }

        const originalEligible = Math.max(0, Number(referral.metadata?.original_eligible_revenue_cents ?? referral.metadata?.eligible_referral_revenue_cents ?? referral.eligible_revenue_cents ?? 0));
        const originalReward = Math.max(0, Number(referral.metadata?.original_partner_reward_cents ?? referral.partner_reward_cents ?? 0));
        const lockedBasis = String(referral.metadata?.reward_basis || (originalEligible > 0 && originalReward !== 0 ? "percent" : "flat")).toLowerCase();
        const lockedRate = lockedBasis === "percent" && originalEligible > 0 ? originalReward / originalEligible : 0;

        const payload = reservation.latest_payload || reservation.booking_payload || reservation.trip_payload || {};
        const order = findOrder(payload, reservation.booking_id || referral.booking_id || null);
        const booking = findBooking(order, reservation.booking_id || referral.booking_id || null);
        const currentSales = Number.isFinite(reservation.total_sales_cents) ? Number(reservation.total_sales_cents) : (Number.isFinite(reservation.total_amount_cents) ? Number(reservation.total_amount_cents) : originalEligible);
        const currentEligibleRaw = lockedBasis === "percent" ? Math.max(0, currentSales - protectionExclusion(order, booking)) : currentSales;
        const payableEligible = lockedBasis === "percent" ? Math.min(originalEligible, currentEligibleRaw) : currentEligibleRaw;
        const payableReward = lockedBasis === "percent" ? Math.min(originalReward, Math.max(0, Math.round(payableEligible * lockedRate))) : originalReward;

        if (payableReward < Number(referral.partner_reward_cents || 0) || payableEligible < Number(referral.eligible_revenue_cents || 0)) {
          await rest<void>(`referral_bookings?id=eq.${encodeURIComponent(referral.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ eligible_revenue_cents: payableEligible, partner_reward_cents: payableReward, metadata: { ...(referral.metadata || {}), original_eligible_revenue_cents: originalEligible, original_partner_reward_cents: originalReward, locked_reward_basis: lockedBasis, latest_eligible_revenue_cents: currentEligibleRaw, commission_cap_applied: currentEligibleRaw > originalEligible, reward_last_reconciled_at: new Date().toISOString() }, updated_at: new Date().toISOString() }) });
          await rest<void>("referral_reward_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ referral_booking_id: referral.id, event_type: "adjusted", amount_cents: payableReward, notes: "Reward adjusted downward under the reward terms locked when this referral was booked; increases remain capped at the original referral value." }) });
          adjusted++;
        }

        const confirmation = reservation.confirmation_code || referral.confirmation_code || "";
        const line = String(reservation.business_line || referral.business_line || "").toLowerCase();

        const [boardRows, handoffRows] = await Promise.all([
          rest<any[]>(`guest_arrival_board_v?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=business_line,has_checked_in_status,has_rental_out_status&limit=10`),
          rest<any[]>(`epic_operational_handoffs?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=business_line,handoff_status,recorded_at&order=recorded_at.desc&limit=20`),
        ]);

        const liveTourCheckedIn = boardRows.some((row) => Boolean(row.has_checked_in_status));
        const handoffStatuses = new Set(handoffRows.map((row) => String(row.handoff_status || "").toLowerCase()));

        let completed = false;
        let completionSource = "";
        if (line === "tour") {
          completed = liveTourCheckedIn || handoffStatuses.has("checked_in") || handoffStatuses.has("tour_returned");
          completionSource = liveTourCheckedIn ? "tour_checked_in_live" : handoffStatuses.has("checked_in") ? "tour_checked_in_handoff" : handoffStatuses.has("tour_returned") ? "tour_returned_fallback" : "";
        } else if (line === "rental") {
          completed = handoffStatuses.has("rental_returned");
          completionSource = completed ? "rental_returned" : "";
        } else {
          completed = liveTourCheckedIn || handoffStatuses.has("checked_in") || handoffStatuses.has("tour_returned") || handoffStatuses.has("rental_returned");
          completionSource = completed ? "operational_completion" : "";
        }

        if (completed && referral.reward_status === "pending") {
          const now = new Date().toISOString();
          await rest<void>(`referral_bookings?id=eq.${encodeURIComponent(referral.id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ booking_status: "traveled", reward_status: "earned", earned_at: now, metadata: { ...(referral.metadata || {}), original_eligible_revenue_cents: originalEligible, original_partner_reward_cents: originalReward, locked_reward_basis: lockedBasis, completion_source: completionSource, completion_reconciled_at: now }, updated_at: now }) });
          await rest<void>("referral_reward_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ referral_booking_id: referral.id, event_type: "earned", amount_cents: payableReward, notes: line === "rental" ? "Earned when Epic recorded Rental Returned." : "Earned when Epic recorded Tour Checked In." }) });
          earned++;
        } else skipped++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Unknown reward reconciliation error");
      }
    }

    return NextResponse.json({ ok: true, scanned: referrals.length, earned, voided, adjusted, skipped, errors: errors.slice(0, 10) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Reward reconciliation failed." }, { status: 500 });
  }
}
