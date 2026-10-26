"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ExpVideoPreview.module.css";

const VIDEO_URL = "https://player.vimeo.com/video/1239550688?autoplay=0&muted=0&loop=0";
const DAY_MS = 24 * 60 * 60 * 1000;

type Rental = { readinessId: string; businessLine: string; visitStartTime: string };

export default function ExpVideoPreview({
  token,
  activities,
}: {
  token: string;
  activities: Rental[];
}) {
  // This whole component is behind NEXT_PUBLIC_EXP_VIDEO_PREVIEW=true in the portal.
  // The production EXP quiz, driver identity, and completion tracking do not exist yet.
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [formsLoaded, setFormsLoaded] = useState(false);
  const [outstandingRequiredForms, setOutstandingRequiredForms] = useState(false);
  const eligible = useMemo(() => {
    if (now === null) return false;
    return activities.some((activity) => {
      if (activity.businessLine.toLowerCase() !== "rental") return false;
      const start = new Date(activity.visitStartTime).getTime();
      return Number.isFinite(start) && start >= now && start - now <= DAY_MS;
    });
  }, [activities, now]);

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
    const interval = window.setInterval(checkForms, 8000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [eligible, token]);

  useEffect(() => {
    if (!eligible || !token || !formsLoaded || outstandingRequiredForms) return;
    const key = `epic-exp-prompted-v1:${token}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage may be blocked; still permit manual opening via the portal card.
    }
    setOpen(true);
  }, [eligible, token, formsLoaded, outstandingRequiredForms]);

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
          <span className={styles.eyebrow}>Available before rental pickup</span>
          <h2>Get Epic Xpress Ready!</h2>
          <p>Watch our rental orientation before your adventure. The knowledge check is being finalized and is not available yet.</p>
        </div>
        <button className={styles.action} type="button" onClick={() => { setStarted(false); setOpen(true); }}>
          Watch orientation
        </button>
      </section>
      {open ? (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="exp-title" aria-describedby="exp-desc">
            <button className={styles.close} type="button" aria-label="Close orientation" onClick={() => setOpen(false)}>×</button>
            <span className={styles.eyebrow}>Rental safety orientation · Preview</span>
            <h2 id="exp-title">Get Epic Xpress Ready!</h2>
            <p id="exp-desc">Watch our rental operations and safety video before arriving for faster checkout. This preview does not record training completion.</p>
            {started ? (
              <div className={styles.video}>
                <iframe
                  src={VIDEO_URL}
                  title="Epic 4X4 Rental Operations Video 3.2"
                  allow="fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            ) : (
              <div className={styles.intro}>
                <button className={styles.action} type="button" onClick={() => setStarted(true)}>Watch orientation</button>
                <button className={styles.later} type="button" onClick={() => setOpen(false)}>Maybe later</button>
              </div>
            )}
            {started ? <p className={styles.disclaimer}>Your training quiz and individual completion tracking will be added before EXP launches. Watching this preview does not replace the required in-person orientation.</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
