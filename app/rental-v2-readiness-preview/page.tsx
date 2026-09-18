import {
  evaluateRentalAgreementV2Readiness,
  rentalAgreementV2ReadinessLabel,
  type RentalAgreementV2Signer,
} from "@/lib/rental-agreement-v2-readiness";

type Scenario = {
  title: string;
  note: string;
  people: number;
  vehicles: number;
  signers: RentalAgreementV2Signer[];
};

const scenarios: Scenario[] = [
  {
    title: "1 vehicle · 4 people · complete",
    note: "One Driver, one adult Passenger, and two minors listed under the Passenger.",
    people: 4,
    vehicles: 1,
    signers: [
      { role: "driver" },
      { role: "passenger", minorCount: 2 },
    ],
  },
  {
    title: "2 vehicles · 4 people · complete",
    note: "Two Drivers and two adult Passengers.",
    people: 4,
    vehicles: 2,
    signers: [
      { role: "driver" },
      { role: "driver" },
      { role: "passenger" },
      { role: "passenger" },
    ],
  },
  {
    title: "2 vehicles · 4 people · missing Driver",
    note: "Everyone is accounted for, but only one Driver has signed for a two-vehicle reservation.",
    people: 4,
    vehicles: 2,
    signers: [
      { role: "driver" },
      { role: "passenger" },
      { role: "passenger" },
      { role: "passenger" },
    ],
  },
  {
    title: "2 vehicles · 4 people · missing participant",
    note: "Driver coverage is complete, but only three of four expected participants are accounted for.",
    people: 4,
    vehicles: 2,
    signers: [
      { role: "driver" },
      { role: "driver" },
      { role: "passenger" },
    ],
  },
  {
    title: "4 vehicles · 4 people · complete",
    note: "Every participant is a Driver.",
    people: 4,
    vehicles: 4,
    signers: [
      { role: "driver" },
      { role: "driver" },
      { role: "driver" },
      { role: "driver" },
    ],
  },
];

function badgeStyle(complete: boolean) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    padding: "8px 12px",
    fontWeight: 900,
    background: complete ? "#e6f3eb" : "#f9e6e4",
    color: complete ? "#1f8a4c" : "#c43d32",
  } as const;
}

export default function RentalV2ReadinessPreviewPage() {
  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px 72px" }}>
      <p style={{ color: "#e35722", fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 8 }}>
        Rental Agreement V2 · Preview Only
      </p>
      <h1 style={{ fontSize: 40, marginBottom: 10 }}>Readiness Counting Model</h1>
      <p style={{ color: "#6b6b6b", fontSize: 17, lineHeight: 1.55, maxWidth: 800 }}>
        This page demonstrates the proposed V2 counting logic only. It does not read or change live Guest Readiness data.
        Adults count when they sign. Minors count when listed under a signing parent or legal guardian. Driver requirement equals vehicle count.
      </p>

      <div style={{ display: "grid", gap: 18, marginTop: 28 }}>
        {scenarios.map((scenario) => {
          const readiness = evaluateRentalAgreementV2Readiness({
            expectedParticipantCount: scenario.people,
            vehicleCount: scenario.vehicles,
            signers: scenario.signers,
          });

          return (
            <section
              key={scenario.title}
              style={{
                background: "#fff",
                border: "1px solid #d8d8d8",
                borderRadius: 12,
                padding: 22,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
                <div>
                  <h2 style={{ fontSize: 22, marginBottom: 6 }}>{scenario.title}</h2>
                  <p style={{ margin: 0, color: "#6b6b6b", lineHeight: 1.45 }}>{scenario.note}</p>
                </div>
                <span style={badgeStyle(readiness.ready)}>{readiness.ready ? "READY" : "NOT READY"}</span>
              </div>

              <div style={{ marginTop: 18, fontSize: 22, fontWeight: 900 }}>
                {rentalAgreementV2ReadinessLabel(readiness)}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <span style={badgeStyle(readiness.participantsComplete)}>
                  Agreements {readiness.participantsReceived}/{readiness.participantsExpected}
                </span>
                <span style={badgeStyle(readiness.driversComplete)}>
                  Drivers {readiness.driversReceived}/{readiness.driversExpected}
                </span>
              </div>
            </section>
          );
        })}
      </div>

      <section style={{ marginTop: 30, background: "#fff7f1", border: "1px solid #f0c3a8", borderRadius: 12, padding: 22 }}>
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Important implementation note</h2>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          The counting rule is intentionally separate from identity matching. If the same person somehow signs twice, or a signer cannot be matched to an expected participant,
          that should become an exception rather than silently making the counts look complete.
        </p>
      </section>
    </main>
  );
}
