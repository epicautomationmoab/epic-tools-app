"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Leads.module.css";

export type LeadRow = {
  id: string;
  customer_name: string | null;
  email: string | null;
  phone_e164: string | null;
  activity_date: string;
  activity_window_start: string;
  activity_window_end: string;
  shopping_started_at: string | null;
  shopping_last_activity_at: string | null;
  lead_value_cents: number;
  draft_count: number;
  source_method: string | null;
  assigned_rep_name: string | null;
  primary_draft_trip_id: number | null;
  contact_id: string | null;
  claimed_at: string | null;
  claimed_by_profile_id: string | null;
  claimed_by_name: string | null;
  is_past_guest: boolean;
  prior_booking_count: number;
  last_prior_booking_at: string | null;
  tripworks_customer_code: string | null;
  tripworks_is_opt_in: boolean | null;
  tripworks_identity_verified_at: string | null;
};

export type LeadDraft = {
  id: string;
  tripworks_trip_id: number;
  confirmation_code: string | null;
  customer_name: string | null;
  email: string | null;
  phone_e164: string | null;
  activity_date: string;
  start_time: string | null;
  experience_name: string | null;
  option_name: string | null;
  value_cents: number | null;
  trip_method: string | null;
  created_by_name: string | null;
  tripworks_created_at: string | null;
  last_seen_at: string | null;
};

export type LeadNote = {
  id: string;
  opportunity_id: string;
  author_name: string;
  note_text: string;
  created_at: string;
};

type CloseMode = "lost" | "retired" | null;

const LOST_REASONS = [
  ["", "Choose why we lost it…"],
  ["price", "Price"],
  ["availability", "Availability"],
  ["product_mismatch", "Product mismatch"],
  ["policy_or_qualification", "Policy / qualification"],
  ["went_elsewhere", "Went elsewhere"],
  ["plans_changed", "Plans changed"],
  ["unresponsive", "Unresponsive"],
  ["timing", "Timing / not ready"],
  ["other", "Other"],
] as const;

const RETIRED_REASONS = [
  ["", "Choose why this is being retired…"],
  ["fake_or_junk_contact", "Fake / junk contact"],
  ["duplicate", "Duplicate"],
  ["test_or_staff_activity", "Test / staff activity"],
  ["bad_data", "Bad data"],
  ["not_a_prospect", "Not actually a prospect"],
  ["other", "Other"],
] as const;

