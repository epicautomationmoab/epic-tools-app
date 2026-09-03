"use client";

import { useState } from "react";

type DepositRow = {
  id: string;
  readiness_id: string;
  confirmation_code: string;
  customer_name?: string | null;
  product_display_name?: string | null;
  mpwr_confirmation_number?: string | null;
  mpwr_reservation_url?: string | null;
  deposit_amount_cents: number;
  hold_by?: string | null;
  hold_at?: string | null;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function DepositsOnHoldPanel({
  initialRows,
  canRelease,
}: {
  initialRows: DepositRow[];
  canRelease: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function allowRelease(row: DepositRow) {
    if (!canRelease) return;
    setBusy(row.readiness_id);
    setMessage("");
    try {
      const response = await fetch("/api/deposits/release-hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readiness_id: row.readiness_id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to allow release.");
      setRows((current) => current.filter((item) => item.readiness_id !== row.readiness_id));
      setMessage(`${row.customer_name || row.confirmation_code}: release block removed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to allow release.");
    } finally {
      setBusy("");
    }
  }

  if (!rows.length) {
    return (
      <div style={{ border: "1px solid #dfe5eb", borderRadius: 12, padding: 20, background: "#fff", fontWeight: 800 }}>
        No deposits are currently marked Do Not Release.
      </div>
    );
  }

  return (
    <>
      {message ? (
        <div style={{ marginBottom: 12, borderRadius: 9, padding: "9px 12px", background: "#f4f7f9", fontSize: 13, fontWeight: 800 }}>
          {message}
        </div>
      ) : null}

      <div style={{ border: "1px solid #dfe5eb", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", background: "#fafbfc" }}>
                <th style={{ padding: 12 }}>Guest</th>
                <th style={{ padding: 12 }}>Reservation</th>
                <th style={{ padding: 12 }}>Deposit</th>
                <th style={{ padding: 12 }}>Held By</th>
                <th style={{ padding: 12 }}>MPWR</th>
                <th style={{ padding: 12 }}>Release Block</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid #eef1f4" }}>
                  <td style={{ padding: 12 }}>
                    <strong>{row.customer_name || row.confirmation_code}</strong>
                    {row.product_display_name ? <div style={{ color: "#667085", marginTop: 2 }}>{row.product_display_name}</div> : null}
                  </td>
                  <td style={{ padding: 12, fontWeight: 800 }}>{row.confirmation_code}</td>
                  <td style={{ padding: 12, fontWeight: 900 }}>{money(row.deposit_amount_cents)}</td>
                  <td style={{ padding: 12 }}>
                    <strong>{row.hold_by || "Staff"}</strong>
                    {row.hold_at ? <div style={{ color: "#667085", marginTop: 2 }}>{new Date(row.hold_at).toLocaleString()}</div> : null}
                  </td>
                  <td style={{ padding: 12 }}>
                    {row.mpwr_reservation_url ? (
                      <a href={row.mpwr_reservation_url} target="_blank" rel="noreferrer">{row.mpwr_confirmation_number || "Open MPWR"}</a>
                    ) : (
                      row.mpwr_confirmation_number || "Missing"
                    )}
                  </td>
                  <td style={{ padding: 12 }}>
                    {canRelease ? (
                      <button
                        type="button"
                        disabled={busy === row.readiness_id}
                        onClick={() => allowRelease(row)}
                        style={{
                          border: "1px solid #157f3b",
                          borderRadius: 8,
                          background: "#edf9f0",
                          color: "#126b33",
                          padding: "8px 11px",
                          fontWeight: 900,
                          cursor: busy === row.readiness_id ? "wait" : "pointer",
                        }}
                      >
                        {busy === row.readiness_id ? "Releasing…" : "Allow Release"}
                      </button>
                    ) : (
                      <span style={{ fontWeight: 900, color: "#b42318" }}>Manager / Admin only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
