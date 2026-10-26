"use client";

import { useMemo, useState } from "react";
import { ExpQuestion, ExpAnswer, ExpOutcome, gradeExpAssessment, resolveCriticalRetry } from "@/lib/exp/assessment-policy";
import styles from "./ExpAssessment.module.css";

type Stage = "questions" | "critical_retry" | "result" | "technician";
function shuffled<T>(items: T[]): T[] {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

/** No completion persistence is permitted until the real question bank and waiver reconciliation API exist. */
export default function ExpAssessment({
  questions,
  onExit,
  onCompleted,
}: { questions: ExpQuestion[]; onExit: () => void; onCompleted?: () => void }) {
  const [attempt, setAttempt] = useState(1);
  const [questionIndex, setQuestionIndex] = useState(0);
  const randomized = useMemo(() => shuffled(questions).map(q => ({ ...q, options: q.options.length === 2 && q.options.every(o => ["true", "false"].includes(o.id)) ? [...q.options] : shuffled(q.options) })), [questions, attempt]);
  const [stage, setStage] = useState<Stage>("questions");
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [originalAnswers, setOriginalAnswers] = useState<ExpAnswer[]>([]);
  const [criticalAnswers, setCriticalAnswers] = useState<Record<string,string>>({});
  const [missedCritical, setMissedCritical] = useState<string[]>([]);
  const [result, setResult] = useState<ExpOutcome | null>(null);

  const displayQuestions = stage === "critical_retry"
    ? randomized.filter(q => missedCritical.includes(q.id))
    : randomized;

  const currentAnswers = stage === "critical_retry" ? criticalAnswers : answers;
  const answeredAll = displayQuestions.length > 0 && displayQuestions.every(q => Boolean(currentAnswers[q.id]));
  const currentQuestion = displayQuestions[questionIndex];
  const completedCount = displayQuestions.filter(q => Boolean(currentAnswers[q.id])).length;
  const completionPercent = displayQuestions.length ? Math.round(100 * completedCount / displayQuestions.length) : 0;

  function submit() {
    if (!answeredAll) return;
    if (stage === "questions") {
      const raw = randomized.map(q => ({ questionId: q.id, optionId: answers[q.id] }));
      const next = gradeExpAssessment(randomized, raw);
      setOriginalAnswers(raw);
      setResult(next);
      if (next.status === "critical_retry") {
        setMissedCritical(next.questionIds);
        setCriticalAnswers({});
        setQuestionIndex(0);
        setStage("critical_retry");
      } else {
        setStage("result");
      }
    } else if (stage === "critical_retry") {
      const raw = displayQuestions.map(q => ({ questionId: q.id, optionId: criticalAnswers[q.id] }));
      const next = resolveCriticalRetry(randomized, originalAnswers, raw);
      setResult(next);
      setStage("result");
    }
  }

  function restart() {
    setAttempt(n => n + 1);
    setQuestionIndex(0);
    setAnswers({});
    setCriticalAnswers({});
    setResult(null);
    setOriginalAnswers([]);
    setMissedCritical([]);
    setStage("questions");
  }

  if (questions.length !== 10) return <p role="status">The EXP assessment question bank is not configured. Please complete your orientation with an Adventure Technician.</p>;
  return <section className={styles.assessment} aria-label="Epic Xpress Ready knowledge assessment">
    <h3>One Last Step to More Trail Time</h3>
    {stage === "technician" ? <>
      <p>Our Adventure Technician will complete your safety orientation at checkout.</p>
      <p>This choice does not mark online EXP complete.</p>
      <button type="button" onClick={onExit}>Return to Guest Portal</button>
    </> : stage === "result" && result ? <>
      {result.status === "complete" ? <>
        <h4>Nice work! You're one step closer to the trails.</h4>
        {result.corrections.length === 0 ? <p>All ten answers were correct.</p> :
          result.corrections.map(item => {
            const question = questions.find(q => q.id === item.questionId);
            const correct = question?.options.find(option => option.id === item.correctOptionId);
            return <article key={item.questionId} className={styles.correction}>
              <strong>{question?.prompt}</strong>
              <p>Correct answer: {correct?.text}</p><p>{item.explanation}</p>
            </article>;
          })}
        <p className={styles.note}>Practice result only. Individual driver completion is not yet recorded.</p>
        <button type="button" onClick={() => { onCompleted?.(); onExit(); }}>Done</button>
      </> : <>
        <h4>Let's get you adventure ready!</h4>
        <p>{result.status === "retry_or_technician" && result.reason === "critical"
          ? "One or more essential safety answers still need review after the second attempt."
          : "Three or more noncritical answers need another look."}</p>
        <p className={styles.note}>Initial knowledge check: {result.correct} of 10 correct. This practice check does not save your answers.</p>
        <p>You can give the knowledge check another try here, or finish getting ready with an Adventure Technician when you arrive.</p>
        <div className={styles.actions}><button type="button" onClick={restart}>Try Again</button>
          <button type="button" onClick={() => setStage("technician")}>Finish with an Adventure Technician</button></div>
      </>}
    </> : <>
      {stage === "critical_retry" ? <p>Almost there! Please give these important safety questions another try.</p> :
        <p>A quick check to help you feel confident behind the wheel. Taking it as a group? Work through the answers together.</p>}
      <div className={styles.progressHeading}>
        <strong>{stage === "critical_retry" ? "Safety question" : "Question"} {questionIndex + 1} of {displayQuestions.length}</strong>
        <span>{completionPercent}% complete</span>
      </div>
      <div className={styles.progressTrack} role="progressbar" aria-label="Knowledge check progress"
        aria-valuenow={completionPercent} aria-valuemin={0} aria-valuemax={100}>
        <div className={styles.progressFill} style={{ width: `${completionPercent}%` }} />
      </div>
      <p className={styles.note}>{stage === "critical_retry" ? "Just a few safety essentials to double-check." : "Quick, straightforward questions about safely operating your RZR in Moab."}</p>
      {currentQuestion ? <fieldset className={styles.question} key={currentQuestion.id}>
        <legend>{currentQuestion.prompt}</legend>
        {currentQuestion.options.map(o => <label className={styles.answer} key={o.id}>
          <input type="radio" name={`exp-${stage}-${currentQuestion.id}`} value={o.id}
            checked={currentAnswers[currentQuestion.id] === o.id}
            onChange={() => stage === "critical_retry"
              ? setCriticalAnswers(prev => ({...prev, [currentQuestion.id]: o.id}))
              : setAnswers(prev => ({...prev, [currentQuestion.id]: o.id}))} />
          <span>{o.text}</span>
        </label>)}
      </fieldset> : null}
      <div className={styles.actions}>
        {questionIndex > 0 ? <button type="button" className={styles.secondary} onClick={() => setQuestionIndex(n => n - 1)}>Back</button> : null}
        {questionIndex < displayQuestions.length - 1 ?
          <button type="button" disabled={!currentQuestion || !currentAnswers[currentQuestion.id]}
            onClick={() => setQuestionIndex(n => n + 1)}>Next Question</button> :
          <button type="button" disabled={!answeredAll} onClick={submit}>Finish Knowledge Check</button>}
      </div>
      <button className={styles.technician} type="button" onClick={() => setStage("technician")}>
        Prefer to finish in person? Our Adventure Technicians are happy to help.
      </button>
    </>}
  </section>;
}
