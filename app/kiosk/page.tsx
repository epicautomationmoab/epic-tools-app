"use client";

import { FormEvent, useRef, useState } from "react";
import styles from "./KioskLookup.module.css";

export default function KioskPage() {
  const [lastFour, setLastFour] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function openReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/kiosk/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lastFour, website }),
      });

      const data = (await response.json()) as { portalPath?: string; error?: string };
      if (!response.ok || !data.portalPath) {
        throw new Error(data.error ?? "We could not find today's reservation.");
      }

      window.location.assign(data.portalPath);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Please see an Epic team member for assistance.",
      );
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <img src="/epic-logo-black.png" alt="Epic 4X4 Adventures" className={styles.logo} />

        <p className={styles.eyebrow}>Welcome to Epic 4X4 Adventures</p>
        <h1 className={styles.title}>Open Your Guest Portal</h1>
        <p className={styles.intro}>
          Enter the last four digits of the phone number on today&apos;s reservation.
        </p>

        <form className={styles.form} onSubmit={openReservation}>
          <label className={styles.label} htmlFor="lastFour">
            Kiosk code
          </label>
          <input
            ref={inputRef}
            className={styles.input}
            id="lastFour"
            name="lastFour"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            autoComplete="off"
            autoFocus
            value={lastFour}
            onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="0000"
            required
          />

          <div className={styles.honeypot} aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <button className={styles.button} type="submit" disabled={loading || lastFour.length !== 4}>
            {loading ? "Opening your reservation…" : "Open My Reservation"}
          </button>
        </form>

        <p className={styles.help}>Need help? Please see an Epic team member.</p>
      </section>
    </main>
  );
}
