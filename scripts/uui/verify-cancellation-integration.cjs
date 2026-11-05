const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const {NextRequest,NextResponse}=require('next/server');
let profile={display_name:'Synthetic Employee',role:'team'},reads=[],writes=0,forwards=0;
const env={VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_lZGiQ85J6jQRgSRostBvUJGVKv6r',EPIC_STAGING_NO_OUTBOUND:'true'};
const shared={};
const boundary={};load('lib/uui-internal-writes.ts',boundary,{});
function load(path,target,dependencies){vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:target,URL,URLSearchParams,Date,process:{env},fetch:async()=>{forwards++;throw Error('Unexpected external hop')},require(name){if(name==='next/server')return {NextResponse};if(name==='node:crypto')return require(name);if(name.includes('team-auth'))return {getAuthenticatedTeamProfile:async()=>profile};if(dependencies[name])return dependencies[name];throw Error('Unexpected import '+name)}})}
load('app/api/team/cancellation-agreements/route.ts',shared,{
 '@/lib/uui-internal-writes':boundary,
 '@/lib/cancellation-policy':{CANCELLATION_POLICY_VERSION:'test-version',getCancellationPolicy:()=>({title:'Test',summary:'Test',paragraphs:['Test'],acceptanceStatement:'Test only'})},
 '@/lib/server/agreement-email':{agreementEmailConfigured:()=>false},
 '@/lib/server/patti-policy-source':{getPattiPolicyDecision:async()=>({status:'declined'})},
 '@/lib/server/podium':{podiumConnected:async()=>false},
 '@/lib/server/workstation-auth':{verifyWorkstationCookie:()=>false},
 '@/lib/server/supabase-rest':{
  supabaseSelect:async(table,params)=>{reads.push({table,params});return table==='guest_readiness_operational'?[{readiness_id:'synthetic-id',confirmation_code:'PREVIEW-TEST',visit_start_time:'2026-11-04T16:00:00Z'}]:[]},
  supabasePatch:async()=>{writes++},supabaseInsert:async(table,value)=>{writes++;assert.equal(value.delivery_mode,'copy');assert.equal(value.sent_by,'Synthetic Employee');return {id:'created-test-id'}}
 }
});
const sales={};load('modules/sales/app/api/cancellation-acknowledgement/route.ts',sales,{'@/app/api/team/cancellation-agreements/route':shared});
const request=()=>new NextRequest('https://preview.example/api/sales/cancellation-acknowledgement?readinessId=synthetic-id',{headers:{cookie:'epic_access_token=synthetic-token'}});
(async()=>{
 let r=await sales.GET(request());assert.equal(r.status,200);assert.equal((await r.json()).agreement,null);assert.equal(forwards,0);assert.equal(writes,0);assert(reads.length===2&&reads.every(x=>x.params.get('readiness_id')==='eq.synthetic-id'));
 for(const method of ['POST','DELETE']){r=await sales[method](request());assert.equal(r.status,403)}
 assert.equal(writes,0);assert.equal(forwards,0);
 profile=null;r=await sales.GET(request());assert.equal(r.status,401);
 profile={role:'workstation'};r=await sales.GET(request());assert.equal(r.status,401);
 // Even a missing outbound flag cannot re-enable a live proxy in the UUI project.
 env.EPIC_STAGING_NO_OUTBOUND=undefined;profile={role:'team'};
 r=await sales.GET(request());assert.equal(r.status,200);r=await sales.POST(request());assert.equal(r.status,403);assert.equal(forwards,0);
 env.EPIC_STAGING_NO_OUTBOUND='true';env.NEXT_PUBLIC_SUPABASE_URL='https://jgpihdpcdlqugmqanzfj.supabase.co';profile={display_name:'Synthetic Employee',role:'team'};
 const post=mode=>new NextRequest('https://preview.example/api/sales/cancellation-acknowledgement',{method:'POST',headers:{cookie:'epic_access_token=synthetic-token','Content-Type':'application/json'},body:JSON.stringify({readinessId:'synthetic-id',deliveryMode:mode,tripSafeStatus:'declined'})});
 r=await sales.POST(post('copy'));assert.equal(r.status,200);const copied=await r.json();assert(copied.agreementUrl.startsWith('https://preview.example/a/'));assert.equal(writes,2);assert.equal(forwards,0);
 for(const mode of ['sms','email','both',undefined]){r=await sales.POST(post(mode));assert.equal(r.status,403)}assert.equal(writes,2);
 profile={role:'workstation'};r=await shared.POST(post('copy'));assert.equal(r.status,401);profile={display_name:'Synthetic Employee',role:'team'};
 env.NEXT_PUBLIC_SUPABASE_URL='https://production.invalid';r=await shared.POST(post('copy'));assert.equal(r.status,403);assert.equal(writes,2);assert.equal(forwards,0);
 console.log('Cancellation acknowledgement: shared local reader, reservation-bound query, employee auth, workstation denial, no live forwarding, Preview copy stays local with employee attribution; delivery/reset and wrong database blocked.');
})().catch(e=>{console.error(e);process.exit(1)});