function dollars(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
}
function dateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric" }).format(parsed);
}
function dateWindowLabel(start: string, end: string) {
  if (!end || start === end) return dateLabel(start);
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return `${start} – ${end}`;
  const sameYear = a.getFullYear() === b.getFullYear();
  const left = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(a);
  const right = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(b);
  return `${left} – ${right}`;
}
function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
function tripworksActivityTimeLabel(value: string | null) {
  if (!value) return "Time not supplied";
  const match = value.match(/[T ](\d{2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  const wallClock = new Date(Date.UTC(2000, 0, 1, hour, minute));
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(wallClock);
}
function methodLabel(value: string | null) { return (value || "unknown").replaceAll("_", " "); }
function tripworksUrl(code: string | null) { return code ? `https://epic4x4.tripworks.com/trip/${encodeURIComponent(code)}/bookings` : null; }
function tripworksCustomerUrl(code: string | null) { return code ? `https://epic4x4.tripworks.com/customer/${encodeURIComponent(code)}/trips` : null; }
function optInLabel(value: boolean | null) { return value === true ? "Opted In" : value === false ? "Opted Out" : "Unknown"; }
function searchable(value: unknown) { return String(value ?? "").toLowerCase(); }

export default function LeadsTable({ leads, draftsByLead, notesByLead }: { leads: LeadRow[]; draftsByLead: Record<string, LeadDraft[]>; notesByLead: Record<string, LeadNote[]> }) {
  const [rows, setRows] = useState(leads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState(notesByLead);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [closeMode, setCloseMode] = useState<CloseMode>(null);
  const [closeReason, setCloseReason] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return rows;
    const tokens = query.split(/\s+/).filter(Boolean);
    const queryDigits = query.replace(/\D/g, "");

    return rows.filter((row) => {
      const drafts = draftsByLead[row.id] || [];
      const parts: unknown[] = [
        row.customer_name,
        row.phone_e164,
        row.email,
        row.tripworks_customer_code,
        row.source_method,
        row.assigned_rep_name,
        row.claimed_by_name,
        row.activity_window_start,
        row.activity_window_end,
        row.contact_id,
      ];
      for (const draft of drafts) {
        parts.push(
          draft.confirmation_code,
          draft.tripworks_trip_id,
          draft.customer_name,
          draft.phone_e164,
          draft.email,
          draft.experience_name,
          draft.option_name,
          draft.activity_date,
          draft.trip_method,
          draft.created_by_name,
        );
      }
      const haystack = parts.map(searchable).join(" ");
      const digits = haystack.replace(/\D/g, "");
      return tokens.every((token) => haystack.includes(token)) || (queryDigits.length >= 4 && digits.includes(queryDigits));
    });
  }, [rows, draftsByLead, searchQuery]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closeMode ? setCloseMode(null) : setSelectedId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, closeMode]);

  const selectedDrafts = selected ? draftsByLead[selected.id] || [] : [];
  const selectedNotes = selected ? notes[selected.id] || [] : [];
  const primaryDraft = selected ? selectedDrafts.find((draft) => Number(draft.tripworks_trip_id) === Number(selected.primary_draft_trip_id)) || selectedDrafts[0] : undefined;
  const customerHref = selected ? tripworksCustomerUrl(selected.tripworks_customer_code) : null;

  function resetClose() { setCloseMode(null); setCloseReason(""); setCloseNote(""); setError(""); }

  async function claimLead() {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/team/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim", opportunity_id: selected.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to claim lead.");
      setRows((current) => current.map((row) => row.id === selected.id ? { ...row, claimed_by_name: payload.claimed_by_name, claimed_at: payload.claimed_at, assigned_rep_name: payload.claimed_by_name } : row));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to claim lead."); } finally { setBusy(false); }
  }

  async function releaseLead() {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/team/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "release", opportunity_id: selected.id }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to release lead.");
      setRows((current) => current.map((row) => row.id === selected.id ? { ...row, claimed_by_profile_id: null, claimed_by_name: null, claimed_at: null, assigned_rep_name: null } : row));
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to release lead."); } finally { setBusy(false); }
  }

  async function addNote() {
    if (!selected || busy || !noteText.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/team/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "note", opportunity_id: selected.id, note_text: noteText }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to add note.");
      setNotes((current) => ({ ...current, [selected.id]: [payload.note, ...(current[selected.id] || [])] }));
      setNoteText("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to add note."); } finally { setBusy(false); }
  }

  async function closeLead() {
    if (!selected || !closeMode || !closeReason || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/team/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: closeMode === "lost" ? "mark_lost" : "retire", opportunity_id: selected.id, reason: closeReason, note_text: closeNote }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || `Unable to mark lead ${closeMode}.`);
      setRows((current) => current.filter((row) => row.id !== selected.id));
      setSelectedId(null);
      resetClose();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to close lead."); } finally { setBusy(false); }
  }

  const reasons = closeMode === "lost" ? LOST_REASONS : RETIRED_REASONS;

  return <>
    <div className={styles.searchRow}>
      <div className={styles.searchBox}>
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search name, phone, email, TW confirmation or customer code…"
          aria-label="Search open leads"
        />
        {searchQuery ? <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search">×</button> : null}
      </div>
      <div className={styles.searchCount}>{searchQuery.trim() ? `${filteredRows.length} of ${rows.length} leads` : `${rows.length} leads`}</div>
    </div>

    <section className={styles.tableWrap}>
      <table className={styles.table}>
        <thead><tr><th>Customer</th><th>Activity Window</th><th>Best Option</th><th>Method</th><th>Rep</th><th>Drafts</th><th>Lead Value</th></tr></thead>
        <tbody>{filteredRows.map((row) => {
          const draft = (draftsByLead[row.id] || []).find((item) => Number(item.tripworks_trip_id) === Number(row.primary_draft_trip_id));
          return <tr key={row.id} className={styles.clickableRow} onClick={() => { setSelectedId(row.id); setError(""); resetClose(); }}>
            <td><div className={styles.nameLine}><div className={styles.name}>{row.customer_name || "Unknown customer"}</div>{row.is_past_guest ? <span className={styles.vipBadge}>VIP · Past Guest</span> : null}</div><div className={styles.contact}>{row.phone_e164 || row.email || "No contact details"}</div></td>
            <td className={styles.activity}>{dateWindowLabel(row.activity_window_start, row.activity_window_end)}</td>
            <td><div className={styles.experience}>{draft?.experience_name || "TripWorks draft"}</div><div className={styles.contact}>{draft?.option_name || ""}</div></td>
            <td className={styles.method}>{methodLabel(row.source_method)}</td>
            <td>{row.claimed_by_name || row.assigned_rep_name || <span className={styles.muted}>Unassigned</span>}</td>
            <td><span className={styles.drafts}>{row.draft_count}</span></td>
            <td className={styles.money}>{dollars(row.lead_value_cents)}</td>
          </tr>;
        })}</tbody>
      </table>
      {filteredRows.length === 0 ? <div className={styles.empty}>{searchQuery.trim() ? "No open leads match that search." : "No open future leads found."}</div> : null}
    </section>

    {selected ? <div className={styles.drawerBackdrop} onMouseDown={() => setSelectedId(null)}>
      <aside className={styles.drawer} onMouseDown={(event) => event.stopPropagation()} aria-label="Lead details">
        <div className={styles.drawerHeader}><div><div className={styles.drawerEyebrow}>Open Sales Opportunity</div><div className={styles.drawerNameLine}><h2>{selected.customer_name || "Unknown customer"}</h2>{selected.is_past_guest ? <span className={styles.vipBadgeLarge}>VIP · Past Guest</span> : null}</div><p>{dateWindowLabel(selected.activity_window_start, selected.activity_window_end)} · {selectedDrafts.length} TripWorks draft{selectedDrafts.length === 1 ? "" : "s"}</p>{selected.is_past_guest ? <p className={styles.pastGuestDetail}>{selected.prior_booking_count} prior Epic reservation{selected.prior_booking_count === 1 ? "" : "s"}{selected.last_prior_booking_at ? ` · most recent ${dateTimeLabel(selected.last_prior_booking_at)}` : ""}</p> : null}</div><button type="button" className={styles.drawerClose} onClick={() => setSelectedId(null)} aria-label="Close lead details">×</button></div>

        <div className={styles.claimBar}><div><span className={styles.claimLabel}>Owner</span><strong>{selected.claimed_by_name || selected.assigned_rep_name || "Unclaimed"}</strong>{selected.claimed_at ? <small>Claimed {dateTimeLabel(selected.claimed_at)}</small> : null}</div>{!selected.claimed_by_name ? <button type="button" className={styles.claimButton} disabled={busy} onClick={claimLead}>{busy ? "Claiming…" : "Claim Lead"}</button> : <button type="button" className={styles.releaseButton} disabled={busy} onClick={releaseLead}>{busy ? "Releasing…" : "Release"}</button>}</div>
        {error ? <div className={styles.drawerError}>{error}</div> : null}

        <div className={styles.drawerFacts}><div><span>Lead Value</span><strong>{dollars(selected.lead_value_cents)}</strong></div><div><span>Epic Contact ID</span><strong className={styles.contactId}>{selected.contact_id || "Not linked"}</strong></div><div><span>Method</span><strong>{methodLabel(selected.source_method)}</strong></div><div><span>Best Option</span><strong>{primaryDraft?.experience_name || "TripWorks draft"}</strong></div></div>
        <div className={styles.drawerContact}>
          {selected.phone_e164 ? <div><span>Phone</span><strong>{selected.phone_e164}</strong></div> : null}
          {selected.email ? <div><span>Email</span><strong>{selected.email}</strong></div> : null}
          <div><span>SMS / Marketing</span><strong>{optInLabel(selected.tripworks_is_opt_in)}</strong></div>
          {selected.tripworks_customer_code ? <div><span>TripWorks Customer</span><strong>{selected.tripworks_customer_code}</strong>{customerHref ? <a href={customerHref} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open Customer in TripWorks ↗</a> : null}</div> : null}
        </div>

        <section className={styles.drawerSection}><h3>Sales Notes</h3><div className={styles.noteComposer}><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add a sales note, follow-up detail, objection, preference…" rows={3} /><button type="button" onClick={addNote} disabled={busy || !noteText.trim()}>{busy ? "Saving…" : "Add Note"}</button></div><div className={styles.noteList}>{selectedNotes.length ? selectedNotes.map((note) => <article key={note.id} className={styles.noteCard}><div className={styles.noteMeta}><strong>{note.author_name}</strong><span>{dateTimeLabel(note.created_at)}</span></div><p>{note.note_text}</p></article>) : <div className={styles.noNotes}>No notes yet.</div>}</div></section>

        <section className={styles.drawerSection}>
          <h3>Lead Outcome</h3>
          <p className={styles.drawerIntro}>Use Lost for a real opportunity Epic did not win. Retire is only for junk, tests, duplicates, bad data, or contacts that were never truly a sales prospect.</p>
          {!closeMode ? <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={() => { setCloseMode("lost"); setCloseReason(""); setCloseNote(""); }} style={{ border: "1px solid #d7a000", background: "#fff9df", color: "#695000", borderRadius: 9, padding: "10px 14px", fontWeight: 900, cursor: "pointer" }}>Mark Lost</button>
            <button type="button" onClick={() => { setCloseMode("retired"); setCloseReason(""); setCloseNote(""); }} style={{ border: "1px solid #d5dbe1", background: "#fff", color: "#52606d", borderRadius: 9, padding: "10px 14px", fontWeight: 900, cursor: "pointer" }}>Retire Lead</button>
          </div> : <div style={{ border: "1px solid #e2e6ea", background: "#f8fafb", borderRadius: 12, padding: 14, display: "grid", gap: 10 }}>
            <div style={{ fontWeight: 900 }}>{closeMode === "lost" ? "Mark this opportunity Lost" : "Retire this lead"}</div>
            <select value={closeReason} onChange={(event) => setCloseReason(event.target.value)} style={{ width: "100%", padding: "10px 11px", border: "1px solid #d5dce3", borderRadius: 9, background: "white", font: "inherit" }}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <textarea value={closeNote} onChange={(event) => setCloseNote(event.target.value)} rows={2} placeholder={closeMode === "lost" ? "Optional context for post-mortem or training…" : "Optional context…"} style={{ width: "100%", padding: "10px 11px", border: "1px solid #d5dce3", borderRadius: 9, font: "inherit", resize: "vertical" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={resetClose} disabled={busy} style={{ border: "1px solid #d5dbe1", background: "white", borderRadius: 8, padding: "9px 12px", fontWeight: 800, cursor: "pointer" }}>Cancel</button><button type="button" onClick={closeLead} disabled={busy || !closeReason || (closeReason === "other" && !closeNote.trim())} style={{ border: 0, background: closeMode === "lost" ? "#d7a000" : "#596572", color: "white", borderRadius: 8, padding: "9px 13px", fontWeight: 900, cursor: "pointer", opacity: busy || !closeReason || (closeReason === "other" && !closeNote.trim()) ? .5 : 1 }}>{busy ? "Saving…" : closeMode === "lost" ? "Mark Lost" : "Retire Lead"}</button></div>
          </div>}
        </section>

        <section className={styles.drawerSection}><h3>TripWorks Drafts</h3><p className={styles.drawerIntro}>Every shopping option grouped into this one 30-day shopping episode. The highest-value option sets the current Lead Value.</p><div className={styles.draftList}>{selectedDrafts.map((draft) => {
          const isPrimary = Number(draft.tripworks_trip_id) === Number(selected.primary_draft_trip_id);
          const href = tripworksUrl(draft.confirmation_code);
          return <article key={draft.id} className={`${styles.draftCard} ${isPrimary ? styles.draftCardPrimary : ""}`}>
            <div className={styles.draftCardTop}><div><div className={styles.draftExperience}>{draft.experience_name || "TripWorks draft"}</div><div className={styles.draftOption}>{draft.option_name || "Option not supplied"} · {dateLabel(draft.activity_date)}</div></div><div className={styles.draftValue}>{dollars(draft.value_cents)}</div></div>
            <div className={styles.draftMeta}><span>{tripworksActivityTimeLabel(draft.start_time)}</span><span>{methodLabel(draft.trip_method)}</span>{draft.created_by_name ? <span>Created by {draft.created_by_name}</span> : null}<span>{draft.confirmation_code || `TW #${draft.tripworks_trip_id}`}</span>{href ? <a href={href} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open in TripWorks ↗</a> : null}</div>
            {isPrimary ? <div className={styles.highestBadge}>Sets Lead Value</div> : null}
          </article>;
        })}</div></section>
      </aside>
    </div> : null}
  </>;
}
