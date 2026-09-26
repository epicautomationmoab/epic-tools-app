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

type MapperView = "front_left" | "passenger" | "rear_right" | "driver";
type Hotspot = { key: string; label: string; x: number; y: number };

type DraftItem = {
  id: string | null;
  areaComponent: string;
  description: string;
  disposition: string;
  possibleHiddenDamage: boolean;
  internalNotes: string;
};

const baselineSlots = [
  ["front", "Front"],
  ["rear", "Rear"],
  ["driver_side", "Driver Side"],
  ["passenger_side", "Passenger Side"],
  ["rops", "ROPS / Roof"],
  ["odometer_hours", "Mileage / Hours"],
] as const;

const mapperViews: Array<{ key: MapperView; label: string }> = [
  { key: "front_left", label: "Front 3/4" },
  { key: "passenger", label: "Passenger Side" },
  { key: "rear_right", label: "Rear 3/4" },
  { key: "driver", label: "Driver Side" },
];

const hotspots: Record<MapperView, Hotspot[]> = {
  front_left: [
    { key: "front_bumper", label: "Front Bumper", x: 23, y: 67 },
    { key: "left_front_wheel", label: "Left Front Wheel / Tire", x: 18, y: 76 },
    { key: "right_front_wheel", label: "Right Front Wheel / Tire", x: 79, y: 76 },
    { key: "left_front_suspension", label: "Left Front Suspension", x: 29, y: 61 },
    { key: "right_front_suspension", label: "Right Front Suspension", x: 69, y: 61 },
    { key: "hood_front_body", label: "Hood / Front Body", x: 48, y: 50 },
    { key: "left_front_body", label: "Left Front Fender / Body", x: 29, y: 48 },
    { key: "right_front_body", label: "Right Front Fender / Body", x: 69, y: 48 },
    { key: "windshield_front", label: "Windshield / Front Cab", x: 49, y: 32 },
    { key: "front_rops", label: "Front ROPS / Cage", x: 49, y: 19 },
  ],
  passenger: [
    { key: "passenger_front_wheel", label: "Passenger Front Wheel / Tire", x: 20, y: 74 },
    { key: "passenger_rear_wheel", label: "Passenger Rear Wheel / Tire", x: 80, y: 74 },
    { key: "passenger_front_suspension", label: "Passenger Front Suspension", x: 27, y: 61 },
    { key: "passenger_rear_suspension", label: "Passenger Rear Suspension", x: 72, y: 61 },
    { key: "passenger_front_body", label: "Passenger Front Body / Fender", x: 27, y: 48 },
    { key: "passenger_door", label: "Passenger Door / Side Panel", x: 49, y: 50 },
    { key: "passenger_rear_body", label: "Passenger Rear Body / Fender", x: 72, y: 48 },
    { key: "passenger_rocker", label: "Passenger Rocker / Lower Body", x: 50, y: 65 },
    { key: "passenger_rops", label: "Passenger ROPS / Cage", x: 50, y: 25 },
    { key: "roof", label: "Roof", x: 50, y: 13 },
  ],
  rear_right: [
    { key: "rear_bumper", label: "Rear Bumper", x: 77, y: 67 },
    { key: "left_rear_wheel", label: "Left Rear Wheel / Tire", x: 20, y: 76 },
    { key: "right_rear_wheel", label: "Right Rear Wheel / Tire", x: 80, y: 76 },
    { key: "left_rear_suspension", label: "Left Rear Suspension", x: 29, y: 61 },
    { key: "right_rear_suspension", label: "Right Rear Suspension", x: 70, y: 61 },
    { key: "rear_body", label: "Rear Body / Bed", x: 52, y: 49 },
    { key: "left_rear_body", label: "Left Rear Fender / Body", x: 31, y: 48 },
    { key: "right_rear_body", label: "Right Rear Fender / Body", x: 70, y: 48 },
    { key: "rear_rops", label: "Rear ROPS / Cage", x: 51, y: 25 },
    { key: "rear_drivetrain", label: "Rear Drivetrain / Exhaust", x: 51, y: 66 },
  ],
  driver: [
    { key: "driver_front_wheel", label: "Driver Front Wheel / Tire", x: 80, y: 74 },
    { key: "driver_rear_wheel", label: "Driver Rear Wheel / Tire", x: 20, y: 74 },
    { key: "driver_front_suspension", label: "Driver Front Suspension", x: 72, y: 61 },
    { key: "driver_rear_suspension", label: "Driver Rear Suspension", x: 27, y: 61 },
    { key: "driver_front_body", label: "Driver Front Body / Fender", x: 72, y: 48 },
    { key: "driver_door", label: "Driver Door / Side Panel", x: 50, y: 50 },
    { key: "driver_rear_body", label: "Driver Rear Body / Fender", x: 27, y: 48 },
    { key: "driver_rocker", label: "Driver Rocker / Lower Body", x: 50, y: 65 },
    { key: "driver_rops", label: "Driver ROPS / Cage", x: 50, y: 25 },
    { key: "roof_driver", label: "Roof", x: 50, y: 13 },
  ],
};

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
  if (status === "sent" || status === "created") return "Waiting on guest";
  return status.replaceAll("_", " ");
}

