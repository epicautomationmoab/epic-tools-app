"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadinessRow, VehicleBreakdownItem } from "@/lib/supabase";
import styles from "./ReadinessShell.module.css";

type Filter = "all" | "rental" | "tour";

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function formatDate(value: string) {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(`${match[2]}/${match[3]}/${match[1]}`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function formatPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return value.trim();
}

function docsCounts(row: ReadinessRow) {
  const received = row.epic_document_received_count ?? 0;
  const expected = row.epic_document_expected_count ?? row.expected_guest_count ?? 0;
  return { received, expected };
}

function mpwrCounts(row: ReadinessRow) {
  const received = row.mpwr_document_received_count ?? 0;
  const expected = row.mpwr_document_expected_count ?? (row.requires_mpwr ? row.expected_guest_count ?? 0 : 0);
  return { received, expected };
}

function statusClass(received: number, expected: number) {
  if (expected === 0) return styles.muted;
  if (received >= expected) return styles.good;
  if (received > 0) return styles.warn;
  return styles.bad;
}

function adventureAssureLabel(row: ReadinessRow) {
  if (row.business_line === "tour") return "Tour";
  if (row.premier_adventure_assure === true) return "Premier";
  if (row.adventure_assure_level?.trim().toLowerCase() === "premier") return "Premier";
  return "Standard";
}

function adventureAssureClass(label: string) {
  if (label === "Premier") return styles.assurePremier;
  if (label === "Tour") return styles.assureTour;
  return styles.assureStandard;
}

function OhvCell({ row }: { row: ReadinessRow }) {
  if (row.business_line !== "rental") return <span className={styles.ohvNA}>N/A</span>;
  if (row.ohv_certificate_uploaded) return <span className={styles.ohvGood}>Ready</span>;
  return <span className={styles.ohvBad}>Missing</span>;
}

function linkedValue(value: string, url: string | null | undefined) {
  return url ? <a className={styles.link} href={url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{value}</a> : value;
}

function shortVehicleModel(model: string) {
  return model
    .replace(/^2026\s+/i, "")
    .replace(/Polaris\s+RZR\s+/i, "")
    .replace(/RZR\s+/i, "")
    .replace(/\s+1000\s+Ultimate$/i, "")
    .replace(/Turbo\s+Pro\s+S/i, "Pro S")
    .replace(/XP\s+S/i, "XP S")
    .trim();
}

function validVehicleBreakdown(row: ReadinessRow): VehicleBreakdownItem[] {
  return (row.vehicle_breakdown ?? []).filter((item) => item.quantity > 0 && item.model?.trim());
}

function VehicleCell({ row }: { row: ReadinessRow }) {
  const total = row.total_vehicle_count ?? 0;
  const breakdown = validVehicleBreakdown(row);
  if (row.business_line !== "rental" || breakdown.length === 0) {
    return <span className={styles.count}>{total}</span>;
  }
  return (
    <div className={styles.vehicleCell}>
      <div className={styles.vehicleTotal}>{total} vehicle{total === 1 ? "" : "s"}</div>
      {breakdown.map((item) => (
        <div className={styles.vehicleLine} key={item.model}>{item.quantity} × {shortVehicleModel(item.model)}</div>
      ))}
    </div>
  );
}

function KioskSelect({ row }: { row: ReadinessRow }) {
  const label = row.customer_phone_last_four || "Select";
  return (
    <select
      aria-label={`Send ${row.customer_name} to kiosk`}
      defaultValue=""
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => event.stopPropagation()}
      style={{ width: "100%", minWidth: 92, height: 34, border: "1px solid #dfe4e9", borderRadius: 8, background: "#fff", color: "#202733", fontWeight: 800, padding: "0 10px", cursor: "pointer" }}
    >
      <option value="" disabled>{label}</option>
      {Array.from({ length: 7 }, (_, index) => index + 1).map((kiosk) => (
        <option key={kiosk} value={String(kiosk)}>Kiosk {kiosk}</option>
      ))}
    </select>
  );
}

async function persistNote(readinessId: string, notes: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing.");

  const response = await fetch(`${url}/rest/v1/rpc/save_guest_readiness_note`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_readiness_id: readinessId, p_notes: notes }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Unable to save note.");
  }

  return notes.trim() || null;
}

