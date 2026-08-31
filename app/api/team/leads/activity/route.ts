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

type Activity = {
  opportunity_id: string;
  kind: "text" | "missed_call" | "call" | "voicemail" | "shopped_again";
  at: string;
  preview: string | null;
  unread: boolean;
};

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  try {
    const [messages, calls, repeatShopping, seen, baselines] = await Promise.all([
      rest<Array<{ matched_opportunity_id: string; first_received_at: string; sent_at: string | null; message_body: string | null }>>(
        `callrail_text_messages?matched_opportunity_id=not.is.null&direction=eq.inbound&select=${encodeURIComponent("matched_opportunity_id,first_received_at,sent_at,message_body")}&order=first_received_at.desc&limit=500`,
      ),
      rest<Array<{ matched_opportunity_id: string; direction: string | null; answered: boolean | null; voicemail: boolean | null; start_time: string | null; last_received_at: string; customer_name: string | null }>>(
        `callrail_calls?matched_opportunity_id=not.is.null&select=${encodeURIComponent("matched_opportunity_id,direction,answered,voicemail,start_time,last_received_at,customer_name")}&order=last_received_at.desc&limit=500`,
      ),
      rest<Array<{ opportunity_id: string; created_at: string; draft_id: string }>>(
        `sales_opportunity_drafts?select=${encodeURIComponent("opportunity_id,created_at,draft_id")}&order=created_at.desc&limit=1000`,
      ),
      rest<Array<{ opportunity_id: string; last_seen_at: string }>>(
        `sales_opportunity_activity_seen?profile_id=eq.${encodeURIComponent(profile.id)}&select=opportunity_id,last_seen_at`,
      ),
      rest<Array<{ established_at: string }>>(
        `sales_activity_baselines?activity_kind=eq.repeat_shopping&select=established_at&limit=1`,
      ),
    ]);

    const repeatShoppingBaseline = baselines[0]?.established_at || new Date().toISOString();
    const seenMap = new Map(seen.map((row) => [row.opportunity_id, row.last_seen_at]));
    const latest = new Map<string, Omit<Activity, "unread">>();

    for (const message of messages) {
      const at = message.sent_at || message.first_received_at;
      const current = latest.get(message.matched_opportunity_id);
      if (!current || new Date(at).getTime() > new Date(current.at).getTime()) {
        latest.set(message.matched_opportunity_id, { opportunity_id: message.matched_opportunity_id, kind: "text", at, preview: message.message_body });
      }
    }

    for (const call of calls) {
      const direction = (call.direction || "").toLowerCase();
      if (direction && !direction.includes("in")) continue;
      const at = call.start_time || call.last_received_at;
      const current = latest.get(call.matched_opportunity_id);
      if (!current || new Date(at).getTime() > new Date(current.at).getTime()) {
        latest.set(call.matched_opportunity_id, {
          opportunity_id: call.matched_opportunity_id,
          kind: call.voicemail ? "voicemail" : call.answered === false ? "missed_call" : "call",
          at,
          preview: call.customer_name,
        });
      }
    }

    const draftsByOpportunity = new Map<string, Array<{ created_at: string; draft_id: string }>>();
    for (const link of repeatShopping) {
      const list = draftsByOpportunity.get(link.opportunity_id) || [];
      list.push({ created_at: link.created_at, draft_id: link.draft_id });
      draftsByOpportunity.set(link.opportunity_id, list);
    }
    for (const [opportunityId, links] of draftsByOpportunity.entries()) {
      if (links.length < 2) continue;
      links.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const at = links[0].created_at;
      if (new Date(at).getTime() <= new Date(repeatShoppingBaseline).getTime()) continue;
      const current = latest.get(opportunityId);
      if (!current || new Date(at).getTime() > new Date(current.at).getTime()) {
        latest.set(opportunityId, { opportunity_id: opportunityId, kind: "shopped_again", at, preview: "Another TripWorks draft was created" });
      }
    }

    const activity: Record<string, Activity> = {};
    for (const [opportunityId, item] of latest.entries()) {
      const lastSeen = seenMap.get(opportunityId);
      activity[opportunityId] = { ...item, unread: !lastSeen || new Date(item.at).getTime() > new Date(lastSeen).getTime() };
    }

    return NextResponse.json({ ok: true, activity });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load lead activity." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { opportunity_id?: string } | null;
  const opportunityId = body?.opportunity_id?.trim();
  if (!opportunityId) return NextResponse.json({ error: "Opportunity is required." }, { status: 400 });

  try {
    const now = new Date().toISOString();
    await rest<void>("sales_opportunity_activity_seen?on_conflict=opportunity_id,profile_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ opportunity_id: opportunityId, profile_id: profile.id, last_seen_at: now, updated_at: now }),
    });
    return NextResponse.json({ ok: true, last_seen_at: now });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to mark lead activity seen." }, { status: 500 });
  }
}
