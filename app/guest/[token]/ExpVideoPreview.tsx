"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ExpVideoPreview.module.css";
import ExpAssessment from "./ExpAssessment";
import ExpServerAssessment from "./ExpServerAssessment";
import ExpTrackedVideo from "./ExpTrackedVideo";
import ExpParticipants, { type ExpParticipantDraft } from "./ExpParticipants";
import { EXP_QUESTION_BANK_DRAFT } from "@/lib/exp/question-bank-draft";
import { saveExpDemo, useExpDemo, normalizeExpName } from "@/lib/exp/demo-browser";

// EXP opens at 8:00 AM Moab time on the calendar day before the rental.
// Use local calendar dates rather than a 24-hour difference (DST-safe).
const MOAB_ZONE = "America/Denver";
function moabParts(timestamp: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MOAB_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(timestamp));
  const part = (type: string) => Number(parts.find(item => item.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour") };
}
function withinExpWindow(start: number, now: number) {
  if (!Number.isFinite(start) || start < now) return false;
  const visit = moabParts(start);
  const today = moabParts(now);
  const dayDifference = Math.round((Date.UTC(visit.year, visit.month - 1, visit.day) -
    Date.UTC(today.year, today.month - 1, today.day)) / 86_400_000);
  return dayDifference === 0 || (dayDifference === 1 && today.hour >= 8);
}

type Rental = { readinessId: string; businessLine: string; visitStartTime: string };

export default function ExpVideoPreview({
  token,
  activities,
  waiverDrivers = [],
  reviewerMode = false,
  confirmationCode = "",
}: {
  token: string;
  activities: Rental[];
  waiverDrivers?: string[];
  reviewerMode?: boolean;
  confirmationCode?: string;
}) {
  // Enabled only for the EXP feature branch preview through Vercel branch-scoped config.
  // PREVIEW ONLY. Scoring happens in the browser and does not persist any completion.
  // Production requires server-owned answer keys, secure sessions, and per-driver records.
  const previewResults = useExpDemo();
  const previewRecord = confirmationCode ? previewResults[confirmationCode] : null;
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [selectDrivers, setSelectDrivers] = useState(false);
  const [driverNames, setDriverNames] = useState<ExpParticipantDraft[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [serverError, setServerError] = useState("");
  const [savingParticipants, setSavingParticipants] = useState(false);
  const readinessId = activities.find(a => a.businessLine.toLowerCase() === "rental")?.readinessId ?? "";
  const [watchedAcknowledged, setWatchedAcknowledged] = useState(false);
  const [videoCoverageMet, setVideoCoverageMet] = useState(false);
  const [formsLoaded, setFormsLoaded] = useState(false);
  const [signedRentalDrivers, setSignedRentalDrivers] = useState<string[]>([]);
  const [outstandingRequiredForms, setOutstandingRequiredForms] = useState(false);
  const eligible = useMemo(() => {
    if (now === null) return false;
    return activities.some((activity) => {
      if (activity.businessLine.toLowerCase() !== "rental") return false;
      const start = new Date(activity.visitStartTime).getTime();
      return Number.isFinite(start) && start >= now && (reviewerMode || withinExpWindow(start, now));
    });
  }, [activities, now, reviewerMode]);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!eligible || !token) return;
    let cancelled = false;
    async function checkForms() {
      try {
        const response = await fetch(`/api/guest/${encodeURIComponent(token)}/guest-forms`, { cache: "no-store" });
        if (!response.ok) throw new Error("Forms unavailable");
        const data = await response.json() as { signedRentalDrivers?: string[]; tasks?: Array<{ status: string; required: boolean; templateKey: string | null }> };
        if (cancelled) return;
        setSignedRentalDrivers(data.signedRentalDrivers ?? []);
        setOutstandingRequiredForms((data.tasks ?? []).some((task) => task.required && task.status !== "completed" && task.templateKey !== "damage_acknowledgment"));
        setFormsLoaded(true);
      } catch {
        if (!cancelled) { setOutstandingRequiredForms(true); setFormsLoaded(false); }
      }
    }
    void checkForms();
    return () => { cancelled = true; };
  }, [eligible, token]);

  useEffect(() => {
    if (reviewerMode || !eligible || !token || !formsLoaded || outstandingRequiredForms) return;
    const key = `epic-exp-prompted-v1:${token}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage may be blocked; still permit manual opening via the portal card.
    }
    setStarted(true);
    setOpen(true);
  }, [eligible, token, formsLoaded, outstandingRequiredForms, reviewerMode]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function prepareSession(drivers: ExpParticipantDraft[]) {
    if (!readinessId) return;
    setSavingParticipants(true);
    setServerError("");
    try {
      const base = `/api/guest/${encodeURIComponent(token)}/exp`;
      const startResponse = await fetch(`${base}/assessment`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({action:"start",readinessId}),
      });
      const start = await startResponse.json();
      if (!startResponse.ok) throw new Error(start.error || "Unable to start EXP session.");
      const savedId = String(start.sessionId);
      const participantResponse = await fetch(`${base}/participants`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({readinessId,sessionId:savedId,allDriversWatched:true,
          participants:drivers.map(d=>({fullName:d.fullName,initials:d.initials}))}),
      });
      const saved = await participantResponse.json();
      if (!participantResponse.ok && !(participantResponse.status === 409 && saved.error === "Participants already recorded for this session."))
        throw new Error(saved.error || "Unable to save driver acknowledgments.");
      setSessionId(savedId);
      setDriverNames(drivers);
      setShowAssessment(true);
    } catch(error) {
      setServerError(error instanceof Error ? error.message : "Unable to record EXP.");
    } finally { setSavingParticipants(false); }
  }
  if (!eligible) return null;

  return (
    <>
      <section className={styles.panel} aria-label="Epic Xpress Ready orientation">
        <div>
          <span className={styles.eyebrow}>OUR FASTEST CHECK-OUT · OPTIONAL</span>
          <h2>Epic Xpress Ready</h2>
          {reviewerMode ? <p><strong>Employee preview only.</strong> This demonstration does not record EXP completion or change guest readiness.</p> : null}
          <p>Get a head start on your adventure. Complete a short safety orientation and quick knowledge check before you arrive for our fastest check-out — and more time on the trail.</p>
          {reviewerMode && previewRecord ? <p style={{color:"#176534",fontWeight:750}}>Preview assessment complete: {previewRecord.drivers.join(", ")}. <a href="/team/readiness">View in Readiness</a> (same browser only).</p> : null}
        </div>
        <button className={styles.action} type="button" onClick={() => { setStarted(true); setShowAssessment(false); setSelectDrivers(false); setDriverNames([]); setWatchedAcknowledged(false); setVideoCoverageMet(false); setOpen(true); }}>
          Get Started
        </button>
      </section>
      {open ? (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="exp-title" aria-describedby="exp-desc">
            <button className={styles.close} type="button" aria-label="Close orientation" onClick={() => setOpen(false)}>×</button>
            <span className={styles.eyebrow}>OUR FASTEST CHECK-OUT · OPTIONAL</span>
            <h2 id="exp-title">Epic Xpress Ready</h2>
            {!showAssessment && !selectDrivers ? <p id="exp-desc">Get a head start on your adventure. Watch a short video to get comfortable with your RZR, then take a quick knowledge check. You'll arrive ready to roll — with more time for the trails.</p> : null}
            {showAssessment ? (
              sessionId && readinessId ? <ExpServerAssessment token={token} readinessId={readinessId} sessionId={sessionId} onExit={() => { setShowAssessment(false); setOpen(false); }} /> : <p role="alert">EXP session unavailable. Please reopen your guest portal.</p>
            ) : selectDrivers ? (
              <ExpParticipants reviewerMode={reviewerMode} waiverDrivers={[...new Set([...waiverDrivers, ...signedRentalDrivers])]} onContinue={drivers => void prepareSession(drivers)} onBack={() => setSelectDrivers(false)} />
            ) : (
              <ExpTrackedVideo onCoverageChange={setVideoCoverageMet} />
            )}
            {serverError ? <p role="alert" style={{color:"#a83232"}}>{serverError}</p> : null}
            {savingParticipants ? <p role="status">Saving driver acknowledgments…</p> : null}
            {started && !showAssessment && !selectDrivers ? (
              <div className={styles.previewNext}>
                <label className={styles.acknowledge}>
                  <input type="checkbox" checked={watchedAcknowledged} onChange={(event) => setWatchedAcknowledged(event.target.checked)} />
                  <span>I/we have watched the entire safety orientation video.</span>
                </label>
                <button className={styles.action} type="button" disabled={!watchedAcknowledged || !videoCoverageMet} onClick={() => setSelectDrivers(true)}>
                  Continue to Knowledge Check
                </button>
                {reviewerMode ? <button className={styles.later} type="button" onClick={() => setSelectDrivers(true)}>Reviewer shortcut: Continue to driver selection</button> : null}
                <p className={styles.disclaimer}>Testing preview — EXP completion is not currently recorded.</p>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
