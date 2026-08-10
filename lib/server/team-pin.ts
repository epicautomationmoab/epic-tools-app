import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { supabasePatch, supabaseSelect } from "@/lib/server/supabase-rest";

const PIN_PATTERN = /^\d{4,6}$/;
const HASH_PREFIX = "scrypt$v1";
const KEY_LENGTH = 32;

type TeamPinRow = {
  id: string;
  display_name: string;
  email: string;
  role: "admin" | "manager" | "agent" | "workstation";
  active: boolean;
  pin_hash: string | null;
  pin_set_at: string | null;
};

export type VerifiedTeamPinIdentity = {
  id: string;
  display_name: string;
  email: string;
  role: TeamPinRow["role"];
};

function validatePin(pin: string) {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error("PIN must be 4 to 6 digits.");
  }
}

function hashPin(pin: string) {
  validatePin(pin);
  const salt = randomBytes(16);
  const derived = scryptSync(pin, salt, KEY_LENGTH);
  return `${HASH_PREFIX}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function verifyPinHash(pin: string, storedHash: string) {
  if (!PIN_PATTERN.test(pin)) return false;

  const [algorithm, version, saltBase64, hashBase64] = storedHash.split("$");
  if (`${algorithm}$${version}` !== HASH_PREFIX || !saltBase64 || !hashBase64) return false;

  try {
    const salt = Buffer.from(saltBase64, "base64");
    const expected = Buffer.from(hashBase64, "base64");
    const actual = scryptSync(pin, salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

async function getActivePinRow(profileId: string) {
  const params = new URLSearchParams({
    select: "id,display_name,email,role,active,pin_hash,pin_set_at",
    id: `eq.${profileId}`,
    active: "eq.true",
    limit: "1",
  });
  const rows = await supabaseSelect<TeamPinRow>("team_profiles", params);
  return rows[0] ?? null;
}

async function getActiveEmployeePinRows() {
  return supabaseSelect<TeamPinRow>(
    "team_profiles",
    new URLSearchParams({
      select: "id,display_name,email,role,active,pin_hash,pin_set_at",
      active: "eq.true",
      role: "neq.workstation",
      pin_set_at: "not.is.null",
      order: "display_name.asc",
    }),
  );
}

export async function setTeamProfilePin(profileId: string, pin: string) {
  validatePin(pin);

  const profile = await getActivePinRow(profileId);
  if (!profile) throw new Error("Active EpicTools team profile not found.");
  if (profile.role === "workstation") throw new Error("Shared workstation profiles cannot have employee PINs.");

  const existing = await getActiveEmployeePinRows();
  for (const row of existing) {
    if (row.id === profileId || !row.pin_hash) continue;
    if (verifyPinHash(pin, row.pin_hash)) {
      throw new Error("That PIN is already in use. Choose a different PIN.");
    }
  }

  const now = new Date().toISOString();
  await supabasePatch(
    "team_profiles",
    new URLSearchParams({ id: `eq.${profileId}` }),
    {
      pin_hash: hashPin(pin),
      pin_set_at: now,
      updated_at: now,
    },
  );

  return { profileId: profile.id, pinSetAt: now };
}

export async function verifyTeamProfilePin(profileId: string, pin: string): Promise<VerifiedTeamPinIdentity | null> {
  const profile = await getActivePinRow(profileId);
  if (!profile || profile.role === "workstation" || !profile.pin_hash) return null;
  if (!verifyPinHash(pin, profile.pin_hash)) return null;

  return {
    id: profile.id,
    display_name: profile.display_name,
    email: profile.email,
    role: profile.role,
  };
}

export async function identifyTeamProfileByPin(pin: string): Promise<VerifiedTeamPinIdentity | null> {
  if (!PIN_PATTERN.test(pin)) return null;

  const rows = await getActiveEmployeePinRows();
  const matches = rows.filter((row) => row.pin_hash && verifyPinHash(pin, row.pin_hash));
  if (matches.length !== 1) return null;

  const profile = matches[0];
  return {
    id: profile.id,
    display_name: profile.display_name,
    email: profile.email,
    role: profile.role,
  };
}

export async function teamProfileHasPin(profileId: string) {
  const profile = await getActivePinRow(profileId);
  return Boolean(profile?.pin_hash && profile.pin_set_at);
}
