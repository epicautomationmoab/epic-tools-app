const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
let profile = null, workstation = false, calls = [], failure = false;
const env = {};
let isolated = false;
const context = { exports: {}, process: { env }, console: { error() {} }, require(name) {
  if (name === 'next/server') return { NextRequest, NextResponse };
  if (name.endsWith('/uui-internal-writes')) return { isIsolatedUui: () => isolated };
  if (name.endsWith('/team-auth')) return { getAuthenticatedTeamProfile: async () => profile };
  if (name.endsWith('/workstation-auth')) return { WORKSTATION_COOKIE: 'station', verifyWorkstationCookie: () => workstation };
  if (name.endsWith('/supabase-rest')) return { supabaseRpc: async (name, args) => { calls.push({ name, args }); if (failure) throw Error('private database details'); } };
  throw Error(name);
}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/team/readiness/handoff/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const valid = { readiness_id: '00000000-0000-4000-8000-000000000312', handoff_status: 'rental_returned', recorded_by: 'Spoofed actor' };
const request = body => new NextRequest('https://preview.invalid/api/team/readiness/handoff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) });
(async () => {
  assert.equal((await context.exports.POST(request(valid))).status, 401);
  assert.equal(calls.length, 0);
  profile = { display_name: 'Jennifer Test', role: 'admin' };
  for (const handoff_status of ['checked_in', 'rental_out', 'rental_returned']) {
    calls = [];
    assert.equal((await context.exports.POST(request({ ...valid, handoff_status }))).status, 200);
    assert.equal(calls[0].name, 'set_epic_operational_handoff');
    assert.equal(calls[0].args.p_recorded_by, 'Jennifer Test');
    assert.equal(calls[0].args.p_handoff_status, handoff_status);
  }
  calls = [];
  for (const body of ['{broken', {}, { ...valid, readiness_id: 'not-a-uuid' }, { ...valid, handoff_status: 'tour_returned' }]) {
    assert.equal((await context.exports.POST(request(body))).status, 400);
  }
  assert.equal(calls.length, 0);
  env.EPIC_STAGING_NO_OUTBOUND = 'true';
  assert.equal((await context.exports.POST(request(valid))).status, 403);
  assert.equal(calls.length, 0);
  isolated = true;
  assert.equal((await context.exports.POST(request(valid))).status, 200);
  assert.equal(calls[0].name, 'uui_preview_set_handoff');
  calls = [];
  delete env.EPIC_STAGING_NO_OUTBOUND;
  profile = null; workstation = true;
  assert.equal((await context.exports.POST(request(valid))).status, 200);
  assert.equal(calls[0].args.p_recorded_by, 'Epic Workstation');
  failure = true;
  const failed = await context.exports.POST(request(valid));
  assert.equal(failed.status, 500);
  assert.ok(!(await failed.text()).includes('private database details'));
  console.log('Handoff route checks passed: authentication, existing statuses/RPC, server attribution, input validation, workstation attribution, Preview direct-call denial and sanitized failure.');
})().catch(error => { console.error(error); process.exit(1); });
