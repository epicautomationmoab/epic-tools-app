"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../readiness/ReadinessShell.module.css";

type Reservation = {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  experience_name: string | null;
  start_time: string | null;
} | null;

type Workflow = {
  id: string;
  workflow_status: string;
  metadata: Record<string, unknown> | null;
} | null;

type DamageItem = {
  id: string;
  item_order: number;
  area_component: string | null;
  description: string | null;
  disposition: string | null;
  possible_hidden_damage: boolean;
  internal_notes: string | null;
};

type Evidence = {
  id: string;
  damage_item_id: string | null;
  photo_slot: string | null;
  original_filename: string | null;
  content_type: string | null;
  byte_size: number | null;
  uploaded_at: string;
};

type Props = {
  caseId: string;
  confirmationCode: string | null;
  vehicleNumber: string | null;
  caseStatus: string;
  openedBy: string | null;
  openingNote: string;
  reservation: Reservation;
  workflow: Workflow;
  initialItems: DamageItem[];
  initialEvidence: Evidence[];
  guestAcknowledgmentStatus: string | null;
};

const photoSlots = [
  ["front_left", "Front Left / Overall"],
  ["front_right", "Front Right / Overall"],
  ["rear_left", "Rear Left / Overall"],
  ["rear_right", "Rear Right / Overall"],
  ["front", "Front"],
  ["rear", "Rear"],
  ["driver_side", "Driver Side"],
  ["passenger_side", "Passenger Side"],
  ["rops", "ROPS / Cage"],
  ["wheels_tires", "Wheels / Tires"],
  ["undercarriage", "Visible Undercarriage"],
  ["additional", "Additional Overall"],
] as const;

function readMetadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return value === null || value === undefined ? "" : String(value);
}

async function readResponse<T extends { error?: string }>(response: Response, fallback: string) {
  const data = await response.json().catch(() => null) as T | null;
  if (!response.ok) throw new Error(data?.error || fallback);
  return data as T;
}

function statusLabel(status: string | null) {
  if (!status) return "Not added";
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "Draft saved";
  if (status === "opened") return "Opened";
  if (status === "sent") return "Waiting on guest";
  if (status === "created") return "Waiting on guest";
  return status.replaceAll("_", " ");
}

