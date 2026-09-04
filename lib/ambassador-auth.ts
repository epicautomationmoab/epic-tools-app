export type AmbassadorProfile = {
  id: string;
  partner_id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  role: "owner" | "manager" | "viewer";
  active: boolean;
};

type SupabaseAuthUser = { id: string; email?: string | null };
type SupabaseSession = { access_token: string; refresh_token: string; expires_in?: number; user: SupabaseAuthUser };

function getConfig(useSecretKey = false) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = useSecretKey ? process.env.SUPABASE_SECRET_KEY?.trim() : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !key) throw new Error("Supabase environment variables are missing.");
  return { url: (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`).replace(/\/+$/, ""), key };
}

async function adminRest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getConfig(true);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Supabase ambassador profile request failed (${response.status}).`);
  return text ? JSON.parse(text) as T : undefined as T;
}

export async function signInAmbassador(email: string, password: string): Promise<SupabaseSession> {
  const { url, key } = getConfig(false);
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_description || payload?.msg || "Invalid email or password.");
  return payload as SupabaseSession;
}

export async function getAuthUser(accessToken: string) {
  const { url, key } = getConfig(false);
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) return null;
  return response.json() as Promise<SupabaseAuthUser>;
}

export async function getAmbassadorProfileByUserId(userId: string) {
  const rows = await adminRest<AmbassadorProfile[]>(`referral_partner_profiles?select=id,partner_id,user_id,display_name,email,role,active&user_id=eq.${encodeURIComponent(userId)}&limit=1`);
  return rows[0] ?? null;
}

export async function getAmbassadorProfileByEmail(email: string) {
  const rows = await adminRest<AmbassadorProfile[]>(`referral_partner_profiles?select=id,partner_id,user_id,display_name,email,role,active&email=ilike.${encodeURIComponent(email)}&limit=1`);
  return rows[0] ?? null;
}

export async function linkAmbassadorProfileUser(profileId: string, userId: string) {
  await adminRest<void>(`referral_partner_profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: userId, last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
  });
}

export async function getAuthenticatedAmbassadorProfile(accessToken: string | null | undefined) {
  if (!accessToken) return null;
  const user = await getAuthUser(accessToken);
  if (!user) return null;
  const profile = await getAmbassadorProfileByUserId(user.id);
  if (!profile || !profile.active) return null;
  return profile;
}

export function ambassadorCookieOptions(maxAge: number) {
  return { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge };
}
