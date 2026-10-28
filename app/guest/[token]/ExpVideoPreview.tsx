"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ExpVideoPreview.module.css";
import ExcCompletion,{ExcOptionalInvitation,ExcOrientationIntro} from "./ExcCompletion";
import ExpServerAssessment from "./ExpServerAssessment";
import ExpTrackedVideo, {type ExpPlaybackCheckpoint} from "./ExpTrackedVideo";
import BeltTireInquiry from "./BeltTireInquiry";
import {beltTireCueReached} from "@/lib/exp/belt-tire-inquiry";
import ExpSessionChoice,{type ExpSessionChoices} from "./ExpSessionChoice";
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

type DriverStatus={name:string;expReady:boolean;orientationComplete:boolean;outstanding:string[]};
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
  // Assessment scoring and progress persistence are owned by the server.
  const [now, setNow] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [started, setStarted] = useState(false);
  const [showAssessment, setShowAssessment] = useState(false);
  const [selectDrivers, setSelectDrivers] = useState(false);
  const [driverNames, setDriverNames] = useState<ExpParticipantDraft[]>([]);
  const [inquiryAvailable,setInquiryAvailable]=useState(false);
  const [sessionChoices,setSessionChoices]=useState<ExpSessionChoices|null>(null);
  const [selectedSessionDrivers,setSelectedSessionDrivers]=useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [serverQuestions,setServerQuestions] = useState<Array<{id:string;prompt:string;options:Array<{id:string;text:string}>}>>([]);
  const [savedPlayback,setSavedPlayback]=useState<ExpPlaybackCheckpoint|undefined>();
  const [serverError, setServerError] = useState("");
  const [savingParticipants, setSavingParticipants] = useState(false);
  const lastPlayback = useRef<{sessionId:string;checkpoint:ExpPlaybackCheckpoint} | null>(null);
  const startingRef = useRef(false);
  const selectionGeneration=useRef(0);
  const [startingSession,setStartingSession] = useState(false);
  const [sessionReadinessId,setSessionReadinessId]=useState<string|null>(null);
  const primaryReadinessId = activities.find(a => a.businessLine.toLowerCase() === "rental")?.readinessId ?? "";
  const readinessId=sessionReadinessId||primaryReadinessId;
  const [watchedAcknowledged, setWatchedAcknowledged] = useState(false);
  const [videoCoverageMet, setVideoCoverageMet] = useState(false);
  const [formsLoaded, setFormsLoaded] = useState(false);
  const [signedRentalDrivers, setSignedRentalDrivers] = useState<string[]>([]);
  const [verifiedExpStatus,setVerifiedExpStatus]=useState<boolean|null>(null);
  const [driverStatuses,setDriverStatuses]=useState<DriverStatus[]>([]);
  const [statusError,setStatusError]=useState(false);
  const [paperworkReady,setPaperworkReady]=useState(false);
  const [assessmentStarted,setAssessmentStarted]=useState(false);
  const [statusRefresh,setStatusRefresh]=useState(0);
  function closeOrientation(){selectionGeneration.current++;startingRef.current=false;setStartingSession(false);setOpen(false);setStatusRefresh(value=>value+1)}
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
       if(!response.ok)throw new Error("Status unavailable");
       const payload=await response.json() as {rentals?:Array<{readinessId:string;expReady:boolean;drivers:DriverStatus[];assessmentSessions:number;documentChecks?:Record<string,boolean>}>};
       const rental=payload.rentals?.find(r=>r.readinessId===readinessId);
       if(active){setStatusError(false);setPaperworkReady(["signedEpicDriverAgreements","epicAgreements","polarisWaivers","ohvCertificates","driverRoster"].every(key=>rental?.documentChecks?.[key]===true));setVerifiedExpStatus(rental?.expReady===true);setDriverStatuses(rental?.drivers??[]);setAssessmentStarted((rental?.assessmentSessions??0)>0)}
      }catch{if(active){setStatusError(true);setPaperworkReady(false);setVerifiedExpStatus(null);setDriverStatuses([])}}
    }
    void refresh();const timer=window.setInterval(()=>void refresh(),30000);
    return()=>{active=false;window.clearInterval(timer)};
  },[eligible,readinessId,token,statusRefresh]);

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
    const refresh=window.setInterval(()=>void checkForms(),30000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, [eligible, token]);

  useEffect(() => {
    if (reviewerMode || !eligible || !token || !formsLoaded || !paperworkReady || outstandingRequiredForms || verifiedExpStatus!==false || (driverStatuses.length>0 && driverStatuses.every(d=>d.orientationComplete))) return;
    const key = `epic-exp-prompted-v1:${token}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // Storage may be blocked; still permit manual opening via the portal card.
    }
    setStarted(true);
    setShowWelcome(true);
    setOpen(true);
  }, [eligible, token, formsLoaded, outstandingRequiredForms, reviewerMode,verifiedExpStatus,driverStatuses,paperworkReady]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeOrientation();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Reopening always offers saved sessions and untouched drivers; it never silently picks another driver's work.
  useEffect(()=>{
    if(!open||sessionId||!primaryReadinessId)return;
    let cancelled=false;setSessionChoices(null);setServerError("");
    void (async()=>{try{
      const response=await fetch(`/api/guest/${encodeURIComponent(token)}/exp/sessions?readinessId=${encodeURIComponent(primaryReadinessId)}`,{cache:"no-store"});
      const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to load orientations.");
      if(!cancelled)setSessionChoices(data);
    }catch(error){if(!cancelled)setServerError(error instanceof Error?error.message:"Unable to load orientations.")}})();
    return()=>{cancelled=true};
  },[open,sessionId,primaryReadinessId,token]);

  async function chooseSession(selection:{sessionId:string}|{selectedDriverNames:string[]}){
    if(startingRef.current)return;const generation=++selectionGeneration.current;startingRef.current=true;setStartingSession(true);setServerError("");
    try{
      const base=`/api/guest/${encodeURIComponent(token)}/exp`;
      const response=await fetch(`${base}/assessment`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"start",readinessId:primaryReadinessId,...selection})});
      const saved=await response.json();if(!response.ok)throw new Error(saved.error||"Unable to open orientation.");
      const anchor=String(saved.readinessId||primaryReadinessId);
      const progressResponse=await fetch(`${base}/progress?readinessId=${encodeURIComponent(anchor)}&sessionId=${encodeURIComponent(saved.sessionId)}`,{cache:"no-store"});
      if(!progressResponse.ok)throw new Error("Unable to retrieve saved progress.");
      const progress=await progressResponse.json();if(generation!==selectionGeneration.current)return;const duration=Number(progress.videoDurationSeconds??0);
      setInquiryAvailable(beltTireCueReached(0,progress.videoWatchedSeconds??[]));
      setSelectedSessionDrivers(saved.selectedDriverNames??[]);setServerQuestions(saved.questions);setSessionReadinessId(anchor);
      setSavedPlayback(duration>0?{watchedSeconds:progress.videoWatchedSeconds??[],durationSeconds:duration,ended:progress.videoEndedReported===true}:undefined);
      const covered=progress.videoCoverageMet===true;setVideoCoverageMet(covered);setWatchedAcknowledged(covered);
      setShowAssessment(covered&&progress.participants?.length>0);setSelectDrivers(false);lastPlayback.current=null;
      setSessionId(saved.sessionId);
    }catch(error){if(generation===selectionGeneration.current)setServerError(error instanceof Error?error.message:"Unable to open orientation.")}
    finally{if(generation===selectionGeneration.current){startingRef.current=false;setStartingSession(false)}}
  }

  async function prepareSession(drivers: ExpParticipantDraft[]) {
    if (!readinessId) return;
    setSavingParticipants(true);
    setServerError("");
    try {
      const base = `/api/guest/${encodeURIComponent(token)}/exp`;
      if(!sessionId)throw new Error("Choose the participating drivers before continuing.");
      const savedId=sessionId;
      const savedReadinessId=readinessId;
      if (lastPlayback.current?.sessionId===savedId) {
        const cp = lastPlayback.current.checkpoint;
        const checkpointResponse = await fetch(`${base}/progress`,{
          method:"PATCH",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({readinessId:savedReadinessId,sessionId:savedId,videoWatchedSeconds:cp.watchedSeconds,videoDurationSeconds:cp.durationSeconds,videoEnded:cp.ended})
        });
        if (!checkpointResponse.ok) throw new Error("Unable to save video progress. Please try again.");
      }
      const participantResponse = await fetch(`${base}/participants`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({readinessId:savedReadinessId,sessionId:savedId,allDriversWatched:true,
          participants:drivers.map(d=>({fullName:d.fullName,initials:d.initials}))}),
      });
      const saved = await participantResponse.json();
      if (!participantResponse.ok)
        throw new Error(saved.error || "Unable to save driver acknowledgments.");
      setSessionReadinessId(savedReadinessId);
      setSessionId(savedId);
      setDriverNames(drivers);
      setSelectedSessionDrivers(drivers.map(d=>d.fullName));
      setShowAssessment(true);
    } catch(error) {
      setServerError(error instanceof Error ? error.message : "Unable to record your orientation.");
    } finally { setSavingParticipants(false); }
  }
  async function checkpointPlayback(cp:ExpPlaybackCheckpoint){
    if (!sessionId || !readinessId) return;
    lastPlayback.current = {sessionId,checkpoint:cp};
    try { await fetch(`/api/guest/${encodeURIComponent(token)}/exp/progress`,{
      method:"PATCH",keepalive:true,headers:{"Content-Type":"application/json"},
      body:JSON.stringify({readinessId,sessionId,videoWatchedSeconds:cp.watchedSeconds,videoDurationSeconds:cp.durationSeconds,videoEnded:cp.ended})
    }); }catch{ /* Preserve client progress until the final required save. */ }
  }
  if (!eligible) return null;

  return (
    <>
      <section className={styles.panel} aria-label="Epic Xpress Checkout orientation">
        <div>
          <span className={styles.eyebrow}>OPTIONAL · SAVE TIME AT ARRIVAL</span>
          <h2>Epic Xpress Checkout</h2>
          {verifiedExpStatus===null?<p role="status">{statusError?'Orientation status is unavailable. Please refresh this page.':'Checking saved orientation progress…'}</p>:<ExcCompletion drivers={driverStatuses} qualified={verifiedExpStatus===true}/>}
          {reviewerMode?<p><strong>Employee preview only.</strong> This demonstration does not change guest readiness.</p>:null}
          {verifiedExpStatus===false&&!driverStatuses.some(driver=>driver.orientationComplete)?<p>Finish a short safety orientation before arrival and get on the trail sooner. <strong>About 13 minutes.</strong></p>:null}
        </div>
        {verifiedExpStatus!==true && !(driverStatuses.length>0&&driverStatuses.every(driver=>driver.orientationComplete)) ? <button className={styles.action} type="button" disabled={verifiedExpStatus===null} onClick={() => { setStarted(true); setShowAssessment(false); setSelectDrivers(false); setDriverNames([]); setWatchedAcknowledged(false); setVideoCoverageMet(false); setSessionId(null);setSessionChoices(null);setInquiryAvailable(false);setSelectedSessionDrivers([]);setServerError("");setSessionReadinessId(null);setSavedPlayback(undefined);setServerQuestions([]);lastPlayback.current=null;setShowWelcome(true);setOpen(true); }}>
          {assessmentStarted?"Continue Orientation":"Get Started"}
        </button>:null}
      </section>
      {open ? (
        <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) closeOrientation(); }}>
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="exp-title" aria-describedby={sessionId&&!showAssessment&&!selectDrivers?"exp-desc":undefined}>
            <button className={styles.close} type="button" aria-label="Close orientation" onClick={closeOrientation}>×</button>
            <span className={styles.eyebrow}>OUR FASTEST CHECK-OUT · OPTIONAL</span>
            <h2 id="exp-title">Epic Xpress Checkout</h2>
            {!sessionId && showWelcome ? <div className={styles.welcomeInvitation}>
              <h3>Your Xpress Checkout is ready when you are.</h3>
              <p>Spend <strong>less than 15 minutes</strong> completing your safety orientation and knowledge check before arrival, so you can spend less time checking out and more time on the trail.</p>
              <p>Multiple drivers? Complete it together or individually.</p>
              <div className={styles.welcomeActions}>
                <button className={styles.action} type="button" onClick={() => setShowWelcome(false)}>Get Started</button>
                <button className={styles.inPersonLink} type="button" onClick={closeOrientation}>Maybe Later</button>
              </div>
            </div> : null}
            {sessionId && !showAssessment && !selectDrivers ? <div id="exp-desc" className={styles.videoIntroduction}>
              <p>Watch our safety orientation, then complete a quick knowledge check. Your progress is saved if you need to come back later.</p>
              <button className={styles.inPersonLink} type="button" onClick={closeOrientation}>Prefer to complete this in person?</button>
            </div> : null}
            {!sessionId ? (
              showWelcome ? null : sessionChoices ? <ExpSessionChoice choices={sessionChoices} busy={startingSession} onStart={names=>void chooseSession({selectedDriverNames:names})} onResume={id=>void chooseSession({sessionId:id})}/> : <p role="status">Loading saved orientations…</p>
            ) : showAssessment ? (
              sessionId && readinessId && serverQuestions.length===10 ? <ExpServerAssessment token={token} readinessId={readinessId} sessionId={sessionId} questions={serverQuestions} onExit={() => { setShowAssessment(false); closeOrientation(); }} /> : <p role="alert">Orientation session unavailable. Please reopen your guest portal.</p>
            ) : selectDrivers ? (
              <ExpParticipants reviewerMode={reviewerMode} waiverDrivers={selectedSessionDrivers.length?selectedSessionDrivers:signedRentalDrivers} fixedRoster={selectedSessionDrivers.length>0} onContinue={drivers => void prepareSession(drivers)} onBack={() => setSelectDrivers(false)} />
            ) : (
              sessionId ? <ExpTrackedVideo key={sessionId} initialCheckpoint={savedPlayback} onInquiryAvailable={()=>setInquiryAvailable(true)} onCoverageChange={setVideoCoverageMet} onCheckpoint={cp=>void checkpointPlayback(cp)} /> : <p>Loading saved orientation…</p>
            )}
            {sessionId&&inquiryAvailable?<BeltTireInquiry key={sessionId} token={token} readinessId={readinessId} sessionId={sessionId} rosterKey={selectedSessionDrivers.join("|")}/>:null}
            {startingSession ? <p role="status">Preparing saved orientation…</p> : null}
            {serverError ? <p role="alert" style={{color:"#a83232"}}>{serverError}</p> : null}
            {savingParticipants ? <p role="status">Saving driver acknowledgments…</p> : null}
            {started && sessionId && !showAssessment && !selectDrivers ? (
              <div className={styles.previewNext}>
                <label className={styles.acknowledge}>
                  <input type="checkbox" checked={watchedAcknowledged} onChange={(event) => setWatchedAcknowledged(event.target.checked)} />
                  <span>I/we have watched the entire safety orientation video.</span>
                </label>
                <button className={styles.action} type="button" disabled={!watchedAcknowledged || !videoCoverageMet} onClick={() => setSelectDrivers(true)}>
                  Continue to Knowledge Check
                </button>
                {reviewerMode ? <button className={styles.later} type="button" onClick={() => setSelectDrivers(true)}>Reviewer shortcut: Continue to driver selection</button> : null}
                <p className={styles.disclaimer}>Your progress saves automatically. Your Adventure Tech will help with final check-out when you arrive.</p>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
