"use client";

import { useEffect, useState } from "react";

type Customer = {
  identity_key: string;
  contact_id: string | null;
  reservation_id: string | null;
  confirmation_code: string | null;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  reservation_count: number;
  has_open_lead: boolean;
  last_seen_at: string | null;
};

/**
 * First native C360 vertical: search-only customer index.
 * This UI uses EpicTools' own API, not Epic Sales or a web iframe.
 * Source-of-truth matching remains in the existing Supabase RPCs.
 */
export default function NativeCustomerSearch() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setRows([]); setStatus("idle"); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      setError("");
      try {
        const response = await fetch("/api/team/command-center/customers?q=" + encodeURIComponent(q), {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to search customers.");
        if (!controller.signal.aborted) { setRows(result.customers || []); setStatus("ready"); }
      } catch (e) {
        if (!controller.signal.aborted) {
          setStatus("error");
          setError(e instanceof Error ? e.message : "Customer search unavailable.");
        }
      }
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  return (
    <section aria-label="Native Epic customer search">
      <label htmlFor="native-customer-search" style={{ display: "block", fontWeight: 700, marginBottom: 9 }}>
        Find a customer
      </label>
      <input id="native-customer-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
        placeholder="Name, phone, email, or reservation" autoComplete="off"
        style={{ width: "100%", border: "1px solid #bdc9d6", borderRadius: 9, padding: 13, fontSize: 15, boxSizing: "border-box" }}/>
      {status === "loading" && <p role="status">Searching...</p>}
      {status === "error" && <p role="alert" style={{ color: "#aa2020" }}>{error}</p>}
      {status === "ready" && !rows.length && <p>No matching customer records.</p>}
      {rows.length > 0 && <div style={{ display: "grid", gap: 10, marginTop: 15 }}>
        {rows.map((row, index) => (
          <article key={row.identity_key || String(index)} style={{ border: "1px solid #e2e7ed", borderRadius: 11, padding: 14, background: "#fff" }}>
            <strong>{row.customer_name || "Unnamed customer"}</strong>
            <div style={{ fontSize: 13, color: "#536579", marginTop: 5 }}>
              {[row.phone, row.email].filter(Boolean).join(" | ")}
            </div>
            <div style={{ fontSize: 12, color: "#647487", marginTop: 5 }}>
              {row.reservation_count || 0} known reservations
              {row.has_open_lead ? " | Open sales opportunity" : ""}
            </div>
            <p style={{ fontSize: 12, color: "#8a5560" }}>
              Full Customer 360 actions will become available here after the native detail and messaging dependencies pass tests.
            </p>
          </article>
        ))}
      </div>}
    </section>
  );
}
