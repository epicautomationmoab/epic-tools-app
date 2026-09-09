"use client";

import { useEffect } from "react";
import type { ReadinessRow } from "@/lib/supabase";

type CallRailCall={id:string;recording_url:string|null;transcription:string|null};

function styleButton(button:HTMLButtonElement){
  Object.assign(button.style,{marginTop:"8px",marginRight:"8px",border:"1px solid #cad6e4",background:"#fff",color:"#184f9d",borderRadius:"8px",padding:"7px 10px",fontSize:"12px",fontWeight:"800",cursor:"pointer"});
}
function stylePanel(panel:HTMLDivElement){
  Object.assign(panel.style,{marginTop:"9px",padding:"12px 14px",border:"1px solid #d7e1ec",borderRadius:"10px",background:"#f7faff",whiteSpace:"pre-wrap",lineHeight:"1.55",fontSize:"13px",color:"#253141"});
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
    button.textContent="View Transcript";
    styleButton(button);
    const panel=document.createElement("div");
    panel.textContent=transcript;
    panel.hidden=true;
    stylePanel(panel);
    button.addEventListener("click",()=>{panel.hidden=!panel.hidden;button.textContent=panel.hidden?"View Transcript":"Hide Transcript";});
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
