import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function getSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  const url = (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, "");
  return { url, key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

async function requireEmployee(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return null;
  return profile;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cents(value: unknown) {
  const n = typeof value === "number" ? value : Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const liveCallId = request.nextUrl.searchParams.get("live_call_id")?.trim();
  if (!liveCallId) return NextResponse.json({ error: "Live call is required." }, { status: 400 });

  try {
    const rows = await rest<Array<Record<string, unknown>>>(`live_calls?id=eq.${encodeURIComponent(liveCallId)}&select=${encodeURIComponent("id,caller_phone,caller_name,source_name,campaign,received_at,route_kind,route_label,capture_status,opportunity_id,contact_id")}&limit=1`);
    if (!rows[0]) return NextResponse.json({ error: "Live call not found." }, { status: 404 });
    return NextResponse.json({ ok: true, call: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load live call." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const liveCallId = clean(body?.live_call_id);
  if (!liveCallId) return NextResponse.json({ error: "Live call is required." }, { status: 400 });

  try {
    const calls = await rest<Array<{ id:string; caller_phone:string; caller_name:string|null; source_name:string|null; campaign:string|null; capture_status:string; opportunity_id:string|null; contact_id:string|null }>>(`live_calls?id=eq.${encodeURIComponent(liveCallId)}&select=id,caller_phone,caller_name,source_name,campaign,capture_status,opportunity_id,contact_id&limit=1`);
    const call = calls[0];
    if (!call) return NextResponse.json({ error: "Live call not found." }, { status: 404 });
    if (call.opportunity_id || call.capture_status === "saved_lead") return NextResponse.json({ ok: true, opportunity_id: call.opportunity_id, already_saved: true });

    const name = clean(body?.customer_name) || call.caller_name || "New phone lead";
    const email = normalizeEmail(body?.email);
    const activityDate = clean(body?.activity_date);
    const interest = clean(body?.interest_label);
    const partyNeeds = clean(body?.party_needs);
    const note = clean(body?.note);
    const leadValueCents = cents(body?.lead_value);
    const now = new Date().toISOString();

    let contactId = call.contact_id;
    if (!contactId) {
      const byPhone = await rest<Array<{ id:string }>>(`sales_contacts?canonical_phone=eq.${encodeURIComponent(call.caller_phone)}&select=id&limit=2`);
      if (byPhone.length === 1) contactId = byPhone[0].id;
    }
    if (!contactId && email) {
      const byEmail = await rest<Array<{ id:string }>>(`sales_contacts?canonical_email=eq.${encodeURIComponent(email)}&select=id&limit=2`);
      if (byEmail.length === 1) contactId = byEmail[0].id;
    }
    if (!contactId) {
      const created = await rest<Array<{ id:string }>>("sales_contacts", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ canonical_phone: call.caller_phone, canonical_email: email, display_name: name, first_seen_at: now, last_seen_at: now, updated_at: now }),
      });
      contactId = created[0]?.id || null;
    } else {
      await rest<void>(`sales_contacts?id=eq.${encodeURIComponent(contactId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ display_name: name, ...(email ? { canonical_email: email } : {}), last_seen_at: now, updated_at: now }),
      });
    }

    const personKey = `phone:${call.caller_phone}`;
    const createdOpportunity = await rest<Array<{ id:string }>>("sales_opportunities", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        person_key: personKey,
        activity_date: activityDate,
        activity_window_start: activityDate,
        activity_window_end: activityDate,
        customer_name: name,
        email,
        phone_e164: call.caller_phone,
        status: "open",
        lead_value_cents: leadValueCents,
        captured_value_cents: 0,
        draft_count: 0,
        source_method: "callrail",
        assigned_rep_name: profile.display_name,
        contact_id: contactId,
        claimed_at: now,
        claimed_by_profile_id: profile.id,
        claimed_by_name: profile.display_name,
        shopping_started_at: call.capture_status === "pending" ? now : now,
        shopping_last_activity_at: now,
        first_seen_at: now,
        last_seen_at: now,
        new_unclaimed_at: null,
        interest_label: interest,
        party_needs: partyNeeds,
        lead_capture_note: note,
        origin_live_call_id: liveCallId,
        match_confidence: "live_call_capture",
        updated_at: now,
      }),
    });
    const opportunityId = createdOpportunity[0]?.id;
    if (!opportunityId) throw new Error("Sales opportunity was not created.");

    if (note) {
      await rest<void>("sales_opportunity_notes", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ opportunity_id: opportunityId, author_profile_id: profile.id, author_name: profile.display_name, note_text: note, created_at: now }),
      });
    }

    await rest<void>(`live_calls?id=eq.${encodeURIComponent(liveCallId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        route_kind: "open_lead",
        route_label: name,
        opportunity_id: opportunityId,
        contact_id: contactId,
        capture_status: "saved_lead",
        caller_name: name,
        captured_email: email,
        captured_activity_date: activityDate,
        captured_interest: interest,
        captured_party_needs: partyNeeds,
        captured_note: note,
        captured_lead_value_cents: leadValueCents,
        captured_by_profile_id: profile.id,
        captured_by_name: profile.display_name,
        captured_at: now,
        updated_at: now,
      }),
    });

    return NextResponse.json({ ok: true, opportunity_id: opportunityId, contact_id: contactId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save live lead." }, { status: 500 });
  }
}
