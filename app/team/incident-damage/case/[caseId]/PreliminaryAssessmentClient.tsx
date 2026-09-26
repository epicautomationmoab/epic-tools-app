"use client";

import { useMemo, useState } from "react";
import styles from "../../../readiness/ReadinessShell.module.css";

type DamageItem = {
  id: string;
  area_component: string | null;
  description: string | null;
  disposition: string | null;
  possible_hidden_damage: boolean;
  category?: string | null;
};

type Assessment = {
  id: string;
  damage_item_id: string;
  assessment_status: string;
  recommended_action: string;
  parts_estimate: number | string;
  labor_hours: number | string | null;
  labor_rate: number | string | null;
  labor_estimate: number | string;
  miscellaneous_estimate: number | string;
  confidence: string;
  teardown_required: boolean;
  assessment_notes: string | null;
};

type Props = {
  caseId: string;
  items: DamageItem[];
  initialAssessments: Assessment[];
};

type Draft = {
  assessmentStatus: "unassessed" | "preliminary" | "final";
  recommendedAction: "inspect" | "repair" | "replace" | "unknown";
  partsEstimate: string;
  laborHours: string;
  laborRate: string;
  miscellaneousEstimate: string;
  confidence: "low" | "medium" | "high";
  teardownRequired: boolean;
  assessmentNotes: string;
};

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function fromAssessment(assessment?: Assessment): Draft {
  return {
    assessmentStatus: (assessment?.assessment_status as Draft["assessmentStatus"]) || "preliminary",
    recommendedAction: (assessment?.recommended_action as Draft["recommendedAction"]) || "unknown",
    partsEstimate: assessment ? String(assessment.parts_estimate ?? "") : "",
    laborHours: assessment?.labor_hours === null || assessment?.labor_hours === undefined ? "" : String(assessment.labor_hours),
    laborRate: assessment?.labor_rate === null || assessment?.labor_rate === undefined ? "" : String(assessment.labor_rate),
    miscellaneousEstimate: assessment ? String(assessment.miscellaneous_estimate ?? "") : "",
    confidence: (assessment?.confidence as Draft["confidence"]) || "low",
    teardownRequired: Boolean(assessment?.teardown_required),
    assessmentNotes: assessment?.assessment_notes ?? "",
  };
}

