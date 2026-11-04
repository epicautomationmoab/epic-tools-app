const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('lib/uui-internal-writes.ts', 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const check = context.exports.allowsUuiInternalWrite;
const env = { VERCEL_PROJECT_ID: 'prj_lZGiQ85J6jQRgSRostBvUJGVKv6r', VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'https://jgpihdpcdlqugmqanzfj.supabase.co' };
let count=0;
for (const route of ['/api/team/epic-ping','/api/team/live-calls','/api/sales/live-calls','/api/sales/quotes','/api/sales/unified-notes']) {
assert.equal(check(route, 'POST', env), true); count++;
for (const change of [{ VERCEL_ENV: 'production' }, { VERCEL_ENV: undefined }, { VERCEL_PROJECT_ID: 'other' }, { NEXT_PUBLIC_SUPABASE_URL: 'https://kbuxcvqzicnydqllyong.supabase.co' }, { NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL + '.attacker.example' }]) {
  assert.equal(check(route, 'POST', { ...env, ...change }), false); count++;
}
assert.equal(check(route, 'DELETE', env), false); count++;
}
for (const path of ['/api/team/epic-ping/other', '/api/sales/send-email', '/api/team/readiness/rental-issue-report']) assert.equal(check(path, 'POST', env), false);
assert.equal(check('/api/team/epic-ping', 'DELETE', env), false);
assert.equal(check('/api/sales/unified-notes','PATCH',env),true);
assert.equal(check('/api/sales/unified-notes','PATCH',{...env,VERCEL_ENV:'production'}),false);
count+=2;
console.log(`${count+4} internal-write boundary checks passed`);
