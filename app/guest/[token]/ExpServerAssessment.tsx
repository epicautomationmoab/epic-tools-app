"use client";
import {useEffect,useState} from "react";

type Answer={questionId:string;optionId:string};
type Result={status:string;correct?:number;reason?:string;questionIds?:string[];corrections?:Array<{questionId:string;correctAnswer:string;explanation:string}>};
type PublicQuestion={id:string;prompt:string;options:Array<{id:string;text:string}>};
export default function ExpServerAssessment({token,readinessId,sessionId,questions,onExit}:{token:string;readinessId:string;sessionId:string;questions:PublicQuestion[];onExit:()=>void}){
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [criticalAnswers,setCriticalAnswers]=useState<Record<string,string>>({});
 const [criticalIds,setCriticalIds]=useState<string[]>([]);
 const [index,setIndex]=useState(0);
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<Result|null>(null);
 const [mode,setMode]=useState<"initial"|"critical">("initial");
 const activeQuestions=mode==="critical"?questions.filter(q=>criticalIds.includes(q.id)):questions;
 const currentAnswers=mode==="critical"?criticalAnswers:answers;
 useEffect(()=>{let active=true;fetch(`/api/guest/${encodeURIComponent(token)}/exp/progress?readinessId=${encodeURIComponent(readinessId)}&sessionId=${encodeURIComponent(sessionId)}`,{cache:"no-store"})
   .then(r=>r.ok?r.json():null).then(d=>{if(active&&d?.draftAnswers)setAnswers(d.draftAnswers);}).catch(()=>{});
   return()=>{active=false}},[token,readinessId,sessionId]);
 const save=async(next:Record<string,string>)=>{
   const response=await fetch(`/api/guest/${encodeURIComponent(token)}/exp/progress`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({readinessId,sessionId,draftAnswers:next})});
   if(!response.ok)throw new Error("Unable to save your answers. Please try again.");
 };
 const choose=async(qid:string,oid:string)=>{if(mode==="critical"){setCriticalAnswers(a=>({...a,[qid]:oid}));return}
   const next={...answers,[qid]:oid};setAnswers(next);setStatus("Saving…");try{await save(next);setStatus("Progress saved")}catch(e){setStatus(e instanceof Error?e.message:"Save failed")}};
 const submit=async()=>{
   if(activeQuestions.some(q=>!currentAnswers[q.id]))return;
   setBusy(true);setStatus("Checking answers…");
   try {
    const a:Answer[]=activeQuestions.map(q=>({questionId:q.id,optionId:currentAnswers[q.id]}));
    const response=await fetch(`/api/guest/${encodeURIComponent(token)}/exp/assessment`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:mode==="critical"?"critical_retry":"submit",readinessId,sessionId,answers:a})});
    const data=await response.json() as Result & {error?:string};
    if(!response.ok)throw new Error(data.error||"Unable to submit assessment.");
    if(data.status==="critical_retry" && data.questionIds?.length){setCriticalIds(data.questionIds);setIndex(0);setMode("critical");setStatus("Important safety questions need another attempt.");return;}
    setResult(data);setStatus("");
   }catch(e){setStatus(e instanceof Error?e.message:"Assessment failed")}finally{setBusy(false)}
 };
 const q=activeQuestions[index];
 return <section aria-label="EXP saved knowledge check">
  <h3>One Last Step to More Trail Time</h3>
  {result?<><p>{result.status==="practice_complete"?"Knowledge check saved. Final EXP readiness remains pending paperwork and driver verification.":"Your answers have been recorded. The safety orientation video must be watched again before another assessment, or you can finish with an Adventure Technician."}</p>
   {result.corrections?.map(c=><p key={c.questionId}>{c.correctAnswer} — {c.explanation}</p>)}
   <button type="button" onClick={onExit}>Return to Guest Portal</button></>:
   <><p>{mode==="critical"?"Critical safety question retry":`Question ${index+1} of ${questions.length}`}. {mode==="initial"?"You can close this page and resume your saved answers later.":"Each missed critical question must be answered correctly."}</p>
   {q?<fieldset><legend>{q.prompt}</legend>{q.options.map(o=><label key={o.id} style={{display:"block",margin:"12px 0"}}><input type="radio" name={q.id} checked={currentAnswers[q.id]===o.id} onChange={()=>void choose(q.id,o.id)}/> {o.text}</label>)}</fieldset>:<p>Questions unavailable.</p>}
   <p role="status">{status}</p>
   <div style={{display:"flex",gap:12}}><button type="button" disabled={index===0||busy} onClick={()=>setIndex(i=>i-1)}>Back</button>
   {index<activeQuestions.length-1?<button type="button" disabled={!q||!currentAnswers[q.id]||busy} onClick={()=>setIndex(i=>i+1)}>Next</button>:<button type="button" disabled={activeQuestions.some(x=>!currentAnswers[x.id])||busy} onClick={()=>void submit()}>Submit Knowledge Check</button>}</div>
   <button type="button" onClick={onExit}>Finish with an Adventure Technician instead</button></>}
 </section>;
}