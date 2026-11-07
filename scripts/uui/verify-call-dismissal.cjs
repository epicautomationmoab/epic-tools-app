const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const {NextRequest, NextResponse} = require('next/server');
let profile = {id:'synthetic-employee', role:'agent'};
let requests = [];
const context = {
  exports:{}, process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://jgpihdpcdlqugmqanzfj.supabase.co', SUPABASE_SECRET_KEY:'test-placeholder'}},
  require(name) { if(name==='next/server')return {NextRequest,NextResponse}; if(name==='@/lib/team-auth')return {getAuthenticatedTeamProfile:async()=>profile}; throw Error(name); },
  fetch:async(url,init)=>{requests.push({url,init}); return new Response(init.method==='POST'?null:JSON.stringify([{id:'call-one'},{id:'call-two'}]),{status:init.method==='POST'?204:200});},
};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/team/live-calls/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const post=body=>context.exports.POST(new NextRequest('https://preview.example/api/team/live-calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
(async()=>{
  for(const denied of [null,{id:'station',role:'workstation'}]){profile=denied;requests=[];assert.equal((await post({action:'dismiss_all'})).status,401);assert.equal(requests.length,0);}
  profile={id:'synthetic-employee',role:'agent'};requests=[];
  let res=await post({action:'dismiss_all',profile_id:'another-employee'});
  assert.equal(res.status,200);assert.equal((await res.json()).dismissed,2);
  const query=new URL(requests[0].url).searchParams;
  assert.equal(query.getAll('received_at').length,2);
  assert.ok(query.getAll('received_at').some(v=>v.startsWith('lte.')));
  const saved=JSON.parse(requests[1].init.body);
  assert.deepEqual(saved.map(x=>x.profile_id),['synthetic-employee','synthetic-employee']);
  assert.deepEqual(saved.map(x=>x.live_call_id),['call-one','call-two']);
  requests=[];res=await post({live_call_id:'call-one',profile_id:'another-employee'});
  assert.equal(res.status,200);assert.equal(JSON.parse(requests[0].init.body).profile_id,'synthetic-employee');
  requests=[];assert.equal((await post({})).status,400);assert.equal(requests.length,0);
  console.log('Call dismissal: auth rejection, actor ownership, cutoff, single/all dismissal and validation passed (mocked transport).');
})().catch(e=>{console.error(e);process.exit(1)});
