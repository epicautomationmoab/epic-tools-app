"use client";

import { useState } from "react";

type EditableNoteProps = {
  scope: "lead" | "readiness";
  noteId: string;
  noteText: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  author?: string | null;
  onSaved?: (note: Record<string, unknown>) => void;
};

function changed(createdAt?: string | null, updatedAt?: string | null) {
  if (!createdAt || !updatedAt) return false;
  return Math.abs(new Date(updatedAt).getTime() - new Date(createdAt).getTime()) > 1000;
}

function editedLabel(updatedAt?: string | null) {
  if (!updatedAt) return "Edited";
  return `Edited ${new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Denver",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(updatedAt))}`;
}

export default function EditableNote({ scope, noteId, noteText, createdAt, updatedAt, author, onSaved }: EditableNoteProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(noteText);
  const [savedText, setSavedText] = useState(noteText);
  const [savedUpdatedAt, setSavedUpdatedAt] = useState(updatedAt || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const text = value.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/team/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope, note_id: noteId, note_text: text }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to update note.");
      const note = payload.note || {};
      const nextText = String(note.note_text || text);
      const nextUpdatedAt = note.updated_at ? String(note.updated_at) : new Date().toISOString();
      setSavedText(nextText);
      setValue(nextText);
      setSavedUpdatedAt(nextUpdatedAt);
      setEditing(false);
      onSaved?.(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update note.");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return <div style={{ display: "grid", gap: 8, width: "100%" }}>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={4000}
        autoFocus
        style={{ width: "100%", minHeight: 76, resize: "vertical", padding: "10px 12px", border: "1px solid #cfd8df", borderRadius: 9, font: "inherit", lineHeight: 1.45 }}
      />
      {error ? <div style={{ color: "#a6372d", fontSize: 12, fontWeight: 750 }}>{error}</div> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={busy || !value.trim()} onClick={save} style={{ border: 0, borderRadius: 8, padding: "7px 11px", fontWeight: 850, background: "#f6c600", cursor: "pointer" }}>{busy ? "Saving…" : "Save"}</button>
        <button type="button" disabled={busy} onClick={() => { setValue(savedText); setError(""); setEditing(false); }} style={{ border: "1px solid #d6dde3", borderRadius: 8, padding: "7px 11px", fontWeight: 750, background: "white", cursor: "pointer" }}>Cancel</button>
      </div>
    </div>;
  }

  return <div style={{ width: "100%" }}>
    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{savedText}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5, fontSize: 11, color: "#7a8792" }}>
      {author ? <span>{author}</span> : null}
      {changed(createdAt, savedUpdatedAt) ? <span>{editedLabel(savedUpdatedAt)}</span> : null}
      <button type="button" onClick={() => setEditing(true)} aria-label="Edit note" title="Edit note" style={{ marginLeft: "auto", border: 0, background: "transparent", padding: "2px 4px", cursor: "pointer", fontSize: 14 }}>✎</button>
    </div>
  </div>;
}
