"use client";

import { useState } from "react";
import ExpAssessment from "../guest/[token]/ExpAssessment";
import ExpParticipants from "../guest/[token]/ExpParticipants";
import ExpTrackedVideo from "../guest/[token]/ExpTrackedVideo";
import { EXP_QUESTION_BANK_DRAFT } from "@/lib/exp/question-bank-draft";

type Stage = "welcome" | "video" | "participants" | "assessment" | "done";

export default function ExpTestPage() {
  const [stage, setStage] = useState<Stage>("welcome");
  const [watched, setWatched] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [run, setRun] = useState(0);
  const reset = () => {
    setStage("welcome"); setWatched(false); setConfirmed(false); setDrivers([]); setRun(n => n + 1);
  };
  if (process.env.NEXT_PUBLIC_EXP_VIDEO_PREVIEW !== "true") return <p>Not available.</p>;
  return <main style={{maxWidth:800,margin:"24px auto",padding:20,fontFamily:"Arial,sans-serif",color:"#263442"}}>
    <div style={{padding:"12px 16px",border:"1px solid #edc9b0",background:"#fff7f0",borderRadius:10,marginBottom:22}}>
      <strong>EXP TEST ONLY</strong> — No guest reservation, waiver, or completion record is used or saved. This test page will be removed before launch.
    </div>
    {stage === "welcome" ? <>
      <p style={{fontWeight:800,fontSize:12,color:"#b54a1c"}}>OUR FASTEST CHECK-OUT · OPTIONAL</p>
      <h1>Epic Xpress Ready</h1>
      <p>Get a head start on your adventure. Complete a short safety orientation and quick knowledge check before you arrive for our fastest check-out — and more time on the trail.</p>
      <button onClick={() => setStage("video")} style={primary}>Test Entire Experience</button>
      <button onClick={() => setStage("participants")} style={secondary}>Test Knowledge Check Only</button>
    </> : stage === "video" ? <>
      <h2>Getting Ready for the Trails</h2>
      <p>Watch a short video to get comfortable with your RZR, then take a quick knowledge check.</p>
      <ExpTrackedVideo key={run} onCoverageChange={setWatched}/>
      <label style={{display:"flex",gap:10,margin:"20px 0"}}>
        <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
        I/we have watched the entire safety orientation video.
      </label>
      <button style={primary} disabled={!watched || !confirmed} onClick={()=>setStage("participants")}>Continue to Knowledge Check</button>
      <p style={{fontSize:12}}>At least 90% actual playback and acknowledgment are required in the full flow.</p>
    </> : stage === "participants" ? <ExpParticipants
      onBack={()=>setStage("welcome")}
      onContinue={entries=>{setDrivers(entries.map(e=>e.fullName));setStage("assessment");}}
    /> : stage === "assessment" ? <>
      <p style={{fontSize:12,color:"#667583"}}>Practice participants: {drivers.join(", ")}</p>
      <ExpAssessment key={run} questions={EXP_QUESTION_BANK_DRAFT} onExit={()=>setStage("done")}/>
    </> : <>
      <h2>Thanks for testing Epic Xpress Ready!</h2>
      <p>Nothing was submitted to a guest reservation or recorded as a completion.</p>
      <button style={primary} onClick={reset}>Start Another Test</button>
    </>}
  </main>;
}
const primary: React.CSSProperties = {background:"#db602a",color:"white",border:0,borderRadius:9,padding:"12px 18px",fontWeight:800,cursor:"pointer",marginRight:12,marginBottom:10};
const secondary: React.CSSProperties = {background:"#ecf0f2",color:"#34404b",border:0,borderRadius:9,padding:"12px 18px",fontWeight:800,cursor:"pointer",marginBottom:10};
