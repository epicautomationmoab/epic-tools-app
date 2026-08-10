import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  CANCELLATION_POLICY_VERSION,
  getCancellationPolicy,
  type TripSafeStatus,
} from "@/lib/cancellation-policy";
import { getAuthenticatedTeamProfile, type TeamProfile } from "@/lib/team-auth";
import { agreementEmailConfigured, sendAgreementEmail } from "@/lib/server/agreement-email";
import { getPattiPolicyDecision } from "@/lib/server/patti-policy-source";
import { podiumConnected, sendPodiumSms } from "@/lib/server/podium";
import { supabaseInsert, supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

type ReadinessRecord = {
  readiness_id: string;
  confirmation_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  product_display_name: string;
  visit_start_time: string;
  amount_due_cents: number | null;
};

type AgreementRequest = {
  id: string;
  readiness_id: string;
  confirmation_code: string;
  customer_phone: string | null;
  customer_email: string | null;
  tripsafe_status: TripSafeStatus;
  status: "created" | "sent" | "opened" | "accepted" | "failed" | "expired";
  sent_by: string;
  sent_at: string | null;
  opened_at: string | null;
  accepted_at: string | null;
  podium_delivery_status: string | null;
  email_delivery_status: string | null;
  delivery_mode: "sms" | "email" | "both" | "copy";
  last_error: string | null;
  created_at: string;
};

type RequestIdentity = {
  profile: TeamProfile | null;
  legacyPreview: boolean;
};

const REVIEW_TIMEOUT_MS = 15 * 60 * 1000;

function reviewTimedOut(agreement: AgreementRequest) {
  if (agreement.status !== "opened" || !agreement.opened_at) return false;
  return new Date(agreement.opened_at).getTime() + REVIEW_TIMEOUT_MS <= Date.now();
}

function hasPreviewAccess(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  return Boolean(previewToken && request.cookies.get("epic_preview_access")?.value === previewToken);
}

async function getRequestIdentity(request: NextRequest): Promise<RequestIdentity | null> {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  if (profile) return { profile, legacyPreview: false };
  if (hasPreviewAccess(request)) return { profile: null, legacyPreview: true };
  return null;
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (value.trim().startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  throw new Error("Enter a valid mobile phone number.");
}

function normalizeEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  return email;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function loadReadiness(readinessId: string) {
  const rows = await supabaseSelect<ReadinessRecord>(
    "guest_readiness_with_handoff_v",
    new URLSearchParams({
      select: "readiness_id,confirmation_code,customer_name,customer_phone,customer_email,product_display_name,visit_start_time,amount_due_cents",
      readiness_id: `eq.${readinessId}`,
      limit: "1",
    }),
  );
  return rows[0] ?? null;
}

async function loadPattiDecision(readiness: ReadinessRecord) {
  try {
    return await getPattiPolicyDecision(readiness.confirmation_code, readiness.visit_start_time);
  } catch {
    return {
      status: null,
      source: "manual_fallback" as const,
      hoursBetweenReservationAndStart: null,
      tripSafeSelection: "unknown" as const,
    };
  }
}

export async function GET(request: NextRequest) {
  if (!await getRequestIdentity(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const readinessId = request.nextUrl.searchParams.get("readinessId")?.trim();
  if (!readinessId) return NextResponse.json({ error: "readinessId is required." }, { status: 400 });

  try {
    const [rows, readiness] = await Promise.all([
      supabaseSelect<AgreementRequest>(
        "cancellation_agreement_requests",
        new URLSearchParams({
          select: "id,readiness_id,confirmation_code,customer_phone,customer_email,tripsafe_status,status,sent_by,sent_at,opened_at,accepted_at,podium_delivery_status,email_delivery_status,delivery_mode,last_error,created_at",
          readiness_id: `eq.${readinessId}`,
          order: "created_at.desc",
          limit: "1",
        }),
      ),
      loadReadiness(readinessId),
    ]);

    const agreement = rows[0] ?? null;
    if (agreement && reviewTimedOut(agreement)) {
      await supabasePatch(
        "cancellation_agreement_requests",
        new URLSearchParams({ id: `eq.${agreement.id}`, status: "eq.opened" }),
        { status: "expired", updated_at: new Date().toISOString() },
      );
      agreement.status = "expired";
    }

    let signerName: string | null = null;
    if (agreement?.status === "accepted") {
      const acceptances = await supabaseSelect<{ signer_name: string }>(
        "cancellation_agreement_acceptances",
        new URLSearchParams({ select: "signer_name", request_id: `eq.${agreement.id}`, limit: "1" }),
      );
      signerName = acceptances[0]?.signer_name ?? null;
    }

    const policyDecision = readiness ? await loadPattiDecision(readiness) : {
      status: null,
      source: "manual_fallback" as const,
      hoursBetweenReservationAndStart: null,
      tripSafeSelection: "unknown" as const,
    };

    return NextResponse.json({
      agreement: agreement ? { ...agreement, signer_name: signerName } : null,
      policyDecision,
      podiumConfigured: await podiumConnected(),
      emailConfigured: agreementEmailConfigured(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load agreement status." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!await getRequestIdentity(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const readinessId = request.nextUrl.searchParams.get("readinessId")?.trim();
  if (!readinessId) return NextResponse.json({ error: "readinessId is required." }, { status: 400 });

  try {
    const rows = await supabaseSelect<Pick<AgreementRequest, "id" | "status">>(
      "cancellation_agreement_requests",
      new URLSearchParams({
        select: "id,status",
        readiness_id: `eq.${readinessId}`,
        order: "created_at.desc",
        limit: "1",
      }),
    );
    const agreement = rows[0] ?? null;
    if (!agreement) return NextResponse.json({ error: "Agreement was not found." }, { status: 404 });
    if (agreement.status === "accepted") {
      return NextResponse.json({ error: "Accepted agreements cannot be reset." }, { status: 409 });
    }

    if (["created", "sent", "opened"].includes(agreement.status)) {
      await supabasePatch(
        "cancellation_agreement_requests",
        new URLSearchParams({ id: `eq.${agreement.id}`, status: "in.(created,sent,opened)" }),
        { status: "expired", updated_at: new Date().toISOString() },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to reset agreement." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const identity = await getRequestIdentity(request);
  if (!identity) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: {
    readinessId?: string;
    tripSafeStatus?: TripSafeStatus;
    policyOverride?: boolean;
    sentBy?: string;
    deliveryMode?: "sms" | "email" | "both" | "copy";
    phone?: string;
    email?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }

  if (identity.profile?.role === "workstation") {
    return NextResponse.json(
      { error: "Reception is a shared workstation. Employee verification is required before sending an agreement." },
      { status: 409 },
    );
  }

  const readinessId = body.readinessId?.trim();
  const sentBy = identity.profile?.display_name || body.sentBy?.trim();
  const deliveryMode = ["sms", "email", "both", "copy"].includes(body.deliveryMode ?? "")
    ? body.deliveryMode as "sms" | "email" | "both" | "copy"
    : "copy";
  if (!readinessId || !sentBy) {
    return NextResponse.json({ error: "Reservation and team member are required." }, { status: 400 });
  }

  let requestId: string | null = null;
  try {
    const readiness = await loadReadiness(readinessId);
    if (!readiness) return NextResponse.json({ error: "Reservation was not found." }, { status: 404 });

    const policyDecision = await loadPattiDecision(readiness);
    const requestedStatus = body.tripSafeStatus;
    const validRequestedStatus = ["declined", "purchased", "confirmed_within_48"].includes(requestedStatus ?? "")
      ? requestedStatus as TripSafeStatus
      : null;
    const tripSafeStatus = body.policyOverride && validRequestedStatus
      ? validRequestedStatus
      : policyDecision.status || validRequestedStatus;

    if (!tripSafeStatus) {
      return NextResponse.json({ error: "Agreement type could not be determined. Select it manually and try again." }, { status: 400 });
    }

    const needsText = deliveryMode === "sms" || deliveryMode === "both";
    const needsEmail = deliveryMode === "email" || deliveryMode === "both";
    const phoneInput = body.phone?.trim() || readiness.customer_phone || "";
    const emailInput = body.email?.trim() || readiness.customer_email || "";
    const phone = phoneInput ? normalizePhone(phoneInput) : null;
    const email = emailInput ? normalizeEmail(emailInput) : null;
    if (needsText && !phone) return NextResponse.json({ error: "Enter a mobile phone number for text delivery." }, { status: 409 });
    if (needsEmail && !email) return NextResponse.json({ error: "Enter an email address for email delivery." }, { status: 409 });
    if (needsText && !await podiumConnected()) return NextResponse.json({ error: "Podium is not connected yet. Use Email or Copy Link." }, { status: 409 });
    if (needsEmail && !agreementEmailConfigured()) return NextResponse.json({ error: "Agreement email delivery is not configured." }, { status: 409 });

    const token = randomBytes(32).toString("base64url");
    const policy = getCancellationPolicy(tripSafeStatus as TripSafeStatus);
    const created = await supabaseInsert<AgreementRequest>("cancellation_agreement_requests", {
      readiness_id: readiness.readiness_id,
      confirmation_code: readiness.confirmation_code,
      customer_name: readiness.customer_name,
      customer_phone: phone,
      customer_email: email,
      visit_summary: `${readiness.product_display_name} · ${readiness.visit_start_time}`,
      amount_due_cents: readiness.amount_due_cents,
      tripsafe_status: tripSafeStatus,
      policy_version: CANCELLATION_POLICY_VERSION,
      policy_title: policy.title,
      policy_summary: policy.summary,
      policy_paragraphs: policy.paragraphs,
      acceptance_statement: policy.acceptanceStatement,
      token_hash: tokenHash(token),
      expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      status: "created",
      sent_by: sentBy,
      delivery_mode: deliveryMode,
    });
    requestId = created.id;

    const baseUrl = (process.env.AGREEMENT_BASE_URL?.trim() || "https://epic-tools-app.vercel.app").replace(/\/+$/, "");
    const agreementUrl = `${baseUrl}/a/${token}`;
    const detailedMessage = `Epic 4X4: Sign cancellation terms for ${readiness.confirmation_code}: ${agreementUrl}`;
    const message = detailedMessage.length <= 140 ? detailedMessage : `Epic 4X4: Sign terms: ${agreementUrl}`;

    if (deliveryMode === "copy") {
      await supabasePatch(
        "cancellation_agreement_requests",
        new URLSearchParams({ id: `eq.${created.id}` }),
        { copied_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      );
      return NextResponse.json({
        ok: true,
        agreementId: created.id,
        status: "created",
        phone,
        agreementUrl,
        message,
        policyDecision,
      });
    }

    const [textDelivery, emailDelivery] = await Promise.allSettled([
      needsText ? sendPodiumSms({ phone: phone!, body: message, contactName: readiness.customer_name, senderName: sentBy }) : Promise.resolve(null),
      needsEmail
        ? sendAgreementEmail({
            email: email!,
            customerName: readiness.customer_name,
            confirmationCode: readiness.confirmation_code,
            agreementUrl,
          })
        : Promise.resolve(null),
    ]);
    const podiumResult = textDelivery.status === "fulfilled" ? textDelivery.value : null;
    const emailResult = emailDelivery.status === "fulfilled" ? emailDelivery.value : null;
    const deliveryErrors: string[] = [];
    if (textDelivery.status === "rejected") {
      deliveryErrors.push(`Text: ${textDelivery.reason instanceof Error ? textDelivery.reason.message : "failed"}`);
    }
    if (emailDelivery.status === "rejected") {
      deliveryErrors.push(`Email: ${emailDelivery.reason instanceof Error ? emailDelivery.reason.message : "failed"}`);
    }
    if (!podiumResult && !emailResult) throw new Error(deliveryErrors.join(" ") || "Agreement delivery failed.");

    await supabasePatch(
      "cancellation_agreement_requests",
      new URLSearchParams({ id: `eq.${created.id}` }),
      {
        status: "sent",
        sent_at: new Date().toISOString(),
        podium_message_uid: podiumResult?.messageUid ?? null,
        podium_delivery_status: podiumResult?.deliveryStatus ?? null,
        resend_message_id: emailResult?.messageId ?? null,
        email_delivery_status: emailResult ? "sent" : null,
        last_error: deliveryErrors.length ? deliveryErrors.join(" ") : null,
        updated_at: new Date().toISOString(),
      },
    );

    return NextResponse.json({
      ok: true,
      agreementId: created.id,
      status: "sent",
      phone,
      email,
      deliveryMode,
      policyDecision,
      warning: deliveryErrors.length ? deliveryErrors.join(" ") : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send cancellation agreement.";
    if (requestId) {
      await supabasePatch(
        "cancellation_agreement_requests",
        new URLSearchParams({ id: `eq.${requestId}` }),
        { status: "failed", last_error: message, updated_at: new Date().toISOString() },
      ).catch(() => undefined);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
