"use client";

import { useEffect, useState } from "react";

const EPIC_TIME_ZONE = "America/Denver";

function formatNow(date: Date) {
  return {
    dayDate: new Intl.DateTimeFormat("en-US", {
      timeZone: EPIC_TIME_ZONE,
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      timeZone: EPIC_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(date),
  };
}

export default function HeaderClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const display = now ? formatNow(now) : { dayDate: "", time: "" };

  return (
    <div aria-live="polite" style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 7, color: "#6f7885", fontSize: 14 }}>
      <span>{display.dayDate}</span>
      <strong style={{ color: "#384252", fontVariantNumeric: "tabular-nums" }}>{display.time}</strong>
    </div>
  );
}
