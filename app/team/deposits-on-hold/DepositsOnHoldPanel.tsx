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
  status: "held" | "eligible" | "do_not_release" | "release_requested" | "releasing" | "released" | "needs_review";
  work_state: "not_due" | "ready" | "do_not_release" | "releasing" | "needs_review";
  hold_by?: string | null;
  hold_at?: string | null;
  eligible_at?: string | null;
};

function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusLabel(row: DepositRow) {
  if (row.work_state === "do_not_release") return "DO NOT RELEASE";
  if (row.work_state === "ready") return "Ready for 11:15 Release";
  if (row.work_state === "releasing") return "Processing";
  if (row.work_state === "needs_review") return "Needs Review";
  return "Not Due Yet";
}

export default function DepositsOnHoldPanel({
  initialRows,
  canOverrideHold,
}: {
  initialRows: DepositRow[];
  canOverrideHold: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function holdDeposit(row: DepositRow) {
    setBusy(row.readiness_id);
    setMessage("");
    try {
      const response = await fetch("/api/deposits/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readiness_id: row.readiness_id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to hold deposit.");

      setRows((current) => current.map((item) =>
        item.readiness_id === row.readiness_id
          ? {
              ...item,
              status: "do_not_release",
              work_state: "do_not_release",
              hold_by: payload?.hold_by ?? "staff",
              hold_at: payload?.hold_at ?? new Date().toISOString(),
            }
          : item,
      ));
      setMessage(`${row.customer_name || row.confirmation_code}: deposit is now blocked from automatic release.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to hold deposit.");
    } finally {
      setBusy("");
    }
  }

  async function releaseHeldDeposit(row: DepositRow) {
    setBusy(row.readiness_id);
    setMessage("");
    try {
      const response = await fetch("/api/deposits/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readiness_id: row.readiness_id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to release deposit.");

      setRows((current) => current.map((item) =>
        item.readiness_id === row.readiness_id
          ? { ...item, status: "release_requested", work_state: "releasing", hold_by: null, hold_at: null }
          : item,
      ));
      setMessage(`${row.customer_name || row.confirmation_code}: deposit release sent to Victor.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to release deposit.");
    } finally {
      setBusy("");
    }
  }

  if (!rows.length) {
    return (
      <div style={{ border: "1px solid #dfe5eb", borderRadius: 12, padding: 20, background: "#fff", fontWeight: 800 }}>
        No active MPWR damage deposits.
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
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>MPWR</th>
                <th style={{ padding: 12 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const blocked = row.work_state === "do_not_release";
                const ready = row.work_state === "ready";
                const releasing = row.work_state === "releasing";
                const needsReview = row.work_state === "needs_review";
                const canHold = !blocked && !releasing && !needsReview;

                return (
                  <tr
                    key={row.id}
                    style={{
                      borderTop: "1px solid #eef1f4",
                      background: blocked ? "#fff4f2" : needsReview ? "#fff8e6" : undefined,
                    }}
                  >
                    <td style={{ padding: 12 }}>
                      <strong>{row.customer_name || row.confirmation_code}</strong>
                      {row.product_display_name ? <div style={{ color: "#667085", marginTop: 2 }}>{row.product_display_name}</div> : null}
                    </td>
                    <td style={{ padding: 12, fontWeight: 800 }}>{row.confirmation_code}</td>
                    <td style={{ padding: 12, fontWeight: 900 }}>{money(row.deposit_amount_cents)}</td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 900, color: blocked ? "#b42318" : needsReview ? "#9a6700" : ready ? "#157f3b" : "#475467" }}>
                        {needsReview ? "⚠️ " : ""}{statusLabel(row)}
                      </div>
                      {blocked ? (
                        <div style={{ color: "#b42318", marginTop: 3, fontWeight: 700 }}>
                          Held by {row.hold_by || "staff"}{row.hold_at ? ` · ${new Date(row.hold_at).toLocaleString()}` : ""}
                        </div>
                      ) : row.eligible_at ? (
                        <div style={{ color: "#667085", marginTop: 3 }}>
                          Release date: {new Date(row.eligible_at).toLocaleDateString()}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: 12 }}>
                      {row.mpwr_reservation_url ? (
                        <a href={row.mpwr_reservation_url} target="_blank" rel="noreferrer">{row.mpwr_confirmation_number || "Open MPWR"}</a>
                      ) : (
                        row.mpwr_confirmation_number || "Missing"
                      )}
                    </td>
                    <td style={{ padding: 12 }}>
                      {canHold ? (
                        <button
                          type="button"
                          disabled={busy === row.readiness_id}
                          onClick={() => holdDeposit(row)}
                          style={{
                            border: "1px solid #b42318",
                            borderRadius: 8,
                            background: "#fff4f2",
                            color: "#b42318",
                            padding: "8px 13px",
                            fontWeight: 900,
                            cursor: busy === row.readiness_id ? "wait" : "pointer",
                          }}
                        >
                          {busy === row.readiness_id ? "Holding…" : "HOLD"}
                        </button>
                      ) : blocked && canOverrideHold ? (
                        <button
                          type="button"
                          disabled={busy === row.readiness_id}
                          onClick={() => releaseHeldDeposit(row)}
                          style={{
                            border: "1px solid #157f3b",
                            borderRadius: 8,
                            background: "#edf9f0",
                            color: "#126b33",
                            padding: "8px 13px",
                            fontWeight: 900,
                            cursor: busy === row.readiness_id ? "wait" : "pointer",
                          }}
                        >
                          {busy === row.readiness_id ? "Releasing…" : "Release Hold"}
                        </button>
                      ) : blocked ? (
                        <span style={{ fontWeight: 900, color: "#b42318" }}>Held</span>
                      ) : releasing ? (
                        <span style={{ fontWeight: 800, color: "#667085" }}>Processing…</span>
                      ) : needsReview ? (
                        <span style={{ fontWeight: 900, color: "#9a6700" }}>Needs Review</span>
                      ) : (
                        <span style={{ color: "#98a2b3", fontWeight: 700 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
