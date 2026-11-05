/** Guest-declared on-site viewing is distinct from tracked portal playback. */
export const ONSITE_ACK_VERSION = "onsite-video-2026-11-05-v1";
export const ONSITE_ACK_TEXT = "I watched the entire Epic safety/orientation video at this location and am ready to complete the knowledge assessment.";
const key = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
export function hasOnsiteAcknowledgement(summary: Record<string, unknown> | null | undefined, names?: string[]): boolean {
  const evidence = summary?.onsiteVideoAcknowledgement as {version?:unknown; acknowledgedAt?:unknown; drivers?:unknown} | undefined;
  if (!evidence || evidence.version !== ONSITE_ACK_VERSION || typeof evidence.acknowledgedAt !== "string" || !Number.isFinite(Date.parse(evidence.acknowledgedAt))) return false;
  if (!Array.isArray(evidence.drivers) || evidence.drivers.length < 1 || evidence.drivers.length > 20) return false;
  const drivers = evidence.drivers as Array<{name?:unknown;initials?:unknown}>;
  if (drivers.some(d => !d || typeof d.name !== "string" || !d.name.trim() || typeof d.initials !== "string" || !d.initials.startsWith("data:image/png;base64,"))) return false;
  const acknowledged = new Set(drivers.map(d => key(d.name as string)));
  return acknowledged.size === drivers.length && (!names || (names.length === acknowledged.size && names.every(n => acknowledged.has(key(n)))));
}
