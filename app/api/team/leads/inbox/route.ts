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

const CLASSIFICATIONS = new Set(["unclassified", "sales_lead", "customer_service", "existing_guest", "other", "junk"]);
const ACTIVE_CLASSIFICATIONS = new Set(["unclassified", "sales_lead"]);

export async function GET(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  try {
    const items = await rest<Array<Record<string, unknown>>>(
      `customer_work_items?status=eq.open&select=${encodeURIComponent("id,contact_id,opportunity_id,source,source_record_id,work_type,status,subject,summary,assigned_profile_id,assigned_name,created_at,updated_at,metadata")}&order=created_at.desc&limit=500`,
    );
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Sales Inbox." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await requireEmployee(request);
  if (!profile) return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { action?: string; work_item_id?: string; work_type?: string } | null;
  const id = body?.work_item_id?.trim();
  if (!id) return NextResponse.json({ error: "Work item is required." }, { status: 400 });

  try {
    const rows = await rest<Array<{ id: string; assigned_profile_id: string | null; assigned_name: string | null; status: string }>>(
      `customer_work_items?id=eq.${encodeURIComponent(id)}&select=id,assigned_profile_id,assigned_name,status&limit=1`,
    );
    const item = rows[0];
    if (!item) return NextResponse.json({ error: "Work item not found." }, { status: 404 });
    if (item.status !== "open") return NextResponse.json({ error: "This work item is no longer open." }, { status: 409 });
    const now = new Date().toISOString();

    if (body?.action === "claim") {
      if (item.assigned_profile_id && item.assigned_profile_id !== profile.id) return NextResponse.json({ error: `Already claimed by ${item.assigned_name || "another rep"}.` }, { status: 409 });
      await rest<void>(`customer_work_items?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ assigned_profile_id: profile.id, assigned_name: profile.display_name, updated_at: now }),
      });
      return NextResponse.json({ ok: true, assigned_profile_id: profile.id, assigned_name: profile.display_name });
    }

    if (body?.action === "release") {
      if (item.assigned_profile_id !== profile.id && profile.role !== "admin" && profile.role !== "manager") return NextResponse.json({ error: "Only the assigned rep or a manager can release this item." }, { status: 403 });
      await rest<void>(`customer_work_items?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ assigned_profile_id: null, assigned_name: null, updated_at: now }),
      });
      return NextResponse.json({ ok: true });
    }

    if (body?.action === "classify") {
      const workType = body.work_type?.trim() || "";
      if (!CLASSIFICATIONS.has(workType)) return NextResponse.json({ error: "Choose a valid classification." }, { status: 400 });
      const close = !ACTIVE_CLASSIFICATIONS.has(workType);
      await rest<void>(`customer_work_items?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ work_type: workType, status: close ? "closed" : "open", closed_at: close ? now : null, updated_at: now }),
      });
      return NextResponse.json({ ok: true, work_type: workType, status: close ? "closed" : "open" });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update work item." }, { status: 500 });
  }
}