function mapperFigure(view: MapperView) {
  const isSide = view === "passenger" || view === "driver";
  const flip = view === "driver" ? "scale(-1 1) translate(-800 0)" : undefined;
  const rear = view === "rear_right";

  if (isSide) {
    return <svg viewBox="0 0 800 420" width="100%" height="100%" aria-hidden="true">
      <g transform={flip} fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity=".72">
        <circle cx="190" cy="320" r="72" /><circle cx="610" cy="320" r="72" />
        <circle cx="190" cy="320" r="42" /><circle cx="610" cy="320" r="42" />
        <path d="M120 280 L165 205 L265 175 L535 175 L635 220 L680 285" />
        <path d="M270 175 L325 90 L520 90 L555 175" />
        <path d="M335 90 L335 180 M505 90 L505 180 M325 90 L290 185" />
        <path d="M250 210 L560 210 L600 270 L220 270 Z" />
        <path d="M315 210 L315 270 M500 210 L500 270" />
        <path d="M150 282 L105 302 M650 282 L700 304" />
        <path d="M210 285 L285 245 M590 285 L530 245" />
      </g>
    </svg>;
  }

  return <svg viewBox="0 0 800 420" width="100%" height="100%" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity=".72">
      <ellipse cx="185" cy="322" rx="65" ry="82" /><ellipse cx="615" cy="322" rx="65" ry="82" />
      <path d={rear ? "M165 275 L260 205 L535 205 L640 275 L595 300 L205 300 Z" : "M155 285 L260 205 L535 205 L650 285 L585 310 L215 310 Z"} />
      <path d="M285 205 L330 95 L495 95 L535 205" />
      <path d="M340 95 L340 205 M485 95 L485 205" />
      <path d="M265 210 L210 160 M540 210 L590 160" />
      <path d="M300 220 L500 220 L555 280 L245 280 Z" />
      <path d="M225 315 L300 255 M575 315 L505 255" />
      <path d={rear ? "M585 302 L690 284" : "M115 295 L210 305"} />
    </g>
  </svg>;
}

