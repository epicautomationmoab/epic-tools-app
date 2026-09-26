import { supabaseSelect } from "@/lib/server/supabase-rest";

export type RentalV2ReadinessSource = {
  readinessId: string;
  confirmationCode: string;
  expectedGuestCount: number | null | undefined;
  vehicleCount: number | null | undefined;
};

export type RentalV2SignerSummary = {
  name: string;
  role: "driver" | "passenger" | "minor";
  signatureId: string;
  signedAt: string | null;
};

export type RentalV2ReadinessSummary = {
  readinessId: string;
  agreementsReceived: number;
  agreementsExpected: number;
  driversReceived: number;
  driversExpected: number;
  agreementsComplete: boolean;
  driversComplete: boolean;
  ready: boolean;
  signers: RentalV2SignerSummary[];
  exceptions: string[];
};

type OperationalReadinessRow = {
  readiness_id: string;
  source_store_visit_id: string | null;
  confirmation_code: string;
};

type SessionRow = {
  id: string;
  confirmation_code: string;
  store_visit_id: string | null;
  business_line: string | null;
  session_status: string | null;
};

type SignatureRow = {
  id: string;
  waiver_session_id: string;
  signer_first_name?: string | null;
  signer_middle_initial?: string | null;
  signer_last_name?: string | null;
  signer_full_name?: string | null;
  signed_at?: string | null;
  signer_dob?: string | null;
  signer_email?: string | null;
  archived_at?: string | null;
  business_line?: string | null;
  rental_role?: string | null;
};

type MinorRow = {
  adult_signature_id: string;
  minor_first_name: string | null;
  minor_last_name: string | null;
  minor_full_name: string | null;
  minor_dob?: string | null;
};

