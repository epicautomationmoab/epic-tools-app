import {expVideoDuration,matchesExpVideoDuration} from "@/lib/server/exp-video";
import { NextRequest, NextResponse } from "next/server";
import { EXP_QUESTION_BANK_DRAFT } from "@/lib/exp/question-bank-draft";
import { supabaseSelect, supabasePatchRows } from "@/lib/server/supabase-rest";

type Portal = { readiness_id: string; business_line: string };
type Session = {
  id: string; readiness_id: string; outcome: string;
  video_watched_seconds: number[] | null; video_ended: boolean;
  video_duration_seconds: number | null; draft_answers: Record<string,string> | null;
  result_summary: Record<string,unknown>; last_activity_at: string; pause_reason: string | null;
};
function reply(body: object, status = 200) {
  return NextResponse.json(body, {status,headers:{"Cache-Control":"no-store"}});
}
async function authorized(token:string,readyId:string,sessionId:string) {
  const [portal] = await supabaseSelect<Portal>("guest_portal_v",new URLSearchParams({
    select:"readiness_id,business_line",guest_portal_token:`eq.${token}`,readiness_id:`eq.${readyId}`,limit:"1"
  }));
  if (!portal || portal.business_line.toLowerCase()!=="rental") return null;
  const [session] = await supabaseSelect<Session>("exp_sessions",new URLSearchParams({
    select:"id,readiness_id,outcome,video_watched_seconds,video_ended,video_duration_seconds,draft_answers,result_summary,last_activity_at,pause_reason",
    readiness_id:`eq.${readyId}`,id:`eq.${sessionId}`,limit:"1"
  }));
  return session || null;
}
function summary(session:Session) {
  const answers=session.draft_answers||{};
  return {sessionId:session.id,outcome:session.outcome,
    criticalQuestionIds:session.outcome==="critical_retry"?session.result_summary?.criticalQuestionIds:undefined,
    retryOffered:session.result_summary?.retryOffered===true,
    videoSecondsObserved:(session.video_watched_seconds||[]).length,
    videoWatchedSeconds:session.video_watched_seconds||[],
    videoDurationSeconds:session.video_duration_seconds,videoEndedReported:session.video_ended,
    answeredQuestions:Object.keys(answers).length,
    draftAnswers:answers,lastActivityAt:session.last_activity_at,pauseReason:session.pause_reason,
    // Client-reported checkpoints are not authoritative proof of full viewing.
    videoVerified:false,expReady:false};
}
export async function GET(request:NextRequest,context:{params:Promise<{token:string}>}) {
  if(process.env.EXP_ASSESSMENT_SERVER_ENABLED!=="true")return reply({error:"Orientation progress recording is disabled."},503);
  try {
    const {token}=await context.params;
    const readinessId=request.nextUrl.searchParams.get("readinessId")||"";
    const sessionId=request.nextUrl.searchParams.get("sessionId")||"";
    if(!readinessId||!sessionId)return reply({error:"Reservation and session required."},400);
    const session=await authorized(token,readinessId,sessionId);
    if(!session)return reply({error:"Session not found."},404);
    const participants=await supabaseSelect<{display_name:string}>("exp_participants",new URLSearchParams({select:"display_name",session_id:`eq.${session.id}`}));
    const duration=await expVideoDuration();
    return reply({...summary(session),participants,videoVerificationAvailable:duration!==null,
      videoCoverageMet:duration!==null&&matchesExpVideoDuration(session.video_duration_seconds,duration)&&session.video_ended&&new Set(session.video_watched_seconds??[]).size>=Math.ceil(duration*0.98)});
  }catch{return reply({error:"Unable to retrieve orientation progress."},500);}
}
export async function PATCH(request:NextRequest,context:{params:Promise<{token:string}>}) {
  if(process.env.EXP_ASSESSMENT_SERVER_ENABLED!=="true")return reply({error:"Orientation progress recording is disabled."},503);
  try {
    const {token}=await context.params;
    const body=await request.json() as {readinessId?:string;sessionId?:string;
      videoWatchedSeconds?:unknown;videoDurationSeconds?:unknown;videoEnded?:unknown;
      draftAnswers?:unknown;pauseReason?:unknown};
    if(!body.readinessId||!body.sessionId)return reply({error:"Reservation and session required."},400);
    for(let attempt=0;attempt<3;attempt++){
    const session=await authorized(token,body.readinessId,body.sessionId);
    if(!session)return reply({error:"Session not found."},404);
    if(!["in_progress","critical_retry"].includes(session.outcome))return reply({error:"Completed sessions cannot be edited."},409);
    if(session.outcome==="critical_retry" && (body.videoWatchedSeconds!==undefined||body.videoDurationSeconds!==undefined||body.videoEnded!==undefined))return reply({error:"Retry only the pending safety questions."},409);
    const patch:Record<string,unknown>={last_activity_at:new Date(Math.max(Date.now(),new Date(session.last_activity_at).getTime()+1)).toISOString()};
    if(body.videoWatchedSeconds!==undefined){
      const seconds=body.videoWatchedSeconds;
      if(!Array.isArray(seconds)||seconds.length>1800||!seconds.every(v=>Number.isInteger(v)&&v>=0&&v<1800))
        return reply({error:"Invalid video progress."},400);
      // Merge checkpoints so overlapping or out-of-order updates never erase progress.
      patch.video_watched_seconds=[...new Set([...(session.video_watched_seconds||[]),...seconds])].sort((a,b)=>a-b);
    }
    if(body.videoDurationSeconds!==undefined){
      const d=body.videoDurationSeconds;
      if(!Number.isInteger(d)||Number(d)<60||Number(d)>1800)return reply({error:"Invalid video duration."},400);
      if(session.video_duration_seconds && d!==session.video_duration_seconds)return reply({error:"Video duration cannot change within an orientation session."},409);
      patch.video_duration_seconds=d;
    }
    const duration=Number(patch.video_duration_seconds??session.video_duration_seconds??0);
    if(patch.video_watched_seconds && (patch.video_watched_seconds as number[]).some(s=>s>=duration))return reply({error:"Video checkpoints exceed the orientation duration."},400);
    if(body.videoEnded===true)patch.video_ended=true;
    if(body.draftAnswers!==undefined){
      if(!body.draftAnswers||typeof body.draftAnswers!=="object"||Array.isArray(body.draftAnswers))return reply({error:"Invalid draft."},400);
      const draft=body.draftAnswers as Record<string,unknown>;
      const questionIds=new Map(EXP_QUESTION_BANK_DRAFT.map(q=>[q.id,new Set(q.options.map(o=>o.id))]));
      if(Object.keys(draft).length>10||Object.entries(draft).some(([id,answer])=>typeof answer!=="string"||!questionIds.get(id)?.has(answer)))
        return reply({error:"Invalid answers."},400);
      if(session.outcome==="critical_retry" && Object.keys(draft).some(id=>!((session.result_summary?.criticalQuestionIds||[]) as string[]).includes(id)))return reply({error:"Only pending safety questions can be saved."},400);
      patch.draft_answers=draft;
      if(session.result_summary?.retryOffered===true)patch.result_summary={...session.result_summary,retryOffered:false};
    }
    if(body.pauseReason!==undefined){
      if(!["none","closed","technician"].includes(String(body.pauseReason)))return reply({error:"Invalid pause reason."},400);
      patch.pause_reason=body.pauseReason;
    }
    const updated=await supabasePatchRows<Session>("exp_sessions",new URLSearchParams({
      id:`eq.${session.id}`,last_activity_at:`eq.${session.last_activity_at}`,readiness_id:`eq.${session.readiness_id}`,outcome:`eq.${session.outcome}`,select:"id,readiness_id,outcome,video_watched_seconds,video_ended,video_duration_seconds,draft_answers,result_summary,last_activity_at,pause_reason"
    }),patch);
    if(updated.length===1)return reply(summary(updated[0]));
    }
    return reply({error:"Session state changed. Reload progress."},409);
  }catch{return reply({error:"Unable to save orientation progress."},500);}
}
