"use client";

import { useEffect, useMemo, useState } from "react";
import type { ArrivalBoardRow } from "@/lib/supabase";
import styles from "./ArrivalBoard.module.css";
import { expBoardDirection, type ExpTeamStatus } from "@/lib/exp/team-status";

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

function shortVehicleModel(model: string) {
  return model
    .replace(/^2026\s+/i, "")
    .replace(/Polaris\s+RZR\s+/i, "")
    .replace(/RZR\s+/i, "")
    .replace(/\s+1000\s+Ultimate$/i, "")
    .replace(/Turbo\s+Pro\s+S/i, "Pro S")
    .replace(/XP\s+S/i, "XP S")
    .trim();
}

function reservationLabel(row: ArrivalBoardRow) {
  if (row.business_line !== "rental") {
    return row.product_display_name || row.board_activity_label;
  }

  const breakdown = (row.vehicle_breakdown ?? []).filter(
    (item) => item.quantity > 0 && item.model?.trim(),
  );

  if (!breakdown.length) {
    return row.product_display_name || row.board_activity_label;
  }

  return breakdown
    .map((item) => {
      const model = shortVehicleModel(item.model);
      return item.quantity > 1 ? `${item.quantity}× ${model}` : model;
    })
    .join(" + ");
}

export default function ArrivalBoardDisplay({
  rows,
  expStatuses = {},
}: {
  rows: ArrivalBoardRow[];
  expStatuses?: Record<string, ExpTeamStatus>;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [verifiedStatuses,setVerifiedStatuses] = useState<Record<string,ExpTeamStatus>>({});
  useEffect(()=>{
    if(process.env.NEXT_PUBLIC_EXP_VIDEO_PREVIEW!=="true")return;
    let active=true;
    const rentals=rows.filter(r=>r.business_line==="rental"&&r.readiness_id).slice(0,60);
    async function refresh(){
      const next:Record<string,ExpTeamStatus>={};
      for(const row of rentals){
        if(!active)break;
        try{
          const response=await fetch(`/api/team/exp/readiness?readinessId=${encodeURIComponent(row.readiness_id!)}`,{cache:"no-store"});
          if(!response.ok)continue;
          const data=await response.json();
          if(data.expReady===true&&data.assessmentStatus?.allReady===true)next[row.readiness_id!]=data.assessmentStatus;
        }catch{/* retain original safe routing on lookup failure */}
      }
      if(active)setVerifiedStatuses(next);
    }
    void refresh();const interval=window.setInterval(()=>void refresh(),30000);
    return()=>{active=false;window.clearInterval(interval)};
  },[rows]);

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
          const exp = (row.readiness_id ? verifiedStatuses[row.readiness_id] : undefined) ?? expStatuses[row.confirmation_code] ?? null;
          const isKiosk = expBoardDirection(row.board_action_type === "kiosk", row.business_line, exp) === "kiosk";

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
                <strong>{reservationLabel(row)}</strong>
                {details.length ? <span>{details.join(" • ")}</span> : null}
                
              </div>

              <div
                className={`${styles.action} ${
                  isKiosk ? styles.kiosk : styles.agentReady
                }`}
              >
                {exp?.allReady && row.business_line === "rental" ? <span style={{background:"#def2e4",color:"#087238",fontSize:12,fontWeight:800,borderRadius:20,padding:"4px 10px",letterSpacing:".03em",whiteSpace:"nowrap"}}>XPRESS CHECKOUT</span> : null}
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