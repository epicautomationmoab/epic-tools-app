import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

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
  return { tripSafeCents: tripSafeTotal, adventureAssureCents: assureTotal, totalCents: Math.max(0, tripSafeTotal + assureTotal) };
}

async function requireTeamMember(request: NextRequest) {
  return getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
}

export async function GET(request: NextRequest) {
  const team = await requireTeamMember(request);
  if (!team) return NextResponse.json({ error: "Epic Tools login required." }, { status: 401 });

  const confirmation = (request.nextUrl.searchParams.get("confirmation_code") || "").trim().toUpperCase();
  try {
    const partners = await rest<Array<Record<string, unknown>>>(
      `referral_partners?status=eq.active&select=${encodeURIComponent("id,name,slug,reward_mode,reward_basis,partner_reward_cents,partner_reward_percent,guest_discount_cents,guest_discount_percent,promo_code")}&order=name.asc`,
    );
    if (!confirmation) return NextResponse.json({ ok: true, partners });

    const reservations = await rest<Array<Record<string, any>>>(
      `operational_reservations?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=${encodeURIComponent("id,confirmation_code,tripworks_trip_id,booking_id,customer_name,customer_email,experience_name,business_line,reserved_at,start_time,total_sales_cents,total_amount_cents,is_cancelled,cancellation_status,latest_payload,booking_payload,trip_payload,updated_at")}&order=updated_at.desc&limit=10`,
    );
    const reservation = reservations.find((row) => !row.is_cancelled) || reservations[0];
    if (!reservation) return NextResponse.json({ error: "TripWorks confirmation not found in Epic Tools." }, { status: 404 });

    const existing = await rest<Array<Record<string, unknown>>>(
      `referral_bookings?operational_reservation_id=eq.${encodeURIComponent(String(reservation.id))}&select=id,partner_id,confirmation_code,reward_status&limit=1`,
    );

    return NextResponse.json({
      ok: true,
      partners,
      reservation: {
        id: reservation.id,
        confirmation_code: reservation.confirmation_code,
        customer_name: reservation.customer_name,
        customer_email: reservation.customer_email,
        experience_name: reservation.experience_name,
        business_line: reservation.business_line,
        booked_at: reservation.reserved_at,
        activity_start_at: reservation.start_time,
        total_sales_cents: reservation.total_sales_cents ?? reservation.total_amount_cents ?? 0,
        is_cancelled: Boolean(reservation.is_cancelled),
        cancellation_status: reservation.cancellation_status,
      },
      existing_attribution: existing[0] || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to look up reservation." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const team = await requireTeamMember(request);
  if (!team) return NextResponse.json({ error: "Epic Tools login required." }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const confirmation = typeof body?.confirmation_code === "string" ? body.confirmation_code.trim().toUpperCase() : "";
  const partnerId = typeof body?.partner_id === "string" ? body.partner_id.trim() : "";
  if (!confirmation || !partnerId) return NextResponse.json({ error: "Confirmation code and Ambassador are required." }, { status: 400 });

  try {
    const reservations = await rest<Array<Record<string, any>>>(
      `operational_reservations?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=${encodeURIComponent("id,confirmation_code,tripworks_trip_id,booking_id,customer_name,customer_email,experience_name,business_line,reserved_at,start_time,total_sales_cents,total_amount_cents,is_cancelled,cancellation_status,latest_payload,booking_payload,trip_payload,updated_at")}&order=updated_at.desc&limit=10`,
    );
    const reservation = reservations.find((row) => !row.is_cancelled) || reservations[0];
    if (!reservation) return NextResponse.json({ error: "TripWorks confirmation not found in Epic Tools." }, { status: 404 });
    if (reservation.is_cancelled || String(reservation.cancellation_status || "").toLowerCase().includes("cancel")) {
      return NextResponse.json({ error: "A cancelled reservation cannot be manually attributed." }, { status: 409 });
    }

    const existing = await rest<Array<Record<string, unknown>>>(
      `referral_bookings?operational_reservation_id=eq.${encodeURIComponent(String(reservation.id))}&select=id,partner_id,confirmation_code&limit=1`,
    );
    if (existing[0]) return NextResponse.json({ error: "This reservation already has Ambassador attribution." }, { status: 409 });

    const partners = await rest<Array<Record<string, any>>>(
      `referral_partners?id=eq.${encodeURIComponent(partnerId)}&status=eq.active&select=${encodeURIComponent("id,name,slug,reward_mode,reward_basis,partner_reward_cents,partner_reward_percent,guest_discount_cents,guest_discount_percent,promo_code")}&limit=1`,
    );
    const partner = partners[0];
    if (!partner) return NextResponse.json({ error: "Active Ambassador not found." }, { status: 404 });

    const payload = reservation.latest_payload || reservation.booking_payload || reservation.trip_payload || {};
    const order = findOrder(payload, reservation.booking_id || null);
    const booking = findBooking(order, reservation.booking_id || null);
    const revenue = Number.isFinite(reservation.total_sales_cents) ? Number(reservation.total_sales_cents) : Math.max(0, Number(reservation.total_amount_cents) || 0);
    const protection = protectionExclusion(order, booking);
    const eligibleRevenue = partner.reward_basis === "percent" ? Math.max(0, revenue - protection.totalCents) : revenue;
    const partnerReward = partner.reward_basis === "percent"
      ? Math.max(0, Math.round(eligibleRevenue * (Number(partner.partner_reward_percent) || 0) / 100))
      : Math.max(0, Number(partner.partner_reward_cents) || 0);
    const guestDiscount = partner.reward_basis === "percent"
      ? Math.max(0, Math.round(eligibleRevenue * (Number(partner.guest_discount_percent) || 0) / 100))
      : Math.max(0, Number(partner.guest_discount_cents) || 0);
    const now = new Date().toISOString();

    const rows = await rest<Array<Record<string, unknown>>>("referral_bookings", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        partner_id: partner.id,
        referral_visit_id: null,
        operational_reservation_id: reservation.id,
        confirmation_code: reservation.confirmation_code,
        tripworks_trip_id: reservation.tripworks_trip_id,
        booking_id: reservation.booking_id,
        customer_name: reservation.customer_name,
        customer_email: reservation.customer_email,
        experience_name: reservation.experience_name,
        business_line: reservation.business_line,
        booked_at: reservation.reserved_at,
        activity_start_at: reservation.start_time,
        attributed_at: now,
        booking_status: "booked",
        booking_revenue_cents: revenue,
        eligible_revenue_cents: eligibleRevenue,
        partner_reward_cents: partnerReward,
        guest_discount_cents: guestDiscount,
        promo_code_used: partner.promo_code,
        reward_status: "pending",
        metadata: {
          attribution_source: "manual_epic_tools",
          referral_slug: partner.slug,
          manually_attributed_at: now,
          manually_attributed_by_profile_id: team.id,
          manually_attributed_by_name: team.display_name,
          manually_attributed_by_email: team.email,
          manually_attributed_by_role: team.role,
          original_eligible_revenue_cents: eligibleRevenue,
          eligible_referral_revenue_cents: eligibleRevenue,
          pre_tax_sales_cents: revenue,
          excluded_tripsafe_cents: protection.tripSafeCents,
          excluded_adventure_assure_cents: protection.adventureAssureCents,
          reward_basis: partner.reward_basis,
        },
      }),
    });

    return NextResponse.json({
      ok: true,
      referral_booking: rows[0],
      attributed_by: { id: team.id, display_name: team.display_name, email: team.email },
      partner: { id: partner.id, name: partner.name },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to manually attribute reservation." }, { status: 500 });
  }
}
