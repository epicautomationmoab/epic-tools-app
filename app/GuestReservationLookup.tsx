"use client";

import { FormEvent, useState } from "react";
import styles from "./GuestLookup.module.css";

export default function Home() {
  const [confirmationCode, setConfirmationCode] = useState("");
  const [lastName, setLastName] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function findReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/guest/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmationCode,
          lastName,
          website,
        }),
      });

      const data = (await response.json()) as {
        portalPath?: string;
        error?: string;
      };

      if (!response.ok || !data.portalPath) {
        throw new Error(
          data.error ??
            "We could not locate that reservation. Please check your information and try again.",
        );
      }

      window.location.assign(data.portalPath);
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "We could not locate that reservation. Please check your information and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <img
          src="/epic-logo.png"
          alt="Epic 4X4 Adventures"
          className={styles.logo}
        />

        <p className={styles.eyebrow}>Your Epic Adventure</p>
        <h1 className={styles.title}>Find My Reservation</h1>
        <p className={styles.intro}>
          Enter the confirmation number and last name from your reservation to
          open your guest portal.
        </p>

        <form className={styles.form} onSubmit={findReservation}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="confirmationCode">
              Confirmation number
            </label>
            <input
              className={styles.input}
              id="confirmationCode"
              name="confirmationCode"
              autoCapitalize="characters"
              autoComplete="off"
              value={confirmationCode}
              onChange={(event) => setConfirmationCode(event.target.value)}
              placeholder="Example: ABCD-EFGH"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="lastName">
              Last name
            </label>
            <input
              className={styles.input}
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </div>

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

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Finding your reservation…" : "Open My Reservation"}
          </button>
        </form>

        <p className={styles.help}>
          Already received a reservation link? Open that link for immediate
          access. Need help? Call Epic at <a href="tel:+14352202700">435-220-2700</a>.
        </p>
      </section>
    </main>
  );
}
