import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "../../../lib/team-auth";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "");

async function rpc(accessToken: string, fn: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text || `Request failed (${response.status})`;
    try { const parsed = JSON.parse(text); message = parsed?.message || parsed?.error || message; } catch {}
    throw new Error(message);
  }
  return text ? JSON.parse(text) : null;
}

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (!profile || !accessToken || profile.role === "workstation") return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    action?: "claim" | "release" | "release_with_note" | "activate" | "note" | "edit_note" | "mark_lost" | "retire";
    opportunity_id?: string;
    note_id?: string;
    note_text?: string;
    reason?: string;
  } | null;
  const opportunityId = body?.opportunity_id?.trim();
  if (!opportunityId) return NextResponse.json({ error: "Lead is required." }, { status: 400 });

  try {
    if (body?.action === "note") {
      const note = await rpc(accessToken, "epic_sales_add_note", { p_opportunity_id: opportunityId, p_note_text: body.note_text || "" });
      return NextResponse.json({ ok: true, note });
    }
    if (body?.action === "edit_note") {
      const noteId = body.note_id?.trim();
      if (!noteId) return NextResponse.json({ error: "Note is required." }, { status: 400 });
      const note = await rpc(accessToken, "epic_sales_edit_note", { p_note_id: noteId, p_note_text: body.note_text || "" });
      return NextResponse.json({ ok: true, note });
    }
    if (body?.action === "activate") {
      const result = await rpc(accessToken, "epic_sales_activate_lead", { p_opportunity_id: opportunityId });
      return NextResponse.json(result || { ok: true });
    }
    if (body?.action === "release_with_note") {
      const result = await rpc(accessToken, "epic_sales_release_claim", {
        p_opportunity_id: opportunityId,
        p_reason: body.reason || "",
        p_note: body.note_text || "",
      });
      return NextResponse.json(result || { ok: true });
    }
    if (body?.action === "claim" || body?.action === "release") {
      const result = await rpc(accessToken, "epic_sales_claim_lead", { p_opportunity_id: opportunityId, p_release: body.action === "release" });
      return NextResponse.json(result || { ok: true });
    }
    if (body?.action === "mark_lost" || body?.action === "retire") {
      // Preserve structured details for reporting while using current validated DB codes.
      const rawReason = body.reason || "";
      const parts = rawReason.split(" | ");
      const structured = body.action === "mark_lost" && parts.length === 2;
      const category = structured ? parts[0] : "";
      const specificReason = structured ? parts[1] : "";
      const categories: Record<string,string> = {
        "Price & Value":"price",
        "Availability & Scheduling":"availability",
        "Policies & Restrictions":"policy_or_qualification",
        "Product & Experience":"product_mismatch",
        "Guest Circumstances":"plans_changed",
        "Unable to Determine / Other":"other",
      };
      const code = structured ? categories[category] : rawReason;
      if (structured && (!code || !specificReason)) return NextResponse.json({error:"Choose a valid lost reason."},{status:400});
      const closeReasons = ["Already booked / converted","Duplicate opportunity","Existing customer / reservation inquiry","Test or internal record","Invalid contact / spam","Not a sales opportunity","Other — explanation required"];
      if(body.action==="retire"&&(!closeReasons.includes(rawReason)||(rawReason==="Other — explanation required"&&!body.note_text?.trim())))return NextResponse.json({error:"Choose a valid close reason and add an explanation if required."},{status:400});
      const note = structured ? "Lost category: "+category+"\nLost reason: "+specificReason+(body.note_text?"\nDetails: "+body.note_text:"") : body.action==="retire" ? "Close reason: "+rawReason+(body.note_text?"\nDetails: "+body.note_text:"") : body.note_text || null;
      const result = await rpc(accessToken, "epic_sales_close_lead", {
        p_opportunity_id: opportunityId,
        p_status: body.action === "mark_lost" ? "lost" : "retired",
        p_reason: body.action==="retire" ? "other" : code || "",
        p_note: note,
      });
      return NextResponse.json(result || { ok: true });
    }
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update lead." }, { status: 500 });
  }
}
