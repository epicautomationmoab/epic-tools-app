"use client";

import { useEffect } from "react";

type Email = { id:string; at:string|null; direction:string|null; subject:string|null; label?:string|null; status?:string|null; open_count?:number|null; first_opened_at?:string|null; last_opened_at?:string|null };
type Customer360Payload = { customer?: { emails?:Email[] } };

function fmtDateTime(v:string|null){
  if(!v)return"Unknown time";
  const d=new Date(v);
  return Number.isNaN(d.getTime())?v:d.toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
}

function engagementStyle(el:HTMLDivElement){
  Object.assign(el.style,{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center",marginTop:"8px",fontSize:"11px",fontWeight:"800",color:"#315f9f"});
}

async function enhance(modal:HTMLElement){
  if(modal.dataset.c360Enhancing==="true")return;
  modal.dataset.c360Enhancing="true";
  try{
    const mailto=modal.querySelector<HTMLAnchorElement>('a[href^="mailto:"]');
    const email=mailto?.getAttribute("href")?.replace(/^mailto:/i,"").trim();
    if(!email)return;
    const response=await fetch(`/api/sales/customer-360?email=${encodeURIComponent(email)}`,{cache:"no-store"});
    const payload=await response.json() as Customer360Payload;
    if(!response.ok||!payload.customer)return;

    for(const item of payload.customer.emails||[]){
      if(item.direction!=="outbound"||(!item.status&&!item.open_count&&!item.label))continue;
      const title=`Email sent${item.subject?`: ${item.subject}`:""}`;
      const candidates=Array.from(modal.querySelectorAll<HTMLElement>("article"));
      const article=candidates.find(card=>card.querySelector("strong")?.textContent?.trim()===title&&card.textContent?.includes(fmtDateTime(item.at)));
      if(!article||article.dataset.engagementReady==="true")continue;
      article.dataset.engagementReady="true";
      const row=document.createElement("div");
      engagementStyle(row);
      const bits:string[]=[];
      if(item.label&&item.label!=="Gmail")bits.push(item.label);
      if(item.status)bits.push(item.status.charAt(0).toUpperCase()+item.status.slice(1));
      const opens=item.open_count||0;
      if(opens)bits.push(`Opened ${opens}X`);
      if(opens&&item.last_opened_at)bits.push(`Last opened ${fmtDateTime(item.last_opened_at)}`);
      row.textContent=bits.join(" · ");
      article.appendChild(row);
    }
  }catch{
    // Enhancement is additive; base C360 remains usable if this fails.
  }finally{
    modal.dataset.c360Enhancing="false";
  }
}

export default function Customer360Enhancer(){
  useEffect(()=>{
    let timer:number|undefined;
    const sync=()=>{
      if(timer)window.clearTimeout(timer);
      timer=window.setTimeout(()=>{
        const modal=document.querySelector<HTMLElement>('[role="dialog"][aria-label="Customer 360"]');
        if(modal)void enhance(modal);
      },80);
    };
    const observer=new MutationObserver(sync);
    observer.observe(document.body,{childList:true,subtree:true});
    sync();
    return()=>{observer.disconnect();if(timer)window.clearTimeout(timer);};
  },[]);
  return null;
}
