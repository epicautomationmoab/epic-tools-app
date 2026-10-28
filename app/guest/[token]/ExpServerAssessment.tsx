"use client";
import {useEffect,useState} from "react";
import styles from "./ExpAssessment.module.css";
import ExpAssessmentResult from "./ExpAssessmentResult";

type Answer={questionId:string;optionId:string};
type PublicQuestion={id:string;prompt:string;options:Array<{id:string;text:string}>};
type Result={status:string;expReady?:boolean;correct?:number;reason?:string;questionIds?:string[];questions?:PublicQuestion[];corrections?:Array<{questionId:string;correctAnswer:string;explanation:string}>};
export default function ExpServerAssessment({token,readinessId,sessionId,questions,onExit}:{token:string;readinessId:string;sessionId:string;questions:PublicQuestion[];onExit:()=>void}){
 const [answers,setAnswers]=useState<Record<string,string>>({});
 const [questionOrder,setQuestionOrder]=useState<PublicQuestion[]>(questions);
 const [criticalAnswers,setCriticalAnswers]=useState<Record<string,string>>({});
 const [criticalIds,setCriticalIds]=useState<string[]>([]);
 const [index,setIndex]=useState(0);
 const [status,setStatus]=useState("");
 const [busy,setBusy]=useState(true);
 const [result,setResult]=useState<Result|null>(null);
 const [mode,setMode]=useState<"initial"|"critical">("initial");
 const activeQuestions=mode==="critical"?questionOrder.filter(q=>criticalIds.includes(q.id)):questionOrder;
 const currentAnswers=mode==="critical"?criticalAnswers:answers;
 useEffect(()=>{let active=true;fetch(`/api/guest/${encodeURIComponent(token)}/exp/progress?readinessId=${encodeURIComponent(readinessId)}&sessionId=${encodeURIComponent(sessionId)}`,{cache:"no-store"})
   .then(r=>r.ok?r.json():null).then(d=>{if(active&&d?.draftAnswers)setAnswers(d.draftAnswers);}).catch(()=>{}).finally(()=>{if(active)setBusy(false)});
   return()=>{active=false}},[token,readinessId,sessionId]);
 const save=async(next:Record<string,string>)=>{
   const response=await fetch(`/api/guest/${encodeURIComponent(token)}/exp/progress`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({readinessId,sessionId,draftAnswers:next})});
   if(!response.ok)throw new Error("Unable to save your answers. Please try again.");
 };
 const choose=async(qid:string,oid:string)=>{if(busy)return;setBusy(true);if(mode==="critical"){setCriticalAnswers(a=>({...a,[qid]:oid}));setBusy(false);return}
   const next={...answers,[qid]:oid};setAnswers(next);setStatus("Saving…");try{await save(next);setStatus("Progress saved")}catch(e){setStatus(e instanceof Error?e.message:"Save failed")}finally{setBusy(false)}};
 const submit=async()=>{
   if(activeQuestions.some(q=>!currentAnswers[q.id]))return;
   setBusy(true);setStatus("Checking answers…");
   try {
    const a:Answer[]=activeQuestions.map(q=>({questionId:q.id,optionId:currentAnswers[q.id]}));
    const response=await fetch(`/api/guest/${encodeURIComponent(token)}/exp/assessment`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:mode==="critical"?"critical_retry":"submit",readinessId,sessionId,answers:a})});
    const data=await response.json() as Result & {error?:string};
    if(!response.ok)throw new Error(data.error||"Unable to submit assessment.");
    if(data.status==="retry_quiz"){
      setQuestionOrder(data.questions?.length===10?data.questions:questionOrder);
      setAnswers({});setCriticalAnswers({});setIndex(0);setMode("initial");setResult(null);
      setStatus("One or two questions need another try. Your video viewing is retained.");
      return;
    }
    if(data.status==="critical_retry" && data.questionIds?.length){setCriticalIds(data.questionIds);setIndex(0);setMode("critical");setStatus("Important safety questions need another attempt.");return;}
    setResult(data);setStatus("");
   }catch(e){setStatus(e instanceof Error?e.message:"Assessment failed")}finally{setBusy(false)}
 };
 const q=activeQuestions[index];
 return <section className={styles.assessment} aria-label="EXP saved knowledge check" aria-busy={busy}>
  {!result?<h3>One Last Step to More Trail Time</h3>:null}
  {result?<ExpAssessmentResult result={result} onExit={onExit}/>:
   <><p className={styles.intro}>Your answers save as you go. You can close this page and return later.</p>
   <div className={styles.progressHeading}><strong>Question {index+1} of {activeQuestions.length}</strong><span>{activeQuestions.filter(x=>currentAnswers[x.id]).length} answered</span></div>
   <div className={styles.progressTrack} role="progressbar" aria-label="Questions answered" aria-valuemin={0} aria-valuemax={activeQuestions.length} aria-valuenow={activeQuestions.filter(x=>currentAnswers[x.id]).length}><div className={styles.progressFill} style={{width:`${100*activeQuestions.filter(x=>currentAnswers[x.id]).length/Math.max(1,activeQuestions.length)}%`}}/></div>
   {q?<fieldset className={styles.question}><legend>{q.prompt}</legend>{q.options.map(o=><label key={o.id} className={styles.answer}><input type="radio" disabled={busy} name={q.id} checked={currentAnswers[q.id]===o.id} onChange={()=>void choose(q.id,o.id)}/><span>{o.text}</span></label>)}</fieldset>:<p>Questions unavailable.</p>}
   <p className={styles.saveStatus} role="status" aria-live="polite">{status || (busy?"Loading saved answers…":"Select an answer to continue.")}</p>
   <div className={styles.actions}><button className={styles.secondary} type="button" disabled={index===0||busy} onClick={()=>setIndex(i=>i-1)}>Back</button>
   {index<activeQuestions.length-1?<button className={styles.primary} type="button" disabled={!q||!currentAnswers[q.id]||busy} onClick={()=>setIndex(i=>i+1)}>Next</button>:<button className={styles.primary} type="button" disabled={activeQuestions.some(x=>!currentAnswers[x.id])||busy} onClick={()=>void submit()}>Submit Knowledge Check</button>}</div>
   <button className={styles.technician} type="button" onClick={onExit}>Prefer to finish in person? An Adventure Technician can help at arrival.</button></>}
 </section>;
}