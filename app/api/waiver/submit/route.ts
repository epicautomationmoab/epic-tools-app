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

    const response = await fetch(`${c.url}/rest/v1/rpc/submit_epic_tour_waiver_v3`, {
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

    return NextResponse.json({
      result: JSON.parse(body),
      drawnSignatureStored: Boolean(storedPath),
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
