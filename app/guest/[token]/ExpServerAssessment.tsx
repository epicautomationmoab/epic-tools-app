"use client";
import {useEffect,useMemo,useState} from "react";
import {EXP_QUESTION_BANK_DRAFT} from "@/lib/exp/question-bank-draft";
type Answer={questionId:string;optionId:string};
export default function ExpServerAssessment({token,readinessId,sessionId,onExit}:{token:string;readinessId:string;sessionId:string;onExit:()=>void}){
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [index,setIndex]=useState(0);
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(false);
 const [result,setResult]=useState<{status:string;correct?:number;reason?:string;corrections?:Array<{questionId:string;correctAnswer:string;explanation:string}>}|null>(null);
 const questions=useMemo(()=>EXP_QUESTION_BANK_DRAFT.map(q=>({id:q.id,prompt:q.prompt,options:q.options})),[]);
 useEffect(()=>{let active=true;fetch(`/api/guest/${encodeURIComponent(token)}/exp/progress?readinessId=${encodeURIComponent(readinessId)}&sessionId=${encodeURIComponent(sessionId)}`,{cache:"no-store"}).then(r=>r.ok?r.json():null).then(d=>{if(active&&d?.draftAnswers)setAnswers(d.draftAnswers);}).catch(()=>{});return()=>{active=false}},[token,readinessId,sessionId]);
 const save=async(next:Record<string,string>)=>{
   const response=await fetch(`/api/guest/${encodeURIComponent(token)}/exp/progress`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({readinessId,sessionId,draftAnswers:next})});
   if(!response.ok)throw new Error("Unable to save your answers. Please try again.");
 };
 const choose=async(qid:string,oid:string)=>{const next={...answers,[qid]:oid};setAnswers(next);setStatus("Saving…");try{await save(next);setStatus("Progress saved")}catch(e){setStatus(e instanceof Error?e.message:"Save failed")}};
 const submit=async()=>{if(questions.some(q=>!answers[q.id]))return;setBusy(true);setStatus("Checking answers…");try{
 const a:Answer[]=questions.map(q=>({questionId:q.id,optionId:answers[q.id]}));
 const response=await fetch(`/api/guest/${encodeURIComponent(token)}/exp/assessment`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"submit",readinessId,sessionId,answers:a})});
 const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to submit assessment.");
 setResult(data);setStatus("");
 }catch(e){setStatus(e instanceof Error?e.message:"Assessment failed")}finally{setBusy(false)}};
 const q=questions[index];
 return <section aria-label="EXP saved knowledge check">
  <h3>One Last Step to More Trail Time</h3>
  {result?<><p>{result.status==="practice_complete"?"Knowledge check saved. Final EXP readiness remains pending paperwork and driver verification.":"Your answers have been saved. Additional safety review or a new viewing is required."}</p>
   {result.corrections?.map(c=><p key={c.questionId}>{c.correctAnswer} — {c.explanation}</p>)}
   <button type="button" onClick={onExit}>Return to Guest Portal</button></>:
   <><p>Question {index+1} of {questions.length}. You can close this page and resume later.</p>
   <fieldset><legend>{q.prompt}</legend>{q.options.map(o=><label key={o.id} style={{display:"block",margin:"12px 0"}}><input type="radio" name={q.id} checked={answers[q.id]===o.id} onChange={()=>void choose(q.id,o.id)}/> {o.text}</label>)}</fieldset>
   <p role="status">{status}</p>
   <div style={{display:"flex",gap:12}}><button type="button" disabled={index===0||busy} onClick={()=>setIndex(i=>i-1)}>Back</button>
   {index<questions.length-1?<button type="button" disabled={!answers[q.id]||busy} onClick={()=>setIndex(i=>i+1)}>Next</button>:<button type="button" disabled={questions.some(x=>!answers[x.id])||busy} onClick={()=>void submit()}>Submit Knowledge Check</button>}</div>
   <button type="button" onClick={onExit}>Finish with an Adventure Technician instead</button></>}
 </section>;
}