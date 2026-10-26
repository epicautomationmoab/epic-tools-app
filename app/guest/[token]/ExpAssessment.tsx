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
}: { questions: ExpQuestion[]; onExit: () => void }) {
  const randomized = useMemo(() => shuffled(questions).map(q => ({ ...q, options: shuffled(q.options) })), [questions]);
  const [stage, setStage] = useState<Stage>("questions");
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const [originalAnswers, setOriginalAnswers] = useState<ExpAnswer[]>([]);
  const [criticalAnswers, setCriticalAnswers] = useState<Record<string,string>>({});
  const [missedCritical, setMissedCritical] = useState<string[]>([]);
  const [result, setResult] = useState<ExpOutcome | null>(null);
  const [attempt, setAttempt] = useState(1);

  const displayQuestions = stage === "critical_retry"
    ? randomized.filter(q => missedCritical.includes(q.id))
    : randomized;

  const currentAnswers = stage === "critical_retry" ? criticalAnswers : answers;
  const answeredAll = displayQuestions.length > 0 && displayQuestions.every(q => Boolean(currentAnswers[q.id]));

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
    setAnswers({});
    setCriticalAnswers({});
    setResult(null);
    setOriginalAnswers([]);
    setMissedCritical([]);
    setStage("questions");
  }

  if (questions.length !== 10) return <p role="status">The EXP assessment question bank is not configured. Please complete your orientation with an Adventure Technician.</p>;
  return <section className={styles.assessment} aria-label="Epic Xpress Ready knowledge assessment">
    <h3>Epic Xpress Ready — Knowledge Check</h3>
    {stage === "technician" ? <>
      <p>Our Adventure Technician will complete your safety orientation at checkout.</p>
      <p>This choice does not mark online EXP complete.</p>
      <button type="button" onClick={onExit}>Return to Guest Portal</button>
    </> : stage === "result" && result ? <>
      {result.status === "complete" ? <>
        <h4>Great work! Let's review what you missed.</h4>
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
        <button type="button" onClick={onExit}>Done</button>
      </> : <>
        <h4>Let's get you adventure ready!</h4>
        <p>You can try the knowledge check again or complete your orientation in person with an Adventure Technician.</p>
        <div className={styles.actions}><button type="button" onClick={restart}>Try Again</button>
          <button type="button" onClick={() => setStage("technician")}>Adventure Technician Checkout</button></div>
      </>}
    </> : <>
      {stage === "critical_retry" ? <p>Please answer these important safety questions once more.</p> :
        <p>Answer the ten safety questions. You can review answers together when participating as a group.</p>}
      <p className={styles.note}>Attempt {attempt}</p>
      {displayQuestions.map((q, index) => <fieldset className={styles.question} key={q.id}>
        <legend>{index + 1}. {q.prompt}</legend>
        {q.options.map(o => <label className={styles.answer} key={o.id}>
          <input type="radio" name={`exp-${stage}-${q.id}`} value={o.id}
            checked={currentAnswers[q.id] === o.id}
            onChange={() => stage === "critical_retry"
              ? setCriticalAnswers(prev => ({...prev, [q.id]: o.id}))
              : setAnswers(prev => ({...prev, [q.id]: o.id}))} />
          <span>{o.text}</span>
        </label>)}
      </fieldset>)}
      <div className={styles.actions}>
        <button type="button" disabled={!answeredAll} onClick={submit}>Submit Answers</button>
        <button type="button" onClick={() => setStage("technician")}>Adventure Technician Checkout</button>
      </div>
    </>}
  </section>;
}
