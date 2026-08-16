import { NextResponse } from "next/server";

function config() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  return {
    url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""),
    key,
  };
}

async function rpc<T>(url: string, key: string, fn: string, body: unknown): Promise<T> {
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${fn} failed: ${text.slice(0, 300)}`);
  }

  return response.json();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ confirmation: string; token: string }> },
) {
  try {
    const { confirmation, token } = await context.params;
    const c = config();

    const sessions = await rpc<Array<{ waiver_session_id: string }>>(
      c.url,
      c.key,
      "resolve_epic_waiver_session_v2",
      {
        p_confirmation_code: confirmation,
        p_public_token: token,
      },
    );

    const session = sessions?.[0];
    if (!session?.waiver_session_id) {
      return NextResponse.json({ error: "Waiver session not found." }, { status: 404 });
    }

    const signatureResponse = await fetch(
      `${c.url}/rest/v1/epic_waiver_signatures?waiver_session_id=eq.${encodeURIComponent(session.waiver_session_id)}&signed_pdf_storage_path=not.is.null&select=id,signed_pdf_storage_path,signed_at&order=signed_at.desc&limit=1`,
      {
        headers: {
          apikey: c.key,
          Authorization: `Bearer ${c.key}`,
        },
        cache: "no-store",
      },
    );

    if (!signatureResponse.ok) {
      const text = await signatureResponse.text();
      throw new Error(`Unable to find signed waiver PDF: ${text.slice(0, 300)}`);
    }

    const signatures = (await signatureResponse.json()) as Array<{
      id: string;
      signed_pdf_storage_path: string;
      signed_at: string;
    }>;
    const signature = signatures?.[0];

    if (!signature?.signed_pdf_storage_path) {
      return NextResponse.json({ error: "No signed waiver PDF is available yet." }, { status: 404 });
    }

    const storagePath = signature.signed_pdf_storage_path
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    const signResponse = await fetch(
      `${c.url}/storage/v1/object/sign/epic-legal-documents/${storagePath}`,
      {
        method: "POST",
        headers: {
          apikey: c.key,
          Authorization: `Bearer ${c.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: 600 }),
        cache: "no-store",
      },
    );

    if (!signResponse.ok) {
      const text = await signResponse.text();
      throw new Error(`Unable to create PDF review link: ${text.slice(0, 300)}`);
    }

    const signed = (await signResponse.json()) as { signedURL?: string; signedUrl?: string };
    const relativeUrl = signed.signedURL || signed.signedUrl;
    if (!relativeUrl) throw new Error("Supabase did not return a signed PDF URL.");

    const destination = relativeUrl.startsWith("http")
      ? relativeUrl
      : `${c.url}/storage/v1${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}`;

    return NextResponse.redirect(destination, 307);
  } catch (error) {
    console.error("waiver pdf review route", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open signed waiver PDF." },
      { status: 500 },
    );
  }
}
