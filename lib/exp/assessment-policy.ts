/**
 * EXP assessment policy v2. Pure logic, independent of guest portal and kiosk.
 * A quiz session is not proof that a specific driver has completed orientation.
 * Persist individual driver acknowledgements separately before granting EXP status.
 */
export type ExpQuestion = {
  id: string;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
  critical: boolean;
  explanation: string;
};
export type ExpAnswer = { questionId: string; optionId: string };
export type ExpOutcome =
  | { status: "complete"; correct: number; missedNoncritical: string[]; corrections: Array<{ questionId: string; correctOptionId: string; explanation: string }> }
  | { status: "critical_retry"; questionIds: string[]; correct: number }
  | { status: "retry_or_technician"; reason: "noncritical" | "critical"; correct: number; missedNoncritical: string[] };

export function gradeExpAssessment(questions: ExpQuestion[], answers: ExpAnswer[]): ExpOutcome {
  if (questions.length !== 10 || new Set(questions.map(q => q.id)).size !== 10) throw new Error("EXP needs ten distinct questions.");
  const answerMap = new Map(answers.map(a => [a.questionId, a.optionId]));
  if (answerMap.size !== 10 || answers.length !== 10) throw new Error("All ten questions need one answer.");
  for (const question of questions) {
    if (!question.options.some(option => option.id === question.correctOptionId)) throw new Error("Question has no valid key.");
    if (!question.options.some(option => option.id === answerMap.get(question.id))) throw new Error("Invalid or missing answer.");
  }
  const missed = questions.filter(q => answerMap.get(q.id) !== q.correctOptionId);
  const critical = missed.filter(q => q.critical);
  const noncritical = missed.filter(q => !q.critical);
  const correct = 10 - missed.length;
  if (critical.length >= 3) return { status: "retry_or_technician", reason: "critical", correct, missedNoncritical: noncritical.map(q => q.id) };
  if (critical.length) return { status: "critical_retry", questionIds: critical.map(q => q.id), correct };
  if (noncritical.length >= 3) return { status: "retry_or_technician", reason: "noncritical", correct, missedNoncritical: noncritical.map(q => q.id) };
  return {
    status: "complete", correct, missedNoncritical: noncritical.map(q => q.id),
    corrections: noncritical.map(q => ({ questionId: q.id, correctOptionId: q.correctOptionId, explanation: q.explanation })),
  };
}

/** No prior selection/answer is returned to the guest on a critical retry. */
export function gradeCriticalRetry(questions: ExpQuestion[], retryAnswers: ExpAnswer[]): { status: "resolved" | "retry_or_technician"; failedQuestionIds: string[] } {
  if (!questions.length || questions.some(q => !q.critical)) throw new Error("Only missed critical questions can be retried.");
  const answerMap = new Map(retryAnswers.map(a => [a.questionId, a.optionId]));
  if (retryAnswers.length !== questions.length || answerMap.size !== questions.length) throw new Error("Every critical retry question requires an answer.");
  if (questions.some(q => !q.options.some(o => o.id === answerMap.get(q.id)))) throw new Error("Invalid retry answer.");
  const failed = questions.filter(q => answerMap.get(q.id) !== q.correctOptionId).map(q => q.id);
  return { status: failed.length ? "retry_or_technician" : "resolved", failedQuestionIds: failed };
}

/**
 * After a resolved critical retry, apply the original noncritical miss count.
 * Critical answers are not revealed by this policy.
 */
export function resolveCriticalRetry(original: ExpQuestion[], originalAnswers: ExpAnswer[], retryAnswers: ExpAnswer[]): ExpOutcome {
  const initial = gradeExpAssessment(original, originalAnswers);
  if (initial.status !== "critical_retry") throw new Error("No critical retry is due.");
  const critical = original.filter(q => initial.questionIds.includes(q.id));
  const retry = gradeCriticalRetry(critical, retryAnswers);
  if (retry.status !== "resolved") {
    return { status: "retry_or_technician", reason: "critical", correct: initial.correct, missedNoncritical: [] };
  }
  const answerMap = new Map(originalAnswers.map(a => [a.questionId, a.optionId]));
  const missedNoncritical = original.filter(q => !q.critical && answerMap.get(q.id) !== q.correctOptionId);
  if (missedNoncritical.length >= 3) return { status: "retry_or_technician", reason: "noncritical", correct: initial.correct, missedNoncritical: missedNoncritical.map(q => q.id) };
  return { status: "complete", correct: initial.correct + critical.length, missedNoncritical: missedNoncritical.map(q => q.id), corrections: missedNoncritical.map(q => ({ questionId: q.id, correctOptionId: q.correctOptionId, explanation: q.explanation })) };
}
