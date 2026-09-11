import { NextResponse } from "next/server";
import { supabaseRpc, supabaseSelect } from "@/lib/server/supabase-rest";

type RosterRow = {
  store_visit_id: string;
  confirmation_code: string;
  vehicle_slot: number;
  vehicle_label: string | null;
  visit_date: string;
  checkout_status: string;
  checkin_status: string;
};

type CheckinJob = {
  id: string;
  status: string;
  instruction_snapshot: Record<string, unknown> | null;
  created_at: string;
};

type ReleaseResult = {
  dispatch_id: string;
  job_id: string | null;
  checkin_status: string;
};

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function denverParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
  };
}

async function triggerAxelIn(jobId: string) {
  const configuredUrl = requiredEnv("AXEL_IN_TRIGGER_URL");
  const secret = requiredEnv("AXEL_IN_TRIGGER_SECRET");
  const baseUrl = /^https?:\/\//i.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`;
  const response = await fetch(baseUrl.replace(/\/$/, "") + "/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-axel-secret": secret,
    },
    body: JSON.stringify({ job_id: jobId }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || `Axel In trigger failed (${response.status}).`);
  }
  return payload;
}

async function run(request: Request) {
  try {
    if (request.headers.get("authorization") !== `Bearer ${requiredEnv("CRON_SECRET")}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
    }

    const { date, hour } = denverParts();
    if (hour !== 23) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Not 11 PM America/Denver." });
    }

    // At 11 PM all tours should be back. Recover both failure cases before the
    // dispatch page rolls to the next day at midnight:
    // 1) prepared = guide never clicked Return, so release it automatically.
    // 2) checkin_queued = it was released but Axel did not finish, so retry once.
    const rosterParams = new URLSearchParams({
      select: "store_visit_id,confirmation_code,vehicle_slot,vehicle_label,visit_date,checkout_status,checkin_status",
      visit_date: `eq.${date}`,
      checkout_status: "eq.out",
      checkin_status: "in.(prepared,checkin_queued)",
      order: "confirmation_code.asc,vehicle_slot.asc",
      limit: "200",
    });
    const outstanding = await supabaseSelect<RosterRow>("tour_vehicle_dispatch_roster_v", rosterParams);

    if (!outstanding.length) {
      return NextResponse.json({ ok: true, date, found: 0, released: 0, retried: 0, results: [] });
    }

    const jobParams = new URLSearchParams({
      select: "id,status,instruction_snapshot,created_at",
      action_type: "eq.checkin",
      execution_mode: "eq.shadow",
      builder_name: "eq.Miles",
      builder_version: "eq.miles-shadow-v2",
      status: "eq.shadow_ready",
      order: "created_at.desc",
      limit: "200",
    });
    const retryableJobs = await supabaseSelect<CheckinJob>("tour_vehicle_jobs", jobParams);

    const results = [];
    for (const row of outstanding) {
      try {
        if (row.checkin_status === "prepared") {
          const release = await supabaseRpc<ReleaseResult[]>("release_tour_vehicle_checkin_shadow", {
            p_store_visit_id: row.store_visit_id,
            p_vehicle_slot: row.vehicle_slot,
            p_released_by: "11 PM Tour Check-In Sweep",
          });
          const released = release?.[0];
          if (!released?.job_id || released.checkin_status !== "checkin_queued") {
            throw new Error("Prepared check-in could not be released.");
          }
          await triggerAxelIn(released.job_id);
          results.push({
            confirmation_code: row.confirmation_code,
            vehicle_slot: row.vehicle_slot,
            vehicle_label: row.vehicle_label,
            prior_status: row.checkin_status,
            action: "auto_released_and_triggered",
            job_id: released.job_id,
            ok: true,
          });
          continue;
        }

        const job = retryableJobs.find((candidate) => {
          const packet = candidate.instruction_snapshot ?? {};
          return String(packet.store_visit_id ?? "") === row.store_visit_id && Number(packet.vehicle_slot) === row.vehicle_slot;
        });
        if (!job?.id) {
          results.push({
            confirmation_code: row.confirmation_code,
            vehicle_slot: row.vehicle_slot,
            vehicle_label: row.vehicle_label,
            prior_status: row.checkin_status,
            action: "retry_not_available",
            ok: false,
            error: "No retryable Axel In shadow_ready job found.",
          });
          continue;
        }

        await triggerAxelIn(job.id);
        results.push({
          confirmation_code: row.confirmation_code,
          vehicle_slot: row.vehicle_slot,
          vehicle_label: row.vehicle_label,
          prior_status: row.checkin_status,
          action: "retry_triggered",
          job_id: job.id,
          ok: true,
        });
      } catch (error) {
        results.push({
          confirmation_code: row.confirmation_code,
          vehicle_slot: row.vehicle_slot,
          vehicle_label: row.vehicle_label,
          prior_status: row.checkin_status,
          action: row.checkin_status === "prepared" ? "auto_release_failed" : "retry_failed",
          ok: false,
          error: error instanceof Error ? error.message : "Unable to recover tour vehicle check-in.",
        });
      }
    }

    console.log("11 PM tour check-in sweep", { date, found: outstanding.length, results });
    return NextResponse.json({
      ok: true,
      date,
      found: outstanding.length,
      released: results.filter((result) => result.action === "auto_released_and_triggered" && result.ok).length,
      retried: results.filter((result) => result.action === "retry_triggered" && result.ok).length,
      results,
    });
  } catch (error) {
    console.error("11 PM tour check-in sweep failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown tour check-in sweep error." },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
