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

const LOST_REASONS = new Set(["price", "availability", "product_mismatch", "policy_or_qualification", "went_elsewhere", "plans_changed", "unresponsive", "timing", "other"]);
const RETIRED_REASONS = new Set(["fake_or_junk_contact", "duplicate", "test_or_staff_activity", "bad_data", "not_a_prospect", "other"]);

export async function POST(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    action?: "claim" | "release" | "note" | "mark_lost" | "retire" | "reopen";
    opportunity_id?: string;
    note_text?: string;
    reason?: string;
  } | null;
  const opportunityId = body?.opportunity_id?.trim();
  if (!opportunityId) return NextResponse.json({ error: "Opportunity is required." }, { status: 400 });

  try {
    const getOpportunity = async () => {
      const rows = await rest<Array<{ id: string; status: string; claimed_by_profile_id: string | null; claimed_by_name: string | null }>>(
        `sales_opportunities?id=eq.${encodeURIComponent(opportunityId)}&select=id,status,claimed_by_profile_id,claimed_by_name&limit=1`,
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
