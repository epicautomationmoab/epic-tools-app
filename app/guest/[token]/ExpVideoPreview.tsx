"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ExpVideoPreview.module.css";
import ExpAssessment from "./ExpAssessment";
import ExpTrackedVideo from "./ExpTrackedVideo";
import ExpParticipants, { type ExpParticipantDraft } from "./ExpParticipants";
import { EXP_QUESTION_BANK_DRAFT } from "@/lib/exp/question-bank-draft";

const DAY_MS = 24 * 60 * 60 * 1000;

type Rental = { readinessId: string; businessLine: string; visitStartTime: string };

export default function ExpVideoPreview({
  token,
  activities,
  waiverDrivers = [],
  reviewerMode = false,
}: {
  token: string;
  activities: Rental[];
  waiverDrivers?: string[];
  reviewerMode?: boolean;
}) {
  // Enabled only for the EXP feature branch preview through Vercel branch-scoped config.
  // PREVIEW ONLY. Scoring happens in the browser and does not persist any completion.
  // Production requires server-owned answer keys, secure sessions, and per-driver records.
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [selectDrivers, setSelectDrivers] = useState(false);
  const [driverNames, setDriverNames] = useState<ExpParticipantDraft[]>([]);
  const [watchedAcknowledged, setWatchedAcknowledged] = useState(false);
  const [videoCoverageMet, setVideoCoverageMet] = useState(false);
  const [formsLoaded, setFormsLoaded] = useState(false);
  const [outstandingRequiredForms, setOutstandingRequiredForms] = useState(false);
  const eligible = useMemo(() => {
    if (now === null) return false;
    return activities.some((activity) => {
      if (activity.businessLine.toLowerCase() !== "rental") return false;
      const start = new Date(activity.visitStartTime).getTime();
      return Number.isFinite(start) && start >= now && (reviewerMode || start - now <= DAY_MS);
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
        const data = await response.json() as { tasks?: Array<{ status: string; required: boolean; templateKey: string | null }> };
        if (cancelled) return;
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

  if (!eligible) return null;

  return (
    <>
      <section className={styles.panel} aria-label="Epic Xpress Ready orientation">
        <div>
          <span className={styles.eyebrow}>OUR FASTEST CHECK-OUT · OPTIONAL</span>
          <h2>Epic Xpress Ready</h2>
          {reviewerMode ? <p><strong>Employee preview only.</strong> This demonstration does not record EXP completion or change guest readiness.</p> : null}
          <p>Get a head start on your adventure. Complete a short safety orientation and quick knowledge check before you arrive for our fastest check-out — and more time on the trail.</p>
        </div>
        <button className={styles.action} type="button" onClick={() => { setStarted(false); setShowAssessment(false); setSelectDrivers(false); setDriverNames([]); setWatchedAcknowledged(false); setVideoCoverageMet(false); setOpen(true); }}>
          Get Started
        </button>
      </section>
      {open ? (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="exp-title" aria-describedby="exp-desc">
            <button className={styles.close} type="button" aria-label="Close orientation" onClick={() => setOpen(false)}>×</button>
            <span className={styles.eyebrow}>OUR FASTEST CHECK-OUT · OPTIONAL</span>
            <h2 id="exp-title">Epic Xpress Ready</h2>
            <p id="exp-desc">Get a head start on your adventure. Watch a short video to get comfortable with your RZR, then take a quick knowledge check. You'll arrive ready to roll — with more time for the trails.</p>
            {showAssessment ? (
              <ExpAssessment questions={EXP_QUESTION_BANK_DRAFT} onExit={() => { setShowAssessment(false); setOpen(false); }} />
            ) : selectDrivers ? (
              <ExpParticipants waiverDrivers={waiverDrivers} onContinue={drivers => { setDriverNames(drivers); setShowAssessment(true); }} onBack={() => setSelectDrivers(false)} />
            ) : started ? (
              <ExpTrackedVideo onCoverageChange={setVideoCoverageMet} />
            ) : (
              <div className={styles.intro}>
                <button className={styles.action} type="button" onClick={() => setStarted(true)}>Get Started</button>
                <button className={styles.later} type="button" onClick={() => setOpen(false)}>Maybe Later</button>
              </div>
            )}
            {started && !showAssessment && !selectDrivers ? (
              <div className={styles.previewNext}>
                <label className={styles.acknowledge}>
                  <input type="checkbox" checked={watchedAcknowledged} onChange={(event) => setWatchedAcknowledged(event.target.checked)} />
                  <span>I/we have watched the entire safety orientation video.</span>
                </label>
                <button className={styles.action} type="button" disabled={!watchedAcknowledged || !videoCoverageMet} onClick={() => setSelectDrivers(true)}>
                  Continue to Knowledge Check
                </button>
                <p className={styles.disclaimer}>Testing preview — EXP completion is not currently recorded.</p>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
