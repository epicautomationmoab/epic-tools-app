"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ExpVideoPreview.module.css";
import ExpServerAssessment from "./ExpServerAssessment";
import ExpTrackedVideo, {type ExpPlaybackCheckpoint} from "./ExpTrackedVideo";
import ExpParticipants, { type ExpParticipantDraft } from "./ExpParticipants";

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
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [selectDrivers, setSelectDrivers] = useState(false);
  const [driverNames, setDriverNames] = useState<ExpParticipantDraft[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [serverQuestions,setServerQuestions] = useState<Array<{id:string;prompt:string;options:Array<{id:string;text:string}>}>>([]);
  const [savedPlayback,setSavedPlayback]=useState<ExpPlaybackCheckpoint|undefined>();
  const [serverError, setServerError] = useState("");
  const [savingParticipants, setSavingParticipants] = useState(false);
  const lastPlayback = useRef<ExpPlaybackCheckpoint | null>(null);
  const startingRef = useRef(false);
  const [startingSession,setStartingSession] = useState(false);
  const readinessId = activities.find(a => a.businessLine.toLowerCase() === "rental")?.readinessId ?? "";
  const [watchedAcknowledged, setWatchedAcknowledged] = useState(false);
  const [videoCoverageMet, setVideoCoverageMet] = useState(false);
  const [formsLoaded, setFormsLoaded] = useState(false);
  const [signedRentalDrivers, setSignedRentalDrivers] = useState<string[]>([]);
  const [verifiedExpStatus,setVerifiedExpStatus]=useState<boolean|null>(null);
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

  useEffect(()=>{
    if(!eligible||!token)return;
    let active=true;
    async function refresh(){
      try{
       const response=await fetch(`/api/guest/${encodeURIComponent(token)}/exp/status`,{cache:"no-store"});
       if(!response.ok)return;
       const payload=await response.json() as {rentals?:Array<{readinessId:string;expReady:boolean}>};
       if(active)setVerifiedExpStatus(payload.rentals?.find(r=>r.readinessId===readinessId)?.expReady===true);
      }catch{/* A status lookup failure must never award readiness. */}
    }
    void refresh();const timer=window.setInterval(()=>void refresh(),30000);
    return()=>{active=false;window.clearInterval(timer)};
  },[eligible,readinessId,token]);

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

  // Create/resume a session when the guest opens the orientation, not after
  // finishing the video. This lets periodic playback checkpoints survive exit.
  useEffect(() => {
    if (!open || !readinessId || !token || sessionId || startingRef.current) return;
    startingRef.current = true;
    setStartingSession(true);
    let cancelled = false;
    void (async () => {
      try {
        const base = `/api/guest/${encodeURIComponent(token)}/exp`;
        const response = await fetch(`${base}/assessment`,{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({action:"start",readinessId})
        });
        const started = await response.json();
        if (!response.ok || !started.sessionId || !Array.isArray(started.questions))
          throw new Error(started.error || "Unable to resume EXP.");
        if (cancelled) return;
        setServerQuestions(started.questions);
        const progressResponse = await fetch(`${base}/progress?readinessId=${encodeURIComponent(readinessId)}&sessionId=${encodeURIComponent(started.sessionId)}`,{cache:"no-store"});
        if (progressResponse.ok){
          const progress = await progressResponse.json();
          const duration = Number(progress.videoDurationSeconds ?? 0);
          if(!cancelled && duration>0)setSavedPlayback({watchedSeconds:progress.videoWatchedSeconds??[],durationSeconds:duration,ended:progress.videoEndedReported===true});
          if (!cancelled && progress.videoEndedReported && duration>0 &&
            Number(progress.videoSecondsObserved ?? 0)>=Math.ceil(duration*0.98)) {
            setVideoCoverageMet(true);
            setWatchedAcknowledged(true);
            if(progress.participants?.length)setShowAssessment(true);
          }
        }
        if(!cancelled)setSessionId(started.sessionId);
      }catch(error){
        if(!cancelled)setServerError(error instanceof Error?error.message:"EXP session unavailable.");
      }finally{
        startingRef.current=false;
        if(!cancelled)setStartingSession(false);
      }
    })();
    return()=>{cancelled=true};
  },[open,readinessId,token,sessionId]);

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
      if (!Array.isArray(start.questions) || start.questions.length !== 10) throw new Error("Assessment questions unavailable.");
      setServerQuestions(start.questions);
      if (lastPlayback.current) {
        const cp = lastPlayback.current;
        const checkpointResponse = await fetch(`${base}/progress`,{
          method:"PATCH",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({readinessId,sessionId:savedId,videoWatchedSeconds:cp.watchedSeconds,videoDurationSeconds:cp.durationSeconds,videoEnded:cp.ended})
        });
        if (!checkpointResponse.ok) throw new Error("Unable to save video progress. Please try again.");
      }
      const participantResponse = await fetch(`${base}/participants`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({readinessId,sessionId:savedId,allDriversWatched:true,
          participants:drivers.map(d=>({fullName:d.fullName,initials:d.initials}))}),
      });
      const saved = await participantResponse.json();
      if (!participantResponse.ok)
        throw new Error(saved.error || "Unable to save driver acknowledgments.");
      setSessionId(savedId);
      setDriverNames(drivers);
      setShowAssessment(true);
    } catch(error) {
      setServerError(error instanceof Error ? error.message : "Unable to record EXP.");
    } finally { setSavingParticipants(false); }
  }
  async function checkpointPlayback(cp:ExpPlaybackCheckpoint){
    lastPlayback.current = cp;
    if (!sessionId || !readinessId) return;
    try { await fetch(`/api/guest/${encodeURIComponent(token)}/exp/progress`,{
      method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({readinessId,sessionId,videoWatchedSeconds:cp.watchedSeconds,videoDurationSeconds:cp.durationSeconds,videoEnded:cp.ended})
    }); }catch{ /* Preserve client progress until the final required save. */ }
  }
  if (!eligible) return null;

  return (
    <>
      <section className={styles.panel} aria-label="Epic Xpress Ready orientation">
        <div>
          <span className={styles.eyebrow}>OUR FASTEST CHECK-OUT · OPTIONAL</span>
          <h2>Epic Xpress Ready</h2>
          {verifiedExpStatus!==null ? <p role="status" style={{fontWeight:750,color:verifiedExpStatus?"#176534":"#865621"}}>{verifiedExpStatus?"EXP Ready — all required paperwork and orientation verified.":"EXP pending — paperwork and driver orientation requirements are still being verified."}</p> : null}
          {reviewerMode ? <p><strong>Employee preview only.</strong> This demonstration does not record EXP completion or change guest readiness.</p> : null}
          <p>Get a head start on your adventure. Complete a short safety orientation and quick knowledge check before you arrive for our fastest check-out — and more time on the trail.</p>
          
        </div>
        <button className={styles.action} type="button" onClick={() => { setStarted(true); setShowAssessment(false); setSelectDrivers(false); setDriverNames([]); setWatchedAcknowledged(false); setVideoCoverageMet(false); setSessionId(null);setSavedPlayback(undefined);setServerQuestions([]);lastPlayback.current=null;setOpen(true); }}>
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
              sessionId && readinessId && serverQuestions.length===10 ? <ExpServerAssessment token={token} readinessId={readinessId} sessionId={sessionId} questions={serverQuestions} onExit={() => { setShowAssessment(false); setOpen(false); }} /> : <p role="alert">EXP session unavailable. Please reopen your guest portal.</p>
            ) : selectDrivers ? (
              <ExpParticipants reviewerMode={reviewerMode} waiverDrivers={signedRentalDrivers} onContinue={drivers => void prepareSession(drivers)} onBack={() => setSelectDrivers(false)} />
            ) : (
              sessionId ? <ExpTrackedVideo key={sessionId} initialCheckpoint={savedPlayback} onCoverageChange={setVideoCoverageMet} onCheckpoint={cp=>void checkpointPlayback(cp)} /> : <p>Loading saved orientation…</p>
            )}
            {startingSession ? <p role="status">Preparing saved EXP session…</p> : null}
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
                <p className={styles.disclaimer}>EXP progress is saved to staging. Checkout readiness remains pending verification of all required paperwork and driver records.</p>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
