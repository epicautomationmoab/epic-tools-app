import { NextRequest, NextResponse } from "next/server";
import { EXP_QUESTION_BANK_DRAFT } from "@/lib/exp/question-bank-draft";
import { gradeExpAssessment, resolveCriticalRetry, type ExpAnswer, type ExpOutcome } from "@/lib/exp/assessment-policy";
import { supabaseInsert, supabasePatchRows, supabaseSelect } from "@/lib/server/supabase-rest";

type Portal = { readiness_id: string; business_line: string; visit_start_time: string };
type Session = {
  id: string; readiness_id: string; outcome: string;
  result_summary: Record<string, unknown>; assessment_version: string;
};
const VERSION = "exp-2026-10-26-v1";

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
function publicQuestions() {
  return EXP_QUESTION_BANK_DRAFT.map(q => ({
    id: q.id, prompt: q.prompt, options: q.options.map(o => ({ id: o.id, text: o.text })),
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
      const session = await supabaseInsert<{ id: string }>("exp_sessions", {
        readiness_id: activity.readiness_id, video_version: "3.2",
        assessment_version: VERSION, mode: "individual", outcome: "in_progress",
      });
      return NextResponse.json({ sessionId: session.id, questions: publicQuestions(), completionRecorded: false });
    }

    if (!body.sessionId || !isAnswerArray(body.answers)) return fail("Valid session and responses required.");
    const sessions = await supabaseSelect<Session>("exp_sessions", new URLSearchParams({
      select: "id,readiness_id,outcome,result_summary,assessment_version",
      id: `eq.${body.sessionId}`, readiness_id: `eq.${activity.readiness_id}`, limit: "1",
    }));
    const session = sessions[0];
    if (!session || session.assessment_version !== VERSION) return fail("Assessment session not found.", 404);
    if (body.action === "submit") {
      if (session.outcome !== "in_progress") return fail("Assessment was already submitted.", 409);
      const result = gradeExpAssessment(EXP_QUESTION_BANK_DRAFT, body.answers);
      const updated = await supabasePatchRows<{ id: string }>("exp_sessions", new URLSearchParams({ id: `eq.${session.id}`, outcome: "eq.in_progress", select: "id" }), {
        outcome: result.status,
        result_summary: { originalAnswers: body.answers, initialOutcome: result.status },
        ...(result.status === "complete" ? { completed_at: new Date().toISOString() } : {}),
      });
      if (updated.length !== 1) return fail("This assessment has already been submitted.", 409);
      return NextResponse.json(resultForGuest(result), { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "critical_retry") {
      if (session.outcome !== "critical_retry" || !isAnswerArray(session.result_summary?.originalAnswers)) return fail("Critical retry not available.", 409);
      const result = resolveCriticalRetry(EXP_QUESTION_BANK_DRAFT, session.result_summary.originalAnswers, body.answers);
      const updated = await supabasePatchRows<{ id: string }>("exp_sessions", new URLSearchParams({ id: `eq.${session.id}`, outcome: "eq.critical_retry", select: "id" }), {
        outcome: result.status,
        result_summary: { initialOutcome: "critical_retry", retryOutcome: result.status },
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
