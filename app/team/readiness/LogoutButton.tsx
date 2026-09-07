"use client";

import { useEffect, useRef, useState } from "react";

type AuthProfile = {
  id: string;
  display_name: string;
  role: "admin" | "manager" | "agent" | "workstation";
};

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = "epic_last_activity_at";

export default function LogoutButton() {
  const [working, setWorking] = useState(false);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState("");
  const lastWriteRef = useRef(0);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await response.json().catch(() => ({})) as { authenticated?: boolean; profile?: AuthProfile | null };
        setProfile(data.authenticated ? data.profile ?? null : null);
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!authChecked || !profile || profile.role === "workstation") return;

    const now = Date.now();
    const stored = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) || 0);
    if (!stored) window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    else if (now - stored >= IDLE_TIMEOUT_MS) setLocked(true);

    function recordActivity() {
      if (locked) return;
      const current = Date.now();
      if (current - lastWriteRef.current < 15000) return;
      lastWriteRef.current = current;
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(current));
    }

    function checkIdle() {
      const last = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
      if (Date.now() - last >= IDLE_TIMEOUT_MS) setLocked(true);
    }

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    const timer = window.setInterval(checkIdle, 15000);
    const onVisibility = () => { if (document.visibilityState === "visible") checkIdle(); };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [authChecked, profile, locked]);

  async function logout() {
    if (working) return;
    setWorking(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.localStorage.removeItem(LAST_ACTIVITY_KEY);
    } finally {
      window.location.href = "/employee-login";
    }
  }

  async function unlock() {
    if (!profile || unlocking) return;
    if (!pin.trim()) {
      setUnlockError("Enter your PIN.");
      return;
    }

    setUnlocking(true);
    setUnlockError("");
    try {
      const response = await fetch("/api/team/action-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pin.trim() }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string; profile?: { id?: string; display_name?: string } };
      if (!response.ok) throw new Error(data.error || "Unable to verify PIN.");
      if (!data.profile?.id || data.profile.id !== profile.id) {
        throw new Error(`This browser is signed in as ${profile.display_name}. Use ${profile.display_name}'s PIN or log out.`);
      }

      const now = Date.now();
      window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      lastWriteRef.current = now;
      setPin("");
      setLocked(false);
    } catch (error) {
      setUnlockError(error instanceof Error ? error.message : "Unable to verify PIN.");
    } finally {
      setUnlocking(false);
    }
  }

  const identityLabel = profile?.display_name || (authChecked ? "Shared workstation" : "Checking user…");

  return (
    <>
      <div style={{ display: "inline-flex", alignItems: "stretch", minHeight: 38, border: "1px solid #d0d5dd", borderRadius: 8, background: "#fff", overflow: "hidden", color: "#344054" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "0 12px", fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", borderRight: "1px solid #e4e7ec" }}>
          {identityLabel}
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          disabled={working}
          style={{ border: 0, background: "#fff", color: "#344054", padding: "0 12px", fontWeight: 700, cursor: working ? "wait" : "pointer" }}
        >
          {working ? "Logging out..." : "Logout"}
        </button>
      </div>

      {locked && profile ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 6000, display: "grid", placeItems: "center", padding: 20, background: "rgba(17,24,39,.72)", backdropFilter: "blur(4px)" }}>
          <div role="alertdialog" aria-modal="true" aria-label={`Unlock ${profile.display_name}`} style={{ width: "min(390px, 100%)", borderRadius: 16, background: "#fff", padding: 26, boxShadow: "0 24px 70px rgba(0,0,0,.32)" }}>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", color: "#e45b22" }}>Epic Tools Locked</div>
            <h2 style={{ margin: "5px 0 6px", color: "#202733" }}>{profile.display_name}</h2>
            <p style={{ margin: 0, color: "#667085", fontSize: 14 }}>30 minutes of inactivity. Enter your PIN to continue without signing in again.</p>

            <label style={{ display: "block", marginTop: 20 }}>
              <span style={{ display: "block", marginBottom: 6, fontWeight: 800, color: "#344054" }}>PIN</span>
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setUnlockError(""); }}
                onKeyDown={(event) => { if (event.key === "Enter") void unlock(); }}
                placeholder="4–6 digit PIN"
                style={{ width: "100%", height: 46, boxSizing: "border-box", border: `1px solid ${unlockError ? "#d92d20" : "#cfd6de"}`, borderRadius: 9, padding: "0 12px", font: "inherit" }}
              />
            </label>

            {unlockError ? <div style={{ marginTop: 8, color: "#b42318", fontWeight: 700, fontSize: 13 }}>{unlockError}</div> : null}

            <button type="button" disabled={unlocking} onClick={() => void unlock()} style={{ width: "100%", height: 46, marginTop: 18, border: 0, borderRadius: 9, background: "#e45b22", color: "#fff", fontWeight: 900, cursor: unlocking ? "wait" : "pointer" }}>
              {unlocking ? "Unlocking…" : "Unlock"}
            </button>
            <button type="button" disabled={working} onClick={() => void logout()} style={{ width: "100%", height: 40, marginTop: 8, border: 0, background: "transparent", color: "#667085", fontWeight: 700, cursor: working ? "wait" : "pointer" }}>
              Log out instead
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
