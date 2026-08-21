import { NextRequest, NextResponse } from "next/server";
import { getGuestFormsActor } from "@/lib/workstation-auth";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

type PreferenceRow = {
  readiness_id: string;
  confirmation_code: string;
  send_mode: "review_request" | "thank_you_only";
  updated_by: string | null;
  updated_at: string;
};

type ReadinessRow = {
  readiness_id: string;
  confirmation_code: string;
};

type JobRow = {
  readiness_id: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled";
  scheduled_for: string;
  sent_at: string | null;
};

async function resolveReadinessId(request: NextRequest) {
  const direct = request.nextUrl.searchParams.get("readinessId")?.trim();
  if (direct) return direct;

  const confirmationCode = request.nextUrl.searchParams.get("confirmationCode")?.trim().toUpperCase();
  if (!confirmationCode) return "";

  const rows = await supabaseSelect<ReadinessRow>(
    "guest_readiness_operational",
    new URLSearchParams({
      select: "readiness_id,confirmation_code",
      confirmation_code: `eq.${confirmationCode}`,
      order: "visit_start_time.desc",
      limit: "1",
    }),
  );
  return rows[0]?.readiness_id ?? "";
}

export async function GET(request: NextRequest) {
  const actor = await getGuestFormsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const readinessId = await resolveReadinessId(request);
    if (!readinessId) {
      return NextResponse.json({
        sendMode: "review_request",
        readinessId: null,
        hasPostVisitJob: false,
        jobStatus: null,
        scheduledFor: null,
        sentAt: null,
      });
    }

    const [preferences, jobs] = await Promise.all([
      supabaseSelect<PreferenceRow>(
        "post_visit_email_preferences",
        new URLSearchParams({
          select: "readiness_id,confirmation_code,send_mode,updated_by,updated_at",
          readiness_id: `eq.${readinessId}`,
          limit: "1",
        }),
      ),
      supabaseSelect<JobRow>(
        "post_visit_email_jobs",
        new URLSearchParams({
          select: "readiness_id,status,scheduled_for,sent_at",
          readiness_id: `eq.${readinessId}`,
          limit: "1",
        }),
      ),
    ]);

    const job = jobs[0];
    return NextResponse.json({
      sendMode: preferences[0]?.send_mode ?? "review_request",
      updatedBy: preferences[0]?.updated_by ?? null,
      updatedAt: preferences[0]?.updated_at ?? null,
      readinessId,
      hasPostVisitJob: Boolean(job),
      jobStatus: job?.status ?? null,
      scheduledFor: job?.scheduled_for ?? null,
      sentAt: job?.sent_at ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load post-visit email preference." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const actor = await getGuestFormsActor(request);
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = await request.json();
    const readinessId = String(body?.readinessId ?? "").trim();
    const confirmationCode = String(body?.confirmationCode ?? "").trim().toUpperCase();
    const sendMode = String(body?.sendMode ?? "").trim();

    if (!readinessId || !confirmationCode) {
      return NextResponse.json({ error: "readinessId and confirmationCode are required." }, { status: 400 });
    }
    if (sendMode !== "review_request" && sendMode !== "thank_you_only") {
      return NextResponse.json({ error: "Invalid sendMode." }, { status: 400 });
    }

    const jobs = await supabaseSelect<JobRow>(
      "post_visit_email_jobs",
      new URLSearchParams({
        select: "readiness_id,status,scheduled_for,sent_at",
        readiness_id: `eq.${readinessId}`,
        limit: "1",
      }),
    );
    if (jobs[0]?.status === "sent" || jobs[0]?.status === "cancelled") {
      return NextResponse.json({ error: "This post-visit email is already closed and can no longer be changed." }, { status: 409 });
    }

    const existing = await supabaseSelect<PreferenceRow>(
      "post_visit_email_preferences",
      new URLSearchParams({ select: "readiness_id,confirmation_code,send_mode,updated_by,updated_at", readiness_id: `eq.${readinessId}`, limit: "1" }),
    );

    if (existing.length) {
      await supabasePatch(
        "post_visit_email_preferences",
        new URLSearchParams({ readiness_id: `eq.${readinessId}` }),
        {
          confirmation_code: confirmationCode,
          send_mode: sendMode,
          updated_by: actor.actorName,
          updated_at: new Date().toISOString(),
        },
      );
    } else {
      await supabaseInsert<PreferenceRow>("post_visit_email_preferences", {
        readiness_id: readinessId,
        confirmation_code: confirmationCode,
        send_mode: sendMode,
        updated_by: actor.actorName,
      });
    }

    return NextResponse.json({ ok: true, sendMode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save post-visit email preference." }, { status: 500 });
  }
}
