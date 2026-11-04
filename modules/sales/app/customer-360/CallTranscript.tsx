"use client";

import { useState } from "react";

type TranscriptTurn={speaker:"Agent"|"Customer"|"Unknown";text:string};

function normalizeTranscriptText(value:string){
  return value
    .replace(/\s+/g," ")
    .replace(/([.!?])(?=[A-Z0-9])/g,"$1 ")
    .replace(/,\s*(?=[A-Z])/g,", ")
    .replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/gi,"$1:$2 $3")
    .replace(/\bEpic 4 by 4 Adventure\b/gi,"Epic 4X4 Adventures")
    .trim();
}

function chunkReadable(text:string,maxSentences=3){
  const normalized=normalizeTranscriptText(text);
  const sentences=normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map(sentence=>sentence.trim())
    .filter(Boolean);

  if(sentences.length<=maxSentences)return [normalized];

  const chunks:string[]=[];
  for(let i=0;i<sentences.length;i+=maxSentences){
    chunks.push(sentences.slice(i,i+maxSentences).join(" "));
  }
  return chunks;
}

function parseTranscript(transcript:string):TranscriptTurn[]{
  const normalized=normalizeTranscriptText(transcript);
  const explicit=/\b(Agent|Customer|Caller|Speaker\s*1|Speaker\s*2):\s*/gi;
  const parts=normalized.split(explicit).filter(Boolean);

  const turns:TranscriptTurn[]=[];
  let speaker:TranscriptTurn["speaker"]="Unknown";
  let sawExplicit=false;

  for(const part of parts){
    const tag=part.trim().toLowerCase();
    if(tag==="agent"||tag==="speaker 1"){
      speaker="Agent";
      sawExplicit=true;
      continue;
    }
    if(tag==="customer"||tag==="caller"||tag==="speaker 2"){
      speaker="Customer";
      sawExplicit=true;
      continue;
    }

    const text=part.trim();
    if(text)turns.push({speaker,text});
  }

  if(sawExplicit&&turns.length)return turns;

  return chunkReadable(normalized).map(text=>({speaker:"Unknown" as const,text}));
}

export default function CallTranscript({transcript}:{transcript:string}){
  const turns=parseTranscript(transcript);
  const[open,setOpen]=useState(false);

  return <div style={{marginTop:9}}>
    <button
      type="button"
      onClick={()=>setOpen(value=>!value)}
      aria-expanded={open}
      style={{cursor:"pointer",fontWeight:800,color:"#184f9d",display:"inline-block",border:"1px solid #cad6e4",background:"#fff",borderRadius:8,padding:"7px 10px",fontSize:12}}
    >
      {open?"Hide Transcript":"View Transcript"}
    </button>

    {open?<div style={{marginTop:9,padding:"14px 16px",border:"1px solid #d7e1ec",borderRadius:10,background:"#f7faff",fontSize:13,color:"#253141"}}>
      <div style={{fontWeight:900,fontSize:11,textTransform:"uppercase",letterSpacing:".08em",color:"#667085",marginBottom:10}}>
        Transcript
      </div>

      <div style={{display:"grid",gap:10}}>
        {turns.map((turn,index)=>
          turn.speaker==="Unknown" ? (
            <div
              key={index}
              style={{
                lineHeight:1.65,
                maxWidth:"92ch",
                paddingBottom:index<turns.length-1?10:0,
                borderBottom:index<turns.length-1?"1px solid #e7edf4":"none"
              }}
            >
              {turn.text}
            </div>
          ) : (
            <div key={index} style={{display:"grid",gridTemplateColumns:"68px minmax(0,1fr)",gap:10,alignItems:"start",paddingBottom:index<turns.length-1?10:0,borderBottom:index<turns.length-1?"1px solid #e7edf4":"none"}}>
              <div style={{fontWeight:900,fontSize:11,textTransform:"uppercase",letterSpacing:".05em",paddingTop:2,color:turn.speaker==="Agent"?"#e4511d":"#1557b0"}}>
                {turn.speaker}
              </div>
              <div style={{lineHeight:1.65,whiteSpace:"pre-wrap",maxWidth:"92ch"}}>{turn.text}</div>
            </div>
          )
        )}
      </div>
    </div>:null}
  </div>;
}
