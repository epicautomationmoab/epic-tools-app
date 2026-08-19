"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ReadinessShell.module.css";

type HistoricalRow = {
  readiness_id: string;
  source_store_visit_id?: string | null;
  confirmation_code: string;
  visit_start_time: string;
  customer_name: string;
  customer_email?: string | null;
  customer_phone?: string | null;
  customer_phone_last_four?: string | null;
  business_line: string;
  product_display_name: string;
  rental_duration?: string | null;
  expected_guest_count: number | null;
  total_vehicle_count?: number | null;
  vehicle_breakdown?: Array<{ model: string; quantity: number }> | null;
  epic_document_received_count?: number | null;
  epic_document_expected_count?: number | null;
  mpwr_document_received_count?: number | null;
  mpwr_document_expected_count?: number | null;
  mpwr_confirmation_number: string | null;
  mpwr_waiver_url?: string | null;
  mpwr_reservation_url?: string | null;
  amount_due_cents: number | null;
  premier_adventure_assure?: boolean | null;
  adventure_assure_level?: string | null;
  ohv_required?: boolean | null;
  ohv_certificate_uploaded?: boolean | null;
  tripworks_booking_url?: string | null;
  notes?: string | null;
  handoff_status?: string | null;
  courtesy_call_completed?: boolean;
  courtesy_call_completed_by?: string | null;
  courtesy_call_completed_at?: string | null;
  courtesy_call_notes?: string | null;
  courtesy_call_outcome?: string | null;
  is_historical?: boolean;
  epic_document_signers?: Array<{
    name: string;
    document_url?: string | null;
    is_minor_or_child?: boolean | null;
    is_waiver_adult?: boolean | null;
  }> | null;
  mpwr_waivers?: Array<{
    name: string;
    email?: string | null;
    document_url?: string | null;
    is_minor?: boolean | null;
    is_passenger?: boolean | null;
  }> | null;
};

