import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

/**
 * Native EpicTools read-only Customer 360 details.
 * Source: existing C360 get_epic_customer_360 RPC, no cross-app proxy.
 * Enrichment and all mutations remain pending until each source path is migrated.
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(token);
  if (!token || !profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const body = {
    p_contact_id: params.get("contact") || null,
    p_opportunity_id: params.get("opportunity") || null,
    p_reservation_id: params.get("reservation") || null,
    p_phone: params.get("phone") || null,
    p_email: params.get("email") || null,
  };
  if (!Object.values(body).some(Boolean)) {
    return NextResponse.json({ error: "Customer identity is required." }, { status: 400 });
  }
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) {
    return NextResponse.json({ error: "Customer detail configuration unavailable." }, { status: 503 });
  }
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(new RegExp("/+$"), "");
  try {
    const response = await fetch(`${url}/rest/v1/rpc/get_epic_customer_360`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("native_customer_detail_rpc_failed", response.status);
      return NextResponse.json({ error: "Customer details unavailable." }, { status: 502 });
    }
    const customer = await response.json();
    return NextResponse.json({ ok: true, customer });
  } catch {
    return NextResponse.json({ error: "Customer details unavailable." }, { status: 502 });
  }
}
