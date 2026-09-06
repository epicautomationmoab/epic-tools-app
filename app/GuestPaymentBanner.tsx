"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type PortalPaymentResponse = {
  reservation?: {
    balanceDueCents?: number | null;
    paymentUrl?: string | null;
  };
};

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function GuestPaymentBanner() {
  const pathname = usePathname();
  const [balanceDueCents, setBalanceDueCents] = useState(0);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  useEffect(() => {
    const match = pathname.match(/^\/guest\/([^/]+)\/?$/);
    if (!match) {
      setBalanceDueCents(0);
      setPaymentUrl(null);
      return;
    }

    const token = decodeURIComponent(match[1]);
    let cancelled = false;

    async function loadPaymentStatus() {
      try {
        const response = await fetch(`/api/guest/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;

        const data = (await response.json()) as PortalPaymentResponse;
        const due = Math.max(data.reservation?.balanceDueCents ?? 0, 0);
        const url = data.reservation?.paymentUrl ?? null;

        if (!cancelled) {
          setBalanceDueCents(due);
          setPaymentUrl(due > 0 ? url : null);
        }
      } catch {
        // The guest portal itself remains usable if payment status cannot load.
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadPaymentStatus();
    };

    void loadPaymentStatus();
    window.addEventListener("focus", loadPaymentStatus);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", loadPaymentStatus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pathname]);

  if (balanceDueCents <= 0 || !paymentUrl) return null;

  return (
    <aside
      aria-label="Reservation balance due"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "22px",
        flexWrap: "wrap",
        padding: "15px 20px",
        background: "#17202a",
        color: "#ffffff",
        borderBottom: "3px solid #db5e25",
        position: "relative",
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
        <strong style={{ fontSize: "14px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          Balance Due
        </strong>
        <span style={{ fontSize: "24px", fontWeight: 900 }}>
          {formatMoney(balanceDueCents)}
        </span>
      </div>

      <a
        href={paymentUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "42px",
          borderRadius: "10px",
          background: "#db5e25",
          color: "#ffffff",
          padding: "0 18px",
          fontSize: "14px",
          fontWeight: 900,
          textDecoration: "none",
        }}
      >
        Pay Balance Now
      </a>
    </aside>
  );
}
