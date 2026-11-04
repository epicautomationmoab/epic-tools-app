export type ReturnDispatch = {
  dispatch_id: string | null;
  checkin_status: string;
  checkin_requested_at: string | null;
  last_error: string | null;
};
export type ReturnJob = {
  id: string;
  dispatch_id: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  claimed_at: string | null;
};
export type ReturnHealth = { needsAttention: boolean; message: string; attempts: number };
const complete = new Set(['returned', 'completed', 'checked_in']);
export function returnHealth(dispatch: ReturnDispatch, job?: ReturnJob, now = Date.now()): ReturnHealth {
  const result = (needsAttention: boolean, message = '') => ({ needsAttention, message, attempts: job?.attempt_count ?? 0 });
  if (complete.has(dispatch.checkin_status)) return result(false);
  // Prepared work has not been released by a guide; elapsed tour time is not evidence of return.
  if (!dispatch.checkin_requested_at) return result(false);
  const active = job && ['training_claimed', 'claimed', 'running', 'processing', 'checking_in'].includes(job.status);
  if (active) {
    const began = Date.parse(job.started_at || job.claimed_at || job.updated_at);
    return Number.isFinite(began) && now - began >= 300_000
      ? result(true, 'Check-in has been processing for more than five minutes. Verify the return in MPWR.')
      : result(false);
  }
  const error = job?.last_error || dispatch.last_error;
  if (error) return result(true, error);
  if (job && ['failed', 'needs_review', 'needs_human_review'].includes(job.status)) return result(true, 'The check-in worker could not complete this return.');
  const requested = Date.parse(dispatch.checkin_requested_at);
  if (Number.isFinite(requested) && now - requested >= 300_000) return result(true, 'No confirmed return within five minutes of submission. Verify the return in MPWR.');
  return result(false);
}
