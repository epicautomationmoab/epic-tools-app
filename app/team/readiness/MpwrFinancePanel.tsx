"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ReadinessRow } from "@/lib/supabase";

type DepositStatus =
  | "held"
  | "eligible"
  | "do_not_release"
  | "release_requested"
  | "releasing"
  | "released"
  | "needs_review";

type DamageDeposit = {
  id: string;
  readiness_id: string;
  confirmation_code: string;
  mpwr_confirmation_number?: string | null;
  mpwr_reservation_url?: string | null;
  adventure_assure_level?: string | null;
  vehicle_count: number;
  deposit_amount_cents: number;
  deposit_basis: "standard" | "premier_international" | "none" | "manual";
  status: DepositStatus;
  hold_reason?: string | null;
  hold_by?: string | null;
  hold_at?: string | null;
  eligible_at?: string | null;
  release_requested_by?: string | null;
  release_requested_at?: string | null;
  released_at?: string | null;
  released_by?: string | null;
  last_error?: string | null;
  customer_name?: string;
  visit_start_time?: string;
  product_display_name?: string;
};

type DrawerTargets = {
  readinessId: string;
  balanceTarget: HTMLElement | null;
  depositTarget: HTMLElement | null;
};

function getSupabaseBrowserConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase configuration is missing.");
  return { url, key };
}

