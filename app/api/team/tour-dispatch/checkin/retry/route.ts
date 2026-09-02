import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseRest } from "@/lib/server/supabase-rest";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";

async function triggerAxelIn(jobId: string) {
  const url = process.env.AXEL_IN_TRIGGER_URL?.trim();
  const secret = process.env.AXEL_IN_TRIGGER_SECRET?.trim();
  if (!url || !secret) throw new Error("Axel In trigger is not configured.");
  const response = await fetch(url.replace(/\/$/, "") + "/run", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-axel-secret": secret },
    body: JSON.stringify({ job_id: jobId }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Axel In trigger failed (${response.status}).`);
  return payload;
}

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (!profile && !workstation) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json();
    const storeVisitId = String(body?.store_visit_id ?? "").trim();
    const vehicleSlot = Number(body?.vehicle_slot);
    if (!storeVisitId || !Number.isInteger(vehicleSlot) || vehicleSlot < 1) {
      return NextResponse.json({ error: "Invalid tour vehicle slot." }, { status: 400 });
    }

    const jobs = await supabaseRest<any[]>("tour_vehicle_jobs", {
      params: {
        select: "id,status,instruction_snapshot,created_at",
        action_type: "eq.checkin",
        execution_mode: "eq.shadow",
        builder_name: "eq.Miles",
        builder_version: "eq.miles-shadow-v2",
        status: "eq.shadow_ready",
        order: "created_at.desc",
        limit: "50",
      },
    });
    const job = jobs.find((candidate) => {
      const packet = candidate?.instruction_snapshot ?? {};
      return String(packet.store_visit_id ?? "") === storeVisitId && Number(packet.vehicle_slot) === vehicleSlot;
    });
    if (!job?.id) return NextResponse.json({ error: "No retryable Axel In job was found for this vehicle." }, { status: 404 });

    await triggerAxelIn(job.id);
    return NextResponse.json({ ok: true, job_id: job.id, axel_triggered: true });
  } catch (error) {
    console.error("Axel In retry failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to retry vehicle check-in." }, { status: 500 });
  }
}
