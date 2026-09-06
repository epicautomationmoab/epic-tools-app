"use client";

import { useMemo, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";
import CustomerJourneyModal from "../CustomerJourneyModal";

function visitLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function JourneyPreviewClient({ rows }: { rows: ReadinessRow[] }) {
  const [selected, setSelected] = useState<ReadinessRow | null>(null);
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.customer_name, row.confirmation_code, row.product_display_name, row.customer_phone]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q)));
  }, [rows, query]);

  return (
    <>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "30px" }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ color: "#e45b22", fontSize: 11, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase" }}>Feature Branch Preview</div>
          <h1 style={{ margin: "4px 0 6px", color: "#202733" }}>Customer Journey Modal</h1>
          <p style={{ margin: 0, color: "#6f7885" }}>This page exists only to test the new guest-record experience before it replaces the live Readiness drawer.</p>
        </div>

        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guest, confirmation, activity, or phone..."
          style={{ width: "100%", maxWidth: 560, padding: "11px 13px", border: "1px solid #d8dfe6", borderRadius: 10, font: "inherit", marginBottom: 16 }}
        />

        <div style={{ background: "#fff", border: "1px solid #dde3e8", borderRadius: 14, overflow: "hidden" }}>
          {visible.map((row) => (
            <button
              key={row.readiness_id || row.confirmation_code}
              type="button"
              onClick={() => setSelected(row)}
              style={{ width: "100%", display: "grid", gridTemplateColumns: "180px 1.2fr 1.5fr 150px", gap: 12, alignItems: "center", padding: "13px 15px", border: 0, borderBottom: "1px solid #eef1f3", background: "#fff", textAlign: "left", cursor: "pointer", color: "#2b3540" }}
            >
              <span style={{ fontSize: 12, color: "#727d89" }}>{visitLabel(row.visit_start_time)}</span>
              <strong>{row.customer_name}</strong>
              <span>{row.product_display_name}</span>
              <span style={{ fontSize: 12, color: "#727d89" }}>{row.confirmation_code}</span>
            </button>
          ))}
          {!visible.length ? <div style={{ padding: 24, color: "#7b8491" }}>No matching reservations.</div> : null}
        </div>
      </div>

      {selected ? <CustomerJourneyModal row={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}
