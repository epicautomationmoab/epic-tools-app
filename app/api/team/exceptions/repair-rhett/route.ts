import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

function config() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!raw || !key) throw new Error("Supabase configuration missing");
  return { url: (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, ""), key };
}
async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init, cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(body || `Supabase returned ${response.status}`);
  return body ? JSON.parse(body) as T : undefined as T;
}
type Job = {
  id: string; confirmation_code: string; action_type: string; status: string;
  mpwr_confirmation_number: string | null; mpwr_waiver_url: string | null;
  source_trip_order_ids: string | null; source_experience_ids: string | null;
  suggested_mpwr_listing: string | null; start_time: string | null;
  vehicle_resources: string | null; mpwr_date_to_select: string | null;
};
export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation")
    return NextResponse.json({ error: "Employee login required" }, { status: 401 });
  const body = await request.json().catch(() => null) as { source_id?: string } | null;
  const id = body?.source_id?.trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid Rhett job" }, { status: 400 });
  try {
    const cols = "id,confirmation_code,action_type,status,mpwr_confirmation_number,mpwr_waiver_url,source_trip_order_ids,source_experience_ids,suggested_mpwr_listing,start_time,vehicle_resources,mpwr_date_to_select";
    const rows = await rest<Job[]>(`mpwr_agent_queue?id=eq.${encodeURIComponent(id)}&select=${cols}&limit=1`);
    const job = rows[0];
    if (!job || job.action_type !== "create_reservation") return NextResponse.json({ error: "Rhett booking job not found" }, { status: 404 });
    if (!["failed","needs_human_review","needs_review"].includes(job.status))
      return NextResponse.json({ error: "Job is no longer an active booking exception" }, { status: 409 });
    const siblings = await rest<Job[]>(`mpwr_agent_queue?confirmation_code=eq.${encodeURIComponent(job.confirmation_code)}&action_type=eq.create_reservation&select=${cols}&limit=1000`);
    const sameUnit = (other: Job) => other.source_trip_order_ids === job.source_trip_order_ids
      && other.source_experience_ids === job.source_experience_ids
      && other.suggested_mpwr_listing === job.suggested_mpwr_listing
      && other.start_time === job.start_time
      && other.vehicle_resources === job.vehicle_resources;
    if (siblings.some(other => other.id !== job.id && sameUnit(other) && ["pending","in_progress","completed"].includes(other.status)))
      return NextResponse.json({ error: "This operational unit has another pending or completed Rhett job. Review it before retrying." }, { status: 409 });
    const reservation = await rest<Array<{ is_cancelled: boolean | null; mpwr_confirmation_number: string | null }>>(
      `operational_reservations?confirmation_code=eq.${encodeURIComponent(job.confirmation_code)}&select=is_cancelled,mpwr_confirmation_number&limit=20`);
    if (reservation.some(row => row.is_cancelled))
      return NextResponse.json({ error: "TripWorks reservation is cancelled. Do not rebook." }, { status: 409 });
    if (reservation.some(row => row.mpwr_confirmation_number))
      return NextResponse.json({ error: "A linked MPWR booking is already recorded. Review before rebooking." }, { status: 409 });
    if (!job.mpwr_date_to_select || job.mpwr_date_to_select < new Date().toLocaleDateString("en-CA", {timeZone:"America/Denver"}))
      return NextResponse.json({ error: "The activity date has passed or is missing. Automatic retry blocked." }, { status: 409 });
    // The existing recovery RPC finishes stored MPWR results, flags partial
    // identities for review, or requeues the existing job when no identity is saved.
    const outcome = await rest<{ outcome: string; message: string }>("rpc/recover_stuck_rhett_job", {
      method: "POST", body: JSON.stringify({ p_job_id: job.id }),
    });
    return NextResponse.json({ ok: true, ...outcome });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Rhett repair failed" }, { status: 500 });
  }
}
