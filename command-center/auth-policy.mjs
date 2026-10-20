/**
 * Epic Command Center - shared authorization policy.
 * Pure and side-effect-free. No changes to currently deployed sign-in routes.
 * Explicit scope grants supersede navigation visibility; all backend APIs must enforce permission checks.
 */
export const WORKSPACES = Object.freeze({
  sales: 'Sales & Reservations',
  readiness: 'Readiness & Fulfillment',
  fleet: 'Fleet & Incidents',
  management: 'Management & Configuration',
  reporting: 'Reporting & Intelligence',
});

export const ROLE_PERMISSIONS = Object.freeze({
  agent: Object.freeze(['sales.view', 'sales.work', 'readiness.view', 'readiness.work']),
  workstation: Object.freeze(['readiness.view']),
  manager: Object.freeze([
    'sales.view','sales.work','readiness.view','readiness.work',
    'fleet.view','fleet.work','management.view','management.work',
    'reporting.view','audit.view','audit.team_activity.view',
  ]),
  admin: Object.freeze([
    'sales.view','sales.work','readiness.view','readiness.work',
    'fleet.view','fleet.work','management.view','management.work',
    'reporting.view','audit.view','audit.team_activity.view',
    'audit.sessions.view','security.manage',
  ]),
});

/** Fail closed for missing, unknown or inactive profiles. */
export function hasPermission(profile, permission) {
  if (!profile || profile.active !== true || !permission) return false;
  const allowed = ROLE_PERMISSIONS[profile.role];
  return Boolean(allowed && allowed.includes(permission));
}

export function visibleWorkspaces(profile) {
  const required = {
    sales: 'sales.view',
    readiness: 'readiness.view',
    fleet: 'fleet.view',
    management: 'management.view',
    reporting: 'reporting.view',
  };
  return Object.entries(required)
    .filter(([, permission]) => hasPermission(profile, permission))
    .map(([id, permission]) => ({ id, label: WORKSPACES[id], permission }));
}

/**
 * Tested permission vocabulary only. It is NOT installed as a server policy
 * until every API endpoint is wired and tested. No implied data access.
 */
