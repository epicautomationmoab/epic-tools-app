"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadinessRow, VehicleBreakdownItem } from "@/lib/supabase";
import styles from "./ReadinessShell.module.css";

type TimeFilter = "all" | "today" | "tomorrow";
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function visitDateKey(value: string) {
  return value.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
}

function formatPhone(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (national.length === 10) {
    return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
  return value.trim();
}

function docsCounts(row: ReadinessRow) {
  const received = row.epic_document_received_count ?? 0;
  const expected =
    row.epic_document_expected_count ?? row.expected_guest_count ?? 0;
  return { received, expected };
}

function mpwrCounts(row: ReadinessRow) {
  const received = row.mpwr_document_received_count ?? 0;
  const expected =
    row.mpwr_document_expected_count ??
    (row.requires_mpwr ? (row.expected_guest_count ?? 0) : 0);
  return { received, expected };
}

function statusClass(received: number, expected: number) {
  if (expected === 0) return styles.muted;
  if (received >= expected) return styles.good;
  if (received > 0) return styles.warn;
  return styles.bad;
}

function drawerStatusCardClass(received: number, expected: number) {
  if (expected === 0) return styles.factNeutral;
  if (received >= expected) return styles.factComplete;
  if (received > 0) return styles.factPartial;
  return styles.factMissing;
}

function adventureAssureLabel(row: ReadinessRow) {
  if (row.business_line === "tour") return "Tour";
  if (row.premier_adventure_assure === true) return "Premier";
  if (row.adventure_assure_level?.trim().toLowerCase() === "premier")
    return "Premier";
  return "Standard";
}

function adventureAssureClass(label: string) {
  if (label === "Premier") return styles.assurePremier;
  if (label === "Tour") return styles.assureTour;
  return styles.assureStandard;
}

function securityDepositDetails(row: ReadinessRow) {
  const assure = adventureAssureLabel(row);

  if (assure === "Tour") {
    return { amount: "N/A", note: null };
  }

  if (assure === "Premier") {
    return {
      amount: "$0*",
      note: "U.S. license only · International license: $1,500",
    };
  }

  return { amount: "$3,000", note: "Standard Adventure Assure" };
}

function OhvCell({ row }: { row: ReadinessRow }) {
  if (row.business_line !== "rental")
    return <span className={styles.ohvNA}>N/A</span>;
  if (row.ohv_certificate_uploaded)
    return <span className={styles.ohvGood}>Ready</span>;
  return <span className={styles.ohvBad}>Missing</span>;
}

function linkedValue(value: string, url: string | null | undefined) {
  return url ? (
    <a
      className={styles.link}
      href={url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
    >
      {value}
    </a>
  ) : (
    value
  );
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
  return (row.vehicle_breakdown ?? []).filter(
    (item) => item.quantity > 0 && item.model?.trim(),
  );
}

function VehicleCell({ row }: { row: ReadinessRow }) {
  const total = row.total_vehicle_count ?? 0;
  const breakdown = validVehicleBreakdown(row);
  if (row.business_line !== "rental" || breakdown.length === 0) {
    return <span className={styles.count}>{total}</span>;
  }
  return (
    <div className={styles.vehicleCell}>
      <div className={styles.vehicleTotal}>
        {total} vehicle{total === 1 ? "" : "s"}
      </div>
      {breakdown.map((item) => (
        <div className={styles.vehicleLine} key={item.model}>
          {item.quantity} × {shortVehicleModel(item.model)}
        </div>
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
      style={{
        width: "100%",
        minWidth: 92,
        height: 34,
        border: "1px solid #dfe4e9",
        borderRadius: 8,
        background: "#fff",
        color: "#202733",
        fontWeight: 800,
        padding: "0 10px",
        cursor: "pointer",
      }}
    >
      <option value="" disabled>
        {label}
      </option>
      {Array.from({ length: 7 }, (_, index) => index + 1).map((kiosk) => (
        <option key={kiosk} value={String(kiosk)}>
          Kiosk {kiosk}
        </option>
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
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_readiness_id: readinessId, p_notes: notes }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Unable to save note.");
  }

  return notes.trim() || null;
}

async function persistHandoff(
  readinessId: string,
  handoffStatus: "checked_in" | "rental_out" | "rental_returned",
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Supabase configuration is missing.");
  }

  const response = await fetch(
    `${url}/rest/v1/rpc/set_epic_operational_handoff`,
    {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_readiness_id: readinessId,
        p_handoff_status: handoffStatus,
        p_recorded_by: "EpicTools",
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Unable to update reservation status.");
  }

  return handoffStatus;
}

export default function ReadinessTable({ rows }: { rows: ReadinessRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("today");
  const [query, setQuery] = useState("");
  const [localRows, setLocalRows] = useState(rows);
  const [selected, setSelected] = useState<ReadinessRow | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteStatus, setNoteStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [noteError, setNoteError] = useState("");
  const [handoffSaving, setHandoffSaving] = useState(false);
  const [handoffError, setHandoffError] = useState("");
  const [editingField, setEditingField] = useState<"phone" | "email" | null>(
    null,
  );
  const [editValue, setEditValue] = useState("");
  const [savingContact, setSavingContact] = useState(false);

  const COURTESY_CALL_STAFF = [
    "Alex",
    "Cody",
    "Jenna",
    "Kim",
    "Lonnie",
    "Maggie",
    "Price",
    "Randy",
    "Taylin",
  ] as const;

  const [courtesyStaff, setCourtesyStaff] = useState("");
  const [arrivalConfirmed, setArrivalConfirmed] = useState(false);
  const [locationDiscussed, setLocationDiscussed] = useState(false);
  const [callOutcome, setCallOutcome] = useState("");
  const [courtesyNotes, setCourtesyNotes] = useState("");

  const [courtesySaving, setCourtesySaving] = useState(false);
  const [courtesyError, setCourtesyError] = useState("");

  const [courtesyCompletion, setCourtesyCompletion] = useState<{
    completedBy: string;
    outcome: string;
    completedAt: Date;
  } | null>(null);

  useEffect(() => setLocalRows(rows), [rows]);

  useEffect(() => {
    if (!selected) return;

    setNoteDraft(selected.notes ?? "");
    setNoteStatus("idle");
    setNoteError("");

    setCourtesyStaff("");
    setArrivalConfirmed(false);
    setLocationDiscussed(false);
    setCallOutcome("");
    setCourtesyNotes("");
    setCourtesyError("");
    if (
      selected.courtesy_call_completed &&
      selected.courtesy_call_completed_by &&
      selected.courtesy_call_outcome &&
      selected.courtesy_call_completed_at
    ) {
      setCourtesyCompletion({
        completedBy: selected.courtesy_call_completed_by,
        outcome: selected.courtesy_call_outcome,
        completedAt: new Date(selected.courtesy_call_completed_at),
      });
    } else {
      setCourtesyCompletion(null);
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected?.readiness_id]);

  const visibleRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const todayKey = localDateKey(today);
    const tomorrowKey = localDateKey(tomorrow);

    return localRows.filter((row) => {
      const rowDate = visitDateKey(row.visit_start_time);

      if (timeFilter === "today" && rowDate !== todayKey) return false;
      if (timeFilter === "tomorrow" && rowDate !== tomorrowKey) return false;

      if (filter !== "all" && row.business_line !== filter) return false;

      if (!normalized) return true;

      return [
        row.customer_name,
        row.product_display_name,
        row.rental_duration,
        row.confirmation_code,
        row.customer_phone,
        row.customer_phone_last_four,
        row.mpwr_confirmation_number,
        row.adventure_assure_level,
        row.notes,
        ...(row.vehicle_breakdown ?? []).map((item) => item.model),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [timeFilter, filter, query, localRows]);
  const outstandingCourtesyCalls = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const tomorrowKey = localDateKey(tomorrow);

    return localRows.filter(
      (row) =>
        visitDateKey(row.visit_start_time) === tomorrowKey &&
        !row.courtesy_call_completed,
    ).length;
  }, [localRows]);

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

      setLocalRows((current) =>
        current.map((row) =>
          row.readiness_id === selected.readiness_id
            ? { ...row, notes: saved }
            : row,
        ),
      );

      setSelected((current) =>
        current ? { ...current, notes: saved } : current,
      );

      setNoteDraft(saved ?? "");
      setNoteStatus("saved");
    } catch (error) {
      setNoteStatus("error");
      setNoteError(
        error instanceof Error ? error.message : "Unable to save note.",
      );
    }
  }

  async function saveHandoff() {
    if (!selected?.readiness_id) {
      setHandoffError("This reservation is missing its readiness ID.");
      return;
    }

    const nextStatus =
      selected.business_line === "tour"
        ? "checked_in"
        : selected.handoff_status === "rental_out"
          ? "rental_returned"
          : "rental_out";

    setHandoffSaving(true);
    setHandoffError("");

    try {
      await persistHandoff(selected.readiness_id, nextStatus);

      setLocalRows((current) =>
        current.map((row) =>
          row.readiness_id === selected.readiness_id
            ? { ...row, handoff_status: nextStatus }
            : row,
        ),
      );

      setSelected((current) =>
        current ? { ...current, handoff_status: nextStatus } : current,
      );
    } catch (error) {
      setHandoffError(
        error instanceof Error
          ? error.message
          : "Unable to update reservation status.",
      );
    } finally {
      setHandoffSaving(false);
    }
  }
  async function saveCourtesyCall() {
    if (!selected?.readiness_id) return;

    setCourtesySaving(true);
    setCourtesyError("");

    try {
      await completeCourtesyCall(
        selected.readiness_id,
        courtesyStaff,
        courtesyNotes,
        arrivalConfirmed,
        locationDiscussed,
        callOutcome,
      );

      const completedAt = new Date();
      const completedAtIso = completedAt.toISOString();

      setLocalRows((current) =>
        current.map((row) =>
          row.readiness_id === selected.readiness_id
            ? {
                ...row,
                courtesy_call_completed: true,
                courtesy_call_completed_by: courtesyStaff,
                courtesy_call_outcome: callOutcome,
                courtesy_call_completed_at: completedAtIso,
              }
            : row,
        ),
      );

      setSelected((current) =>
        current
          ? {
              ...current,
              courtesy_call_completed: true,
              courtesy_call_completed_by: courtesyStaff,
              courtesy_call_outcome: callOutcome,
              courtesy_call_completed_at: completedAtIso,
            }
          : current,
      );

      setCourtesyCompletion({
        completedBy: courtesyStaff,
        outcome: callOutcome,
        completedAt,
      });
    } catch (error) {
      setCourtesyError(
        error instanceof Error
          ? error.message
          : "Unable to save courtesy call.",
      );
    } finally {
      setCourtesySaving(false);
    }
  }
  async function completeCourtesyCall(
    readinessId: string,
    completedBy: string,
    notes: string,
    arrival: boolean,
    location: boolean,
    callOutcome: string,
  ) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Supabase configuration is missing.");
    }

    const response = await fetch(`${url}/rest/v1/rpc/complete_courtesy_call`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_readiness_id: readinessId,
        p_completed_by: completedBy,
        p_notes: notes,
        p_arrival_confirmed: arrival,
        p_location_discussed: location,
        p_call_outcome: callOutcome,
      }),
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }
  }
  const selectedDateKey = selected
    ? visitDateKey(selected.visit_start_time)
    : "";

  const currentDate = new Date();
  const nextDate = new Date(currentDate);
  nextDate.setDate(currentDate.getDate() + 1);

  const selectedIsToday = selectedDateKey === localDateKey(currentDate);

  const selectedIsTomorrow = selectedDateKey === localDateKey(nextDate);

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.courtesyCallSummary}>
          Courtesy Calls Due For Tomorrow: {outstandingCourtesyCalls}
          {outstandingCourtesyCalls === 0 ? " 🎉" : ""}
        </div>

        <div className={styles.filterStack}>
          <div className={styles.filters} aria-label="Time filters">
            {(["all", "today", "tomorrow"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`${styles.filterButton} ${
                  timeFilter === value ? styles.filterButtonActive : ""
                }`}
                onClick={() => setTimeFilter(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "today"
                    ? "Today"
                    : "Tomorrow"}
              </button>
            ))}
          </div>

          <div className={styles.filters} aria-label="Reservation type filters">
            {(["all", "rental", "tour"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={`${styles.filterButton} ${
                  filter === value ? styles.filterButtonActive : ""
                }`}
                onClick={() => setFilter(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "rental"
                    ? "Rentals"
                    : "Tours"}
              </button>
            ))}
          </div>
        </div>

        <label className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            ⌕
          </span>

          <input
            className={styles.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search guests or activities..."
            aria-label="Search guests or activities"
          />

          {query ? (
            <button
              type="button"
              className={styles.searchClear}
              onClick={(event) => {
                event.preventDefault();
                setQuery("");
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
        </label>
      </div>

      <section className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colVisit}>Visit</th>
              <th className={styles.colGuest}>Guest</th>
              <th className={styles.colActivity}>Activity</th>
              <th className={styles.colVehicles}>Vehicles</th>
              <th className={styles.colDocs}>Epic Docs</th>
              <th className={styles.colMpwr}>MPWR</th>
              <th className={styles.colAssure}>Adventure Assure</th>
              <th className={styles.colBalance}>Balance</th>
              <th className={styles.colOhv}>OHV</th>
              <th className={styles.colKiosk}>Send to Kiosk</th>
              <th className={styles.colNotes}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const docs = docsCounts(row);
              const mpwr = mpwrCounts(row);
              const due = row.amount_due_cents ?? 0;
              const assure = adventureAssureLabel(row);
              const phone = formatPhone(row.customer_phone);
              return (
                <tr
                  key={row.readiness_id}
                  className={
                    row.handoff_status === "rental_out"
                      ? styles.rentalOutRow
                      : row.handoff_status === "checked_in" ||
                          row.handoff_status === "rental_returned"
                        ? styles.completedRow
                        : row.courtesy_call_completed
                          ? styles.courtesyCallCompleteRow
                          : undefined
                  }
                  onClick={() => {
                    setSelected(row);
                    setEditingField(null);
                    setEditValue("");
                  }}
                >
                  <td>
                    <div className={styles.mainLine}>
                      {formatDate(row.visit_start_time)}
                    </div>
                    <div className={styles.subLine}>
                      {formatWallTime(row.visit_start_time)}
                    </div>
                  </td>
                  <td>
                    <div className={styles.mainLine}>{row.customer_name}</div>
                    <div className={styles.subLine}>
                      {phone || row.confirmation_code}
                    </div>
                  </td>
                  <td>
                    <div className={styles.mainLine}>
                      {row.product_display_name}
                    </div>
                    {row.business_line === "rental" && row.rental_duration ? (
                      <div className={styles.subLine}>
                        {row.rental_duration}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <VehicleCell row={row} />
                  </td>
                  <td>
                    <div
                      className={`${styles.statusLine} ${docs.expected > 0 && docs.received >= docs.expected ? styles.waiversComplete : ""}`}
                    >
                      <span
                        className={`${styles.dot} ${statusClass(docs.received, docs.expected)}`}
                      />
                      {docs.received}/{docs.expected}
                    </div>
                    <div className={styles.subLine}>
                      {linkedValue(
                        row.confirmation_code,
                        row.tripworks_booking_url,
                      )}
                    </div>
                  </td>
                  <td>
                    <div
                      className={`${styles.statusLine} ${mpwr.expected > 0 && mpwr.received >= mpwr.expected ? styles.waiversComplete : ""}`}
                    >
                      <span
                        className={`${styles.dot} ${statusClass(mpwr.received, mpwr.expected)}`}
                      />
                      {mpwr.received}/{mpwr.expected || "?"}
                    </div>
                    <div className={styles.subLine}>
                      {row.mpwr_confirmation_number
                        ? linkedValue(
                            row.mpwr_confirmation_number,
                            row.mpwr_reservation_url,
                          )
                        : row.requires_mpwr === false
                          ? "N/A"
                          : "Missing"}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`${styles.assureBadge} ${adventureAssureClass(assure)}`}
                    >
                      {assure}
                    </span>
                  </td>
                  <td>
                    <span
                      className={due > 0 ? styles.moneyBad : styles.moneyGood}
                    >
                      {due > 0 ? `$${(due / 100).toFixed(2)}` : "$0"}
                    </span>
                  </td>
                  <td>
                    <OhvCell row={row} />
                  </td>
                  <td>
                    <KioskSelect row={row} />
                  </td>
                  <td className={styles.center}>
                    {row.notes ? (
                      <button
                        className={styles.noteButton}
                        type="button"
                        aria-label="Open note"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelected(row);
                          setEditingField(null);
                          setEditValue("");
                        }}
                      >
                        ▤
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!visibleRows.length ? (
          <div className={styles.empty}>No matching reservations.</div>
        ) : null}
      </section>

      {selected ? (
        <div
          className={styles.drawerBackdrop}
          role="presentation"
          onMouseDown={() => setSelected(null)}
        >
          <aside
            className={styles.drawer}
            role="dialog"
            aria-modal="true"
            aria-label={`${selected.customer_name} reservation details`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.drawerHeader}>
              <div>
                <p className={styles.drawerEyebrow}>Reservation Details</p>
                <h2>{selected.customer_name}</h2>
                <p>
                  <p>
                    {formatDate(selected.visit_start_time)} ·{" "}
                    {formatWallTime(selected.visit_start_time)} ·{" "}
                    {selected.product_display_name}
                    {selected.business_line === "rental" &&
                      selected.rental_duration && (
                        <>
                          {" · "}
                          <strong>{selected.rental_duration}</strong>
                        </>
                      )}
                  </p>
                </p>

                {selected.guest_portal_token ? (
                  <a
                    className={styles.guestPortalButton}
                    href={`/guest/${selected.guest_portal_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Guest Portal
                  </a>
                ) : null}
              </div>
              <button
                className={styles.drawerClose}
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close drawer"
              >
                ×
              </button>
            </header>

            <section className={styles.drawerFacts}>
              <div>
                <span>Booking Confirmation</span>
                <strong>
                  {linkedValue(
                    selected.confirmation_code,
                    selected.tripworks_booking_url,
                  )}
                </strong>
              </div>

              <div>
                <span>MPWR Confirmation</span>
                <strong>
                  {selected.mpwr_confirmation_number
                    ? linkedValue(
                        selected.mpwr_confirmation_number,
                        selected.mpwr_reservation_url,
                      )
                    : "Missing"}
                </strong>
              </div>

              <div
                className={drawerStatusCardClass(
                  docsCounts(selected).received,
                  docsCounts(selected).expected,
                )}
              >
                <span>Epic Docs</span>
                <strong
                  className={
                    docsCounts(selected).expected > 0 &&
                    docsCounts(selected).received >=
                      docsCounts(selected).expected
                      ? styles.drawerCompleteValue
                      : undefined
                  }
                >
                  {docsCounts(selected).received}/
                  {docsCounts(selected).expected}
                </strong>
              </div>

              <div
                className={drawerStatusCardClass(
                  mpwrCounts(selected).received,
                  mpwrCounts(selected).expected,
                )}
              >
                <span>MPWR Waivers</span>
                <strong
                  className={
                    mpwrCounts(selected).expected > 0 &&
                    mpwrCounts(selected).received >=
                      mpwrCounts(selected).expected
                      ? styles.drawerCompleteValue
                      : undefined
                  }
                >
                  {mpwrCounts(selected).received}/
                  {mpwrCounts(selected).expected || "?"}
                </strong>
              </div>

              <div>
                <span>Adventure Assure</span>
                <strong>{adventureAssureLabel(selected)}</strong>
              </div>

              <div>
                <span>Security Deposit</span>
                <strong>
                  {linkedValue(
                    securityDepositDetails(selected).amount,
                    selected.mpwr_reservation_url,
                  )}
                </strong>
                {securityDepositDetails(selected).note ? (
                  <small className={styles.depositNote}>
                    {securityDepositDetails(selected).note}
                  </small>
                ) : null}
              </div>

              <div
                className={
                  (selected.amount_due_cents ?? 0) > 0
                    ? styles.balanceDue
                    : styles.balancePaid
                }
              >
                <span>Balance</span>
                <strong>
                  {linkedValue(
                    (selected.amount_due_cents ?? 0) > 0
                      ? `$${((selected.amount_due_cents ?? 0) / 100).toFixed(2)}`
                      : "$0",
                    selected.tripworks_booking_url,
                  )}
                </strong>
              </div>

              <div>
                {editingField === "phone" ? (
                  <div className={styles.contactEditRow}>
                    <input
                      className={styles.contactEditInput}
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      autoFocus
                    />

                    <button
                      type="button"
                      className={styles.contactSaveButton}
                      disabled={savingContact}
                    >
                      {savingContact ? "Saving..." : "Save"}
                    </button>

                    <button
                      type="button"
                      className={styles.contactCancelButton}
                      onClick={() => {
                        setEditingField(null);
                        setEditValue("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className={styles.contactLabelInline}>
                      <span>Phone</span>
                      <button
                        type="button"
                        className={styles.contactEditButton}
                        aria-label="Edit phone"
                        onClick={() => {
                          setEditingField("phone");
                          setEditValue(selected.customer_phone || "");
                        }}
                      >
                        ✎
                      </button>
                    </span>

                    <strong>
                      {formatPhone(selected.customer_phone) || "Not available"}
                    </strong>
                  </>
                )}
              </div>

              <div className={styles.drawerFactWide}>
                {editingField === "email" ? (
                  <div className={styles.contactEditRow}>
                    <input
                      className={styles.contactEditInput}
                      type="email"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      autoFocus
                    />

                    <button
                      type="button"
                      className={styles.contactSaveButton}
                      disabled={savingContact}
                    >
                      {savingContact ? "Saving..." : "Save"}
                    </button>

                    <button
                      type="button"
                      className={styles.contactCancelButton}
                      onClick={() => {
                        setEditingField(null);
                        setEditValue("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <span className={styles.contactLabelInline}>
                      <span>Email</span>
                      <button
                        type="button"
                        className={styles.contactEditButton}
                        aria-label="Edit email"
                        onClick={() => {
                          setEditingField("email");
                          setEditValue(selected.customer_email || "");
                        }}
                      >
                        ✎
                      </button>
                    </span>

                    <strong>
                      {selected.customer_email || "Not available"}
                    </strong>
                  </>
                )}
              </div>
            </section>

            {selected.business_line === "rental" &&
            validVehicleBreakdown(selected).length ? (
              <section
                className={`${styles.drawerSection} ${styles.vehicleSummarySection}`}
              >
                <h3>Vehicle Summary</h3>
                <div className={styles.drawerVehicleList}>
                  {validVehicleBreakdown(selected).map((item) => (
                    <div className={styles.drawerVehicleRow} key={item.model}>
                      <strong>{item.quantity} ×</strong>
                      <span>{item.model}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {selectedIsToday ? (
              <section className={styles.handoffAction}>
                <button
                  type="button"
                  className={styles.handoffButton}
                  disabled={
                    handoffSaving ||
                    (selected.amount_due_cents ?? 0) > 0 ||
                    selected.handoff_status === "checked_in" ||
                    selected.handoff_status === "rental_returned"
                  }
                  onClick={saveHandoff}
                >
                  {handoffSaving
                    ? "Saving..."
                    : selected.business_line === "tour"
                      ? selected.handoff_status === "checked_in"
                        ? "Checked In"
                        : "Checked In"
                      : selected.handoff_status === "rental_out"
                        ? "Rental Returned"
                        : selected.handoff_status === "rental_returned"
                          ? "Rental Returned"
                          : "Rental Out"}
                </button>

                {(selected.amount_due_cents ?? 0) > 0 ? (
                  <p className={styles.handoffBlocked}>
                    Balance must be paid first.
                  </p>
                ) : null}

                {handoffError ? (
                  <p className={styles.handoffBlocked}>{handoffError}</p>
                ) : null}
              </section>
            ) : selectedIsTomorrow ? (
              <section className={styles.handoffAction}>
                {courtesyCompletion ? (
                  <div className={styles.courtesyComplete}>
                    <div className={styles.courtesyCompleteTitle}>
                      ✅ Courtesy Call Complete
                    </div>

                    <div className={styles.courtesyCompleteOutcome}>
                      {courtesyCompletion.outcome === "live_call"
                        ? "Live Call Completed"
                        : courtesyCompletion.outcome === "voicemail_left"
                          ? "Voicemail Left"
                          : courtesyCompletion.outcome ===
                              "unable_to_leave_voicemail"
                            ? "Unable to Leave Voicemail"
                            : courtesyCompletion.outcome ===
                                "international_no_call"
                              ? "International Number — No Call"
                              : courtesyCompletion.outcome}
                    </div>

                    <div className={styles.courtesyCompleteDetail}>
                      {courtesyCompletion.completedBy}
                    </div>

                    <div className={styles.courtesyCompleteDetail}>
                      {courtesyCompletion.completedAt.toLocaleString("en-US", {
                        month: "2-digit",
                        day: "2-digit",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.courtesyHeader}>
                      <strong>Courtesy Call</strong>

                      <p className={styles.subLine}>
                        Prepare this guest for tomorrow.
                      </p>
                    </div>

                    <div className={styles.courtesyForm}>
                      <label className={styles.courtesyField}>
                        <span>Completed by</span>

                        <select
                          value={courtesyStaff}
                          onChange={(event) =>
                            setCourtesyStaff(event.target.value)
                          }
                        >
                          <option value="">Select team member...</option>

                          {COURTESY_CALL_STAFF.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className={styles.courtesyField}>
                        <span>Call outcome</span>

                        <select
                          value={callOutcome}
                          onChange={(event) =>
                            setCallOutcome(event.target.value)
                          }
                        >
                          <option value="">Select call outcome...</option>
                          <option value="live_call">Live call completed</option>
                          <option value="voicemail_left">Voicemail left</option>
                          <option value="unable_to_leave_voicemail">
                            Unable to leave voicemail
                          </option>
                          <option value="international_no_call">
                            International number — no call
                          </option>
                        </select>
                      </label>

                      {callOutcome === "live_call" ||
                      callOutcome === "voicemail_left" ? (
                        <>
                          <label className={styles.courtesyCheck}>
                            <input
                              type="checkbox"
                              checked={arrivalConfirmed}
                              onChange={(event) =>
                                setArrivalConfirmed(event.target.checked)
                              }
                            />

                            <span>Arrival time confirmed</span>
                          </label>

                          <label className={styles.courtesyCheck}>
                            <input
                              type="checkbox"
                              checked={locationDiscussed}
                              onChange={(event) =>
                                setLocationDiscussed(event.target.checked)
                              }
                            />

                            <span>Location Confirmed</span>
                          </label>
                        </>
                      ) : null}

                      <label className={styles.courtesyField}>
                        <span>Notes</span>

                        <textarea
                          value={courtesyNotes}
                          onChange={(event) =>
                            setCourtesyNotes(event.target.value)
                          }
                          placeholder="Optional notes..."
                          rows={4}
                        />
                      </label>

                      <button
                        type="button"
                        className={styles.handoffButton}
                        onClick={saveCourtesyCall}
                        disabled={
                          courtesySaving ||
                          !courtesyStaff ||
                          !callOutcome ||
                          (callOutcome === "live_call" &&
                            (!arrivalConfirmed || !locationDiscussed))
                        }
                      >
                        {courtesySaving
                          ? "Saving..."
                          : "Complete Courtesy Call"}
                      </button>

                      {courtesyError ? (
                        <p className={styles.handoffBlocked}>{courtesyError}</p>
                      ) : null}
                    </div>
                  </>
                )}
              </section>
            ) : null}

            <section
              className={`${styles.drawerSection} ${styles.notesSection}`}
            >
              <h3>Important Notes</h3>

              <textarea
                value={noteDraft}
                onChange={(event) => {
                  setNoteDraft(event.target.value);
                  setNoteStatus("idle");
                }}
                placeholder="Enter important information for staff..."
                rows={5}
                style={{
                  width: "100%",
                  resize: "vertical",
                  border: "1px solid #dfe4e9",
                  borderRadius: 10,
                  padding: 12,
                  font: "inherit",
                  lineHeight: 1.45,
                }}
              />

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 10,
                }}
              >
                {noteDraft !== (selected.notes ?? "") ? (
                  <button
                    type="button"
                    onClick={saveNote}
                    disabled={noteStatus === "saving"}
                    style={{
                      border: 0,
                      borderRadius: 8,
                      background: "#d5521d",
                      color: "#fff",
                      fontWeight: 800,
                      padding: "10px 16px",
                      cursor: noteStatus === "saving" ? "wait" : "pointer",
                    }}
                  >
                    {noteStatus === "saving" ? "Saving..." : "Save Note"}
                  </button>
                ) : null}

                {(selected.notes ?? "").trim() ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setNoteDraft("");
                      setNoteStatus("saving");
                      setNoteError("");

                      try {
                        const saved = await persistNote(
                          selected.readiness_id!,
                          "",
                        );

                        setLocalRows((current) =>
                          current.map((row) =>
                            row.readiness_id === selected.readiness_id
                              ? { ...row, notes: saved }
                              : row,
                          ),
                        );

                        setSelected((current) =>
                          current ? { ...current, notes: saved } : current,
                        );

                        setNoteDraft("");
                        setNoteStatus("saved");
                      } catch (error) {
                        setNoteStatus("error");
                        setNoteError(
                          error instanceof Error
                            ? error.message
                            : "Unable to clear note.",
                        );
                      }
                    }}
                    disabled={noteStatus === "saving"}
                    style={{
                      border: "1px solid #d5521d",
                      borderRadius: 8,
                      background: "#fff",
                      color: "#d5521d",
                      fontWeight: 800,
                      padding: "10px 16px",
                      cursor: noteStatus === "saving" ? "wait" : "pointer",
                    }}
                  >
                    Clear Note
                  </button>
                ) : null}

                {noteStatus === "saved" ? (
                  <span style={{ color: "#16834a", fontWeight: 700 }}>
                    Saved
                  </span>
                ) : null}

                {noteStatus === "error" ? (
                  <span style={{ color: "#b42318" }}>{noteError}</span>
                ) : null}
              </div>
            </section>

            <section
              className={`${styles.drawerSection} ${styles.epicDocumentsSection}`}
            >
              <h3>
                Epic Documents
                <span className={styles.sectionCount}>
                  {(selected.epic_document_signers ?? []).length}
                </span>
              </h3>

              {(selected.epic_document_signers ?? []).length ? (
                <div className={styles.signerList}>
                  {(selected.epic_document_signers ?? []).map(
                    (signer, index) => (
                      <div
                        className={styles.signerRow}
                        key={`${signer.name}-${index}`}
                      >
                        <strong className={styles.signerName}>
                          {signer.name}
                        </strong>
                        <small className={styles.signerRole}>
                          {signer.is_minor_or_child
                            ? "Minor"
                            : signer.is_waiver_adult
                              ? "Adult Signer"
                              : "Signer"}
                        </small>
                        {signer.document_url ? (
                          <a
                            href={signer.document_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Waiver
                          </a>
                        ) : (
                          <span className={styles.signerNoLink}>No link</span>
                        )}
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <p className={styles.drawerEmpty}>
                  No Epic document records were received.
                </p>
              )}
            </section>

            <section
              className={`${styles.drawerSection} ${styles.mpwrWaiversSection}`}
            >
              <h3>
                MPWR Waivers
                <span className={styles.sectionCount}>
                  {(selected.mpwr_waivers ?? []).length}
                </span>
              </h3>

              {(selected.mpwr_waivers ?? []).length ? (
                <div className={styles.signerList}>
                  {(selected.mpwr_waivers ?? []).map((waiver, index) => (
                    <div
                      className={styles.signerRow}
                      key={`${waiver.name}-${index}`}
                    >
                      <strong className={styles.signerName}>
                        {waiver.name}
                      </strong>
                      <small className={styles.signerRole}>
                        {waiver.is_minor
                          ? "Minor"
                          : waiver.is_passenger
                            ? "Passenger"
                            : "Driver"}
                      </small>
                      {waiver.document_url ? (
                        <a
                          href={waiver.document_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Waiver
                        </a>
                      ) : (
                        <span className={styles.signerNoLink}>No link</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.drawerEmpty}>
                  No MPWR waiver records were received.
                </p>
              )}
            </section>
          </aside>
        </div>
      ) : null}
    </>
  );
}