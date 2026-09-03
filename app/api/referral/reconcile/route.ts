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

type WebhookRow = {
  id: string;
  created_at: string;
  payload: Record<string, any>;
};

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

function getBookingId(payload: Record<string, any>) {
  const orders = Array.isArray(payload?.tripOrders) ? payload.tripOrders : [];
  const bookings = orders.flatMap((order: any) => Array.isArray(order?.bookings) ? order.bookings : []);
  return bookings[0]?.id ? String(bookings[0].id) : null;
}

function getRevenue(payload: Record<string, any>, reservation: ReservationRow) {
  if (Number.isFinite(payload?.total_sales)) return Number(payload.total_sales);
  if (Number.isFinite(payload?.subtotal)) return Number(payload.subtotal);
  return reservation.total_sales_cents ?? reservation.total_amount_cents ?? 0;
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

        const bookedAt = payload?.reserved_at || payload?.created_at || reservation.reserved_at || event.created_at;
        const revenue = getRevenue(payload, reservation);
        const eligibleRevenue = revenue;
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
          booking_id: bookingId || reservation.booking_id,
          customer_name: payload?.customer?.full_name || reservation.customer_name,
          customer_email: payload?.customer?.email || reservation.customer_email,
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
