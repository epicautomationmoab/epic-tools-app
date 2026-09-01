"use client";

import { useEffect, useMemo, useState } from "react";

type LiveCall = {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  source_name: string | null;
  campaign: string | null;
  received_at: string;
  route_kind: "open_lead" | "active_reservation" | "known_contact" | "new_lead";
  opportunity_id: string | null;
  reservation_id: string | null;
  contact_id: string | null;
  confirmation_code: string | null;
  route_label: string | null;
};

function routeTitle(kind: LiveCall["route_kind"]) {
  if (kind === "open_lead") return "Open Sales Lead";
  if (kind === "active_reservation") return "Active Reservation";
  if (kind === "known_contact") return "Known Epic Contact";
  return "New Caller";
}

function actionLabel(kind: LiveCall["route_kind"]) {
  if (kind === "open_lead") return "Open Lead";
  if (kind === "active_reservation") return "Open Readiness";
  if (kind === "known_contact") return "Open Guest Lookup";
  return "Capture Lead";
}

function destination(call: LiveCall) {
  if (call.route_kind === "open_lead" && call.opportunity_id) return `/team/leads?opportunity=${encodeURIComponent(call.opportunity_id)}`;
  if (call.route_kind === "active_reservation" && call.confirmation_code) return `/team/readiness?confirmation=${encodeURIComponent(call.confirmation_code)}`;
  if (call.route_kind === "known_contact") return `/team/previous-guests?phone=${encodeURIComponent(call.caller_phone)}`;
  return `/team/leads/inbox?live_call=${encodeURIComponent(call.id)}`;
}

export default function LiveCallScreenPop() {
  const [call, setCall] = useState<LiveCall | null>(null);
  const [mutedUntil, setMutedUntil] = useState(0);

  useEffect(() => {
    let stopped = false;
    let busy = false;

    async function poll() {
      if (stopped || busy || document.visibilityState !== "visible" || Date.now() < mutedUntil) return;
      busy = true;
      try {
        const response = await fetch("/api/team/live-calls", { cache: "no-store" });
        const payload = await response.json();
        if (!stopped && response.ok && payload.call) setCall(payload.call as LiveCall);
      } catch {}
      finally { busy = false; }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 1000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [mutedUntil]);

  const href = useMemo(() => call ? destination(call) : "#", [call]);

  async function markSeen() {
    if (!call) return;
    try {
      await fetch("/api/team/live-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ live_call_id: call.id }),
      });
    } catch {}
  }

  async function dismiss() {
    await markSeen();
    setCall(null);
    setMutedUntil(Date.now() + 1500);
  }

  async function open() {
    if (!call) return;
    await markSeen();
    window.location.href = href;
  }

  if (!call) return null;

  return (
    <div style={{position:"fixed",right:24,top:24,zIndex:10000,width:"min(390px,calc(100vw - 32px))",background:"#fff",border:"1px solid #cfd8e1",borderRadius:16,boxShadow:"0 18px 50px rgba(15,23,42,.25)",padding:18}} role="status" aria-live="polite">
      <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"start"}}>
        <div>
          <div style={{fontSize:12,fontWeight:900,letterSpacing:".08em",textTransform:"uppercase",color:"#627184"}}>Incoming Call</div>
          <div style={{fontSize:22,fontWeight:950,lineHeight:1.15,marginTop:3}}>{call.caller_name || call.route_label || call.caller_phone}</div>
          <div style={{fontSize:14,fontWeight:800,color:"#677587",marginTop:4}}>{call.caller_phone}</div>
        </div>
        <button type="button" onClick={()=>void dismiss()} aria-label="Dismiss incoming call" style={{border:0,background:"transparent",fontSize:24,lineHeight:1,cursor:"pointer",color:"#73808d"}}>×</button>
      </div>

      <div style={{marginTop:14,padding:"11px 12px",borderRadius:11,background:call.route_kind==="new_lead"?"#fff7da":call.route_kind==="active_reservation"?"#eaf7ef":"#eef5ff",border:"1px solid #d7e0e8"}}>
        <div style={{fontSize:12,fontWeight:900,color:"#697788"}}>{routeTitle(call.route_kind)}</div>
        <div style={{fontSize:16,fontWeight:900,marginTop:2}}>{call.route_label || call.confirmation_code || "Caller not yet identified"}</div>
        {call.confirmation_code ? <div style={{fontSize:13,fontWeight:800,color:"#667486",marginTop:2}}>{call.confirmation_code}</div> : null}
      </div>

      {(call.source_name || call.campaign) ? <div style={{fontSize:12,color:"#718090",fontWeight:750,marginTop:10}}>{[call.source_name,call.campaign].filter(Boolean).join(" · ")}</div> : null}

      <div style={{display:"flex",justifyContent:"flex-end",gap:9,marginTop:15}}>
        <button type="button" onClick={()=>void dismiss()} style={{border:"1px solid #d5dde5",background:"white",borderRadius:9,padding:"9px 12px",fontWeight:850,cursor:"pointer"}}>Dismiss</button>
        <button type="button" onClick={()=>void open()} style={{border:0,background:"#202936",color:"white",borderRadius:9,padding:"9px 14px",fontWeight:900,cursor:"pointer"}}>{actionLabel(call.route_kind)}</button>
      </div>
    </div>
  );
}
