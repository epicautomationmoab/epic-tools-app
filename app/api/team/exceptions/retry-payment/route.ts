import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";

// The existing launch_cassie_settle_balance database RPC creates a new job
// while preserving the unique one-active-job-per-readiness invariant.
// Cassie reconciles the current MPWR balance during each run.
function cfg() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error("Supabase configuration missing.");
  return { base: (/^https?:\/\//i.test(url) ? url : `https://${url}`).replace(/\/+$/, ""), key };
}
async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { base, key } = cfg();
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...init, cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(body || `Supabase error ${response.status}`);
  return body ? JSON.parse(body) as T : undefined as T;
}
type Job = { id: string; readiness_id: string; confirmation_code: string; status: string; mpwr_confirmation_number: string | null; created_at: string };
export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  if (!profile || profile.role === "workstation") return NextResponse.json({ error: "Named employee login required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { source_id?: string } | null;
  const jobId = body?.source_id?.trim();
  if (!jobId) return NextResponse.json({ error: "Missing Cassie job." }, { status: 400 });
  try {
    const rows = await rest<Job[]>(`cassie_mpwr_jobs?id=eq.${encodeURIComponent(jobId)}&select=id,readiness_id,confirmation_code,status,mpwr_confirmation_number,created_at&limit=1`);
    const job = rows[0];
    if (!job) return NextResponse.json({ error: "Cassie job not found." }, { status: 404 });
    if (!["failed", "needs_review"].includes(job.status)) return NextResponse.json({ error: "This job is no longer a retryable exception." }, { status: 409 });
    const current = await rest<Job[]>(`cassie_mpwr_jobs?readiness_id=eq.${encodeURIComponent(job.readiness_id)}&select=id,readiness_id,confirmation_code,status,mpwr_confirmation_number,created_at&order=created_at.desc&limit=1`);
    if (current[0]?.id !== job.id) return NextResponse.json({ error: "A newer Cassie job exists. Refresh before retrying." }, { status: 409 });

    // Race-safe: the existing partial unique database index prevents two
    // simultaneously queued/claimed jobs for one readiness_id.
    const created = await rest<{ id: string; status: string }>(`rpc/launch_cassie_settle_balance`, {
      method: "POST",
      body: JSON.stringify({ p_readiness_id: job.readiness_id, p_requested_by: `Readiness manual retry by ${profile.display_name || profile.email || profile.id}` }),
    });
    return NextResponse.json({ ok: true, job_id: created.id, status: created.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to queue retry." }, { status: 500 });
  }
}
