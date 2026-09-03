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
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

type WebhookRow = { id: string; created_at: string; payload: Record<string, any> };
type ReservationRow = {
  id: string;
  confirmation_code: string | null;
  tripworks_trip_id: string | null;
  booking_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  experience_name: string | null;
  business_line: string | null;
  reserved_at: string | null;
  start_time: string | null;
  total_sales_cents: number | null;
  total_amount_cents: number | null;
};

function getReferralSlug(payload: Record<string, any>) {
  const landing = typeof payload?.mkt_landing_url === "string" ? payload.mkt_landing_url : "";
  if (!landing) return null;
  try {
    const url = new URL(landing);
    const ref = url.searchParams.get("ref")?.trim().toLowerCase() || "";
    return /^[a-z0-9][a-z0-9-]{0,79}$/.test(ref) ? ref : null;
  } catch {
    return null;
  }
}

function getTripOrders(payload: Record<string, any>) {
  return Array.isArray(payload?.tripOrders) ? payload.tripOrders : [];
}

function getBookingId(payload: Record<string, any>) {
  const bookings = getTripOrders(payload).flatMap((order: any) => Array.isArray(order?.bookings) ? order.bookings : []);
  return bookings[0]?.id ? String(bookings[0].id) : null;
}

function findTripOrder(payload: Record<string, any>, bookingId: string | null) {
  const orders = getTripOrders(payload);
  if (!bookingId) return orders[0] || null;
  return orders.find((order: any) => (Array.isArray(order?.bookings) ? order.bookings : []).some((booking: any) => String(booking?.id) === bookingId)) || orders[0] || null;
}

function getBookingFromOrder(order: any, bookingId: string | null) {
  const bookings = Array.isArray(order?.bookings) ? order.bookings : [];
  if (!bookingId) return bookings[0] || null;
  return bookings.find((booking: any) => String(booking?.id) === bookingId) || bookings[0] || null;
}

function getRevenue(payload: Record<string, any>, reservation: ReservationRow, order: any) {
  if (Number.isFinite(order?.total_sales)) return Number(order.total_sales);
  if (Number.isFinite(payload?.total_sales)) return Number(payload.total_sales);
  if (Number.isFinite(payload?.subtotal)) return Number(payload.subtotal);
  return reservation.total_sales_cents ?? reservation.total_amount_cents ?? 0;
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
  const assureAddons = addons.filter((addon: any) => isAdventureAssure(addon));
  const assureTotal = assureAddons.reduce((sum: number, addon: any) => sum + (Number.isFinite(addon?.price) ? Math.max(0, Number(addon.price)) : 0), 0);

  let tripSafeTotal = 0;
  if (selectedTripSafe) {
    const explicitlyPricedOtherAddons = addons.reduce((sum: number, addon: any) => {
      if (isTripSafe(addon)) return sum;
      return sum + (Number.isFinite(addon?.price) ? Math.max(0, Number(addon.price)) : 0);
    }, 0);
    if (Number.isFinite(order?.addons_total)) {
      tripSafeTotal = Math.max(0, Number(order.addons_total) - explicitlyPricedOtherAddons);
    }
  }

  return {
    tripSafeCents: tripSafeTotal,
    adventureAssureCents: assureTotal,
    totalCents: Math.max(0, tripSafeTotal + assureTotal),
  };
}

