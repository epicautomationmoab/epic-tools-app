const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
let profile=null,requests=[],payload=[],responseStatus=200;
const ctx={exports:{},process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://jgpihdpcdlqugmqanzfj.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'publishable-test',SUPABASE_SECRET_KEY:'must-not-use'}},require(n){if(n==='next/server')return {NextRequest,NextResponse};if(n==='@/lib/team-auth')return {getAuthenticatedTeamProfile:async()=>profile};throw Error(n);},fetch:async(url,init)=>{requests.push({url,init});return new Response(JSON.stringify(payload),{status:responseStatus});}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/team/readiness/notes/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
const call=(method,body)=>ctx.exports[method](new NextRequest('https://preview.example/api/team/readiness/notes',{method,headers:{cookie:'epic_access_token=employee-jwt','Content-Type':'application/json'},body:JSON.stringify(body)}));
(async()=>{
 for(const p of [null,{active:false,role:'agent'},{active:true,role:'workstation'}]){profile=p;requests=[];for(const method of ['POST','PATCH','DELETE'])assert.equal((await call(method,{})).status,401);assert.equal(requests.length,0);}
 profile={active:true,role:'agent'};requests=[];
 assert.equal((await call('POST',{confirmation:'PREVIEW-HISTORY-312',note_text:'x'.repeat(4001)})).status,400);
 assert.equal((await call('PATCH',{note_id:'legacy',note_text:'edit'})).status,400);
 const body={note_id:'00000000-0000-4000-8000-000000000001',note_text:'edit'};
 assert.equal((await call('PATCH',body)).status,409);assert.equal(requests.length,0);
 body.expected_updated_at='2026-11-04T20:00:00.123456Z';
 responseStatus=409;payload={code:'40001'};assert.equal((await call('PATCH',body)).status,409);
 responseStatus=200;payload=[{note_id:body.note_id,author_name:'Team Test',updated_at:body.expected_updated_at}];
 const result=await call('PATCH',body);assert.equal(result.status,200);assert.equal((await result.json()).note.created_by,'Team Test');
 const last=requests.at(-1);assert.equal(last.init.headers.Authorization,'Bearer employee-jwt');assert.equal(last.init.headers.apikey,'publishable-test');
 assert.equal(JSON.parse(last.init.body).p_expected_updated_at,body.expected_updated_at);
 await call('DELETE',body);assert.equal(JSON.parse(requests.at(-1).init.body).p_archive,true);
 console.log('Readiness note route: authentication, validation, stale conflict, attribution mapping and user-JWT writes passed.');
})().catch(e=>{console.error(e);process.exit(1)});
