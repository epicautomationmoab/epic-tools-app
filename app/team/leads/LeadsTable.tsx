"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Leads.module.css";

export type LeadRow = {
  id: string;
  customer_name: string | null;
  email: string | null;
  phone_e164: string | null;
  activity_date: string;
  lead_value_cents: number;
  draft_count: number;
  source_method: string | null;
  assigned_rep_name: string | null;
  primary_draft_trip_id: number | null;
  contact_id: string | null;
  claimed_at: string | null;
  claimed_by_profile_id: string | null;
  claimed_by_name: string | null;
};

export type LeadDraft = {
  id: string;
  tripworks_trip_id: number;
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

function dollars(cents: number | null | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((Number(cents) || 0) / 100);
}

function dateLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", month: "short", day: "numeric", year: "numeric" }).format(parsed);
}

function dateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function timeLabel(value: string | null) {
  if (!value) return "Time not supplied";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Denver", hour: "numeric", minute: "2-digit" }).format(parsed);
}

function methodLabel(value: string | null) {
  return (value || "unknown").replaceAll("_", " ");
}

export default function LeadsTable({ leads, draftsByLead, notesByLead }: { leads: LeadRow[]; draftsByLead: Record<string, LeadDraft[]>; notesByLead: Record<string, LeadNote[]> }) {
  const [rows, setRows] = useState(leads);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState(notesByLead);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const selectedDrafts = selected ? draftsByLead[selected.id] || [] : [];
  const selectedNotes = selected ? notes[selected.id] || [] : [];
  const primaryDraft = selected
    ? selectedDrafts.find((draft) => Number(draft.tripworks_trip_id) === Number(selected.primary_draft_trip_id)) || selectedDrafts[0]
    : undefined;

  async function claimLead() {
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/team/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", opportunity_id: selected.id }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to claim lead.");
      setRows((current) => current.map((row) => row.id === selected.id ? {
        ...row,
        claimed_by_name: payload.claimed_by_name,
        claimed_at: payload.claimed_at,
        assigned_rep_name: payload.claimed_by_name,
      } : row));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to claim lead.");
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!selected || busy || !noteText.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/team/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "note", opportunity_id: selected.id, note_text: noteText }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to add note.");
      setNotes((current) => ({
        ...current,
        [selected.id]: [payload.note, ...(current[selected.id] || [])],
      }));
      setNoteText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add note.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className={styles.tableWrap}>
        <table className={styles.table}>
          <thead><tr><th>Customer</th><th>Activity</th><th>Best Option</th><th>Method</th><th>Rep</th><th>Drafts</th><th>Lead Value</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const draft = (draftsByLead[row.id] || []).find((item) => Number(item.tripworks_trip_id) === Number(row.primary_draft_trip_id));
              return (
                <tr key={row.id} className={styles.clickableRow} onClick={() => { setSelectedId(row.id); setError(""); }}>
                  <td><div className={styles.name}>{row.customer_name || "Unknown customer"}</div><div className={styles.contact}>{row.phone_e164 || row.email || "No contact details"}</div></td>
                  <td className={styles.activity}>{dateLabel(row.activity_date)}</td>
                  <td><div className={styles.experience}>{draft?.experience_name || "TripWorks draft"}</div><div className={styles.contact}>{draft?.option_name || ""}</div></td>
                  <td className={styles.method}>{methodLabel(row.source_method)}</td>
                  <td>{row.claimed_by_name || row.assigned_rep_name || <span className={styles.muted}>Unassigned</span>}</td>
                  <td><span className={styles.drafts}>{row.draft_count}</span></td>
                  <td className={styles.money}>{dollars(row.lead_value_cents)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <div className={styles.empty}>No open future leads found.</div> : null}
      </section>

      {selected ? (
        <div className={styles.drawerBackdrop} onMouseDown={() => setSelectedId(null)}>
          <aside className={styles.drawer} onMouseDown={(event) => event.stopPropagation()} aria-label="Lead details">
            <div className={styles.drawerHeader}>
              <div>
                <div className={styles.drawerEyebrow}>Open Sales Opportunity</div>
                <h2>{selected.customer_name || "Unknown customer"}</h2>
                <p>{dateLabel(selected.activity_date)} · {selectedDrafts.length} TripWorks draft{selectedDrafts.length === 1 ? "" : "s"}</p>
              </div>
              <button type="button" className={styles.drawerClose} onClick={() => setSelectedId(null)} aria-label="Close lead details">×</button>
            </div>

            <div className={styles.claimBar}>
              <div>
                <span className={styles.claimLabel}>Owner</span>
                <strong>{selected.claimed_by_name || selected.assigned_rep_name || "Unclaimed"}</strong>
                {selected.claimed_at ? <small>Claimed {dateTimeLabel(selected.claimed_at)}</small> : null}
              </div>
              {!selected.claimed_by_name ? <button type="button" className={styles.claimButton} disabled={busy} onClick={claimLead}>{busy ? "Claiming…" : "Claim Lead"}</button> : null}
            </div>

            {error ? <div className={styles.drawerError}>{error}</div> : null}

            <div className={styles.drawerFacts}>
              <div><span>Lead Value</span><strong>{dollars(selected.lead_value_cents)}</strong></div>
              <div><span>Epic Contact ID</span><strong className={styles.contactId}>{selected.contact_id || "Not linked"}</strong></div>
              <div><span>Method</span><strong>{methodLabel(selected.source_method)}</strong></div>
              <div><span>Best Option</span><strong>{primaryDraft?.experience_name || "TripWorks draft"}</strong></div>
            </div>

            <div className={styles.drawerContact}>
              {selected.phone_e164 ? <div><span>Phone</span><strong>{selected.phone_e164}</strong></div> : null}
              {selected.email ? <div><span>Email</span><strong>{selected.email}</strong></div> : null}
            </div>

            <section className={styles.drawerSection}>
              <h3>Sales Notes</h3>
              <div className={styles.noteComposer}>
                <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add a sales note, follow-up detail, objection, preference…" rows={3} />
                <button type="button" onClick={addNote} disabled={busy || !noteText.trim()}>{busy ? "Saving…" : "Add Note"}</button>
              </div>
              <div className={styles.noteList}>
                {selectedNotes.length ? selectedNotes.map((note) => (
                  <article key={note.id} className={styles.noteCard}>
                    <div className={styles.noteMeta}><strong>{note.author_name}</strong><span>{dateTimeLabel(note.created_at)}</span></div>
                    <p>{note.note_text}</p>
                  </article>
                )) : <div className={styles.noNotes}>No notes yet.</div>}
              </div>
            </section>

            <section className={styles.drawerSection}>
              <h3>TripWorks Drafts</h3>
              <p className={styles.drawerIntro}>Every shopping option grouped into this one lead. The highest-value option sets the current Lead Value.</p>
              <div className={styles.draftList}>
                {selectedDrafts.map((draft) => {
                  const isPrimary = Number(draft.tripworks_trip_id) === Number(selected.primary_draft_trip_id);
                  return (
                    <article key={draft.id} className={`${styles.draftCard} ${isPrimary ? styles.draftCardPrimary : ""}`}>
                      <div className={styles.draftCardTop}><div><div className={styles.draftExperience}>{draft.experience_name || "TripWorks draft"}</div><div className={styles.draftOption}>{draft.option_name || "Option not supplied"}</div></div><div className={styles.draftValue}>{dollars(draft.value_cents)}</div></div>
                      <div className={styles.draftMeta}><span>{timeLabel(draft.start_time)}</span><span>{methodLabel(draft.trip_method)}</span>{draft.created_by_name ? <span>Created by {draft.created_by_name}</span> : null}<span>TW #{draft.tripworks_trip_id}</span></div>
                      {isPrimary ? <div className={styles.highestBadge}>Sets Lead Value</div> : null}
                    </article>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </>
  );
}
