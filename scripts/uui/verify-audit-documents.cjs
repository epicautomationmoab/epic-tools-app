// Tests the real audit mapper using fictional immutable acceptance snapshots.
const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
const mod={};new Function('exports',ts.transpileModule(fs.readFileSync('lib/server/audit-events.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod);
process.env.NEXT_PUBLIC_SUPABASE_URL='https://synthetic.invalid';process.env.SUPABASE_SECRET_KEY='sb_secret_test_only';
const calls=[];
global.fetch=async(url,options)=>{
 const u=new URL(url),table=u.pathname.split('/').pop(),p=u.searchParams;calls.push({table,p});
 assert.equal(options.headers.Authorization,undefined);assert.equal(options.cache,'no-store');
 assert(!/signature_data_url|ip_address|user_agent|customer_email|customer_phone/.test(p.get('select')));
 if(table==='cancellation_agreement_acceptances')return {ok:true,json:async()=>[
  {id:'replacement',request_id:'request-two',confirmation_code:'SYNTHETIC',policy_version:'v2',policy_title:'Second snapshot',signer_name:'New Guest',accepted_at:'2026-11-06T19:00:00Z'},
  {id:'original',request_id:'request-one',confirmation_code:'SYNTHETIC',policy_version:'v1',policy_title:'First snapshot',signer_name:'Prior Guest',accepted_at:'2026-11-06T18:00:00Z'}
 ]};
 if(table==='epic_reservation_events')return {ok:true,json:async()=>[{id:'event',readiness_id:'rental',event_type:'rental_returned',event_notes:'Recorded transition',recorded_by:null,recorded_at:'2026-11-06T18:30:00Z'}]};
 return {ok:true,json:async()=>[]};
};
(async()=>{
 let r=await mod.loadAuditEvents({area:'Documents'});assert.equal(r.errors.length,0);assert.equal(r.events.length,2);assert.equal(r.events[0].actor,'Guest: New Guest');assert(r.events[1].detail.includes('First snapshot · Version v1'));assert.equal(r.events[1].object,'request-one');assert(calls.every(c=>c.table==='cancellation_agreement_acceptances'));console.log('PASS original and replacement immutable snapshots remain distinct; guests are not labeled employees');
 calls.length=0;r=await mod.loadAuditEvents({area:'Readiness'});assert.equal(r.events[0].actor,'Unknown');assert.equal(r.events[0].action,'rental_returned');assert.equal(r.events[0].detail,'Recorded transition');console.log('PASS reservation event retains recorded action and unknown attribution');
 calls.length=0;await mod.loadAuditEvents({area:'Documents',employee:'00000000-0000-4000-8000-000000000001'});assert(calls.every(c=>!c.p.has('or')&&c.p.has('signer_name')));console.log('PASS profile-shaped search never targets a nonexistent actor-ID column');
 console.log('PASS secret API keys stay in API-key header; sensitive signature/contact/session fields excluded');
})().catch(e=>{console.error(e);process.exitCode=1});
