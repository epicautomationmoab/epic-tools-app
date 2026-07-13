"use client";

import { useEffect, useState } from "react";
import type { ReadinessRow } from "@/lib/supabase";

function formatWallTime(value: string) {
  const match = value.match(/\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
  if (!match) return value;
  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function formatDate(value: string) {
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(`${match[2]}/${match[3]}/${match[1]}`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function mpwrLabel(row: ReadinessRow) {
  const expected = row.expected_guest_count ?? "?";
  return `0/${expected}`;
}

function hasAttention(row: ReadinessRow) {
  return (row.attention_flags ?? []).some((flag) => flag !== "mpwr_check");
}

function OhvCell({ row }: { row: ReadinessRow }) {
  if (row.business_line !== "rental") return <span className="ohvStatus ohvGood">N/A</span>;
  if (row.ohv_certificate_uploaded) return <span className="ohvStatus ohvGood">✓</span>;
  return <span className="ohvStatus ohvBad">✕</span>;
}

export default function ReadinessTable({ rows }: { rows: ReadinessRow[] }) {
  const [selected, setSelected] = useState<ReadinessRow | null>(null);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  return (
    <>
      <section className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Visit</th><th>Guest</th><th>Activity</th><th>Epic Docs</th>
              <th>MPWR</th><th>Bal</th><th>OHV</th><th>Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const due = row.amount_due_cents ?? 0;
              return (
                <tr key={`${row.confirmation_code}-${row.visit_start_time}-${row.product_display_name}`}>
                  <td><div className="mainLine">{formatDate(row.visit_start_time)}</div><div className="subLine">{formatWallTime(row.visit_start_time)}</div></td>
                  <td><div className="mainLine">{row.customer_name}</div></td>
                  <td><div className="mainLine">{row.product_display_name}</div></td>
                  <td>
                    <div className="cue"><i className={`dot ${row.epic_document_count_color || "gray"}`} />{row.epic_document_count_label}</div>
                    <div className="subLine">{row.tripworks_booking_url ? <a className="inlineLink" href={row.tripworks_booking_url} target="_blank" rel="noreferrer">{row.confirmation_code}</a> : row.confirmation_code}</div>
                  </td>
                  <td>
                    <div className="cue"><i className="dot red" />{mpwrLabel(row)}</div>
                    <div className="subLine">{row.mpwr_reservation_url && row.mpwr_confirmation_number ? <a className="inlineLink" href={row.mpwr_reservation_url} target="_blank" rel="noreferrer">{row.mpwr_confirmation_number}</a> : "Missing"}</div>
                  </td>
                  <td>{due > 0 ? <i className="money moneyDue">$</i> : <i className="money moneyPaid">$0</i>}</td>
                  <td><OhvCell row={row} /></td>
                  <td><button type="button" className={`reviewButton ${hasAttention(row) ? "" : "clear"}`} onClick={() => setSelected(row)}>{hasAttention(row) ? "Review" : "Open"}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? <div className="emptyState">No rows loaded yet.</div> : null}
      </section>

      {selected ? (
        <div className="drawerBackdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <aside className="readinessDrawer" role="dialog" aria-modal="true" aria-label={`${selected.customer_name} reservation details`} onMouseDown={(event) => event.stopPropagation()}>
            <header className="drawerHeader">
              <div><p className="eyebrow">Reservation Details</p><h2>{selected.customer_name}</h2><p className="drawerSubhead">{formatDate(selected.visit_start_time)} · {formatWallTime(selected.visit_start_time)} · {selected.product_display_name}</p></div>
              <button className="drawerClose" type="button" onClick={() => setSelected(null)} aria-label="Close drawer">×</button>
            </header>

            <section className="drawerFacts">
              <div><span>Confirmation</span><strong>{selected.confirmation_code}</strong></div>
              <div><span>Epic Docs</span><strong>{selected.epic_document_count_label}</strong></div>
              <div><span>MPWR</span><strong>{selected.mpwr_confirmation_number || "Missing"}</strong></div>
              <div><span>Balance</span><strong>{(selected.amount_due_cents ?? 0) > 0 ? `$${((selected.amount_due_cents ?? 0) / 100).toFixed(2)}` : "$0"}</strong></div>
            </section>

            <section className="drawerSection">
              <h3>Epic Waivers</h3>
              {(selected.epic_document_signers ?? []).length ? (
                <div className="signerList">
                  {(selected.epic_document_signers ?? []).map((signer, index) => (
                    <div className="signerRow" key={`${signer.name}-${index}`}>
                      <div className="signerIdentity"><span className="childMark">{signer.is_minor_or_child ? "👶🏻" : "✓"}</span><strong>{signer.name}</strong><small>{signer.is_minor_or_child ? "Child — cannot drive" : signer.is_waiver_adult ? "Adult signer" : "Signer"}</small></div>
                      {signer.document_url ? <a className="waiverLink" href={signer.document_url} target="_blank" rel="noreferrer">Open Waiver</a> : <span className="missingLink">No link</span>}
                    </div>
                  ))}
                </div>
              ) : <p className="drawerEmpty">No Epic waiver records are attached yet.</p>}
            </section>

            <section className="drawerSection">
              <h3>Reservation Links</h3>
              <div className="drawerLinks">
                {selected.tripworks_booking_url ? <a href={selected.tripworks_booking_url} target="_blank" rel="noreferrer">Open TripWorks</a> : null}
                {selected.mpwr_reservation_url ? <a href={selected.mpwr_reservation_url} target="_blank" rel="noreferrer">Open MPWR</a> : null}
              </div>
            </section>

            {(selected.attention_flags ?? []).length ? <section className="drawerSection"><h3>Attention</h3><div className="flagList">{(selected.attention_flags ?? []).map((flag) => <span key={flag}>{flag.replaceAll("_", " ")}</span>)}</div></section> : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}
