import { NextResponse } from "next/server";
import { POST as sendCommunication } from "../send/route";

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

async function callQueueFunction(functionName: string) {
  const config = getSupabaseConfig();
  const response = await fetch(`${config.url}/rest/v1/rpc/${functionName}`, {
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
  if (!response.ok) throw new Error(`Unable to run ${functionName}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function drainCommunicationQueue() {
  const results: unknown[] = [];

  for (let index = 0; index < 50; index += 1) {
    const response = await sendCommunication(new Request("http://internal/guest-communications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderSecret: requiredEnv("GUEST_EMAIL_SENDER_SECRET") }),
    }));

    const result = await response.json();
    results.push(result);

    if (!response.ok) throw new Error(`Communication sender failed: ${JSON.stringify(result)}`);
    if (result.sent !== true && !result.skippedStale && !result.skippedComplete) break;
  }

  return results;
}

async function run(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const cronSecret = requiredEnv("CRON_SECRET");

    if (authorization !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
    }

    const confirmationsRefreshed = await callQueueFunction("refresh_guest_portal_email_queue");
    const twoHourRemindersQueued = await callQueueFunction("queue_two_hour_portal_reminders");
    const sends = await drainCommunicationQueue();

    return NextResponse.json({
      ok: true,
      mode: process.env.GUEST_EMAIL_MODE?.trim().toLowerCase() ?? "test",
      confirmationsRefreshed,
      twoHourRemindersQueued,
      sends,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown communication runner error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
