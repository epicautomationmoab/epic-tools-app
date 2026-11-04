const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const {NextRequest,NextResponse}=require('next/server');
let profile={display_name:'Synthetic Employee',role:'team'},reads=[],writes=0,forwards=0;
const env={VERCEL_ENV:'preview',VERCEL_PROJECT_ID:'prj_lZGiQ85J6jQRgSRostBvUJGVKv6r',EPIC_STAGING_NO_OUTBOUND:'true'};
const shared={};
function load(path,target,dependencies){vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:target,URL,URLSearchParams,Date,process:{env},fetch:async()=>{forwards++;throw Error('Unexpected external hop')},require(name){if(name==='next/server')return {NextResponse};if(name==='node:crypto')return require(name);if(name.includes('team-auth'))return {getAuthenticatedTeamProfile:async()=>profile};if(dependencies[name])return dependencies[name];throw Error('Unexpected import '+name)}})}
load('app/api/team/cancellation-agreements/route.ts',shared,{
 '@/lib/cancellation-policy':{},
 '@/lib/server/agreement-email':{agreementEmailConfigured:()=>false},
 '@/lib/server/patti-policy-source':{getPattiPolicyDecision:async()=>({status:'declined'})},
 '@/lib/server/podium':{podiumConnected:async()=>false},
 '@/lib/server/workstation-auth':{verifyWorkstationCookie:()=>false},
 '@/lib/server/supabase-rest':{
  supabaseSelect:async(table,params)=>{reads.push({table,params});return table==='guest_readiness_with_handoff_v'?[{readiness_id:'synthetic-id',confirmation_code:'PREVIEW-TEST',visit_start_time:'2026-11-04T16:00:00Z'}]:[]},
  supabasePatch:async()=>{writes++},supabaseInsert:async()=>{writes++}
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
 console.log('Cancellation acknowledgement: shared local reader, reservation-bound query, employee auth, workstation denial, no live forwarding, Preview delivery/reset blocked.');
})().catch(e=>{console.error(e);process.exit(1)});
