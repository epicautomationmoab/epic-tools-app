"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import C360Bridge from "./C360Bridge";
import styles from "./ReadinessShell.module.css";

type HistoricalRow = ReadinessRow & { is_historical?: boolean };

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
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

export default function HistoricalReadinessSearch() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<HistoricalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<HistoricalRow | null>(null);

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
            type="search"
            name="previous-guest-search"
            autoComplete="off"
            inputMode="search"
            className={styles.search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by guest name, confirmation, phone, email, or MPWR..."
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
                  <tr key={row.readiness_id} onClick={() => setSelected(row)} style={{ cursor: "pointer" }}>
                    <td><div className={styles.mainLine}>{formatDateTime(row.visit_start_time)}</div><div className={styles.subLine}>Historical Visit</div></td>
                    <td><div className={styles.mainLine}>{row.customer_name}</div><div className={styles.subLine}>{formatPhone(row.customer_phone) || row.confirmation_code}</div></td>
                    <td><div className={styles.mainLine}>{row.product_display_name}</div>{row.rental_duration ? <div className={styles.subLine}>{row.rental_duration}</div> : null}</td>
                    <td>{row.total_vehicle_count ?? 0}</td>
                    <td>{epicReceived}/{epicExpected}<div className={styles.subLine}>{row.confirmation_code}</div></td>
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

      {selected ? <C360Bridge row={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}
