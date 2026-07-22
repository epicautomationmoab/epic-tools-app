"use client";

import { useMemo, useState } from "react";
import type { ArrivalBoardRow } from "@/lib/supabase";
import styles from "./ArrivalBoard.module.css";

type Filter = "all" | "tour" | "rental";

function formatWallTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ArrivalBoardDisplay({ rows }: { rows: ArrivalBoardRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const visibleRows = useMemo(
    () => (filter === "all" ? rows : rows.filter((row) => row.business_line === filter)),
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
            className={filter === value ? styles.controlActive : styles.control}
          >
            {value === "all" ? "All Arrivals" : value === "tour" ? "Tours" : "Rentals"}
          </button>
        ))}
      </section>

      <section className={styles.columnHeader} aria-hidden="true">
        <span>Time</span>
        <span>Guest</span>
        <span>Activity</span>
        <span>Direction</span>
        <span>Enter Code</span>
      </section>

      <section className={styles.rows}>
        {visibleRows.map((row) => {
          const isKiosk = row.board_action_type === "kiosk";
          return (
            <article
              className={`${styles.row} ${row.business_line === "rental" ? styles.rentalRow : styles.tourRow}`}
              key={`${row.confirmation_code}-${row.visit_start_time}-${row.business_line}`}
            >
              <div className={styles.time}>{formatWallTime(row.visit_start_time)}</div>
              <div className={styles.guest}>
                <strong>{row.customer_name}</strong>
                <span className={styles.lineLabel}>{row.business_line === "rental" ? "Rental" : "Tour"}</span>
              </div>
              <div className={styles.activity}>{row.board_activity_label}</div>
              <div className={`${styles.action} ${isKiosk ? styles.kiosk : styles.agentReady}`}>
                {!isKiosk ? <span className={styles.sparkle}>*</span> : null}
                {isKiosk ? "Proceed to Kiosk" : "See Epic Team Member"}
              </div>
              <div className={styles.codeBlock}>
                <span>{isKiosk ? "Enter Code" : "Ready"}</span>
                <strong>{isKiosk ? row.customer_phone_last_four || "----" : "OK"}</strong>
              </div>
            </article>
          );
        })}

        {!visibleRows.length ? (
          <div className={styles.empty}>
            <img src="/epic-logo.png" alt="" className={styles.emptyLogo} />
            <h2>No {filter === "all" ? "arrivals" : `${filter}s`} are currently waiting.</h2>
            <p>Your name will appear here as your reservation time approaches.</p>
          </div>
        ) : null}
      </section>
    </>
  );
}
