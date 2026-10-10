"use client";

import { useEffect, useState } from "react";

type LiveCall = {
  id: string;
  caller_phone: string | null;
  caller_name: string | null;
  route_label: string | null;
  route_kind: string | null;
  confirmation_code: string | null;
};

export default function IncomingCallPopup() {
  const [call, setCall] = useState<LiveCall | null>(null);
  // Keep an undecided call available across navigation and page refreshes.
  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem("epic-incoming-call-pending");
      if (saved) setCall(JSON.parse(saved) as LiveCall);
    } catch { /* storage may be unavailable */ }
  }, []);
  useEffect(() => {
    try {
      if (call) window.sessionStorage.setItem("epic-incoming-call-pending", JSON.stringify(call));
      else window.sessionStorage.removeItem("epic-incoming-call-pending");
    } catch { /* storage may be unavailable */ }
  }, [call]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let busy = false;
    async function poll() {
      if (stopped || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch("/api/team/live-calls", { cache: "no-store" });
        if (!response.ok) throw new Error("Live calls unavailable");
        const data = await response.json();
        if (!stopped) {
          setError(false);
          setCall(current => current ?? (data.call || null));
        }
      } catch {
        if (!stopped) setError(true);
      } finally { busy = false; }
    }
    void poll();
    const interval = window.setInterval(() => void poll(), 4000);
    const visibility = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  async function dismiss() {
    if (!call) return;
    const id = call.id;
    setCall(null);
    try { window.sessionStorage.removeItem("epic-incoming-call-pending"); } catch {}
    try {
      const res = await fetch("/api/team/live-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ live_call_id: id }),
      });
      if (!res.ok) throw new Error("Unable to dismiss");
    } catch {
      setError(true);
    }
  }

  if (!call) return null;
  const q = call.caller_phone || call.confirmation_code || call.route_label || "";
  const recognized = Boolean(call.route_kind && call.route_kind !== "new_lead");
  const href = "https://epicc360.com/customers?q=" + encodeURIComponent(q) + "&open=1";
  return (
    <section role="alertdialog" aria-label="Incoming call" style={{
      position:"fixed", bottom:24, right:24, zIndex:99999, width:"min(360px, calc(100vw - 32px))",
      padding:18, borderRadius:14, border:"1px solid #9aadb9", borderLeft:"5px solid #d52b1e",
      background:"#fff", color:"#151b23", boxShadow:"0 12px 48px #0004", fontFamily:"inherit"
    }}>
      <div style={{fontSize:11,fontWeight:900,letterSpacing:1.5,color:"#ba261c"}}>INCOMING CALL</div>
      <div style={{fontSize:19,fontWeight:800,marginTop:8}}>{recognized ? (call.route_label || call.caller_name || "Recognized caller") : (call.caller_name || "New caller")}</div>
      <div style={{fontSize:14,marginTop:4}}>{call.caller_phone || "Number unavailable"}</div>
      {recognized && <div style={{fontSize:12,marginTop:7,color:"#53606d"}}>{call.route_kind === "active_reservation" ? "Active reservation" : call.route_kind === "open_lead" ? "Open sales lead" : "Known Epic customer"}</div>}
      <div style={{display:"flex",gap:9,marginTop:16}}>
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={()=>void dismiss()} style={{
          flex:1, padding:"10px 12px", textAlign:"center", textDecoration:"none", borderRadius:8,
          background:"#c92e23", color:"#fff", fontWeight:800, fontSize:13
        }}>Open C360 →</a>
        <button type="button" onClick={()=>void dismiss()} style={{
          padding:"10px 12px",borderRadius:8,border:"1px solid #cbd0d7",background:"#fff",
          color:"#252b35",cursor:"pointer",fontWeight:700
        }}>Dismiss</button>
      </div>
      {error && <div style={{fontSize:11,marginTop:7,color:"#b42318"}}>Call feed temporarily unavailable.</div>}
    </section>
  );
}
