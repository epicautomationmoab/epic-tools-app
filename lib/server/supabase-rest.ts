function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getServerSupabaseConfig() {
  const rawUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requiredEnv("SUPABASE_SECRET_KEY");
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: normalizedUrl.replace(/\/+$/, ""), key };
}

export function serverSupabaseHeaders(prefer?: string) {
  const { key } = getServerSupabaseConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export async function supabaseSelect<T>(resource: string, params: URLSearchParams) {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${resource}?${params}`, {
    headers: serverSupabaseHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Unable to read ${resource}: ${await response.text()}`);
  return (await response.json()) as T[];
}

export async function supabaseInsert<T>(resource: string, body: Record<string, unknown>) {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${resource}`, {
    method: "POST",
    headers: serverSupabaseHeaders("return=representation"),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Unable to create ${resource}: ${await response.text()}`);
  const rows = (await response.json()) as T[];
  if (rows.length !== 1) throw new Error(`Expected one ${resource} row; received ${rows.length}.`);
  return rows[0];
}

export async function supabasePatch(
  resource: string,
  filters: URLSearchParams,
  body: Record<string, unknown>,
) {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${resource}?${filters}`, {
    method: "PATCH",
    headers: serverSupabaseHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Unable to update ${resource}: ${await response.text()}`);
}

export async function supabaseRpc<T>(name: string, body: Record<string, unknown>) {
  const { url } = getServerSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: serverSupabaseHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) throw new Error((await response.text()) || `Unable to run ${name}.`);
  return (await response.json()) as T;
}
