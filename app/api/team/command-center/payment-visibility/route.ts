import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

/**
 * Command Center audited-payment preview. Deliberately NOT used by the existing
 * Readiness toggle and disabled unless explicitly enabled in a preview environment.
 * The database RPC is proposed, not yet migrated.
 */
export async function POST(request: NextRequest) {
  if (process.env.EPIC_AUDITED_PAYMENT_VISIBILITY_PREVIEW !== "enabled") {
    return NextResponse.json({ error: "Audited payment visibility is not enabled." }, { status: 404 });
  }

  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || !profile.active || profile.role === "workstation" || !["agent", "manager", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Named employee login required." }, { status: 403 });
  }

  const data = await request.json().catch(() => null);
  const confirmationCode = typeof data?.confirmationCode === "string" ? data.confirmationCode.trim() : "";
  if (!confirmationCode || confirmationCode.length > 100 || typeof data?.hidden !== "boolean") {
    return NextResponse.json({ error: "A valid confirmation and visibility setting are required." }, { status: 400 });
  }

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) {
    return NextResponse.json({ error: "Preview database is not configured." }, { status: 503 });
  }

  const origin = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  try {
    const response = await fetch(`${origin}/rest/v1/rpc/set_guest_payment_visibility_audited`, {
      method: "POST",
      cache: "no-store",
      headers: {apikey:key, Authorization:`Bearer ${key}`, "Content-Type":"application/json"},
      body: JSON.stringify({
        p_confirmation_code: confirmationCode,
        p_hidden: data.hidden,
        p_actor_profile_id: profile.id, // derived from verified session, never from client body
      }),
    });
    if (!response.ok) {
      // Missing/unmigrated RPC and all other failures fail closed, without legacy PATCH fallback.
      console.error("audited_payment_visibility_preview_failed", {status:response.status});
      return NextResponse.json({ error: "Audited update unavailable; no fallback update attempted." }, { status: 503 });
    }
    const result = await response.json() as {hidden?:boolean;changed?:boolean};
    if (typeof result.hidden !== "boolean" || typeof result.changed !== "boolean") {
      return NextResponse.json({error:"Unexpected audited update response."}, {status:502});
    }
    return NextResponse.json({ok:true,hidden:result.hidden,changed:result.changed});
  } catch {
    return NextResponse.json({error:"Audited update unavailable."},{status:503});
  }
}
