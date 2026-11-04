// Shared activity clock for employee workspaces. Refreshing credentials alone
// must not unlock a genuinely idle session.
export const EMPLOYEE_ACTIVITY_KEY = 'epic_last_activity_at';
export const EMPLOYEE_IDLE_MS = 30 * 60 * 1000;
export function recordEmployeeActivity(storage: Pick<Storage, 'getItem' | 'setItem'>, now = Date.now(), freshSignIn = false) {
  const last = Number(storage.getItem(EMPLOYEE_ACTIVITY_KEY) || 0);
  if (!freshSignIn && last > 0 && now - last >= EMPLOYEE_IDLE_MS) return false;
  storage.setItem(EMPLOYEE_ACTIVITY_KEY, String(now));
  return true;
}
