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

type SourceType = "payment" | "deposit_release" | "email_delivery";

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") {
    return NextResponse.json({ error: "Employee login required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    source_type?: SourceType;
    source_id?: string;
  } | null;

  const sourceType = body?.source_type;
  const sourceId = body?.source_id?.trim();

  if (!sourceType || !["payment", "deposit_release", "email_delivery"].includes(sourceType) || !sourceId) {
    return NextResponse.json({ error: "A valid exception source is required." }, { status: 400 });
  }

  try {
    const existing = await rest<Array<{ id: string }>>(
      `operational_exception_resolutions?source_type=eq.${encodeURIComponent(sourceType)}&source_id=eq.${encodeURIComponent(sourceId)}&select=id&limit=1`,
    );
    if (existing[0]?.id) return NextResponse.json({ ok: true, already_resolved: true });

    let confirmationCode = "";
    let originalStatus = "";
    let originalMessage = "";

    if (sourceType === "payment") {
      const rows = await rest<Array<{ confirmation_code: string; status: string; result_message: string | null; last_error: string | null }>>(
        `cassie_mpwr_jobs?id=eq.${encodeURIComponent(sourceId)}&select=confirmation_code,status,result_message,last_error&limit=1`,
      );
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Payment exception not found." }, { status: 404 });
      confirmationCode = row.confirmation_code;
      originalStatus = row.status;
      originalMessage = row.last_error?.trim() || row.result_message?.trim() || "";
    } else if (sourceType === "deposit_release") {
      const rows = await rest<Array<{ confirmation_code: string; status: string; result_message: string | null; last_error: string | null }>>(
        `victor_deposit_jobs?id=eq.${encodeURIComponent(sourceId)}&select=confirmation_code,status,result_message,last_error&limit=1`,
      );
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Deposit release exception not found." }, { status: 404 });
      confirmationCode = row.confirmation_code;
      originalStatus = row.status;
      originalMessage = row.last_error?.trim() || row.result_message?.trim() || "";
    } else {
      const rows = await rest<Array<{ confirmation_code: string; status: string; failure_type: string | null; failure_detail: string | null }>>(
        `guest_email_delivery_incidents?id=eq.${encodeURIComponent(sourceId)}&select=confirmation_code,status,failure_type,failure_detail&limit=1`,
      );
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Email delivery exception not found." }, { status: 404 });
      confirmationCode = row.confirmation_code;
      originalStatus = row.status;
      originalMessage = row.failure_detail?.trim() || row.failure_type?.trim() || "";
    }

    await rest<void>("operational_exception_resolutions", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        source_type: sourceType,
        source_id: sourceId,
        confirmation_code: confirmationCode || null,
        original_status: originalStatus || null,
        original_message: originalMessage || null,
        resolution_method: "manual_fixed",
        resolved_by_profile_id: profile.id || null,
        resolved_by_name: profile.display_name || profile.email || "EpicTools staff",
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to mark exception fixed." },
      { status: 500 },
    );
  }
}
