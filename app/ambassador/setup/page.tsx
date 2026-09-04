"use client";

import { FormEvent, useEffect, useState } from "react";

export default function AmbassadorSetupPage() {
  const [accessToken, setAccessToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inviteReady, setInviteReady] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access = hash.get("access_token") || "";
    const refresh = hash.get("refresh_token") || "";
    setAccessToken(access);
    setRefreshToken(refresh);
    setInviteReady(Boolean(access));
    if (access) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 8) { setError("Choose a password with at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/ambassador/auth/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken, password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to finish account setup.");
      window.location.href = "/ambassador";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to finish account setup.");
    } finally { setSubmitting(false); }
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f1f3f5", padding: 24 }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 460, background: "#fff", border: "1px solid #dfe4e9", borderRadius: 18, padding: 34, boxShadow: "0 18px 50px rgba(20,31,45,.12)" }}>
        <img src="/epic-logo-black.png" alt="Epic 4X4 Adventures" style={{ display: "block", width: 190, margin: "0 auto 18px" }} />
        <h1 style={{ margin: 0, textAlign: "center", color: "#202733", fontSize: 28 }}>Set Up Your Ambassador Account</h1>
        <p style={{ textAlign: "center", color: "#68717d", margin: "8px 0 26px", lineHeight: 1.5 }}>Create your password to access referrals, bookings, and rewards in the Epic 4X4 Ambassador portal.</p>
        {!inviteReady ? (
          <div style={{ background: "#fff4e8", border: "1px solid #f1c99e", borderRadius: 10, padding: 14, color: "#7a4517", lineHeight: 1.5 }}>This setup link is missing its invitation credentials or has already been used. Please request a new Ambassador invitation.</div>
        ) : <>
          <label style={{ display: "grid", gap: 6, color: "#39414b", fontWeight: 800, fontSize: 13 }}>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={{ width: "100%", height: 48, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 12px", boxSizing: "border-box", fontSize: 15 }} /></label>
          <label style={{ display: "grid", gap: 6, color: "#39414b", fontWeight: 800, fontSize: 13, marginTop: 14 }}>Confirm Password<input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" style={{ width: "100%", height: 48, border: "1px solid #cfd6de", borderRadius: 9, padding: "0 12px", boxSizing: "border-box", fontSize: 15 }} /></label>
          {error ? <p style={{ color: "#b42318", marginBottom: 0 }}>{error}</p> : null}
          <button type="submit" disabled={submitting} style={{ width: "100%", height: 48, marginTop: 20, border: 0, borderRadius: 9, background: "#d5521d", color: "#fff", fontWeight: 800, cursor: submitting ? "wait" : "pointer" }}>{submitting ? "Setting up account..." : "Set Up My Ambassador Account"}</button>
        </>}
        <p style={{ textAlign: "center", color: "#8a939f", fontSize: 12, margin: "20px 0 0" }}>Epic 4X4 Adventures</p>
      </form>
    </main>
  );
}
