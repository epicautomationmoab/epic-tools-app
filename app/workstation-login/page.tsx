"use client";

import { FormEvent, useState } from "react";

export default function WorkstationLoginPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/workstation-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to open HQ Reception.");
      window.location.href = "/team/readiness";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open HQ Reception.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f5f7", padding: 24 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #dfe4e9", borderRadius: 16, padding: 32, boxShadow: "0 18px 50px rgba(20,31,45,.12)", boxSizing: "border-box" }}>
        <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ display: "block", width: 180, margin: "0 auto 24px" }} />
        <h1 style={{ margin: 0, textAlign: "center", color: "#182230" }}>HQ Reception</h1>
        <p style={{ textAlign: "center", color: "#667085", marginBottom: 24, lineHeight: 1.45 }}>Shared EpicTools workstation access. Employee actions will still require the employee's PIN.</p>
        <div style={{ position: "relative" }}>
          <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Workstation password" autoComplete="current-password" required style={{ width: "100%", height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 46px 0 12px", boxSizing: "border-box" }} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ position: "absolute", top: 0, right: 0, width: 46, height: 46, border: 0, background: "transparent", cursor: "pointer", color: "#667085" }}>
            {showPassword ? "◉" : "◎"}
          </button>
        </div>
        {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
        <button type="submit" disabled={submitting} style={{ width: "100%", height: 46, marginTop: 18, border: 0, borderRadius: 9, background: "#d5521d", color: "#fff", fontWeight: 800, cursor: submitting ? "wait" : "pointer" }}>{submitting ? "Opening..." : "Open HQ Reception"}</button>
      </form>
    </main>
  );
}
