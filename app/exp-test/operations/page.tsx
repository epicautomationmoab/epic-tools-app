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
    <h2>Readiness — EXP column</h2>
    <div style={{border:"1px solid #e0e5e9",borderRadius:12,overflow:"hidden"}}>
      {scenarios.map(item=>{const s=expTeamStatus(item.ready,item.total);return <div key={item.name} style={{display:"flex",justifyContent:"space-between",gap:12,padding:18,borderBottom:"1px solid #e0e5e9"}}>
        <strong>{item.name}</strong><strong style={{color:s.allReady?"#167040":s.ready>0?"#90651f":"#667380"}}>{s.allReady?"✓ EXP Ready":s.ready? s.ready+"/"+s.total+" complete":"Not Started"}</strong>
      </div>})}
    </div>
    <h2 style={{marginTop:32}}>Arrival Board — direction</h2>
    {scenarios.map(item=>{const s=expTeamStatus(item.ready,item.total);const direction=expBoardDirection(true,"rental",s);return <section key={item.name} style={{padding:20,border:"1px solid #e0e5e9",borderRadius:12,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between",gap:20}}>
      <strong>{item.name}</strong><div style={{textAlign:"right"}}>{s.allReady?<div style={{color:"#167040",fontWeight:800}}>✓ EXP Ready</div>:null}<div style={{fontWeight:700}}>{direction==="agent"?"See Epic Team Member":"Proceed to Kiosk"}</div></div>
    </section>})}
    <p style={{fontSize:13,color:"#667380"}}>Only all-drivers EXP Ready changes an existing kiosk direction to See Epic Team Member. Partial and not-started groups follow normal routing.</p>
  </main>;
}
