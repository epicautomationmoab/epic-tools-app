"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../readiness/ReadinessShell.module.css";

type Category = "exterior" | "interior" | "undercarriage" | "mechanical" | "other";
type QuickCategory = Exclude<Category, "exterior" | "interior">;

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
  category: string | null;
  view_key: string | null;
  hotspot_key: string | null;
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

type Hotspot = { key: string; label: string; x: number; y: number };
type DraftItem = {
  id: string | null;
  category: Category;
  viewKey: string | null;
  hotspotKey: string | null;
  areaComponent: string;
  description: string;
  disposition: "inspect" | "repair" | "replace" | "unknown";
  possibleHiddenDamage: boolean;
  internalNotes: string;
};

type SpeechRecognitionResultLike = { 0?: { transcript?: string } };
type SpeechRecognitionEventLike = { results?: { 0?: SpeechRecognitionResultLike } };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const baselineSlots = [
  ["front", "Front"],
  ["rear", "Rear"],
  ["driver_side", "Driver Side"],
  ["passenger_side", "Passenger Side"],
  ["rops", "ROPS / Roof"],
  ["odometer_hours", "Mileage / Hours"],
] as const;

const categories: Array<{ key: Category; label: string }> = [
  { key: "exterior", label: "Exterior" },
  { key: "interior", label: "Interior" },
  { key: "undercarriage", label: "Undercarriage" },
  { key: "mechanical", label: "Mechanical" },
  { key: "other", label: "Other" },
];

const exteriorViews = [
  { key: "front_three_quarter", label: "Front 3/4", image: "/incident-damage/rzr-reference/front-three-quarter.jpg" },
  { key: "front", label: "Front", image: "/incident-damage/rzr-reference/front.jpg" },
  { key: "rear", label: "Rear", image: "/incident-damage/rzr-reference/rear.jpg" },
] as const;

type ExteriorViewKey = (typeof exteriorViews)[number]["key"];

const exteriorHotspots: Record<ExteriorViewKey, Hotspot[]> = {
  front_three_quarter: [
    { key: "front_bumper", label: "Front Bumper", x: 25, y: 62 },
    { key: "driver_front_wheel", label: "Driver Front Wheel / Tire", x: 33, y: 76 },
    { key: "passenger_front_wheel", label: "Passenger Front Wheel / Tire", x: 74, y: 75 },
    { key: "driver_front_suspension", label: "Driver Front Suspension", x: 39, y: 64 },
    { key: "passenger_front_suspension", label: "Passenger Front Suspension", x: 68, y: 64 },
    { key: "hood", label: "Hood", x: 39, y: 38 },
    { key: "driver_front_fender", label: "Driver Front Fender / Body", x: 34, y: 49 },
    { key: "passenger_front_fender", label: "Passenger Front Fender / Body", x: 64, y: 49 },
    { key: "passenger_door", label: "Passenger Door / Side Panel", x: 67, y: 37 },
    { key: "rops", label: "ROPS / Cage", x: 57, y: 19 },
    { key: "roof", label: "Roof", x: 55, y: 10 },
  ],
  front: [
    { key: "front_bumper", label: "Front Bumper", x: 50, y: 66 },
    { key: "driver_front_wheel", label: "Driver Front Wheel / Tire", x: 20, y: 74 },
    { key: "passenger_front_wheel", label: "Passenger Front Wheel / Tire", x: 80, y: 74 },
    { key: "driver_front_suspension", label: "Driver Front Suspension", x: 31, y: 66 },
    { key: "passenger_front_suspension", label: "Passenger Front Suspension", x: 69, y: 66 },
    { key: "hood", label: "Hood", x: 50, y: 39 },
    { key: "driver_front_body", label: "Driver Front Body / Fender", x: 34, y: 45 },
    { key: "passenger_front_body", label: "Passenger Front Body / Fender", x: 66, y: 45 },
    { key: "front_rops", label: "Front ROPS / Cage", x: 50, y: 19 },
    { key: "roof", label: "Roof", x: 50, y: 9 },
  ],
  rear: [
    { key: "rear_body", label: "Rear Body / Cargo Area", x: 50, y: 39 },
    { key: "driver_rear_body", label: "Driver Rear Fender / Body", x: 34, y: 43 },
    { key: "passenger_rear_body", label: "Passenger Rear Fender / Body", x: 66, y: 43 },
    { key: "driver_rear_wheel", label: "Driver Rear Wheel / Tire", x: 22, y: 74 },
    { key: "passenger_rear_wheel", label: "Passenger Rear Wheel / Tire", x: 78, y: 74 },
    { key: "driver_rear_suspension", label: "Driver Rear Suspension", x: 35, y: 67 },
    { key: "passenger_rear_suspension", label: "Passenger Rear Suspension", x: 65, y: 67 },
    { key: "rear_drivetrain", label: "Rear Drivetrain / Exhaust", x: 50, y: 66 },
    { key: "rear_rops", label: "Rear ROPS / Cage", x: 50, y: 21 },
    { key: "roof", label: "Roof", x: 50, y: 9 },
  ],
};

