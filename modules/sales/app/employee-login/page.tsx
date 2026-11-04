"use client";

import { FormEvent, useState } from "react";

export default function EmployeeLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/sales/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to sign in.");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="loginPage">
      <form onSubmit={submit} className="loginCard">
        <div className="accentBar" />
        <img
          src="https://raw.githubusercontent.com/epicautomationmoab/epic-tools-app/main/public/epic-logo-black.png"
          alt="Epic 4X4 Adventures"
          className="epicLogo"
        />
        <h1 className="productName">
          Epic<span>C360</span>
        </h1>
        <p className="subtitle">Sign in with your EpicTools employee account.</p>

        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          required
        />

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <style jsx>{`
        .loginPage {
          min-height: 100vh;
          display: grid;
          place-items: center;
          padding: 24px;
          background:
            radial-gradient(circle at 50% 30%, rgba(255, 106, 36, 0.08), transparent 34%),
            #f3f5f7;
        }

        .loginCard {
          position: relative;
          width: 100%;
          max-width: 440px;
          overflow: hidden;
          box-sizing: border-box;
          padding: 34px 32px 32px;
          background: #fff;
          border: 1px solid #dfe4e9;
          border-radius: 18px;
          box-shadow: 0 20px 55px rgba(20, 31, 45, 0.13);
        }

        .accentBar {
          position: absolute;
          inset: 0 0 auto;
          height: 5px;
          background: linear-gradient(90deg, #d71920, #ff6a24);
        }

        .epicLogo {
          display: block;
          width: 150px;
          max-height: 66px;
          object-fit: contain;
          margin: 4px auto 15px;
        }

        .productName {
          margin: 0;
          text-align: center;
          color: #182230;
          font-size: 42px;
          line-height: 1;
          letter-spacing: -0.045em;
          font-weight: 900;
        }

        .productName span {
          color: #e0521d;
        }

        .subtitle {
          margin: 17px 0 26px;
          text-align: center;
          color: #667085;
          font-size: 16px;
          line-height: 1.45;
        }

        input {
          width: 100%;
          height: 50px;
          box-sizing: border-box;
          border: 1px solid #cfd6de;
          border-radius: 10px;
          padding: 0 14px;
          margin-bottom: 12px;
          background: #fff;
          color: #182230;
          outline: none;
          font-size: 16px;
          transition: border-color 120ms ease, box-shadow 120ms ease;
        }

        input:focus {
          border-color: #ff9a69;
          box-shadow: 0 0 0 3px rgba(255, 106, 36, 0.12);
        }

        .error {
          margin: 2px 0 0;
          color: #b42318;
          font-size: 14px;
          font-weight: 700;
        }

        button {
          width: 100%;
          height: 48px;
          margin-top: 8px;
          border: 0;
          border-radius: 10px;
          background: #d9521e;
          color: #fff;
          font-weight: 900;
          font-size: 17px;
          transition: background 120ms ease, transform 120ms ease;
        }

        button:hover:not(:disabled) {
          background: #c94717;
        }

        button:active:not(:disabled) {
          transform: translateY(1px);
        }
      `}</style>
    </main>
  );
}
