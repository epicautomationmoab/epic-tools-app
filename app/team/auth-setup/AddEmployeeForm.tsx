"use client";

import { FormEvent, useState } from "react";

type Props = { onCreated: (name: string) => void | Promise<void> };

type TripWorksMatch = { id: number; full_name: string };

const initialForm = { display_name: "", email: "", role: "agent", tripworks_user_id: "", tripworks_full_name: "" };

export default function AddEmployeeForm({ onCreated }: Props) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupMatches, setLookupMatches] = useState<TripWorksMatch[]>([]);
  const [error, setError] = useState("");

  async function lookupTripWorksUser() {
    const name = form.display_name.trim();
    if (name.length < 2) {
      setLookupMessage("Enter the employee name first.");
      setLookupMatches([]);
      return;
    }

    setLookingUp(true);
    setLookupMessage("");
    setLookupMatches([]);
    setError("");

    try {
      const response = await fetch(`/api/admin/tripworks-user-lookup?name=${encodeURIComponent(name)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to look up TripWorks user.");

      const matches = Array.isArray(payload.matches) ? payload.matches as TripWorksMatch[] : [];
      if (matches.length === 0) {
        setLookupMessage("Not found yet. The employee may need to perform a TripWorks action that sends their user identity, then try again.");
        return;
      }

      if (matches.length === 1) {
        const match = matches[0];
        setForm((current) => ({
          ...current,
          tripworks_user_id: String(match.id),
          tripworks_full_name: match.full_name,
        }));
        setLookupMessage(`Found ${match.full_name} — TripWorks ID ${match.id}.`);
        return;
      }

      setLookupMatches(matches);
      setLookupMessage("More than one TripWorks user matched. Choose the correct employee below.");
    } catch (err) {
      setLookupMessage("");
      setError(err instanceof Error ? err.message : "Unable to look up TripWorks user.");
    } finally {
      setLookingUp(false);
    }
  }

  function selectMatch(match: TripWorksMatch) {
    setForm((current) => ({
      ...current,
      tripworks_user_id: String(match.id),
      tripworks_full_name: match.full_name,
    }));
    setLookupMatches([]);
    setLookupMessage(`Selected ${match.full_name} — TripWorks ID ${match.id}.`);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/team-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to add employee.");
      setForm(initialForm);
      setLookupMessage("");
      setLookupMatches([]);
      await onCreated(payload.profile.display_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add employee.");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = { width: "100%", boxSizing: "border-box" as const, marginTop: 6, border: "1px solid #d0d5dd", borderRadius: 8, padding: "10px 12px", fontSize: 14 };
  const labelStyle = { fontSize: 13, fontWeight: 700 };

  return (
    <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #e4e7ec", borderRadius: 12, padding: 18, marginBottom: 22 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 18 }}>Add Employee</h2>
      <p style={{ margin: "0 0 16px", color: "#667085", fontSize: 14 }}>Add their EpicTools profile and TripWorks identity here. After saving, send their login invitation from the employee list below.</p>
      {error ? <div style={{ padding: 10, marginBottom: 14, background: "#fef3f2", color: "#b42318", borderRadius: 8 }}>{error}</div> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 14 }}>
        <label style={labelStyle}>Employee name<input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} /></label>
        <label style={labelStyle}>EpicTools role<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={inputStyle}><option value="agent">Agent</option><option value="manager">Manager</option><option value="admin">Admin</option><option value="workstation">Workstation</option></select></label>
        <label style={labelStyle}>
          TripWorks User ID
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <input inputMode="numeric" value={form.tripworks_user_id} onChange={(e) => setForm({ ...form, tripworks_user_id: e.target.value })} style={{ ...inputStyle, marginTop: 0, minWidth: 0 }} />
            <button type="button" onClick={() => void lookupTripWorksUser()} disabled={lookingUp} style={{ border: "1px solid #d0d5dd", borderRadius: 8, padding: "0 14px", background: "#fff", color: "#344054", fontWeight: 700, cursor: lookingUp ? "wait" : "pointer", whiteSpace: "nowrap" }}>{lookingUp ? "Looking..." : "Lookup"}</button>
          </div>
        </label>
        <label style={labelStyle}>TripWorks full name<input value={form.tripworks_full_name} onChange={(e) => setForm({ ...form, tripworks_full_name: e.target.value })} placeholder="Defaults to employee name" style={inputStyle} /></label>
      </div>

      {lookupMessage ? <div style={{ marginTop: 12, color: lookupMatches.length ? "#7a4d00" : form.tripworks_user_id ? "#187a45" : "#667085", fontSize: 13, fontWeight: 650 }}>{lookupMessage}</div> : null}
      {lookupMatches.length ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          {lookupMatches.map((match) => (
            <button key={`${match.id}:${match.full_name}`} type="button" onClick={() => selectMatch(match)} style={{ border: "1px solid #d0d5dd", borderRadius: 8, padding: "8px 11px", background: "#fff", color: "#344054", fontWeight: 700, cursor: "pointer" }}>
              {match.full_name} · {match.id}
            </button>
          ))}
        </div>
      ) : null}

      <button type="submit" disabled={saving} style={{ marginTop: 16, border: 0, borderRadius: 8, padding: "10px 16px", background: "#d5521d", color: "#fff", fontWeight: 700, cursor: saving ? "wait" : "pointer" }}>{saving ? "Adding..." : "Add employee"}</button>
    </form>
  );
}