export default function DamageDocumentationClient(props: Props) {
  const router = useRouter();
  const [mileage, setMileage] = useState(readMetadataString(props.workflow?.metadata ?? null, "mileage"));
  const [engineHours, setEngineHours] = useState(readMetadataString(props.workflow?.metadata ?? null, "engine_hours"));
  const [vehicleStatus, setVehicleStatus] = useState(readMetadataString(props.workflow?.metadata ?? null, "vehicle_status") || "hold_for_inspection");
  const [generalNotes, setGeneralNotes] = useState(readMetadataString(props.workflow?.metadata ?? null, "general_notes") || props.openingNote);
  const [items, setItems] = useState<DamageItem[]>(props.initialItems);
  const [evidence, setEvidence] = useState<Evidence[]>(props.initialEvidence);
  const [activeView, setActiveView] = useState<MapperView>("front_left");
  const [activeItem, setActiveItem] = useState<DraftItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const overallEvidence = useMemo(() => evidence.filter(item => !item.damage_item_id), [evidence]);
  const baselineCompleteCount = baselineSlots.filter(([slot]) => overallEvidence.some(item => item.photo_slot === slot)).length;
  const mappedLabels = useMemo(() => new Set(items.map(item => item.area_component).filter(Boolean)), [items]);

  const card = { border: "1px solid rgba(24,32,44,.12)", borderRadius: 14, padding: 18, background: "rgba(255,255,255,.58)" } as const;
  const input = { minHeight: 42, borderRadius: 9, border: "1px solid rgba(24,32,44,.18)", padding: "0 11px", font: "inherit", background: "#fff", width: "100%", boxSizing: "border-box" as const };
  const textarea = { ...input, minHeight: 96, padding: 10, resize: "vertical" as const };

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
      window.setTimeout(() => setMessage(""), 2000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save damage documentation.");
    } finally {
      setSaving(false);
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
      body: JSON.stringify({ action: "complete", storagePath: prepare.storagePath, filename: file.name, contentType: file.type, byteSize: file.size, photoSlot, damageItemId }),
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
      window.setTimeout(() => setMessage(""), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload photos.");
    } finally {
      setUploadingKey(null);
    }
  }

  function openHotspot(label: string) {
    const existing = items.find(item => item.area_component === label);
    setActiveItem(existing ? {
      id: existing.id,
      areaComponent: existing.area_component ?? label,
      description: existing.description ?? "",
      disposition: existing.disposition ?? "unknown",
      possibleHiddenDamage: existing.possible_hidden_damage,
      internalNotes: existing.internal_notes ?? "",
    } : {
      id: null,
      areaComponent: label,
      description: "",
      disposition: "unknown",
      possibleHiddenDamage: false,
      internalNotes: "",
    });
    setError("");
  }

  function openExisting(item: DamageItem) {
    setActiveItem({
      id: item.id,
      areaComponent: item.area_component ?? "Damage Area",
      description: item.description ?? "",
      disposition: item.disposition ?? "unknown",
      possibleHiddenDamage: item.possible_hidden_damage,
      internalNotes: item.internal_notes ?? "",
    });
  }

  async function saveActiveItem() {
    if (!activeItem) return;
    if (!activeItem.description.trim()) {
      setError("Describe what you see before saving this damage area.");
      return;
    }
    setSavingItem(true);
    setError("");
    try {
      if (activeItem.id) {
        await readResponse(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update_item",
            itemId: activeItem.id,
            areaComponent: activeItem.areaComponent,
            description: activeItem.description,
            disposition: activeItem.disposition,
            possibleHiddenDamage: activeItem.possibleHiddenDamage,
            internalNotes: activeItem.internalNotes,
          }),
        }), "Unable to save damage area.");
        setItems(current => current.map(item => item.id === activeItem.id ? {
          ...item,
          area_component: activeItem.areaComponent,
          description: activeItem.description,
          disposition: activeItem.disposition,
          possible_hidden_damage: activeItem.possibleHiddenDamage,
          internal_notes: activeItem.internalNotes,
        } : item));
        setMessage("Damage area updated.");
      } else {
        const data = await readResponse<{ item: DamageItem; error?: string }>(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add_item",
            areaComponent: activeItem.areaComponent,
            description: activeItem.description,
            disposition: activeItem.disposition,
            possibleHiddenDamage: activeItem.possibleHiddenDamage,
            internalNotes: activeItem.internalNotes,
          }),
        }), "Unable to save damage area.");
        setItems(current => [...current, data.item]);
        setActiveItem(current => current ? { ...current, id: data.item.id } : current);
        setMessage("Damage area marked. Add close-up photos if helpful.");
      }
      window.setTimeout(() => setMessage(""), 2200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save damage area.");
    } finally {
      setSavingItem(false);
    }
  }

  function startVoiceNote() {
    if (!activeItem || listening) return;
    const BrowserSpeechRecognition = (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any }).SpeechRecognition
      || (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!BrowserSpeechRecognition) {
      setError("Voice dictation is not available in this browser. You can use the keyboard microphone or type the note instead.");
      return;
    }
    const recognition = new BrowserSpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Voice dictation stopped. You can try again or type the note.");
    };
    recognition.onresult = (event: any) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript ?? "").trim();
      if (!transcript) return;
      setActiveItem(current => current ? { ...current, description: [current.description.trim(), transcript].filter(Boolean).join(" ") } : current);
    };
    recognition.start();
  }

  async function completeDocumentation() {
    setCompleting(true);
    setError("");
    try {
      await saveSummary(false);
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

  const activeItemPhotos = activeItem?.id ? evidence.filter(photo => photo.damage_item_id === activeItem.id) : [];

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
        <div><h2 style={{ margin: 0 }}>Quick Setup</h2><p style={{ margin: "4px 0 0", opacity: .68 }}>Just enough information to anchor the vehicle condition.</p></div>
        <button className={styles.actionButton} type="button" disabled={saving} onClick={() => void saveSummary()}>{saving ? "Saving…" : "Save Draft"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Mileage<input style={input} value={mileage} onChange={event => setMileage(event.target.value)} inputMode="decimal" /></label>
        <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Engine Hours<input style={input} value={engineHours} onChange={event => setEngineHours(event.target.value)} inputMode="decimal" /></label>
        <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Vehicle Status<select style={input} value={vehicleStatus} onChange={event => setVehicleStatus(event.target.value)}><option value="rentable">Rentable</option><option value="hold_for_inspection">Hold for Inspection</option><option value="down">Down</option></select></label>
      </div>
      <label style={{ display: "grid", gap: 5, fontWeight: 800, marginTop: 12 }}>Optional overall note<textarea style={{ ...textarea, minHeight: 64 }} value={generalNotes} onChange={event => setGeneralNotes(event.target.value)} placeholder="Only if there is context the technician should know..." /></label>
    </section>

    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0 }}>Fast Walkaround</h2><p style={{ margin: "5px 0 0", opacity: .68 }}>Six baseline shots. Take them as you walk around the machine.</p></div>
        <strong style={{ fontSize: 14 }}>{baselineCompleteCount} / {baselineSlots.length}</strong>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9, marginTop: 14 }}>
        {baselineSlots.map(([slot, label]) => {
          const count = overallEvidence.filter(item => item.photo_slot === slot).length;
          const busy = uploadingKey === `slot:${slot}`;
          return <label key={slot} style={{ minHeight: 88, border: count ? "2px solid rgba(29,125,66,.38)" : "1px solid rgba(24,32,44,.14)", borderRadius: 12, padding: 12, display: "grid", alignContent: "center", gap: 5, cursor: busy ? "wait" : "pointer", background: count ? "rgba(228,246,234,.55)" : "rgba(248,250,252,.72)" }}>
            <strong>{count ? "✓ " : ""}{label}</strong>
            <span style={{ fontSize: 12, opacity: .62 }}>{busy ? "Uploading…" : count ? `${count} photo${count === 1 ? "" : "s"}` : "Tap to take photo"}</span>
            <input type="file" accept="image/*" capture="environment" disabled={busy} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `slot:${slot}`, slot, null); event.currentTarget.value = ""; }} />
          </label>;
        })}
      </div>
    </section>

    <section style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "18px 18px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0 }}>Tap the Damage</h2><p style={{ margin: "5px 0 0", opacity: .68 }}>Spin around the vehicle, tap the damaged area, describe it, add photos, save. Repeat until you are done.</p></div>
          <strong>{items.length} area{items.length === 1 ? "" : "s"} marked</strong>
        </div>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 14, paddingBottom: 2 }}>
          {mapperViews.map(view => <button key={view.key} type="button" onClick={() => setActiveView(view.key)} style={{ border: activeView === view.key ? "2px solid #202733" : "1px solid rgba(24,32,44,.18)", borderRadius: 999, padding: "8px 12px", background: activeView === view.key ? "#202733" : "#fff", color: activeView === view.key ? "#fff" : "#202733", fontWeight: 850, whiteSpace: "nowrap", cursor: "pointer" }}>{view.label}</button>)}
        </div>
      </div>

      <div style={{ position: "relative", minHeight: 420, background: "linear-gradient(180deg, rgba(240,244,247,.9), rgba(255,255,255,.75))", color: "#52606d", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "3% 3% 2%" }}>{mapperFigure(activeView)}</div>
        {hotspots[activeView].map(hotspot => {
          const marked = mappedLabels.has(hotspot.label);
          return <button key={hotspot.key} type="button" title={hotspot.label} aria-label={hotspot.label} onClick={() => openHotspot(hotspot.label)} style={{ position: "absolute", left: `${hotspot.x}%`, top: `${hotspot.y}%`, transform: "translate(-50%,-50%)", width: marked ? 34 : 28, height: marked ? 34 : 28, borderRadius: 999, border: marked ? "3px solid #fff" : "2px solid rgba(255,255,255,.92)", background: marked ? "#1b7a3d" : "rgba(208,55,49,.86)", color: "#fff", fontWeight: 950, boxShadow: "0 2px 8px rgba(0,0,0,.24)", cursor: "pointer", zIndex: 2 }}>{marked ? "✓" : "+"}</button>;
        })}
        <div style={{ position: "absolute", left: 14, bottom: 10, fontSize: 12, fontWeight: 750, opacity: .58 }}>Prototype RZR 2-seat map · tap any marker</div>
      </div>

      {items.length ? <div style={{ padding: 14, borderTop: "1px solid rgba(24,32,44,.10)", display: "flex", gap: 8, overflowX: "auto" }}>
        {items.map((item, index) => <button key={item.id} type="button" onClick={() => openExisting(item)} style={{ border: "1px solid rgba(24,32,44,.14)", borderRadius: 10, background: "#fff", padding: "9px 11px", minWidth: 150, textAlign: "left", cursor: "pointer" }}><strong style={{ display: "block", fontSize: 13 }}>#{index + 1} {item.area_component || "Damage area"}</strong><span style={{ fontSize: 12, opacity: .62 }}>{evidence.filter(photo => photo.damage_item_id === item.id).length} photos · tap to edit</span></button>)}
      </div> : null}
    </section>

    {error ? <div style={{ color: "#9b1c1c", fontWeight: 800, padding: "0 4px" }}>{error}</div> : null}
    {message ? <div style={{ color: "#176b36", fontWeight: 900, padding: "0 4px" }}>{message}</div> : null}

    <section style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div><strong>Finished walking the vehicle?</strong><div style={{ opacity: .66, fontSize: 13, marginTop: 2 }}>{items.length} damage area{items.length === 1 ? "" : "s"} documented · {evidence.length} total photo{evidence.length === 1 ? "" : "s"}</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className={styles.actionButton} type="button" disabled={saving || completing} onClick={() => void saveSummary()}>{saving ? "Saving…" : "Save Draft"}</button>
        <button className={styles.actionButton} type="button" disabled={completing || uploadingKey !== null} onClick={() => void completeDocumentation()}>{completing ? "Completing…" : "Done Reviewing Vehicle"}</button>
      </div>
    </section>

    {activeItem ? <div role="dialog" aria-modal="true" aria-label={`Document ${activeItem.areaComponent}`} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,15,22,.62)", display: "grid", alignItems: "end", justifyItems: "center", padding: "18px 12px" }} onMouseDown={event => { if (event.target === event.currentTarget) setActiveItem(null); }}>
      <section style={{ width: "min(680px, 100%)", maxHeight: "88vh", overflowY: "auto", background: "#fff", color: "#202733", borderRadius: 18, boxShadow: "0 16px 60px rgba(0,0,0,.32)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div><div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".07em", opacity: .58, textTransform: "uppercase" }}>Damage Area</div><h2 style={{ margin: "4px 0 0" }}>{activeItem.areaComponent}</h2></div>
          <button type="button" onClick={() => setActiveItem(null)} style={{ border: 0, background: "transparent", fontSize: 26, lineHeight: 1, cursor: "pointer", color: "inherit" }} aria-label="Close">×</button>
        </div>

        <label style={{ display: "grid", gap: 6, fontWeight: 850, marginTop: 16 }}>What do you see?
          <textarea autoFocus style={textarea} value={activeItem.description} onChange={event => setActiveItem(current => current ? { ...current, description: event.target.value } : current)} placeholder="Example: Passenger lower door panel cracked and pushed inward. Scrape continues into rocker." />
        </label>
        <button type="button" onClick={startVoiceNote} disabled={listening} style={{ marginTop: 8, border: "1px solid rgba(24,32,44,.18)", borderRadius: 999, padding: "8px 12px", background: listening ? "#f5e8e8" : "#fff", fontWeight: 850, cursor: listening ? "wait" : "pointer" }}>{listening ? "● Listening…" : "🎙 Talk instead"}</button>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 14 }}>
          <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Initial thought<select style={input} value={activeItem.disposition} onChange={event => setActiveItem(current => current ? { ...current, disposition: event.target.value } : current)}><option value="unknown">Not sure yet</option><option value="inspect">Needs inspection</option><option value="repair">Likely repair</option><option value="replace">Obviously replace</option></select></label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, minHeight: 42, marginTop: 20 }}><input type="checkbox" checked={activeItem.possibleHiddenDamage} onChange={event => setActiveItem(current => current ? { ...current, possibleHiddenDamage: event.target.checked } : current)} /> Possible hidden damage</label>
        </div>

        <label style={{ display: "grid", gap: 5, fontWeight: 800, marginTop: 12 }}>Optional internal note<textarea style={{ ...textarea, minHeight: 62 }} value={activeItem.internalNotes} onChange={event => setActiveItem(current => current ? { ...current, internalNotes: event.target.value } : current)} placeholder="Anything not obvious from the photos..." /></label>

        <div style={{ marginTop: 14, border: "1px solid rgba(24,32,44,.12)", borderRadius: 12, padding: 12, background: "rgba(248,250,252,.85)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong>Close-up photos</strong><span style={{ fontSize: 13, opacity: .62 }}>{activeItemPhotos.length} attached</span></div>
          {!activeItem.id ? <p style={{ margin: "7px 0 0", fontSize: 13, opacity: .64 }}>Save the area first, then add close-up photos.</p> : <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <label className={styles.actionButton} style={{ cursor: uploadingKey ? "wait" : "pointer", display: "inline-flex", alignItems: "center" }}>{uploadingKey === `item:${activeItem.id}` ? "Uploading…" : "Take Photo"}<input type="file" accept="image/*" capture="environment" disabled={uploadingKey !== null} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `item:${activeItem.id}`, null, activeItem.id); event.currentTarget.value = ""; }} /></label>
            <label className={styles.actionButton} style={{ cursor: uploadingKey ? "wait" : "pointer", display: "inline-flex", alignItems: "center" }}>Choose Photos<input type="file" accept="image/*" multiple disabled={uploadingKey !== null} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `item:${activeItem.id}`, null, activeItem.id); event.currentTarget.value = ""; }} /></label>
          </div>}
        </div>

        {error ? <div style={{ color: "#9b1c1c", fontWeight: 800, marginTop: 10 }}>{error}</div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button className={styles.actionButton} type="button" onClick={() => setActiveItem(null)}>Close</button>
          <button className={styles.actionButton} type="button" disabled={savingItem} onClick={() => void saveActiveItem()}>{savingItem ? "Saving…" : activeItem.id ? "Save Changes" : "Save Damage Area"}</button>
        </div>
      </section>
    </div> : null}
  </div>;
}
