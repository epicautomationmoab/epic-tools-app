import { supabaseSelect } from './supabase-rest';
import { returnHealth, type ReturnDispatch, type ReturnJob, type ReturnHealth } from '../tour-return-health';

export type ReturnException = ReturnDispatch & {
  customer_name: string;
  confirmation_code: string;
  vehicle_label: string | null;
  vehicle_slot: number;
  visit_date: string;
  return_health: ReturnHealth;
};

export async function attachReturnHealth<T extends ReturnDispatch>(rows: T[]) {
  const ids = [...new Set(rows.filter(row => row.dispatch_id && row.checkin_requested_at).map(row => row.dispatch_id!))];
  const latest = new Map<string, ReturnJob>();
  for (let i = 0; i < ids.length; i += 50) {
    const params = new URLSearchParams({
      select: 'id,dispatch_id,status,attempt_count,last_error,created_at,updated_at,started_at,claimed_at',
      dispatch_id: `in.(${ids.slice(i, i + 50).join(',')})`, action_type: 'eq.checkin',
      order: 'created_at.desc,id.desc', limit: '500',
    });
    for (let offset = 0; ; offset += 500) {
      params.set('offset', String(offset));
      const jobs = await supabaseSelect<ReturnJob>('tour_vehicle_jobs', params);
      for (const job of jobs) if (!latest.has(job.dispatch_id)) latest.set(job.dispatch_id, job);
      if (jobs.length < 500) break;
    }
  }
  const now = Date.now();
  return rows.map(row => ({ ...row, return_health: returnHealth(row, latest.get(row.dispatch_id || ''), now) }));
}

export async function getTourReturnExceptions(): Promise<ReturnException[]> {
  const rows: Omit<ReturnException, 'return_health'>[] = [];
  const params = new URLSearchParams({
    select: 'dispatch_id,checkin_status,checkin_requested_at,last_error,customer_name,confirmation_code,vehicle_label,vehicle_slot,visit_date',
    checkin_requested_at: 'not.is.null', checkin_status: 'not.in.(returned,completed,checked_in)',
    order: 'checkin_requested_at.asc,dispatch_id.asc', limit: '500',
  });
  // Deliberately includes prior dates: unresolved returns must survive midnight.
  for (let offset = 0; ; offset += 500) {
    params.set('offset', String(offset));
    const batch = await supabaseSelect<Omit<ReturnException, 'return_health'>>('tour_vehicle_dispatch_roster_v', params);
    rows.push(...batch);
    if (batch.length < 500) break;
  }
  return (await attachReturnHealth(rows)).filter(row => row.return_health.needsAttention);
}
