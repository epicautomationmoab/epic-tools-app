"use client";

import { FormEvent, useState } from "react";

export default function PreviewLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/preview-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Unable to sign in.");
        return;
      }

      window.location.href = "/team/readiness";
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f3f5f7",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #dfe4e9",
          borderRadius: 16,
          padding: 32,
          boxShadow: "0 18px 50px rgba(20, 31, 45, 0.12)",
        }}
      >
        <img
          src="/epic-logo.png"
          alt="Epic 4X4 Adventures"
          style={{
            display: "block",
            width: 180,
            margin: "0 auto 24px",
          }}
        />

        <h1 style={{ margin: 0, textAlign: "center", color: "#182230" }}>
          EpicTools Preview
        </h1>

        <p style={{ textAlign: "center", color: "#667085", marginBottom: 24 }}>
          Enter the team preview password.
        </p>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          required
          placeholder="Password"
          style={{
            width: "100%",
            height: 46,
            border: "1px solid #cfd6de",
            borderRadius: 9,
            padding: "0 12px",
            font: "inherit",
            boxSizing: "border-box",
          }}
        />

        {error ? (
          <p style={{ color: "#b42318", marginBottom: 0 }}>{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            height: 46,
            marginTop: 18,
            border: 0,
            borderRadius: 9,
            background: "#d5521d",
            color: "#fff",
            fontWeight: 800,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting ? "Opening..." : "Open EpicTools"}
        </button>
      </form>
    </main>
  );
}
