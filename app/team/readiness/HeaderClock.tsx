"use client";

import { useEffect, useState } from "react";
import styles from "./ReadinessShell.module.css";

function formatNow(date: Date) {
  return {
    dayDate: new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
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
    <div className={styles.liveDateTime} aria-live="polite">
      <span>{display.dayDate}</span>
      <strong>{display.time}</strong>
    </div>
  );
}
