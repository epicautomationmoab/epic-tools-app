"use client";

import { FormEvent, useRef, useState } from "react";
import styles from "./KioskLookup.module.css";

type ReservationMatch = {
  portalPath: string;
  confirmationCode: string;
  visitStartTime: string | null;
};

type LookupResponse = {
  portalPath?: string;
  matches?: ReservationMatch[];
  error?: string;
};

function formatVisitTime(value: string | null) {
  if (!value) {
    return "Date and time unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date and time unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Denver",
    timeZoneName: "short",
  }).format(date);
}

export default function KioskPage() {
  const [lastFour, setLastFour] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matches, setMatches] = useState<ReservationMatch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function openReservation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMatches([]);

    try {
      const response = await fetch("/api/kiosk/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lastFour,
          website,
        }),
      });

      const data = (await response.json()) as LookupResponse;

      if (!response.ok) {
        throw new Error(
          data.error ??
            "We could not find today's reservation.",
        );
      }

      if (data.portalPath) {
        window.location.assign(data.portalPath);
        return;
      }

      if (data.matches && data.matches.length > 0) {
        setMatches(data.matches);
        return;
      }

      throw new Error(
        data.error ??
          "We could not find today's reservation.",
      );
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

  function startOver() {
    setMatches([]);
    setError("");
    setLastFour("");

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <img
          src="/epic-logo-black.png"
          alt="Epic 4X4 Adventures"
          className={styles.logo}
        />

        <p className={styles.eyebrow}>
          Welcome to Epic 4X4 Adventures
        </p>

        {matches.length > 1 ? (
          <>
            <h1 className={styles.title}>
              Choose Your Reservation
            </h1>

            <p className={styles.intro}>
              We found more than one reservation connected to
              that phone number. Select the reservation you would
              like to open.
            </p>

            <div className={styles.form}>
              {matches.map((match) => (
                <button
                  key={`${match.confirmationCode}-${match.portalPath}`}
                  className={styles.button}
                  type="button"
                  onClick={() =>
                    window.location.assign(match.portalPath)
                  }
                >
                  {formatVisitTime(match.visitStartTime)}
                  <br />
                  Confirmation {match.confirmationCode}
                </button>
              ))}

              <button
                className={styles.button}
                type="button"
                onClick={startOver}
              >
                Search Again
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.title}>
              Open Your Guest Portal
            </h1>

            <p className={styles.intro}>
              Enter the last four digits of the phone number on
              today&apos;s reservation.
            </p>

            <form
              className={styles.form}
              onSubmit={openReservation}
            >
              <label
                className={styles.label}
                htmlFor="lastFour"
              >
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
                onChange={(event) =>
                  setLastFour(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 4),
                  )
                }
                placeholder="0000"
                required
              />

              <div
                className={styles.honeypot}
                aria-hidden="true"
              >
                <label htmlFor="website">Website</label>

                <input
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) =>
                    setWebsite(event.target.value)
                  }
                />
              </div>

              {error ? (
                <p className={styles.error}>{error}</p>
              ) : null}

              <button
                className={styles.button}
                type="submit"
                disabled={
                  loading || lastFour.length !== 4
                }
              >
                {loading
                  ? "Finding your reservation…"
                  : "Open My Reservation"}
              </button>
            </form>
          </>
        )}

        <p className={styles.help}>
          Need help? Please see an Epic team member.
        </p>
      </section>
    </main>
  );
}