"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type LiveCall = {
  id: string;
  caller_phone: string;
  caller_name: string | null;
  source_name: string | null;
  campaign: string | null;
  received_at: string;
  route_kind: string;
  route_label: string | null;
  capture_status: string;
  opportunity_id: string | null;
};

export default function LiveLeadCapture() {
  const search = useSearchParams();
  const router = useRouter();
  const liveCallId = search.get("live_call") || "";
  const [call, setCall] = useState<LiveCall | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  const [interest, setInterest] = useState("");
  const [partyNeeds, setPartyNeeds] = useState("");
  const [leadValue, setLeadValue] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!liveCallId) { setError("Live call was not supplied."); setLoading(false); return; }
    let stopped = false;
    (async () => {
      try {
        const response = await fetch(`/api/team/live-lead?live_call_id=${encodeURIComponent(liveCallId)}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load call.");
        if (stopped) return;
        setCall(payload.call);
        setName(payload.call?.caller_name || "");
        if (payload.call?.opportunity_id) router.replace(`/team/leads?opportunity=${encodeURIComponent(payload.call.opportunity_id)}`);
      } catch (err) { if (!stopped) setError(err instanceof Error ? err.message : "Unable to load call."); }
      finally { if (!stopped) setLoading(false); }
    })();
    return () => { stopped = true; };
  }, [liveCallId, router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!call || saving) return;
    if (!name.trim()) { setError("Customer name is required to save this lead."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/team/live-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          live_call_id: call.id,
          customer_name: name,
          email,
          activity_date: date,
          interest_label: interest,
          party_needs: partyNeeds,
          lead_value: leadValue,
          note,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to save lead.");
      router.push(`/team/leads?opportunity=${encodeURIComponent(payload.opportunity_id)}`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save lead."); }
    finally { setSaving(false); }
  }

  if (loading) return <div style={{padding:28,fontWeight:800,color:"#657384"}}>Loading incoming call…</div>;
  if (!call) return <div style={{padding:28,color:"#9b342b",fontWeight:800}}>{error || "Live call not found."}</div>;

  const inputStyle = { width:"100%", boxSizing:"border-box" as const, border:"1px solid #ccd5de", borderRadius:10, padding:"10px 12px", font:"inherit" };
  const labelStyle = { display:"grid", gap:5, fontSize:13, fontWeight:850, color:"#344150" };

  return <div style={{maxWidth:900,margin:"0 auto"}}>
    <div style={{background:"#eef5ff",border:"1px solid #d4e1ef",borderRadius:14,padding:16,marginBottom:18}}>
      <div style={{fontSize:12,fontWeight:900,textTransform:"uppercase",letterSpacing:".08em",color:"#68788a"}}>Live Call</div>
      <div style={{fontSize:23,fontWeight:950,marginTop:2}}>{call.caller_name || "New caller"}</div>
      <div style={{fontWeight:800,color:"#5f6e7d",marginTop:2}}>{call.caller_phone}</div>
      {(call.source_name || call.campaign) ? <div style={{fontSize:13,fontWeight:750,color:"#738090",marginTop:6}}>{[call.source_name,call.campaign].filter(Boolean).join(" · ")}</div> : null}
    </div>

    <form onSubmit={submit} style={{background:"white",border:"1px solid #d9e0e7",borderRadius:16,padding:20,boxShadow:"0 8px 24px rgba(15,23,42,.06)"}}>
      <div style={{marginBottom:17}}><h2 style={{margin:0,fontSize:22}}>Capture Sales Lead</h2><p style={{margin:"5px 0 0",color:"#697686"}}>Fill in what you learn during the call. Only the customer name is required.</p></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:14}}>
        <label style={labelStyle}>Customer name<input style={inputStyle} value={name} onChange={e=>setName(e.target.value)} autoFocus /></label>
        <label style={labelStyle}>Email<input style={inputStyle} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="If they provide it" /></label>
        <label style={labelStyle}>Desired date<input style={inputStyle} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
        <label style={labelStyle}>Estimated lead value<input style={inputStyle} inputMode="decimal" value={leadValue} onChange={e=>setLeadValue(e.target.value.replace(/[^0-9.]/g,""))} placeholder="Optional" /></label>
        <label style={{...labelStyle,gridColumn:"1 / -1"}}>Interested in<input style={inputStyle} value={interest} onChange={e=>setInterest(e.target.value)} placeholder="Hell's Revenge tour, Pro R rental, Xpedition, etc." /></label>
        <label style={{...labelStyle,gridColumn:"1 / -1"}}>Party / vehicle needs<input style={inputStyle} value={partyNeeds} onChange={e=>setPartyNeeds(e.target.value)} placeholder="5 people, needs 4-seat machine, two vehicles, etc." /></label>
        <label style={{...labelStyle,gridColumn:"1 / -1"}}>Sales notes<textarea style={{...inputStyle,minHeight:110,resize:"vertical" as const}} value={note} onChange={e=>setNote(e.target.value)} placeholder="What matters for the follow-up?" /></label>
      </div>
      {error ? <div style={{marginTop:13,padding:11,borderRadius:9,background:"#fff1ef",color:"#96372e",fontWeight:800}}>{error}</div> : null}
      <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:18}}>
        <button type="button" onClick={()=>router.push("/team/leads/inbox")} style={{border:"1px solid #cfd8e1",background:"white",borderRadius:9,padding:"10px 14px",fontWeight:850,cursor:"pointer"}}>Back to Inbox</button>
        <button type="submit" disabled={saving} style={{border:0,background:"#202936",color:"white",borderRadius:9,padding:"10px 16px",fontWeight:900,cursor:"pointer"}}>{saving?"Saving…":"Save as Open Lead"}</button>
      </div>
    </form>
  </div>;
}
