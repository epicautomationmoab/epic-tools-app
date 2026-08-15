import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedTeamProfile } from "@/lib/team-auth";
import { supabaseSelect } from "@/lib/server/supabase-rest";

function hasPreviewAccess(request: NextRequest) {
  const previewToken = process.env.EPIC_PREVIEW_TOKEN;
  return Boolean(
    previewToken &&
      request.cookies.get("epic_preview_access")?.value === previewToken,
  );
}

async function authorized(request: NextRequest) {
  const accessToken = request.cookies.get("epic_access_token")?.value;
  const profile = await getAuthenticatedTeamProfile(accessToken);
  return Boolean(profile || hasPreviewAccess(request));
}

function supabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !key) {
    throw new Error("Supabase secret environment variables are missing.");
  }

  const normalizedUrl = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;

  return {
    url: normalizedUrl.replace(/\/+$/, ""),
    key,
  };
}

type SignatureRow = {
  id: string;
  signed_pdf_storage_path: string | null;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ signatureId: string }> },
) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { signatureId } = await context.params;
    const rows = await supabaseSelect<SignatureRow>(
      "epic_waiver_signatures",
      new URLSearchParams({
        select: "id,signed_pdf_storage_path",
        id: `eq.${signatureId}`,
        archived_at: "is.null",
        limit: "1",
      }),
    );

    const signature = rows[0];
    if (!signature?.signed_pdf_storage_path) {
      return NextResponse.json(
        { error: "Signed waiver PDF not found." },
        { status: 404 },
      );
    }

    const c = supabaseConfig();
    const storagePath = signature.signed_pdf_storage_path
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    const response = await fetch(
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

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Unable to create signed waiver URL: ${body.slice(0, 300)}`);
    }

    const signed = (await response.json()) as {
      signedURL?: string;
      signedUrl?: string;
    };
    const relativeUrl = signed.signedURL || signed.signedUrl;
    if (!relativeUrl) {
      throw new Error("Supabase did not return a signed waiver URL.");
    }

    const destination = relativeUrl.startsWith("http")
      ? relativeUrl
      : `${c.url}/storage/v1${relativeUrl.startsWith("/") ? "" : "/"}${relativeUrl}`;

    return NextResponse.redirect(destination, 307);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to open signed waiver PDF.",
      },
      { status: 500 },
    );
  }
}
