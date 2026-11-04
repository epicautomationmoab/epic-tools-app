const ts=require('typescript'),fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const e={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/exp/window.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:e,Intl,Date});
const {withinExpWindow:w,denverWallTimeToIso:iso}=e;const start=Date.parse(iso('2026-11-05 09:00:00'));
assert.equal(w(start,Date.parse('2026-11-04T07:59:59-07:00')),false);assert.equal(w(start,Date.parse('2026-11-04T08:00:00-07:00')),true);
assert.equal(w(start,start-1800001),true);assert.equal(w(start,start-1800000),false);assert.equal(w(start,start),false);
const dst=Date.parse(iso('2026-11-01 09:00:00'));assert.equal(w(dst,Date.parse('2026-10-31T08:00:00-06:00')),true);assert.equal(w(dst,Date.parse('2026-10-31T07:59:00-06:00')),false);
assert.equal(w(NaN,Date.now()),false);console.log('EXC: 8 AM prior-day opening, exact 30-minute cutoff, past/invalid dates and DST transition passed.');
