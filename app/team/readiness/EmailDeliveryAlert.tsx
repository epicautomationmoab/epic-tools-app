"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type IncidentSummary = {
  activeCount: number;
  confirmationCodes: string[];
};

export default function EmailDeliveryAlert() {
  const [summary, setSummary] = useState<IncidentSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/guest-communications/delivery-incidents", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json() as IncidentSummary;
        if (!cancelled) setSummary(body);
      } catch {
        // Readiness remains usable even if the delivery-status helper cannot load.
      }
    }

    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!summary?.activeCount) return null;

  return (
    <Link
      href="/team/email-delivery"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 18,
        marginBottom: 14,
        padding: "12px 15px",
        borderRadius: 10,
        border: "1px solid #f0c0b9",
        background: "#fff1ef",
        color: "#8d3025",
        textDecoration: "none",
        fontWeight: 800,
      }}
    >
      <span>
        Email Delivery: {summary.activeCount} guest {summary.activeCount === 1 ? "email needs" : "emails need"} attention
      </span>
      <span style={{ fontSize: 12, color: "#a73b2e" }}>Open delivery queue →</span>
    </Link>
  );
}
