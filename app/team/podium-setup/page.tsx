"use client";

import { useState } from "react";

export default function PodiumSetupPage() {
  const [busy,setBusy]=useState(false);
  const [result,setResult]=useState("");
  async function run(method:"GET"|"POST") {
    setBusy(true);setResult("");
    try {
      const response=await fetch("/api/team/podium-webhook-setup",{method,credentials:"same-origin",cache:"no-store"});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error || `Request failed (${response.status})`);
      setResult(method==="GET"?"Webhook lookup completed. Check results below.":payload.already_exists?"2700 message webhook already registered.":"Podium message webhook created. You may now send a test SMS to 2700.");
      if(method==="GET")setResult(JSON.stringify(payload,null,2));
    } catch(error) {
      setResult(error instanceof Error?error.message:"Unexpected error.");
    } finally {setBusy(false);}
  }
  return <main style={{maxWidth:760,margin:"40px auto",padding:24,fontFamily:"system-ui",lineHeight:1.5}}>
    <h1>Podium 2700 — Preview setup</h1>
    <p>This is an isolated setup for C360 testing. It does not change cancellation acknowledgements or the CallRail number.</p>
    <p>Sign in with an admin or manager Epic Tools account. First verify existing webhooks, then register the preview endpoint if it is not already present.</p>
    <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
      <button disabled={busy} onClick={()=>void run("GET")} style={{padding:"12px 18px"}}>Check Podium webhooks</button>
      <button disabled={busy} onClick={()=>void run("POST")} style={{padding:"12px 18px",fontWeight:700}}>Connect Podium 2700 to Preview</button>
    </div>
    <pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",marginTop:24,padding:18,border:"1px solid #ddd",borderRadius:8}} aria-live="polite">{busy?"Contacting Podium...":result}</pre>
  </main>;
}