export default function DamageDocumentationClient(props: Props) {
  const router = useRouter();
  const [mileage, setMileage] = useState(readMetadataString(props.workflow?.metadata ?? null, "mileage"));
  const [engineHours, setEngineHours] = useState(readMetadataString(props.workflow?.metadata ?? null, "engine_hours"));
  const [vehicleStatus, setVehicleStatus] = useState(readMetadataString(props.workflow?.metadata ?? null, "vehicle_status") || "hold_for_inspection");
  const [generalNotes, setGeneralNotes] = useState(readMetadataString(props.workflow?.metadata ?? null, "general_notes") || props.openingNote);
  const [items, setItems] = useState<DamageItem[]>(props.initialItems);
  const [evidence, setEvidence] = useState<Evidence[]>(props.initialEvidence);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ areaComponent: "", description: "", disposition: "unknown", possibleHiddenDamage: false, internalNotes: "" });
  const [addingItem, setAddingItem] = useState(false);

  const overallEvidence = useMemo(() => evidence.filter(item => !item.damage_item_id), [evidence]);

  async function saveSummary(showMessage = true) {
    setSaving(true);
    setError("");
    try {
      await readResponse(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_summary", mileage, engineHours, vehicleStatus, generalNotes }),
      }), "Unable to save damage documentation.");
      if (showMessage) setMessage("Draft saved.");
      window.setTimeout(() => setMessage(""), 2200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save damage documentation.");
    } finally {
      setSaving(false);
    }
  }

  async function addDamageItem() {
    if (!newItem.areaComponent.trim() && !newItem.description.trim()) {
      setError("Add an area/component or a description before creating the damage item.");
      return;
    }
    setAddingItem(true);
    setError("");
    try {
      const data = await readResponse<{ item: DamageItem; error?: string }>(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_item", ...newItem }),
      }), "Unable to add damage item.");
      setItems(current => [...current, data.item]);
      setNewItem({ areaComponent: "", description: "", disposition: "unknown", possibleHiddenDamage: false, internalNotes: "" });
      setMessage("Damage item added. Add close-up photos below.");
      window.setTimeout(() => setMessage(""), 2500);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add damage item.");
    } finally {
      setAddingItem(false);
    }
  }

  async function updateDamageItem(item: DamageItem) {
    setError("");
    try {
      await readResponse(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_item",
          itemId: item.id,
          areaComponent: item.area_component,
          description: item.description,
          disposition: item.disposition || "unknown",
          possibleHiddenDamage: item.possible_hidden_damage,
          internalNotes: item.internal_notes,
        }),
      }), "Unable to save damage item.");
      setMessage("Damage item saved.");
      window.setTimeout(() => setMessage(""), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save damage item.");
    }
  }

  async function uploadOne(file: File, photoSlot: string | null, damageItemId: string | null) {
    const prepare = await readResponse<{ uploadUrl?: string; storagePath?: string; error?: string }>(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prepare", filename: file.name, contentType: file.type, byteSize: file.size }),
    }), "Unable to prepare photo upload.");
    if (!prepare.uploadUrl || !prepare.storagePath) throw new Error("Photo upload could not be prepared.");

    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    const upload = await fetch(prepare.uploadUrl, { method: "PUT", headers: { "x-upsert": "false" }, body });
    if (!upload.ok) throw new Error(`Unable to upload ${file.name || "photo"}.`);

    const completed = await readResponse<{ evidence: Evidence; error?: string }>(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        storagePath: prepare.storagePath,
        filename: file.name,
        contentType: file.type,
        byteSize: file.size,
        photoSlot,
        damageItemId,
      }),
    }), "Unable to finish attaching photo.");
    return completed.evidence;
  }

  async function uploadPhotos(files: FileList | null, key: string, photoSlot: string | null, damageItemId: string | null) {
    if (!files?.length) return;
    setUploadingKey(key);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadOne(file, photoSlot, damageItemId);
        setEvidence(current => [...current, uploaded]);
      }
      setMessage(`${files.length} photo${files.length === 1 ? "" : "s"} added.`);
      window.setTimeout(() => setMessage(""), 2000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload photos.");
    } finally {
      setUploadingKey(null);
    }
  }

  async function completeDocumentation() {
    setCompleting(true);
    setError("");
    try {
      await readResponse(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", mileage, engineHours, vehicleStatus, generalNotes }),
      }), "Unable to complete damage documentation.");
      setMessage("Damage documentation completed. Ready for technician inspection.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to complete damage documentation.");
    } finally {
      setCompleting(false);
    }
  }

  const card = { border: "1px solid rgba(24,32,44,.12)", borderRadius: 14, padding: 18, background: "rgba(255,255,255,.58)" } as const;
  const input = { minHeight: 42, borderRadius: 9, border: "1px solid rgba(24,32,44,.18)", padding: "0 11px", font: "inherit", background: "#fff", width: "100%", boxSizing: "border-box" as const };
  const textarea = { ...input, minHeight: 82, padding: 10, resize: "vertical" as const };

  return <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", opacity: .62, textTransform: "uppercase" }}>Returned With Damage</div>
          <h2 style={{ margin: "5px 0 3px" }}>{props.reservation?.customer_name ?? "Reservation"}</h2>
          <div style={{ opacity: .76 }}>{props.confirmationCode ?? "No confirmation linked"} · Vehicle {props.vehicleNumber ?? "—"}</div>
          <div style={{ marginTop: 4, opacity: .66 }}>{props.reservation?.experience_name ?? ""}</div>
        </div>
        <div style={{ display: "grid", gap: 5, minWidth: 220 }}>
          <div><strong>Guest acknowledgment:</strong> {statusLabel(props.guestAcknowledgmentStatus)}</div>
          <div><strong>Epic documentation:</strong> {statusLabel(props.workflow?.workflow_status ?? null)}</div>
          <div><strong>Case:</strong> {props.caseStatus.replaceAll("_", " ")}</div>
        </div>
      </div>
    </section>

    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0 }}>Vehicle Condition</h2><p style={{ margin: "4px 0 0", opacity: .68 }}>Internal Epic documentation. Save and resume at any time.</p></div>
        <button className={styles.actionButton} type="button" disabled={saving} onClick={() => void saveSummary()}>{saving ? "Saving…" : "Save Draft"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Mileage<input style={input} value={mileage} onChange={event => setMileage(event.target.value)} inputMode="decimal" /></label>
        <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Engine Hours<input style={input} value={engineHours} onChange={event => setEngineHours(event.target.value)} inputMode="decimal" /></label>
        <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Vehicle Status<select style={input} value={vehicleStatus} onChange={event => setVehicleStatus(event.target.value)}><option value="rentable">Rentable</option><option value="hold_for_inspection">Hold for Inspection</option><option value="down">Down</option></select></label>
      </div>
      <label style={{ display: "grid", gap: 5, fontWeight: 800, marginTop: 12 }}>General Notes<textarea style={textarea} value={generalNotes} onChange={event => setGeneralNotes(event.target.value)} placeholder="Overall condition, context, anything the technician should know..." /></label>
    </section>

    <section style={card}>
      <h2 style={{ margin: 0 }}>Overall Vehicle Photos</h2>
      <p style={{ margin: "5px 0 14px", opacity: .68 }}>Capture the whole machine first. These provide context for the close-up damage photos below.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
        {photoSlots.map(([slot, label]) => {
          const count = overallEvidence.filter(item => item.photo_slot === slot).length;
          const busy = uploadingKey === `slot:${slot}`;
          return <div key={slot} style={{ border: "1px solid rgba(24,32,44,.12)", borderRadius: 11, padding: 12, background: "rgba(248,250,252,.7)" }}>
            <div style={{ fontWeight: 900 }}>{label}</div>
            <div style={{ fontSize: 13, opacity: .62, margin: "3px 0 9px" }}>{count ? `${count} photo${count === 1 ? "" : "s"}` : "No photo yet"}</div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              <label className={styles.actionButton} style={{ cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center" }}>{busy ? "Uploading…" : "Take Photo"}<input type="file" accept="image/*" capture="environment" disabled={busy} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `slot:${slot}`, slot, null); event.currentTarget.value = ""; }} /></label>
              <label className={styles.actionButton} style={{ cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center" }}>Choose<input type="file" accept="image/*" multiple disabled={busy} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `slot:${slot}`, slot, null); event.currentTarget.value = ""; }} /></label>
            </div>
          </div>;
        })}
      </div>
    </section>

    <section style={card}>
      <h2 style={{ margin: 0 }}>Damage Items</h2>
      <p style={{ margin: "5px 0 14px", opacity: .68 }}>Create one item for each distinct damaged area or component. Add multiple close-up photos to each item.</p>

      <div style={{ border: "1px solid rgba(24,32,44,.12)", borderRadius: 12, padding: 14, background: "rgba(248,250,252,.75)" }}>
        <div style={{ fontWeight: 900, marginBottom: 10 }}>Add Damage Item</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
          <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Area / Component<input style={input} value={newItem.areaComponent} onChange={event => setNewItem(current => ({ ...current, areaComponent: event.target.value }))} placeholder="RF fender, wheel, ROPS..." /></label>
          <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Initial Action<select style={input} value={newItem.disposition} onChange={event => setNewItem(current => ({ ...current, disposition: event.target.value }))}><option value="unknown">Unknown</option><option value="inspect">Inspect</option><option value="repair">Repair</option><option value="replace">Replace</option></select></label>
        </div>
        <label style={{ display: "grid", gap: 5, fontWeight: 800, marginTop: 10 }}>What do you see?<textarea style={textarea} value={newItem.description} onChange={event => setNewItem(current => ({ ...current, description: event.target.value }))} placeholder="Visible damage only — technician will make the repair determination." /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontWeight: 800 }}><input type="checkbox" checked={newItem.possibleHiddenDamage} onChange={event => setNewItem(current => ({ ...current, possibleHiddenDamage: event.target.checked }))} /> Possible hidden damage / further inspection needed</label>
        <label style={{ display: "grid", gap: 5, fontWeight: 800, marginTop: 10 }}>Internal Notes<textarea style={{ ...textarea, minHeight: 64 }} value={newItem.internalNotes} onChange={event => setNewItem(current => ({ ...current, internalNotes: event.target.value }))} /></label>
        <button className={styles.actionButton} type="button" disabled={addingItem} onClick={() => void addDamageItem()} style={{ marginTop: 10 }}>{addingItem ? "Adding…" : "Add Damage Item"}</button>
      </div>

      <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
        {items.map((item, index) => {
          const itemPhotos = evidence.filter(photo => photo.damage_item_id === item.id);
          const busy = uploadingKey === `item:${item.id}`;
          return <div key={item.id} style={{ border: "1px solid rgba(24,32,44,.13)", borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><strong>Damage Item {index + 1}</strong><span style={{ opacity: .62, fontSize: 13 }}>{itemPhotos.length} photo{itemPhotos.length === 1 ? "" : "s"}</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10, marginTop: 10 }}>
              <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Area / Component<input style={input} value={item.area_component ?? ""} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, area_component: event.target.value } : row))} /></label>
              <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Initial Action<select style={input} value={item.disposition ?? "unknown"} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, disposition: event.target.value } : row))}><option value="unknown">Unknown</option><option value="inspect">Inspect</option><option value="repair">Repair</option><option value="replace">Replace</option></select></label>
            </div>
            <label style={{ display: "grid", gap: 5, fontWeight: 800, marginTop: 10 }}>Visible Damage<textarea style={textarea} value={item.description ?? ""} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, description: event.target.value } : row))} /></label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, fontWeight: 800 }}><input type="checkbox" checked={item.possible_hidden_damage} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, possible_hidden_damage: event.target.checked } : row))} /> Possible hidden damage / further inspection needed</label>
            <label style={{ display: "grid", gap: 5, fontWeight: 800, marginTop: 10 }}>Internal Notes<textarea style={{ ...textarea, minHeight: 60 }} value={item.internal_notes ?? ""} onChange={event => setItems(current => current.map(row => row.id === item.id ? { ...row, internal_notes: event.target.value } : row))} /></label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              <button className={styles.actionButton} type="button" onClick={() => void updateDamageItem(item)}>Save Item</button>
              <label className={styles.actionButton} style={{ cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center" }}>{busy ? "Uploading…" : "Take Close-Up"}<input type="file" accept="image/*" capture="environment" disabled={busy} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `item:${item.id}`, null, item.id); event.currentTarget.value = ""; }} /></label>
              <label className={styles.actionButton} style={{ cursor: busy ? "wait" : "pointer", display: "inline-flex", alignItems: "center" }}>Add Photos<input type="file" accept="image/*" multiple disabled={busy} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `item:${item.id}`, null, item.id); event.currentTarget.value = ""; }} /></label>
            </div>
          </div>;
        })}
        {!items.length ? <div style={{ opacity: .62, padding: 8 }}>No damage items yet.</div> : null}
      </div>
    </section>

    {error ? <div style={{ color: "#9b1c1c", fontWeight: 800, padding: "0 4px" }}>{error}</div> : null}
    {message ? <div style={{ color: "#176b36", fontWeight: 900, padding: "0 4px" }}>{message}</div> : null}

    <section style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div><strong>Ready for technician review?</strong><div style={{ opacity: .66, fontSize: 13, marginTop: 2 }}>Completing documentation does not finalize the repair. It moves the case to follow-up.</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={styles.actionButton} type="button" disabled={saving || completing} onClick={() => void saveSummary()}>{saving ? "Saving…" : "Save Draft"}</button>
        <button className={styles.actionButton} type="button" disabled={completing || uploadingKey !== null} onClick={() => void completeDocumentation()}>{completing ? "Completing…" : "Complete Damage Documentation"}</button>
      </div>
    </section>
  </div>;
}
