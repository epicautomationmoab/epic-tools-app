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
  invited_at?: string | null;
  email_confirmed_at?: string | null;
  last_sign_in_at?: string | null;
};

export type SupabaseSession = {
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

export async function createTeamProfile(input: {
  display_name: string;
  email: string;
  role: TeamProfile["role"];
  tripworks_user_id?: number | string | null;
  tripworks_full_name?: string | null;
}) {
  const displayName = input.display_name.trim();
  const email = input.email.trim().toLowerCase();
  const roles: TeamProfile["role"][] = ["admin", "manager", "agent", "workstation"];
  if (!displayName) throw new Error("Employee name is required.");
  if (!email || !email.includes("@")) throw new Error("A valid employee email is required.");
  if (!roles.includes(input.role)) throw new Error("Select a valid EpicTools role.");
  if (await getTeamProfileByEmail(email)) throw new Error("An EpicTools employee profile already exists for that email.");
  const rawId = input.tripworks_user_id;
  const tripworksUserId = rawId === undefined || rawId === null || rawId === "" ? null : Number(rawId);
  if (tripworksUserId !== null && (!Number.isInteger(tripworksUserId) || tripworksUserId <= 0)) {
    throw new Error("TripWorks User ID must be a positive whole number.");
  }
  const rows = await adminRest<TeamProfile[]>("team_profiles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      display_name: displayName,
      email,
      role: input.role,
      active: true,
      tripworks_user_id: tripworksUserId,
      tripworks_full_name: input.tripworks_full_name?.trim() || displayName,
    }),
  });
  return rows[0];
}

export async function listSupabaseAuthUsers() {
  const { url, key } = getConfig(true);
  const response = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=100`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      payload?.msg || payload?.message || payload?.error_description || "Unable to load Supabase Auth users.",
    );
  }

  const users = Array.isArray(payload?.users) ? payload.users : [];
  return users as SupabaseAuthUser[];
}

async function getSupabaseAuthUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await listSupabaseAuthUsers();
  return users.find((user) => user.email?.trim().toLowerCase() === normalizedEmail) ?? null;
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
  let profile = await getTeamProfileByEmail(email);
  if (!profile || !profile.active || profile.role === "workstation") {
    throw new Error("No active EpicTools employee account exists for that email.");
  }

  if (!profile.user_id) {
    const authUser = await getSupabaseAuthUserByEmail(profile.email);
    if (!authUser?.id) {
      throw new Error("This employee does not have a Supabase Auth account yet. Send an invitation instead.");
    }

    await linkTeamProfileUser(profile.id, authUser.id);
    profile = { ...profile, user_id: authUser.id };
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

export async function refreshSessionWithRefreshToken(refreshToken: string): Promise<SupabaseSession> {
  const { url, key } = getConfig(false);
  const response = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error_description || payload?.msg || "Unable to refresh employee session.");
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
