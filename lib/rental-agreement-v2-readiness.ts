export type RentalAgreementV2Role = "driver" | "passenger";

export type RentalAgreementV2Signer = {
  role: RentalAgreementV2Role;
  minorCount?: number | null;
};

export type RentalAgreementV2Readiness = {
  participantsReceived: number;
  participantsExpected: number;
  driversReceived: number;
  driversExpected: number;
  participantsComplete: boolean;
  driversComplete: boolean;
  ready: boolean;
  participantOverage: number;
  driverOverage: number;
};

function nonNegativeInteger(value: number | null | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(Number(value)));
}

/**
 * Rental Agreement V2 readiness rules:
 * - each signed adult counts as one participant;
 * - each listed minor counts as one participant;
 * - only signed adult Drivers count toward Driver coverage;
 * - required Drivers equals reservation vehicle count;
 * - document readiness requires BOTH participant and Driver coverage.
 *
 * Identity matching remains separate: duplicates or unmatched people should
 * surface as exceptions rather than silently satisfying aggregate counts.
 */
export function evaluateRentalAgreementV2Readiness(input: {
  expectedParticipantCount: number | null | undefined;
  vehicleCount: number | null | undefined;
  signers: RentalAgreementV2Signer[];
}): RentalAgreementV2Readiness {
  const participantsExpected = nonNegativeInteger(input.expectedParticipantCount);
  const driversExpected = nonNegativeInteger(input.vehicleCount);

  const participantsReceived = input.signers.reduce(
    (total, signer) => total + 1 + nonNegativeInteger(signer.minorCount),
    0,
  );

  const driversReceived = input.signers.reduce(
    (total, signer) => total + (signer.role === "driver" ? 1 : 0),
    0,
  );

  const participantsComplete = participantsReceived >= participantsExpected;
  const driversComplete = driversReceived >= driversExpected;

  return {
    participantsReceived,
    participantsExpected,
    driversReceived,
    driversExpected,
    participantsComplete,
    driversComplete,
    ready: participantsComplete && driversComplete,
    participantOverage: Math.max(0, participantsReceived - participantsExpected),
    driverOverage: Math.max(0, driversReceived - driversExpected),
  };
}

export function rentalAgreementV2ReadinessLabel(
  readiness: RentalAgreementV2Readiness,
) {
  return `Agreements ${readiness.participantsReceived}/${readiness.participantsExpected} · Drivers ${readiness.driversReceived}/${readiness.driversExpected}`;
}
