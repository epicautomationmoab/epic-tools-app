/**
 * Conservative EXP-to-waiver matching. No nickname/partial-name guess may
 * automatically assign an EXP completion to a waiver signer.
 */
export type DriverIdentity = { reference: string; fullName: string };
export type MatchResult =
  | { status: "verified_candidate"; waiverReference: string; method: "exact_unique" }
  | { status: "review"; suggestedReferences: string[] }
  | { status: "unmatched"; suggestedReferences: [] };

function normal(name: string) {
  return name.normalize("NFKC").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
const aliases: Record<string, string[]> = {
  bob: ["robert", "rob", "bobby"], robert: ["bob", "rob", "bobby"],
  rob: ["robert", "bob"], jon: ["jonathan", "john"], john: ["jonathan", "jon"],
  jonathan: ["john", "jon"], bill: ["william"], william: ["bill"],
  mike: ["michael"], michael: ["mike"], jim: ["james"], james: ["jim"],
  liz: ["elizabeth"], elizabeth: ["liz"], kate: ["katherine"], katherine: ["kate"],
};
function possibleNickname(left: string, right: string) {
  const a = normal(left).split(" ");
  const b = normal(right).split(" ");
  if (a.length < 2 || b.length < 2 || a.at(-1) !== b.at(-1)) return false;
  return a[0] !== b[0] && (aliases[a[0]]?.includes(b[0]) || aliases[b[0]]?.includes(a[0])) === true;
}
export function suggestExpWaiverMatch(participantName: string, waiverDrivers: DriverIdentity[]): MatchResult {
  const valid = waiverDrivers.filter(driver => Boolean(driver.reference?.trim()) && Boolean(normal(driver.fullName)));
  const exact = valid.filter(driver => normal(driver.fullName) === normal(participantName));
  // Multiple exact matches (including duplicate names) are ambiguous.
  if (exact.length === 1) return { status: "verified_candidate", waiverReference: exact[0].reference, method: "exact_unique" };
  if (exact.length > 1) return { status: "review", suggestedReferences: exact.map(driver => driver.reference) };
  // A middle initial on one source and no middle name on another (for example,
  // "Michael D Flores" vs "MICHAEL FLORES") is a review suggestion ONLY.
  // Never auto-verify based on first and last name; names can collide.
  const firstLast = (name: string) => {
    const parts = normal(name).split(" ").filter(Boolean);
    return parts.length >= 2 ? [parts[0], parts[parts.length - 1]].join(" ") : "";
  };
  const participantFirstLast = firstLast(participantName);
  const possible = valid.filter(driver =>
    possibleNickname(participantName, driver.fullName) ||
    (participantFirstLast !== "" && firstLast(driver.fullName) === participantFirstLast)
  );
  if (possible.length) return { status: "review", suggestedReferences: possible.map(driver => driver.reference) };
  return { status: "unmatched", suggestedReferences: [] };
}
