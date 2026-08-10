export type TeamProfile = {
  id: string;
  user_id: string | null;
  display_name: string;
  email: string;
  role: "admin" | "manager" | "agent" | "workstation";
  active: boolean;
  tripworks_user_id: number | null;
  tripworks_full_name: string | null;
};

type SupabaseAuthUser = {
  id: string;
  email?: string | null;
};

type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user: SupabaseAuthUser;
};

function getConfig(useSecretKey = false) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = useSecretKey
    ? process.env.SUPABASE_SECRET_KEY?.trim()
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!rawUrl || !key) {
    throw new Error(
      useSecretKey
        ? "Supabase secret environment variables are missing."
        : "Supabase public environment variables are missing.",
    );
  }

  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return { url: normalizedUrl.replace(/\/+$/, ""), key };
}

async function adminRest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getConfig(true);
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase team profile request failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function listTeamProfiles() {
  return adminRest<TeamProfile[]>(
    "team_profiles?select=id,user_id,display_name,email,role,active,tripworks_user_id,tripworks_full_name&order=display_name.asc",
  );
}

export async function getTeamProfileByEmail(email: string) {
  const rows = await adminRest<TeamProfile[]>(
    `team_profiles?select=id,user_id,display_name,email,role,active,tripworks_user_id,tripworks_full_name&email=ilike.${encodeURIComponent(email)}&limit=1`,
  );
  return rows[0] ?? null;
}

export async function getTeamProfileByUserId(userId: string) {
  const rows = await adminRest<TeamProfile[]>(
    `team_profiles?select=id,user_id,display_name,email,role,active,tripworks_user_id,tripworks_full_name&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
  );
  return rows[0] ?? null;
}

export async function linkTeamProfileUser(profileId: string, userId: string) {
  await adminRest<void>(`team_profiles?id=eq.${encodeURIComponent(profileId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: userId, updated_at: new Date().toISOString() }),
  });
}

export async function inviteTeamProfile(email: string, redirectTo: string) {
  const profile = await getTeamProfileByEmail(email);
  if (!profile || !profile.active) throw new Error("No active EpicTools team profile exists for that email.");
  if (profile.user_id) return { profile, alreadyLinked: true };

  const { url, key } = getConfig(true);
  const endpoint = `${url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: profile.email,
      data: {
        display_name: profile.display_name,
        role: profile.role,
        team_profile_id: profile.id,
      },
    }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || payload?.error_description || "Unable to send Supabase invitation.");
  }

  return {
    profile,
    invitedAuthUserId: typeof payload?.id === "string" ? payload.id : null,
    alreadyLinked: false,
  };
}

export async function sendTeamPasswordReset(email: string, redirectTo: string) {
  const profile = await getTeamProfileByEmail(email);
  if (!profile || !profile.active || profile.role === "workstation") {
    throw new Error("No active EpicTools employee account exists for that email.");
  }
  if (!profile.user_id) {
    throw new Error("This employee has not activated EpicTools yet. Send an invitation instead.");
  }

  const { url, key } = getConfig(false);
  const endpoint = `${url}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: profile.email }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || payload?.error_description || "Unable to send password reset email.");
  }

  return { profile };
}

export async function signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
  const { url, key } = getConfig(false);
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.msg || "Invalid email or password.");
  }

  return payload as SupabaseSession;
}

export async function updatePasswordWithAccessToken(accessToken: string, password: string) {
  const { url, key } = getConfig(false);
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || "Unable to set password.");
  }
  return payload as SupabaseAuthUser;
}

export async function getAuthUser(accessToken: string) {
  const { url, key } = getConfig(false);
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return response.json() as Promise<SupabaseAuthUser>;
}

export async function getAuthenticatedTeamProfile(accessToken: string | null | undefined) {
  if (!accessToken) return null;
  const user = await getAuthUser(accessToken);
  if (!user) return null;
  const profile = await getTeamProfileByUserId(user.id);
  if (!profile || !profile.active) return null;
  return profile;
}

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
