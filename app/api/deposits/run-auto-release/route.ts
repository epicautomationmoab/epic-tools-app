import { NextResponse } from "next/server";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSupabaseAdminConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase admin configuration is missing.");
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: url.replace(/\/+$/, ""), key };
}

async function callRpc<T>(name: string, body: Record<string, unknown>) {
  const { url, key } = getSupabaseAdminConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error((await response.text()) || `Unable to run ${name}.`);
  return response.json() as Promise<T>;
}

type DepositRow = {
  readiness_id: string;
  confirmation_code: string;
  work_state: string;
  status: string;
};

function denverTimeParts() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "-1");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "-1");
  return { hour, minute };
}

async function run(request: Request) {
  try {
    if (request.headers.get("authorization") !== `Bearer ${requiredEnv("CRON_SECRET")}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
    }

    const { hour, minute } = denverTimeParts();
    if (hour !== 11 || minute !== 15) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Not 11:15 AM America/Denver." });
    }

    const rows = await callRpc<DepositRow[]>("list_rental_damage_deposits_active", {});
    const ready = Array.isArray(rows) ? rows.filter((row) => row.work_state === "ready" && row.status !== "do_not_release") : [];

    const results = [];
    for (const row of ready) {
      try {
        const result = await callRpc("launch_victor_release_deposit", {
          p_readiness_id: row.readiness_id,
          p_requested_by: "Victor Auto Release 11:15 AM",
        });
        results.push({ readiness_id: row.readiness_id, confirmation_code: row.confirmation_code, ok: true, result });
      } catch (error) {
        results.push({
          readiness_id: row.readiness_id,
          confirmation_code: row.confirmation_code,
          ok: false,
          error: error instanceof Error ? error.message : "Unable to launch Victor.",
        });
      }
    }

    return NextResponse.json({ ok: true, ready: ready.length, results });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown automatic deposit release error." },
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
