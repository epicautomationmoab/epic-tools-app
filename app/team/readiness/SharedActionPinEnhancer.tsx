"use client";

import { useEffect, useRef, useState } from "react";

type AuthProfile = {
  display_name: string;
  role: "admin" | "manager" | "agent" | "workstation";
};

type PinProfile = {
  id: string;
  display_name: string;
  role: "admin" | "manager" | "agent";
};

type PendingAction = {
  button: HTMLButtonElement;
  kind: "cancellation" | "courtesy";
};

const PIN_REQUIRED_VALUE = "__EPIC_PIN_REQUIRED__";

function buttonAction(button: HTMLButtonElement): PendingAction["kind"] | null {
  const text = button.textContent?.trim() || "";
  if (text === "Send Agreement" || text === "Copy Link") return "cancellation";
  if (text === "Complete Courtesy Call") return "courtesy";
  return null;
}

function findLabeledSelect(root: Element | null, labelText: string) {
  if (!root) return null;
  const labels = Array.from(root.querySelectorAll("label"));
  for (const label of labels) {
    const span = label.querySelector("span");
    if (span?.textContent?.trim() !== labelText) continue;
    const select = label.querySelector("select");
    if (select instanceof HTMLSelectElement) return select;
  }
  return null;
}

function setReactSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

function prepareHiddenIdentitySelect(select: HTMLSelectElement | null) {
  if (!select) return;
  const label = select.closest("label");
  if (label instanceof HTMLElement) label.style.display = "none";

  if (!Array.from(select.options).some((option) => option.value === PIN_REQUIRED_VALUE)) {
    select.add(new Option("PIN required", PIN_REQUIRED_VALUE));
  }

  if (!select.value) setReactSelectValue(select, PIN_REQUIRED_VALUE);
}

