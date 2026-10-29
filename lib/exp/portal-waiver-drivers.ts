/**
 * Candidate waiver names for EXP. These are selectable identities, NOT proof
 * that an EXP participant is verified. The backend must reconcile signatures.
 */
export type ExpWaiverSource = {
  readinessId: string;
  signers: Array<{
    name: string;
    role?: "driver" | "passenger" | "minor";
    isMinor?: boolean | null;
    isPassenger?: boolean | null;
    is_minor?: boolean | null;
    is_passenger?: boolean | null;
  }>;
};
export function getExpWaiverDriverNames(
  readinessId: string,
  epicDocuments: ExpWaiverSource[],
  mpwrWaivers: ExpWaiverSource[],
): string[] {
  const names: string[] = [];
  for (const document of epicDocuments) {
    if (document.readinessId !== readinessId) continue;
    for (const signer of document.signers) {
      // A generic signer is not necessarily an authorized driver.
      if (signer.role === "driver") names.push(signer.name);
    }
  }
  for (const document of mpwrWaivers) {
    if (document.readinessId !== readinessId) continue;
    for (const signer of document.signers) {
      if (signer.isMinor ?? signer.is_minor ?? false) continue;
      if (signer.isPassenger ?? signer.is_passenger ?? false) continue;
      names.push(signer.name);
    }
  }
  const unique = new Map<string,string>();
  for (const raw of names) {
    const name = raw.trim().replace(/\s+/g, " ");
    if (!name.includes(" ")) continue;
    const key = name.toLocaleLowerCase("en-US");
    if (!unique.has(key)) unique.set(key, name);
  }
  return [...unique.values()];
}
