import { expBoardDirection, expTeamStatus } from "@/lib/exp/team-status";

export default function ExpOperationsPreview() {
  if (process.env.NEXT_PUBLIC_EXP_VIDEO_PREVIEW !== "true") return <p>Not available.</p>;
  const scenarios = [
    { name: "Flores group — sample", ready:2,total:2, current:"kiosk" },
    { name: "Five friends — sample", ready:4,total:5,current:"kiosk" },
    { name: "New rental — sample", ready:0,total:2,current:"kiosk" },
  ] as const;
  return <main style={{maxWidth:900,margin:"40px auto",padding:24,fontFamily:"Arial,sans-serif",color:"#253342"}}>
    <p style={{fontWeight:800,color:"#ba4c1b"}}>EXP TEAM WORKFLOW — SAMPLE DATA ONLY</p>
    <h1>Readiness & Arrival Board review</h1>
    <p>This is a visual scenario test, not actual reservation status. EXP results are not recorded yet, and real Arrival Board routing is unchanged.</p>
    <h2>Readiness — compact EXP indicator beside guest name</h2>
    <div style={{border:"1px solid #e0e5e9",borderRadius:12,overflow:"hidden"}}>
      {scenarios.map(item=>{const s=expTeamStatus(item.ready,item.total);return <div key={item.name} style={{display:"flex",justifyContent:"space-between",gap:12,padding:18,borderBottom:"1px solid #e0e5e9"}}>
        <strong>{item.name} {s.allReady ? <span style={{marginLeft:8,fontSize:12,background:"#def2e4",color:"#087238",padding:"3px 7px",borderRadius:5}}>EXP</span> : null}</strong><span style={{color:"#667380",fontSize:13}}>{s.allReady ? "" : s.ready ? `${s.ready}/${s.total} complete (details only)` : "No EXP indicator"}</span>
      </div>})}
    </div>
    <h2 style={{marginTop:32}}>Arrival Board — direction</h2>
    {scenarios.map(item=>{const s=expTeamStatus(item.ready,item.total);const direction=expBoardDirection(true,"rental",s);return <section key={item.name} style={{padding:20,border:"1px solid #e0e5e9",borderRadius:12,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:20}}>
      <strong>{item.name}</strong><div style={{textAlign:"right"}}>{s.allReady?<div style={{color:"#087238",background:"#def2e4",padding:"5px 12px",borderRadius:20,fontWeight:800}}>XPRESS CHECKOUT</div>:null}<div style={{fontWeight:700}}>{direction==="agent"?"See Epic Team Member":"Proceed to Kiosk"}</div></div>
    </section>})}
    <p style={{fontSize:13,color:"#667380"}}>Only all-drivers EXP Ready changes an existing kiosk direction to See Epic Team Member. Partial and not-started groups follow normal routing.</p>
  </main>;
}