function quoteList(values: string[]) {
  return values
    .map((value) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
}

function signerName(row: SignatureRow) {
  const composed = [
    row.signer_first_name,
    row.signer_middle_initial,
    row.signer_last_name,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");
  return composed || row.signer_full_name?.trim() || "Signed participant";
}

function minorName(row: MinorRow) {
  return (
    row.minor_full_name?.trim() ||
    [row.minor_first_name, row.minor_last_name]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(" ") ||
    "Minor participant"
  );
}

export async function loadRentalV2Readiness(
  sources: RentalV2ReadinessSource[],
): Promise<Map<string, RentalV2ReadinessSummary>> {
  const result = new Map<string, RentalV2ReadinessSummary>();
  const rentalSources = sources.filter((source) => source.readinessId);

  for (const source of rentalSources) {
    const agreementsExpected = Math.max(0, Math.trunc(source.expectedGuestCount ?? 0));
    const driversExpected = Math.max(0, Math.trunc(source.vehicleCount ?? 0));
    result.set(source.readinessId, {
      readinessId: source.readinessId,
      agreementsReceived: 0,
      agreementsExpected,
      driversReceived: 0,
      driversExpected,
      agreementsComplete: agreementsExpected === 0,
      driversComplete: driversExpected === 0,
      ready: agreementsExpected === 0 && driversExpected === 0,
      signers: [],
      exceptions: [],
    });
  }

  if (!rentalSources.length) return result;

  const readinessIds = [...new Set(rentalSources.map((source) => source.readinessId))];
  const operationalRows = await supabaseSelect<OperationalReadinessRow>(
    "guest_readiness_operational",
    new URLSearchParams({
      select: "readiness_id,source_store_visit_id,confirmation_code",
      readiness_id: `in.(${quoteList(readinessIds)})`,
      limit: "1000",
    }),
  );

  const operationalById = new Map(operationalRows.map((row) => [row.readiness_id, row]));
  const confirmationCodes = [...new Set(operationalRows.map((row) => row.confirmation_code).filter(Boolean))];
  if (!confirmationCodes.length) return result;

  const sessions = await supabaseSelect<SessionRow>(
    "epic_waiver_sessions",
    new URLSearchParams({
      select: "id,confirmation_code,store_visit_id,business_line,session_status",
      confirmation_code: `in.(${quoteList(confirmationCodes)})`,
      business_line: "eq.rental",
      limit: "1000",
    }),
  );

  const sessionByReadinessId = new Map<string, SessionRow>();
  for (const source of rentalSources) {
    const operational = operationalById.get(source.readinessId);
    if (!operational) continue;
    const candidates = sessions.filter(
      (session) =>
        session.confirmation_code === operational.confirmation_code &&
        session.business_line === "rental" &&
        session.session_status === "active",
    );
    const exact = operational.source_store_visit_id
      ? candidates.find((session) => session.store_visit_id === operational.source_store_visit_id)
      : null;
    const selected = exact ?? (candidates.length === 1 ? candidates[0] : null);
    if (selected) sessionByReadinessId.set(source.readinessId, selected);
  }

  const sessionIds = [...new Set([...sessionByReadinessId.values()].map((session) => session.id))];
  if (!sessionIds.length) return result;

  // select=* is intentional during staged rollout: production does not have
  // rental_role until the V2 migration is applied. Old rows simply omit it.
  const signatures = await supabaseSelect<SignatureRow>(
    "epic_waiver_signatures",
    new URLSearchParams({
      select: "*",
      waiver_session_id: `in.(${quoteList(sessionIds)})`,
      archived_at: "is.null",
      business_line: "eq.rental",
      order: "signed_at.asc",
      limit: "1000",
    }),
  );

  const v2Signatures = signatures.filter(
    (signature) => signature.rental_role === "driver" || signature.rental_role === "passenger",
  );
  const signatureIds = v2Signatures.map((signature) => signature.id);
  const minors = signatureIds.length
    ? await supabaseSelect<MinorRow>(
        "epic_waiver_minors",
        new URLSearchParams({
          select: "adult_signature_id,minor_first_name,minor_last_name,minor_full_name,minor_dob",
          adult_signature_id: `in.(${quoteList(signatureIds)})`,
          limit: "2000",
        }),
      )
    : [];

  const minorsBySignature = new Map<string, MinorRow[]>();
  for (const minor of minors) {
    const current = minorsBySignature.get(minor.adult_signature_id) ?? [];
    current.push(minor);
    minorsBySignature.set(minor.adult_signature_id, current);
  }

  for (const source of rentalSources) {
    const base = result.get(source.readinessId)!;
    const session = sessionByReadinessId.get(source.readinessId);
    if (!session) continue;

    const sessionSignatures = v2Signatures.filter((signature) => signature.waiver_session_id === session.id);
    const latestByIdentity = new Map<string, SignatureRow>();
    const duplicateKeys = new Set<string>();

    for (const signature of sessionSignatures) {
      const nameKey = signerName(signature).trim().toLowerCase().replace(/\s+/g, " ");
      const dobKey = signature.signer_dob?.trim() || "";
      const emailKey = signature.signer_email?.trim().toLowerCase() || "";
      const identityKey = dobKey
        ? `${nameKey}|${dobKey}`
        : emailKey
          ? `${nameKey}|${emailKey}`
          : signature.id;
      if (latestByIdentity.has(identityKey)) duplicateKeys.add(identityKey);
      latestByIdentity.set(identityKey, signature);
    }

    const adultSignatures = [...latestByIdentity.values()];
    const signers: RentalV2SignerSummary[] = [];
    const seenMinorKeys = new Set<string>();
    const exceptions = duplicateKeys.size
      ? [`${duplicateKeys.size} duplicate adult signer submission${duplicateKeys.size === 1 ? "" : "s"} collapsed for readiness.`]
      : [];

    for (const signature of adultSignatures) {
      signers.push({
        name: signerName(signature),
        role: signature.rental_role as "driver" | "passenger",
        signatureId: signature.id,
        signedAt: signature.signed_at ?? null,
      });
      for (const minor of minorsBySignature.get(signature.id) ?? []) {
        const name = minorName(minor);
        const minorKey = `${name.trim().toLowerCase().replace(/\s+/g, " ")}|${minor.minor_dob ?? ""}`;
        if (seenMinorKeys.has(minorKey)) {
          exceptions.push(`Duplicate minor participant collapsed: ${name}.`);
          continue;
        }
        seenMinorKeys.add(minorKey);
        signers.push({
          name,
          role: "minor",
          signatureId: signature.id,
          signedAt: signature.signed_at ?? null,
        });
      }
    }

    const agreementsReceived = signers.length;
    const driversReceived = adultSignatures.filter((signature) => signature.rental_role === "driver").length;
    const agreementsComplete = agreementsReceived >= base.agreementsExpected;
    const driversComplete = driversReceived >= base.driversExpected;

    result.set(source.readinessId, {
      ...base,
      agreementsReceived,
      driversReceived,
      agreementsComplete,
      driversComplete,
      ready: agreementsComplete && driversComplete,
      signers,
      exceptions,
    });
  }

  return result;
}