export default function ReadinessTable({ rows }: { rows: ReadinessRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [localRows, setLocalRows] = useState(rows);
  const [selected, setSelected] = useState<ReadinessRow | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [noteError, setNoteError] = useState("");

  useEffect(() => setLocalRows(rows), [rows]);

  useEffect(() => {
    if (!selected) return;
    setNoteDraft(selected.notes ?? "");
    setNoteStatus("idle");
    setNoteError("");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return localRows.filter((row) => {
      if (filter !== "all" && row.business_line !== filter) return false;
      if (!normalized) return true;
      return [row.customer_name, row.product_display_name, row.confirmation_code, row.customer_phone, row.customer_phone_last_four, row.mpwr_confirmation_number, row.adventure_assure_level, row.notes, ...(row.vehicle_breakdown ?? []).map((item) => item.model)]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [filter, query, localRows]);

  async function saveNote() {
    if (!selected?.readiness_id) {
      setNoteStatus("error");
      setNoteError("This reservation is missing its readiness ID.");
      return;
    }

    setNoteStatus("saving");
    setNoteError("");
    try {
      const saved = await persistNote(selected.readiness_id, noteDraft);
      setLocalRows((current) => current.map((row) => row.readiness_id === selected.readiness_id ? { ...row, notes: saved } : row));
      setSelected((current) => current ? { ...current, notes: saved } : current);
      setNoteDraft(saved ?? "");
      setNoteStatus("saved");
    } catch (error) {
      setNoteStatus("error");
      setNoteError(error instanceof Error ? error.message : "Unable to save note.");
    }
  }

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.filters} aria-label="Reservation type filters">
          {(["all", "rental", "tour"] as const).map((value) => (
            <button key={value} type="button" className={`${styles.filterButton} ${filter === value ? styles.filterButtonActive : ""}`} onClick={() => setFilter(value)}>
              {value === "all" ? "All" : value === "rental" ? "Rentals" : "Tours"}
            </button>
          ))}
        </div>
        <label className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">⌕</span>
          <input className={styles.search} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search guests or activities..." aria-label="Search guests or activities" />
        </label>
      </div>

      <section className={styles.tableCard}>
        <table className={styles.table}>
          <thead><tr><th className={styles.colVisit}>Visit</th><th className={styles.colGuest}>Guest</th><th className={styles.colActivity}>Activity</th><th className={styles.colVehicles}>Vehicles</th><th className={styles.colDocs}>Epic Docs</th><th className={styles.colMpwr}>MPWR</th><th className={styles.colAssure}>Adventure Assure</th><th className={styles.colBalance}>Balance</th><th className={styles.colOhv}>OHV</th><th className={styles.colKiosk}>Send to Kiosk</th><th className={styles.colNotes}>Notes</th></tr></thead>
          <tbody>
            {visibleRows.map((row) => {
              const docs = docsCounts(row);
              const mpwr = mpwrCounts(row);
              const due = row.amount_due_cents ?? 0;
              const assure = adventureAssureLabel(row);
              const phone = formatPhone(row.customer_phone);
              return (
                <tr key={`${row.confirmation_code}-${row.visit_start_time}-${row.product_display_name}`} onClick={() => setSelected(row)}>
                  <td><div className={styles.mainLine}>{formatDate(row.visit_start_time)}</div><div className={styles.subLine}>{formatWallTime(row.visit_start_time)}</div></td>
                  <td><div className={styles.mainLine}>{row.customer_name}</div><div className={styles.subLine}>{phone || row.confirmation_code}</div></td>
                  <td><div className={styles.mainLine}>{row.product_display_name}</div></td>
                  <td><VehicleCell row={row} /></td>
                  <td><div className={styles.statusLine}><span className={`${styles.dot} ${statusClass(docs.received, docs.expected)}`} />{docs.received}/{docs.expected}</div><div className={styles.subLine}>{linkedValue(row.confirmation_code, row.tripworks_booking_url)}</div></td>
                  <td><div className={styles.statusLine}><span className={`${styles.dot} ${statusClass(mpwr.received, mpwr.expected)}`} />{mpwr.received}/{mpwr.expected || "?"}</div><div className={styles.subLine}>{row.mpwr_confirmation_number ? linkedValue(row.mpwr_confirmation_number, row.mpwr_reservation_url) : row.requires_mpwr === false ? "N/A" : "Missing"}</div></td>
                  <td><span className={`${styles.assureBadge} ${adventureAssureClass(assure)}`}>{assure}</span></td>
                  <td><span className={due > 0 ? styles.moneyBad : styles.moneyGood}>{due > 0 ? `$${(due / 100).toFixed(2)}` : "$0"}</span></td>
                  <td><OhvCell row={row} /></td>
                  <td><KioskSelect row={row} /></td>
                  <td className={styles.center}>{row.notes ? <button className={styles.noteButton} type="button" aria-label="Open note" onClick={(event) => { event.stopPropagation(); setSelected(row); }}>▤</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visibleRows.length ? <div className={styles.empty}>No matching reservations.</div> : null}
      </section>

      {selected ? (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={() => setSelected(null)}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`${selected.customer_name} reservation details`} onMouseDown={(event) => event.stopPropagation()}>
            <header className={styles.drawerHeader}><div><p className={styles.drawerEyebrow}>Reservation Details</p><h2>{selected.customer_name}</h2><p>{formatDate(selected.visit_start_time)} · {formatWallTime(selected.visit_start_time)} · {selected.product_display_name}</p></div><button className={styles.drawerClose} type="button" onClick={() => setSelected(null)} aria-label="Close drawer">×</button></header>

            <section className={styles.drawerFacts}>
              <div><span>Confirmation</span><strong>{linkedValue(selected.confirmation_code, selected.tripworks_booking_url)}</strong></div><div><span>Vehicles</span><strong>{selected.total_vehicle_count ?? 0}</strong></div><div><span>Epic Docs</span><strong>{docsCounts(selected).received}/{docsCounts(selected).expected}</strong></div><div><span>MPWR</span><strong>{selected.mpwr_confirmation_number ? linkedValue(selected.mpwr_confirmation_number, selected.mpwr_reservation_url) : "Missing"}</strong></div><div><span>Adventure Assure</span><strong>{adventureAssureLabel(selected)}</strong></div><div><span>Balance</span><strong>{(selected.amount_due_cents ?? 0) > 0 ? `$${((selected.amount_due_cents ?? 0) / 100).toFixed(2)}` : "$0"}</strong></div><div><span>Phone</span><strong>{formatPhone(selected.customer_phone) || "Not available"}</strong></div>
            </section>

            {selected.business_line === "rental" && validVehicleBreakdown(selected).length ? <section className={styles.drawerSection}><h3>Vehicle Breakdown</h3><div className={styles.drawerVehicleList}>{validVehicleBreakdown(selected).map((item) => <div className={styles.drawerVehicleRow} key={item.model}><strong>{item.quantity} ×</strong><span>{item.model}</span></div>)}</div></section> : null}

            <section className={styles.drawerSection}>
              <h3>Important Notes</h3>
              <textarea value={noteDraft} onChange={(event) => { setNoteDraft(event.target.value); setNoteStatus("idle"); }} placeholder="Enter important information for staff..." rows={5} style={{ width: "100%", resize: "vertical", border: "1px solid #dfe4e9", borderRadius: 10, padding: 12, font: "inherit", lineHeight: 1.45 }} />
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
                <button type="button" onClick={saveNote} disabled={noteStatus === "saving"} style={{ border: 0, borderRadius: 8, background: "#d5521d", color: "#fff", fontWeight: 800, padding: "10px 16px", cursor: noteStatus === "saving" ? "wait" : "pointer" }}>{noteStatus === "saving" ? "Saving..." : noteDraft.trim() ? "Save Note" : "Clear Note"}</button>
                {noteStatus === "saved" ? <span style={{ color: "#16834a", fontWeight: 700 }}>Saved</span> : null}
                {noteStatus === "error" ? <span style={{ color: "#b42318" }}>{noteError}</span> : null}
              </div>
            </section>

            <section className={styles.drawerSection}><h3>Epic Waivers</h3>{(selected.epic_document_signers ?? []).length ? <div className={styles.signerList}>{(selected.epic_document_signers ?? []).map((signer, index) => <div className={styles.signerRow} key={`${signer.name}-${index}`}><div><strong>{signer.name}</strong><small>{signer.is_minor_or_child ? "Child — cannot drive" : signer.is_waiver_adult ? "Adult signer" : "Signer"}</small></div>{signer.document_url ? <a href={signer.document_url} target="_blank" rel="noreferrer">Open Waiver</a> : <span>No link</span>}</div>)}</div> : <p className={styles.drawerEmpty}>No Epic waiver records are attached yet.</p>}</section>
          </aside>
        </div>
      ) : null}
    </>
  );
}