export default function SharedActionPinEnhancer() {
  const [authChecked, setAuthChecked] = useState(false);
  const [sharedMode, setSharedMode] = useState(false);
  const [profiles, setProfiles] = useState<PinProfile[]>([]);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [employee, setEmployee] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const bypassButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json().catch(() => ({})) as { authenticated?: boolean; profile?: AuthProfile | null };
        const profile = data.authenticated ? data.profile ?? null : null;
        const isShared = !profile || profile.role === "workstation";
        setSharedMode(isShared);

        if (isShared) {
          const pinResponse = await fetch("/api/team/action-pin", { cache: "no-store" });
          const pinData = await pinResponse.json().catch(() => ({})) as { profiles?: PinProfile[] };
          if (pinResponse.ok) setProfiles(pinData.profiles ?? []);
        }
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authChecked || !sharedMode) return;

    function prepareSharedIdentityFields() {
      for (const dialog of Array.from(document.querySelectorAll('[role="dialog"]'))) {
        prepareHiddenIdentitySelect(findLabeledSelect(dialog, "Sent by"));
      }

      for (const select of Array.from(document.querySelectorAll("select"))) {
        if (!(select instanceof HTMLSelectElement)) continue;
        const label = select.closest("label");
        const span = label?.querySelector("span");
        if (span?.textContent?.trim() === "Completed by") prepareHiddenIdentitySelect(select);
      }
    }

    prepareSharedIdentityFields();
    const observer = new MutationObserver(() => prepareSharedIdentityFields());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [authChecked, sharedMode]);

  useEffect(() => {
    if (!authChecked || !sharedMode) return;

    function intercept(event: MouseEvent) {
      const target = event.target;
      const button = target instanceof Element ? target.closest("button") : null;
      if (!(button instanceof HTMLButtonElement)) return;

      if (bypassButton.current === button) {
        bypassButton.current = null;
        return;
      }

      const kind = buttonAction(button);
      if (!kind || button.disabled) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      let currentName = "";
      if (kind === "cancellation") {
        const dialog = button.closest('[role="dialog"]');
        const value = findLabeledSelect(dialog, "Sent by")?.value || "";
        currentName = value === PIN_REQUIRED_VALUE ? "" : value;
      } else {
        const drawer = button.closest("section")?.parentElement?.parentElement ?? button.parentElement;
        const value = findLabeledSelect(drawer, "Completed by")?.value || "";
        currentName = value === PIN_REQUIRED_VALUE ? "" : value;
      }

      setEmployee(currentName);
      setPin("");
      setShowPin(false);
      setError("");
      setPending({ button, kind });
    }

    document.addEventListener("click", intercept, true);
    return () => document.removeEventListener("click", intercept, true);
  }, [authChecked, sharedMode]);

  async function verifyAndContinue() {
    if (!pending) return;
    if (!employee) {
      setError("Select your name.");
      return;
    }
    if (!pin) {
      setError("Enter your PIN.");
      return;
    }

    setVerifying(true);
    setError("");
    try {
      const response = await fetch("/api/team/action-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: employee, pin }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; profile?: { display_name?: string } };
      if (!response.ok) throw new Error(data.error || "Unable to verify PIN.");

      const verifiedName = data.profile?.display_name || employee;
      let identitySelect: HTMLSelectElement | null = null;

      if (pending.kind === "cancellation") {
        const dialog = pending.button.closest('[role="dialog"]');
        identitySelect = findLabeledSelect(dialog, "Sent by");
        if (!identitySelect) throw new Error("Unable to find the employee field for this agreement.");
      } else {
        const drawer = pending.button.closest("section")?.parentElement?.parentElement ?? pending.button.parentElement;
        identitySelect = findLabeledSelect(drawer, "Completed by");
        if (!identitySelect) throw new Error("Unable to find the employee field for this courtesy call.");
      }

      if (!Array.from(identitySelect.options).some((option) => option.value === verifiedName)) {
        identitySelect.add(new Option(verifiedName, verifiedName));
      }
      setReactSelectValue(identitySelect, verifiedName);

      const button = pending.button;
      setPending(null);
      setPin("");
      window.setTimeout(() => {
        bypassButton.current = button;
        button.click();
        window.setTimeout(() => {
          if (identitySelect?.isConnected) setReactSelectValue(identitySelect, PIN_REQUIRED_VALUE);
        }, 250);
      }, 50);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify PIN.");
    } finally {
      setVerifying(false);
    }
  }

  if (!pending) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 4000, display: "grid", placeItems: "center", padding: 20, background: "rgba(17,24,39,.55)" }}>
      <div role="dialog" aria-modal="true" aria-label="Employee PIN verification" style={{ width: "min(420px, 100%)", borderRadius: 16, background: "#fff", padding: 24, boxShadow: "0 24px 70px rgba(0,0,0,.28)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", opacity: .6 }}>HQ Reception</div>
            <h2 style={{ margin: "4px 0 0" }}>Who are you?</h2>
          </div>
          <button type="button" onClick={() => setPending(null)} aria-label="Close PIN verification" style={{ border: 0, background: "transparent", fontSize: 28, cursor: "pointer" }}>×</button>
        </div>
        <p style={{ color: "#667085", lineHeight: 1.45 }}>Select your name and enter your PIN so this action is recorded under you.</p>

        <label style={{ display: "block", marginTop: 16 }}>
          <span style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>Employee</span>
          <select value={employee} onChange={(event) => setEmployee(event.target.value)} style={{ width: "100%", height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 12px", font: "inherit" }}>
            <option value="">Select your name…</option>
            {profiles.map((profile) => <option key={profile.id} value={profile.display_name}>{profile.display_name}</option>)}
          </select>
        </label>

        <label style={{ display: "block", marginTop: 14 }}>
          <span style={{ display: "block", fontWeight: 700, marginBottom: 6 }}>PIN</span>
          <div style={{ position: "relative" }}>
            <input type={showPin ? "text" : "password"} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="off" placeholder="4–6 digit PIN" onKeyDown={(event) => { if (event.key === "Enter") void verifyAndContinue(); }} style={{ width: "100%", height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 46px 0 12px", boxSizing: "border-box", font: "inherit" }} />
            <button type="button" onClick={() => setShowPin((value) => !value)} aria-label={showPin ? "Hide PIN" : "Show PIN"} title={showPin ? "Hide PIN" : "Show PIN"} style={{ position: "absolute", top: 0, right: 0, width: 46, height: 46, border: 0, background: "transparent", cursor: "pointer", fontSize: 18 }}>{showPin ? "◉" : "◎"}</button>
          </div>
        </label>

        {error ? <p style={{ color: "#b42318", marginBottom: 0 }}>{error}</p> : null}

        <button type="button" disabled={verifying} onClick={() => void verifyAndContinue()} style={{ width: "100%", height: 46, marginTop: 18, border: 0, borderRadius: 9, background: "#d5521d", color: "#fff", fontWeight: 800, cursor: verifying ? "wait" : "pointer" }}>
          {verifying ? "Verifying…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