export default function PreliminaryAssessmentClient({ caseId, items, initialAssessments }: Props) {
  const [assessments, setAssessments] = useState(initialAssessments);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => Object.fromEntries(items.map(item => [item.id, fromAssessment(initialAssessments.find(row => row.damage_item_id === item.id))])));
  const [openItemId, setOpenItemId] = useState<string | null>(items[0]?.id ?? null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const total = useMemo(() => assessments.reduce((sum, row) => sum + numeric(row.parts_estimate) + numeric(row.labor_estimate) + numeric(row.miscellaneous_estimate), 0), [assessments]);
  const assessedCount = assessments.filter(row => row.assessment_status !== "unassessed").length;

  const card = { border: "1px solid rgba(24,32,44,.12)", borderRadius: 14, background: "rgba(255,255,255,.62)" } as const;
  const input = { minHeight: 42, borderRadius: 9, border: "1px solid rgba(24,32,44,.18)", padding: "0 11px", font: "inherit", background: "#fff", width: "100%", boxSizing: "border-box" as const };
  const textarea = { ...input, minHeight: 74, padding: 10, resize: "vertical" as const };

  function updateDraft(itemId: string, patch: Partial<Draft>) {
    setDrafts(current => ({ ...current, [itemId]: { ...current[itemId], ...patch } }));
  }

  async function save(itemId: string) {
    const draft = drafts[itemId];
    if (!draft) return;
    setSavingId(itemId);
    setError("");
    try {
      const response = await fetch(`/api/team/incident-damage/cases/${encodeURIComponent(caseId)}/preliminary-assessment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ damageItemId: itemId, ...draft }),
      });
      const data = await response.json().catch(() => null) as { assessment?: Assessment; error?: string } | null;
      if (!response.ok || !data?.assessment) throw new Error(data?.error || "Unable to save assessment.");
      setAssessments(current => {
        const exists = current.some(row => row.damage_item_id === itemId);
        return exists ? current.map(row => row.damage_item_id === itemId ? data.assessment! : row) : [...current, data.assessment!];
      });
      setMessage("Preliminary assessment saved.");
      window.setTimeout(() => setMessage(""), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save assessment.");
    } finally {
      setSavingId(null);
    }
  }

  return <section style={{ ...card, overflow: "hidden" }}>
    <div style={{ padding: 18, display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", borderBottom: "1px solid rgba(24,32,44,.10)" }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: ".08em", opacity: .58, textTransform: "uppercase" }}>Layer 2</div>
        <h2 style={{ margin: "4px 0 4px" }}>Preliminary Damage Assessment</h2>
        <div style={{ opacity: .68 }}>Estimate visible damage quickly enough to support the ADW out-of-pocket decision. Final repair can change after teardown.</div>
      </div>
      <div style={{ minWidth: 220, textAlign: "right" }}>
        <div style={{ fontSize: 12, fontWeight: 850, opacity: .58, textTransform: "uppercase" }}>Preliminary damage total</div>
        <div style={{ fontSize: 30, fontWeight: 950 }}>{money(total)}</div>
        <div style={{ fontSize: 13, opacity: .64 }}>{assessedCount} / {items.length} areas assessed</div>
      </div>
    </div>

    {!items.length ? <div style={{ padding: 18, opacity: .65 }}>Document at least one damage area above before creating the preliminary assessment.</div> : null}

    <div style={{ display: "grid" }}>
      {items.map((item, index) => {
        const draft = drafts[item.id] || fromAssessment();
        const assessment = assessments.find(row => row.damage_item_id === item.id);
        const laborEstimate = numeric(draft.laborHours) * numeric(draft.laborRate);
        const subtotal = numeric(draft.partsEstimate) + laborEstimate + numeric(draft.miscellaneousEstimate);
        const open = openItemId === item.id;
        return <div key={item.id} style={{ borderBottom: "1px solid rgba(24,32,44,.09)" }}>
          <button type="button" onClick={() => setOpenItemId(open ? null : item.id)} style={{ width: "100%", border: 0, background: "transparent", padding: "14px 18px", textAlign: "left", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", cursor: "pointer", color: "inherit" }}>
            <div>
              <strong>#{index + 1} {item.area_component || "Damage area"}</strong>
              <div style={{ fontSize: 13, opacity: .62, marginTop: 2 }}>{item.description || "No description"}</div>
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <strong>{money(subtotal)}</strong>
              <div style={{ fontSize: 12, opacity: .58 }}>{assessment ? assessment.assessment_status : "pending"} {open ? "▲" : "▼"}</div>
            </div>
          </button>

          {open ? <div style={{ padding: "0 18px 18px", display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
              <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Likely action<select style={input} value={draft.recommendedAction} onChange={event => updateDraft(item.id, { recommendedAction: event.target.value as Draft["recommendedAction"] })}><option value="unknown">Undetermined</option><option value="inspect">Inspect</option><option value="repair">Repair</option><option value="replace">Replace</option></select></label>
              <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Confidence<select style={input} value={draft.confidence} onChange={event => updateDraft(item.id, { confidence: event.target.value as Draft["confidence"] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, marginTop: 24 }}><input type="checkbox" checked={draft.teardownRequired} onChange={event => updateDraft(item.id, { teardownRequired: event.target.checked })} /> Teardown / deeper inspection needed</label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
              <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Parts estimate<input style={input} inputMode="decimal" value={draft.partsEstimate} onChange={event => updateDraft(item.id, { partsEstimate: event.target.value })} placeholder="$0.00" /></label>
              <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Labor hours<input style={input} inputMode="decimal" value={draft.laborHours} onChange={event => updateDraft(item.id, { laborHours: event.target.value })} placeholder="0.0" /></label>
              <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Labor rate<input style={input} inputMode="decimal" value={draft.laborRate} onChange={event => updateDraft(item.id, { laborRate: event.target.value })} placeholder="$ / hr" /></label>
              <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Other estimate<input style={input} inputMode="decimal" value={draft.miscellaneousEstimate} onChange={event => updateDraft(item.id, { miscellaneousEstimate: event.target.value })} placeholder="$0.00" /></label>
            </div>

            <div style={{ border: "1px solid rgba(24,32,44,.10)", borderRadius: 10, padding: 11, display: "flex", justifyContent: "space-between", gap: 12, background: "rgba(248,250,252,.8)" }}>
              <div><strong>Area subtotal</strong><div style={{ fontSize: 12, opacity: .6 }}>Parts + calculated labor + other</div></div>
              <strong style={{ fontSize: 20 }}>{money(subtotal)}</strong>
            </div>

            <label style={{ display: "grid", gap: 5, fontWeight: 800 }}>Assessment note<textarea style={textarea} value={draft.assessmentNotes} onChange={event => updateDraft(item.id, { assessmentNotes: event.target.value })} placeholder="Why you chose repair/replace, pricing assumptions, what still needs confirmation..." /></label>

            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 13, opacity: .65 }}>Parts schematic selection will plug into this area next and populate parts instead of typing the estimate manually.</div>
              <button className={styles.actionButton} type="button" disabled={savingId === item.id} onClick={() => void save(item.id)}>{savingId === item.id ? "Saving…" : "Save Preliminary Assessment"}</button>
            </div>
          </div> : null}
        </div>;
      })}
    </div>

    {error ? <div style={{ color: "#9b1c1c", fontWeight: 800, padding: "12px 18px" }}>{error}</div> : null}
    {message ? <div style={{ color: "#176b36", fontWeight: 900, padding: "12px 18px" }}>{message}</div> : null}

    <div style={{ padding: 16, background: "rgba(246,248,250,.82)", fontSize: 13, opacity: .72 }}>
      This total is a preliminary damage assessment, not the final repair invoice. ADW customer-responsibility logic should be applied from the reservation's actual coverage before charging.
    </div>
  </section>;
}
