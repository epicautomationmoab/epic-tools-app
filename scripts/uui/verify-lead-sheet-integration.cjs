const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
let profile={id:'profile-test',user_id:'user-test',role:'agent'},requests=[],isolated=true;
const context={exports:{},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://isolated.invalid',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-test'}},require(name){if(name==='next/server')return {NextRequest,NextResponse};if(name.endsWith('team-auth'))return {getAuthenticatedTeamProfile:async()=>profile};if(name==='@/lib/uui-internal-writes')return {isIsolatedUui:()=>isolated};if(name==='@/lib/server/supabase-rest')return {serverSupabaseHeaders:()=>({apikey:'server-test',Authorization:'Bearer server-test','Content-Type':'application/json'})};throw Error(name)},fetch:async(url,init)=>{requests.push({url,init});return Response.json(url.includes('/rpc/')?{id:'sheet',contact_id:'contact'}:[{id:'sheet'}])}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('modules/sales/app/api/lead-sheets/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const req=(method,body,query='')=>context.exports[method](new NextRequest('https://preview.invalid/api/sales/lead-sheets'+query,{method,headers:{cookie:'epic_access_token=employee-token','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}));
(async()=>{
for(const denied of [null,{id:'station',role:'workstation'}]){profile=denied;requests=[];assert.equal((await req('POST',{fields:{name:'Test'}})).status,401);assert.equal(requests.length,0)}
profile={id:'profile-test',user_id:'user-test',role:'agent'};
requests=[];assert.equal((await req('POST',{fields:[]})).status,400);assert.equal(requests.length,0);
assert.equal((await req('POST',{owner_user_id:'spoof',fields:{name:'Synthetic',phone:'2025550198'}})).status,200);
assert.equal(requests[0].init.headers.apikey,'server-test');assert.equal(JSON.parse(requests[0].init.body).owner_user_id,'user-test');
requests=[];await req('GET',null,'?phone=2025550198');assert.ok(requests[0].url.includes('customer_phone=eq.2025550198'));assert.equal(requests[0].init.headers.apikey,'server-test');
requests=[];await req('POST',{fields:{name:'Synthetic',phone:'2025550198'},finalize:true});assert.ok(requests[0].url.endsWith('/rpc/finalize_and_claim_epicc360_lead_sheet'));assert.equal(requests[0].init.headers.Authorization,'Bearer employee-token');
requests=[];assert.equal((await req('POST',{fields:{phone:'bad'},finalize:true})).status,400);assert.equal(requests.length,0);
isolated=false;await req('POST',{fields:{name:'Synthetic'}});assert.equal(requests[0].init.headers.Authorization,'Bearer employee-token');
console.log('Lead sheet integration passed: employee/workstation guards, isolated storage, attribution, bounded reader, existing authenticated finalizer, invalid phone, unchanged non-UUI transport.');
})().catch(e=>{console.error(e);process.exit(1)});
