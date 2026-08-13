"use client";

import { FormEvent, useEffect, useState } from "react";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M3 3l18 18M10.6 6.2A11.6 11.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.6M6.7 6.7C3.6 8.6 2 12 2 12s3.5 6 10 6c1.4 0 2.6-.3 3.7-.7M9.9 9.9A3 3 0 0 0 14.1 14.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function AcceptInvitePage() {
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        const tokenHash = query.get("token_hash") || "";
        if (tokenHash) {
          const response = await fetch("/api/auth/verify-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token_hash: tokenHash }),
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.error || "Unable to verify invitation.");
          setAccessToken(payload.access_token || "");
          setRefreshToken(payload.refresh_token || "");
          window.history.replaceState({}, "", window.location.pathname);
          return;
        }

        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        setAccessToken(hash.get("access_token") || "");
        setRefreshToken(hash.get("refresh_token") || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to verify invitation.");
      } finally {
        setVerifying(false);
      }
    })();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!accessToken || !refreshToken) {
      setError("This invitation is invalid or has expired. Please request a fresh invitation.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      setError("PIN must be 4 to 6 digits.");
      return;
    }
    if (pin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          password,
          pin,
          confirm_pin: confirmPin,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to activate account.");
      window.location.href = "/team/readiness";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to activate account.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { width: "100%", height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 12px", boxSizing: "border-box" as const };
  const passwordWrapStyle = { position: "relative" as const, marginBottom: 12 };
  const eyeButtonStyle = { position: "absolute" as const, right: 8, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", padding: 6, color: "#667085", cursor: "pointer", display: "grid", placeItems: "center" };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f5f7", padding: 24 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #dfe4e9", borderRadius: 16, padding: 32, boxShadow: "0 18px 50px rgba(20,31,45,.12)" }}>
        <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ display: "block", width: 180, margin: "0 auto 24px" }} />
        <h1 style={{ margin: 0, textAlign: "center", color: "#182230" }}>Activate EpicTools</h1>
        <p style={{ textAlign: "center", color: "#667085", marginBottom: 24 }}>
          {verifying ? "Verifying your invitation..." : "Choose your EpicTools password and your employee PIN."}
        </p>

        {!verifying ? (
          <>
            <div style={passwordWrapStyle}>
              <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="new-password" required style={{ ...inputStyle, paddingRight: 44 }} />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} style={eyeButtonStyle}>
                <EyeIcon open={showPassword} />
              </button>
            </div>

            <div style={passwordWrapStyle}>
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm password" autoComplete="new-password" required style={{ ...inputStyle, paddingRight: 44 }} />
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide password" : "Show password"} title={showConfirmPassword ? "Hide password" : "Show password"} style={eyeButtonStyle}>
                <EyeIcon open={showConfirmPassword} />
              </button>
            </div>

            <div style={{ borderTop: "1px solid #eaecf0", margin: "20px 0", paddingTop: 20 }}>
              <div style={{ fontWeight: 800, color: "#182230", marginBottom: 5 }}>Employee PIN</div>
              <p style={{ margin: "0 0 12px", color: "#667085", fontSize: 14, lineHeight: 1.45 }}>
                Choose a 4 to 6 digit PIN. You will use it to identify yourself when working from a shared EpicTools workstation.
              </p>
              <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="PIN" autoComplete="new-password" required style={{ ...inputStyle, marginBottom: 12 }} />
              <input type="password" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={confirmPin} onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Confirm PIN" autoComplete="new-password" required style={inputStyle} />
            </div>

            {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}

            <button type="submit" disabled={submitting || !accessToken || !refreshToken} style={{ width: "100%", height: 46, marginTop: 18, border: 0, borderRadius: 9, background: "#d5521d", color: "#fff", fontWeight: 800, cursor: submitting ? "wait" : "pointer", opacity: accessToken && refreshToken ? 1 : 0.6 }}>
              {submitting ? "Activating..." : "Set Password & PIN"}
            </button>
          </>
        ) : null}

        {!verifying && error && (!accessToken || !refreshToken) ? (
          <p style={{ color: "#b42318", marginTop: 16 }}>{error}</p>
        ) : null}
      </form>
    </main>
  );
}
