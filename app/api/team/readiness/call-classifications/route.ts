import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function rest<T>(path: string): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const confirmation = request.nextUrl.searchParams.get("confirmation")?.trim().toUpperCase();
  if (!confirmation) return NextResponse.json({ error: "Confirmation is required." }, { status: 400 });

  try {
    const reservations = await rest<Array<{ id: string }>>(
      `operational_reservations?confirmation_code=eq.${encodeURIComponent(confirmation)}&select=id&limit=1`,
    );
    const reservationId = reservations[0]?.id;
    if (!reservationId) return NextResponse.json({ ok: true, classifications: [] });

    const alerts = await rest<Array<{
      id: string;
      alert_kind: string;
      call_started_at: string | null;
      status: string;
      caller_phone: string | null;
    }>>(
      `call_attention_alerts?reservation_id=eq.${encodeURIComponent(reservationId)}&select=${encodeURIComponent("id,alert_kind,call_started_at,status,caller_phone")}&order=call_started_at.asc.nullslast,created_at.asc&limit=500`,
    );

    return NextResponse.json({
      ok: true,
      classifications: alerts.map((alert) => ({
        id: alert.id,
        kind: alert.alert_kind,
        at: alert.call_started_at,
        status: alert.status,
        caller_phone: alert.caller_phone,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load call classifications." }, { status: 500 });
  }
}
