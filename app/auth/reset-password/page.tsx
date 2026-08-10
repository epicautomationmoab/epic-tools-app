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

export default function ResetPasswordPage() {
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setAccessToken(hash.get("access_token") || "");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!accessToken) {
      setError("This reset link is missing its secure session. Please use the link from the password reset email.");
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

    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to reset password.");
      setSuccess(true);
      window.location.hash = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = { width: "100%", height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 46px 0 12px", boxSizing: "border-box" as const };
  const wrapStyle = { position: "relative" as const, marginBottom: 12 };
  const eyeStyle = { position: "absolute" as const, right: 8, top: "50%", transform: "translateY(-50%)", border: 0, background: "transparent", padding: 6, color: "#667085", cursor: "pointer", display: "grid", placeItems: "center" };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f5f7", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #dfe4e9", borderRadius: 16, padding: 32, boxShadow: "0 18px 50px rgba(20,31,45,.12)", boxSizing: "border-box" }}>
        <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ display: "block", width: 180, margin: "0 auto 24px" }} />
        <h1 style={{ margin: 0, textAlign: "center", color: "#182230" }}>Reset EpicTools Password</h1>

        {success ? (
          <div style={{ marginTop: 24 }}>
            <p style={{ color: "#067647", lineHeight: 1.5 }}>Your password has been updated. Your employee PIN has not changed.</p>
            <a href="/employee-login" style={{ display: "block", textAlign: "center", marginTop: 18, padding: "12px 16px", borderRadius: 9, background: "#d5521d", color: "#fff", fontWeight: 800, textDecoration: "none" }}>Return to Login</a>
          </div>
        ) : (
          <form onSubmit={submit}>
            <p style={{ textAlign: "center", color: "#667085", margin: "10px 0 24px", lineHeight: 1.45 }}>Choose a new password. Your existing employee PIN will stay the same.</p>
            <div style={wrapStyle}>
              <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" autoComplete="new-password" required style={inputStyle} />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} style={eyeStyle}><EyeIcon open={showPassword} /></button>
            </div>
            <div style={wrapStyle}>
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" autoComplete="new-password" required style={inputStyle} />
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide password" : "Show password"} style={eyeStyle}><EyeIcon open={showConfirmPassword} /></button>
            </div>
            {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
            <button type="submit" disabled={submitting} style={{ width: "100%", height: 46, marginTop: 8, border: 0, borderRadius: 9, background: "#d5521d", color: "#fff", fontWeight: 800, cursor: submitting ? "wait" : "pointer" }}>{submitting ? "Updating..." : "Reset Password"}</button>
          </form>
        )}
      </div>
    </main>
  );
}
