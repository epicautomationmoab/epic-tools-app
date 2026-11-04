const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync('lib/uui-internal-writes.ts', 'utf8');
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
const check = context.exports.allowsUuiInternalWrite;
const env = { VERCEL_PROJECT_ID: 'prj_lZGiQ85J6jQRgSRostBvUJGVKv6r', VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'https://jgpihdpcdlqugmqanzfj.supabase.co' };
assert.equal(check('/api/team/epic-ping', 'POST', env), true);
for (const change of [{ VERCEL_ENV: 'production' }, { VERCEL_ENV: undefined }, { VERCEL_PROJECT_ID: 'other' }, { NEXT_PUBLIC_SUPABASE_URL: 'https://kbuxcvqzicnydqllyong.supabase.co' }, { NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL + '.attacker.example' }]) {
  assert.equal(check('/api/team/epic-ping', 'POST', { ...env, ...change }), false);
}
for (const path of ['/api/team/epic-ping/other', '/api/sales/send-email', '/api/team/readiness/rental-issue-report']) assert.equal(check(path, 'POST', env), false);
assert.equal(check('/api/team/epic-ping', 'DELETE', env), false);
console.log('10 internal-write boundary checks passed');
