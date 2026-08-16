import { NextResponse } from "next/server";
import { sendWaiverCopyEmail, waiverEmailConfigured } from "@/lib/server/waiver-email";

function config() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  return {
    url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""),
    key,
  };
}

function signerIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  return (
    firstForwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    null
  );
}

async function resolveSession(
  url: string,
  key: string,
  confirmationCode: string,
  publicToken: string,
) {
  const response = await fetch(`${url}/rest/v1/rpc/resolve_epic_waiver_session_v2`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_confirmation_code: confirmationCode,
      p_public_token: publicToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to verify waiver session: ${body.slice(0, 300)}`);
  }

  const rows = await response.json();
  if (!rows?.length) throw new Error("This waiver link is invalid, inactive, or expired.");
  return rows[0] as { waiver_session_id: string };
}

function decodePngDataUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("Drawn signature image is missing.");
  const match = value.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Drawn signature must be a PNG image.");
  const bytes = Buffer.from(match[1], "base64");
  if (!bytes.length) throw new Error("Drawn signature image is empty.");
  if (bytes.length > 2 * 1024 * 1024) throw new Error("Drawn signature image is too large.");
  return bytes;
}

async function deleteStoredSignature(url: string, key: string, storagePath: string) {
  await fetch(`${url}/storage/v1/object/epic-signatures/${storagePath}`, {
    method: "DELETE",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  }).catch(() => undefined);
}

async function generateSignedPdf(
  url: string,
  key: string,
  signatureId: string,
  confirmationCode: string,
  publicToken: string,
) {
  const response = await fetch(`${url}/functions/v1/generate-epic-waiver-pdf`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      signature_id: signatureId,
      confirmation_code: confirmationCode,
      public_token: publicToken,
    }),
    cache: "no-store",
  });

  const body = await response.text();
  if (!response.ok) {
    return {
      ok: false as const,
      error: body.slice(0, 500),
    };
  }

  return {
    ok: true as const,
    result: JSON.parse(body) as { storage_path?: string; sha256?: string; layout_version?: string },
  };
}

async function updateWaiverCopyStatus(
  url: string,
  key: string,
  signatureId: string,
  patch: Record<string, unknown>,
) {
  const response = await fetch(
    `${url}/rest/v1/epic_waiver_signatures?id=eq.${encodeURIComponent(signatureId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to update waiver email status: ${body.slice(0, 300)}`);
  }
}

async function downloadSignedPdf(url: string, key: string, storagePath: string) {
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${url}/storage/v1/object/authenticated/epic-legal-documents/${encodedPath}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Unable to retrieve signed waiver PDF: ${body.slice(0, 300)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function signerName(payload: Record<string, unknown>) {
  return [payload.p_signer_first_name, payload.p_signer_middle_initial, payload.p_signer_last_name]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

export async function POST(request: Request) {
  let storedPath: string | null = null;

  try {
    const payload = await request.json();
    const c = config();

    if (!payload.p_confirmation_code || !payload.p_public_token) {
      return NextResponse.json({ error: "Waiver confirmation code and access token are required." }, { status: 400 });
    }

    if (payload.p_signature_method !== "typed" && payload.p_signature_method !== "drawn") {
      return NextResponse.json({ error: "Signature method must be typed or drawn." }, { status: 400 });
    }

    payload.p_signer_ip_address = signerIp(request);

    if (payload.p_signature_method === "drawn") {
      const session = await resolveSession(
        c.url,
        c.key,
        payload.p_confirmation_code,
        payload.p_public_token,
      );

      const png = decodePngDataUrl(payload.drawn_signature_png);
      storedPath = `${session.waiver_session_id}/${Date.now()}-${crypto.randomUUID()}.png`;

      const upload = await fetch(
        `${c.url}/storage/v1/object/epic-signatures/${storedPath}`,
        {
          method: "POST",
          headers: {
            apikey: c.key,
            Authorization: `Bearer ${c.key}`,
            "Content-Type": "image/png",
            "x-upsert": "false",
          },
          body: png,
        },
      );

      if (!upload.ok) {
        const body = await upload.text();
        return NextResponse.json(
          { error: `Unable to store drawn signature: ${body.slice(0, 300)}` },
          { status: upload.status },
        );
      }

      payload.p_drawn_signature_storage_path = storedPath;
      payload.p_typed_signature_name = null;
    } else {
      payload.p_drawn_signature_storage_path = null;
      payload.drawn_signature_png = undefined;
    }

    delete payload.drawn_signature_png;

    const response = await fetch(`${c.url}/rest/v1/rpc/submit_epic_tour_waiver_v5`, {
      method: "POST",
      headers: {
        apikey: c.key,
        Authorization: `Bearer ${c.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const body = await response.text();

    if (!response.ok) {
      if (storedPath) await deleteStoredSignature(c.url, c.key, storedPath);
      return NextResponse.json({ error: body.slice(0, 500) }, { status: response.status });
    }

    const result = JSON.parse(body);
    const signatureId = result?.[0]?.signature_id;
    let pdfGenerated = false;
    let pdfResult: unknown = null;
    let pdfError: string | null = null;
    let copyEmailStatus: "sent" | "failed" | null = null;
    let copyEmailError: string | null = null;

    if (signatureId) {
      const pdf = await generateSignedPdf(
        c.url,
        c.key,
        signatureId,
        payload.p_confirmation_code,
        payload.p_public_token,
      );

      if (pdf.ok) {
        pdfGenerated = true;
        pdfResult = pdf.result;

        try {
          await updateWaiverCopyStatus(c.url, c.key, signatureId, {
            copy_email_status: "pending",
            copy_email_error: null,
          });

          if (!waiverEmailConfigured()) throw new Error("Waiver email delivery is not configured.");
          const email = String(payload.p_signer_email ?? "").trim();
          if (!email) throw new Error("Signer email address is missing.");
          if (!pdf.result.storage_path) throw new Error("Signed PDF storage path was not returned.");

          const pdfBytes = await downloadSignedPdf(c.url, c.key, pdf.result.storage_path);
          const emailResult = await sendWaiverCopyEmail({
            email,
            signerName: signerName(payload),
            pdf: pdfBytes,
            idempotencyKey: `waiver-copy/${signatureId}`,
          });

          await updateWaiverCopyStatus(c.url, c.key, signatureId, {
            copy_email_status: "sent",
            copy_email_sent_at: new Date().toISOString(),
            copy_email_message_id: emailResult.messageId,
            copy_email_error: null,
          });
          copyEmailStatus = "sent";
        } catch (emailError) {
          copyEmailStatus = "failed";
          copyEmailError = emailError instanceof Error ? emailError.message : "Unable to email signed waiver copy.";
          console.error("Signed waiver copy email failed", {
            signatureId,
            confirmationCode: payload.p_confirmation_code,
            error: copyEmailError,
          });
          await updateWaiverCopyStatus(c.url, c.key, signatureId, {
            copy_email_status: "failed",
            copy_email_error: copyEmailError,
          }).catch(() => undefined);
        }
      } else {
        pdfError = pdf.error;
        console.error("Signed waiver PDF generation failed", {
          signatureId,
          confirmationCode: payload.p_confirmation_code,
          error: pdf.error,
        });
      }
    } else {
      pdfError = "Waiver was recorded but the signature id was not returned for PDF generation.";
    }

    return NextResponse.json({
      result,
      drawnSignatureStored: Boolean(storedPath),
      pdfGenerated,
      pdfResult,
      pdfError,
      copyEmailStatus,
      copyEmailError,
    });
  } catch (error) {
    if (storedPath) {
      try {
        const c = config();
        await deleteStoredSignature(c.url, c.key, storedPath);
      } catch {
        // Best-effort cleanup only.
      }
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to submit waiver." },
      { status: 500 },
    );
  }
}
