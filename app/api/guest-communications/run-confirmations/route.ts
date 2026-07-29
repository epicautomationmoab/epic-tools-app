import { NextResponse } from "next/server";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getSupabaseConfig() {
  const rawUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return {
    url: normalizedUrl.replace(/\/+$/, ""),
    key: requiredEnv("SUPABASE_SECRET_KEY"),
  };
}

async function refreshConfirmationQueue() {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/refresh_guest_portal_email_queue`, {
    method: "POST",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Unable to refresh confirmation queue: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function drainConfirmationQueue(origin: string) {
  const results: unknown[] = [];

  for (let index = 0; index < 50; index += 1) {
    const response = await fetch(`${origin}/api/guest-communications/send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("GUEST_EMAIL_SENDER_SECRET")}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const result = await response.json();
    results.push(result);

    if (!response.ok) throw new Error(`Confirmation sender failed: ${JSON.stringify(result)}`);
    if (result.sent !== true && !result.skippedStale) break;
  }

  return results;
}

async function run(request: Request) {
  const authorization = request.headers.get("authorization");
  const cronSecret = requiredEnv("CRON_SECRET");
  const senderSecret = requiredEnv("GUEST_EMAIL_SENDER_SECRET");

  if (authorization !== `Bearer ${cronSecret}` && authorization !== `Bearer ${senderSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const refreshed = await refreshConfirmationQueue();
    const origin = new URL(request.url).origin;
    const sends = await drainConfirmationQueue(origin);

    return NextResponse.json({
      ok: true,
      mode: process.env.GUEST_EMAIL_MODE?.trim().toLowerCase() ?? "test",
      refreshed,
      sends,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown confirmation runner error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
