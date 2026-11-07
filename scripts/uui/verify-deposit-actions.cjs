const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextResponse}=require('next/server');
let profile=null,calls=[];
function load(path){const ctx={exports:{},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SECRET_KEY:'synthetic-unit-test-key'}},require(n){if(n==='next/server')return {NextResponse};if(n==='next/headers')return {cookies:async()=>({get:()=>({value:'mock-token'})})};if(n.endsWith('/team-auth'))return {getAuthenticatedTeamProfile:async()=>profile};throw Error(n)},fetch:async(url,init)=>{calls.push({url,body:JSON.parse(init.body)});return Response.json({status:'released'})}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);return ctx.exports}
const hold=load('app/api/deposits/hold/route.ts'),manual=load('app/api/deposits/manually-released/route.ts');
const body={readiness_id:'00000000-0000-4000-8000-000000000312',reason:'Synthetic reconciliation only',p_actor:'Spoofed actor'};
const req=b=>new Request('https://preview.invalid/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
(async()=>{
 for(const route of [hold,manual]){calls=[];assert.equal((await route.POST(req(body))).status,401);assert.equal(calls.length,0)}
 for(const role of ['agent','workstation']){profile={role,display_name:'Test'};calls=[];assert.equal((await manual.POST(req(body))).status,403);assert.equal(calls.length,0)}
 for(const role of ['manager','admin']){profile={role,display_name:'Manager Test'};calls=[];assert.equal((await manual.POST(req(body))).status,200);assert.ok(calls[0].url.endsWith('/manually_release_rental_damage_deposit'));assert.equal(calls[0].body.p_actor,'Manager Test');assert.equal(calls[0].body.p_reason,body.reason)}
 calls=[];for(const b of [{},{...body,reason:'no'},{...body,readiness_id:'bad'}])assert.equal((await manual.POST(req(b))).status,400);assert.equal(calls.length,0);
 profile={role:'agent',display_name:'Team Test'};calls=[];assert.equal((await hold.POST(req(body))).status,200);assert.ok(calls[0].url.endsWith('/set_rental_damage_deposit_hold'));assert.equal(calls[0].body.p_do_not_release,true);assert.equal(calls[0].body.p_updated_by,'Team Test');
 console.log('Deposit controls passed: unauthenticated denial, agent/workstation reconciliation denial, manager/admin attribution, invalid reasons/IDs rejected, staff hold uses existing hold RPC. Mock transport only; no payments or worker calls.');
})().catch(e=>{console.error(e);process.exit(1)});
