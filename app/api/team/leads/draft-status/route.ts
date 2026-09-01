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

  const raw = request.nextUrl.searchParams.get("confirmations") || "";
  const confirmations = [...new Set(raw.split(",").map((value) => value.trim().toUpperCase()).filter(Boolean))].slice(0, 50);
  if (!confirmations.length) return NextResponse.json({ ok: true, drafts: [] });

  try {
    const quoted = confirmations.map((value) => `"${value.replaceAll('"', '')}"`).join(",");
    const drafts = await rest<Array<{ confirmation_code: string; last_trip_status: string | null; is_current_draft: boolean; tripworks_created_at: string | null; last_seen_at: string | null }>>(
      `sales_drafts?confirmation_code=in.(${encodeURIComponent(quoted)})&select=${encodeURIComponent("confirmation_code,last_trip_status,is_current_draft,tripworks_created_at,last_seen_at")}`,
    );
    return NextResponse.json({ ok: true, drafts });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load draft status." }, { status: 500 });
  }
}
