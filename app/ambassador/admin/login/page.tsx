"use client";

import { FormEvent, useState } from "react";

export default function AmbassadorAdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/ambassador/admin/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to sign in.");
      window.location.href = "/ambassador/admin";
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f5f7", padding: 24, color: "#202733" }}>
    <form onSubmit={submit} style={{ width: "100%", maxWidth: 430, background: "white", border: "1px solid #dfe4ea", borderRadius: 18, padding: 32, boxShadow: "0 18px 50px rgba(20,31,45,.12)" }}>
      <img src="/epic-logo.png" alt="Epic 4X4 Adventures" style={{ display: "block", width: 190, margin: "0 auto 22px" }} />
      <h1 style={{ margin: 0, textAlign: "center", fontSize: 28 }}>Ambassador Administration</h1>
      <p style={{ textAlign: "center", color: "#68717d", lineHeight: 1.5, margin: "8px 0 24px" }}>Sign in with your Epic Tools administrator or manager account.</p>
      <label style={{ display: "grid", gap: 6, fontWeight: 800, fontSize: 13 }}>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" style={{ height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 12px" }} /></label>
      <label style={{ display: "grid", gap: 6, fontWeight: 800, fontSize: 13, marginTop: 14 }}>Password<div style={{ position: "relative" }}><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" style={{ width: "100%", height: 46, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 46px 0 12px", boxSizing: "border-box" }} /><button type="button" onClick={() => setShowPassword((v) => !v)} style={{ position: "absolute", right: 0, top: 0, width: 46, height: 46, border: 0, background: "transparent", cursor: "pointer", fontSize: 18 }} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "◉" : "◎"}</button></div></label>
      {error ? <p style={{ color: "#b42318", fontWeight: 700, fontSize: 13 }}>{error}</p> : null}
      <button type="submit" disabled={busy} style={{ width: "100%", height: 46, marginTop: 20, border: 0, borderRadius: 9, background: "#d5521d", color: "white", fontWeight: 900, cursor: busy ? "wait" : "pointer" }}>{busy ? "Signing in…" : "Sign In"}</button>
    </form>
  </main>;
}
