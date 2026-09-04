"use client";

import { FormEvent, useState } from "react";

export default function AmbassadorLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/ambassador/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to sign in.");
      window.location.href = "/ambassador";
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); }
    finally { setSubmitting(false); }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f1f3f5", padding: 24 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 430, background: "#fff", border: "1px solid #dfe4e9", borderRadius: 18, padding: 34, boxShadow: "0 18px 50px rgba(20,31,45,.12)" }}>
        <img src="/epic-logo-black.png" alt="Epic 4X4 Adventures" style={{ display: "block", width: 190, margin: "0 auto 18px" }} />
        <h1 style={{ margin: 0, textAlign: "center", color: "#202733", fontSize: 28 }}>Epic 4X4 Ambassador</h1>
        <p style={{ textAlign: "center", color: "#68717d", margin: "8px 0 26px" }}>Partner referral and rewards portal</p>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required autoComplete="email" style={{ width: "100%", height: 48, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 12px", boxSizing: "border-box", marginBottom: 12 }} />
        <div style={{ position: "relative" }}>
          <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required autoComplete="current-password" style={{ width: "100%", height: 48, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 46px 0 12px", boxSizing: "border-box" }} />
          <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} style={{ position: "absolute", right: 8, top: 7, width: 34, height: 34, border: 0, background: "transparent", cursor: "pointer", fontSize: 18 }}>{showPassword ? "🙈" : "👁"}</button>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 9 }}><button type="button" onClick={() => window.location.href = "/ambassador/forgot-password"} style={{ border: 0, background: "transparent", color: "#d5521d", fontWeight: 800, cursor: "pointer", padding: 0 }}>Forgot password?</button></div>
        {error ? <p style={{ color: "#b42318", marginBottom: 0 }}>{error}</p> : null}
        <button type="submit" disabled={submitting} style={{ width: "100%", height: 48, marginTop: 20, border: 0, borderRadius: 9, background: "#d5521d", color: "#fff", fontWeight: 800, cursor: submitting ? "wait" : "pointer" }}>{submitting ? "Signing in..." : "Sign in"}</button>
      </form>
    </main>
  );
}