const interiorHotspots: Hotspot[] = [
  { key: "driver_seat", label: "Driver Seat", x: 19, y: 78 },
  { key: "passenger_seat", label: "Passenger Seat", x: 80, y: 78 },
  { key: "steering_wheel", label: "Steering Wheel", x: 18, y: 43 },
  { key: "gauge_cluster", label: "Gauge Cluster", x: 16, y: 31 },
  { key: "center_display", label: "Center Display / Ride Command", x: 49, y: 36 },
  { key: "dash_driver", label: "Driver Dash / Controls", x: 31, y: 44 },
  { key: "dash_passenger", label: "Passenger Dash / Grab Handle", x: 73, y: 45 },
  { key: "center_console", label: "Center Console / Shifter", x: 50, y: 69 },
  { key: "driver_footwell", label: "Driver Footwell / Pedals", x: 28, y: 74 },
  { key: "passenger_footwell", label: "Passenger Footwell", x: 69, y: 74 },
  { key: "driver_belt", label: "Driver Seat Belt / Harness", x: 29, y: 61 },
  { key: "passenger_belt", label: "Passenger Seat Belt / Harness", x: 69, y: 61 },
];

const quickAreas: Record<QuickCategory, string[]> = {
  undercarriage: [
    "Skid Plate / Underbody",
    "Front Suspension / Steering",
    "Rear Suspension",
    "Drivetrain / CV / Axle",
    "Frame / Chassis",
    "Other Undercarriage",
  ],
  mechanical: [
    "Steering",
    "Brakes",
    "Engine / Cooling",
    "Drivetrain",
    "Electrical / Display",
    "Noise / Vibration",
    "Starting / Running",
    "Other Mechanical",
  ],
  other: [
    "Loose / Missing Accessory",
    "Fluid Leak",
    "Glass / Mirror",
    "Cargo / Storage",
    "Unknown Area",
    "Other",
  ],
};

function isCategory(value: string | null): value is Category {
  return value === "exterior" || value === "interior" || value === "undercarriage" || value === "mechanical" || value === "other";
}

function isQuickCategory(value: Category): value is QuickCategory {
  return value === "undercarriage" || value === "mechanical" || value === "other";
}

function readMetadataString(metadata: Record<string, unknown> | null, key: string) {
  const value = metadata?.[key];
  return value === null || value === undefined ? "" : String(value);
}

function statusLabel(status: string | null) {
  if (!status) return "Not added";
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "Draft saved";
  if (status === "opened") return "Opened";
  if (status === "sent" || status === "created") return "Waiting on guest";
  return status.replaceAll("_", " ");
}

async function readJson<T extends { error?: string }>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null) as T | null;
  if (!response.ok || !data) throw new Error(data?.error || fallback);
  return data;
}