type HistoricalDetail = {
  cancellation_requests: Array<Record<string, unknown>>;
  cancellation_acceptances: Array<Record<string, unknown>>;
  staff_notes: Array<Record<string, unknown>>;
  handoffs: Array<Record<string, unknown>>;
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function formatPhone(value?: string | null) {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return value;
}

function asText(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function linked(value: string, url?: string | null) {
  return url ? <a className={styles.link} href={url} target="_blank" rel="noreferrer">{value}</a> : value;
}

function adventureAssureLabel(row: HistoricalRow) {
  if (row.business_line === "tour") return "Tour";
  if (row.premier_adventure_assure === true) return "Premier";
  if (row.adventure_assure_level?.trim().toLowerCase() === "premier") return "Premier";
  return "Standard";
}

function securityDeposit(row: HistoricalRow) {
  const assure = adventureAssureLabel(row);
  if (assure === "Tour") return "N/A";
  if (assure === "Premier") return "$0";
  const vehicleCount = Math.max(row.total_vehicle_count ?? 0, 1);
  return `$${(vehicleCount * 3000).toLocaleString("en-US")}`;
}

export default function HistoricalReadinessSearch() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<HistoricalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<HistoricalRow | null>(null);
  const [detail, setDetail] = useState<HistoricalDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setRows([]);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/team/readiness-history?q=${encodeURIComponent(normalized)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = (await response.json()) as { rows?: HistoricalRow[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to search history.");
        setRows(data.rows ?? []);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(caught instanceof Error ? caught.message : "Unable to search history.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    setDetailLoading(true);
    fetch(`/api/team/readiness-history/${encodeURIComponent(selected.readiness_id)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as HistoricalDetail & { error?: string };
        if (!response.ok) throw new Error(data.error || "Unable to load historical details.");
        if (!cancelled) setDetail(data);
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load historical details.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.readiness_id]);

  const historicalRows = useMemo(() => rows.filter((row) => row.is_historical), [rows]);

  return (
    <section style={{ marginBottom: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "#667085", marginBottom: 6 }}>
          Search Previous Guests
        </div>
        <label className={styles.searchWrap} style={{ display: "block", maxWidth: "none" }}>
          <span className={styles.searchIcon} aria-hidden="true">⌕</span>
          <input
            className={styles.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by guest name, confirmation, phone, email, activity, or MPWR..."
            aria-label="Search previous guests"
          />
          {query ? (
            <button type="button" className={styles.searchClear} onClick={() => setQuery("")} aria-label="Clear search">×</button>
          ) : null}
        </label>
      </div>

      {loading ? <div style={{ padding: "10px 0", color: "#667085" }}>Searching previous guests…</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}
      {query.trim().length >= 2 && !loading && historicalRows.length === 0 && !error ? (
        <div className={styles.empty}>No previous Store Visits found.</div>
      ) : null}

      {historicalRows.length ? (
        <section className={styles.tableCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Visit</th>
                <th>Guest</th>
                <th>Activity</th>
                <th>Vehicles</th>
                <th>Epic Docs</th>
                <th>MPWR</th>
                <th>Balance</th>
                <th>Courtesy Call</th>
              </tr>
            </thead>
            <tbody>
              {historicalRows.map((row) => {
                const epicReceived = row.epic_document_received_count ?? 0;
                const epicExpected = row.epic_document_expected_count ?? row.expected_guest_count ?? 0;
                const mpwrReceived = row.mpwr_document_received_count ?? 0;
                const mpwrExpected = row.mpwr_document_expected_count ?? row.expected_guest_count ?? 0;
                return (
                  <tr key={row.readiness_id} onClick={() => setSelected(row)}>
                    <td><div className={styles.mainLine}>{formatDateTime(row.visit_start_time)}</div><div className={styles.subLine}>Historical Visit</div></td>
                    <td><div className={styles.mainLine}>{row.customer_name}</div><div className={styles.subLine}>{formatPhone(row.customer_phone) || row.confirmation_code}</div></td>
                    <td><div className={styles.mainLine}>{row.product_display_name}</div>{row.rental_duration ? <div className={styles.subLine}>{row.rental_duration}</div> : null}</td>
                    <td>{row.total_vehicle_count ?? 0}</td>
                    <td>{epicReceived}/{epicExpected}</td>
                    <td>{mpwrExpected > 0 ? `${mpwrReceived}/${mpwrExpected}` : "N/A"}{row.mpwr_confirmation_number ? <div className={styles.subLine}>{row.mpwr_confirmation_number}</div> : null}</td>
                    <td>{(row.amount_due_cents ?? 0) > 0 ? `$${((row.amount_due_cents ?? 0) / 100).toFixed(2)}` : "$0"}</td>
                    <td>{row.courtesy_call_completed ? <><div className={styles.mainLine}>Completed</div><div className={styles.subLine}>{row.courtesy_call_completed_by || "Recorded"}</div></> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {selected ? (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={() => setSelected(null)}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`${selected.customer_name} historical reservation details`} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.drawerHeader}>
              <div>
                <p className={styles.drawerEyebrow}>Historical Visit</p>
                <h2>{selected.customer_name}</h2>
                <p>{formatDateTime(selected.visit_start_time)} · {selected.product_display_name}{selected.rental_duration ? ` · ${selected.rental_duration}` : ""}</p>
              </div>
              <button className={styles.drawerClose} type="button" onClick={() => setSelected(null)} aria-label="Close drawer">×</button>
            </header>

            <section className={styles.drawerFacts}>
              <div><span>Booking Confirmation</span><strong>{linked(selected.confirmation_code, selected.tripworks_booking_url)}</strong></div>
              <div><span>MPWR Confirmation</span><strong>{selected.mpwr_confirmation_number ? linked(selected.mpwr_confirmation_number, selected.mpwr_reservation_url) : "N/A"}</strong></div>
              <div><span>Epic Docs</span><strong>{selected.epic_document_received_count ?? 0}/{selected.epic_document_expected_count ?? selected.expected_guest_count ?? 0}</strong></div>
              <div><span>MPWR Waivers</span><strong>{selected.mpwr_document_received_count ?? 0}/{selected.mpwr_document_expected_count ?? selected.expected_guest_count ?? 0}</strong></div>
              <div><span>Adventure Assure</span><strong>{adventureAssureLabel(selected)}</strong></div>
              <div><span>Security Deposit</span><strong>{securityDeposit(selected)}</strong></div>
              <div><span>Balance</span><strong>{(selected.amount_due_cents ?? 0) > 0 ? `$${((selected.amount_due_cents ?? 0) / 100).toFixed(2)}` : "$0"}</strong></div>
              <div><span>Handoff</span><strong>{selected.handoff_status ? selected.handoff_status.replaceAll("_", " ") : "—"}</strong></div>
            </section>

            <section className={styles.drawerSection}>
              <h3>Guest</h3>
              <div className={styles.drawerVehicleList}>
                <div className={styles.drawerVehicleRow}><strong>Phone</strong><span>{formatPhone(selected.customer_phone) || "—"}</span></div>
                <div className={styles.drawerVehicleRow}><strong>Email</strong><span>{selected.customer_email || "—"}</span></div>
              </div>
            </section>

            <section className={styles.drawerSection}>
              <h3>Vehicles</h3>
              <div className={styles.drawerVehicleList}>
                {selected.vehicle_breakdown?.length ? selected.vehicle_breakdown.map((vehicle) => (
                  <div className={styles.drawerVehicleRow} key={vehicle.model}><strong>{vehicle.quantity}×</strong><span>{vehicle.model}</span></div>
                )) : <div className={styles.drawerVehicleRow}><strong>{selected.total_vehicle_count ?? 0}</strong><span>vehicle{(selected.total_vehicle_count ?? 0) === 1 ? "" : "s"}</span></div>}
              </div>
            </section>

            <section className={styles.drawerSection}>
              <h3>Courtesy Call</h3>
              {selected.courtesy_call_completed ? (
                <div className={styles.drawerVehicleList}>
                  <div className={styles.drawerVehicleRow}><strong>Completed</strong><span>{selected.courtesy_call_completed_by || "Staff"}{selected.courtesy_call_completed_at ? ` · ${formatDateTime(selected.courtesy_call_completed_at)}` : ""}</span></div>
                  {selected.courtesy_call_outcome ? <div className={styles.drawerVehicleRow}><strong>Outcome</strong><span>{selected.courtesy_call_outcome}</span></div> : null}
                  {selected.courtesy_call_notes ? <div className={styles.drawerVehicleRow}><strong>Notes</strong><span>{selected.courtesy_call_notes}</span></div> : null}
                </div>
              ) : <div>None recorded.</div>}
            </section>

            <section className={styles.drawerSection}>
              <h3>Epic Waivers</h3>
              <div className={styles.drawerVehicleList}>
                {selected.epic_document_signers?.length ? selected.epic_document_signers.map((signer, index) => (
                  <div className={styles.drawerVehicleRow} key={`${signer.name}-${index}`}><strong>{signer.is_minor_or_child ? "Minor" : "Signed"}</strong><span>{signer.document_url ? <a href={signer.document_url} target="_blank" rel="noreferrer">{signer.name}</a> : signer.name}</span></div>
                )) : <div>None recorded.</div>}
              </div>
            </section>

            <section className={styles.drawerSection}>
              <h3>MPWR Waivers</h3>
              <div className={styles.drawerVehicleList}>
                {selected.mpwr_waivers?.length ? selected.mpwr_waivers.map((waiver, index) => (
                  <div className={styles.drawerVehicleRow} key={`${waiver.name}-${index}`}><strong>{waiver.is_minor ? "Minor" : waiver.is_passenger ? "Passenger" : "Signed"}</strong><span>{waiver.document_url ? <a href={waiver.document_url} target="_blank" rel="noreferrer">{waiver.name}</a> : waiver.name}</span></div>
                )) : <div>None recorded.</div>}
              </div>
            </section>

            <section className={styles.drawerSection}>
              <h3>Cancellation Policy Acknowledgement</h3>
              {detailLoading ? <div>Loading acknowledgement…</div> : null}
              {!detailLoading && detail?.cancellation_acceptances?.length ? detail.cancellation_acceptances.map((acceptance, index) => (
                <div className={styles.drawerVehicleList} key={asText(acceptance.id) || index} style={{ marginBottom: 10 }}>
                  <div className={styles.drawerVehicleRow}><strong>Accepted</strong><span>{asText(acceptance.signer_name) || selected.customer_name}{acceptance.accepted_at ? ` · ${formatDateTime(asText(acceptance.accepted_at))}` : ""}</span></div>
                  {acceptance.policy_title ? <div className={styles.drawerVehicleRow}><strong>Policy</strong><span>{asText(acceptance.policy_title)}{acceptance.policy_version ? ` · v${asText(acceptance.policy_version)}` : ""}</span></div> : null}
                  {acceptance.acceptance_statement ? <div className={styles.drawerVehicleRow}><strong>Statement</strong><span>{asText(acceptance.acceptance_statement)}</span></div> : null}
                </div>
              )) : !detailLoading ? <div>No accepted cancellation acknowledgement recorded.</div> : null}

              {detail?.cancellation_requests?.length ? (
                <details style={{ marginTop: 12 }}>
                  <summary>View acknowledgement history</summary>
                  <div className={styles.drawerVehicleList} style={{ marginTop: 10 }}>
                    {detail.cancellation_requests.map((request, index) => (
                      <div className={styles.drawerVehicleRow} key={asText(request.id) || index}><strong>{asText(request.status) || "Recorded"}</strong><span>{asText(request.sent_by) || "Staff"}{request.sent_at ? ` · ${formatDateTime(asText(request.sent_at))}` : ""}</span></div>
                    ))}
                  </div>
                </details>
              ) : null}
            </section>

            <section className={styles.drawerSection}>
              <h3>Notes</h3>
              {selected.notes ? <div style={{ marginBottom: 10 }}>{selected.notes}</div> : null}
              {detail?.staff_notes?.length ? (
                <div className={styles.drawerVehicleList}>
                  {detail.staff_notes.map((note, index) => (
                    <div className={styles.drawerVehicleRow} key={asText(note.note_id) || index}><strong>{asText(note.created_by) || "Staff"}</strong><span>{asText(note.note_text)}</span></div>
                  ))}
                </div>
              ) : !selected.notes ? <div>None recorded.</div> : null}
            </section>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