async function rpc<T>(functionName: string, body: Record<string, unknown> = {}) {
  const { url, key } = getSupabaseBrowserConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Unable to run ${functionName}.`);
  }
  return response.json() as Promise<T>;
}

function findFactTarget(dialog: HTMLElement, label: string) {
  for (const node of Array.from(dialog.querySelectorAll<HTMLElement>("section > div"))) {
    const firstSpan = node.querySelector(":scope > span");
    if (firstSpan?.textContent?.trim() === label) return node;
  }
  return null;
}

function money(cents: number | null | undefined) {
  return `$${((cents ?? 0) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buttonStyle(kind: "primary" | "danger" | "neutral" = "neutral") {
  const base: React.CSSProperties = {
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1.15,
  };
  if (kind === "primary") {
    return { ...base, border: "1px solid #156e99", background: "#eaf6fc", color: "#0e5d83" };
  }
  if (kind === "danger") {
    return { ...base, border: "1px solid #b42318", background: "#fff0ee", color: "#9d1c12" };
  }
  return { ...base, border: "1px solid #d0d5dd", background: "#fff", color: "#344054" };
}

function rowIsPremier(row: ReadinessRow | null | undefined) {
  return Boolean(
    row &&
      (row.premier_adventure_assure === true ||
        row.adventure_assure_level?.trim().toLowerCase() === "premier"),
  );
}

export default function MpwrFinancePanel({ rows }: { rows: ReadinessRow[] }) {
  const rowByReadinessId = useMemo(
    () => new Map(rows.filter((row) => row.readiness_id).map((row) => [row.readiness_id!, row])),
    [rows],
  );
  const [targets, setTargets] = useState<DrawerTargets | null>(null);
  const [deposit, setDeposit] = useState<DamageDeposit | null>(null);
  const [dueDeposits, setDueDeposits] = useState<DamageDeposit[]>([]);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const refreshDue = useCallback(async () => {
    try {
      const result = await rpc<DamageDeposit[]>("list_rental_damage_deposits_due");
      setDueDeposits(Array.isArray(result) ? result : []);
    } catch {
      // Keep readiness usable even if the finance queue cannot refresh.
    }
  }, []);

  const refreshDeposit = useCallback(async (readinessId: string) => {
    const row = rowByReadinessId.get(readinessId);
    if (!row || row.business_line !== "rental") {
      setDeposit(null);
      return;
    }
    await rpc("ensure_rental_damage_deposit", {
      p_readiness_id: readinessId,
      p_updated_by: "EpicTools",
    });
    const result = await rpc<DamageDeposit | null>("get_rental_damage_deposit", {
      p_readiness_id: readinessId,
    });
    setDeposit(result);
  }, [rowByReadinessId]);

  useEffect(() => {
    refreshDue();
    const timer = window.setInterval(refreshDue, 30000);
    return () => window.clearInterval(timer);
  }, [refreshDue]);

  useEffect(() => {
    function inspectDrawer() {
      const dialog = document.querySelector<HTMLElement>("[role='dialog'][aria-label$='reservation details']");
      if (!dialog) {
        setTargets(null);
        setDeposit(null);
        return;
      }

      const bookingFact = findFactTarget(dialog, "Booking Confirmation");
      const bookingText = bookingFact?.querySelector("strong")?.textContent?.trim().toUpperCase();
      if (!bookingText) return;

      const row = rows.find((candidate) => candidate.confirmation_code?.trim().toUpperCase() === bookingText);
      if (!row?.readiness_id) return;

      setTargets({
        readinessId: row.readiness_id,
        balanceTarget: findFactTarget(dialog, "Balance"),
        depositTarget: findFactTarget(dialog, "Security Deposit"),
      });
    }

    inspectDrawer();
    const observer = new MutationObserver(inspectDrawer);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [rows]);

  useEffect(() => {
    if (!targets?.readinessId) return;
    refreshDeposit(targets.readinessId).catch(() => setDeposit(null));
  }, [targets?.readinessId, refreshDeposit]);

  async function launchCassie(readinessId: string) {
    setBusy(`cassie:${readinessId}`);
    setMessage("");
    try {
      await rpc("launch_cassie_settle_balance", {
        p_readiness_id: readinessId,
        p_requested_by: "EpicTools",
      });
      setMessage("MPWR balance settlement queued. MPWR will be verified before any settlement is attempted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue MPWR balance settlement.");
    } finally {
      setBusy("");
    }
  }

  async function setDepositHold(readinessId: string, doNotRelease: boolean) {
    let reason: string | null = null;
    if (doNotRelease) {
      reason = window.prompt("Why should this damage deposit NOT be released?")?.trim() || null;
      if (!reason) return;
    }
    setBusy(`hold:${readinessId}`);
    setMessage("");
    try {
      const result = await rpc<DamageDeposit>("set_rental_damage_deposit_hold", {
        p_readiness_id: readinessId,
        p_do_not_release: doNotRelease,
        p_reason: reason,
        p_updated_by: "EpicTools",
      });
      setDeposit(result);
      await refreshDue();
      setMessage(doNotRelease ? "Deposit is blocked from release." : "Release block cleared.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the deposit hold.");
    } finally {
      setBusy("");
    }
  }

  async function setInternational(readinessId: string, international: boolean) {
    const row = rowByReadinessId.get(readinessId);
    setBusy(`basis:${readinessId}`);
    setMessage("");
    try {
      const result = await rpc<DamageDeposit>("set_rental_damage_deposit_basis", {
        p_readiness_id: readinessId,
        p_basis: international ? "premier_international" : rowIsPremier(row) ? "none" : "standard",
        p_updated_by: "EpicTools",
      });
      setDeposit(result);
      await refreshDue();
      setMessage(international ? "Premier international hold set to $1,500 per vehicle." : "International deposit override removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the deposit amount.");
    } finally {
      setBusy("");
    }
  }

  async function launchVictor(readinessId: string) {
    setBusy(`victor:${readinessId}`);
    setMessage("");
    try {
      await rpc("launch_victor_release_deposit", {
        p_readiness_id: readinessId,
        p_requested_by: "EpicTools",
      });
      await refreshDue();
      setMessage("Damage deposit release queued.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue damage deposit release.");
    } finally {
      setBusy("");
    }
  }

  const selectedRow = targets ? rowByReadinessId.get(targets.readinessId) : null;
  const selectedDue = selectedRow?.amount_due_cents ?? 0;
  const isPremier = rowIsPremier(selectedRow);

  return (
    <>
      {dueDeposits.length ? (
        <section style={{ marginBottom: 18, border: "1px solid #e3e7ec", borderRadius: 12, background: "#fff", overflow: "hidden" }}>
          <div style={{ padding: "13px 16px", borderBottom: "1px solid #eef1f4", fontWeight: 900, fontSize: 15 }}>
            Release Damage Deposits ({dueDeposits.length})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", background: "#fafbfc" }}>
                  <th style={{ padding: 10 }}>Guest</th>
                  <th style={{ padding: 10 }}>Deposit</th>
                  <th style={{ padding: 10 }}>Status</th>
                  <th style={{ padding: 10 }}>MPWR</th>
                  <th style={{ padding: 10 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {dueDeposits.map((item) => (
                  <tr key={item.id} style={{ borderTop: "1px solid #eef1f4" }}>
                    <td style={{ padding: 10 }}><strong>{item.customer_name || item.confirmation_code}</strong><div style={{ color: "#667085" }}>{item.confirmation_code}</div></td>
                    <td style={{ padding: 10, fontWeight: 800 }}>{money(item.deposit_amount_cents)}</td>
                    <td style={{ padding: 10, fontWeight: 800, color: item.status === "do_not_release" ? "#b42318" : "#344054" }}>{item.status.replaceAll("_", " ")}{item.hold_reason ? <div style={{ fontWeight: 600, color: "#667085" }}>{item.hold_reason}</div> : null}</td>
                    <td style={{ padding: 10 }}>{item.mpwr_reservation_url ? <a href={item.mpwr_reservation_url} target="_blank" rel="noreferrer">Open MPWR</a> : "Missing"}</td>
                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {item.status === "eligible" ? <button style={buttonStyle("primary")} disabled={busy === `victor:${item.readiness_id}`} onClick={() => launchVictor(item.readiness_id)}>Release Deposit</button> : null}
                        {item.status !== "do_not_release" && item.status !== "release_requested" && item.status !== "releasing" ? <button style={buttonStyle("danger")} onClick={() => setDepositHold(item.readiness_id, true)}>Do Not Release</button> : null}
                        {item.status === "do_not_release" ? <button style={buttonStyle()} onClick={() => setDepositHold(item.readiness_id, false)}>Allow Release</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {message ? <div style={{ marginBottom: 12, borderRadius: 9, padding: "9px 12px", background: "#f4f7f9", color: "#344054", fontSize: 13, fontWeight: 700 }}>{message}</div> : null}

      {targets?.balanceTarget && selectedRow && selectedDue > 0
        ? createPortal(
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                style={buttonStyle("primary")}
                disabled={busy === `cassie:${targets.readinessId}` || !selectedRow.mpwr_reservation_url}
                onClick={() => launchCassie(targets.readinessId)}
              >
                {busy === `cassie:${targets.readinessId}` ? "Queuing…" : "Settle MPWR Balance"}
              </button>
              <small style={{ display: "block", marginTop: 5, lineHeight: 1.3, color: "#667085", fontWeight: 700 }}>
                MPWR will be verified for an available Settle Balance action before any settlement is attempted.
              </small>
            </div>,
            targets.balanceTarget,
          )
        : null}

      {targets?.depositTarget && selectedRow?.business_line === "rental" && deposit
        ? createPortal(
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: deposit.status === "do_not_release" ? "#b42318" : "#344054" }}>
                {deposit.status === "do_not_release" ? "⛔ DO NOT RELEASE" : `Deposit status: ${deposit.status.replaceAll("_", " ")}`}
              </div>
              {deposit.hold_reason ? <small style={{ display: "block", marginTop: 3, color: "#667085", fontWeight: 700 }}>{deposit.hold_reason}</small> : null}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7 }}>
                {deposit.status !== "do_not_release" && deposit.status !== "released" ? <button type="button" style={buttonStyle("danger")} disabled={busy === `hold:${targets.readinessId}`} onClick={() => setDepositHold(targets.readinessId, true)}>Do Not Release</button> : null}
                {deposit.status === "do_not_release" ? <button type="button" style={buttonStyle()} disabled={busy === `hold:${targets.readinessId}`} onClick={() => setDepositHold(targets.readinessId, false)}>Allow Release</button> : null}
                {isPremier ? <button type="button" style={buttonStyle()} disabled={busy === `basis:${targets.readinessId}`} onClick={() => setInternational(targets.readinessId, deposit.deposit_basis !== "premier_international")}>{deposit.deposit_basis === "premier_international" ? "Remove International Hold" : "International — $1,500/vehicle"}</button> : null}
              </div>
            </div>,
            targets.depositTarget,
          )
        : null}
    </>
  );
}
