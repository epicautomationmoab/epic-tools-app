import fs from "node:fs";

const path = "app/team/readiness/ReadinessTable.tsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  const first = source.indexOf(search);
  if (first === -1) throw new Error(`Could not find ${label}. No changes written.`);
  if (source.indexOf(search, first + search.length) !== -1) {
    throw new Error(`Found ${label} more than once. No changes written.`);
  }
  source = source.slice(0, first) + replacement + source.slice(first + search.length);
}

if (source.includes("mpwrReservationUrlFromConfirmation")) {
  throw new Error("The MPWR field mapping correction is already installed.");
}

replaceOnce(
  `function linkedValue(value: string, url: string | null | undefined) {`,
  `function mpwrReservationUrlFromConfirmation(confirmation: string | null | undefined) {
  const value = confirmation?.trim().toUpperCase();
  return value ? \`https://mpwr-hq.poladv.com/orders/\${value}\` : null;
}

function linkedValue(value: string, url: string | null | undefined) {`,
  "linkedValue helper",
);

replaceOnce(
  `    setMpwrConfirmationDraft(selected.mpwr_confirmation_number ?? "");
    setMpwrWaiverUrlDraft(selected.mpwr_reservation_url ?? "");`,
  `    setMpwrConfirmationDraft(selected.mpwr_confirmation_number ?? "");
    // The readiness row exposes the internal MPWR order URL, not the guest waiver URL.
    // Leave the waiver field blank so staff must paste the actual Polaris join link.
    setMpwrWaiverUrlDraft("");`,
  "manual MPWR draft initialization",
);

replaceOnce(
  `      const updateRow = (row: ReadinessRow): ReadinessRow => ({
        ...row,
        mpwr_confirmation_number: confirmationNumber,
        mpwr_reservation_url: waiverUrl,
      });`,
  `      const updateRow = (row: ReadinessRow): ReadinessRow => ({
        ...row,
        mpwr_confirmation_number: confirmationNumber,
        mpwr_reservation_url:
          mpwrReservationUrlFromConfirmation(confirmationNumber),
      });`,
  "manual MPWR local-row update",
);

replaceOnce(
  `                  <p>
                    Use only when the reservation already exists in MPWR but its
                    confirmation and unique waiver link did not reach Guest Readiness.
                  </p>`,
  `                  <p>
                    Enter the MPWR confirmation and the guest waiver link. The internal
                    MPWR reservation link is generated automatically from the confirmation.
                  </p>`,
  "manual MPWR help text",
);

replaceOnce(
  `                    <span>MPWR Unique Waiver Link</span>`,
  `                    <span>MPWR Guest Waiver Link</span>`,
  "manual MPWR waiver label",
);

fs.writeFileSync(path, source);
console.log("Corrected Manual MPWR Recovery field mapping.");
console.log("Waiver field now starts blank and confirmation links to the generated MPWR order URL.");
