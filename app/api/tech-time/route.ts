import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { identifyTeamProfileByPin } from "@/lib/server/team-pin";
import { verifyWorkstationCookie, WORKSTATION_COOKIE } from "@/lib/server/workstation-auth";
import { supabaseInsert, supabasePatch, supabasePatchRows, supabaseSelect } from "@/lib/server/supabase-rest";

type FleetServiceQueueRow = {
  vehicle_number: number;
  model_family: string;
  current_mileage: number | null;
  miles_until_service: number | null;
  service_status: string;
  booking_inventory_state: string;
  operational_status: string;
  on_ride: boolean;
};

type TeamProfileRow = {
  id: string;
  display_name: string;
  role: string;
  active: boolean;
  pin_set_at: string | null;
};

type JobRow = {
  id: string;
  job_number: number;
  vehicle_number: string;
  category: string;
  description: string | null;
  status: string;
  book_minutes: number | null;
  created_by_profile_id: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type EntryRow = {
  id: string;
  job_id: string;
  technician_profile_id: string;
  technician_name: string;
  state: "running" | "paused" | "stopped";
  started_at: string;
  current_segment_started_at: string | null;
  paused_at: string | null;
  stopped_at: string | null;
  accumulated_seconds: number;
  pause_reason: string | null;
  completion_result: string | null;
  two_person_acknowledged: boolean;
  created_at: string;
  updated_at: string;
};

function hasPreviewAccess(request: NextRequest) {
  const expected = process.env.EPIC_PREVIEW_TOKEN;
  const supplied = request.cookies.get("epic_preview_access")?.value;
  return Boolean(expected && supplied === expected);
}

async function requestAccess(request: NextRequest) {
  const profile = await getAuthenticatedTeamProfile(request.cookies.get("epic_access_token")?.value);
  const workstation = verifyWorkstationCookie(request.cookies.get(WORKSTATION_COOKIE)?.value);
  if (profile || workstation || hasPreviewAccess(request)) return { profile, workstation };
  return null;
}

async function actorForAction(request: NextRequest, body: any) {
  const access = await requestAccess(request);
  if (!access) return null;

  const pin = typeof body?.actorPin === "string" ? body.actorPin.trim() : "";
  if (pin) {
    const actor = await identifyTeamProfileByPin(pin);
    if (!actor) throw new Error("Incorrect PIN.");
    return actor;
  }

  if (access.profile && access.profile.role !== "workstation") {
    return {
      id: access.profile.id,
      display_name: access.profile.display_name,
      role: access.profile.role,
      email: access.profile.email,
    };
  }

  throw new Error("Select your name and enter your PIN.");
}

function nowIso() {
  return new Date().toISOString();
}

function secondsSince(iso: string | null) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

async function getOpenEntryForTech(profileId: string) {
  const rows = await supabaseSelect<EntryRow>(
    "tech_time_entries",
    new URLSearchParams({
      select: "*",
      technician_profile_id: `eq.${profileId}`,
      state: "in.(running,paused)",
      order: "updated_at.desc",
      limit: "1",
    }),
  );
  return rows[0] ?? null;
}

async function getJob(jobId: string) {
  const rows = await supabaseSelect<JobRow>(
    "tech_time_jobs",
    new URLSearchParams({ select: "*", id: `eq.${jobId}`, limit: "1" }),
  );
  return rows[0] ?? null;
}

async function getOpenEntriesForJob(jobId: string) {
  return supabaseSelect<EntryRow>(
    "tech_time_entries",
    new URLSearchParams({
      select: "*",
      job_id: `eq.${jobId}`,
      state: "in.(running,paused)",
      order: "started_at.asc",
    }),
  );
}

async function getBoard() {
  const rows = await supabaseSelect<any>(
    "tech_time_board_v",
    new URLSearchParams({ select: "*", order: "started_at.asc" }),
  );
  return rows;
}

async function getRecentCompleted() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const entries = await supabaseSelect<EntryRow>(
    "tech_time_entries",
    new URLSearchParams({
      select: "*",
      state: "eq.stopped",
      stopped_at: `gte.${since}`,
      order: "stopped_at.desc",
      limit: "200",
    }),
  );
  const jobIds = Array.from(new Set(entries.map((e) => e.job_id)));
  if (!jobIds.length) return [];
  const jobs = await supabaseSelect<JobRow>(
    "tech_time_jobs",
    new URLSearchParams({
      select: "*",
      id: `in.(${jobIds.join(",")})`,
    }),
  );
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return entries.map((e) => ({ ...e, job: byId.get(e.job_id) ?? null }));
}

