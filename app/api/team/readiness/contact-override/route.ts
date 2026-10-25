import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }
  const input = await request.json().catch(() => null);
  const code = typeof input?.confirmation_code === "string" ? input.confirmation_code.trim().toUpperCase() : "";
  const field = input?.field;
  const value = typeof input?.value === "string" ? input.value.trim() : "";
  if (!/^[A-Z0-9-]{2,50}$/.test(code) || !["email", "phone"].includes(field) || !value || value.length > 254) {
    return NextResponse.json({ error: "Invalid contact update." }, { status: 400 });
  }
  if (field === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }
  if (field === "phone" && value.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) return NextResponse.json({ error: "Service configuration missing." }, { status: 503 });
  const res = await fetch(`${url}/rest/v1/rpc/update_guest_contact_override`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      p_confirmation_code: code,
      p_effective_email: field === "email" ? value : null,
      p_effective_phone: field === "phone" ? value : null,
      p_updated_by: profile.display_name,
      p_change_reason: "Updated by team from Guest Readiness drawer",
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "Contact service unavailable." }, { status: 502 });
  if (!res.ok) return NextResponse.json({ error: "Could not save guest contact information." }, { status: res.status >= 500 ? 502 : 400 });
  return NextResponse.json({ ok: true });
}
