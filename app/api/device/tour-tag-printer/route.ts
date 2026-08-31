import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseRpc } from "@/lib/server/supabase-rest";
import { renderTourWindshieldCardSvg } from "@/lib/tour-windshield-card";

type PrintJob = {
  id: string;
  confirmation_code: string;
  vehicle_slot: number;
  guest_last_name: string;
  tour_name: string;
  departure_time: string;
  status: string;
};

function authorized(request: NextRequest) {
  const configured = process.env.TOUR_TAG_PRINTER_KEY?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!configured || !supplied) return false;
  const a = Buffer.from(configured);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action ?? "").trim();
    const worker = String(body?.worker ?? "epic-tour-tag-printer").trim();

    if (action === "claim") {
      const job = await supabaseRpc<PrintJob | null>("claim_next_tour_windshield_print_job", {
        p_worker: worker,
        p_lease_minutes: 5,
      });
      if (!job?.id) return new NextResponse(null, { status: 204 });

      const svg = renderTourWindshieldCardSvg({
        guestLastName: job.guest_last_name,
        tourName: job.tour_name,
        departureTime: job.departure_time,
        confirmationCode: job.confirmation_code,
      });
      return NextResponse.json({ job, svg });
    }

    const jobId = String(body?.job_id ?? "").trim();
    if (!jobId) return NextResponse.json({ error: "job_id is required." }, { status: 400 });

    if (action === "printing") {
      await supabaseRpc<void>("mark_tour_windshield_print_job_printing", { p_job_id: jobId, p_worker: worker });
      return NextResponse.json({ ok: true });
    }
    if (action === "complete") {
      await supabaseRpc<void>("complete_tour_windshield_print_job", { p_job_id: jobId, p_worker: worker });
      return NextResponse.json({ ok: true });
    }
    if (action === "fail") {
      await supabaseRpc<void>("fail_tour_windshield_print_job", {
        p_job_id: jobId,
        p_worker: worker,
        p_error: String(body?.error ?? "Unknown printer failure"),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    console.error("Tour tag printer API failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Printer API failed." }, { status: 500 });
  }
}