async function getServiceQueue() {
  const rows = await supabaseSelect<FleetServiceQueueRow>(
    "fleet_maintenance_dashboard_v2",
    new URLSearchParams({
      select: "vehicle_number,model_family,current_mileage,miles_until_service,service_status,booking_inventory_state,operational_status,on_ride",
      current_mileage: "not.is.null",
      service_status: "in.(due,upcoming)",
      order: "miles_until_service.asc,vehicle_number.asc",
    }),
  );
  return rows;
}

export async function GET(request: NextRequest) {
  if (!await requestAccess(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const [profiles, board, recent, serviceQueue] = await Promise.all([
      supabaseSelect<TeamProfileRow>(
        "team_profiles",
        new URLSearchParams({
          select: "id,display_name,role,active,pin_set_at",
          active: "eq.true",
          role: "neq.workstation",
          pin_set_at: "not.is.null",
          order: "display_name.asc",
        }),
      ),
      getBoard(),
      getRecentCompleted(),
      getServiceQueue(),
    ]);

    return NextResponse.json({ profiles, board, recent, serviceQueue });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load Tech Time." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as any;
  if (!body || typeof body.action !== "string") {
    return NextResponse.json({ error: "Action is required." }, { status: 400 });
  }

  try {
    const actor = await actorForAction(request, body);
    if (!actor) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    if (body.action === "start") {
      const vehicleNumber = String(body.vehicleNumber ?? "").trim();
      const category = String(body.category ?? "").trim();
      const description = String(body.description ?? "").trim() || null;
      const confirmTwoPerson = body.confirmTwoPerson === true;

      if (!vehicleNumber || !category) {
        return NextResponse.json({ error: "Vehicle and work category are required." }, { status: 400 });
      }

      const existing = await getOpenEntryForTech(actor.id);
      if (existing) {
        const existingJob = await getJob(existing.job_id);
        return NextResponse.json({
          error: "This technician already has an open job.",
          code: "EXISTING_OPEN_ENTRY",
          existingEntry: existing,
          existingJob,
        }, { status: 409 });
      }

      const board = await getBoard();
      const matching = board.find((row: any) => String(row.vehicle_number) === vehicleNumber);
      let job: JobRow;

      if (matching) {
        const existingJob = await getJob(matching.job_id);
        if (!existingJob) throw new Error("Unable to load the existing job.");

        if (!confirmTwoPerson) {
          const names = board
            .filter((row: any) => row.job_id === existingJob.id)
            .map((row: any) => row.technician_name);
          return NextResponse.json({
            error: "Another technician is already working on this vehicle.",
            code: "TWO_PERSON_CONFIRMATION_REQUIRED",
            existingJob,
            technicians: names,
          }, { status: 409 });
        }
        job = existingJob;
      } else {
        job = await supabaseInsert<JobRow>("tech_time_jobs", {
          vehicle_number: vehicleNumber,
          category,
          description,
          status: "in_progress",
          created_by_profile_id: actor.id,
          created_by_name: actor.display_name,
          created_at: nowIso(),
          updated_at: nowIso(),
        });
      }

      const entry = await supabaseInsert<EntryRow>("tech_time_entries", {
        job_id: job.id,
        technician_profile_id: actor.id,
        technician_name: actor.display_name,
        state: "running",
        started_at: nowIso(),
        current_segment_started_at: nowIso(),
        accumulated_seconds: 0,
        two_person_acknowledged: Boolean(matching && confirmTwoPerson),
        updated_at: nowIso(),
      });

      await supabasePatch(
        "tech_time_jobs",
        new URLSearchParams({ id: `eq.${job.id}` }),
        { status: "in_progress", updated_at: nowIso() },
      );

      return NextResponse.json({ ok: true, job, entry });
    }

    if (body.action === "pause") {
      const entry = await getOpenEntryForTech(actor.id);
      if (!entry || entry.state !== "running") {
        return NextResponse.json({ error: "No running job found." }, { status: 409 });
      }
      const reason = String(body.reason ?? "");
      const allowed = new Set(["waiting_for_parts","waiting_for_approval","pulled_to_another_vehicle","break_or_shift_end","other"]);
      if (!allowed.has(reason)) return NextResponse.json({ error: "Pause reason is required." }, { status: 400 });

      const total = entry.accumulated_seconds + secondsSince(entry.current_segment_started_at);
      const at = nowIso();
      await supabasePatch(
        "tech_time_entries",
        new URLSearchParams({ id: `eq.${entry.id}` }),
        {
          state: "paused",
          accumulated_seconds: total,
          current_segment_started_at: null,
          paused_at: at,
          pause_reason: reason,
          updated_at: at,
        },
      );

      const others = (await getOpenEntriesForJob(entry.job_id)).filter((e) => e.id !== entry.id && e.state === "running");
      await supabasePatch(
        "tech_time_jobs",
        new URLSearchParams({ id: `eq.${entry.job_id}` }),
        {
          status: others.length ? "in_progress" : reason === "waiting_for_parts" ? "waiting_for_parts" : "paused",
          updated_at: at,
        },
      );
      return NextResponse.json({ ok: true });
    }

    if (body.action === "resume") {
      const entry = await getOpenEntryForTech(actor.id);
      if (!entry || entry.state !== "paused") {
        return NextResponse.json({ error: "No paused job found." }, { status: 409 });
      }
      const at = nowIso();
      await supabasePatch(
        "tech_time_entries",
        new URLSearchParams({ id: `eq.${entry.id}` }),
        {
          state: "running",
          current_segment_started_at: at,
          paused_at: null,
          pause_reason: null,
          updated_at: at,
        },
      );
      await supabasePatch(
        "tech_time_jobs",
        new URLSearchParams({ id: `eq.${entry.job_id}` }),
        { status: "in_progress", updated_at: at },
      );
      return NextResponse.json({ ok: true });
    }

    if (body.action === "stop") {
      const entry = await getOpenEntryForTech(actor.id);
      if (!entry) return NextResponse.json({ error: "No open job found." }, { status: 409 });

      const result = String(body.result ?? "");
      const allowed = new Set(["done","needs_more_work","waiting_for_parts","out_of_service"]);
      if (!allowed.has(result)) return NextResponse.json({ error: "Completion result is required." }, { status: 400 });

      const total = entry.accumulated_seconds + (entry.state === "running" ? secondsSince(entry.current_segment_started_at) : 0);
      const at = nowIso();
      await supabasePatch(
        "tech_time_entries",
        new URLSearchParams({ id: `eq.${entry.id}` }),
        {
          state: "stopped",
          accumulated_seconds: total,
          current_segment_started_at: null,
          stopped_at: at,
          completion_result: result,
          updated_at: at,
        },
      );

      const others = (await getOpenEntriesForJob(entry.job_id)).filter((e) => e.id !== entry.id);
      if (!others.length) {
        await supabasePatch(
          "tech_time_jobs",
          new URLSearchParams({ id: `eq.${entry.job_id}` }),
          {
            status: result,
            completed_at: result === "done" ? at : null,
            updated_at: at,
          },
        );
      } else {
        await supabasePatch(
          "tech_time_jobs",
          new URLSearchParams({ id: `eq.${entry.job_id}` }),
          { status: "in_progress", updated_at: at },
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "edit_entry") {
      if (actor.role !== "admin" && actor.role !== "manager") {
        return NextResponse.json({ error: "Manager access required." }, { status: 403 });
      }
      const entryId = String(body.entryId ?? "");
      const seconds = Number(body.accumulatedSeconds);
      const reason = String(body.reason ?? "").trim();
      if (!entryId || !Number.isFinite(seconds) || seconds < 0 || !reason) {
        return NextResponse.json({ error: "Entry, corrected time, and edit reason are required." }, { status: 400 });
      }

      const rows = await supabaseSelect<EntryRow>(
        "tech_time_entries",
        new URLSearchParams({ select: "*", id: `eq.${entryId}`, limit: "1" }),
      );
      const before = rows[0];
      if (!before) return NextResponse.json({ error: "Time entry not found." }, { status: 404 });

      const after = { ...before, accumulated_seconds: Math.round(seconds), updated_at: nowIso() };
      await supabasePatchRows<EntryRow>(
        "tech_time_entries",
        new URLSearchParams({ id: `eq.${entryId}` }),
        { accumulated_seconds: after.accumulated_seconds, updated_at: after.updated_at },
      );
      await supabaseInsert("tech_time_entry_edits", {
        entry_id: entryId,
        edited_by_profile_id: actor.id,
        edited_by_name: actor.display_name,
        reason,
        before_snapshot: before,
        after_snapshot: after,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tech Time action failed." },
      { status: 500 },
    );
  }
}
