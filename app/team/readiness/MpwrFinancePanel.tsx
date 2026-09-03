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
};

type SettlementJob = {
  id: string;
  readiness_id: string;
  status: "queued" | "claimed" | "settled" | "already_settled" | "needs_review" | "failed";
  result_message?: string | null;
  observed_mpwr_amount_due_cents?: number | null;
  completed_at?: string | null;
  updated_at?: string | null;
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

function buttonStyle() {
  return {
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    lineHeight: 1.15,
    border: "1px solid #d0d5dd",
    background: "#fff",
    color: "#344054",
  } as const;
}

function rowIsPremier(row: ReadinessRow | null | undefined) {
  return Boolean(
    row &&
      (row.premier_adventure_assure === true ||
        row.adventure_assure_level?.trim().toLowerCase() === "premier"),
  );
}

function HoldToggle({
  checked,
  disabled,
  onEnable,
}: {
  checked: boolean;
  disabled: boolean;
  onEnable: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled || checked}
      onClick={onEnable}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: 0,
        background: "transparent",
        padding: 0,
        cursor: disabled || checked ? "default" : "pointer",
        fontSize: 12,
        fontWeight: 900,
        color: checked ? "#b42318" : "#344054",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 34,
          height: 19,
          borderRadius: 999,
          padding: 2,
          display: "inline-flex",
          justifyContent: checked ? "flex-end" : "flex-start",
          background: checked ? "#d92d20" : "#cfd4dc",
          boxSizing: "border-box",
        }}
      >
        <span style={{ width: 15, height: 15, borderRadius: "50%", background: "#fff" }} />
      </span>
      Do Not Release
    </button>
  );
}

export default function MpwrFinancePanel({ rows }: { rows: ReadinessRow[] }) {
  const rowByReadinessId = useMemo(
    () => new Map(rows.filter((row) => row.readiness_id).map((row) => [row.readiness_id!, row])),
    [rows],
  );
  const [targets, setTargets] = useState<DrawerTargets | null>(null);
  const [deposit, setDeposit] = useState<DamageDeposit | null>(null);
  const [settlement, setSettlement] = useState<SettlementJob | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

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

  const refreshSettlement = useCallback(async (readinessId: string) => {
    try {
      const result = await rpc<SettlementJob[]>("get_latest_cassie_mpwr_job", {
        p_readiness_id: readinessId,
      });
      setSettlement(Array.isArray(result) && result.length ? result[0] : null);
    } catch {
      setSettlement(null);
    }
  }, []);

  useEffect(() => {
    function inspectDrawer() {
      const dialog = document.querySelector<HTMLElement>("[role='dialog'][aria-label$='reservation details']");
      if (!dialog) {
        setTargets(null);
        setDeposit(null);
        setSettlement(null);
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
    refreshSettlement(targets.readinessId);

    const timer = window.setInterval(() => {
      refreshSettlement(targets.readinessId);
      refreshDeposit(targets.readinessId).catch(() => {});
    }, 3000);

    return () => window.clearInterval(timer);
  }, [targets?.readinessId, refreshDeposit, refreshSettlement]);

  async function launchSettlement(readinessId: string) {
    setBusy(`balance:${readinessId}`);
    setMessage("");
    try {
      await rpc("launch_cassie_settle_balance", {
        p_readiness_id: readinessId,
        p_requested_by: "EpicTools",
      });
      await refreshSettlement(readinessId);
      setMessage("MPWR balance settlement queued.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to queue MPWR balance settlement.");
    } finally {
      setBusy("");
    }
  }

  async function enableDepositHold(readinessId: string) {
    setBusy(`hold:${readinessId}`);
    setMessage("");
    try {
      const response = await fetch("/api/deposits/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readiness_id: readinessId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Unable to hold deposit.");
      setDeposit(payload as DamageDeposit);
      setMessage("Deposit marked Do Not Release.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to hold deposit.");
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
      setMessage(international ? "Premier international hold set to $1,500 per vehicle." : "International deposit override removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the deposit amount.");
    } finally {
      setBusy("");
    }
  }

  const selectedRow = targets ? rowByReadinessId.get(targets.readinessId) : null;
  const selectedDue = selectedRow?.amount_due_cents ?? 0;
  const isPremier = rowIsPremier(selectedRow);
  const mpwrSettled = settlement?.status === "settled" || settlement?.status === "already_settled";
  const mpwrSettlementPending = settlement?.status === "queued" || settlement?.status === "claimed";

  return (
    <>
      {message ? (
        <div style={{ marginBottom: 12, borderRadius: 9, padding: "9px 12px", background: "#f4f7f9", color: "#344054", fontSize: 13, fontWeight: 700 }}>
          {message}
        </div>
      ) : null}

      {targets?.balanceTarget && selectedRow && selectedDue > 0
        ? createPortal(
            <div style={{ marginTop: 8 }}>
              {mpwrSettled ? (
                <div style={{ fontSize: 13, fontWeight: 900, color: "#157f3b" }}>✓ MPWR Balance Settled</div>
              ) : mpwrSettlementPending ? (
                <div style={{ fontSize: 13, fontWeight: 900, color: "#667085" }}>MPWR settlement in progress…</div>
              ) : (
                <>
                  <button
                    type="button"
                    style={{ ...buttonStyle(), borderColor: "#156e99", background: "#eaf6fc", color: "#0e5d83" }}
                    disabled={busy === `balance:${targets.readinessId}` || !selectedRow.mpwr_reservation_url}
                    onClick={() => launchSettlement(targets.readinessId)}
                  >
                    {busy === `balance:${targets.readinessId}` ? "Queuing…" : "Settle MPWR Balance"}
                  </button>
                  <small style={{ display: "block", marginTop: 5, lineHeight: 1.3, color: "#667085", fontWeight: 700 }}>
                    MPWR will be verified for an available Settle Balance action before any settlement is attempted.
                  </small>
                </>
              )}
            </div>,
            targets.balanceTarget,
          )
        : null}

      {targets?.depositTarget && selectedRow?.business_line === "rental" && deposit
        ? createPortal(
            <div style={{ marginTop: 8 }}>
              {deposit.deposit_amount_cents > 0 && deposit.status !== "released" ? (
                <HoldToggle
                  checked={deposit.status === "do_not_release"}
                  disabled={busy === `hold:${targets.readinessId}` || deposit.status === "release_requested" || deposit.status === "releasing"}
                  onEnable={() => enableDepositHold(targets.readinessId)}
                />
              ) : null}

              {deposit.status === "do_not_release" ? (
                <small style={{ display: "block", marginTop: 5, color: "#b42318", fontWeight: 800 }}>
                  Release is blocked. A Manager or Admin must clear it from Deposits On-Hold.
                </small>
              ) : null}

              {deposit.status === "released" ? (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 900, color: "#157f3b" }}>✓ Deposit Released</div>
              ) : null}

              {isPremier ? (
                <div style={{ marginTop: 7 }}>
                  <button
                    type="button"
                    style={buttonStyle()}
                    disabled={busy === `basis:${targets.readinessId}`}
                    onClick={() => setInternational(targets.readinessId, deposit.deposit_basis !== "premier_international")}
                  >
                    {deposit.deposit_basis === "premier_international" ? "Remove International Hold" : "International — $1,500/vehicle"}
                  </button>
                </div>
              ) : null}
            </div>,
            targets.depositTarget,
          )
        : null}
    </>
  );
}
