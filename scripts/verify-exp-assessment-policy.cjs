// Regression for the owner-approved relaxed policy. No network or guest data.
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
function load(path,deps={}){const out={};new Function('exports','require',ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(out,id=>deps[id]);return out}
const p=load('lib/exp/assessment-policy.ts');const {EXP_QUESTION_BANK_DRAFT:q}=load('lib/exp/question-bank-draft.ts');
const good=q.map(x=>({questionId:x.id,optionId:x.correctOptionId}));
const answers=ids=>good.map(a=>ids.includes(a.questionId)?{...a,optionId:q.find(x=>x.id===a.questionId).options.find(o=>o.id!==a.optionId).id}:a);
const grade=ids=>p.gradeExpAssessment(q,answers(ids));let count=0;
function check(name,fn){fn();count++;console.log('PASS '+name)}
check('10/10 completes',()=>assert.equal(grade([]).status,'complete'));
for(const ids of [['throttle'],['throttle','steep-climb']])check(ids.length+' ordinary misses complete with corrections',()=>{const r=grade(ids);assert.equal(r.status,'complete');assert.deepEqual(r.corrections.map(c=>c.questionId).sort(),[...ids].sort())});
check('three ordinary misses offer another quiz',()=>{const r=grade(['throttle','steep-climb','two-wheel']);assert.equal(r.status,'retry_or_technician');assert.equal(r.reason,'noncritical')});
for(const ids of [['protections'],['protections','shifting']])check(ids.length+' critical misses allow targeted retry',()=>{const r=grade(ids);assert.equal(r.status,'critical_retry');assert.deepEqual(r.questionIds.sort(),[...ids].sort());assert(!JSON.stringify(r).includes('correctOptionId'))});
check('three critical misses require rewatch or technician',()=>{const r=grade(['protections','shifting','speed']);assert.equal(r.status,'retry_or_technician');assert.equal(r.reason,'critical')});
check('resolved critical retry completes with ordinary correction',()=>{const r=p.resolveCriticalRetry(q,answers(['protections','steep-climb']),good.filter(a=>a.questionId==='protections'));assert.equal(r.status,'complete');assert.equal(r.corrections[0].questionId,'steep-climb')});
check('second critical miss requires rewatch or technician',()=>{const r=p.resolveCriticalRetry(q,answers(['protections']),answers(['protections']).filter(a=>a.questionId==='protections'));assert.equal(r.reason,'critical')});
check('resolved critical retry still respects three ordinary misses',()=>{const r=p.resolveCriticalRetry(q,answers(['protections','throttle','steep-climb','two-wheel']),good.filter(a=>a.questionId==='protections'));assert.equal(r.reason,'noncritical')});
check('invalid retry cannot consume a second chance',()=>assert.throws(()=>p.resolveCriticalRetry(q,answers(['protections']),[{questionId:'protections',optionId:'invalid'}])));
check('duplicate or missing answers are rejected',()=>{assert.throws(()=>p.gradeExpAssessment(q,good.slice(1)));assert.throws(()=>p.gradeExpAssessment(q,[...good.slice(1),good[1]]))});
console.log(JSON.stringify({passed:count}));
