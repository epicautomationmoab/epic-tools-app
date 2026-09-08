import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function config() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase server environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

async function getProfile(request: NextRequest) {
  return getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
}

function canManage(role?: string | null) {
  return role === "admin" || role === "manager";
}

function normalizeChannel(value: unknown) {
  return String(value || "text").trim().toLowerCase() === "email" ? "email" : "text";
}

export async function GET(request: NextRequest) {
  const profile = await getProfile(request);
  if (!profile || profile.role === "workstation") return NextResponse.json({ error: "Employee login required." }, { status: 401 });

  try {
    const channel = normalizeChannel(request.nextUrl.searchParams.get("channel"));
    const templates = await rest<Array<{
      template_id: string;
      name: string;
      message_body: string;
      subject_template: string | null;
      category: string | null;
      channel: string;
      sort_order: number;
      active: boolean;
      updated_at: string;
      updated_by: string | null;
    }>>(`guest_message_templates?active=eq.true&channel=eq.${encodeURIComponent(channel)}&select=${encodeURIComponent("template_id,name,message_body,subject_template,category,channel,sort_order,active,updated_at,updated_by")}&order=sort_order.asc,name.asc`);

    return NextResponse.json({ ok: true, can_manage: canManage(profile.role), channel, templates });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load templates." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const profile = await getProfile(request);
  if (!profile || !canManage(profile.role)) return NextResponse.json({ error: "Manager or admin access required." }, { status: 403 });

  try {
    const body = await request.json();
    const channel = normalizeChannel(body?.channel);
    const name = String(body?.name || "").trim();
    const messageBody = String(body?.message_body || "").trim();
    const subjectTemplate = channel === "email" ? String(body?.subject_template || "").trim() : null;
    const category = String(body?.category || "").trim() || null;
    const sortOrder = Number.isFinite(Number(body?.sort_order)) ? Number(body.sort_order) : 100;
    if (!name || !messageBody) return NextResponse.json({ error: "Template name and message are required." }, { status: 400 });
    if (channel === "email" && !subjectTemplate) return NextResponse.json({ error: "Email subject is required." }, { status: 400 });

    const rows = await rest<Array<Record<string, unknown>>>("guest_message_templates", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ name, message_body: messageBody, subject_template: subjectTemplate, category, channel, sort_order: sortOrder, created_by: profile.display_name, updated_by: profile.display_name }),
    });

    return NextResponse.json({ ok: true, template: rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create template." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const profile = await getProfile(request);
  if (!profile || !canManage(profile.role)) return NextResponse.json({ error: "Manager or admin access required." }, { status: 403 });

  try {
    const body = await request.json();
    const templateId = String(body?.template_id || "").trim();
    if (!templateId) return NextResponse.json({ error: "template_id is required." }, { status: 400 });

    const payload: Record<string, unknown> = { updated_by: profile.display_name, updated_at: new Date().toISOString() };
    if (typeof body?.name === "string") payload.name = body.name.trim();
    if (typeof body?.message_body === "string") payload.message_body = body.message_body.trim();
    if (typeof body?.subject_template === "string") payload.subject_template = body.subject_template.trim();
    if (typeof body?.category === "string") payload.category = body.category.trim() || null;
    if (body?.sort_order !== undefined && Number.isFinite(Number(body.sort_order))) payload.sort_order = Number(body.sort_order);
    if (typeof body?.active === "boolean") payload.active = body.active;

    const rows = await rest<Array<Record<string, unknown>>>(`guest_message_templates?template_id=eq.${encodeURIComponent(templateId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ ok: true, template: rows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update template." }, { status: 500 });
  }
}
