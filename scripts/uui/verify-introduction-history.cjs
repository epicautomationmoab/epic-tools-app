const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest,NextResponse}=require('next/server');
let profile=null,requests=[],payload=[],status=200,fail=false;
const env={NEXT_PUBLIC_SUPABASE_URL:'https://jgpihdpcdlqugmqanzfj.supabase.co',SUPABASE_SECRET_KEY:'test-server-secret'};
const ctx={exports:{},process:{env},require(n){if(n==='next/server')return {NextRequest,NextResponse};if(n.endsWith('/team-auth'))return {getAuthenticatedTeamProfile:async()=>profile};throw Error(n)},fetch:async(url,init)=>{requests.push({url,init});if(fail)throw Error('private upstream detail');return new Response(JSON.stringify(payload),{status})}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('modules/sales/app/api/sales-introduction-email/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
const id='00000000-0000-4000-8000-000000000001';
const get=(value=id)=>ctx.exports.GET(new NextRequest('https://preview.example/api/sales/sales-introduction-email?opportunity_id='+encodeURIComponent(value)));
(async()=>{
 for(const p of [null,{active:false,role:'agent'},{active:true,role:'workstation'}]){profile=p;requests=[];assert.equal((await get()).status,401);assert.equal(requests.length,0)}
 profile={active:true,role:'agent'};requests=[];assert.equal((await get('------------------------------------')).status,400);assert.equal(requests.length,0);
 let r=await get();assert.equal(r.status,200);assert.deepEqual(await r.json(),{sentAt:null});assert.equal(r.headers.get('Cache-Control'),'no-store');
 const u=new URL(requests[0].url);assert.equal(u.origin,env.NEXT_PUBLIC_SUPABASE_URL);for(const [k,v] of Object.entries({matched_sales_opportunity_id:'eq.'+id,source_type:'eq.sales_introduction',direction:'eq.outbound',select:'sent_at',order:'sent_at.desc',limit:'1'}))assert.equal(u.searchParams.get(k),v);
 payload=[{sent_at:'2026-11-04T20:00:00Z',body:'must not leak'}];assert.deepEqual(await (await get()).json(),{sentAt:'2026-11-04T20:00:00Z'});
 status=403;r=await get();assert.equal(r.status,502);assert.equal((await r.json()).error,'Unable to verify introduction history.');
 status=200;fail=true;assert.equal((await get()).status,502);fail=false;
 payload={error:'malformed'};assert.equal((await get()).status,502);
 delete env.SUPABASE_SECRET_KEY;requests=[];assert.equal((await get()).status,503);assert.equal(requests.length,0);
 console.log('Introduction history: employee permissions, strict UUID, bounded timestamp-only query, no-store, empty/history responses, malformed/upstream/network/config failures passed.');
})().catch(e=>{console.error(e);process.exit(1)});
