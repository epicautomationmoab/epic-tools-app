import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  CANCELLATION_POLICY_VERSION,
  getCancellationPolicy,
  type TripSafeStatus,
} from "@/lib/cancellation-policy";
import { agreementEmailConfigured, sendAgreementEmail } from "@/lib/server/agreement-email";
import { callRailConfigured, sendCallRailSms } from "@/lib/server/callrail";
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
  callrail_delivery_status: string | null;
  email_delivery_status: string | null;
  delivery_mode: "sms" | "email" | "both" | "copy";
  last_error: string | null;
  created_at: string;
};

function isAuthorized(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  return Boolean(previewToken && request.cookies.get("epic_preview_access")?.value === previewToken);
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

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const readinessId = request.nextUrl.searchParams.get("readinessId")?.trim();
  if (!readinessId) return NextResponse.json({ error: "readinessId is required." }, { status: 400 });

  try {
    const rows = await supabaseSelect<AgreementRequest>(
      "cancellation_agreement_requests",
      new URLSearchParams({
        select: "id,readiness_id,confirmation_code,customer_phone,customer_email,tripsafe_status,status,sent_by,sent_at,opened_at,accepted_at,callrail_delivery_status,email_delivery_status,delivery_mode,last_error,created_at",
        readiness_id: `eq.${readinessId}`,
        order: "created_at.desc",
        limit: "1",
      }),
    );
    const agreement = rows[0] ?? null;
    let signerName: string | null = null;
    if (agreement?.status === "accepted") {
      const acceptances = await supabaseSelect<{ signer_name: string }>(
        "cancellation_agreement_acceptances",
        new URLSearchParams({ select: "signer_name", request_id: `eq.${agreement.id}`, limit: "1" }),
      );
      signerName = acceptances[0]?.signer_name ?? null;
    }
    return NextResponse.json({
      agreement: agreement ? { ...agreement, signer_name: signerName } : null,
      callRailConfigured: callRailConfigured(),
      emailConfigured: agreementEmailConfigured(),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load agreement status." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  let body: {
    readinessId?: string;
    tripSafeStatus?: TripSafeStatus;
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

  const readinessId = body.readinessId?.trim();
  const sentBy = body.sentBy?.trim();
  const tripSafeStatus = body.tripSafeStatus;
  const deliveryMode = ["sms", "email", "both", "copy"].includes(body.deliveryMode ?? "")
    ? body.deliveryMode as "sms" | "email" | "both" | "copy"
    : "copy";
  if (!readinessId || !sentBy || !["declined", "purchased"].includes(tripSafeStatus ?? "")) {
    return NextResponse.json({ error: "Reservation, team member, and TripSafe status are required." }, { status: 400 });
  }

  let requestId: string | null = null;
  try {
    const readiness = await loadReadiness(readinessId);
    if (!readiness) return NextResponse.json({ error: "Reservation was not found." }, { status: 404 });
    const needsText = deliveryMode === "sms" || deliveryMode === "both";
    const needsEmail = deliveryMode === "email" || deliveryMode === "both";
    const phoneInput = body.phone?.trim() || readiness.customer_phone || "";
    const emailInput = body.email?.trim() || readiness.customer_email || "";
    const phone = phoneInput ? normalizePhone(phoneInput) : null;
    const email = emailInput ? normalizeEmail(emailInput) : null;
    if (needsText && !phone) return NextResponse.json({ error: "Enter a mobile phone number for text delivery." }, { status: 409 });
    if (needsEmail && !email) return NextResponse.json({ error: "Enter an email address for email delivery." }, { status: 409 });
    if (needsText && !callRailConfigured()) return NextResponse.json({ error: "CallRail is not connected yet. Use Email or Copy Link." }, { status: 409 });
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

    const baseUrl = (process.env.AGREEMENT_BASE_URL?.trim() || request.nextUrl.origin).replace(/\/+$/, "");
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
      });
    }

    const [textDelivery, emailDelivery] = await Promise.allSettled([
      needsText ? sendCallRailSms({ phone: phone!, body: message }) : Promise.resolve(null),
      needsEmail
        ? sendAgreementEmail({
            email: email!,
            customerName: readiness.customer_name,
            confirmationCode: readiness.confirmation_code,
            agreementUrl,
          })
        : Promise.resolve(null),
    ]);
    const callRailResult = textDelivery.status === "fulfilled" ? textDelivery.value : null;
    const emailResult = emailDelivery.status === "fulfilled" ? emailDelivery.value : null;
    const deliveryErrors: string[] = [];
    if (textDelivery.status === "rejected") {
      deliveryErrors.push(`Text: ${textDelivery.reason instanceof Error ? textDelivery.reason.message : "failed"}`);
    }
    if (emailDelivery.status === "rejected") {
      deliveryErrors.push(`Email: ${emailDelivery.reason instanceof Error ? emailDelivery.reason.message : "failed"}`);
    }
    if (!callRailResult && !emailResult) throw new Error(deliveryErrors.join(" ") || "Agreement delivery failed.");

    await supabasePatch(
      "cancellation_agreement_requests",
      new URLSearchParams({ id: `eq.${created.id}` }),
      {
        status: "sent",
        sent_at: new Date().toISOString(),
        callrail_conversation_id: callRailResult?.conversationId ?? null,
        callrail_delivery_status: callRailResult ? "sent" : null,
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