function computeRewards(partner: any, eligibleRevenue: number) {
  if (partner.reward_basis === "percent") {
    return {
      partnerReward: Math.max(0, Math.round(eligibleRevenue * (Number(partner.partner_reward_percent) || 0) / 100)),
      guestDiscount: Math.max(0, Math.round(eligibleRevenue * (Number(partner.guest_discount_percent) || 0) / 100)),
    };
  }
  return {
    partnerReward: Math.max(0, Number(partner.partner_reward_cents) || 0),
    guestDiscount: Math.max(0, Number(partner.guest_discount_cents) || 0),
  };
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization");
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const events = await rest<WebhookRow[]>(
      "webhook_events?event_type=eq.trip_reserved&select=id,created_at,payload&order=created_at.desc&limit=250",
    );

    let attributed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const event of events) {
      try {
        const payload = event.payload || {};
        const slug = getReferralSlug(payload);
        if (!slug) { skipped++; continue; }

        const confirmationCode = typeof payload?.confirmation_code === "string" ? payload.confirmation_code : null;
        const tripId = payload?.id ? String(payload.id) : null;
        if (!confirmationCode && !tripId) { skipped++; continue; }

        const partners = await rest<any[]>(
          `referral_partners?slug=eq.${encodeURIComponent(slug)}&status=eq.active&select=id,slug,reward_mode,reward_basis,partner_reward_cents,partner_reward_percent,guest_discount_cents,guest_discount_percent,promo_code,attribution_window_days&limit=1`,
        );
        const partner = partners[0];
        if (!partner) { skipped++; continue; }

        const reservationFilter = confirmationCode
          ? `confirmation_code=eq.${encodeURIComponent(confirmationCode)}`
          : `tripworks_trip_id=eq.${encodeURIComponent(tripId!)}`;
        const reservations = await rest<ReservationRow[]>(
          `operational_reservations?${reservationFilter}&select=id,confirmation_code,tripworks_trip_id,booking_id,customer_name,customer_email,experience_name,business_line,reserved_at,start_time,total_sales_cents,total_amount_cents&order=updated_at.desc&limit=10`,
        );
        if (!reservations.length) { skipped++; continue; }

        const bookingId = getBookingId(payload);
        const reservation = bookingId
          ? reservations.find((row) => row.booking_id === bookingId) || reservations[0]
          : reservations[0];
        const order = findTripOrder(payload, reservation.booking_id || bookingId);
        const booking = getBookingFromOrder(order, reservation.booking_id || bookingId);

        const bookedAt = payload?.reserved_at || payload?.created_at || reservation.reserved_at || event.created_at;
        const revenue = getRevenue(payload, reservation, order);
        const protection = protectionExclusion(order, booking);
        const eligibleRevenue = partner.reward_basis === "percent"
          ? Math.max(0, revenue - protection.totalCents)
          : revenue;
        const rewards = computeRewards(partner, eligibleRevenue);

        const visits = await rest<any[]>(
          `referral_visits?partner_id=eq.${encodeURIComponent(partner.id)}&occurred_at=lte.${encodeURIComponent(bookedAt)}&expires_at=gte.${encodeURIComponent(bookedAt)}&select=id,occurred_at&order=occurred_at.desc&limit=1`,
        );
        const visit = visits[0] || null;

        const row = {
          partner_id: partner.id,
          referral_visit_id: visit?.id || null,
          operational_reservation_id: reservation.id,
          confirmation_code: confirmationCode || reservation.confirmation_code,
          tripworks_trip_id: tripId || reservation.tripworks_trip_id,
          booking_id: reservation.booking_id || bookingId,
          customer_name: booking?.customer?.full_name || payload?.customer?.full_name || reservation.customer_name,
          customer_email: booking?.customer?.email || payload?.customer?.email || reservation.customer_email,
          experience_name: reservation.experience_name,
          business_line: reservation.business_line,
          booked_at: bookedAt,
          activity_start_at: reservation.start_time,
          attributed_at: new Date().toISOString(),
          booking_status: "booked",
          booking_revenue_cents: revenue,
          eligible_revenue_cents: eligibleRevenue,
          partner_reward_cents: rewards.partnerReward,
          guest_discount_cents: rewards.guestDiscount,
          promo_code_used: partner.promo_code,
          reward_status: "pending",
          metadata: {
            attribution_source: "tripworks_mkt_landing_url",
            referral_slug: slug,
            webhook_event_id: event.id,
            mkt_landing_url: payload?.mkt_landing_url || null,
            reward_basis: partner.reward_basis,
            pre_tax_sales_cents: revenue,
            excluded_tripsafe_cents: protection.tripSafeCents,
            excluded_adventure_assure_cents: protection.adventureAssureCents,
            eligible_referral_revenue_cents: eligibleRevenue,
          },
          updated_at: new Date().toISOString(),
        };

        await rest<void>("referral_bookings?on_conflict=operational_reservation_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(row),
        });
        attributed++;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Unknown referral reconciliation error");
      }
    }

    return NextResponse.json({ ok: true, scanned: events.length, attributed, skipped, errors: errors.slice(0, 10) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Referral reconciliation failed." }, { status: 500 });
  }
}
