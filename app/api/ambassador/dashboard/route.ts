import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAmbassadorProfile } from "@/lib/ambassador-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

async function rest<T>(path: string): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedAmbassadorProfile(request.cookies.get("epic_ambassador_access_token")?.value);
  if (!profile) return NextResponse.json({ error: "Ambassador login required." }, { status: 401 });

  try {
    const [partnerRows, bookingRows, visitRows] = await Promise.all([
      rest<Array<Record<string, unknown>>>(`referral_partners?id=eq.${encodeURIComponent(profile.partner_id)}&select=${encodeURIComponent("id,name,slug,reward_mode,partner_reward_cents,guest_discount_cents,promo_code,attribution_window_days,show_promo_popup")}&limit=1`),
      rest<Array<Record<string, unknown>>>(`referral_bookings?partner_id=eq.${encodeURIComponent(profile.partner_id)}&select=${encodeURIComponent("id,confirmation_code,customer_name,experience_name,business_line,booked_at,activity_start_at,booking_status,booking_revenue_cents,partner_reward_cents,guest_discount_cents,reward_status,earned_at,sent_at")}&order=booked_at.desc.nullslast&limit=100`),
      rest<Array<{ id: string }>>(`referral_visits?partner_id=eq.${encodeURIComponent(profile.partner_id)}&select=id&limit=10000`),
    ]);

    const partner = partnerRows[0];
    if (!partner) return NextResponse.json({ error: "Partner not found." }, { status: 404 });

    const bookings = bookingRows;
    const totalRevenue = bookings.reduce((sum, row) => sum + Number(row.booking_revenue_cents || 0), 0);
    const pendingRewards = bookings.filter((row) => row.reward_status === "pending").reduce((sum, row) => sum + Number(row.partner_reward_cents || 0), 0);
    const earnedRewards = bookings.filter((row) => row.reward_status === "earned" || row.reward_status === "sent" || row.reward_status === "redeemed").reduce((sum, row) => sum + Number(row.partner_reward_cents || 0), 0);
    const traveled = bookings.filter((row) => row.booking_status === "traveled").length;

    return NextResponse.json({
      ok: true,
      profile: { display_name: profile.display_name, role: profile.role },
      partner,
      metrics: { visits: visitRows.length, bookings: bookings.length, traveled, total_revenue_cents: totalRevenue, pending_rewards_cents: pendingRewards, earned_rewards_cents: earnedRewards },
      bookings,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Ambassador dashboard." }, { status: 500 });
  }
}
