"use client";

import { useMemo, useState } from "react";
import type { ArrivalBoardRow } from "@/lib/supabase";
import styles from "./ArrivalBoard.module.css";

type Filter = "all" | "tour" | "rental";

function formatWallTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatVehicleCount(count?: number | null) {
  if (!count) return null;
  return `${count} ${count === 1 ? "Vehicle" : "Vehicles"}`;
}

export default function ArrivalBoardDisplay({
  rows,
}: {
  rows: ArrivalBoardRow[];
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const visibleRows = useMemo(
    () =>
      filter === "all"
        ? rows
        : rows.filter((row) => row.business_line === filter),
    [filter, rows],
  );

  return (
    <>
      <section className={styles.controls} aria-label="Arrival type filter">
        {(["all", "tour", "rental"] as const).map((value) => (
          <button
            type="button"
            key={value}
            onClick={() => setFilter(value)}
            className={
              filter === value ? styles.controlActive : styles.control
            }
          >
            {value === "all"
              ? "All Arrivals"
              : value === "tour"
                ? "Tours"
                : "Rentals"}
          </button>
        ))}
      </section>

      <section className={styles.columnHeader} aria-hidden="true">
        <span>Time</span>
        <span>Guest</span>
        <span>Reservation</span>
        <span>Direction</span>
        <span>Kiosk Code</span>
      </section>

      <section className={styles.rows}>
        {visibleRows.map((row) => {
          const isKiosk = row.board_action_type === "kiosk";

          const details = [
            row.business_line === "rental" ? row.rental_duration : null,
            formatVehicleCount(row.total_vehicle_count),
          ].filter(Boolean);

          return (
            <article
              className={`${styles.row} ${
                row.business_line === "rental"
                  ? styles.rentalRow
                  : styles.tourRow
              }`}
              key={`${row.confirmation_code}-${row.visit_start_time}-${row.business_line}`}
            >
              <div className={styles.time}>
                {formatWallTime(row.visit_start_time)}
              </div>

              <div className={styles.guest}>
                <strong>{row.customer_name}</strong>
              </div>

              <div className={styles.activity}>
                <strong>
                  {row.product_display_name || row.board_activity_label}
                </strong>
                {details.length ? <span>{details.join(" • ")}</span> : null}
              </div>

              <div
                className={`${styles.action} ${
                  isKiosk ? styles.kiosk : styles.agentReady
                }`}
              >
                <span className={styles.directionIcon} aria-hidden="true">
                  {isKiosk ? "→" : "🎉"}
                </span>

                <span className={styles.directionText}>
                  {isKiosk ? "Proceed to Kiosk" : "See Epic Team Member"}
                </span>
              </div>

              <div className={styles.codeBlock}>
                <span>Enter Code</span>
                <strong>{row.customer_phone_last_four || "----"}</strong>
              </div>
            </article>
          );
        })}

        {!visibleRows.length ? (
          <div className={styles.empty}>
            <img
              src="/epic-logo-black.png"
              alt=""
              className={styles.emptyLogo}
            />
            <h2>
              No {filter === "all" ? "arrivals" : `${filter}s`} are currently
              waiting.
            </h2>
            <p>
              Your name will appear here as your reservation time approaches.
            </p>
          </div>
        ) : null}
      </section>
    </>
  );
}