export default function DamageDocumentationV2Client(props: Props) {
  const router = useRouter();
  const [mileage, setMileage] = useState(readMetadataString(props.workflow?.metadata ?? null, "mileage"));
  const [engineHours, setEngineHours] = useState(readMetadataString(props.workflow?.metadata ?? null, "engine_hours"));
  const [vehicleStatus, setVehicleStatus] = useState(readMetadataString(props.workflow?.metadata ?? null, "vehicle_status") || "hold_for_inspection");
  const [generalNotes, setGeneralNotes] = useState(readMetadataString(props.workflow?.metadata ?? null, "general_notes") || props.openingNote);
  const [items, setItems] = useState<DamageItem[]>(props.initialItems);
  const [evidence, setEvidence] = useState<Evidence[]>(props.initialEvidence);
  const [activeCategory, setActiveCategory] = useState<Category>("exterior");
  const [activeExteriorView, setActiveExteriorView] = useState<ExteriorViewKey>("front_three_quarter");
  const [activeItem, setActiveItem] = useState<DraftItem | null>(null);
  const [savingSummary, setSavingSummary] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const overallEvidence = useMemo(() => evidence.filter(row => !row.damage_item_id), [evidence]);
  const baselineCompleteCount = baselineSlots.filter(([slot]) => overallEvidence.some(row => row.photo_slot === slot)).length;
  const mappedKeys = useMemo(() => new Set(items.map(row => row.hotspot_key).filter((value): value is string => Boolean(value))), [items]);
  const activeItems = useMemo(() => items.filter(row => (isCategory(row.category) ? row.category : "exterior") === activeCategory), [items, activeCategory]);
  const currentView = exteriorViews.find(view => view.key === activeExteriorView) ?? exteriorViews[0];
  const quickCategory = isQuickCategory(activeCategory) ? activeCategory : null;
  const isProRReference = Boolean(props.reservation?.experience_name?.toLowerCase().includes("pro r"));

  const card = { border: "1px solid rgba(24,32,44,.12)", borderRadius: 14, padding: 18, background: "rgba(255,255,255,.58)" } as const;
  const input = { minHeight: 42, borderRadius: 9, border: "1px solid rgba(24,32,44,.18)", padding: "0 11px", font: "inherit", background: "#fff", width: "100%", boxSizing: "border-box" as const };
  const textarea = { ...input, minHeight: 96, padding: 10, resize: "vertical" as const };

  async function saveSummary(showMessage = true) {
    setSavingSummary(true);
    setError("");
    try {
      await readJson(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_summary", mileage, engineHours, vehicleStatus, generalNotes }),
      }), "Unable to save damage documentation.");
      if (showMessage) {
        setMessage("Draft saved.");
        window.setTimeout(() => setMessage(""), 1800);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save damage documentation.");
    } finally {
      setSavingSummary(false);
    }
  }

  async function uploadOne(file: File, photoSlot: string | null, damageItemId: string | null) {
    const prepared = await readJson<{ uploadUrl?: string; storagePath?: string; error?: string }>(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prepare", filename: file.name, contentType: file.type, byteSize: file.size }),
    }), "Unable to prepare photo upload.");
    if (!prepared.uploadUrl || !prepared.storagePath) throw new Error("Photo upload could not be prepared.");

    const uploadBody = new FormData();
    uploadBody.append("cacheControl", "3600");
    uploadBody.append("", file);
    const upload = await fetch(prepared.uploadUrl, { method: "PUT", headers: { "x-upsert": "false" }, body: uploadBody });
    if (!upload.ok) throw new Error(`Unable to upload ${file.name || "photo"}.`);

    const completed = await readJson<{ evidence: Evidence; error?: string }>(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        storagePath: prepared.storagePath,
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
      const uploaded: Evidence[] = [];
      for (const file of Array.from(files)) uploaded.push(await uploadOne(file, photoSlot, damageItemId));
      setEvidence(current => [...current, ...uploaded]);
      setMessage(`${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} added.`);
      window.setTimeout(() => setMessage(""), 1600);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to upload photos.");
    } finally {
      setUploadingKey(null);
    }
  }

  function openDamageArea(category: Category, areaComponent: string, viewKey: string | null, hotspotKey: string | null) {
    const existing = items.find(item => {
      if (hotspotKey && item.hotspot_key === hotspotKey) return true;
      const itemCategory = isCategory(item.category) ? item.category : "exterior";
      return !hotspotKey && itemCategory === category && item.area_component === areaComponent;
    });
    setActiveItem(existing ? {
      id: existing.id,
      category: isCategory(existing.category) ? existing.category : category,
      viewKey: existing.view_key ?? viewKey,
      hotspotKey: existing.hotspot_key ?? hotspotKey,
      areaComponent: existing.area_component ?? areaComponent,
      description: existing.description ?? "",
      disposition: existing.disposition === "inspect" || existing.disposition === "repair" || existing.disposition === "replace" ? existing.disposition : "unknown",
      possibleHiddenDamage: existing.possible_hidden_damage,
      internalNotes: existing.internal_notes ?? "",
    } : {
      id: null,
      category,
      viewKey,
      hotspotKey,
      areaComponent,
      description: "",
      disposition: "unknown",
      possibleHiddenDamage: false,
      internalNotes: "",
    });
    setError("");
  }

  function openExisting(item: DamageItem) {
    openDamageArea(isCategory(item.category) ? item.category : "exterior", item.area_component ?? "Damage Area", item.view_key, item.hotspot_key);
  }

  async function saveActiveItem() {
    if (!activeItem) return;
    if (!activeItem.description.trim()) {
      setError("Describe what you see before saving this damage area.");
      return;
    }
    setSavingItem(true);
    setError("");
    const payload = {
      areaComponent: activeItem.areaComponent,
      description: activeItem.description,
      disposition: activeItem.disposition,
      possibleHiddenDamage: activeItem.possibleHiddenDamage,
      internalNotes: activeItem.internalNotes,
      category: activeItem.category,
      viewKey: activeItem.viewKey,
      hotspotKey: activeItem.hotspotKey,
    };
    try {
      if (activeItem.id) {
        await readJson(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "update_item", itemId: activeItem.id, ...payload }),
        }), "Unable to save damage area.");
        setItems(current => current.map(item => item.id === activeItem.id ? {
          ...item,
          area_component: payload.areaComponent,
          description: payload.description,
          disposition: payload.disposition,
          possible_hidden_damage: payload.possibleHiddenDamage,
          internal_notes: payload.internalNotes,
          category: payload.category,
          view_key: payload.viewKey,
          hotspot_key: payload.hotspotKey,
        } : item));
        setMessage("Damage area updated.");
      } else {
        const data = await readJson<{ item: DamageItem; error?: string }>(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add_item", ...payload }),
        }), "Unable to save damage area.");
        setItems(current => [...current, data.item]);
        setActiveItem(current => current ? { ...current, id: data.item.id } : current);
        setMessage("Damage area saved. Add close-up photos if helpful.");
      }
      window.setTimeout(() => setMessage(""), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save damage area.");
    } finally {
      setSavingItem(false);
    }
  }

  function startDictation() {
    if (!activeItem || listening) return;
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Dictation is not available in this browser. You can use the keyboard microphone or type the note instead.");
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      setError("Dictation stopped. Try again or type the note.");
    };
    recognition.onresult = event => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() ?? "";
      if (!transcript) return;
      setActiveItem(current => current ? {
        ...current,
        description: [current.description.trim(), transcript].filter(Boolean).join(" "),
      } : current);
    };
    recognition.start();
  }

  async function completeDocumentation() {
    setCompleting(true);
    setError("");
    try {
      await saveSummary(false);
      await readJson(await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(props.caseId)}/damage-documentation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete", mileage, engineHours, vehicleStatus, generalNotes }),
      }), "Unable to complete damage documentation.");
      setMessage("Damage documentation completed. Ready for preliminary assessment.");
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div><h2 style={{ margin: 0 }}>Quick Setup</h2><p style={{ margin: "4px 0 0", opacity: .68 }}>Just enough information to anchor the vehicle condition.</p></div>
        <button className={styles.actionButton} type="button" disabled={savingSummary} onClick={() => void saveSummary()}>{savingSummary ? "Saving…" : "Save Draft"}</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Mileage<input style={input} value={mileage} onChange={event => setMileage(event.target.value)} inputMode="decimal" /></label>
        <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Engine Hours<input style={input} value={engineHours} onChange={event => setEngineHours(event.target.value)} inputMode="decimal" /></label>
        <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Vehicle Status<select style={input} value={vehicleStatus} onChange={event => setVehicleStatus(event.target.value)}><option value="rentable">Rentable</option><option value="hold_for_inspection">Hold for Inspection</option><option value="down">Down</option></select></label>
      </div>
      <label style={{ display: "grid", gap: 5, fontWeight: 800, marginTop: 12 }}>Optional overall note<textarea style={{ ...textarea, minHeight: 64 }} value={generalNotes} onChange={event => setGeneralNotes(event.target.value)} /></label>
    </section>

    <section style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div><h2 style={{ margin: 0 }}>Fast Walkaround</h2><p style={{ margin: "5px 0 0", opacity: .68 }}>Six baseline shots. Take them as you walk around the machine.</p></div>
        <strong>{baselineCompleteCount} / {baselineSlots.length}</strong>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 9, marginTop: 14 }}>
        {baselineSlots.map(([slot, label]) => {
          const count = overallEvidence.filter(row => row.photo_slot === slot).length;
          const busy = uploadingKey === `slot:${slot}`;
          return <label key={slot} style={{ minHeight: 88, border: count ? "2px solid rgba(29,125,66,.38)" : "1px solid rgba(24,32,44,.14)", borderRadius: 12, padding: 12, display: "grid", alignContent: "center", gap: 5, cursor: busy ? "wait" : "pointer", background: count ? "rgba(228,246,234,.55)" : "rgba(248,250,252,.72)" }}>
            <strong>{count ? "✓ " : ""}{label}</strong>
            <span style={{ fontSize: 12, opacity: .62 }}>{busy ? "Uploading…" : count ? `${count} photo${count === 1 ? "" : "s"}` : "Take Photo"}</span>
            <input type="file" accept="image/*" capture="environment" disabled={busy} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `slot:${slot}`, slot, null); event.currentTarget.value = ""; }} />
          </label>;
        })}
      </div>
    </section>

    <section style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0 }}>Document the Damage</h2><p style={{ margin: "5px 0 0", opacity: .68 }}>Choose the area, tap what is damaged, then type or dictate what you see.</p></div>
          <strong>{items.length} area{items.length === 1 ? "" : "s"} marked</strong>
        </div>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", marginTop: 14 }}>
          {categories.map(category => <button key={category.key} type="button" onClick={() => setActiveCategory(category.key)} style={{ border: activeCategory === category.key ? "2px solid #202733" : "1px solid rgba(24,32,44,.18)", borderRadius: 999, padding: "8px 12px", background: activeCategory === category.key ? "#202733" : "#fff", color: activeCategory === category.key ? "#fff" : "#202733", fontWeight: 850, whiteSpace: "nowrap", cursor: "pointer" }}>{category.label}</button>)}
        </div>
        {!isProRReference && (activeCategory === "exterior" || activeCategory === "interior") ? <div style={{ marginTop: 12, padding: "9px 11px", borderRadius: 10, background: "rgba(255,247,225,.85)", fontSize: 13 }}><strong>Prototype reference:</strong> these images are RZR Pro R references. We will add the correct reference set for each fleet model before production use.</div> : null}
      </div>

      {activeCategory === "exterior" ? <>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "0 18px 12px" }}>
          {exteriorViews.map(view => <button key={view.key} type="button" onClick={() => setActiveExteriorView(view.key)} style={{ border: activeExteriorView === view.key ? "2px solid #202733" : "1px solid rgba(24,32,44,.18)", borderRadius: 999, padding: "7px 11px", background: activeExteriorView === view.key ? "#202733" : "#fff", color: activeExteriorView === view.key ? "#fff" : "#202733", fontWeight: 800, cursor: "pointer" }}>{view.label}</button>)}
        </div>
        <div style={{ position: "relative", minHeight: 500, background: "#f7f8fa", overflow: "hidden" }}>
          <Image src={currentView.image} alt="RZR exterior reference" width={1200} height={800} style={{ width: "100%", height: 500, objectFit: "contain", display: "block" }} priority={false} />
          {exteriorHotspots[activeExteriorView].map(hotspot => {
            const marked = mappedKeys.has(hotspot.key);
            return <button key={hotspot.key} type="button" onClick={() => openDamageArea("exterior", hotspot.label, activeExteriorView, hotspot.key)} title={hotspot.label} aria-label={hotspot.label} style={{ position: "absolute", left: `${hotspot.x}%`, top: `${hotspot.y}%`, transform: "translate(-50%,-50%)", width: marked ? 34 : 30, height: marked ? 34 : 30, borderRadius: 999, border: "3px solid #fff", background: marked ? "#1b7a3d" : "rgba(208,55,49,.9)", color: "#fff", fontWeight: 950, boxShadow: "0 2px 8px rgba(0,0,0,.26)", cursor: "pointer" }}>{marked ? "✓" : "+"}</button>;
          })}
        </div>
      </> : null}

      {activeCategory === "interior" ? <div style={{ position: "relative", minHeight: 500, background: "#111", overflow: "hidden" }}>
        <Image src="/incident-damage/rzr-reference/interior.jpg" alt="RZR interior reference" width={1200} height={900} style={{ width: "100%", height: 500, objectFit: "contain", display: "block" }} />
        {interiorHotspots.map(hotspot => {
          const marked = mappedKeys.has(hotspot.key);
          return <button key={hotspot.key} type="button" onClick={() => openDamageArea("interior", hotspot.label, "interior", hotspot.key)} title={hotspot.label} aria-label={hotspot.label} style={{ position: "absolute", left: `${hotspot.x}%`, top: `${hotspot.y}%`, transform: "translate(-50%,-50%)", width: marked ? 34 : 30, height: marked ? 34 : 30, borderRadius: 999, border: "3px solid #fff", background: marked ? "#1b7a3d" : "rgba(208,55,49,.9)", color: "#fff", fontWeight: 950, boxShadow: "0 2px 8px rgba(0,0,0,.28)", cursor: "pointer" }}>{marked ? "✓" : "+"}</button>;
        })}
      </div> : null}

      {quickCategory ? <div style={{ padding: "8px 18px 18px" }}>
        <div style={{ border: "1px solid rgba(24,32,44,.10)", borderRadius: 12, padding: 14, background: "rgba(248,250,252,.8)" }}>
          <strong>{categories.find(category => category.key === quickCategory)?.label}</strong>
          <p style={{ margin: "5px 0 12px", opacity: .67 }}>Select the closest area, then describe what you see or what the vehicle is doing. Photos can be added after saving.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8 }}>
            {quickAreas[quickCategory].map(area => <button key={area} type="button" onClick={() => openDamageArea(quickCategory, area, quickCategory, area.toLowerCase().replace(/[^a-z0-9]+/g, "_"))} style={{ border: "1px solid rgba(24,32,44,.15)", borderRadius: 10, padding: 12, background: "#fff", fontWeight: 800, textAlign: "left", cursor: "pointer" }}>+ {area}</button>)}
          </div>
        </div>
      </div> : null}

      {activeItems.length ? <div style={{ padding: 14, borderTop: "1px solid rgba(24,32,44,.10)", display: "flex", gap: 8, overflowX: "auto" }}>
        {activeItems.map((item, index) => <button key={item.id} type="button" onClick={() => openExisting(item)} style={{ border: "1px solid rgba(24,32,44,.14)", borderRadius: 10, background: "#fff", padding: "9px 11px", minWidth: 165, textAlign: "left", cursor: "pointer" }}><strong style={{ display: "block", fontSize: 13 }}>#{index + 1} {item.area_component || "Damage area"}</strong><span style={{ fontSize: 12, opacity: .62 }}>{evidence.filter(photo => photo.damage_item_id === item.id).length} photos · edit</span></button>)}
      </div> : null}
    </section>

    {error ? <div style={{ color: "#9b1c1c", fontWeight: 800 }}>{error}</div> : null}
    {message ? <div style={{ color: "#176b36", fontWeight: 900 }}>{message}</div> : null}

    <section style={{ ...card, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <div><strong>Finished documenting the vehicle?</strong><div style={{ opacity: .66, fontSize: 13 }}>{items.length} damage area{items.length === 1 ? "" : "s"} documented · {evidence.length} total photo{evidence.length === 1 ? "" : "s"}</div></div>
      <div style={{ display: "flex", gap: 8 }}><button className={styles.actionButton} type="button" disabled={savingSummary || completing} onClick={() => void saveSummary()}>Save Draft</button><button className={styles.actionButton} type="button" disabled={completing || uploadingKey !== null} onClick={() => void completeDocumentation()}>{completing ? "Completing…" : "Done Reviewing Vehicle"}</button></div>
    </section>

    {activeItem ? <div role="dialog" aria-modal="true" aria-label={`Document ${activeItem.areaComponent}`} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,15,22,.62)", display: "grid", alignItems: "end", justifyItems: "center", padding: "18px 12px" }} onMouseDown={event => { if (event.target === event.currentTarget) setActiveItem(null); }}>
      <section style={{ width: "min(680px,100%)", maxHeight: "88vh", overflowY: "auto", background: "#fff", color: "#202733", borderRadius: 18, boxShadow: "0 16px 60px rgba(0,0,0,.32)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div><div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".07em", opacity: .58, textTransform: "uppercase" }}>{activeItem.category} damage</div><h2 style={{ margin: "4px 0 0" }}>{activeItem.areaComponent}</h2></div>
          <button type="button" onClick={() => setActiveItem(null)} aria-label="Close" style={{ border: 0, background: "transparent", fontSize: 26, cursor: "pointer" }}>×</button>
        </div>

        <label style={{ display: "grid", gap: 6, fontWeight: 850, marginTop: 16 }}>What do you see?<textarea autoFocus style={textarea} value={activeItem.description} onChange={event => setActiveItem(current => current ? { ...current, description: event.target.value } : current)} placeholder="Describe the damage, symptom, or missing item..." /></label>
        <button type="button" onClick={startDictation} disabled={listening} aria-label="Dictate" title="Dictate" style={{ marginTop: 8, width: 42, height: 42, border: "1px solid rgba(24,32,44,.18)", borderRadius: 999, background: listening ? "#f5e8e8" : "#fff", fontSize: 19, cursor: listening ? "wait" : "pointer" }}>🎙</button>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 14 }}>
          <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Initial thought<select style={input} value={activeItem.disposition} onChange={event => setActiveItem(current => current ? { ...current, disposition: event.target.value as DraftItem["disposition"] } : current)}><option value="unknown">Undetermined</option><option value="inspect">Needs inspection</option><option value="repair">Likely repair</option><option value="replace">Likely replace</option></select></label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginTop: 20 }}><input type="checkbox" checked={activeItem.possibleHiddenDamage} onChange={event => setActiveItem(current => current ? { ...current, possibleHiddenDamage: event.target.checked } : current)} /> Possible hidden damage</label>
        </div>

        <label style={{ display: "grid", gap: 5, fontWeight: 800, marginTop: 12 }}>Optional internal note<textarea style={{ ...textarea, minHeight: 62 }} value={activeItem.internalNotes} onChange={event => setActiveItem(current => current ? { ...current, internalNotes: event.target.value } : current)} /></label>

        <div style={{ marginTop: 14, border: "1px solid rgba(24,32,44,.12)", borderRadius: 12, padding: 12, background: "rgba(248,250,252,.85)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><strong>Close-up photos</strong><span style={{ fontSize: 13, opacity: .62 }}>{activeItemPhotos.length} attached</span></div>
          {!activeItem.id ? <p style={{ margin: "7px 0 0", fontSize: 13, opacity: .64 }}>Save the damage area first, then add close-up photos.</p> : <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <label className={styles.actionButton} style={{ cursor: uploadingKey ? "wait" : "pointer" }}>{uploadingKey === `item:${activeItem.id}` ? "Uploading…" : "Take Photo"}<input type="file" accept="image/*" capture="environment" disabled={uploadingKey !== null} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `item:${activeItem.id}`, null, activeItem.id); event.currentTarget.value = ""; }} /></label>
            <label className={styles.actionButton} style={{ cursor: uploadingKey ? "wait" : "pointer" }}>Upload Photo<input type="file" accept="image/*" multiple disabled={uploadingKey !== null} style={{ display: "none" }} onChange={event => { void uploadPhotos(event.target.files, `item:${activeItem.id}`, null, activeItem.id); event.currentTarget.value = ""; }} /></label>
          </div>}
        </div>

        {error ? <div style={{ color: "#9b1c1c", fontWeight: 800, marginTop: 10 }}>{error}</div> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}><button className={styles.actionButton} type="button" onClick={() => setActiveItem(null)}>Close</button><button className={styles.actionButton} type="button" disabled={savingItem} onClick={() => void saveActiveItem()}>{savingItem ? "Saving…" : activeItem.id ? "Save Changes" : "Save Damage Area"}</button></div>
      </section>
    </div> : null}
  </div>;
}
