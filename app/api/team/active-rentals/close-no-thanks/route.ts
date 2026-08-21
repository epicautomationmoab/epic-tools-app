import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { supabasePatch, supabaseRpc, supabaseSelect } from "@/lib/server/supabase-rest";

type JobRow = {
  id: string;
  status: string;
};

export async function POST(request: NextRequest) {
  const actor = await getGuestFormsActor(request);
  if (!actor) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { readinessId?: string };
    const readinessId = body.readinessId?.trim();
    if (!readinessId) {
      return NextResponse.json({ error: "readinessId is required." }, { status: 400 });
    }

    await supabaseRpc("set_epic_operational_handoff", {
      p_readiness_id: readinessId,
      p_handoff_status: "rental_returned",
      p_recorded_by: `${actor.actorName} — held-over cleanup`,
    });

    const jobs = await supabaseSelect<JobRow>(
      "post_visit_email_jobs",
      new URLSearchParams({
        select: "id,status",
        readiness_id: `eq.${readinessId}`,
        order: "created_at.desc",
        limit: "1",
      }),
    );

    const job = jobs[0];
    if (job?.status === "sent") {
      return NextResponse.json(
        { error: "The thank-you email has already been sent for this reservation." },
        { status: 409 },
      );
    }

    if (job) {
      await supabasePatch(
        "post_visit_email_jobs",
        new URLSearchParams({ id: `eq.${job.id}` }),
        {
          status: "cancelled",
          last_error: null,
          updated_at: new Date().toISOString(),
        },
      );
    }

    return NextResponse.json({ ok: true, emailSuppressed: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to close held-over rental." },
      { status: 500 },
    );
  }
}
