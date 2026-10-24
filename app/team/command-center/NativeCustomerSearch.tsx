"use client";

import { useEffect, useState } from "react";
import NativeCustomerDetail from "./NativeCustomerDetail";

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
  const [selected, setSelected] = useState<Customer | null>(null);
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  useEffect(() => {
    if (!selected) { setDetails(null); return; }
    const controller = new AbortController();
    const q = new URLSearchParams();
    if (selected.contact_id) q.set("contact", selected.contact_id);
    else if (selected.reservation_id) q.set("reservation", selected.reservation_id);
    else if (selected.phone) q.set("phone", selected.phone);
    else if (selected.email) q.set("email", selected.email);
    if (!q.toString()) { setDetailError("This customer has no usable identifier."); return; }
    setDetailLoading(true); setDetailError(""); setDetails(null);
    fetch("/api/team/command-center/customer-detail?" + q, { signal: controller.signal, cache: "no-store" })
      .then(async response => { const result = await response.json(); if (!response.ok) throw new Error(result.error || "Details unavailable"); return result.customer; })
      .then(customer => { if (!controller.signal.aborted) setDetails(customer); })
      .catch(error => { if (!controller.signal.aborted) setDetailError(error instanceof Error ? error.message : "Details unavailable"); })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selected]);
  useEffect(() => {
    const q = query.trim();
    setSelected(null);
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
            <button type="button" onClick={() => setSelected(row)} style={{ cursor: "pointer", marginTop: 9, padding: "8px 12px", borderRadius: 7, border: "1px solid #bccbdd", background: "#f5f8fc" }}>View customer details</button>
            <p style={{ fontSize: 12, color: "#8a5560" }}>
              Full Customer 360 actions will become available here after the native detail and messaging dependencies pass tests.
            </p>
          </article>
        ))}
      </div>}
      {selected && <section aria-label="Customer details" style={{ marginTop: 20, borderTop: "2px solid #d9e2ef", paddingTop: 16 }}>
        <button type="button" onClick={() => setSelected(null)}>Close details</button>
        <h2>{selected.customer_name || "Customer details"}</h2>
        {detailLoading && <p role="status">Loading customer history...</p>}
        {detailError && <p role="alert">{detailError}</p>}
        {details && <NativeCustomerDetail key={selected.identity_key} value={details} />}
      </section>}
    </section>
  );
}
