import { NextRequest, NextResponse } from "next/server";
import { EXP_QUESTION_BANK_DRAFT } from "@/lib/exp/question-bank-draft";
import { gradeExpAssessment, resolveCriticalRetry, type ExpAnswer, type ExpOutcome } from "@/lib/exp/assessment-policy";
import { supabaseInsert, supabasePatchRows, supabaseSelect } from "@/lib/server/supabase-rest";

type Portal = { readiness_id: string; business_line: string; visit_start_time: string };
type Session = {
  id: string; readiness_id: string; outcome: string;
  result_summary: Record<string, unknown>; assessment_version: string;
  video_ended: boolean; video_duration_seconds: number | null; video_watched_seconds: number[] | null; created_at: string;
};
const VERSION = "exp-2026-10-26-v1";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
function stableShuffle<T>(items:T[],seed:string):T[]{
  let state=2166136261;
  for(let i=0;i<seed.length;i++)state=Math.imul(state^seed.charCodeAt(i),16777619);
  const result=[...items];
  for(let i=result.length-1;i>0;i--){
    state^=state<<13;state^=state>>>17;state^=state<<5;
    const j=(state>>>0)%(i+1);
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
function publicQuestions(sessionId:string) {
  return stableShuffle(EXP_QUESTION_BANK_DRAFT,sessionId).map(q=>({
    id:q.id,prompt:q.prompt,
    options:q.options.length===2&&q.options.every(o=>["true","false"].includes(o.id))
      ? q.options.map(o=>({id:o.id,text:o.text}))
      : stableShuffle(q.options,sessionId+q.id).map(o=>({id:o.id,text:o.text}))
  }));
}
function isAnswerArray(value: unknown): value is ExpAnswer[] {
  return Array.isArray(value) && value.every(a =>
    a && typeof a === "object" && typeof a.questionId === "string" &&
    typeof a.optionId === "string");
}
function resultForGuest(result: ExpOutcome) {
  if (result.status === "critical_retry") return { status: result.status, questionIds: result.questionIds };
  if (result.status === "complete") return {
    status: "practice_complete", correct: result.correct,
    corrections: result.corrections.map(c => ({
      questionId: c.questionId,
      correctAnswer: EXP_QUESTION_BANK_DRAFT.find(q => q.id === c.questionId)?.options.find(o => o.id === c.correctOptionId)?.text ?? "",
      explanation: c.explanation,
    })),
    completionRecorded: false,
  };
  return { status: result.status, reason: result.reason, completionRecorded: false };
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  // Deliberately OFF until migration and reservation/waiver integration have been tested.
  if (process.env.EXP_ASSESSMENT_SERVER_ENABLED !== "true") return fail("EXP server assessment is not enabled.", 503);
  try {
    const { token } = await context.params;
    const body = await request.json() as {
      action?: "start" | "submit" | "critical_retry";
      readinessId?: string; sessionId?: string; answers?: unknown;
    };
    if (!token || !body.readinessId || !body.action) return fail("Reservation and action required.");
    const activities = await supabaseSelect<Portal>("guest_portal_v", new URLSearchParams({
      select: "readiness_id,business_line,visit_start_time", guest_portal_token: `eq.${token}`,
      readiness_id: `eq.${body.readinessId}`, limit: "1",
    }));
    const activity = activities[0];
    if (!activity || activity.business_line?.toLowerCase() !== "rental") return fail("Rental reservation not found.", 404);

    if (body.action === "start") {
      // Resume an unfinished assessment instead of silently creating a second session.
      const existing = await supabaseSelect<{ id: string; result_summary: Record<string,unknown> }>("exp_sessions", new URLSearchParams({
        select: "id,result_summary", readiness_id: `eq.${activity.readiness_id}`,
        assessment_version: `eq.${VERSION}`, outcome: "eq.in_progress",
        order: "created_at.desc", limit: "1",
      }));
      if (existing.length) {
        return NextResponse.json({ sessionId: existing[0].id, questions: publicQuestions(existing[0].id + "-attempt-" + (Number(existing[0].result_summary?.attemptCount || 0) + 1)),
          resumed: true, completionRecorded: false }, { headers: { "Cache-Control": "no-store" } });
      }
      const session = await supabaseInsert<{ id: string }>("exp_sessions", {
        readiness_id: activity.readiness_id, video_version: "3.2",
        assessment_version: VERSION, mode: "individual", outcome: "in_progress",
      });
      return NextResponse.json({ sessionId: session.id, questions: publicQuestions(session.id+"-attempt-1"), completionRecorded: false });
    }

    if (!body.sessionId || !isAnswerArray(body.answers)) return fail("Valid session and responses required.");
    const sessions = await supabaseSelect<Session>("exp_sessions", new URLSearchParams({
      select: "id,readiness_id,outcome,result_summary,assessment_version,video_ended,video_duration_seconds,video_watched_seconds,created_at",
      id: `eq.${body.sessionId}`, readiness_id: `eq.${activity.readiness_id}`, limit: "1",
    }));
    const session = sessions[0];
    if (!session || session.assessment_version !== VERSION) return fail("Assessment session not found.", 404);
    // Video checkpoints originate with the Vimeo player and are recorded for resume.
    // They are not independently authenticated evidence and never grant checkout.
    const recordedDuration = session.video_duration_seconds ?? 0;
    const observedSeconds = new Set(session.video_watched_seconds ?? []);
    const wallElapsedSeconds = (Date.now()-new Date(session.created_at).getTime())/1000;
    if (!session.video_ended || recordedDuration < 60 ||
        observedSeconds.size < Math.ceil(recordedDuration * 0.98) ||
        !Number.isFinite(wallElapsedSeconds) || wallElapsedSeconds < recordedDuration*0.98) {
      return fail("Finish the entire safety orientation video before submitting the assessment.",409);
    }
    // A submitted assessment must belong to a recorded group of participating drivers.
    // This prevents orphaned assessment completions and preserves the all-driver model.
    const participants = await supabaseSelect<{ id: string; acknowledgement_at: string | null; reconciliation_status: string }>("exp_participants", new URLSearchParams({
      select: "id,acknowledgement_at,reconciliation_status", session_id: `eq.${session.id}`, limit: "21",
    }));
    if (!participants.length || participants.some(p => !p.acknowledgement_at)) {
      return fail("Confirm all participating drivers and their video acknowledgments before submitting.", 409);
    }
    if (body.action === "submit") {
      if (session.outcome !== "in_progress") return fail("Assessment was already submitted.", 409);
      let result: ExpOutcome;
      try { result = gradeExpAssessment(EXP_QUESTION_BANK_DRAFT, body.answers); }
      catch { return fail("All ten questions require one valid answer."); }
      const priorAttempts = Math.max(0,Number(session.result_summary?.attemptCount || 0));
      const attemptCount = priorAttempts + 1;
      // One or two ordinary missed answers: retry the quiz; do not grant completion.
      if (result.status === "complete" && result.correct < 10) {
        await supabasePatchRows("exp_sessions",new URLSearchParams({id:`eq.${session.id}`,outcome:"eq.in_progress"}),{
          draft_answers:{},
          result_summary:{attemptCount,initialOutcome:"retry_quiz",verifiedForCheckout:false}
        });
        return NextResponse.json({status:"retry_quiz",correct:result.correct,
          questions:publicQuestions(session.id+"-attempt-"+(attemptCount+1)),
          completionRecorded:false},{headers:{"Cache-Control":"no-store"}});
      }
      // Any missed critical safety question requires a full video rewatch.
      // An immediate critical-only retry would defeat that policy.
      const requiresRewatch = result.status === "critical_retry";
      const finalStatus = requiresRewatch ? "retry_or_technician" : result.status;
      const updated = await supabasePatchRows<{id:string}>("exp_sessions",new URLSearchParams({
        id:`eq.${session.id}`,outcome:"eq.in_progress",select:"id"
      }),{
        outcome:finalStatus,
        result_summary:{attemptCount,initialOutcome:result.status,participantCount:participants.length,verifiedForCheckout:false,
          requiresVideoRewatch:requiresRewatch||finalStatus==="retry_or_technician"},
        ...(finalStatus==="complete"?{completed_at:new Date().toISOString()}:{})
      });
      if(updated.length!==1)return fail("This assessment has already been submitted.",409);
      if(requiresRewatch)return NextResponse.json({status:"retry_or_technician",reason:"critical",completionRecorded:false},{headers:{"Cache-Control":"no-store"}});
      return NextResponse.json(resultForGuest(result),{headers:{"Cache-Control":"no-store"}});
    }
    if (body.action === "critical_retry") {
      if (session.outcome !== "critical_retry" || !isAnswerArray(session.result_summary?.originalAnswers)) return fail("Critical retry not available.", 409);
      const result = resolveCriticalRetry(EXP_QUESTION_BANK_DRAFT, session.result_summary.originalAnswers, body.answers);
      const updated = await supabasePatchRows<{ id: string }>("exp_sessions", new URLSearchParams({ id: `eq.${session.id}`, outcome: "eq.critical_retry", select: "id" }), {
        outcome: result.status,
        result_summary: { initialOutcome: "critical_retry", retryOutcome: result.status, participantCount: participants.length, verifiedForCheckout: false },
        ...(result.status === "complete" ? { completed_at: new Date().toISOString() } : {}),
      });
      if (updated.length !== 1) return fail("This critical retry has already been submitted.", 409);
      return NextResponse.json(resultForGuest(result), { headers: { "Cache-Control": "no-store" } });
    }
    return fail("Unsupported assessment action.");
  } catch (error) {
    console.error("EXP assessment request failed", error);
    return fail("Unable to process EXP assessment.", 500);
  }
}
