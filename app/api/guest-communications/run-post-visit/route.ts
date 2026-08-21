import { NextResponse } from "next/server";
import { sendPostVisitEmail } from "@/lib/server/post-visit-email";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function denverHour() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
}

type JobRow = {
  id: string;
  readiness_id: string;
  confirmation_code: string;
  business_line: "tour" | "rental";
  scheduled_for: string;
  status: string;
};

type PreferenceRow = {
  send_mode: "review_request" | "thank_you_only";
};

type WaiverSigner = {
  id: string;
  signer_full_name: string | null;
  signer_first_name: string | null;
  signer_email: string | null;
  is_adult: boolean;
};

type RecipientRow = {
  id: string;
  job_id: string;
  normalized_email: string;
  status: string;
};

function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

function safeRecipientKey(email: string) {
  return Buffer.from(email).toString("base64url").slice(0, 80);
}

async function processJob(job: JobRow) {
  await supabasePatch(
    "post_visit_email_jobs",
    new URLSearchParams({ id: `eq.${job.id}`, status: "eq.pending" }),
    { status: "processing", last_error: null, updated_at: new Date().toISOString() },
  );

  try {
    const [preferences, signers, existingRecipients] = await Promise.all([
      supabaseSelect<PreferenceRow>(
        "post_visit_email_preferences",
        new URLSearchParams({ select: "send_mode", readiness_id: `eq.${job.readiness_id}`, limit: "1" }),
      ),
      supabaseSelect<WaiverSigner>(
        "epic_waiver_signatures",
        new URLSearchParams({
          select: "id,signer_full_name,signer_first_name,signer_email,is_adult",
          confirmation_code: `eq.${job.confirmation_code}`,
          is_adult: "eq.true",
          order: "signed_at.asc",
          limit: "200",
        }),
      ),
      supabaseSelect<RecipientRow>(
        "post_visit_email_recipients",
        new URLSearchParams({
          select: "id,job_id,normalized_email,status",
          job_id: `eq.${job.id}`,
          limit: "500",
        }),
      ),
    ]);

    const sendMode = preferences[0]?.send_mode ?? "review_request";
    const existingByEmail = new Map(existingRecipients.map((row) => [row.normalized_email, row]));
    const unique = new Map<string, WaiverSigner>();

    for (const signer of signers) {
      const email = signer.signer_email?.trim();
      if (!email || !email.includes("@")) continue;
      const normalized = normalizedEmail(email);
      if (!unique.has(normalized)) unique.set(normalized, signer);
    }

    if (!unique.size) throw new Error("No adult Epic waiver signer email addresses were available for this reservation.");

    const failures: string[] = [];
    let sentCount = 0;

    for (const [emailKey, signer] of unique) {
      const existing = existingByEmail.get(emailKey);
      if (existing?.status === "sent") {
        sentCount += 1;
        continue;
      }

      let recipientId = existing?.id ?? null;
      if (!recipientId) {
        const created = await supabaseInsert<{ id: string }>("post_visit_email_recipients", {
          job_id: job.id,
          waiver_signature_id: signer.id,
          recipient_name: signer.signer_full_name?.trim() || signer.signer_first_name?.trim() || "Guest",
          recipient_email: signer.signer_email!.trim(),
          normalized_email: emailKey,
          send_mode: sendMode,
          status: "pending",
        });
        recipientId = created.id;
      } else {
        await supabasePatch(
          "post_visit_email_recipients",
          new URLSearchParams({ id: `eq.${recipientId}` }),
          { send_mode: sendMode, status: "pending", last_error: null, updated_at: new Date().toISOString() },
        );
      }

      try {
        const result = await sendPostVisitEmail({
          email: signer.signer_email!.trim(),
          signerName: signer.signer_full_name?.trim() || signer.signer_first_name?.trim() || "Guest",
          businessLine: job.business_line,
          sendMode,
          confirmationCode: job.confirmation_code,
          recipientKey: safeRecipientKey(emailKey),
        });

        await supabasePatch(
          "post_visit_email_recipients",
          new URLSearchParams({ id: `eq.${recipientId}` }),
          {
            send_mode: sendMode,
            status: "sent",
            resend_message_id: result.messageId,
            sent_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          },
        );
        sentCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to send post-visit email.";
        failures.push(`${emailKey}: ${message}`);
        await supabasePatch(
          "post_visit_email_recipients",
          new URLSearchParams({ id: `eq.${recipientId}` }),
          { status: "failed", last_error: message, updated_at: new Date().toISOString() },
        );
      }
    }

    if (failures.length) {
      throw new Error(`${sentCount} sent; ${failures.length} failed. ${failures.join(" | ").slice(0, 1200)}`);
    }

    await supabasePatch(
      "post_visit_email_jobs",
      new URLSearchParams({ id: `eq.${job.id}` }),
      { status: "sent", sent_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() },
    );

    return { jobId: job.id, confirmationCode: job.confirmation_code, sent: sentCount, sendMode };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown post-visit sender error.";
    await supabasePatch(
      "post_visit_email_jobs",
      new URLSearchParams({ id: `eq.${job.id}` }),
      { status: "failed", last_error: message, updated_at: new Date().toISOString() },
    );
    return { jobId: job.id, confirmationCode: job.confirmation_code, sent: 0, error: message };
  }
}

async function run(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (authorization !== `Bearer ${requiredEnv("CRON_SECRET")}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized cron request." }, { status: 401 });
    }

    if (denverHour() !== 10) {
      return NextResponse.json({ ok: true, skipped: true, reason: "Not 10:00 AM America/Denver." });
    }

    const jobs = await supabaseSelect<JobRow>(
      "post_visit_email_jobs",
      new URLSearchParams({
        select: "id,readiness_id,confirmation_code,business_line,scheduled_for,status",
        status: "eq.pending",
        scheduled_for: `lte.${new Date().toISOString()}`,
        order: "scheduled_for.asc",
        limit: "100",
      }),
    );

    const results = [];
    for (const job of jobs) results.push(await processJob(job));

    return NextResponse.json({ ok: true, due: jobs.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown post-visit runner error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
