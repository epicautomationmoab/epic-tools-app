import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const profile = await getAuthenticatedTeamProfile(cookieStore.get("epic_access_token")?.value);
    if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (profile.role !== "admin" && profile.role !== "manager") {
      return NextResponse.json({ error: "Manager or Admin required." }, { status: 403 });
    }
    const body = await request.json().catch(() => ({}));
    const readinessId = typeof body.readiness_id === "string" ? body.readiness_id.trim() : "";
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(readinessId)) {
      return NextResponse.json({ error: "Valid reservation ID required." }, { status: 400 });
    }
    if (reason.length < 5 || reason.length > 500) {
      return NextResponse.json({ error: "Enter a reason (5–500 characters)." }, { status: 400 });
    }
    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SECRET_KEY?.trim();
    if (!rawUrl || !key) throw new Error("Supabase configuration is missing.");
    const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
    const response = await fetch(`${url}/rest/v1/rpc/manually_release_rental_damage_deposit`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_readiness_id: readinessId, p_actor: profile.display_name || profile.role, p_reason: reason }),
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: (await response.text()) || "Manual reconciliation failed." }, { status: 409 });
    return NextResponse.json(await response.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Manual reconciliation failed." }, { status: 500 });
  }
}
