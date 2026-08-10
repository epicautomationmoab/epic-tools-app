"use client";

import { FormEvent, useState } from "react";

export default function EmployeeLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to sign in.");
      window.location.href = "/team/readiness";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  async function forgotPassword() {
    const normalizedEmail = email.trim();
    setError("");
    setMessage("");
    if (!normalizedEmail) {
      setError("Enter your EpicTools email first, then click Forgot password.");
      return;
    }

    setResetting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to request password reset.");
      setMessage(payload.message || "If that account exists, a reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to request password reset.");
    } finally {
      setResetting(false);
    }
  }

  const eyeButton = (showing: boolean, onClick: () => void, label: string) => (
    <button type="button" onClick={onClick} aria-label={label} title={label} style={{ position: "absolute", top: 0, right: 0, width: 46, height: 46, display: "grid", placeItems: "center", border: 0, background: "transparent", color: "#667085", cursor: "pointer" }}>
      {showing ? (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c5.5 0 9 5 9 8a8.7 8.7 0 0 1-2 4" /><path d="M6.6 6.6C4.4 8 3 10.1 3 12c0 3 3.5 8 9 8 1.4 0 2.7-.3 3.8-.8" /></svg>
      ) : (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.1 12S5.5 5 12 5s9.9 7 9.9 7-3.4 7-9.9 7S2.1 12 2.1 12z" /><circle cx="12" cy="12" r="3" /></svg>
      )}
    </button>
  );

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f5f7", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <form onSubmit={submit} style={{ width: "100%", background: "#fff", border: "1px solid #dfe4e9", borderRadius: 16, padding: 32, boxShadow: "0 18px 50px rgba(20,31,45,.12)", boxSizing: "border-box" }}>
          <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ display: "block", width: 180, margin: "0 auto 24px" }} />
          <h1 style={{ margin: 0, textAlign: "center", color: "#182230" }}>EpicTools Employee Login</h1>
          <p style={{ textAlign: "center", color: "#667085", marginBottom: 24 }}>Sign in with your individual EpicTools account.</p>

          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" required style={{ width: "100%", height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 12px", boxSizing: "border-box", marginBottom: 12 }} />

          <div style={{ position: "relative" }}>
            <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" autoComplete="current-password" required style={{ width: "100%", height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 46px 0 12px", boxSizing: "border-box" }} />
            {eyeButton(showPassword, () => setShowPassword((value) => !value), showPassword ? "Hide password" : "Show password")}
          </div>

          <div style={{ textAlign: "right", marginTop: 8 }}>
            <button type="button" disabled={resetting} onClick={() => void forgotPassword()} style={{ border: 0, background: "transparent", padding: 0, color: "#9f3f21", fontWeight: 700, cursor: resetting ? "wait" : "pointer" }}>{resetting ? "Sending reset..." : "Forgot password?"}</button>
          </div>

          {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
          {message ? <p style={{ color: "#067647", lineHeight: 1.45 }}>{message}</p> : null}

          <button type="submit" disabled={submitting} style={{ width: "100%", height: 46, marginTop: 18, border: 0, borderRadius: 9, background: "#d5521d", color: "#fff", fontWeight: 800, cursor: submitting ? "wait" : "pointer" }}>{submitting ? "Signing in..." : "Sign in"}</button>
        </form>
      </div>
    </main>
  );
}
