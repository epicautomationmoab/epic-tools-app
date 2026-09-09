"use client";

import { useEffect } from "react";
import type { ReadinessRow } from "@/lib/supabase";

type CallRailCall={id:string;recording_url:string|null;transcription:string|null};

type TranscriptTurn={speaker:"Agent"|"Caller"|"Unknown";text:string};

function styleButton(button:HTMLButtonElement){
  Object.assign(button.style,{marginTop:"8px",marginRight:"8px",border:"1px solid #cad6e4",background:"#fff",color:"#184f9d",borderRadius:"8px",padding:"7px 10px",fontSize:"12px",fontWeight:"800",cursor:"pointer"});
}
function stylePanel(panel:HTMLDivElement){
  Object.assign(panel.style,{marginTop:"9px",padding:"14px",border:"1px solid #d7e1ec",borderRadius:"10px",background:"#f7faff",fontSize:"13px",color:"#253141",gap:"10px"});
}
function parseTranscript(transcript:string):TranscriptTurn[]{
  const parts=transcript.split(/\b(Agent|Caller):\s*/g).filter(Boolean);
  const turns:TranscriptTurn[]=[];
  let speaker:TranscriptTurn["speaker"]="Unknown";
  for(const part of parts){
    if(part==="Agent"||part==="Caller"){speaker=part;continue;}
    const text=part.trim();
    if(!text)continue;
    turns.push({speaker,text});
  }
  return turns.length?turns:[{speaker:"Unknown",text:transcript.trim()}];
}
function renderTranscript(panel:HTMLDivElement,transcript:string){
  panel.replaceChildren();
  for(const turn of parseTranscript(transcript)){
    const row=document.createElement("div");
    Object.assign(row.style,{display:"grid",gridTemplateColumns:"72px minmax(0,1fr)",gap:"10px",alignItems:"start"});
    const label=document.createElement("div");
    label.textContent=turn.speaker==="Unknown"?"Transcript":turn.speaker;
    Object.assign(label.style,{fontWeight:"900",fontSize:"11px",textTransform:"uppercase",letterSpacing:".05em",paddingTop:"2px",color:turn.speaker==="Agent"?"#e4511d":turn.speaker==="Caller"?"#1557b0":"#667085"});
    const text=document.createElement("div");
    text.textContent=turn.text;
    Object.assign(text.style,{lineHeight:"1.55",whiteSpace:"pre-wrap"});
    row.append(label,text);
    panel.appendChild(row);
  }
}

async function enhance(row:ReadinessRow){
  const pane=document.querySelector<HTMLElement>('[aria-label="Customer communications"]');
  if(!pane)return;
  const response=await fetch(`/api/team/readiness/callrail?confirmation=${encodeURIComponent(row.confirmation_code)}`,{cache:"no-store"});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)return;
  const calls=(payload.calls||[]) as CallRailCall[];

  for(const call of calls){
    const transcript=(call.transcription||"").trim();
    if(!transcript)continue;
    let article:HTMLElement|null=null;
    if(call.recording_url){
      const links=Array.from(pane.querySelectorAll<HTMLAnchorElement>('a[href]'));
      const link=links.find(a=>a.href===call.recording_url||a.getAttribute("href")===call.recording_url);
      article=link?.closest("article") as HTMLElement|null;
    }
    if(!article||article.dataset.transcriptReady==="true")continue;
    article.dataset.transcriptReady="true";
    const button=document.createElement("button");
    button.type="button";
    button.textContent="Show Transcript";
    button.setAttribute("aria-expanded","false");
    styleButton(button);
    const panel=document.createElement("div");
    stylePanel(panel);
    renderTranscript(panel,transcript);
    panel.style.display="none";
    button.addEventListener("click",()=>{
      const opening=panel.style.display==="none";
      panel.style.display=opening?"grid":"none";
      button.textContent=opening?"Hide Transcript":"Show Transcript";
      button.setAttribute("aria-expanded",opening?"true":"false");
    });
    article.append(button,panel);
  }
}

export default function JourneyTranscriptEnhancer({row}:{row:ReadinessRow}){
  useEffect(()=>{
    let timer:number|undefined;
    const sync=()=>{
      if(timer)window.clearTimeout(timer);
      timer=window.setTimeout(()=>void enhance(row),100);
    };
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true});
    sync();
    return()=>{observer.disconnect();if(timer)window.clearTimeout(timer);};
  },[row.confirmation_code]);
  return null;
}
