import { createHash, timingSafeEqual } from "crypto";

export const WORKSTATION_COOKIE = "epic_workstation_access";

function configuredPassword() {
  return process.env.EPIC_HQ_RECEPTION_PASSWORD?.trim() || "";
}

export function workstationCookieValue() {
  const password = configuredPassword();
  if (!password) throw new Error("HQ Reception workstation password is not configured.");
  return createHash("sha256").update(password).digest("hex");
}

export function verifyWorkstationPassword(password: string) {
  const expected = configuredPassword();
  if (!expected || !password) return false;
  const actualBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export function verifyWorkstationCookie(value: string | null | undefined) {
  if (!value) return false;
  try {
    const expected = workstationCookieValue();
    const actualBuffer = Buffer.from(value);
    const expectedBuffer = Buffer.from(expected);
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}
