export default function PhoneReportLoading(){
  return <div role="status" aria-live="polite" style={{minHeight:"65vh",padding:"32px",background:"#f6f8fa",color:"#25384b",fontFamily:"system-ui,sans-serif"}}>
    <style>{`@keyframes epicPhoneSpin{to{transform:rotate(360deg)}} @keyframes epicPhonePulse{0%,100%{opacity:.35}50%{opacity:.8}}`}</style>
    <div style={{maxWidth:1100,margin:"30px auto",background:"#fff",border:"1px solid #e1e6ed",borderRadius:18,padding:"30px",boxShadow:"0 8px 30px rgba(20,37,57,.04)"}}>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:38,height:38,border:"4px solid #dce5ec",borderTopColor:"#be2028",borderRadius:"50%",animation:"epicPhoneSpin .85s linear infinite",flexShrink:0}}/>
        <div><h2 style={{margin:"0 0 7px",fontSize:23}}>Building your Phone Report</h2><p style={{margin:0,fontSize:14,color:"#687889"}}>Gathering call activity, sales results and employee performance. Longer date ranges may take a little more time.</p></div>
      </div>
      <div style={{height:5,background:"#eef1f5",overflow:"hidden",borderRadius:99,marginTop:25}}>
        <div style={{width:"45%",height:"100%",background:"#be2028",borderRadius:99,animation:"epicPhonePulse 1.3s ease-in-out infinite"}}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:12,marginTop:25}}>
        {["Calls","Sales Opportunities","Booked","Conversion"].map(t=><div key={t} style={{background:"#f7f9fb",borderRadius:11,padding:18}}><div style={{fontSize:12,color:"#748293"}}>{t}</div><div style={{height:25,width:"55%",borderRadius:6,background:"#e2e8ef",marginTop:12,animation:"epicPhonePulse 1.3s ease-in-out infinite"}}/></div>)}
      </div>
      <p style={{fontSize:12,color:"#718092",marginTop:20,marginBottom:0}}>Your report will appear automatically when ready.</p>
    </div>
  </div>;
}
