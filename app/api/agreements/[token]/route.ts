import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabasePatch, supabaseRpc, supabaseSelect } from "@/lib/server/supabase-rest";

type AgreementRow = {
  id: string;
  confirmation_code: string;
  customer_name: string;
  visit_summary: string;
  amount_due_cents: number | null;
  tripsafe_status: "declined" | "purchased" | "confirmed_within_48";
  policy_version: string;
  policy_title: string;
  policy_summary: string;
  policy_paragraphs: string[];
  acceptance_statement: string;
  expires_at: string;
  opened_at: string | null;
  status: "created" | "sent" | "opened" | "accepted" | "failed" | "expired";
  accepted_at: string | null;
};

const REVIEW_TIMEOUT_MS = 15 * 60 * 1000;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function loadAgreement(token: string) {
  const rows = await supabaseSelect<AgreementRow>(
    "cancellation_agreement_requests",
    new URLSearchParams({
      select: "id,confirmation_code,customer_name,visit_summary,amount_due_cents,tripsafe_status,policy_version,policy_title,policy_summary,policy_paragraphs,acceptance_statement,expires_at,opened_at,status,accepted_at",
      token_hash: `eq.${hashToken(token)}`,
      limit: "1",
    }),
  );
  return rows[0] ?? null;
}

function hasExpired(agreement: AgreementRow) {
  if (agreement.status === "expired") return true;
  if (agreement.status === "accepted") return false;
  if (new Date(agreement.expires_at).getTime() <= Date.now()) return true;
  return agreement.status === "opened"
    && Boolean(agreement.opened_at)
    && new Date(agreement.opened_at!).getTime() + REVIEW_TIMEOUT_MS <= Date.now();
}

async function expireAgreement(agreement: AgreementRow) {
  if (agreement.status !== "expired") {
    await supabasePatch(
      "cancellation_agreement_requests",
      new URLSearchParams({ id: `eq.${agreement.id}`, status: "neq.accepted" }),
      { status: "expired", updated_at: new Date().toISOString() },
    );
  }
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || "";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    if (!token || token.length < 32) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
    const agreement = await loadAgreement(token);
    if (!agreement) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });

    if (hasExpired(agreement)) {
      await expireAgreement(agreement);
      return NextResponse.json({ error: "This agreement link has expired. Please ask Epic 4X4 Adventures to send a new one." }, { status: 410 });
    }

    if (["created", "sent"].includes(agreement.status)) {
      const now = new Date().toISOString();
      await supabasePatch(
        "cancellation_agreement_requests",
        new URLSearchParams({ id: `eq.${agreement.id}` }),
        { status: "opened", opened_at: now, updated_at: now },
      );
      agreement.status = "opened";
    }

    return NextResponse.json({ agreement });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load agreement." }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  let body: { signerName?: string; signatureDataUrl?: string; agreed?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "A valid acceptance is required." }, { status: 400 });
  }

  try {
    const { token } = await context.params;
    if (!token || token.length < 32) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
    if (body.agreed !== true) return NextResponse.json({ error: "You must agree to the terms before signing." }, { status: 400 });
    const signerName = body.signerName?.trim() ?? "";
    const signatureDataUrl = body.signatureDataUrl ?? "";
    if (signerName.length < 2) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
    if (!signatureDataUrl.startsWith("data:image/png;base64,")) {
      return NextResponse.json({ error: "Please sign in the signature box." }, { status: 400 });
    }

    const agreement = await loadAgreement(token);
    if (!agreement) return NextResponse.json({ error: "Agreement not found." }, { status: 404 });
    if (hasExpired(agreement)) {
      await expireAgreement(agreement);
      return NextResponse.json({ error: "This agreement link has expired. Please ask Epic 4X4 Adventures to send a new one." }, { status: 410 });
    }

    const result = await supabaseRpc<{ accepted: boolean; acceptanceId: string; acceptedAt: string }>(
      "record_cancellation_agreement_acceptance",
      {
        p_token_hash: hashToken(token),
        p_signer_name: signerName,
        p_signature_data_url: signatureDataUrl,
        p_ip_address: clientIp(request),
        p_user_agent: request.headers.get("user-agent") ?? "",
      },
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to record acceptance.";
    const expired = /expired/i.test(message);
    return NextResponse.json({ error: expired ? "This agreement link has expired. Please ask Epic 4X4 Adventures to send a new one." : message }, { status: expired ? 410 : 500 });
  }
}
