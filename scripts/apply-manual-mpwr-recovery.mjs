import fs from "node:fs";

const tsxPath = "app/team/readiness/ReadinessTable.tsx";
const cssPath = "app/team/readiness/ReadinessShell.module.css";

let tsx = fs.readFileSync(tsxPath, "utf8");
let css = fs.readFileSync(cssPath, "utf8");

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first === -1) throw new Error(`Could not find ${label}. No files were written.`);
  if (source.indexOf(search, first + search.length) !== -1) {
    throw new Error(`Found ${label} more than once. No files were written.`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

if (tsx.includes("save_manual_mpwr_identity") || css.includes(".manualMpwrRecovery")) {
  throw new Error("Manual MPWR Recovery already appears to be installed. No files were written.");
}

const peopleBlock = `              <div
                className={\`${'${styles.drawerFactWide} ${styles.peopleCountCard}'}\`}
              >
                <div className={styles.peopleCountHeader}>
                  <span>How many people?</span>
                  {peopleOverride?.override_active ? (
                    <small className={styles.overrideBadge}>Epic override</small>
                  ) : (
                    <small className={styles.tripWorksBadge}>TripWorks</small>
                  )}
                </div>

                <div className={styles.peopleCountEditRow}>
                  <input
                    className={styles.peopleCountInput}
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={peopleDraft}
                    onChange={(event) => {
                      setPeopleDraft(event.target.value);
                      setPeopleStatus("idle");
                      setPeopleError("");
                    }}
                    aria-label="How many people"
                  />

                  <button
                    type="button"
                    className={styles.peopleCountSaveButton}
                    disabled={peopleStatus === "saving" || peopleStatus === "loading"}
                    onClick={savePeopleCount}
                  >
                    {peopleStatus === "saving" ? "Saving..." : "Save"}
                  </button>

                  {peopleOverride?.override_active ? (
                    <button
                      type="button"
                      className={styles.peopleCountRestoreButton}
                      disabled={peopleStatus === "saving"}
                      onClick={restoreTripWorksPeopleCount}
                    >
                      Restore TripWorks count
                    </button>
                  ) : null}
                </div>

                <input
                  className={styles.peopleCountReasonInput}
                  value={peopleReason}
                  onChange={(event) => {
                    setPeopleReason(event.target.value);
                    setPeopleStatus("idle");
                  }}
                  placeholder="Optional reason for adjustment"
                  aria-label="Reason for people-count adjustment"
                />

                {peopleOverride?.override_active ? (
                  <small className={styles.peopleCountSourceNote}>
                    TripWorks originally supplied{" "}
                    {peopleOverride.source_count_at_override ?? "an unknown count"}.
                    This Epic Tools count will remain in effect until restored.
                  </small>
                ) : (
                  <small className={styles.peopleCountSourceNote}>
                    Saving a different count creates a durable Epic Tools override.
                  </small>
                )}

                {peopleStatus === "saved" ? (
                  <small className={styles.peopleCountSaved}>Saved</small>
                ) : null}

                {peopleStatus === "error" ? (
                  <small className={styles.peopleCountError}>{peopleError}</small>
                ) : null}
              </div>
`;

tsx = replaceOnce(tsx, peopleBlock, "", "the existing people-count drawer block");

tsx = replaceOnce(
  tsx,
  `  const [peopleError, setPeopleError] = useState("");\n`,
  `  const [peopleError, setPeopleError] = useState("");

  const [mpwrConfirmationDraft, setMpwrConfirmationDraft] = useState("");
  const [mpwrWaiverUrlDraft, setMpwrWaiverUrlDraft] = useState("");
  const [manualMpwrStatus, setManualMpwrStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [manualMpwrError, setManualMpwrError] = useState("");
`,
  "the people-error state marker",
);

tsx = replaceOnce(
  tsx,
  `    setPeopleError("");\n\n    let peopleRequestCancelled = false;`,
  `    setPeopleError("");

    setMpwrConfirmationDraft(selected.mpwr_confirmation_number ?? "");
    setMpwrWaiverUrlDraft(selected.mpwr_reservation_url ?? "");
    setManualMpwrStatus("idle");
    setManualMpwrError("");

    let peopleRequestCancelled = false;`,
  "the selected-row reset marker",
);

const saveManualMpwrFunction = `  async function saveManualMpwrIdentity() {
    if (!selected) return;

    const confirmationNumber = mpwrConfirmationDraft.trim().toUpperCase();
    const waiverUrl = mpwrWaiverUrlDraft.trim();

    if (!confirmationNumber || !waiverUrl) {
      setManualMpwrStatus("error");
      setManualMpwrError("Enter both the MPWR confirmation and unique waiver link.");
      return;
    }

    setManualMpwrStatus("saving");
    setManualMpwrError("");

    try {
      await callReadinessRpc("save_manual_mpwr_identity", {
        p_confirmation_code: selected.confirmation_code,
        p_visit_start_time: selected.visit_start_time,
        p_mpwr_confirmation_number: confirmationNumber,
        p_mpwr_waiver_url: waiverUrl,
      });

      const updateRow = (row: ReadinessRow): ReadinessRow => ({
        ...row,
        mpwr_confirmation_number: confirmationNumber,
        mpwr_reservation_url: waiverUrl,
      });

      setLocalRows((current) =>
        current.map((row) =>
          row.readiness_id === selected.readiness_id ? updateRow(row) : row,
        ),
      );
      setSelected((current) => (current ? updateRow(current) : current));
      setMpwrConfirmationDraft(confirmationNumber);
      setMpwrWaiverUrlDraft(waiverUrl);
      setManualMpwrStatus("saved");
    } catch (error) {
      setManualMpwrStatus("error");
      setManualMpwrError(
        error instanceof Error
          ? error.message
          : "Unable to save the MPWR information.",
      );
    }
  }

`;

tsx = replaceOnce(
  tsx,
  `  async function saveNote() {`,
  `${saveManualMpwrFunction}  async function saveNote() {`,
  "the saveNote function marker",
);

const bottomSections = `

            <section
              className={\`${'${styles.drawerSection} ${styles.peopleCountSection}'}\`}
            >
              <h3>People Count</h3>
${peopleBlock.replace(/^ {14}/gm, "              ")}
            </section>

            <section className={styles.drawerSection}>
              <details className={styles.manualMpwrRecovery}>
                <summary>Manual MPWR Recovery</summary>
                <div className={styles.manualMpwrRecoveryBody}>
                  <p>
                    Use only when the reservation already exists in MPWR but its
                    confirmation and unique waiver link did not reach Guest Readiness.
                  </p>

                  <label className={styles.manualMpwrField}>
                    <span>MPWR Confirmation</span>
                    <input
                      value={mpwrConfirmationDraft}
                      onChange={(event) => {
                        setMpwrConfirmationDraft(event.target.value);
                        setManualMpwrStatus("idle");
                        setManualMpwrError("");
                      }}
                      placeholder="CO-ABC-123"
                      autoCapitalize="characters"
                    />
                  </label>

                  <label className={styles.manualMpwrField}>
                    <span>MPWR Unique Waiver Link</span>
                    <input
                      type="url"
                      value={mpwrWaiverUrlDraft}
                      onChange={(event) => {
                        setMpwrWaiverUrlDraft(event.target.value);
                        setManualMpwrStatus("idle");
                        setManualMpwrError("");
                      }}
                      placeholder="https://adventures.polaris.com/join/..."
                    />
                  </label>

                  <button
                    type="button"
                    className={styles.manualMpwrSaveButton}
                    onClick={saveManualMpwrIdentity}
                    disabled={
                      manualMpwrStatus === "saving" ||
                      !mpwrConfirmationDraft.trim() ||
                      !mpwrWaiverUrlDraft.trim()
                    }
                  >
                    {manualMpwrStatus === "saving"
                      ? "Saving..."
                      : "Save MPWR Information"}
                  </button>

                  {manualMpwrStatus === "saved" ? (
                    <p className={styles.manualMpwrSuccess}>
                      MPWR information saved and Guest Readiness refreshed.
                    </p>
                  ) : null}

                  {manualMpwrStatus === "error" ? (
                    <p className={styles.manualMpwrError}>{manualMpwrError}</p>
                  ) : null}
                </div>
              </details>
            </section>`;

tsx = replaceOnce(
  tsx,
  `            </section>\n          </aside>`,
  `            </section>${bottomSections}\n          </aside>`,
  "the final drawer section marker",
);

const cssAddition = `

/* Bottom-of-drawer people count and manual MPWR recovery */
.peopleCountSection {
  margin-left: -2px;
  margin-right: -2px;
  padding: 14px;
  border: 1px solid #eadfae;
  border-radius: 12px;
  background: #fffbea;
}

.peopleCountSection h3 {
  color: #765d00;
  font-weight: 900;
}

.peopleCountSection .peopleCountCard {
  grid-column: auto;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
}

.manualMpwrRecovery {
  overflow: hidden;
  border: 1px solid #d9e4f0;
  border-radius: 12px;
  background: #f3f7fc;
}

.manualMpwrRecovery > summary {
  padding: 14px;
  color: #245d86;
  font-size: 16px;
  font-weight: 900;
  cursor: pointer;
  list-style-position: inside;
}

.manualMpwrRecoveryBody {
  display: grid;
  gap: 12px;
  padding: 0 14px 14px;
}

.manualMpwrRecoveryBody > p {
  margin: 0;
  color: #667181;
  font-size: 12px;
  line-height: 1.45;
}

.manualMpwrField {
  display: grid;
  gap: 6px;
}

.manualMpwrField span {
  color: #48515c;
  font-size: 12px;
  font-weight: 800;
}

.manualMpwrField input {
  width: 100%;
  box-sizing: border-box;
  min-height: 40px;
  border: 1px solid #cbdbe8;
  border-radius: 8px;
  background: #fff;
  color: #202733;
  padding: 8px 10px;
  font: inherit;
}

.manualMpwrSaveButton {
  width: 100%;
  min-height: 42px;
  border: 0;
  border-radius: 9px;
  background: #245d86;
  color: #fff;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.manualMpwrSaveButton:disabled {
  background: #d5d9df;
  color: #7f8994;
  cursor: not-allowed;
}

.manualMpwrSuccess,
.manualMpwrError {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
}

.manualMpwrSuccess {
  color: #16834a;
}

.manualMpwrError {
  color: #b42318;
}
`;

css += cssAddition;

fs.writeFileSync(tsxPath, tsx);
fs.writeFileSync(cssPath, css);
console.log("Updated ReadinessTable.tsx and ReadinessShell.module.css.");
console.log("People Count is now at the bottom, directly above Manual MPWR Recovery.");
