"use client";

import { useEffect } from "react";

type Alert = {
  id:string; context_kind:"sales_opportunity"|"reservation"; opportunity_id:string|null; reservation_id:string|null;
  alert_kind:string; customer_name:string|null; phone:string|null; confirmation_code:string|null;
};

function compact(value:string|null|undefined){return (value||"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function phoneDigits(value:string|null|undefined){const d=(value||"").replace(/\D/g,"");return d.slice(-10)}

export default function CallAttentionRowEnhancer({context}:{context:"leads"|"readiness"}){
  useEffect(()=>{
    let stopped=false;
    const clickHandler=(event:Event)=>{
      const row=(event.currentTarget as HTMLElement);
      const id=row.dataset.callAttentionTarget;
      if(!id)return;
      const body=context==="leads"?{opportunity_id:id}:{reservation_id:id};
      void fetch("/api/team/call-attention",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(()=>{
        row.style.removeProperty("background"); row.style.removeProperty("box-shadow"); row.style.removeProperty("outline");
        row.querySelectorAll("[data-call-attention-badge]").forEach(n=>n.remove());
        delete row.dataset.callAttentionTarget;
      }).catch(()=>{});
    };

    async function refresh(){
      if(stopped||document.visibilityState!=="visible")return;
      try{
        const response=await fetch(`/api/team/call-attention?context=${context}`,{cache:"no-store"});
        const payload=await response.json(); if(!response.ok)return;
        const alerts=(payload.alerts||[]) as Alert[];
        const rows=Array.from(document.querySelectorAll("main table tbody tr")) as HTMLElement[];
        for(const row of rows){
          row.style.removeProperty("background"); row.style.removeProperty("box-shadow"); row.style.removeProperty("outline");
          row.querySelectorAll("[data-call-attention-badge]").forEach(n=>n.remove());
          delete row.dataset.callAttentionTarget;
          if(row.dataset.callAttentionBound!=="1"){row.addEventListener("click",clickHandler);row.dataset.callAttentionBound="1"}
          const rowText=compact(row.textContent||"");
          const rowDigits=phoneDigits(row.textContent||"");
          const match=alerts.find(a=>{
            const name=compact(a.customer_name); const confirm=compact(a.confirmation_code); const phone=phoneDigits(a.phone);
            if(context==="readiness"&&confirm&&rowText.includes(confirm))return true;
            if(phone&&rowDigits&&rowDigits.includes(phone))return true;
            return name.length>=4&&rowText.includes(name);
          });
          if(!match)continue;
          const target=context==="leads"?match.opportunity_id:match.reservation_id; if(!target)continue;
          row.dataset.callAttentionTarget=target;
          row.style.setProperty("background","#ffe3df","important");
          row.style.setProperty("box-shadow","inset 5px 0 0 #b42318","important");
          const first=row.querySelector("td");
          if(first){const badge=document.createElement("div");badge.dataset.callAttentionBadge="1";badge.textContent=match.alert_kind==="abandoned_call"?"ABANDONED CALL":"MISSED CALL";Object.assign(badge.style,{display:"inline-block",marginTop:"5px",padding:"3px 7px",borderRadius:"999px",background:"#b42318",color:"white",fontSize:"10px",fontWeight:"900",letterSpacing:".06em"});first.appendChild(badge)}
        }
      }catch{}
    }
    void refresh(); const timer=window.setInterval(()=>void refresh(),3000);
    return()=>{stopped=true;window.clearInterval(timer);document.querySelectorAll("main table tbody tr").forEach(node=>{const row=node as HTMLElement;if(row.dataset.callAttentionBound==="1")row.removeEventListener("click",clickHandler)})};
  },[context]);
  return null;
}
