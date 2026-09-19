"use client";

type TranscriptTurn={speaker:"Agent"|"Caller"|"Unknown";text:string};

function parseTranscript(transcript:string):TranscriptTurn[]{
  const parts=transcript.split(/\b(Agent|Caller):\s*/g).filter(Boolean);
  const turns:TranscriptTurn[]=[];
  let speaker:TranscriptTurn["speaker"]="Unknown";
  for(const part of parts){
    if(part==="Agent"||part==="Caller"){speaker=part;continue;}
    const text=part.trim();
    if(text)turns.push({speaker,text});
  }
  return turns.length?turns:[{speaker:"Unknown",text:transcript.trim()}];
}

export default function CallTranscript({transcript}:{transcript:string}){
  const turns=parseTranscript(transcript);
  return <details style={{marginTop:9}}>
    <summary style={{cursor:"pointer",fontWeight:800,color:"#184f9d",listStyle:"none",display:"inline-block",border:"1px solid #cad6e4",background:"#fff",borderRadius:8,padding:"7px 10px",fontSize:12}}>
      View Transcript
    </summary>
    <div style={{marginTop:9,padding:14,border:"1px solid #d7e1ec",borderRadius:10,background:"#f7faff",display:"grid",gap:10,fontSize:13,color:"#253141"}}>
      {turns.map((turn,index)=><div key={index} style={{display:"grid",gridTemplateColumns:"72px minmax(0,1fr)",gap:10,alignItems:"start"}}>
        <div style={{fontWeight:900,fontSize:11,textTransform:"uppercase",letterSpacing:".05em",paddingTop:2,color:turn.speaker==="Agent"?"#e4511d":turn.speaker==="Caller"?"#1557b0":"#667085"}}>
          {turn.speaker==="Unknown"?"Transcript":turn.speaker}
        </div>
        <div style={{lineHeight:1.55,whiteSpace:"pre-wrap"}}>{turn.text}</div>
      </div>)}
    </div>
  </details>;
}
