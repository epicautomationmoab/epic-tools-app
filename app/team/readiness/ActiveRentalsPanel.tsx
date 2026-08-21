"use client";

import { useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";

function formatStart(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!match) return value;
  const [, year, month, day, hourText, minute] = match;
  let hour = Number(hourText);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  const date = new Date(`${month}/${day}/${year}`);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  return `${dateLabel} · ${hour}:${minute} ${suffix}`;
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

function vehicleLabel(row: ReadinessRow) {
  const breakdown = (row.vehicle_breakdown ?? []).filter(
    (item) => item.quantity > 0 && item.model?.trim(),
  );
  if (breakdown.length > 0) {
    return breakdown
      .map((item) => `${item.quantity} × ${shortVehicleModel(item.model)}`)
      .join(", ");
  }
  const count = Math.max(row.total_vehicle_count ?? 1, 1);
  return `${count} vehicle${count === 1 ? "" : "s"}`;
}

async function markRentalReturned(readinessId: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing.");

  const response = await fetch(`${url}/rest/v1/rpc/set_epic_operational_handoff`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_readiness_id: readinessId,
      p_handoff_status: "rental_returned",
      p_recorded_by: "EpicTools",
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Unable to mark rental returned.");
  }
}

export default function ActiveRentalsPanel({ rows }: { rows: ReadinessRow[] }) {
  const [returnedIds, setReturnedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const heldOverRows = rows.filter(
    (row) => row.readiness_id && !returnedIds.has(row.readiness_id),
  );

  return (
    <section
      aria-label="Held-Over Rentals"
      style={{
        border: "1px solid #d9dee6",
        borderRadius: 12,
        background: "#fff",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "14px 16px",
          borderBottom: "1px solid #e7ebf0",
          background: "#f8fafc",
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#202733" }}>
            Held-Over Rentals
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: "#6b7280" }}>
            Prior-day rentals not marked Rental Returned
          </div>
        </div>
        <div
          style={{
            minWidth: 30,
            height: 30,
            padding: "0 9px",
            borderRadius: 999,
            display: "grid",
            placeItems: "center",
            background: heldOverRows.length ? "#ffc107" : "#eceff3",
            color: "#202733",
            fontWeight: 900,
            fontSize: 13,
          }}
        >
          {heldOverRows.length}
        </div>
      </div>

      {error ? (
        <div style={{ padding: "10px 14px", color: "#a61b1b", fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      ) : null}

      {heldOverRows.length === 0 ? (
        <div style={{ padding: "14px 16px", color: "#7a7f87", fontSize: 13 }}>
          No held-over rentals.
        </div>
      ) : (
        <div>
          {heldOverRows.map((row, index) => {
            const readinessId = row.readiness_id!;
            return (
              <div
                key={readinessId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(180px,1.25fr) minmax(170px,1fr) minmax(155px,.8fr) auto",
                  gap: 14,
                  alignItems: "center",
                  padding: "12px 14px",
                  borderTop: index === 0 ? "none" : "1px solid #eef1f4",
                  background: "#fff",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, color: "#202733", fontSize: 14 }}>
                    {row.customer_name}
                  </div>
                  <div style={{ marginTop: 3, color: "#6b7280", fontSize: 12 }}>
                    {row.confirmation_code}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#343a46" }}>
                    {vehicleLabel(row)}
                  </div>
                  <div style={{ marginTop: 3, color: "#6b7280", fontSize: 12 }}>
                    {row.rental_duration || "Rental"}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".04em" }}>
                    Rental date
                  </div>
                  <div style={{ marginTop: 3, fontSize: 13, fontWeight: 800, color: "#343a46" }}>
                    {formatStart(row.visit_start_time)}
                  </div>
                  <div style={{ marginTop: 3, fontSize: 11, color: "#7a7f87" }}>
                    Status: {row.handoff_status || "No handoff recorded"}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={savingId === readinessId}
                  onClick={async () => {
                    setError("");
                    setSavingId(readinessId);
                    try {
                      await markRentalReturned(readinessId);
                      setReturnedIds((current) => new Set(current).add(readinessId));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Unable to mark rental returned.");
                    } finally {
                      setSavingId(null);
                    }
                  }}
                  style={{
                    border: "1px solid #b10707",
                    borderRadius: 8,
                    background: savingId === readinessId ? "#f3d6d6" : "#b10707",
                    color: "#fff",
                    padding: "9px 13px",
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: savingId === readinessId ? "wait" : "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {savingId === readinessId ? "Saving…" : "Rental Returned"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
