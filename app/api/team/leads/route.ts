import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { getCallRailTextConversation, sendCallRailSms } from "@/lib/server/callrail";

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

function errorText(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    for (const key of ["message", "description", "detail", "error"]) {
      if (typeof object[key] === "string" && object[key]) return object[key] as string;
    }
  }
  return null;
}

const LOST_REASONS = new Set(["price", "availability", "product_mismatch", "policy_or_qualification", "went_elsewhere", "plans_changed", "unresponsive", "timing", "other"]);
const RETIRED_REASONS = new Set(["fake_or_junk_contact", "duplicate", "test_or_staff_activity", "bad_data", "not_a_prospect", "other"]);

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const opportunityId = request.nextUrl.searchParams.get("opportunity_id")?.trim();
  if (!opportunityId) return NextResponse.json({ error: "Opportunity is required." }, { status: 400 });

  try {
    const messages = await rest<Array<{
      message_id: string;
      conversation_id: string | null;
      direction: string;
      source_number: string | null;
      destination_number: string | null;
      message_body: string | null;
      status: string | null;
      sent_at: string | null;
      first_received_at: string;
      agent_name: string | null;
      person_resource_id: string | null;
    }>>(
      `callrail_text_messages?matched_opportunity_id=eq.${encodeURIComponent(opportunityId)}&select=${encodeURIComponent("message_id,conversation_id,direction,source_number,destination_number,message_body,status,sent_at,first_received_at,agent_name,person_resource_id")}&order=sent_at.asc.nullslast,first_received_at.asc`,
    );

    const liveByMessageId = new Map<string, { status: string | null; error: string | null }>();
    const conversationIds = [...new Set(messages.map((message) => message.conversation_id).filter((value): value is string => Boolean(value)))];

    await Promise.all(conversationIds.map(async (conversationId) => {
      try {
        const conversation = await getCallRailTextConversation(conversationId);
        const liveMessages = Array.isArray(conversation.messages) ? conversation.messages as Array<Record<string, unknown>> : [];
        for (const live of liveMessages) {
          const id = live.id == null ? "" : String(live.id);
          if (!id) continue;
          const status = typeof live.status === "string" ? live.status.toLowerCase() : null;
          const detail = errorText(live.error);
          liveByMessageId.set(id, { status, error: detail });
        }
      } catch (error) {
        console.warn("CallRail conversation status lookup failed", conversationId, error);
      }
    }));

    const reconciledMessages = messages.map((message) => {
      const live = liveByMessageId.get(message.message_id);
      const deliveryStatus = live?.status || message.status || null;
      return { ...message, delivery_status: deliveryStatus, delivery_error: live?.error || null };
    });

    await Promise.allSettled(reconciledMessages
      .filter((message) => message.direction === "outbound" && message.delivery_status && message.delivery_status !== message.status)
      .map((message) => rest<void>(`callrail_text_messages?message_id=eq.${encodeURIComponent(message.message_id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ status: message.delivery_status, last_received_at: new Date().toISOString() }),
      })));

    const calls = await rest<Array<{
      callrail_call_id: string;
      direction: string | null;
      call_type: string | null;
      answered: boolean | null;
      voicemail: boolean | null;
      start_time: string | null;
      duration_seconds: number | null;
      tracking_phone_number: string | null;
      recording_player_url: string | null;
      recording_url: string | null;
      call_summary: string | null;
      transcription_text: string | null;
      last_received_at: string;
    }>>(
      `callrail_calls?matched_opportunity_id=eq.${encodeURIComponent(opportunityId)}&select=${encodeURIComponent("callrail_call_id,direction,call_type,answered,voicemail,start_time,duration_seconds,tracking_phone_number,recording_player_url,recording_url,call_summary,transcription_text,last_received_at")}&order=start_time.asc.nullslast,last_received_at.asc`,
    );

    return NextResponse.json({ ok: true, messages: reconciledMessages, calls });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load conversation history." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    action?: "claim" | "release" | "note" | "mark_lost" | "retire" | "reopen" | "send_sms";
    opportunity_id?: string;
    note_text?: string;
    reason?: string;
    message_text?: string;
  } | null;
  const opportunityId = body?.opportunity_id?.trim();
  if (!opportunityId) return NextResponse.json({ error: "Opportunity is required." }, { status: 400 });

  try {
    const getOpportunity = async () => {
      const rows = await rest<Array<{ id: string; status: string; claimed_by_profile_id: string | null; claimed_by_name: string | null; contact_id: string | null; phone_e164: string | null }>>(
        `sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}&select=id,status,claimed_by_profile_id,claimed_by_name,contact_id,phone_e164&limit=1`,
      );
      return rows[0] || null;
    };

    if (body?.action === "claim") {
      const opportunity = await getOpportunity();
      if (!opportunity) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      if (opportunity.status !== "open") return NextResponse.json({ error: "This lead is no longer open." }, { status: 409 });
      if (opportunity.claimed_by_profile_id && opportunity.claimed_by_profile_id !== profile.id) return NextResponse.json({ error: `Already claimed by ${opportunity.claimed_by_name || "another rep"}.` }, { status: 409 });
      const now = new Date().toISOString();
      await rest<void>(`sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ claimed_at: now, claimed_by_profile_id: profile.id, claimed_by_name: profile.display_name, assigned_rep_name: profile.display_name, assigned_rep_tw_user_id: profile.tripworks_user_id, updated_at: now }) });
      const existingOpen = await rest<Array<{ id: string }>>(`sales_opportunity_assignment_history?opportunity_id=eq.${encodeURIComponent(opportunityId)}&unassigned_at=is.null&select=id`);
      if (!existingOpen.length) await rest<void>("sales_opportunity_assignment_history", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ opportunity_id: opportunityId, assigned_profile_id: profile.id, assigned_rep_name: profile.display_name, assignment_source: "manual_claim" }) });
      return NextResponse.json({ ok: true, claimed_by_name: profile.display_name, claimed_at: now });
    }

    if (body?.action === "release") {
      const opportunity = await getOpportunity();
      if (!opportunity) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      if (opportunity.status !== "open") return NextResponse.json({ error: "This lead is no longer open." }, { status: 409 });
      if (!opportunity.claimed_by_profile_id) return NextResponse.json({ error: "This lead is already unclaimed." }, { status: 409 });
      if (opportunity.claimed_by_profile_id !== profile.id && profile.role !== "admin" && profile.role !== "manager") return NextResponse.json({ error: `This lead is owned by ${opportunity.claimed_by_name || "another rep"}.` }, { status: 403 });
      const now = new Date().toISOString();
      await rest<void>(`sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ claimed_at: null, claimed_by_profile_id: null, claimed_by_name: null, assigned_rep_name: null, assigned_rep_tw_user_id: null, updated_at: now }) });
      await rest<void>(`sales_opportunity_assignment_history?opportunity_id=eq.${encodeURIComponent(opportunityId)}&unassigned_at=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ unassigned_at: now }) });
      return NextResponse.json({ ok: true, released_at: now });
    }

    if (body?.action === "note") {
      const noteText = body.note_text?.trim() || "";
      if (!noteText) return NextResponse.json({ error: "Note cannot be blank." }, { status: 400 });
      if (noteText.length > 4000) return NextResponse.json({ error: "Note is too long." }, { status: 400 });
      const rows = await rest<Array<{ id: string; author_name: string; note_text: string; created_at: string }>>("sales_opportunity_notes", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ opportunity_id: opportunityId, author_profile_id: profile.id, author_name: profile.display_name, note_text: noteText }) });
      return NextResponse.json({ ok: true, note: rows[0] });
    }

    if (body?.action === "send_sms") {
      const opportunity = await getOpportunity();
      if (!opportunity) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      if (opportunity.status !== "open") return NextResponse.json({ error: "This lead is no longer open." }, { status: 409 });

      let contact: { id: string; tripworks_is_opt_in: boolean | null; canonical_phone: string | null; tripworks_customer_code: string | null } | null = null;
      if (opportunity.contact_id) {
        const contacts = await rest<Array<{ id: string; tripworks_is_opt_in: boolean | null; canonical_phone: string | null; tripworks_customer_code: string | null }>>(
          `sales_contacts?id=eq.${encodeURIComponent(opportunity.contact_id)}&select=id,tripworks_is_opt_in,canonical_phone,tripworks_customer_code&limit=1`,
        );
        contact = contacts[0] || null;
      }

      if (contact?.tripworks_is_opt_in === false) return NextResponse.json({ error: "SMS blocked: this customer opted out in TripWorks." }, { status: 403 });

      const messageText = body.message_text?.trim() || "";
      if (!messageText) return NextResponse.json({ error: "Message cannot be blank." }, { status: 400 });
      if (messageText.length > 1600) return NextResponse.json({ error: "Message is too long. Keep it under 1,600 characters." }, { status: 400 });
      const phone = contact?.canonical_phone || opportunity.phone_e164;
      if (!phone) return NextResponse.json({ error: "This customer does not have a phone number." }, { status: 409 });

      const result = await sendCallRailSms({ phone, body: messageText });
      return NextResponse.json({ ok: true, sent_at: new Date().toISOString(), conversation_id: result.conversationId });
    }

    if (body?.action === "mark_lost" || body?.action === "retire") {
      const opportunity = await getOpportunity();
      if (!opportunity) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      if (opportunity.status !== "open") return NextResponse.json({ error: "Only open leads can be closed this way." }, { status: 409 });
      const targetStatus = body.action === "mark_lost" ? "lost" : "retired";
      const reason = body.reason?.trim() || "";
      const allowed = targetStatus === "lost" ? LOST_REASONS : RETIRED_REASONS;
      if (!allowed.has(reason)) return NextResponse.json({ error: "Choose a valid reason." }, { status: 400 });
      const note = body.note_text?.trim() || "";
      if (reason === "other" && !note) return NextResponse.json({ error: "Add a short note when choosing Other." }, { status: 400 });
      const now = new Date().toISOString();
      await rest<void>(`sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: targetStatus, outcome_reason: reason, outcome_note: note || null, closed_at: now, closed_by_profile_id: profile.id, closed_by_name: profile.display_name, claimed_at: null, claimed_by_profile_id: null, claimed_by_name: null, updated_at: now }) });
      await rest<void>("sales_opportunity_status_history", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ opportunity_id: opportunityId, from_status: "open", to_status: targetStatus, reason, note_text: note || null, changed_by_profile_id: profile.id, changed_by_name: profile.display_name, changed_at: now }) });
      await rest<void>(`sales_opportunity_assignment_history?opportunity_id=eq.${encodeURIComponent(opportunityId)}&unassigned_at=is.null`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ unassigned_at: now }) });
      return NextResponse.json({ ok: true, status: targetStatus, closed_at: now });
    }

    if (body?.action === "reopen") {
      const opportunity = await getOpportunity();
      if (!opportunity) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
      if (!new Set(["lost", "retired"]).has(opportunity.status)) return NextResponse.json({ error: "Only lost or retired leads can be reopened." }, { status: 409 });
      const now = new Date().toISOString();
      await rest<void>(`sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "open", outcome_reason: null, outcome_note: null, closed_at: null, closed_by_profile_id: null, closed_by_name: null, reopened_at: now, reopened_by_profile_id: profile.id, reopened_by_name: profile.display_name, updated_at: now }) });
      await rest<void>("sales_opportunity_status_history", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ opportunity_id: opportunityId, from_status: opportunity.status, to_status: "open", reason: "reopened", changed_by_profile_id: profile.id, changed_by_name: profile.display_name, changed_at: now }) });
      return NextResponse.json({ ok: true, status: "open", reopened_at: now });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update lead." }, { status: 500 });
  }
}
